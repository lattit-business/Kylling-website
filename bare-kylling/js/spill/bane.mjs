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

/* ---------------------------------------------------------------------------
   VERDENENE
   Byen går fram til Jobbsenteret. Etter det kommer fire verdener, og når
   Treningssenteret er ferdig, starter ringen på nytt med Kylling Verden (litt
   raskere for hver runde). Første rad i hver verden er porten.
   --------------------------------------------------------------------------- */
export const VERDENER = [
  { id: 'by', navn: 'Byen', fra: -10, til: JOBB + 2 },
  { id: 'kylling', navn: 'Kylling Verden', fra: JOBB + 3, til: 130 },
  { id: 'brygge', navn: 'Bryggen', fra: 131, til: 200 },
  { id: 'fabrikk', navn: 'Fabrikken', fra: 201, til: 270 },
  { id: 'trening', navn: 'Treningssenteret', fra: 271, til: 340 }
];
const RING_FRA = VERDENER[1].fra;
const RING = VERDENER[VERDENER.length - 1].til - RING_FRA + 1;

/* Verdenen rad r ligger i: { id, navn, fra, til, runde } (fra/til er de
   faktiske radene i denne runden av ringen) */
export function verdenFor(r) {
  if (r < RING_FRA) { return { ...VERDENER[0], runde: 0 }; }
  const runde = Math.floor((r - RING_FRA) / RING);
  const forskyv = runde * RING, i = r - forskyv;
  const v = VERDENER.find((w) => w.id !== 'by' && i >= w.fra && i <= w.til);
  return { id: v.id, navn: v.navn, fra: v.fra + forskyv, til: v.til + forskyv, runde };
}

export const vanske = (r) => Math.max(0, Math.min(1, (r - 4) / 130));

/* Hvor ofte hver blokk kommer i hver verden. Blokkene er de samme overalt
   (gress, park, by = fortau + vei + fortau, vei, elv, bane), men ser ulike ut:
   på Bryggen er elva havna og bybanen Fløibanen, i Fabrikken er elva et
   samlebånd og bybanen et stempel, osv. To blokker finnes bare ett sted:
   grillplater i Fabrikken og tredemøller på Treningssenteret. */
const VEKTER = {
  by: (r, d) => [['gress', 3], ['park', 1.1], ['by', 3.2], ['vei', 1.6], ['elv', r >= 8 ? 2.2 : 0], ['bane', r >= 18 ? 1 + d : 0]],
  kylling: (r, d) => [['gress', 3.2], ['park', 1.4], ['by', 2.6], ['vei', 1.8], ['elv', 2.2], ['bane', 1 + d]],
  brygge: (r, d) => [['gress', 2.6], ['park', 1.4], ['by', 2.4], ['vei', 1.0], ['elv', 3.0], ['bane', 0.6 + d * 0.4]],
  fabrikk: (r, d) => [['gress', 2.8], ['park', 0.8], ['by', 1.6], ['vei', 2.0], ['elv', 2.2], ['bane', 0.8 + d * 0.5], ['grill', 1.6]],
  trening: (r, d) => [['gress', 3.0], ['park', 1.0], ['by', 1.2], ['vei', 2.0], ['bane', 0.8 + d * 0.4], ['mølle', 3.0]]
};
/* Minste antall rader en blokk trenger (så den ikke renner over i neste verden) */
const MIN_RADER = { gress: 1, park: 1, by: 3, vei: 1, elv: 2, bane: 1, grill: 1, mølle: 2 };

/* Radtyper der det kan ligge pakker */
const PAKKELAND = ['gress', 'park', 'fortau', 'vei'];
const SALT_PAKKE = 0x50414B;
const SALT_KRAFT = 0x4B5246;

/* ---------------------------------------------------------------------------
   KRAFTPAKKER
   Original gir skjold (tåler én smell), Sweet Paprika gir fart i 5 s og
   matboksen gir magnet i 6 s. De er sjeldne, og det er alltid minst 40 rader
   mellom dem, så det aldri er mer enn én på skjermen. Frøet bestemmer alt.
   Varighetene er i hundredeler (samme enhet som trekkloggen).
   --------------------------------------------------------------------------- */
export const KRAFT = { skjold: 0, fart: 500, magnet: 600 };
export const FART_MIN_HOPP_CS = 6;     /* raskeste hopp med fart */
export const MAGNET_REKKEVIDDE = 2;    /* kolonner til hver side, i raden og raden foran */
const KRAFT_LUKE = 70;                 /* én mulig kraftpakke per 70 rader */
const KRAFTLAND = ['gress', 'park', 'fortau'];
const iTryggSone = (r) => Math.abs(r - JOBB) <= 3;

/* LEVERINGSRUNDE: varebilen mister lasten, og pakkene regner ned over tre
   rader på rad (tre pakker per rad). Én mulig per 110 rader. */
const SALT_LEV = 0x4C4556;
const LEV_LUKE = 110;

export class Bane {
  constructor(frø) {
    this.frø = frø >>> 0;
    this.rng = lagRng(this.frø);
    this.spekker = new Map();     /* rad → spesifikasjon */
    this.neste = -10;             /* neste rad som skal planlegges */
    this.forrigeBlokk = '';
    this.pakkeCache = new Map();
    this.kraftCache = new Map();
    this.levCache = new Map();
  }

  /* Spesifikasjonen for rad r: { rad, type, verden, ... } */
  spek(r) {
    while (this.neste <= r) { this.planlegg(); }
    return this.spekker.get(r);
  }

  leggTil(spek) {
    spek.rad = this.neste++;
    spek.verden = verdenFor(spek.rad).id;
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
    const v = verdenFor(r);
    if (r === v.fra && v.id !== 'by') {
      /* Porten inn til en ny verden: en rolig rad å puste på */
      this.forrigeBlokk = 'gress';
      this.leggTil({ type: 'gress', lett: true, port: v.id });
      return;
    }
    const d = vanske(r);
    const igjen = (v.id === 'by' ? JOBB - 4 : v.til) - r + 1;   /* rader igjen i verdenen */
    const rng = this.rng;
    const valg = VEKTER[v.id](r, d)
      .filter(([n, w]) => w > 0 && MIN_RADER[n] <= igjen && (n !== this.forrigeBlokk || n === 'gress'));
    let sum = valg.reduce((s, x) => s + x[1], 0), pil = rng() * sum, blokk = 'gress';
    for (const [n, w] of valg) { if ((pil -= w) <= 0) { blokk = n; break; } }
    this.forrigeBlokk = blokk;

    /* n rader, men aldri flere enn det er plass til (ekstra = rader rundt) */
    const maks = (n, ekstra = 0) => Math.max(1, Math.min(n, igjen - ekstra));
    if (blokk === 'gress') {
      const n = maks(1 + Math.floor(rng() * 3));
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'gress' }); }
    } else if (blokk === 'park') {
      const n = maks(1 + Math.floor(rng() * 2));
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'park' }); }
    } else if (blokk === 'vei' || blokk === 'by') {
      const by = blokk === 'by';
      const n = maks(1 + Math.floor(rng() * (2 + d * 3.2)), by ? 2 : 0);
      if (by) { this.leggTil({ type: 'fortau', kant: 'foran' }); }
      const zebra = by && rng() < 0.6 ? Math.floor(rng() * 5) - 2 : null;
      let retning = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        this.leggTil({ type: 'vei', retning, zebra, stripe: i > 0 });
        retning = rng() < 0.7 ? -retning : retning;
      }
      if (by) { this.leggTil({ type: 'fortau', kant: 'bak' }); }
    } else if (blokk === 'elv') {
      const n = maks(1 + Math.floor(rng() * (1.6 + d * 2.4)), 1);
      let retning = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'elv', retning }); retning = -retning; }
      this.leggTil({ type: 'gress', lett: true });
    } else if (blokk === 'grill') {
      /* Én eller to grillplater; to på rad er i utakt, så det alltid er en luke */
      const n = maks(rng() < 0.35 ? 2 : 1);
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'grill', fase: i }); }
    } else if (blokk === 'mølle') {
      /* En rolig rad først, så tredemøllene alltid dytter deg ned på trygg grunn */
      const n = maks(1 + Math.floor(rng() * 2), 1);
      this.leggTil({ type: 'gress', lett: true });
      for (let i = 0; i < n; i++) { this.leggTil({ type: 'mølle' }); }
    } else {
      this.leggTil({ type: 'bane' });
    }
  }

  /* Pakkene i rad r: [{ x, slag }]. Avgjøres bare av frøet, raden og
     radtypen, så serveren får nøyaktig det samme svaret. Rutene der det
     ligger pakker, holdes fri for hindringer når raden bygges. */
  pakker(r) {
    if (this.pakkeCache.has(r)) { return this.pakkeCache.get(r); }
    const liste = this.grunnPakker(r);
    const lev = this.levering(r);
    if (lev) {
      /* tre pakker i raden fra varebilen, på ledige plasser */
      const rng = lagRng(bland(this.frø, r, SALT_LEV));
      const opptatt = new Set(liste.map((p) => p.x));
      for (let i = 0; i < 3; i++) {
        let x = Math.floor(rng() * (KOL * 2 + 1)) - KOL;
        while (opptatt.has(x)) { x = x >= KOL ? -KOL : x + 1; }
        opptatt.add(x);
        liste.push({ x, slag: rng() < 0.5 ? 'original' : 'paprika', levering: true });
      }
    }
    this.pakkeCache.set(r, liste);
    return liste;
  }

  /* Leveringsrunden i luke k (eller null): { fra } = første av tre rader */
  leveringLuke(k) {
    if (this.levCache.has(k)) { return this.levCache.get(k); }
    const rng = lagRng(bland(this.frø, k, SALT_LEV ^ 0xABCDEF));
    let svar = null;
    if (rng() < 0.6) {
      const start = 40 + k * LEV_LUKE + Math.floor(rng() * 50);
      const ok = (r) => r !== JOBB - 3 && !iTryggSone(r) && PAKKELAND.includes(this.spek(r).type);
      for (let r = start; r < start + 20; r++) {
        if (ok(r) && ok(r + 1) && ok(r + 2)) { svar = { fra: r }; break; }
      }
    }
    this.levCache.set(k, svar);
    return svar;
  }

  /* Første rad i leveringsrunden som rad r er med i, eller null */
  levering(r) {
    if (r < 40) { return null; }
    const l = this.leveringLuke(Math.floor((r - 40) / LEV_LUKE));
    return l && r >= l.fra && r <= l.fra + 2 ? l.fra : null;
  }

  /* Vanlige pakker (uten leveringsrunden) */
  grunnPakker(r) {
    const spek = this.spek(r), liste = [];
    if (r >= 4 && r !== JOBB - 3 && PAKKELAND.includes(spek.type)) {
      const rng = lagRng(bland(this.frø, r, SALT_PAKKE));
      const sjanse = (spek.type === 'vei' ? 0.16 : 0.24) * (spek.verden === 'kylling' ? 1.7 : 1);
      if (rng() < sjanse) {
        liste.push({ x: Math.floor(rng() * (KOL * 2 + 1)) - KOL, slag: rng() < 0.5 ? 'original' : 'paprika' });
      }
    }
    return liste;
  }

  /* Kraftpakken i luke k (eller null): { rad, x, slag } */
  kraftLuke(k) {
    if (this.kraftCache.has(k)) { return this.kraftCache.get(k); }
    const rng = lagRng(bland(this.frø, k, SALT_KRAFT));
    let svar = null;
    if (rng() < 0.6) {
      const fra = 15 + k * KRAFT_LUKE + Math.floor(rng() * 20);
      const v = rng(), slag = v < 0.4 ? 'skjold' : v < 0.7 ? 'fart' : 'magnet';
      const xr = rng();
      for (let r = fra; r < fra + 10; r++) {
        if (iTryggSone(r) || !KRAFTLAND.includes(this.spek(r).type) || this.spek(r).port) { continue; }
        const opptatt = new Set(this.pakker(r).map((p) => p.x));
        let x = Math.floor(xr * (KOL * 2 + 1)) - KOL;
        while (opptatt.has(x)) { x = x >= KOL ? -KOL : x + 1; }
        svar = { rad: r, x, slag };
        break;
      }
    }
    this.kraftCache.set(k, svar);
    return svar;
  }

  /* Kraftpakken i rad r: { x, slag } eller null */
  kraft(r) {
    if (r < 15) { return null; }
    const k = this.kraftLuke(Math.floor((r - 15) / KRAFT_LUKE));
    return k && k.rad === r ? k : null;
  }
}

/* ---------------------------------------------------------------------------
   TREKKLOGGEN
   Spillet skriver én bit per hendelse, skilt med komma:
     u12 / d8 / l3 / r1a  hopp (retning + hundredeler siden forrige hopp, base 36)
     p1f.5                plukket pakke på rad 0x1f (base 36), kolonne 5 (x + 4)
     m                    måka stjal en pakke
     b                    tredemølla dyttet kyllingen én rad bakover
     k1f.5                tok kraftpakken på rad 0x1f, kolonne 5 (fart og magnet
                          gir raskere hopp / pakker på avstand i en kort tid)
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
  let fartTil = -1, magnetTil = -1;   /* når kraftene slutter (hundredeler, med litt slingring) */
  const kraftTatt = new Set();
  for (const bit of biter) {
    let m;
    if ((m = /^([udlr])([0-9a-z]{1,6})$/.exec(bit))) {
      const d = parseInt(m[2], 36);
      const min = cs + d <= fartTil ? FART_MIN_HOPP_CS : MIN_HOPP_CS;
      if (hopp > 0 && d < min) { return { feil: 'Kyllingen hoppet raskere enn mulig.' }; }
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
      /* Med magnet kan pakker i raden og raden foran, to kolonner unna, trekkes inn */
      const magnet = cs <= magnetTil;
      if (pr !== rad && !(magnet && pr === rad + 1)) { return { feil: 'En pakke ble tatt på en rad kyllingen ikke sto på.' }; }
      const nokkel = pr + ':' + px;
      if (tatt.has(nokkel) || !bane.pakker(pr).some((p) => p.x === px)) { return { feil: 'Den pakken fantes ikke.' }; }
      if (kol !== null && (magnet ? Math.abs(kol - px) > MAGNET_REKKEVIDDE : kol !== px)) { return { feil: 'Kyllingen sto ikke ved pakken.' }; }
      if (!magnet) { kol = px; }
      tatt.add(nokkel);
      pakker++;
    } else if ((m = /^k([0-9a-z]{1,4})\.([0-8])$/.exec(bit))) {
      /* Kraftpakke: må ligge der kyllingen står, og tas bare én gang */
      const pr = parseInt(m[1], 36), px = Number(m[2]) - KOL;
      const k = bane.kraft(pr);
      if (pr !== rad || !k || k.x !== px || kraftTatt.has(pr)) { return { feil: 'Den kraftpakken fantes ikke.' }; }
      if (kol !== null && kol !== px) { return { feil: 'Kyllingen sto ikke ved kraftpakken.' }; }
      kol = px;
      kraftTatt.add(pr);
      if (k.slag === 'fart') { fartTil = cs + KRAFT.fart + 50; }
      if (k.slag === 'magnet') { magnetTil = cs + KRAFT.magnet + 50; }
    } else if (bit === 'b') {
      /* Bare lov på en tredemølle. Kolonnen er den samme (mølla går rett bakover). */
      const spek = bane.spek(rad);
      if (!spek || spek.type !== 'mølle') { return { feil: 'Ugyldig logg.' }; }
      rad -= 1;
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
