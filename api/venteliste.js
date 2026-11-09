/* =============================================================================
   BARE KYLLING — VENTELISTE (Vercel-funksjon)

   POST /api/venteliste { telefon, kilde?, nettside? }
     → 200 { ok: true }                    nummeret står på lista (også om det sto der fra før)
     → 400 { feil: 'ugyldig-nummer' }       ikke et norsk mobilnummer
     → 403 / 405 / 413 / 429                feil opphav, metode, størrelse eller for mange forsøk
     → 503 { feil: 'ikke-koblet' }          Supabase er ikke satt opp

   Lagres i Supabase-tabellen «venteliste» (se supabase/venteliste.sql). Nummeret
   lagres som +47XXXXXXXX, og samme nummer lagres bare én gang.

   Miljøvariabler (Vercel → Settings → Environment Variables, eller automatisk
   fra Supabase-integrasjonen i Vercel Marketplace):
     SUPABASE_URL                     https://<prosjekt>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY        hemmelig nøkkel (eller SUPABASE_SECRET_KEY)
   Nøkkelen brukes bare her på serveren og sendes aldri til nettleseren.
   Tabellen har Row Level Security på uten regler, så den offentlige
   anon-nøkkelen kan verken lese eller skrive.

   Vern mot misbruk:
   - Bare forespørsler fra egen side (Origin må være samme vert).
   - Et skjult felt («nettside») som bare roboter fyller ut. Fylles det ut,
     svarer vi ok, men lagrer ingenting.
   - Valgfri grense per IP-adresse hvis Upstash Redis er koblet til (samme
     database som topplista): 10 forsøk per 10 minutter. Bare en hash av
     adressen brukes, aldri selve adressen.
   ============================================================================= */
'use strict';

const crypto = require('crypto');

const TABELL = 'venteliste';
const GRENSE = { antall: 10, vindu: 600 };

function supabase(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nokkel = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  return { url: url.replace(/\/$/, ''), nokkel };
}

/* Upstash (valgfritt) – samme oppslag som i toppliste.js */
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

/* true når grensen er nådd. Feiler Upstash, slipper vi forespørselen gjennom. */
async function forMange(redis, ip) {
  if (!redis) { return false; }
  const vindu = Math.floor(Date.now() / 1000 / GRENSE.vindu);
  const k = `bk:venteliste:fart:${ip}:${vindu}`;
  try {
    const svar = await fetch(redis.url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + redis.token, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', k, '0', 'EX', String(GRENSE.vindu + 5), 'NX'], ['INCR', k]])
    });
    if (!svar.ok) { return false; }
    const data = await svar.json();
    return Number(data[1] && data[1].result) > GRENSE.antall;
  } catch (e) {
    return false;
  }
}

module.exports = async function venteliste(req, res) {
  const db = supabase(process.env);
  if (!db.url || !db.nokkel) {
    console.error('venteliste: Supabase er ikke koblet til. Se «Venteliste (Supabase)» i README.md.');
    return send(res, 503, { feil: 'ikke-koblet', hjelp: 'Supabase er ikke koblet til. Se «Venteliste (Supabase)» i README.md.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const redis = upstash(process.env);
  if (await forMange(redis, ipHash(req, redis ? redis.token : ''))) {
    return send(res, 429, { feil: 'for-mange' });
  }

  const kilde = typeof kropp.kilde === 'string' ? kropp.kilde.slice(0, 40) : 'venteliste';

  /* Nye Supabase-nøkler (sb_secret_…) skal bare i apikey; de gamle JWT-nøklene
     (service_role, starter med «eyJ») skal også i Authorization. */
  const hoder = {
    apikey: db.nokkel,
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal'
  };
  if (db.nokkel.startsWith('eyJ')) { hoder.Authorization = 'Bearer ' + db.nokkel; }

  try {
    const svar = await fetch(`${db.url}/rest/v1/${TABELL}?on_conflict=telefon`, {
      method: 'POST',
      headers: hoder,
      body: JSON.stringify({ telefon, kilde })
    });
    if (!svar.ok) {
      const tekst = await svar.text().catch(() => '');
      console.error('venteliste: Supabase svarte ' + svar.status + ' ' + tekst.slice(0, 300));
      return send(res, 502, { feil: 'lagring' });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('venteliste: ' + e.message);
    return send(res, 502, { feil: 'lagring' });
  }
};

module.exports.normaliserTelefon = normaliserTelefon;
