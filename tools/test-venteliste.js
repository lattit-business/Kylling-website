#!/usr/bin/env node
/* Tester for api/venteliste.js uten ekte Supabase: fetch byttes ut med en
   liten falsk tabell i minnet. Kjør: node tools/test-venteliste.js */
'use strict';

const assert = require('assert');
const path = require('path');

const FIL = path.join(__dirname, '..', 'api', 'venteliste.js');

/* Falsk Supabase (+ valgfri Upstash for grensen per IP) */
let rader, kall, redis, supabaseNede;
function nullstill() { rader = new Map(); kall = []; redis = new Map(); supabaseNede = false; }

global.fetch = async (url, opts) => {
  kall.push({ url, opts });
  if (url.includes('/rest/v1/venteliste')) {
    if (supabaseNede) { return { ok: false, status: 500, text: async () => 'nede' }; }
    const kropp = JSON.parse(opts.body);
    if (!rader.has(kropp.telefon)) { rader.set(kropp.telefon, kropp); }
    return { ok: true, status: 201, text: async () => '' };
  }
  if (url.endsWith('/pipeline')) {
    const [[, k]] = JSON.parse(opts.body);
    redis.set(k, (redis.get(k) || 0) + 1);
    return { ok: true, json: async () => [{ result: 'OK' }, { result: redis.get(k) }] };
  }
  throw new Error('uventet kall ' + url);
};

function last(env) {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve(FIL)];
  return require(FIL);
}

function kjor(fn, { method = 'POST', body = {}, headers = {} } = {}) {
  return new Promise((ok) => {
    const res = {
      statusCode: 0, hoder: {},
      setHeader(k, v) { this.hoder[k.toLowerCase()] = v; },
      end(tekst) { ok({ status: this.statusCode, data: JSON.parse(tekst), hoder: this.hoder }); }
    };
    const req = { method, body, headers: { host: 'barekylling.no', 'x-forwarded-for': '1.2.3.4', ...headers } };
    fn(req, res);
  });
}

const ENV = { SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'eyJtest' };

(async () => {
  /* Normalisering */
  const { normaliserTelefon: n } = last(ENV);
  assert.strictEqual(n('912 34 567'), '+4791234567');
  assert.strictEqual(n('+47 412-34-567'), '+4741234567');
  assert.strictEqual(n('0047 91234567'), '+4791234567');
  assert.strictEqual(n('(+47) 912.34.567'), '+4791234567');
  assert.strictEqual(n('22 33 44 55'), null, 'fasttelefon');
  assert.strictEqual(n('9123456'), null, '7 siffer');
  assert.strictEqual(n('912345678'), null, '9 siffer');
  assert.strictEqual(n('+46 70 123 45 67'), null, 'utenlandsk');
  assert.strictEqual(n(91234567), null, 'ikke tekst');
  assert.strictEqual(n('9'.repeat(40)), null, 'for lang');

  /* Uten Supabase: 503 */
  nullstill();
  let fn = last({});
  let r = await kjor(fn, { body: { telefon: '91234567' } });
  assert.strictEqual(r.status, 503);
  assert.strictEqual(kall.length, 0);

  /* Lagring med gammel JWT-nøkkel */
  nullstill();
  fn = last(ENV);
  r = await kjor(fn, { body: { telefon: '912 34 567', kilde: 'cta' }, headers: { origin: 'https://barekylling.no' } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.data, { ok: true });
  assert.strictEqual(r.hoder['cache-control'], 'no-store');
  assert.strictEqual(kall[0].url, 'https://abc.supabase.co/rest/v1/venteliste?on_conflict=telefon');
  assert.strictEqual(kall[0].opts.headers.apikey, 'eyJtest');
  assert.strictEqual(kall[0].opts.headers.Authorization, 'Bearer eyJtest');
  assert.match(kall[0].opts.headers.Prefer, /ignore-duplicates/);
  assert.deepStrictEqual(JSON.parse(kall[0].opts.body), { telefon: '+4791234567', kilde: 'cta' });

  /* Samme nummer to ganger: ok, én rad */
  r = await kjor(fn, { body: { telefon: '+4791234567' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(rader.size, 1);

  /* Ny nøkkeltype (sb_secret_…): bare apikey */
  nullstill();
  fn = last({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' });
  r = await kjor(fn, { body: { telefon: '41234567' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(kall[0].opts.headers.apikey, 'sb_secret_x');
  assert.strictEqual(kall[0].opts.headers.Authorization, undefined);

  /* Ugyldig nummer, feil metode, feil opphav, robotfelle */
  nullstill();
  fn = last(ENV);
  r = await kjor(fn, { body: { telefon: '12345678' } });
  assert.strictEqual(r.status, 400);
  r = await kjor(fn, { body: { email: 'a@b.no' } });
  assert.strictEqual(r.status, 400, 'e-post godtas ikke lenger');
  r = await kjor(fn, { method: 'GET' });
  assert.strictEqual(r.status, 405);
  r = await kjor(fn, { body: { telefon: '91234567' }, headers: { origin: 'https://ond.example' } });
  assert.strictEqual(r.status, 403);
  r = await kjor(fn, { body: { telefon: '91234567', nettside: 'http://spam' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(rader.size, 0, 'robotfella lagrer ikke');

  /* Supabase feiler: 502 */
  supabaseNede = true;
  r = await kjor(fn, { body: { telefon: '91234567' } });
  assert.strictEqual(r.status, 502);

  /* Grense per IP når Upstash finnes */
  nullstill();
  fn = last({ ...ENV, KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 't' });
  for (let i = 0; i < 10; i++) {
    r = await kjor(fn, { body: { telefon: '9123456' + (i % 10) } });
    assert.strictEqual(r.status, 200, 'forsøk ' + (i + 1));
  }
  r = await kjor(fn, { body: { telefon: '91234500' } });
  assert.strictEqual(r.status, 429);
  r = await kjor(fn, { body: { telefon: '91234500' }, headers: { 'x-forwarded-for': '5.6.7.8' } });
  assert.strictEqual(r.status, 200, 'annen IP');

  console.log('venteliste: alle tester bestått');
})().catch((e) => { console.error(e); process.exit(1); });
