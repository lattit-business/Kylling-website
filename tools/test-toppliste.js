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
    case 'ZREM': { const v = levende(a[0]); return v && v.verdi.delete(a[1]) ? 1 : 0; }
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
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'TOPPLISTE_HEMMELIGHET', 'TOPPLISTE_ADMIN_NOKKEL',
    'REDIS_URL', 'KV_URL', 'POSTGRES_URL', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN']
    .forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  const mod = require(FIL);
  process.env = gammel;
  return mod;
}

async function kall(fn, { method = 'POST', body, ip = '10.0.0.1', origin, host = 'barekylling.no', url = '/api/toppliste', auth } = {}) {
  const req = { method, url, headers: { 'x-forwarded-for': ip + ', 1.1.1.1', host }, body };
  if (auth) { req.headers.authorization = auth; }
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
  const startMedFrø = async (ip) => (await kall(fn, { body: { handling: 'start' }, ip: ip || nyIp() })).data;
  const { Bane, KOL } = await import('../bare-kylling/js/spill/bane.mjs');

  /* Lager en ekte logg: hopper opp n rader og plukker pakkene på veien (går
     sidelengs til pakken), slik spillet gjør. Gir { logg, pakker, rader }. */
  const samleLogg = (frø, n, { maks = Infinity, cs = 20 } = {}) => {
    const bane = new Bane(frø), biter = [], rader = [];
    let kol = 0, pakker = 0;
    for (let r = 1; r <= n; r++) {
      biter.push('u' + (biter.length ? cs : 30).toString(36));
      if (bane.spek(r).type === 'elv') { kol = null; continue; }
      for (const p of bane.pakker(r)) {
        if (pakker >= maks) { break; }
        if (kol !== null) {
          while (kol !== p.x) { biter.push((p.x > kol ? 'r' : 'l') + cs.toString(36)); kol += p.x > kol ? 1 : -1; }
        }
        biter.push(`p${r.toString(36)}.${p.x + KOL}`);
        kol = p.x; pakker++; rader.push(r);
      }
    }
    return { logg: biter.join(','), pakker, rader };
  };
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
      'Niger', 'Nigeria', 'Montenegro', 'Spikkestad', 'Analyse', 'Scunthorpe', 'Slutten', 'Horten', 'Mikkel', 'Assar', 'José',
      'Kat', 'Katrine', 'Fakkel', 'Fokker', 'Brunkeflo', 'Helvetia', 'Mongolia', 'Satanowski', 'Kattepus'];
    for (const g of ok) { assert.ok(!sjekkNavn(g).feil, 'stoppet ved en feil: ' + g); }
    const stopp = ['a', 'x'.repeat(17), '<script>', '   ', '...', 'faen', 'Bare Kylling', 'ADMIN', 'h.o.r.e',
      'neger', 'NEGER', 'n e g e r', 'n.e.g.e.r', 'n-e-g-e-r', 'neeeger', 'n3g3r', 'nëger', 'nègre', 'sandneger',
      'nigger', 'N1gg3r', 'niggggerrr', 'nigga', 'нeгер', 'hitler88', 'heil hitler', '14 88', 'Drittsekk', 'kukhue',
      'fuck you', 'Fuuuck', 'F u c k', 'fitte', 'H O R E', 'Kuk', 'K.u.k', 'p0rn0', 'montenegroneger',
      /* norske banneord og seksuelle ord, også med tall og mellomrom */
      'helvete', 'h3lv3t3', 'HÆLVETE', 'satan', 'f4en', 'faaan', 'jævla', 'j3vla', 'faenskap', 'fitta', 'tispe', 't1spe',
      'ballesekk', 'pikkhue', 'p1kkhue', 'hestkuk', 'føkk', 'runke', 'mongo', 'pupper', 's3xy', 'kuksuger', 'rævhøl',
      'ræva', 'horer', 'onani', 'p u l e r'];
    for (const d of stopp) { assert.ok(sjekkNavn(d).feil, 'slapp gjennom: ' + d); }
    assert.strictEqual(sjekkNavn('helvete').feil, 'Det kallenavnet går ikke.');
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
    for (let i = 0; i < 801; i++) { siste = await sendInn(await start('10.0.1.' + (i % 250)), { navn: 'Spammer' + i, ip, poeng: 1, logg: logg(1) }); }
    assert.strictEqual(siste.status, 429);
    const annen = await sendInn(await start('10.0.2.1'), { navn: 'Annen', ip: '10.0.0.10' });
    assert.strictEqual(annen.status, 200);
  });

  await test('alle kan bruke hvilket kallenavn de vil, og den beste runden står', async () => {
    nyttVindu();
    const r1 = await sendInn(await start(), { navn: 'Delt', enhet: 'min-enhet-1234567890', poeng: 5, logg: logg(5) });
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.data));
    /* En annen enhet kan bruke samme navn, og en bedre runde oppdaterer lista */
    const r2 = await sendInn(await start(), { navn: 'delt', enhet: 'annen-enhet-123456789', poeng: 9, logg: logg(9) });
    assert.strictEqual(r2.status, 200, JSON.stringify(r2.data));
    assert.strictEqual(r2.data.liste.filter((x) => x.navn.toLowerCase() === 'delt').length, 1, 'samme navn står én gang');
    assert.strictEqual(r2.data.liste.find((x) => x.navn.toLowerCase() === 'delt').poeng, 9, 'ny rekord oppdaterer lista');
    /* En dårligere runde tar ikke bort rekorden */
    const r3 = await sendInn(await start(), { navn: 'Delt', poeng: 3, logg: logg(3) });
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.data.liste.find((x) => x.navn.toLowerCase() === 'delt').poeng, 9);
    /* Sjekk av nytt navn: bare filteret */
    const sjekk = (navn) => kall(fn, { body: { handling: 'navn', navn, enhet: 'tredje-enhet-12345678' }, ip: nyIp() });
    assert.strictEqual((await sjekk('Delt')).status, 200);
    assert.strictEqual((await sjekk('fuck')).status, 400);
  });

  await test('gud-modus-navnet «barefjær» kommer aldri på lista', async () => {
    for (const navn of ['barefjær', 'BareFjaer', 'bare fjær']) {
      const r = await sendInn(await start(), { navn, enhet: 'gud-enhet-1234567890' });
      assert.strictEqual(r.status, 400, navn);
      assert.match(r.data.melding, /reservert/);
    }
  });

  await test('innsending uten enhet godtas', async () => {
    const r = await sendInn(await start(), { navn: 'Uten', enhet: undefined });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  });

  await test('billetten har et frø, og banen er lik hos server og spill', async () => {
    const a = await startMedFrø(), b = await startMedFrø();
    assert.ok(Number.isInteger(a.frø) && a.frø >= 0 && a.frø < 2 ** 32);
    assert.notStrictEqual(a.frø, b.frø);
    const x = new Bane(a.frø), y = new Bane(a.frø);
    for (let r = 0; r < 300; r += 7) { assert.deepStrictEqual(y.pakker(r), x.pakker(r)); assert.strictEqual(y.spek(r).type, x.spek(r).type); }
  });

  await test('pakker kontrolleres mot banen fra frøet', async () => {
    /* Finn et frø med pakker tidlig */
    let st, run;
    do { st = await startMedFrø(); run = samleLogg(st.frø, 30); } while (run.pakker < 3);
    const r1 = await sendInn(st.billett, { navn: 'Samler', poeng: 30, pakker: run.pakker, logg: run.logg });
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.data));
    assert.strictEqual(r1.data.pakker.find((x) => x.navn === 'Samler').pakker, run.pakker);
    /* Uten pakke-feltet regner serveren selv ut antallet */
    const st2 = await startMedFrø(), run2 = samleLogg(st2.frø, 30);
    const r2 = await sendInn(st2.billett, { navn: 'Teller', poeng: 30, logg: run2.logg });
    assert.strictEqual(r2.status, 200, JSON.stringify(r2.data));
    /* Påstått antall som ikke stemmer: serveren bruker sitt eget */
    const st3 = await startMedFrø(), run3 = samleLogg(st3.frø, 30);
    const r3 = await sendInn(st3.billett, { navn: 'Juksemaker', poeng: 30, pakker: run3.pakker + 5, logg: run3.logg });
    assert.strictEqual(r3.status, 200);
    const jp = r3.data.pakker.find((x) => x.navn === 'Juksemaker');
    assert.strictEqual(jp ? jp.pakker : 0, run3.pakker, 'bare ekte pakker telles');
  });

  await test('juks med pakker gir ingen ekstra pakker (men poengene står)', async () => {
    let st, run;
    do { st = await startMedFrø(); run = samleLogg(st.frø, 25); } while (run.pakker < 1);
    const r0 = run.rader[0], bane = new Bane(st.frø), p = bane.pakker(r0)[0];
    const tok = `p${r0.toString(36)}.${p.x + KOL}`;
    const biter = run.logg.split(',');
    const i = biter.indexOf(tok);
    const varianter = {
      'feil rad': [[...biter.slice(0, i), `p${(r0 + 1).toString(36)}.${p.x + KOL}`, ...biter.slice(i + 1)], run.pakker - 1],
      'finnes ikke': [[...biter.slice(0, i), `p${r0.toString(36)}.${((p.x + KOL + 3) % 9)}`, ...biter.slice(i + 1)], run.pakker - 1],
      'to ganger': [[...biter.slice(0, i + 1), tok, ...biter.slice(i + 1)], run.pakker],
      'to måker': [[...biter.slice(0, i + 1), 'm', 'm', ...biter.slice(i + 1)], run.pakker - 1],
      'måke uten pakker': [['m', ...biter], run.pakker]
    };
    for (const [hva, [liste, forventet]] of Object.entries(varianter)) {
      const b = await startMedFrø();
      /* Samme frø som loggen ble laget for: bytt frøet i databasen */
      const id = b.billett.split('.')[0], t = b.billett.split('.')[1];
      lager.set('bk:runde:' + id, { verdi: `${t}:${st.frø}`, utloper: 0 });
      const { lesLogg } = await import('../bare-kylling/js/spill/bane.mjs');
      const svar = lesLogg(liste.join(','), st.frø);
      assert.strictEqual(svar.poeng, 25, hva);
      assert.ok(svar.pakker <= forventet, `${hva}: ${svar.pakker} > ${forventet}`);
      const r = await sendInn(b.billett, { navn: 'Juks ' + hva.slice(0, 9), poeng: 25, logg: liste.join(',') });
      assert.strictEqual(r.status, 200, hva + ': ' + JSON.stringify(r.data));
    }
    /* Feil kolonne: står i kolonne 0 og påstår en pakke lenger bort */
    let b, rr = 0;
    while (!rr) {
      b = await startMedFrø();
      const bane2 = new Bane(b.frø);
      for (let r = 4; r < 8 && !rr; r++) { if (bane2.pakker(r).length && bane2.pakker(r)[0].x !== 0) { rr = r; } }
    }
    const px = new Bane(b.frø).pakker(rr)[0].x;
    const ups = Array.from({ length: rr }, (_, k) => 'u' + (k ? 20 : 30).toString(36));
    const { lesLogg } = await import('../bare-kylling/js/spill/bane.mjs');
    assert.strictEqual(lesLogg([...ups, `p${rr.toString(36)}.${px + KOL}`].join(','), b.frø).pakker, 0);
  });

  await test('måka stjeler: pakken trekkes fra, og loggen godtas', async () => {
    let st, run;
    do { st = await startMedFrø(); run = samleLogg(st.frø, 30); } while (run.pakker < 2);
    const r = await sendInn(st.billett, { navn: 'Måkeoffer', poeng: 30, pakker: run.pakker - 1, logg: run.logg + ',m' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.strictEqual(r.data.pakker.find((x) => x.navn === 'Måkeoffer').pakker, run.pakker - 1);
  });

  await test('tredemølla (b) flytter kyllingen bakover og gir aldri poeng', async () => {
    const { lesLogg } = await import('../bare-kylling/js/spill/bane.mjs');
    const ok = lesLogg(['u30', 'u14', 'u14', 'b', 'u14'].join(','), 1);
    assert.strictEqual(ok.feil, undefined, JSON.stringify(ok));
    assert.strictEqual(ok.poeng, 3, 'å bli dyttet bakover gir ikke poeng');
  });

  await test('verdenene ligger i ring etter Treningssenteret', async () => {
    const { verdenFor } = await import('../bare-kylling/js/spill/bane.mjs');
    assert.deepStrictEqual([10, 63, 131, 201, 271, 341, 618, 619].map((r) => verdenFor(r).id),
      ['by', 'kylling', 'brygge', 'fabrikk', 'trening', 'kylling', 'trening', 'kylling']);
    assert.strictEqual(verdenFor(341).runde, 1);
  });

  await test('runder uten pakker havner ikke på pakkelista', async () => {
    await sendInn(await start(), { navn: 'Ingen Pakker', poeng: 8, logg: logg(8) });
    const r4 = await kall(fn, { method: 'GET', ip: nyIp() });
    assert.ok(Array.isArray(r4.data.pakker));
    assert.ok(!r4.data.pakker.some((x) => x.navn === 'Ingen Pakker'));
  });

  await test('admin kan slette en rad med riktig nøkkel', async () => {
    const adm = last({ KV_REST_API_URL: 'https://falsk.upstash.io', KV_REST_API_TOKEN: 'test-token', TOPPLISTE_ADMIN_NOKKEL: 'superhemmelig-nokkel' });
    const r0 = await kall(fn, { method: 'GET', ip: nyIp() });
    const offer = r0.data.liste[0].navn;
    assert.strictEqual((await kall(fn, { method: 'DELETE', url: '/api/toppliste?navn=' + encodeURIComponent(offer), ip: nyIp(), auth: 'Bearer superhemmelig-nokkel' })).status, 404, 'uten nøkkel i miljøet finnes ikke endepunktet');
    assert.strictEqual((await kall(adm, { method: 'DELETE', url: '/api/toppliste?navn=' + encodeURIComponent(offer), ip: nyIp(), auth: 'Bearer feil' })).status, 403);
    assert.strictEqual((await kall(adm, { method: 'DELETE', url: '/api/toppliste?navn=' + encodeURIComponent(offer), ip: nyIp() })).status, 403);
    const r = await kall(adm, { method: 'DELETE', url: '/api/toppliste?navn=' + encodeURIComponent(offer), ip: nyIp(), auth: 'Bearer superhemmelig-nokkel' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.slettet >= 1);
    const etter = await kall(adm, { method: 'GET', ip: nyIp(), url: '/api/toppliste?antall=100' });
    assert.ok(!etter.data.liste.some((x) => x.navn === offer), offer + ' er fortsatt på lista');
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
    /* Topp 100: ?antall=100 gir hele lista, sortert, og den svakeste er fjernet */
    const alle = await kall(fn, { method: 'GET', ip: nyIp(), url: '/api/toppliste?antall=100' });
    assert.strictEqual(alle.data.liste.length, 100);
    for (let i = 1; i < 100; i++) { assert.ok(alle.data.liste[i - 1].poeng >= alle.data.liste[i].poeng); }
    assert.strictEqual(alle.data.liste[0].navn, 'Siste');
    const ti = await kall(fn, { method: 'GET', ip: nyIp(), url: '/api/toppliste?antall=7' });
    assert.strictEqual(ti.data.liste.length, 10, 'andre tall gir topp 10');
  });

  console.log(`\n${ok} tester ok${process.exitCode ? ', noen feilet' : ''} (${dbKall} databasekall)`);
})();
