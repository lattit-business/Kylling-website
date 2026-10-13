/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — GLOBAL TOPPLISTE (Vercel-funksjon)

   GET  /api/toppliste                         → { liste: [{ navn, poeng, dato }] }
   POST /api/toppliste { handling: 'start' }   → { billett }
   POST /api/toppliste { handling: 'send', billett, navn, poeng, logg }
                                               → { ok, plass, liste }

   Databasen er Upstash Redis (koble til via Vercel Marketplace → Upstash →
   Redis). Funksjonen leser UPSTASH_REDIS_REST_URL/_TOKEN eller
   KV_REST_API_URL/_TOKEN, som Vercel legger inn automatisk. Uten database
   svarer den 503, og spillet viser bare den lokale lista.

   Vern mot juks (et nettleserspill kan aldri bli helt juksesikkert, men dette
   gjør det tungvint):
   - Hver runde starter med en signert billett (HMAC). Billetten ligger i
     databasen og kan bare brukes én gang.
   - Spillet sender med en logg over hoppene (retning + tid siden forrige
     hopp). Serveren regner ut hvor langt kyllingen kom og sjekker at det er
     samme poengsum, at ingen hopp kom raskere enn et hopp tar, og at runden
     ikke kan ha vart lenger enn tiden siden billetten ble laget.
   - Grenser per IP-adresse (bare en hash lagres, aldri selve adressen).
   - Kallenavn: 2–16 tegn, bokstaver/tall/mellomrom/._-, og et lite filter
     mot stygge ord.
   ============================================================================= */
'use strict';

const crypto = require('crypto');

const URL_DB = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const HEMMELIG = process.env.TOPPLISTE_HEMMELIGHET ||
  (TOKEN ? crypto.createHash('sha256').update('bk-toppliste:' + TOKEN).digest('hex') : '');

const NOKKEL = {
  topp: 'bk:topp',            /* sortert sett: navnenøkkel → poeng (+ tidsbrøk) */
  navn: 'bk:navn',            /* hash: navnenøkkel → { navn, poeng, dato } */
  runde: (id) => 'bk:runde:' + id,
  fart: (hva, ip, vindu) => `bk:fart:${hva}:${ip}:${vindu}`
};

const RUNDE_LEVETID = 2 * 60 * 60;   /* sekunder en billett gjelder */
const MIN_HOPP_CS = 10;              /* et hopp tar 0,135 s – raskere er ikke mulig */
const MAKS_POENG = 5000;
const MAKS_TREKK = 30000;
const SLINGRINGSMONN_MS = 5000;      /* nettverk mellom spillstart og billett */
const BEHOLD = 100;                  /* så mange plasser lagres */
const GRENSER = {
  start: { antall: 40, vindu: 600 },
  send: { antall: 12, vindu: 600 },
  hent: { antall: 120, vindu: 60 }
};

/* ---------------------------------------------------------------------------
   Upstash REST
   --------------------------------------------------------------------------- */
async function db(kommandoer) {
  const svar = await fetch(URL_DB.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(kommandoer)
  });
  if (!svar.ok) { throw new Error('database ' + svar.status); }
  const data = await svar.json();
  return data.map((d) => {
    if (d && d.error) { throw new Error('database: ' + d.error); }
    return d ? d.result : null;
  });
}
const en = async (...k) => (await db([k]))[0];

/* ---------------------------------------------------------------------------
   Hjelpere
   --------------------------------------------------------------------------- */
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

const hmac = (tekst) => crypto.createHmac('sha256', HEMMELIG).update(tekst).digest('base64url').slice(0, 32);

function likt(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function ipHash(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'ukjent';
  return crypto.createHash('sha256').update(HEMMELIG + ':' + ip).digest('hex').slice(0, 20);
}

/* Fast vindu: true når grensen er nådd */
async function forMange(hva, ip) {
  const g = GRENSER[hva];
  const vindu = Math.floor(Date.now() / 1000 / g.vindu);
  const k = NOKKEL.fart(hva, ip, vindu);
  const [, antall] = await db([['SET', k, '0', 'EX', String(g.vindu + 5), 'NX'], ['INCR', k]]);
  return Number(antall) > g.antall;
}

/* Kallenavn: { navn, nokkel } eller { feil } */
const STYGT_DEL = ['nigger', 'nigga', 'neger', 'faggot', 'fitte', 'hitler', 'cunt', 'whore', 'voldta',
  'pedofil', 'porno', 'fuck', 'motherf', 'rasshol', 'kukk', 'jævl', 'jaevl'];
const STYGT_ORD = ['hore', 'kuk', 'pikk', 'nazi', 'sex', 'shit', 'faen', 'dritt', 'rape', 'fag', 'dick',
  'cock', 'ass', 'tits', 'pule', 'homo', 'naziste', 'ræv', 'raev', 'piss'];
const RESERVERT = ['barekylling', 'admin', 'administrator', 'moderator', 'jobbsenteret'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

function sjekkNavn(raa) {
  if (typeof raa !== 'string') { return { feil: 'Skriv inn et kallenavn.' }; }
  const navn = raa.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (navn.length < 2 || navn.length > 16) { return { feil: 'Kallenavnet må ha 2–16 tegn.' }; }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(navn) || !/[\p{L}\p{N}]/u.test(navn)) {
    return { feil: 'Bruk bare bokstaver, tall, mellomrom, punktum, bindestrek og understrek.' };
  }
  const lav = navn.toLowerCase();
  const vasket = lav.replace(/[0-9@$!]/g, (t) => LEET[t] || t);
  const sammen = vasket.replace(/[^\p{L}]/gu, '');
  const ord = vasket.split(/[ ._-]+/).filter(Boolean);
  if (STYGT_DEL.some((s) => sammen.includes(s)) || ord.some((o) => STYGT_ORD.includes(o)) || STYGT_ORD.includes(sammen)) {
    return { feil: 'Det kallenavnet går ikke. Prøv et annet!' };
  }
  if (RESERVERT.includes(sammen)) { return { feil: 'Det kallenavnet er reservert. Prøv et annet!' }; }
  return { navn, nokkel: lav.replace(/\s+/g, ' ') };
}

/* Spiller loggen av: gir { poeng, tidMs } eller { feil } */
function lesLogg(logg) {
  if (typeof logg !== 'string' || logg.length > MAKS_TREKK * 8) { return { feil: 'Ugyldig logg.' }; }
  const trekk = logg ? logg.split(',') : [];
  if (trekk.length > MAKS_TREKK) { return { feil: 'Ugyldig logg.' }; }
  let rad = 0, beste = 0, cs = 0;
  for (let i = 0; i < trekk.length; i++) {
    const m = /^([udlr])([0-9a-z]{1,6})$/.exec(trekk[i]);
    if (!m) { return { feil: 'Ugyldig logg.' }; }
    const d = parseInt(m[2], 36);
    if (i > 0 && d < MIN_HOPP_CS) { return { feil: 'Kyllingen hoppet raskere enn mulig.' }; }
    cs += d;
    if (m[1] === 'u') { rad += 1; } else if (m[1] === 'd') { rad -= 1; }
    if (rad > beste) { beste = rad; }
  }
  return { poeng: beste, tidMs: cs * 10 };
}

async function hentListe(antall = 10) {
  const par = await en('ZRANGE', NOKKEL.topp, '0', String(antall - 1), 'REV', 'WITHSCORES');
  if (!Array.isArray(par) || !par.length) { return []; }
  const nokler = [], poeng = [];
  for (let i = 0; i < par.length; i += 2) { nokler.push(par[i]); poeng.push(Math.floor(Number(par[i + 1]))); }
  const info = await en('HMGET', NOKKEL.navn, ...nokler);
  return nokler.map((n, i) => {
    let d = {};
    try { d = JSON.parse(info[i] || '{}') || {}; } catch (e) { d = {}; }
    return { navn: d.navn || n, poeng: poeng[i], dato: d.dato || '' };
  });
}

async function lesKropp(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) { return req.body; }
  let tekst = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  if (tekst === null) {
    tekst = await new Promise((ok, nei) => {
      let s = '';
      req.on('data', (b) => { s += b; if (s.length > 300000) { nei(new Error('for stor')); } });
      req.on('end', () => ok(s));
      req.on('error', nei);
    });
  }
  return JSON.parse(tekst || '{}');
}

/* ---------------------------------------------------------------------------
   Selve funksjonen
   --------------------------------------------------------------------------- */
module.exports = async function toppliste(req, res) {
  if (!URL_DB || !TOKEN || !HEMMELIG) { return send(res, 503, { feil: 'ikke-koblet' }); }

  /* Bare forespørsler fra egen side (stopper enkle skript fra andre sider) */
  const opphav = req.headers.origin;
  const vert = req.headers['x-forwarded-host'] || req.headers.host;
  if (opphav && vert) {
    let ok = false;
    try { ok = new URL(opphav).host === vert; } catch (e) { ok = false; }
    if (!ok) { return send(res, 403, { melding: 'Ikke tillatt.' }); }
  }

  try {
    const ip = ipHash(req);

    if (req.method === 'GET') {
      if (await forMange('hent', ip)) { return send(res, 429, { melding: 'For mange forespørsler.' }); }
      return send(res, 200, { liste: await hentListe(10) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return send(res, 405, { melding: 'Bare GET og POST.' });
    }

    let kropp;
    try { kropp = await lesKropp(req); } catch (e) { return send(res, 400, { melding: 'Ugyldig forespørsel.' }); }
    if (!kropp || typeof kropp !== 'object') { return send(res, 400, { melding: 'Ugyldig forespørsel.' }); }

    /* Ny runde: lag en billett som bare kan brukes én gang */
    if (kropp.handling === 'start') {
      if (await forMange('start', ip)) { return send(res, 429, { melding: 'For mange runder akkurat nå.' }); }
      const id = crypto.randomBytes(12).toString('base64url');
      const t = Date.now();
      await en('SET', NOKKEL.runde(id), String(t), 'EX', String(RUNDE_LEVETID));
      return send(res, 200, { billett: `${id}.${t}.${hmac(id + '.' + t)}` });
    }

    if (kropp.handling !== 'send') { return send(res, 400, { melding: 'Ukjent handling.' }); }
    if (await forMange('send', ip)) { return send(res, 429, { melding: 'For mange forsøk.' }); }

    /* 1. Kallenavnet */
    const navn = sjekkNavn(kropp.navn);
    if (navn.feil) { return send(res, 400, { melding: navn.feil }); }

    /* 2. Billetten: riktig signatur, og ikke brukt før */
    const deler = String(kropp.billett || '').split('.');
    if (deler.length !== 3 || !/^[\w-]{10,30}$/.test(deler[0]) || !/^\d{12,15}$/.test(deler[1]) ||
        !likt(deler[2], hmac(deler[0] + '.' + deler[1]))) {
      return send(res, 400, { melding: 'Runden kunne ikke bekreftes. Spill en ny runde.' });
    }
    const lagret = await en('GETDEL', NOKKEL.runde(deler[0]));
    if (lagret === null || lagret !== deler[1]) {
      return send(res, 400, { melding: 'Denne runden er allerede sendt inn, eller den er for gammel.' });
    }

    /* 3. Poengsummen må stemme med hoppene, og tiden må gå opp */
    const poeng = kropp.poeng;
    if (typeof poeng !== 'number' || !Number.isInteger(poeng) || poeng < 1 || poeng > MAKS_POENG) {
      return send(res, 400, { melding: 'Poengsummen kunne ikke godkjennes.' });
    }
    const logg = lesLogg(kropp.logg);
    if (logg.feil) { return send(res, 400, { melding: logg.feil }); }
    if (logg.poeng !== poeng) { return send(res, 400, { melding: 'Poengsummen stemmer ikke med hoppene.' }); }
    const gikk = Date.now() - Number(deler[1]);
    if (logg.tidMs > gikk + SLINGRINGSMONN_MS) { return send(res, 400, { melding: 'Runden gikk for fort.' }); }

    /* 4. Lagre beste resultat per kallenavn. Tidsbrøken (minker for hvert
       millisekund) gjør at den som kom først av to like poengsummer står øverst. */
    const naa = new Date(Date.now());
    const poengsum = poeng + (1 - naa.getTime() / 1e13);
    const [gammel] = await db([['ZSCORE', NOKKEL.topp, navn.nokkel]]);
    if (gammel === null || Number(gammel) < poengsum) {
      await db([
        ['ZADD', NOKKEL.topp, String(poengsum), navn.nokkel],
        ['HSET', NOKKEL.navn, navn.nokkel, JSON.stringify({ navn: navn.navn, poeng, dato: naa.toISOString().slice(0, 10) })]
      ]);
      /* Hold lista kort */
      const ute = await en('ZRANGE', NOKKEL.topp, '0', String(-BEHOLD - 1));
      if (Array.isArray(ute) && ute.length) {
        await db([['ZREMRANGEBYRANK', NOKKEL.topp, '0', String(-BEHOLD - 1)], ['HDEL', NOKKEL.navn, ...ute]]);
      }
    }
    const [rang] = await db([['ZREVRANK', NOKKEL.topp, navn.nokkel]]);
    return send(res, 200, { ok: true, plass: rang === null ? null : Number(rang) + 1, liste: await hentListe(10) });
  } catch (e) {
    console.error('toppliste:', e && e.message);
    return send(res, 500, { melding: 'Noe gikk galt med topplista.' });
  }
};

/* Til testene i tools/test-toppliste.js */
module.exports.sjekkNavn = sjekkNavn;
module.exports.lesLogg = lesLogg;
