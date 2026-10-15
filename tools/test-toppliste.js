#!/usr/bin/env node
/* Tester for api/toppliste.js uten ekte database: fetch byttes ut med en
   liten Redis i minnet som forstår kommandoene funksjonen bruker.
   Kjør: node tools/test-toppliste.js */
'use strict';

const assert = require('assert');
const path = require('path');

/* ---------------------------------------------------------------------------
   Falsk Upstash
   --------------------------------------------------------------------------- */
const lager = new Map();      /* nøkkel → { type, verdi, utloper } */
const levende = (k) => {
  const v = lager.get(k);
  if (v && v.utloper && v.utloper < Date.now()) { lager.delete(k); return null; }
  return v || null;
};
const sortert = (z) => [...z.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
const indeks = (i, n) => (i < 0 ? n + i : i);

function kjor([cmd, ...a]) {
  switch (cmd.toUpperCase()) {
    case 'SET': {
      const nx = a.includes('NX');
      if (nx && levende(a[0])) { return null; }
      const ex = a.indexOf('EX');
      lager.set(a[0], { type: 's', verdi: String(a[1]), utloper: ex > -1 ? Date.now() + Number(a[ex + 1]) * 1000 : 0 });
      return 'OK';
    }
    case 'GETDEL': { const v = levende(a[0]); lager.delete(a[0]); return v ? v.verdi : null; }
    case 'INCR': {
      const v = levende(a[0]) || { type: 's', verdi: '0', utloper: 0 };
      v.verdi = String(Number(v.verdi) + 1); lager.set(a[0], v); return Number(v.verdi);
    }
    case 'ZADD': {
      const v = levende(a[0]) || { type: 'z', verdi: new Map() };
      v.verdi.set(a[2], Number(a[1])); lager.set(a[0], v); return 1;
    }
    case 'ZSCORE': { const v = levende(a[0]); return v && v.verdi.has(a[1]) ? String(v.verdi.get(a[1])) : null; }
    case 'ZREVRANK': {
      const v = levende(a[0]); if (!v || !v.verdi.has(a[1])) { return null; }
      return sortert(v.verdi).reverse().findIndex(([m]) => m === a[1]);
    }
    case 'ZRANGE': {
      const v = levende(a[0]); if (!v) { return []; }
      let rader = sortert(v.verdi);
      if (a.includes('REV')) { rader.reverse(); }
      const n = rader.length, fra = indeks(Number(a[1]), n), til = indeks(Number(a[2]), n);
      rader = rader.slice(Math.max(0, fra), til + 1);
      return a.includes('WITHSCORES') ? rader.flatMap(([m, s]) => [m, String(s)]) : rader.map(([m]) => m);
    }
    case 'ZREMRANGEBYRANK': {
      const v = levende(a[0]); if (!v) { return 0; }
      const rader = sortert(v.verdi), n = rader.length;
      const ut = rader.slice(Math.max(0, indeks(Number(a[1]), n)), indeks(Number(a[2]), n) + 1);
      ut.forEach(([m]) => v.verdi.delete(m)); return ut.length;
    }
    case 'HSET': {
      const v = levende(a[0]) || { type: 'h', verdi: new Map() };
      v.verdi.set(a[1], a[2]); lager.set(a[0], v); return 1;
    }
    case 'HSETNX': {
      const v = levende(a[0]) || { type: 'h', verdi: new Map() };
      if (v.verdi.has(a[1])) { return 0; }
      v.verdi.set(a[1], a[2]); lager.set(a[0], v); return 1;
    }
    case 'HGET': { const v = levende(a[0]); return v && v.verdi.has(a[1]) ? v.verdi.get(a[1]) : null; }
    case 'HMGET': { const v = levende(a[0]); return a.slice(1).map((f) => (v && v.verdi.has(f) ? v.verdi.get(f) : null)); }
    case 'HDEL': { const v = levende(a[0]); let n = 0; a.slice(1).forEach((f) => { if (v && v.verdi.delete(f)) { n++; } }); return n; }
    default: throw new Error('ukjent kommando ' + cmd);
  }
}

/* Klokka kan spoles fram, så runder kan «vare» like lenge som loggen sier */
let forskyv = 0;
const ekteNaa = Date.now;
Date.now = () => ekteNaa() + forskyv;
const spol = (ms) => { forskyv += ms; };

let dbKall = 0;
global.fetch = async (url, valg) => {
  dbKall++;
  assert.ok(String(url).endsWith('/pipeline'), 'bruker pipeline-endepunktet');
  assert.strictEqual(valg.headers.Authorization, 'Bearer test-token');
  const kommandoer = JSON.parse(valg.body);
  const svar = kommandoer.map((k) => { try { return { result: kjor(k) }; } catch (e) { return { error: e.message }; } });
  return { ok: true, status: 200, json: async () => svar };
};

/* ---------------------------------------------------------------------------
   Kall funksjonen som Vercel gjør
   --------------------------------------------------------------------------- */
const FIL = path.join(__dirname, '..', 'api', 'toppliste.js');
function last(env) {
  delete require.cache[require.resolve(FIL)];
  const gammel = { ...process.env };
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'TOPPLISTE_HEMMELIGHET',
    'REDIS_URL', 'KV_URL', 'POSTGRES_URL', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN']
    .forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  const mod = require(FIL);
  process.env = gammel;
  return mod;
}

async function kall(fn, { method = 'POST', body, ip = '10.0.0.1', origin, host = 'barekylling.no' } = {}) {
  const req = { method, headers: { 'x-forwarded-for': ip + ', 1.1.1.1', host }, body };
  if (origin) { req.headers.origin = origin; }
  const res = {
    statusCode: 200, hode: {},
    setHeader(k, v) { this.hode[k.toLowerCase()] = v; },
    end(t) { this.kropp = t; }
  };
  await fn(req, res);
  return { status: res.statusCode, data: JSON.parse(res.kropp), hode: res.hode };
}

/* Lager en logg som om man hoppet n ganger framover med `cs` hundredeler mellom */
const logg = (n, cs = 20, ekstra = []) => [...Array(n).fill('u'), ...ekstra].map((r, i) => r + (i ? cs : 30).toString(36)).join(',');

let ok = 0;
async function test(navn, fn) {
  try { await fn(); ok++; console.log('  ✓ ' + navn); } catch (e) { console.log('  ✗ ' + navn + '\n    ' + e.message); process.exitCode = 1; }
}

(async () => {
  console.log('api/toppliste.js');

  /* 503-svaret logges med console.error; hold testutskriften ren */
  const stille = async (fn) => {
    const ekte = console.error; const logget = [];
    console.error = (...a) => logget.push(a.join(' '));
    try { return { svar: await fn(), logget }; } finally { console.error = ekte; }
  };

  await test('uten database: 503 med hjelpetekst', async () => {
    const { svar: r, logget } = await stille(() => kall(last({}), { method: 'GET' }));
    assert.strictEqual(r.status, 503);
    assert.strictEqual(r.data.feil, 'ikke-koblet');
    assert.match(r.data.hjelp, /Ingen database/);
    assert.strictEqual(r.hode['cache-control'], 'no-store');
    assert.strictEqual(logget.length, 1);
  });

  await test('feil databasetype (bare REDIS_URL): 503 som sier hva som mangler', async () => {
    const { svar: r } = await stille(() => kall(last({ REDIS_URL: 'redis://hemmelig@falsk:6379' }), { method: 'GET' }));
    assert.strictEqual(r.status, 503);
    assert.match(r.data.hjelp, /Upstash for Redis/);
    assert.ok(!JSON.stringify(r.data).includes('hemmelig'), 'verdien skal aldri vises');
  });

  const fn = last({ KV_REST_API_URL: 'https://falsk.upstash.io', KV_REST_API_TOKEN: 'test-token' });
  /* Hver innsending får sin egen IP, så grensene ikke slår inn i andre tester */
  let nr = 0;
  const nyIp = () => `10.9.${Math.floor(++nr / 250)}.${nr % 250}`;
  const start = async (ip) => (await kall(fn, { body: { handling: 'start' }, ip: ip || nyIp() })).data.billett;
  const sendInn = (b, over = {}) => {
    /* Hvert navn sendes fra sin egen «enhet» med mindre testen sier noe annet */
    const body = { handling: 'send', billett: b, navn: 'Kari', poeng: 12, logg: logg(12), ...over };
    if (!('enhet' in over)) { body.enhet = 'enhet-' + String(body.navn).toLowerCase().replace(/[^a-z0-9]/g, '') + '-0000000000'; }
    delete body.ip;
    if (!over.utenSpoling && typeof body.logg === 'string') {
      spol(body.logg.split(',').reduce((s, t) => s + (parseInt(t.slice(1), 36) || 0) * 10, 0));
    }
    delete body.utenSpoling;
    return kall(fn, { body, ip: over.ip || nyIp() });
  };

  await test('finner databasen også med et annet prefiks', async () => {
    const annen = last({ STORAGE_KV_REST_API_URL: 'https://falsk.upstash.io', STORAGE_KV_REST_API_TOKEN: 'test-token' });
    const r = await kall(annen, { method: 'GET', ip: '10.0.6.1' });
    assert.strictEqual(r.status, 200);
  });

  await test('GET på tom liste', async () => {
    const r = await kall(fn, { method: 'GET' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.data.liste, []);
    /* Lista kan caches kort i CDN-et, men aldri i nettleseren */
    assert.match(r.hode['cache-control'], /s-maxage=\d+/);
    assert.match(r.hode['cache-control'], /(^|, )max-age=0/);
  });

  await test('billetter og innsendinger caches aldri', async () => {
    const r = await kall(fn, { body: { handling: 'start' }, ip: nyIp() });
    assert.strictEqual(r.hode['cache-control'], 'no-store');
  });

  await test('start gir en signert billett', async () => {
    const b = await start();
    assert.match(b, /^[\w-]{16}\.\d{13}\.[\w-]{32}$/);
  });

  await test('gyldig runde kommer på lista', async () => {
    const r = await sendInn(await start());
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.strictEqual(r.data.plass, 1);
    assert.strictEqual(r.data.liste[0].navn, 'Kari');
    assert.strictEqual(r.data.liste[0].poeng, 12);
    assert.match(r.data.liste[0].dato, /^\d{4}-\d\d-\d\d$/);
  });

  await test('samme billett kan ikke brukes to ganger', async () => {
    const b = await start();
    assert.strictEqual((await sendInn(b, { navn: 'Ola' })).status, 200);
    const r = await sendInn(b, { navn: 'Ola' });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.melding, /allerede/);
  });

  await test('falsk signatur avvises', async () => {
    const b = (await start()).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    assert.strictEqual((await sendInn(b)).status, 400);
    assert.strictEqual((await sendInn('abc')).status, 400);
    assert.strictEqual((await sendInn(undefined)).status, 400);
  });

  await test('egen billett med riktig format men uten databaserad avvises', async () => {
    const b = await start();
    const [id] = b.split('.');
    lager.delete('bk:runde:' + id);
    assert.strictEqual((await sendInn(b)).status, 400);
  });

  await test('poengsum som ikke stemmer med hoppene avvises', async () => {
    const r = await sendInn(await start(), { poeng: 500 });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.melding, /stemmer ikke/);
  });

  await test('hopp tilbake teller ikke som poeng', async () => {
    const r = await sendInn(await start(), { navn: 'Fram og tilbake', poeng: 12, logg: logg(12, 20, ['d', 'd', 'u', 'l', 'r']) });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  });

  await test('for raske hopp avvises', async () => {
    const r = await sendInn(await start(), { logg: logg(12, 3) });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.melding, /raskere/);
  });

  await test('runde som varte lenger enn billetten avvises', async () => {
    const r = await sendInn(await start(), { logg: logg(12, 36000), utenSpoling: true });
    assert.strictEqual(r.status, 400);
    assert.match(r.data.melding, /for fort/);
  });

  await test('ødelagt logg og rare poeng avvises', async () => {
    for (const over of [{ logg: 'x1,u2' }, { logg: 'u' }, { logg: 42 }, { poeng: 0, logg: '' }, { poeng: 1.5 }, { poeng: '12' }, { poeng: 99999 }]) {
      assert.strictEqual((await sendInn(await start(), over)).status, 400, JSON.stringify(over));
    }
  });

  await test('kallenavn sjekkes', async () => {
    const { sjekkNavn } = fn;
    const ok = ['Kari', 'Ola N.', 'Åse_99', 'Thoresen', 'Thore', 'Kylling-Kåre', 'Bjørn Ståle', 'Glass', 'Bass', 'Nazir',
      'Niger', 'Nigeria', 'Montenegro', 'Spikkestad', 'Analyse', 'Scunthorpe', 'Slutten', 'Horten', 'Mikkel', 'Assar', 'José'];
    for (const g of ok) { assert.ok(!sjekkNavn(g).feil, 'stoppet ved en feil: ' + g); }
    const stopp = ['a', 'x'.repeat(17), '<script>', '   ', '...', 'faen', 'Bare Kylling', 'ADMIN', 'h.o.r.e',
      'neger', 'NEGER', 'n e g e r', 'n.e.g.e.r', 'n-e-g-e-r', 'neeeger', 'n3g3r', 'nëger', 'nègre', 'sandneger',
      'nigger', 'N1gg3r', 'niggggerrr', 'nigga', 'нeгер', 'hitler88', 'heil hitler', '14 88', 'Drittsekk', 'kukhue',
      'fuck you', 'Fuuuck', 'F u c k', 'fitte', 'H O R E', 'Kuk', 'K.u.k', 'p0rn0', 'montenegroneger'];
    for (const d of stopp) { assert.ok(sjekkNavn(d).feil, 'slapp gjennom: ' + d); }
    assert.strictEqual(sjekkNavn('  Kari   Nord ').navn, 'Kari Nord');
    const r = await sendInn(await start(), { navn: '<b>hei</b>' });
    assert.strictEqual(r.status, 400);
  });

  await test('beste resultat per navn, og lista sorteres', async () => {
    assert.strictEqual((await sendInn(await start(), { navn: 'Per', poeng: 30, logg: logg(30), ip: '10.0.0.2' })).status, 200);
    const lav = await sendInn(await start(), { navn: 'per', poeng: 5, logg: logg(5), ip: '10.0.0.2' });
    assert.strictEqual(lav.data.plass, 1, 'lavere poeng erstatter ikke');
    const r = await kall(fn, { method: 'GET' });
    assert.deepStrictEqual(r.data.liste.map((x) => [x.navn, x.poeng]).slice(0, 2), [['Per', 30], ['Kari', 12]]);
  });

  await test('lik poengsum: den som kom først står øverst', async () => {
    const z = lager.get('bk:topp').verdi;
    const kari = z.get('kari');
    z.set('ola', 12 + (kari - 12) - 1e-6);   /* Ola fikk 12 litt senere */
    const r = await kall(fn, { method: 'GET' });
    const navn = r.data.liste.map((x) => x.navn);
    assert.ok(navn.indexOf('Kari') < navn.indexOf('Ola'));
  });

  /* Grensene teller i faste 10-minuttersvinduer. Spol til starten av et nytt
     vindu, så en test ikke deles i to av et vindusskifte midt i. */
  const nyttVindu = () => spol(600000 - (Date.now() % 600000) + 1000);

  await test('en hel skoleklasse bak samme IP kan spille og sende inn', async () => {
    nyttVindu();
    const skole = '10.0.7.1';
    for (let runde = 0; runde < 3; runde++) {
      for (let elev = 0; elev < 30; elev++) {
        const b = await start(skole);
        assert.ok(b, `elev ${elev} fikk ikke billett i runde ${runde + 1}`);
        if (runde === 0) {
          const r = await sendInn(b, { navn: 'Elev ' + elev, poeng: 5, logg: logg(5), ip: skole });
          assert.strictEqual(r.status, 200, JSON.stringify(r.data));
        }
      }
    }
    assert.strictEqual((await kall(fn, { method: 'GET', ip: skole })).status, 200);
  });

  await test('grense per IP for innsending', async () => {
    nyttVindu();
    const ip = '10.0.0.9';
    let siste;
    for (let i = 0; i < 61; i++) { siste = await sendInn(await start('10.0.1.' + i), { navn: 'Spammer' + i, ip }); }
    assert.strictEqual(siste.status, 429);
    const annen = await sendInn(await start('10.0.2.1'), { navn: 'Annen', ip: '10.0.0.10' });
    assert.strictEqual(annen.status, 200);
  });

  await test('kallenavnet tilhører enheten som tok det først', async () => {
    nyttVindu();
    const min = 'min-enhet-1234567890', annen = 'annen-enhet-123456789';
    const r1 = await sendInn(await start(), { navn: 'Eier', enhet: min, poeng: 5, logg: logg(5) });
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.data));
    /* Samme enhet kan sende inn igjen under samme navn, uansett store/små bokstaver */
    const r2 = await sendInn(await start(), { navn: 'eier', enhet: min, poeng: 6, logg: logg(6) });
    assert.strictEqual(r2.status, 200, JSON.stringify(r2.data));
    /* En annen enhet får ikke bruke navnet – og billetten brukes ikke opp */
    const b = await start();
    const r3 = await sendInn(b, { navn: 'Eier', enhet: annen, poeng: 9, logg: logg(9) });
    assert.strictEqual(r3.status, 409);
    assert.match(r3.data.melding, /tatt/);
    const r4 = await sendInn(b, { navn: 'Fjerde', enhet: annen, poeng: 9, logg: logg(9) });
    assert.strictEqual(r4.status, 200, 'samme billett skal kunne brukes med et ledig navn');
    const eiere = [...lager.get('bk:eier').verdi.values()].join(' ');
    assert.ok(!eiere.includes(min), 'enhetsnøkkelen lagres bare som hash');
  });

  await test('sjekk av nytt kallenavn: ledig, ditt eget, tatt', async () => {
    const sjekk = (navn, enhet) => kall(fn, { body: { handling: 'navn', navn, enhet }, ip: nyIp() });
    assert.strictEqual((await sjekk('Helt Ny', 'min-enhet-1234567890')).status, 200);
    assert.strictEqual((await sjekk('Eier', 'min-enhet-1234567890')).status, 200);
    assert.strictEqual((await sjekk('Eier', 'tredje-enhet-12345678')).status, 409);
    assert.strictEqual((await sjekk('fuck', 'min-enhet-1234567890')).status, 400);
    assert.ok(!lager.get('bk:eier').verdi.has('helt ny'), 'sjekken reserverer ikke navnet');
  });

  await test('innsending uten enhet avvises', async () => {
    const r = await sendInn(await start(), { navn: 'Uten', enhet: undefined });
    assert.strictEqual(r.status, 400);
  });

  await test('pakker: egen liste, beste per navn, og aldri flere enn poengene', async () => {
    const r0 = await kall(fn, { method: 'GET', ip: nyIp() });
    assert.ok(Array.isArray(r0.data.pakker), 'GET gir også pakkelista');
    const r1 = await sendInn(await start(), { navn: 'Samler', poeng: 10, pakker: 7, logg: logg(10) });
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.data));
    assert.strictEqual(r1.data.pakkePlass, 1);
    assert.deepStrictEqual(r1.data.pakker[0], { navn: 'Samler', pakker: 7, dato: r1.data.pakker[0].dato });
    /* Lengre runde, men færre pakker: poengene oppdateres, pakkene beholdes */
    const r2 = await sendInn(await start(), { navn: 'Samler', poeng: 14, pakker: 2, logg: logg(14) });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.data.pakker.find((x) => x.navn === 'Samler').pakker, 7);
    assert.strictEqual(r2.data.liste.find((x) => x.navn === 'Samler').poeng, 14);
    /* Flere pakker enn rader er umulig */
    const r3 = await sendInn(await start(), { navn: 'Juksemaker', poeng: 5, pakker: 6, logg: logg(5) });
    assert.strictEqual(r3.status, 400);
    assert.match(r3.data.melding, /pakker/);
    for (const feil of [-1, 1.5, '3', null]) {
      assert.strictEqual((await sendInn(await start(), { navn: 'Rar', poeng: 5, pakker: feil, logg: logg(5) })).status, 400);
    }
    /* Runder uten pakker havner ikke på pakkelista */
    await sendInn(await start(), { navn: 'Ingen Pakker', poeng: 8, pakker: 0, logg: logg(8) });
    const r4 = await kall(fn, { method: 'GET', ip: nyIp() });
    assert.ok(!r4.data.pakker.some((x) => x.navn === 'Ingen Pakker'));
  });

  await test('IP-adresser lagres aldri i klartekst', async () => {
    const nokler = [...lager.keys()].join(' ');
    assert.ok(!nokler.includes('10.0.0.'), nokler.slice(0, 200));
  });

  await test('forespørsler fra andre nettsider avvises', async () => {
    const r = await kall(fn, { body: { handling: 'start' }, origin: 'https://juks.example', ip: '10.0.3.1' });
    assert.strictEqual(r.status, 403);
    const ok2 = await kall(fn, { body: { handling: 'start' }, origin: 'https://barekylling.no', ip: '10.0.3.1' });
    assert.strictEqual(ok2.status, 200);
  });

  await test('andre metoder og ukjente handlinger', async () => {
    assert.strictEqual((await kall(fn, { method: 'PUT', ip: '10.0.4.1' })).status, 405);
    assert.strictEqual((await kall(fn, { body: { handling: 'slett' }, ip: '10.0.4.1' })).status, 400);
    assert.strictEqual((await kall(fn, { body: '{ikke json', ip: '10.0.4.1' })).status, 400);
    assert.strictEqual((await kall(fn, { body: '{"handling":"start"}', ip: '10.0.4.1' })).status, 200);
  });

  await test('lista holdes på 100 plasser', async () => {
    const z = lager.get('bk:topp').verdi, h = lager.get('bk:navn').verdi;
    for (let i = 0; i < 120; i++) { z.set('fyll' + i, 1 + i / 1000); h.set('fyll' + i, JSON.stringify({ navn: 'Fyll' + i, poeng: 1, dato: '2026-10-13' })); }
    const r = await sendInn(await start('10.0.5.1'), { navn: 'Siste', poeng: 40, logg: logg(40), ip: '10.0.5.1' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.strictEqual(r.data.plass, 1);
    assert.strictEqual(z.size, 100);
    assert.strictEqual(h.size, 100);
    assert.strictEqual(r.data.liste.length, 10);
  });

  console.log(`\n${ok} tester ok${process.exitCode ? ', noen feilet' : ''} (${dbKall} databasekall)`);
})();
