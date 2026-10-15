/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — REKORDER OG TOPPLISTE
   Personlig rekord og en liten liste over de beste rundene lagres på enheten
   (localStorage). Den globale topplista ligger i en ekte database bak
   api/toppliste (se api/toppliste.js i repo-rota). Hver runde får en signert
   billett fra serveren, og serveren sjekker tid, trekk og kallenavn før en
   poengsum kommer på lista. Er databasen ikke koblet til (f.eks. lokalt eller
   på GitHub Pages), viser siden bare den lokale lista.
   ============================================================================= */
const API = 'api/toppliste';

const les = (n, std) => { try { const v = localStorage.getItem(n); return v === null ? std : JSON.parse(v); } catch (e) { return std; } };
const skriv = (n, v) => { try { localStorage.setItem(n, JSON.stringify(v)); } catch (e) { /* privat modus */ } };

export const personligRekord = () => Number(les('bk-spill-rekord', 0)) || 0;
export const settRekord = (p) => skriv('bk-spill-rekord', p);
export const sisteNavn = () => les('bk-spill-navn', '');
export const lagreNavn = (n) => skriv('bk-spill-navn', n);

/* Enhetsnøkkel: lages én gang og lagres i nettleseren. Kallenavnet ditt
   tilhører denne nøkkelen på serveren, så ingen andre kan bruke det. */
export function enhet() {
  let e = les('bk-spill-enhet', '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(e)) {
    const b = new Uint8Array(18);
    (window.crypto || window.msCrypto).getRandomValues(b);
    e = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    skriv('bk-spill-enhet', e);
  }
  return e;
}

/* De ti beste rundene på denne enheten */
export function lokalListe() { return les('bk-spill-liste', []); }
export function lokalPakkeliste() { return les('bk-spill-pakkeliste', []); }
export function leggTilLokal(poeng, navn, pakker = 0) {
  if (!(poeng > 0)) { return lokalListe(); }
  const dato = new Date().toISOString().slice(0, 10);
  const liste = lokalListe();
  liste.push({ navn: navn || 'Deg', poeng, dato });
  liste.sort((a, b) => b.poeng - a.poeng);
  const topp = liste.slice(0, 10);
  skriv('bk-spill-liste', topp);
  if (pakker > 0) {
    const pl = lokalPakkeliste();
    pl.push({ navn: navn || 'Deg', pakker, dato });
    pl.sort((a, b) => b.pakker - a.pakker);
    skriv('bk-spill-pakkeliste', pl.slice(0, 10));
  }
  return topp;
}

/* Gir den siste navnløse runden med denne poengsummen et kallenavn */
export function navngiLokal(poeng, navn) {
  const liste = lokalListe();
  const rad = liste.find((r) => r.navn === 'Deg' && r.poeng === poeng);
  if (rad) { rad.navn = navn; skriv('bk-spill-liste', liste); }
  const pl = lokalPakkeliste();
  const prad = pl.find((r) => r.navn === 'Deg');
  if (prad) { prad.navn = navn; skriv('bk-spill-pakkeliste', pl); }
  return liste;
}

async function kall(metode, kropp, sti = API) {
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const stopp = ctrl ? window.setTimeout(() => ctrl.abort(), 5000) : 0;
  try {
    const svar = await fetch(sti, {
      method: metode,
      headers: kropp ? { 'Content-Type': 'application/json' } : {},
      body: kropp ? JSON.stringify(kropp) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
      cache: 'no-store'
    });
    let data = null;
    try { data = await svar.json(); } catch (e) { data = null; }
    return { status: svar.status, data };
  } catch (e) {
    return { status: 0, data: null };
  } finally {
    window.clearTimeout(stopp);
  }
}

/* { ok: true, liste, pakker } eller { ok: false, grunn }
   grunn: 'ikke-koblet' – ingen database, eller en side uten api/ (GitHub Pages, lokalt)
          'opptatt'     – for mange forespørsler akkurat nå
          'nett'        – fikk ikke svar; prøv igjen senere */
/* Hvor mange plasser som vises: 10 eller 100 (huskes på enheten) */
export const visAntall = () => (les('bk-spill-antall', 10) === 100 ? 100 : 10);
export const settVisAntall = (n) => skriv('bk-spill-antall', n === 100 ? 100 : 10);

export async function hentListe() {
  const { status, data } = await kall('GET', null, visAntall() === 100 ? API + '?antall=100' : API);
  if (status === 200 && data && Array.isArray(data.liste)) {
    return { ok: true, liste: data.liste, pakker: Array.isArray(data.pakker) ? data.pakker : [] };
  }
  if ([404, 405, 501, 503].includes(status)) { return { ok: false, grunn: 'ikke-koblet' }; }
  return { ok: false, grunn: status === 429 ? 'opptatt' : 'nett' };
}

/* ---------------------------------------------------------------------------
   Billetter
   Én billett holdes klar på forhånd (hentet ved sidelasting og etter hver
   runde), så runden kan sendes inn selv om kyllingen dør før en treg
   forespørsel er ferdig. Billetten gjelder i to timer på serveren; en
   eldre enn en time byttes ut.
   --------------------------------------------------------------------------- */
const BILLETT_MAKS_ALDER = 60 * 60 * 1000;
let klar = null;     /* { billett, hentet } */
let henter = null;   /* pågående forhåndshenting */
const fersk = (b) => b && Date.now() - b.hentet < BILLETT_MAKS_ALDER;

async function hentBillett() {
  const { status, data } = await kall('POST', { handling: 'start' });
  return status === 200 && data && data.billett ? { billett: data.billett, hentet: Date.now() } : null;
}

/* Henter neste billett i bakgrunnen hvis det ikke ligger en klar */
export function forberedBillett() {
  if (!henter && !fersk(klar)) {
    henter = hentBillett().then((b) => { henter = null; if (b) { klar = b; } });
  }
}

/* Gir billetten til en ny runde. Hver billett brukes av én runde. */
export async function startRunde() {
  if (!fersk(klar) && henter) { await henter; }
  let b = fersk(klar) ? klar : null;
  klar = null;
  if (!b) { b = await hentBillett(); }
  return b ? b.billett : null;
}

/* { ok, plass, liste } eller { ok: false, melding } */
export async function sendInn({ billett, navn, poeng, pakker, logg }) {
  const { status, data } = await kall('POST', { handling: 'send', billett, navn, poeng, pakker, logg, enhet: enhet(), antall: visAntall() });
  if (status === 200 && data && data.ok) {
    return { ok: true, plass: data.plass, pakkePlass: data.pakkePlass, liste: data.liste || [], pakker: data.pakker || [] };
  }
  const meldinger = {
    429: 'Litt for mange forsøk akkurat nå. Prøv igjen om noen minutter.',
    400: (data && data.melding) || 'Poengsummen kunne ikke godkjennes.',
    409: (data && data.melding) || 'Det kallenavnet er tatt av en annen spiller.',
    503: 'Den globale topplista er ikke koblet til ennå.'
  };
  return { ok: false, tatt: status === 409, melding: meldinger[status] || 'Fikk ikke kontakt med topplista. Prøv igjen.' };
}

/* Sjekker at et nytt kallenavn er lov og ikke tatt. { ok, navn } eller { ok: false, melding } */
export async function sjekkNavn(navn) {
  const { status, data } = await kall('POST', { handling: 'navn', navn, enhet: enhet() });
  if (status === 200 && data && data.ok) { return { ok: true, navn: data.navn }; }
  if (status === 400 || status === 409) { return { ok: false, melding: (data && data.melding) || 'Det kallenavnet går ikke.' }; }
  return { ok: false, melding: status === 429 ? 'Litt for mange forsøk. Prøv igjen om litt.' : 'Fikk ikke kontakt med topplista. Prøv igjen.' };
}
