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

/* De ti beste rundene på denne enheten */
export function lokalListe() { return les('bk-spill-liste', []); }
export function leggTilLokal(poeng, navn) {
  if (!(poeng > 0)) { return lokalListe(); }
  const liste = lokalListe();
  liste.push({ navn: navn || 'Deg', poeng, dato: new Date().toISOString().slice(0, 10) });
  liste.sort((a, b) => b.poeng - a.poeng);
  const topp = liste.slice(0, 10);
  skriv('bk-spill-liste', topp);
  return topp;
}

/* Gir den siste navnløse runden med denne poengsummen et kallenavn */
export function navngiLokal(poeng, navn) {
  const liste = lokalListe();
  const rad = liste.find((r) => r.navn === 'Deg' && r.poeng === poeng);
  if (rad) { rad.navn = navn; skriv('bk-spill-liste', liste); }
  return liste;
}

async function kall(metode, kropp) {
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const stopp = ctrl ? window.setTimeout(() => ctrl.abort(), 5000) : 0;
  try {
    const svar = await fetch(API, {
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

/* { ok: true, liste } eller { ok: false, grunn }
   grunn: 'ikke-koblet' – ingen database, eller en side uten api/ (GitHub Pages, lokalt)
          'opptatt'     – for mange forespørsler akkurat nå
          'nett'        – fikk ikke svar; prøv igjen senere */
export async function hentListe() {
  const { status, data } = await kall('GET');
  if (status === 200 && data && Array.isArray(data.liste)) { return { ok: true, liste: data.liste }; }
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
export async function sendInn({ billett, navn, poeng, logg }) {
  const { status, data } = await kall('POST', { handling: 'send', billett, navn, poeng, logg });
  if (status === 200 && data && data.ok) { return { ok: true, plass: data.plass, liste: data.liste || [] }; }
  const meldinger = {
    429: 'Litt for mange forsøk akkurat nå. Prøv igjen om noen minutter.',
    400: (data && data.melding) || 'Poengsummen kunne ikke godkjennes.',
    503: 'Den globale topplista er ikke koblet til ennå.'
  };
  return { ok: false, melding: meldinger[status] || 'Fikk ikke kontakt med topplista. Prøv igjen.' };
}
