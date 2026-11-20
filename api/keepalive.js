/* =============================================================================
   BARE KYLLING — HOLD SUPABASE I LIVE (Vercel-cron)

   Gratis-Supabase-prosjekter pauses etter ~7 dager uten aktivitet, og da slutter
   ventelista å lagre numre (api/venteliste.js får «fetch failed»). Denne funksjonen
   gjør ett lite lesekall mot databasen. En daglig cron (se «crons» i vercel.json)
   treffer den, så prosjektet teller som aktivt og aldri pauser.

   GET /api/keepalive → 200 { ok, status }   (ok=false hvis kallet ikke gikk gjennom)

   Bruker de samme miljøvariablene som api/venteliste.js. Ingen nye hemmeligheter.
   ============================================================================= */
'use strict';

function supabase(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nokkel = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  return { url: url.replace(/\/$/, ''), nokkel };
}

module.exports = async function keepalive(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const db = supabase(process.env);
  if (!db.url || !db.nokkel) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, grunn: 'ikke-koblet' }));
  }

  /* Ett lite lesekall holder prosjektet aktivt. User-Agent settes fordi nye
     sb_secret_…-nøkler kan avvises uten den. */
  const hoder = { apikey: db.nokkel, 'User-Agent': 'bare-kylling-keepalive' };
  if (db.nokkel.startsWith('eyJ')) { hoder.Authorization = 'Bearer ' + db.nokkel; }

  try {
    const svar = await fetch(`${db.url}/rest/v1/venteliste?select=id&limit=1`, { headers: hoder });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: svar.ok, status: svar.status }));
  } catch (e) {
    console.error('keepalive: ' + e.message);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, grunn: 'nett' }));
  }
};
