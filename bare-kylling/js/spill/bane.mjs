/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — BANEN (felles for nettleser og server)
   Alt som avgjør poeng og pakker, ligger her og bare her: hvilke rader som
   kommer (gress, vei, elv …) og hvor pakkene ligger. Filen har ingen 3D-kode,
   så serveren (api/toppliste.js) kan laste den og regne ut nøyaktig samme
   bane fra frøet i billetten. Da kan serveren kontrollere hver pakke i
   trekkloggen.

   Filen heter .mjs så Node alltid leser den som en ES-modul.
   ============================================================================= */

export const KOL = 4;            /* spillbare kolonner: −4 … 4 */
export const JOBB = 60;          /* raden der Jobbsenteret står */

/* Frøbasert tilfeldighet, så samme frø gir samme bane */
export function lagRng(frø) {
  let a = frø >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Blander frø, rad og et «salt» til ett tall, så hver rad får sin egen,
   faste tilfeldighet uansett i hvilken rekkefølge radene lages */
export function bland(frø, r, salt) {
  let h = (frø ^ Math.imul(r + 0x632BE5AB, 0x9E3779B1) ^ Math.imul(salt, 0x85EBCA77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7FEB352D);
  h = Math.imul(h ^ (h >>> 15), 0x846CA68B);
  return (h ^ (h >>> 16)) >>> 0;
}

/* Kylling Verden: en egen kyllingby fra rett etter Jobbsenteret til rad 250 */
export const KV = { fra: JOBB + 3, til: 250 };
export const iKV = (r) => r >= KV.fra && r <= KV.til;

export const vanske = (r) => Math.max(0, Math.min(1, (r - 4) / 130));

/* Radtyper der det kan ligge pakker */
const PAKKELAND = ['gress', 'park', 'fortau', 'vei'];
const SALT_PAKKE = 0x50414B;

export class Bane {
  constructor(frø) {
    this.frø = frø >>> 0;
    this.rng = lagRng(this.frø);
    this.spekker = new Map();     /* rad → spesifikasjon */
    this.neste = -10;             /* neste rad som skal planlegges */
    this.forrigeBlokk = '';
    this.pakkeCache = new Map();
  }

  /* Spesifikasjonen for rad r: { rad, type, ... } */
  spek(r) {
    while (this.neste <= r) { this.planlegg(); }
    return this.spekker.get(r);
  }

  leggTil(spek) {
    spek.rad = this.neste++;
    this.spekker.set(spek.rad, spek);
  }

  /* Hvilke rader som kommer, i blokker */
  planlegg() {
    const r = this.neste;
    if (r <= 2) { this.leggTil({ type: r <= -2 ? 'plass' : 'start' }); return; }
    if (r === 3) { this.leggTil({ type: 'gress', lett: true }); return; }
    if (r >= JOBB - 3 && r <= JOBB + 2) {
      const typer = { [JOBB - 3]: 'gress', [JOBB - 2]: 'fortau', [JOBB - 1]: 'fortau', [JOBB]: 'jobb', [JOBB + 1]: 'jobb', [JOBB + 2]: 'fortau' };
      this.leggTil({ type: typer[r], jobb: true, lett: r === JOBB - 3 });
      return;
    }
    const d = vanske(r);
    const igjen = JOBB - 3 - r;          /* plass før Jobbsenteret */
    const rng = this.rng;
    const valg = [
      ['gress', 3], ['park', 1.1], ['by', 3.2], ['vei', 1.6],
      ['elv', r >= 8 ? 2.2 : 0], ['bane', r >= 18 ? 1 + d : 0]
    ].filter(([n, w]) => w > 0 && (n !== this.forrigeBlokk || n === 'gress'));
    let sum = valg.reduce((s, v) => s + v[1], 0), pil = rng() * sum, blokk = 'gress';
    for (const [n, w] of valg) { if ((pil -= w) <= 0) { blokk = n; break; } }
    this.forrigeBlokk = blokk;

    const maks = (n) => (igjen > 0 ? Math.max(1, Math.min(n, igjen)) : n);
    if (blokk === 'gress') {
      const n = maks(1 + Math.floor(rng() * 3));
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'gress' }); }
    } else if (blokk === 'park') {
      const n = maks(1 + Math.floor(rng() * 2));
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'park' }); }
    } else if (blokk === 'vei' || blokk === 'by') {
      const n = maks(1 + Math.floor(rng() * (2 + d * 3.2)));
      const by = blokk === 'by';
      if (by) { this.leggTil({ type: 'fortau', kant: 'foran' }); }
      const zebra = by && rng() < 0.6 ? Math.floor(rng() * 5) - 2 : null;
      let retning = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        this.leggTil({ type: 'vei', retning, zebra, stripe: i > 0 });
        retning = rng() < 0.7 ? -retning : retning;
      }
      if (by) { this.leggTil({ type: 'fortau', kant: 'bak' }); }
    } else if (blokk === 'elv') {
      const n = maks(1 + Math.floor(rng() * (1.6 + d * 2.4)));
      let retning = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'elv', retning }); retning = -retning; }
      this.leggTil({ type: 'gress', lett: true });
    } else {
      this.leggTil({ type: 'bane' });
    }
  }

  /* Pakkene i rad r: [{ x, slag }]. Avgjøres bare av frøet, raden og
     radtypen, så serveren får nøyaktig det samme svaret. Rutene der det
     ligger pakker, holdes fri for hindringer når raden bygges. */
  pakker(r) {
    if (this.pakkeCache.has(r)) { return this.pakkeCache.get(r); }
    const spek = this.spek(r), liste = [];
    if (r >= 4 && r !== JOBB - 3 && PAKKELAND.includes(spek.type)) {
      const rng = lagRng(bland(this.frø, r, SALT_PAKKE));
      const sjanse = (spek.type === 'vei' ? 0.16 : 0.24) * (iKV(r) ? 1.7 : 1);
      if (rng() < sjanse) {
        liste.push({ x: Math.floor(rng() * (KOL * 2 + 1)) - KOL, slag: rng() < 0.5 ? 'original' : 'paprika' });
      }
    }
    this.pakkeCache.set(r, liste);
    return liste;
  }
}

/* ---------------------------------------------------------------------------
   TREKKLOGGEN
   Spillet skriver én bit per hendelse, skilt med komma:
     u12 / d8 / l3 / r1a  hopp (retning + hundredeler siden forrige hopp, base 36)
     p1f.5                plukket pakke på rad 0x1f (base 36), kolonne 5 (x + 4)
     m                    måka stjal en pakke
   lesLogg() spiller loggen av mot banen og gir { poeng, pakker, tidMs } eller
   { feil }. Samme funksjon brukes av serveren og testene.
   --------------------------------------------------------------------------- */
export const MIN_HOPP_CS = 10;   /* et hopp tar 0,135 s – raskere er ikke mulig */
export const MAKS_TREKK = 30000;

export function lesLogg(logg, frø) {
  if (typeof logg !== 'string' || logg.length > MAKS_TREKK * 10) { return { feil: 'Ugyldig logg.' }; }
  const biter = logg ? logg.split(',') : [];
  if (biter.length > MAKS_TREKK) { return { feil: 'Ugyldig logg.' }; }
  const bane = new Bane(frø);
  const tatt = new Set();
  let rad = 0, beste = 0, cs = 0, hopp = 0, pakker = 0, stjalet = false;
  let kol = 0;                     /* kolonnen kyllingen står i (null = ukjent etter elv) */
  for (const bit of biter) {
    let m;
    if ((m = /^([udlr])([0-9a-z]{1,6})$/.exec(bit))) {
      const d = parseInt(m[2], 36);
      if (hopp > 0 && d < MIN_HOPP_CS) { return { feil: 'Kyllingen hoppet raskere enn mulig.' }; }
      hopp++;
      cs += d;
      if (m[1] === 'u') { rad += 1; } else if (m[1] === 'd') { rad -= 1; }
      else if (kol !== null) { kol += m[1] === 'r' ? 1 : -1; }
      if (rad > beste) { beste = rad; }
      /* På elva driver kyllingen med stokken, så kolonnen er ukjent til neste pakke */
      const spek = bane.spek(rad);
      if (spek && spek.type === 'elv') { kol = null; }
    } else if ((m = /^p([0-9a-z]{1,4})\.([0-8])$/.exec(bit))) {
      const pr = parseInt(m[1], 36), px = Number(m[2]) - KOL;
      if (pr !== rad) { return { feil: 'En pakke ble tatt på en rad kyllingen ikke sto på.' }; }
      const nokkel = pr + ':' + px;
      if (tatt.has(nokkel) || !bane.pakker(pr).some((p) => p.x === px)) { return { feil: 'Den pakken fantes ikke.' }; }
      if (kol !== null && kol !== px) { return { feil: 'Kyllingen sto ikke ved pakken.' }; }
      kol = px;
      tatt.add(nokkel);
      pakker++;
    } else if (bit === 'm') {
      if (stjalet || pakker < 1) { return { feil: 'Ugyldig logg.' }; }
      stjalet = true;
      pakker--;
    } else {
      return { feil: 'Ugyldig logg.' };
    }
  }
  return { poeng: beste, pakker, tidMs: cs * 10 };
}
