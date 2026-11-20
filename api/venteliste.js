/* =============================================================================
   BARE KYLLING — VENTELISTE (Vercel-funksjon)

   POST /api/venteliste { telefon, kilde?, nettside? }
     → 200 { ok: true }                    nummeret står på lista (også om det sto der fra før)
     → 400 { feil: 'ugyldig-nummer' }       ikke et norsk mobilnummer
     → 403 / 405 / 413 / 429                feil opphav, metode, størrelse eller for mange forsøk
     → 502 { feil: 'lagring' }              lagringen feilet
     → 503 { feil: 'ikke-koblet' }          ingen database er satt opp

   LAGRING
   Numrene lagres i Upstash Redis (samme database som spill-topplista, koblet til
   via Vercel Marketplace → Upstash → Redis). Finnes ikke Redis, faller funksjonen
   tilbake til Supabase-tabellen «venteliste» (se supabase/venteliste.sql). Nummeret
   lagres som +47XXXXXXXX, og samme nummer lagres bare én gang.

   I Redis:
     bk:venteliste          sortert sett: telefon → tidspunkt (ms) – gir rekkefølge og unikhet
     bk:venteliste:kilde    hash:         telefon → kilde

   SE LISTA
   GET /api/venteliste?nokkel=<admin-nøkkel>[&format=csv|json|html]
     → hele lista (standard: en enkel HTML-side; csv for nedlasting).
   Admin-nøkkelen er enten miljøvariabelen VENTELISTE_ADMIN_NOKKEL, ellers utledes
   den fra den hemmelige Upstash-nøkkelen (ligger da aldri i koden). Hent den én
   gang med GET /api/venteliste?hent-nokkel=1 – den kan bare hentes én gang.

   Miljøvariabler (Vercel → Settings → Environment Variables, legges inn automatisk
   av Upstash-/Supabase-integrasjonene i Vercel Marketplace):
     UPSTASH_REDIS_REST_URL / _TOKEN   (eller KV_REST_API_URL / _TOKEN)
     SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (valgfritt, reserve)
     VENTELISTE_ADMIN_NOKKEL           (valgfritt – egen admin-nøkkel)
   Nøklene brukes bare her på serveren og sendes aldri til nettleseren.

   Vern mot misbruk:
   - Skriving (POST) tillates bare fra egen side (Origin må være samme vert).
   - Et skjult felt («nettside») som bare roboter fyller ut. Fylles det ut,
     svarer vi ok, men lagrer ingenting.
   - Valgfri grense per IP-adresse via Upstash: 10 forsøk per 10 minutter. Bare en
     hash av adressen brukes, aldri selve adressen.
   ============================================================================= */
'use strict';

const crypto = require('crypto');

const TABELL = 'venteliste';
const GRENSE = { antall: 10, vindu: 600 };

/* Redis-nøkler */
const R = {
  sett: 'bk:venteliste',           /* sortert sett: telefon → tidspunkt (ms) */
  kilde: 'bk:venteliste:kilde',    /* hash: telefon → kilde */
  nokkelHentet: 'bk:venteliste:nokkel-hentet'
};

function supabase(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nokkel = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  return { url: url.replace(/\/$/, ''), nokkel };
}

/* Upstash (samme oppslag som i toppliste.js). Gir { url, token } eller null. */
function upstash(env) {
  const kandidater = Object.keys(env)
    .filter((k) => /(^|_)(KV_REST_API|UPSTASH_REDIS_REST)_URL$/.test(k))
    .sort((a, b) => a.length - b.length);
  for (const k of kandidater) {
    const t = k.replace(/_URL$/, '_TOKEN');
    if (env[k] && env[t]) { return { url: env[k].replace(/\/$/, ''), token: env[t] }; }
  }
  return null;
}

/* Norsk mobilnummer: 8 siffer som starter på 4 eller 9, med eller uten +47/0047.
   Mellomrom, bindestrek, punktum og parenteser tillates. Gir +47XXXXXXXX eller null. */
function normaliserTelefon(verdi) {
  if (typeof verdi !== 'string' || verdi.length > 30) { return null; }
  let s = verdi.replace(/[\s\-.()]/g, '');
  if (s.startsWith('+47')) { s = s.slice(3); } else if (s.startsWith('0047')) { s = s.slice(4); }
  return /^[49]\d{7}$/.test(s) ? '+47' + s : null;
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendRaa(res, status, type, tekst) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(tekst);
}

async function lesKropp(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) { return req.body; }
  let tekst = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  if (tekst === null) {
    tekst = await new Promise((ok, nei) => {
      let s = '';
      req.on('data', (b) => { s += b; if (s.length > 2000) { nei(new Error('for stor')); } });
      req.on('end', () => ok(s));
      req.on('error', nei);
    });
  }
  if (tekst.length > 2000) { throw new Error('for stor'); }
  return JSON.parse(tekst || '{}');
}

function ipHash(req, salt) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'ukjent';
  return crypto.createHash('sha256').update('bk-venteliste:' + salt + ':' + ip).digest('hex').slice(0, 20);
}

/* ---------------------------------------------------------------------------
   Upstash REST
   --------------------------------------------------------------------------- */
async function redisKall(redis, kommandoer) {
  const svar = await fetch(redis.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + redis.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(kommandoer)
  });
  if (!svar.ok) { throw new Error('redis ' + svar.status); }
  const data = await svar.json();
  return data.map((d) => {
    if (d && d.error) { throw new Error('redis: ' + d.error); }
    return d ? d.result : null;
  });
}

/* true når grensen er nådd. Feiler Upstash, slipper vi forespørselen gjennom. */
async function forMange(redis, ip) {
  if (!redis) { return false; }
  const vindu = Math.floor(Date.now() / 1000 / GRENSE.vindu);
  const k = `bk:venteliste:fart:${ip}:${vindu}`;
  try {
    const svar = await redisKall(redis, [
      ['SET', k, '0', 'EX', String(GRENSE.vindu + 5), 'NX'],
      ['INCR', k]
    ]);
    return Number(svar[1]) > GRENSE.antall;
  } catch (e) {
    return false;
  }
}

/* Lagrer nummeret i Redis. Samme nummer bare én gang (sortert sett). */
async function lagreRedis(redis, telefon, kilde) {
  await redisKall(redis, [
    ['ZADD', R.sett, String(Date.now()), telefon],
    ['HSET', R.kilde, telefon, kilde]
  ]);
}

/* Lagrer i Supabase (reserve når Redis ikke finnes). true ved suksess. */
async function lagreSupabase(db, telefon, kilde) {
  const hoder = {
    apikey: db.nokkel,
    'Content-Type': 'application/json',
    /* Nye sb_secret_…-nøkler avvises med 401 om forespørselen ser ut som en nettleser. */
    'User-Agent': 'bare-kylling-venteliste',
    Prefer: 'resolution=ignore-duplicates,return=minimal'
  };
  if (db.nokkel.startsWith('eyJ')) { hoder.Authorization = 'Bearer ' + db.nokkel; }
  const svar = await fetch(`${db.url}/rest/v1/${TABELL}?on_conflict=telefon`, {
    method: 'POST',
    headers: hoder,
    body: JSON.stringify({ telefon, kilde })
  });
  if (!svar.ok) {
    const tekst = await svar.text().catch(() => '');
    throw new Error('Supabase ' + svar.status + ' ' + tekst.slice(0, 200));
  }
}

/* Admin-nøkkel: egen miljøvariabel, ellers utledet fra den hemmelige
   Upstash-nøkkelen (ligger da aldri i koden). */
function adminNokkel(redis) {
  if (process.env.VENTELISTE_ADMIN_NOKKEL) { return process.env.VENTELISTE_ADMIN_NOKKEL; }
  return crypto.createHash('sha256').update('bk-venteliste-admin:' + redis.token).digest('hex');
}

function likt(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Henter hele lista fra Redis: [{ telefon, kilde, tid }] nyeste først. */
async function hentListe(redis) {
  const [par, hash] = await redisKall(redis, [
    ['ZRANGE', R.sett, '0', '-1', 'REV', 'WITHSCORES'],
    ['HGETALL', R.kilde]
  ]);
  const kilder = {};
  if (Array.isArray(hash)) { for (let i = 0; i < hash.length; i += 2) { kilder[hash[i]] = hash[i + 1]; } }
  else if (hash && typeof hash === 'object') { Object.assign(kilder, hash); }
  const rader = [];
  const arr = Array.isArray(par) ? par : [];
  for (let i = 0; i < arr.length; i += 2) {
    const telefon = arr[i];
    rader.push({ telefon, kilde: kilder[telefon] || '', tid: Number(arr[i + 1]) || 0 });
  }
  return rader;
}

function somDato(ms) {
  if (!ms) { return ''; }
  try { return new Date(ms).toISOString().replace('T', ' ').slice(0, 16); } catch (e) { return ''; }
}

function csvAv(rader) {
  const linjer = ['telefon,kilde,tidspunkt'];
  for (const r of rader) { linjer.push(`${r.telefon},${(r.kilde || '').replace(/[",\n]/g, ' ')},${somDato(r.tid)}`); }
  return linjer.join('\n') + '\n';
}

function htmlAv(rader) {
  const rekker = rader.map((r) =>
    `<tr><td>${r.telefon}</td><td>${(r.kilde || '').replace(/[<>&]/g, '')}</td><td>${somDato(r.tid)}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html lang="nb"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Venteliste – ${rader.length} påmeldte</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#11110F;background:#F3F0E9}
h1{font-size:1.4rem}table{border-collapse:collapse;width:100%;max-width:640px;background:#fff}
th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #e6e1d6}
th{background:#F1B240}a{color:#A8492A}.tom{color:#666}</style></head>
<body><h1>Venteliste – ${rader.length} påmeldte</h1>
<p><a href="?nokkel=${encodeURIComponent(gjeldendeNokkel)}&format=csv">Last ned som CSV</a></p>
${rader.length ? `<table><thead><tr><th>Telefon</th><th>Kilde</th><th>Tidspunkt (UTC)</th></tr></thead><tbody>${rekker}</tbody></table>`
    : '<p class="tom">Ingen påmeldte ennå.</p>'}
</body></html>`;
}
/* htmlAv bruker lenken med nøkkelen; settes rett før kallet. */
let gjeldendeNokkel = '';

module.exports = async function venteliste(req, res) {
  const redis = upstash(process.env);
  const db = supabase(process.env);
  const harLagring = !!redis || !!(db.url && db.nokkel);
  if (!harLagring) {
    console.error('venteliste: ingen database er koblet til (verken Upstash eller Supabase).');
    return send(res, 503, { feil: 'ikke-koblet', hjelp: 'Ingen database er koblet til. Se «Venteliste» i README.md.' });
  }

  /* -------------------------------------------------------------------------
     GET: admin-visning og engangs-henting av admin-nøkkel
     ------------------------------------------------------------------------- */
  if (req.method === 'GET') {
    const sp = new URL(req.url || '/', 'http://x').searchParams;

    /* Engangs: hent admin-nøkkelen. Virker bare første gang, og bare med Redis. */
    if (sp.get('hent-nokkel') !== null) {
      if (!redis) { return send(res, 503, { feil: 'ikke-koblet' }); }
      try {
        const [ny] = await redisKall(redis, [['SET', R.nokkelHentet, '1', 'NX']]);
        if (ny !== 'OK') { return send(res, 403, { feil: 'allerede-hentet', hjelp: 'Admin-nøkkelen er allerede hentet. Sett VENTELISTE_ADMIN_NOKKEL i Vercel for å lage en ny.' }); }
        return send(res, 200, { nokkel: adminNokkel(redis), lenke: '/api/venteliste?nokkel=' + adminNokkel(redis) });
      } catch (e) {
        console.error('venteliste: hent-nokkel feilet: ' + e.message);
        return send(res, 502, { feil: 'lagring' });
      }
    }

    /* Se lista */
    const gitt = sp.get('nokkel');
    if (gitt === null) {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { feil: 'metode' });
    }
    if (!redis) { return send(res, 503, { feil: 'ikke-koblet' }); }
    if (!likt(gitt, adminNokkel(redis))) { return send(res, 403, { feil: 'feil-nokkel' }); }
    try {
      const rader = await hentListe(redis);
      const format = sp.get('format') || 'html';
      if (format === 'json') { return send(res, 200, { antall: rader.length, liste: rader }); }
      if (format === 'csv') { return sendRaa(res, 200, 'text/csv; charset=utf-8', csvAv(rader)); }
      gjeldendeNokkel = gitt;
      return sendRaa(res, 200, 'text/html; charset=utf-8', htmlAv(rader));
    } catch (e) {
      console.error('venteliste: henting av liste feilet: ' + e.message);
      return send(res, 502, { feil: 'lagring' });
    }
  }

  /* -------------------------------------------------------------------------
     POST: ny påmelding
     ------------------------------------------------------------------------- */
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return send(res, 405, { feil: 'metode' });
  }

  const opphav = req.headers.origin;
  const vert = req.headers['x-forwarded-host'] || req.headers.host;
  if (opphav && vert) {
    let ok = false;
    try { ok = new URL(opphav).host === vert; } catch (e) { ok = false; }
    if (!ok) { return send(res, 403, { feil: 'opphav' }); }
  }

  let kropp;
  try {
    kropp = await lesKropp(req);
  } catch (e) {
    return send(res, /stor/.test(e.message) ? 413 : 400, { feil: 'kropp' });
  }
  if (!kropp || typeof kropp !== 'object') { return send(res, 400, { feil: 'kropp' }); }

  /* Skjult felt: roboter fyller det ut, mennesker ser det ikke */
  if (kropp.nettside) { return send(res, 200, { ok: true }); }

  const telefon = normaliserTelefon(kropp.telefon);
  if (!telefon) { return send(res, 400, { feil: 'ugyldig-nummer' }); }

  if (await forMange(redis, ipHash(req, redis ? redis.token : ''))) {
    return send(res, 429, { feil: 'for-mange' });
  }

  const kilde = typeof kropp.kilde === 'string' ? kropp.kilde.slice(0, 40) : 'venteliste';

  try {
    if (redis) { await lagreRedis(redis, telefon, kilde); }
    else { await lagreSupabase(db, telefon, kilde); }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('venteliste: ' + e.message);
    return send(res, 502, { feil: 'lagring' });
  }
};

module.exports.normaliserTelefon = normaliserTelefon;
