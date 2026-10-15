/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — GLOBAL TOPPLISTE (Vercel-funksjon)

   GET  /api/toppliste                         → { liste: [{ navn, poeng, dato }],
                                                   pakker: [{ navn, pakker, dato }] }
   POST /api/toppliste { handling: 'start' }   → { billett }
   POST /api/toppliste { handling: 'send', billett, navn, poeng, pakker, logg, enhet }
                                               → { ok, plass, pakkePlass, liste, pakker }
   POST /api/toppliste { handling: 'navn', navn, enhet }
                                               → { ok, navn } eller 409 hvis tatt

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

/* Finner databasen uansett hvilket prefiks Vercel ga variablene
   (KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_KV_REST_API_URL …) */
function finnDatabase(env) {
  const kandidater = Object.keys(env)
    .filter((k) => /(^|_)(KV_REST_API|UPSTASH_REDIS_REST)_URL$/.test(k))
    .sort((a, b) => a.length - b.length);
  for (const k of kandidater) {
    const t = k.replace(/_URL$/, '_TOKEN');
    if (env[k] && env[t]) { return { url: env[k], token: env[t] }; }
  }
  return { url: '', token: '' };
}
const { url: URL_DB, token: TOKEN } = finnDatabase(process.env);
/* Er en annen database koblet til (f.eks. «Redis» fra Redis Cloud, som bare gir
   REDIS_URL)? Da sier 503-svaret fra hva som er galt, uten å vise verdiene. */
const ANNEN_DATABASE = !URL_DB &&
  Object.keys(process.env).some((k) => /(^|_)(REDIS_URL|KV_URL|POSTGRES_URL|DATABASE_URL|BLOB_READ_WRITE_TOKEN)$/.test(k));
const HEMMELIG = process.env.TOPPLISTE_HEMMELIGHET ||
  (TOKEN ? crypto.createHash('sha256').update('bk-toppliste:' + TOKEN).digest('hex') : '');

const NOKKEL = {
  topp: 'bk:topp',            /* sortert sett: navnenøkkel → poeng (+ tidsbrøk) */
  navn: 'bk:navn',            /* hash: navnenøkkel → { navn, poeng, dato } */
  eier: 'bk:eier',
  pakker: 'bk:pakker',        /* sortert sett: navnenøkkel → flest pakker (+ tidsbrøk) */
  pnavn: 'bk:pnavn',          /* hash: navnenøkkel → { navn, pakker, dato } */            /* hash: navnenøkkel → hash av enheten som eier navnet */
  runde: (id) => 'bk:runde:' + id,
  fart: (hva, ip, vindu) => `bk:fart:${hva}:${ip}:${vindu}`
};

const RUNDE_LEVETID = 2 * 60 * 60;   /* sekunder en billett gjelder */
const MIN_HOPP_CS = 10;              /* et hopp tar 0,135 s – raskere er ikke mulig */
const MAKS_POENG = 5000;
const MAKS_TREKK = 30000;
const SLINGRINGSMONN_MS = 5000;      /* nettverk mellom spillstart og billett */
const BEHOLD = 100;                  /* så mange plasser lagres */
/* Grensene gjelder per IP-adresse. En hel skole eller et kontor deler ofte én
   adresse, så de må tåle en klasse som spiller samtidig (30 elever, en runde
   hvert halvminutt ≈ 600 runder på 10 minutter). */
const GRENSER = {
  start: { antall: 800, vindu: 600 },
  send: { antall: 60, vindu: 600 },
  navn: { antall: 60, vindu: 600 },
  hent: { antall: 600, vindu: 60 }
};
/* Lista caches i Vercels CDN i noen sekunder, så automatisk oppdatering hos
   mange spillere ikke blir mange databasekall. Nettleseren cacher aldri. */
const LISTE_CACHE = 'public, max-age=0, s-maxage=5, stale-while-revalidate=10';

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
function send(res, status, data, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
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

/* ---------------------------------------------------------------------------
   Kallenavn
   Navnet sjekkes i en «vasket» form: små bokstaver uten aksenter (æ→ae, ø→o),
   tall som bokstaver (n3g3r → neger, «1» både som i og l) og uten mellomrom
   og tegn (n.e.g.e.r → neger). Hvert ord på listene blir et mønster der
   bokstavene kan gjentas (neeeger), men der doble bokstaver må stå dobbelt,
   så «Niger» ikke blir tatt for et skjellsord. Bare vanlige latinske bokstaver
   er lov, så bokstaver fra andre alfabeter som ligner (кyrillisk е, о …) ikke
   kan brukes til å lure filteret.
   --------------------------------------------------------------------------- */
/* Stoppes hvor som helst i navnet */
const STYGT_DEL = [
  /* rasisme */
  'neger', 'nigg', 'negro', 'negre', 'pakkis', 'svarting', 'chink', 'wetback',
  /* hat og nazisme */
  'hitler', 'siegheil', 'nazist', 'whitepower', 'whitepride', 'rahowa', 'kkk',
  /* homofobi og transfobi */
  'faggot', 'tranny',
  /* seksuelt og grovt */
  'fitte', 'kukk', 'kukhue', 'kuksug', 'knull', 'horunge', 'porn', 'dildo', 'pedofil', 'voldt',
  'incest', 'cunt', 'whore', 'bitch', 'fuck', 'motherf', 'wank', 'pussy', 'penis', 'vagina',
  'dritt', 'jaevl', 'rasshol', 'raevhol', 'killyourself'
];
/* Stoppes når det er et eget ord eller hele navnet («Thoresen» og «Glass» går fint) */
const STYGT_ORD = [
  'hore', 'hora', 'kuk', 'pikk', 'pule', 'sex', 'anal', 'anus', 'tits', 'dick', 'cock', 'cum', 'ass',
  'rape', 'pedo', 'fag', 'homo', 'homse', 'soper', 'dyke', 'coon', 'spic', 'gook', 'kike', 'nazi',
  'faen', 'shit', 'piss', 'kys', 'slut', 'raev'
];
const RESERVERT = ['barekylling', 'admin', 'administrator', 'moderator', 'jobbsenteret'];
/* Ekte ord som inneholder noe fra lista over */
const UNNTAK = ['montenegro', 'negroni', 'nigeria', 'scunthorpe'];
const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' };

/* «nigger» → n+i+g{2,}e+r+ */
const monster = (ord) => ord.replace(/(.)\1*/g, (rekke, b) => (rekke.length > 1 ? `${b}{${rekke.length},}` : `${b}+`));
const DEL_RE = new RegExp(STYGT_DEL.map(monster).join('|'));
const ORD_RE = new RegExp('^(?:' + STYGT_ORD.map(monster).join('|') + ')$');
const RESERVERT_RE = new RegExp('^(?:' + RESERVERT.map(monster).join('|') + ')$');

const utenAksenter = (t) => t.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss')
  .normalize('NFKD').replace(/\p{M}/gu, '');
const vask = (t, en) => utenAksenter(t).replace(/[0-9]/g, (d) => (d === '1' ? en : LEET[d] || '')).replace(/[^a-z]/g, '');

function stygt(navn) {
  if (/1488/.test(navn.replace(/\D/g, ''))) { return true; }
  const ord = navn.split(/[ ._-]+/).filter(Boolean);
  return ['i', 'l'].some((en) => {
    let hele = vask(navn, en);
    for (const u of UNNTAK) { hele = hele.split(u).join(''); }
    return DEL_RE.test(hele) || ORD_RE.test(hele) || ord.some((o) => ORD_RE.test(vask(o, en)));
  });
}

/* { navn, nokkel } eller { feil } */
function sjekkNavn(raa) {
  if (typeof raa !== 'string') { return { feil: 'Skriv inn et kallenavn.' }; }
  const navn = raa.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (navn.length < 2 || navn.length > 16) { return { feil: 'Kallenavnet må ha 2–16 tegn.' }; }
  const enkel = navn.normalize('NFKD').replace(/\p{M}/gu, '');
  if (!/^[A-Za-z0-9æøÆØß ._-]+$/.test(enkel) || !/[A-Za-z0-9æøÆØß]/.test(enkel)) {
    return { feil: 'Bruk bare bokstaver (a–å), tall, mellomrom, punktum, bindestrek og understrek.' };
  }
  if (stygt(navn)) { return { feil: 'Det kallenavnet går ikke. Prøv et annet!' }; }
  if (['i', 'l'].some((en) => RESERVERT_RE.test(vask(navn, en)))) { return { feil: 'Det kallenavnet er reservert. Prøv et annet!' }; }
  return { navn, nokkel: navn.toLowerCase() };
}

/* ---------------------------------------------------------------------------
   Eierskap til kallenavn
   Spillet lager en tilfeldig enhetsnøkkel første gang og lagrer den i
   nettleseren. Et kallenavn tilhører enheten som først kom på lista med det,
   så ingen andre kan sende inn under ditt navn. Bare en hash av nøkkelen
   lagres. (Enhet, ikke IP: en hel skole deler ofte én IP-adresse.)
   --------------------------------------------------------------------------- */
const enhetHash = (e) => (typeof e === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(e)
  ? crypto.createHash('sha256').update(HEMMELIG + ':enhet:' + e).digest('hex').slice(0, 24)
  : null);
const TATT = 'Det kallenavnet er tatt av en annen spiller. Velg et annet!';

/* 'ledig' | 'din' | 'tatt' */
async function eierAv(nokkel, eier) {
  const naa = await en('HGET', NOKKEL.eier, nokkel);
  return naa === null ? 'ledig' : naa === eier ? 'din' : 'tatt';
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

/* Topp N fra et sortert sett, med navn og dato fra hashen ved siden av.
   felt er 'poeng' (lengst) eller 'pakker' (flest Bare Kylling-pakker). */
async function hentListe(antall = 10, sett = NOKKEL.topp, info = NOKKEL.navn, felt = 'poeng') {
  const par = await en('ZRANGE', sett, '0', String(antall - 1), 'REV', 'WITHSCORES');
  if (!Array.isArray(par) || !par.length) { return []; }
  const nokler = [], verdi = [];
  for (let i = 0; i < par.length; i += 2) { nokler.push(par[i]); verdi.push(Math.floor(Number(par[i + 1]))); }
  const data = await en('HMGET', info, ...nokler);
  return nokler.map((n, i) => {
    let d = {};
    try { d = JSON.parse(data[i] || '{}') || {}; } catch (e) { d = {}; }
    return { navn: d.navn || n, [felt]: verdi[i], dato: d.dato || '' };
  });
}
const hentPakkeliste = (antall = 10) => hentListe(antall, NOKKEL.pakker, NOKKEL.pnavn, 'pakker');

/* Lagrer verdien hvis den er bedre enn det navnet har fra før, og holder
   settet på BEHOLD plasser. Tidsbrøken (minker for hvert millisekund) gjør
   at den som kom først av to like resultater står øverst. */
async function lagreBeste(sett, info, nokkel, verdi, data, naa) {
  const sum = verdi + (1 - naa.getTime() / 1e13);
  const [gammel] = await db([['ZSCORE', sett, nokkel]]);
  if (gammel === null || Number(gammel) < sum) {
    await db([['ZADD', sett, String(sum), nokkel], ['HSET', info, nokkel, JSON.stringify(data)]]);
    const ute = await en('ZRANGE', sett, '0', String(-BEHOLD - 1));
    if (Array.isArray(ute) && ute.length) {
      await db([['ZREMRANGEBYRANK', sett, '0', String(-BEHOLD - 1)], ['HDEL', info, ...ute]]);
    }
  }
  const [rang] = await db([['ZREVRANK', sett, nokkel]]);
  return rang === null ? null : Number(rang) + 1;
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
  if (!URL_DB || !TOKEN || !HEMMELIG) {
    const hjelp = ANNEN_DATABASE
      ? 'Fant en database, men ikke av riktig type. Topplista trenger «Upstash for Redis» (Vercel → Storage).'
      : 'Ingen database er koblet til. Se «Global toppliste» i README.md.';
    console.error('toppliste: ' + hjelp);
    return send(res, 503, { feil: 'ikke-koblet', hjelp });
  }

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
      const [liste, pakker] = await Promise.all([hentListe(10), hentPakkeliste(10)]);
      return send(res, 200, { liste, pakker }, LISTE_CACHE);
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

    /* Sjekk et nytt kallenavn før det tas i bruk (lagrer ingenting) */
    if (kropp.handling === 'navn') {
      if (await forMange('navn', ip)) { return send(res, 429, { melding: 'For mange forsøk.' }); }
      const navn = sjekkNavn(kropp.navn);
      if (navn.feil) { return send(res, 400, { melding: navn.feil }); }
      const eier = enhetHash(kropp.enhet);
      if (!eier) { return send(res, 400, { melding: 'Last siden på nytt og prøv igjen.' }); }
      if (await eierAv(navn.nokkel, eier) === 'tatt') { return send(res, 409, { melding: TATT }); }
      return send(res, 200, { ok: true, navn: navn.navn });
    }

    if (kropp.handling !== 'send') { return send(res, 400, { melding: 'Ukjent handling.' }); }
    if (await forMange('send', ip)) { return send(res, 429, { melding: 'For mange forsøk.' }); }

    /* 1. Kallenavnet, og at det tilhører denne enheten (før billetten brukes,
       så et tatt navn ikke koster runden) */
    const navn = sjekkNavn(kropp.navn);
    if (navn.feil) { return send(res, 400, { melding: navn.feil }); }
    const eier = enhetHash(kropp.enhet);
    if (!eier) { return send(res, 400, { melding: 'Last siden på nytt og prøv igjen.' }); }
    if (await eierAv(navn.nokkel, eier) === 'tatt') { return send(res, 409, { melding: TATT }); }

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
    /* Pakker: maks én per rad, så aldri flere enn hvor langt kyllingen kom */
    const pakker = kropp.pakker === undefined ? 0 : kropp.pakker;
    if (typeof pakker !== 'number' || !Number.isInteger(pakker) || pakker < 0 || pakker > poeng) {
      return send(res, 400, { melding: 'Antall pakker kunne ikke godkjennes.' });
    }
    const logg = lesLogg(kropp.logg);
    if (logg.feil) { return send(res, 400, { melding: logg.feil }); }
    if (logg.poeng !== poeng) { return send(res, 400, { melding: 'Poengsummen stemmer ikke med hoppene.' }); }
    const gikk = Date.now() - Number(deler[1]);
    if (logg.tidMs > gikk + SLINGRINGSMONN_MS) { return send(res, 400, { melding: 'Runden gikk for fort.' }); }

    /* Navnet blir denne enhetens (HSETNX: den første vinner hvis to sender samtidig) */
    const [, fikk] = await db([['HSETNX', NOKKEL.eier, navn.nokkel, eier], ['HGET', NOKKEL.eier, navn.nokkel]]);
    if (fikk !== eier) { return send(res, 409, { melding: TATT }); }

    /* 4. Lagre beste resultat per kallenavn: lengst og flest pakker hver for seg */
    const naa = new Date(Date.now());
    const dato = naa.toISOString().slice(0, 10);
    const plass = await lagreBeste(NOKKEL.topp, NOKKEL.navn, navn.nokkel, poeng, { navn: navn.navn, poeng, dato }, naa);
    const pakkePlass = pakker > 0
      ? await lagreBeste(NOKKEL.pakker, NOKKEL.pnavn, navn.nokkel, pakker, { navn: navn.navn, pakker, dato }, naa)
      : null;
    const [liste, pakkeliste] = await Promise.all([hentListe(10), hentPakkeliste(10)]);
    return send(res, 200, { ok: true, plass, pakkePlass, liste, pakker: pakkeliste });
  } catch (e) {
    console.error('toppliste:', e && e.message);
    return send(res, 500, { melding: 'Noe gikk galt med topplista.' });
  }
};

/* Til testene i tools/test-toppliste.js */
module.exports.sjekkNavn = sjekkNavn;
module.exports.lesLogg = lesLogg;
