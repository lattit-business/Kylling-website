#!/usr/bin/env node
/* Tester for api/venteliste.js uten ekte database: fetch byttes ut med en liten
   Redis/Supabase-etterligning i minnet. Kjør: node tools/test-venteliste.js */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

const FIL = path.join(__dirname, '..', 'api', 'venteliste.js');

/* ---------------------------------------------------------------------------
   Falsk Redis (Upstash /pipeline) + falsk Supabase
   --------------------------------------------------------------------------- */
let kv, zset, hash, supaRader, supabaseNede, kall;
function nullstill() { kv = new Map(); zset = new Map(); hash = new Map(); supaRader = new Map(); supabaseNede = false; kall = []; }

function kjorRedis(cmd) {
  const [navn, ...a] = cmd;
  switch (navn) {
    case 'SET': {
      const key = a[0], val = a[1];
      const nx = a.includes('NX');
      if (nx && kv.has(key)) { return null; }
      kv.set(key, val);
      return 'OK';
    }
    case 'INCR': {
      const key = a[0];
      const num = (Number(kv.get(key)) || 0) + 1;
      kv.set(key, String(num));
      return num;
    }
    case 'ZADD': {
      const key = a[0], score = a[1], member = a[2];
      if (!zset.has(key)) { zset.set(key, new Map()); }
      const fantes = zset.get(key).has(member);
      zset.get(key).set(member, Number(score));
      return fantes ? 0 : 1;
    }
    case 'HSET': {
      const key = a[0], field = a[1], val = a[2];
      if (!hash.has(key)) { hash.set(key, new Map()); }
      hash.get(key).set(field, val);
      return 1;
    }
    case 'ZRANGE': {
      const key = a[0];
      const rev = a.includes('REV');
      const scores = a.includes('WITHSCORES');
      const m = zset.get(key) || new Map();
      let par = [...m.entries()].sort((x, y) => x[1] - y[1]);
      if (rev) { par.reverse(); }
      const ut = [];
      for (const [member, score] of par) { ut.push(member); if (scores) { ut.push(String(score)); } }
      return ut;
    }
    case 'HGETALL': {
      const m = hash.get(a[0]) || new Map();
      const ut = [];
      for (const [f, v] of m.entries()) { ut.push(f, v); }
      return ut;
    }
    default:
      throw new Error('ukjent redis-kommando ' + navn);
  }
}

global.fetch = async (url, opts) => {
  kall.push({ url, opts });
  if (url.endsWith('/pipeline')) {
    const cmds = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => cmds.map((c) => ({ result: kjorRedis(c) })) };
  }
  if (url.includes('/rest/v1/venteliste')) {
    if (supabaseNede) { return { ok: false, status: 500, text: async () => 'nede' }; }
    const kropp = JSON.parse(opts.body);
    if (!supaRader.has(kropp.telefon)) { supaRader.set(kropp.telefon, kropp); }
    return { ok: true, status: 201, text: async () => '' };
  }
  throw new Error('uventet kall ' + url);
};

function last(env) {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY',
    'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
    'VENTELISTE_ADMIN_NOKKEL']) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve(FIL)];
  return require(FIL);
}

function kjor(fn, { method = 'POST', url = '/api/venteliste', body = {}, headers = {} } = {}) {
  return new Promise((ok) => {
    const res = {
      statusCode: 0, hoder: {}, _tekst: '',
      setHeader(k, v) { this.hoder[k.toLowerCase()] = v; },
      end(tekst) {
        this._tekst = tekst || '';
        const type = this.hoder['content-type'] || '';
        let data = this._tekst;
        if (type.includes('application/json')) { try { data = JSON.parse(this._tekst); } catch (e) { data = this._tekst; } }
        ok({ status: this.statusCode, data, tekst: this._tekst, hoder: this.hoder });
      }
    };
    const req = { method, url, body, headers: { host: 'barekylling.no', 'x-forwarded-for': '1.2.3.4', ...headers } };
    fn(req, res);
  });
}

/* Redis-miljø. Admin-nøkkelen utledes fra token, akkurat som i funksjonen. */
const RENV = { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'hemmelig-token' };
const ADMIN = crypto.createHash('sha256').update('bk-venteliste-admin:' + RENV.KV_REST_API_TOKEN).digest('hex');
const SENV = { SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'eyJtest' };

(async () => {
  /* Normalisering */
  const { normaliserTelefon: n } = last(RENV);
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

  /* Uten database: 503 */
  nullstill();
  let fn = last({});
  let r = await kjor(fn, { body: { telefon: '91234567' } });
  assert.strictEqual(r.status, 503);
  assert.strictEqual(kall.length, 0);

  /* Lagring i Redis */
  nullstill();
  fn = last(RENV);
  r = await kjor(fn, { body: { telefon: '912 34 567', kilde: 'cta' }, headers: { origin: 'https://barekylling.no' } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.data, { ok: true });
  assert.strictEqual(r.hoder['cache-control'], 'no-store');
  assert.ok(zset.get('bk:venteliste').has('+4791234567'), 'nummeret lagret i settet');
  assert.strictEqual(hash.get('bk:venteliste:kilde').get('+4791234567'), 'cta');

  /* Samme nummer to ganger: ok, én rad */
  r = await kjor(fn, { body: { telefon: '+4791234567' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(zset.get('bk:venteliste').size, 1, 'samme nummer bare én gang');

  /* Robotfelle lagrer ikke */
  r = await kjor(fn, { body: { telefon: '41234567', nettside: 'http://spam' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(zset.get('bk:venteliste').size, 1, 'robotfella lagrer ikke');

  /* Ugyldig nummer, feil metode, feil opphav */
  r = await kjor(fn, { body: { telefon: '12345678' } });
  assert.strictEqual(r.status, 400);
  r = await kjor(fn, { body: { email: 'a@b.no' } });
  assert.strictEqual(r.status, 400, 'e-post godtas ikke');
  r = await kjor(fn, { method: 'PUT' });
  assert.strictEqual(r.status, 405);
  r = await kjor(fn, { body: { telefon: '91234567' }, headers: { origin: 'https://ond.example' } });
  assert.strictEqual(r.status, 403);

  /* Admin: hente lista */
  nullstill();
  fn = last(RENV);
  await kjor(fn, { body: { telefon: '91234567', kilde: 'venteliste' } });
  await kjor(fn, { body: { telefon: '41234567', kilde: 'cta' } });

  r = await kjor(fn, { method: 'GET' });
  assert.strictEqual(r.status, 405, 'GET uten nøkkel');
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?nokkel=feil' });
  assert.strictEqual(r.status, 403, 'feil nøkkel');
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?nokkel=' + ADMIN + '&format=json' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.antall, 2);
  assert.deepStrictEqual(r.data.liste.map((x) => x.telefon).sort(), ['+4741234567', '+4791234567']);

  /* CSV */
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?nokkel=' + ADMIN + '&format=csv' });
  assert.strictEqual(r.status, 200);
  assert.match(r.hoder['content-type'], /text\/csv/);
  assert.match(r.tekst, /\+4791234567/);

  /* HTML (standard) */
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?nokkel=' + ADMIN });
  assert.strictEqual(r.status, 200);
  assert.match(r.hoder['content-type'], /text\/html/);
  assert.match(r.tekst, /2 påmeldte/);

  /* Engangs-henting av nøkkel */
  nullstill();
  fn = last(RENV);
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?hent-nokkel=1' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.nokkel, ADMIN);
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?hent-nokkel=1' });
  assert.strictEqual(r.status, 403, 'kan bare hentes én gang');

  /* Egen admin-nøkkel via miljøvariabel */
  nullstill();
  fn = last({ ...RENV, VENTELISTE_ADMIN_NOKKEL: 'min-nokkel' });
  await kjor(fn, { body: { telefon: '91234567' } });
  r = await kjor(fn, { method: 'GET', url: '/api/venteliste?nokkel=min-nokkel&format=json' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.antall, 1);

  /* Grense per IP (Redis) */
  nullstill();
  fn = last(RENV);
  for (let i = 0; i < 10; i++) {
    r = await kjor(fn, { body: { telefon: '9123456' + (i % 10) } });
    assert.strictEqual(r.status, 200, 'forsøk ' + (i + 1));
  }
  r = await kjor(fn, { body: { telefon: '91234500' } });
  assert.strictEqual(r.status, 429);
  r = await kjor(fn, { body: { telefon: '91234500' }, headers: { 'x-forwarded-for': '5.6.7.8' } });
  assert.strictEqual(r.status, 200, 'annen IP');

  /* Reserve: uten Redis lagres i Supabase */
  nullstill();
  fn = last(SENV);
  r = await kjor(fn, { body: { telefon: '912 34 567', kilde: 'cta' } });
  assert.strictEqual(r.status, 200);
  assert.ok(supaRader.has('+4791234567'), 'lagret i Supabase');
  assert.strictEqual(kall[0].opts.headers.apikey, 'eyJtest');
  assert.strictEqual(kall[0].opts.headers.Authorization, 'Bearer eyJtest');

  /* Reserve: Supabase feiler → 502 */
  supabaseNede = true;
  r = await kjor(fn, { body: { telefon: '41234567' } });
  assert.strictEqual(r.status, 502);

  console.log('venteliste: alle tester bestått');
})().catch((e) => { console.error(e); process.exit(1); });
