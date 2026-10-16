/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — MODELLER OG SKILT
   Alle modeller lages av klosser (se voxel.js). Funksjonene som slutter på
   «Bokser» gir en liste klosser som kan slås sammen med bakken i en rad
   (ett tegnekall per rad). Kjøretøy og tømmerstokker er egne modeller som
   gjenbruker samme geometri. Skilt og reklame tegnes på et lerret med logoen.
   ============================================================================= */
import * as THREE from '../vendor/three.module.min.js';
import { F, bokser, modell, MATERIALE } from './voxel.js';

/* ---------------------------------------------------------------------------
   SKILT OG REKLAME (lerret → tekstur)
   --------------------------------------------------------------------------- */
const KYLLING_STI = [
  'M63.5 4c2.5-4 7.5-3 9 1.5 2.5-4 8-3 8.5 1.5 4-1.5 8 1.5 6.5 6 3 2.5 4.5 6 4.5 9.5l7.5 3.5-9 4.5',
  'M90 30.5c-1 4.5-1.5 8-1.5 12.5v15.5C88.5 73.5 77 85 62.5 85h-16C32 85 20.5 73.5 20.5 59c0-1 0-2 .2-3',
  'M21.5 61.5L2 56.5l19-12L1.5 29l25 4.5c12.5 2 24-.5 32-6.5 3.5-2.5 5.5-6.5 5.5-11',
  'M39.5 84.5V97h-8.5M60.5 84.5V97h8.5'
].map((d) => new Path2D(d));

/* Tegner logokyllingen med øverste venstre hjørne i (x, y) og bredde b */
export function tegnKylling(g, x, y, b, farge, strek) {
  g.save();
  g.translate(x, y);
  g.scale(b / 106, b / 106);
  g.translate(3, 3);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = strek || 6; g.strokeStyle = farge;
  for (const p of KYLLING_STI) { g.stroke(p); }
  g.fillStyle = farge;
  g.beginPath(); g.arc(75.5, 18.5, 4, 0, Math.PI * 2); g.fill();
  g.restore();
}

const HEX = (n) => '#' + n.toString(16).padStart(6, '0');

/* Skriver tekst som presses smalere (som det kondenserte Archivo) hvis den er
   bredere enn maks, så den aldri kuttes på skiltet */
function skriv(g, tekst, x, y, maks) {
  const b = g.measureText(tekst).width;
  if (b <= maks) { g.fillText(tekst, x, y); return; }
  g.save();
  g.translate(x, y);
  g.scale(maks / b, 1);
  g.fillText(tekst, 0, 0);
  g.restore();
}

/* Ordmerket «bare KYLLING» med kyllingen foran */
export function tegnOrdmerke(g, x, y, h, farge) {
  tegnKylling(g, x, y, h * 0.95, farge, 6.5);
  g.fillStyle = farge;
  g.textBaseline = 'alphabetic';
  g.font = `900 ${Math.round(h * 0.82)}px Archivo, Arial, sans-serif`;
  g.fillText('bare', x + h * 1.02, y + h * 0.66);
  g.font = `700 ${Math.round(h * 0.2)}px Archivo, Arial, sans-serif`;
  const bokstaver = 'KYLLING'.split('');
  let bx = x + h * 1.06;
  for (const b of bokstaver) { g.fillText(b, bx, y + h * 0.96); bx += h * 0.27; }
}

function lerret(b, h) {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  return c;
}

function tekstur(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Et skilt som en tynn plate med tekstur foran */
export function skiltPlate(tex, b, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshLambertMaterial({ map: tex }));
  m.receiveShadow = true;
  return m;
}

export function butikkSkilt() {
  const c = lerret(512, 128), g = c.getContext('2d');
  g.fillStyle = HEX(F.honey); g.fillRect(0, 0, 512, 128);
  g.fillStyle = HEX(F.ink); g.fillRect(0, 118, 512, 10);
  tegnOrdmerke(g, 92, 18, 92, HEX(F.ink));
  return tekstur(c);
}

export function vareSkilt() {
  const c = lerret(256, 96), g = c.getContext('2d');
  g.fillStyle = HEX(F.honey); g.fillRect(0, 0, 256, 96);
  tegnOrdmerke(g, 30, 14, 62, HEX(F.ink));
  g.fillStyle = HEX(F.ink);
  g.font = '700 12px Manrope, Arial, sans-serif';
  skriv(g, 'Ekte mat. Ekte protein.', 32, 90, 200);
  return tekstur(c);
}

export function jobbSkilt() {
  const c = lerret(512, 128), g = c.getContext('2d');
  g.fillStyle = HEX(F.forest); g.fillRect(0, 0, 512, 128);
  g.strokeStyle = HEX(F.honey); g.lineWidth = 6; g.strokeRect(10, 10, 492, 108);
  g.fillStyle = HEX(F.creamHi);
  g.textAlign = 'center';
  g.font = '900 64px Archivo, Arial, sans-serif';
  skriv(g, 'JOBBSENTERET', 256, 82, 460);
  g.font = '700 16px Manrope, Arial, sans-serif';
  g.fillStyle = HEX(F.honey);
  skriv(g, 'Åpent for kyllinger med pågangsmot', 256, 106, 440);
  return tekstur(c);
}

export function lappSkilt(tekst, bakgrunn, forgrunn) {
  const c = lerret(256, 96), g = c.getContext('2d');
  g.fillStyle = HEX(bakgrunn); g.fillRect(0, 0, 256, 96);
  g.fillStyle = HEX(forgrunn);
  g.textAlign = 'center';
  const linjer = tekst.split('\n');
  g.font = '900 30px Archivo, Arial, sans-serif';
  linjer.forEach((l, i) => skriv(g, l, 128, 42 + i * 34 - (linjer.length - 1) * 14, 236));
  return tekstur(c);
}

/* Digitale reklametavler: plakatene bytter med en glidende overgang, og et
   rullebånd går nederst. Alle tavlene deler samme tekstur (billig). */
const PLAKATER = [
  { bg: F.honey, fg: F.ink, linjer: ['Naturens', 'proteinbar.'], merke: true },
  { bg: F.forest, fg: F.creamHi, linjer: ['Original', 'salt, pepper & urter'] },
  { bg: F.paprika, fg: F.creamHi, linjer: ['Sweet', 'Paprika'] },
  { bg: F.ink, fg: F.honey, linjer: ['Ferdigstekt.', '0 min.'] },
  { bg: F.creamHi, fg: F.ink, linjer: ['Ekte mat.', 'Ekte protein.'], merke: true },
  { bg: F.honey, fg: F.ink, linjer: ['Kommer', 'snart!'] }
];

export class Reklame {
  constructor() {
    this.c = lerret(256, 144);
    this.g = this.c.getContext('2d');
    this.tex = tekstur(this.c);
    this.nr = 0;
    this.tid = 0;
    this.rull = 0;
    this.tegn(0);
  }
  plakat(p, dx) {
    const g = this.g;
    g.save();
    g.translate(dx, 0);
    g.fillStyle = HEX(p.bg); g.fillRect(0, 0, 256, 124);
    g.fillStyle = HEX(p.fg);
    g.font = '900 38px Archivo, Arial, sans-serif';
    const maks = p.merke ? 168 : 222;
    skriv(g, p.linjer[0], 18, 54, maks);
    g.font = p.linjer[1].length > 12 ? '800 22px Archivo, Arial, sans-serif' : '900 38px Archivo, Arial, sans-serif';
    skriv(g, p.linjer[1], 18, p.linjer[1].length > 12 ? 90 : 96, maks);
    if (p.merke) { tegnKylling(g, 196, 70, 44, HEX(p.fg), 7); }
    g.restore();
  }
  tegn(overgang) {
    const g = this.g;
    const a = PLAKATER[this.nr], b = PLAKATER[(this.nr + 1) % PLAKATER.length];
    const dx = -256 * overgang;
    this.plakat(a, dx);
    if (overgang > 0) { this.plakat(b, dx + 256); }
    /* rullebånd */
    g.fillStyle = HEX(F.ink); g.fillRect(0, 124, 256, 20);
    g.fillStyle = HEX(F.honey);
    g.font = '800 13px Manrope, Arial, sans-serif';
    const tekst = 'BARE KYLLING · FERDIGSTEKT KYLLINGFILET · ORIGINAL · SWEET PAPRIKA · ÅPNE. SPIS. FORTSETT DAGEN. · ';
    const bredde = g.measureText(tekst).width;
    const x0 = -(this.rull % bredde);
    g.fillText(tekst, x0, 139); g.fillText(tekst, x0 + bredde, 139);
    /* skjermlinjer for et digitalt preg */
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < 124; y += 3) { g.fillRect(0, y, 256, 1); }
    this.tex.needsUpdate = true;
  }
  oppdater(dt) {
    this.tid += dt;
    this.rull += dt * 34;
    const VIS = 3.2, BYTT = 0.45;
    let overgang = 0;
    if (this.tid > VIS) { overgang = Math.min(1, (this.tid - VIS) / BYTT); }
    if (this.tid > VIS + BYTT) { this.tid = 0; this.nr = (this.nr + 1) % PLAKATER.length; overgang = 0; }
    this.tegn(overgang * overgang * (3 - 2 * overgang));
  }
}

/* ---------------------------------------------------------------------------
   PYNT SOM SLÅS SAMMEN MED BAKKEN («…Bokser» gir bare klosser)
   --------------------------------------------------------------------------- */
export function treBokser(x, z, v) {
  const l = [{ x, y: 0, z, w: 0.24, h: 0.42, d: 0.24, c: F.bark }];
  if (v === 0) {           /* rundt løvtre */
    l.push({ x, y: 0.42, z, w: 0.86, h: 0.5, d: 0.86, c: F.lov });
    l.push({ x, y: 0.92, z, w: 0.6, h: 0.32, d: 0.6, c: F.lovLys });
  } else if (v === 1) {    /* høyt løvtre */
    l.push({ x, y: 0.42, z, w: 0.76, h: 0.9, d: 0.76, c: F.lovMork });
    l.push({ x, y: 1.32, z, w: 0.5, h: 0.3, d: 0.5, c: F.lov });
  } else {                 /* gran */
    l.push({ x, y: 0.4, z, w: 0.9, h: 0.34, d: 0.9, c: F.forest });
    l.push({ x, y: 0.74, z, w: 0.66, h: 0.32, d: 0.66, c: F.forest });
    l.push({ x, y: 1.06, z, w: 0.4, h: 0.3, d: 0.4, c: F.forestDeep });
  }
  return l;
}

export function buskBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.72, h: 0.42, d: 0.62, c: F.lov },
    { x: x + 0.08, y: 0.42, z, w: 0.44, h: 0.16, d: 0.4, c: F.lovLys },
    { x: x - 0.18, y: 0.3, z: z + 0.26, w: 0.1, h: 0.1, d: 0.1, c: F.rosa }
  ];
}

export function steinBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.6, h: 0.32, d: 0.5, c: F.stein },
    { x: x + 0.06, y: 0.32, z: z - 0.04, w: 0.34, h: 0.12, d: 0.3, c: 0xB0ACA2 }
  ];
}

export function blomsterBokser(x, z, rng) {
  const l = [];
  const farger = [F.roed, F.gul, F.creamHi, F.lilla, F.rosa, F.honey];
  for (let i = 0; i < 3; i++) {
    const fx = x + (rng() - 0.5) * 0.7, fz = z + (rng() - 0.5) * 0.7;
    l.push({ x: fx, y: 0, z: fz, w: 0.05, h: 0.12, d: 0.05, c: F.lovMork });
    l.push({ x: fx, y: 0.12, z: fz, w: 0.12, h: 0.08, d: 0.12, c: farger[Math.floor(rng() * farger.length)] });
  }
  return l;
}

export function lyktBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.12, h: 1.7, d: 0.12, c: F.ink },
    { x: x + 0.18, y: 1.62, z, w: 0.42, h: 0.08, d: 0.1, c: F.ink },
    { x: x + 0.34, y: 1.48, z, w: 0.2, h: 0.14, d: 0.2, c: F.honey }
  ];
}

export function skiltBokser(x, z, farge) {
  return [
    { x, y: 0, z, w: 0.08, h: 1.1, d: 0.08, c: F.inkSoft },
    { x, y: 1.0, z: z + 0.05, w: 0.44, h: 0.44, d: 0.05, c: F.creamHi },
    { x, y: 1.04, z: z + 0.08, w: 0.36, h: 0.36, d: 0.03, c: farge }
  ];
}

export function benkBokser(x, z) {
  return [
    { x: x - 0.32, y: 0, z, w: 0.08, h: 0.24, d: 0.3, c: F.ink },
    { x: x + 0.32, y: 0, z, w: 0.08, h: 0.24, d: 0.3, c: F.ink },
    { x, y: 0.24, z, w: 0.86, h: 0.06, d: 0.34, c: F.bark },
    { x, y: 0.3, z: z - 0.16, w: 0.86, h: 0.26, d: 0.05, c: F.bark }
  ];
}

export function soppelBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.32, h: 0.46, d: 0.32, c: F.forest },
    { x, y: 0.46, z, w: 0.36, h: 0.06, d: 0.36, c: F.forestDeep }
  ];
}

/* Små hus i Bergen-stil: trevegger og saltak */
export function husBokser(x, z, b, d, h, vegg, tak) {
  const l = [{ x, y: 0, z, w: b, h, d, c: vegg }];
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.24;
    l.push({ x, y: h + i * 0.18, z, w: b + 0.1, h: 0.18, d: (d + 0.12) * k, c: tak });
  }
  const vinduer = Math.max(1, Math.floor(b / 0.7));
  for (let i = 0; i < vinduer; i++) {
    const vx = x - b / 2 + (i + 0.5) * (b / vinduer);
    l.push({ x: vx, y: h * 0.55, z: z + d / 2 + 0.01, w: 0.26, h: 0.3, d: 0.03, c: F.glass });
    l.push({ x: vx, y: h * 0.55 - 0.05, z: z + d / 2 + 0.02, w: 0.32, h: 0.05, d: 0.04, c: F.creamHi });
  }
  return l;
}

/* ---------------------------------------------------------------------------
   BYGNINGER MED SKILT (egne meshes, siden skiltet har tekstur)
   --------------------------------------------------------------------------- */
/* Bare Kylling-butikken. Døra og skiltet vender mot +x (mot stien) og +z
   (mot kameraet). Midten av fotavtrykket er (0, 0). */
export function butikk(teksturer) {
  const g = new THREE.Group();
  const B = 5, D = 2.6, H = 1.8;
  const l = [
    { x: 0, y: 0, z: 0, w: B, h: H, d: D, c: F.creamHi },
    { x: 0, y: H, z: 0, w: B + 0.2, h: 0.18, d: D + 0.2, c: F.forest },
    { x: 0, y: H + 0.18, z: 0, w: B - 0.6, h: 0.1, d: D - 0.6, c: F.forestDeep },
    /* vinduer mot kameraet */
    { x: -1.2, y: 0.35, z: D / 2 + 0.01, w: 1.4, h: 0.9, d: 0.04, c: F.glass },
    { x: 1.0, y: 0.35, z: D / 2 + 0.01, w: 1.2, h: 0.9, d: 0.04, c: F.glass },
    /* dør og vindu mot stien */
    { x: B / 2 + 0.01, y: 0, z: 0.3, w: 0.04, h: 1.15, d: 0.7, c: F.forest },
    { x: B / 2 + 0.03, y: 0.55, z: 0.5, w: 0.04, h: 0.06, d: 0.06, c: F.honey },
    { x: B / 2 + 0.01, y: 0.35, z: -0.75, w: 0.04, h: 0.8, d: 0.8, c: F.glass },
    /* markise i honning med striper */
    { x: 0, y: 1.25, z: D / 2 + 0.3, w: B, h: 0.1, d: 0.6, c: F.honey },
    { x: B / 2 + 0.3, y: 1.25, z: 0, w: 0.6, h: 0.1, d: D, c: F.honey }
  ];
  for (let i = -2; i <= 2; i++) { l.push({ x: i, y: 1.2, z: D / 2 + 0.6, w: 0.5, h: 0.14, d: 0.04, c: F.creamHi }); }
  /* krakker og en liten tavle ute */
  l.push({ x: B / 2 + 0.55, y: 0, z: 0.95, w: 0.08, h: 0.7, d: 0.4, c: F.ink });
  const m = modell(l);
  g.add(m);
  const skiltFor = skiltPlate(teksturer.butikk, 3.6, 0.9);
  skiltFor.position.set(0, H - 0.05, D / 2 + 0.02);
  g.add(skiltFor);
  const skiltSide = skiltPlate(teksturer.butikk, 2.4, 0.6);
  skiltSide.position.set(B / 2 + 0.02, H - 0.25, 0);
  skiltSide.rotation.y = Math.PI / 2;
  g.add(skiltSide);
  return g;
}

/* Jobbsenteret: et stort bygg over stien med én åpen dør i midten (x = 0).
   Fotavtrykk: x −10..10, z −1..1 (to rader). Bygget får egne, gjennomsiktige
   materialer, så spillet kan tone det ned når kyllingen står bak det. */
export function jobbsenter(teksturer) {
  const g = new THREE.Group();
  const H = 2.5, D = 1.6, f = D / 2;    /* høyde, dybde og fasaden (z) */
  const l = [
    { x: -5.75, y: 0, z: 0, w: 10.5, h: H, d: D, c: F.beige },
    { x: 5.75, y: 0, z: 0, w: 10.5, h: H, d: D, c: F.beige },
    { x: 0, y: 1.3, z: 0, w: 1.0, h: H - 1.3, d: D, c: F.beige },
    { x: 0, y: H, z: 0, w: 21.2, h: 0.3, d: D + 0.3, c: F.forest },
    { x: 0, y: H + 0.3, z: f - 0.5, w: 4.8, h: 1.25, d: 0.8, c: F.forestDeep },
    /* døråpning, mørk innside */
    { x: 0, y: 0, z: 0, w: 0.96, h: 1.28, d: D - 0.02, c: F.inkSoft, uten: [2] },
    /* søyler, tak over inngangen og dørmatte */
    { x: -0.75, y: 0, z: f + 0.05, w: 0.22, h: 1.5, d: 0.22, c: F.creamHi },
    { x: 0.75, y: 0, z: f + 0.05, w: 0.22, h: 1.5, d: 0.22, c: F.creamHi },
    { x: 0, y: 1.5, z: f + 0.05, w: 1.9, h: 0.16, d: 0.4, c: F.creamHi },
    { x: 0, y: 0, z: f + 0.3, w: 0.9, h: 0.03, d: 0.5, c: F.honeyDeep }
  ];
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) < 1) { continue; }
    l.push({ x: i * 1.15, y: 0.6, z: f + 0.01, w: 0.62, h: 0.9, d: 0.04, c: F.glass });
    l.push({ x: i * 1.15, y: 1.75, z: f + 0.01, w: 0.62, h: 0.45, d: 0.04, c: F.glassMork });
  }
  const bygg = modell(l);
  bygg.material = MATERIALE.clone();
  bygg.material.transparent = true;
  g.add(bygg);
  const skilt = skiltPlate(teksturer.jobb, 4.4, 1.1);
  skilt.material.transparent = true;
  skilt.position.set(0, H + 0.62, f - 0.09);
  g.add(skilt);
  g.userData.materialer = [bygg.material, skilt.material];
  return g;
}

/* Reklametavle på to bein, skjermen bruker den delte reklameteksturen */
export function reklametavle(tex, b = 2.6) {
  const g = new THREE.Group();
  const h = b * 0.5625;
  g.add(modell([
    { x: -b * 0.35, y: 0, z: 0, w: 0.12, h: 1.4, d: 0.12, c: F.ink },
    { x: b * 0.35, y: 0, z: 0, w: 0.12, h: 1.4, d: 0.12, c: F.ink },
    { x: 0, y: 1.3, z: -0.05, w: b + 0.2, h: h + 0.2, d: 0.14, c: F.ink }
  ]));
  const skjerm = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshBasicMaterial({ map: tex }));
  skjerm.position.set(0, 1.4 + h / 2, 0.03);
  g.add(skjerm);
  return g;
}

/* ---------------------------------------------------------------------------
   KJØRETØY OG FLYTENDE TING – geometrien lages én gang per variant
   Lengden går langs x (kjøreretningen); fronten peker mot +x.
   --------------------------------------------------------------------------- */
const hjul = (x, z) => ({ x, y: 0, z, w: 0.26, h: 0.26, d: 0.12, c: F.ink });

const geoCache = new Map();
function cachet(navn, lag) {
  if (!geoCache.has(navn)) { geoCache.set(navn, lag()); }
  return geoCache.get(navn);
}

export function bil(farge) {
  const geo = cachet('bil' + farge, () => bokser([
    { x: 0, y: 0.1, z: 0, w: 1.3, h: 0.34, d: 0.72, c: farge },
    { x: -0.08, y: 0.44, z: 0, w: 0.72, h: 0.3, d: 0.64, c: farge },
    { x: 0.25, y: 0.48, z: 0, w: 0.06, h: 0.22, d: 0.58, c: F.glass },
    { x: -0.42, y: 0.48, z: 0, w: 0.06, h: 0.22, d: 0.58, c: F.glassMork },
    { x: -0.08, y: 0.48, z: 0.33, w: 0.5, h: 0.2, d: 0.02, c: F.glass },
    { x: -0.08, y: 0.48, z: -0.33, w: 0.5, h: 0.2, d: 0.02, c: F.glass },
    { x: 0.66, y: 0.24, z: 0.24, w: 0.03, h: 0.08, d: 0.14, c: F.creamHi },
    { x: 0.66, y: 0.24, z: -0.24, w: 0.03, h: 0.08, d: 0.14, c: F.creamHi },
    { x: -0.66, y: 0.24, z: 0.24, w: 0.03, h: 0.08, d: 0.14, c: F.roed },
    { x: -0.66, y: 0.24, z: -0.24, w: 0.03, h: 0.08, d: 0.14, c: F.roed },
    hjul(0.38, 0.36), hjul(-0.38, 0.36), hjul(0.38, -0.36), hjul(-0.38, -0.36)
  ]));
  return lagMesh(geo, 1.3);
}

export function lastebil() {
  const geo = cachet('lastebil', () => bokser([
    { x: 0.95, y: 0.12, z: 0, w: 0.7, h: 0.72, d: 0.76, c: F.roed },
    { x: 1.06, y: 0.5, z: 0, w: 0.5, h: 0.26, d: 0.7, c: F.glass, uten: [1] },
    { x: -0.35, y: 0.12, z: 0, w: 1.9, h: 0.86, d: 0.8, c: F.beige },
    { x: -0.35, y: 0.96, z: 0, w: 1.94, h: 0.06, d: 0.84, c: F.fortauMork },
    hjul(1.0, 0.38), hjul(1.0, -0.38), hjul(-0.1, 0.38), hjul(-0.1, -0.38), hjul(-0.9, 0.38), hjul(-0.9, -0.38)
  ]));
  return lagMesh(geo, 2.6);
}

/* Bare Kylling-varebilen: honning med logoen på begge sider */
export function varebil(teksturer) {
  const geo = cachet('varebil', () => bokser([
    { x: -0.1, y: 0.12, z: 0, w: 1.6, h: 0.74, d: 0.76, c: F.honey },
    { x: 0.72, y: 0.12, z: 0, w: 0.3, h: 0.46, d: 0.76, c: F.honey },
    { x: 0.6, y: 0.58, z: 0, w: 0.06, h: 0.24, d: 0.68, c: F.glass },
    { x: -0.1, y: 0.86, z: 0, w: 1.64, h: 0.05, d: 0.8, c: F.ink },
    { x: 0.88, y: 0.26, z: 0.24, w: 0.03, h: 0.08, d: 0.14, c: F.creamHi },
    { x: 0.88, y: 0.26, z: -0.24, w: 0.03, h: 0.08, d: 0.14, c: F.creamHi },
    hjul(0.5, 0.38), hjul(-0.5, 0.38), hjul(0.5, -0.38), hjul(-0.5, -0.38)
  ]));
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, MATERIALE);
  m.castShadow = true;
  g.add(m);
  for (const s of [1, -1]) {
    const p = skiltPlate(teksturer.vare, 1.28, 0.48);
    p.position.set(-0.18, 0.5, 0.385 * s);
    if (s < 0) { p.rotation.y = Math.PI; }
    g.add(p);
  }
  g.userData.lengde = 1.75;
  return g;
}

export function buss() {
  const geo = cachet('buss', () => {
    const l = [
      { x: 0, y: 0.12, z: 0, w: 2.9, h: 0.9, d: 0.8, c: F.forest },
      { x: 0, y: 1.02, z: 0, w: 2.94, h: 0.06, d: 0.84, c: F.forestDeep },
      { x: 1.45, y: 0.5, z: 0, w: 0.03, h: 0.4, d: 0.7, c: F.glass },
      hjul(1.0, 0.39), hjul(1.0, -0.39), hjul(-1.0, 0.39), hjul(-1.0, -0.39)
    ];
    for (let i = 0; i < 5; i++) {
      l.push({ x: -1.1 + i * 0.5, y: 0.56, z: 0.405, w: 0.38, h: 0.3, d: 0.02, c: F.glass });
      l.push({ x: -1.1 + i * 0.5, y: 0.56, z: -0.405, w: 0.38, h: 0.3, d: 0.02, c: F.glass });
    }
    return bokser(l);
  });
  return lagMesh(geo, 2.9);
}

/* Bybanen: lang, lav og rask. Seks vogner i ett stykke. */
export function bybane() {
  const geo = cachet('bybane', () => {
    const l = [];
    for (let i = 0; i < 4; i++) {
      const x = -3.3 + i * 2.2;
      l.push({ x, y: 0.12, z: 0, w: 2.1, h: 0.95, d: 0.84, c: i % 2 ? F.creamHi : F.sage });
      l.push({ x, y: 0.55, z: 0.43, w: 1.7, h: 0.3, d: 0.02, c: F.glass });
      l.push({ x, y: 0.55, z: -0.43, w: 1.7, h: 0.3, d: 0.02, c: F.glass });
      l.push({ x, y: 1.07, z: 0, w: 2.12, h: 0.08, d: 0.86, c: F.inkSoft });
      l.push({ x, y: 0.12, z: 0.43, w: 2.1, h: 0.1, d: 0.02, c: F.forest });
    }
    l.push({ x: 4.42, y: 0.4, z: 0, w: 0.06, h: 0.45, d: 0.7, c: F.glass });
    l.push({ x: 0, y: 1.15, z: 0, w: 0.06, h: 0.4, d: 0.06, c: F.ink });
    return bokser(l);
  });
  return lagMesh(geo, 8.9);
}

/* Tømmerstokken: rund i tverrsnitt (tre lag), bark med striper og knaster,
   avsagde ender med årringer, litt mose – og rutene skåret inn i toppen som
   avsagde planker med et årringmerke i midten (der kyllingen lander).
   Toppen ligger på y = STOKK_TOPP. */
export const STOKK_TOPP = 0.21;
export function stokk(lengde) {
  const geo = cachet('stokk' + lengde, () => {
    const L = lengde, l = [];
    const BARK = 0x7A5233, BARK_LYS = 0x8C603C, BARK_MORK = 0x5E3E25, VED = 0xC69A6B, VED_LYS = 0xD8B887, RING = 0xA87A4E;
    /* tverrsnitt: smal bunn, full midte, smal topp */
    l.push({ x: 0, y: -0.16, z: 0, w: L - 0.06, h: 0.1, d: 0.46, c: BARK_MORK });
    l.push({ x: 0, y: -0.06, z: 0, w: L, h: 0.18, d: 0.66, c: BARK });
    l.push({ x: 0, y: 0.12, z: 0, w: L - 0.04, h: 0.06, d: 0.5, c: BARK_LYS });
    /* barkstriper langs sidene */
    for (const s of [-1, 1]) {
      l.push({ x: 0, y: -0.02, z: s * 0.331, w: L - 0.1, h: 0.035, d: 0.01, c: BARK_MORK });
      l.push({ x: 0, y: 0.07, z: s * 0.331, w: L - 0.3, h: 0.025, d: 0.01, c: BARK_LYS });
    }
    /* avsagde ender med årringer */
    for (const s of [-1, 1]) {
      const ex = s * (L / 2 + 0.005);
      l.push({ x: ex, y: -0.14, z: 0, w: 0.02, h: 0.32, d: 0.58, c: VED });
      l.push({ x: ex + s * 0.006, y: -0.06, z: 0, w: 0.012, h: 0.18, d: 0.36, c: RING });
      l.push({ x: ex + s * 0.01, y: -0.02, z: 0, w: 0.012, h: 0.1, d: 0.18, c: VED_LYS });
    }
    /* rutene: avsagde planker med fuge mellom, og et årringmerke i midten */
    for (let i = 0; i < L; i++) {
      const cx = -L / 2 + 0.5 + i;
      l.push({ x: cx, y: 0.18, z: 0, w: 0.86, h: 0.03, d: 0.46, c: i % 2 ? 0xB98B5C : 0xB28456 });
      for (const [w, d, dz, dx] of [[0.24, 0.03, 0.105, 0], [0.24, 0.03, -0.105, 0], [0.03, 0.18, 0, 0.105], [0.03, 0.18, 0, -0.105]]) {
        l.push({ x: cx + dx, y: 0.21, z: dz, w, h: 0.006, d, c: RING });
      }
      l.push({ x: cx, y: 0.21, z: 0, w: 0.08, h: 0.006, d: 0.08, c: VED_LYS });
      /* knast og mose på noen av rutene (fast mønster per lengde) */
      if ((i * 7 + L) % 3 === 0) { l.push({ x: cx + 0.22, y: -0.01, z: 0.335, w: 0.1, h: 0.1, d: 0.02, c: BARK_MORK }); }
      if ((i + L) % 2 === 0) { l.push({ x: cx - 0.25, y: 0.15, z: -0.25, w: 0.24, h: 0.05, d: 0.08, c: F.lov }); }
    }
    /* en kort kvist med to blader */
    l.push({ x: -L / 2 + 0.7, y: 0.02, z: 0.38, w: 0.1, h: 0.08, d: 0.14, c: BARK });
    l.push({ x: -L / 2 + 0.7, y: 0.08, z: 0.46, w: 0.12, h: 0.04, d: 0.08, c: F.lovLys });
    return bokser(l);
  });
  return lagMesh(geo, lengde);
}

/* Påskeegg: en flåte av paller med en Bare Kylling-kasse på */
export function flaate(teksturer) {
  const geo = cachet('flaate', () => bokser([
    { x: 0, y: -0.12, z: 0, w: 3, h: 0.16, d: 0.8, c: 0xC9A574 },
    { x: 0, y: 0.04, z: 0, w: 3, h: 0.08, d: 0.8, c: 0xD8B887 },
    { x: -1, y: 0.12, z: 0, w: 0.6, h: 0.42, d: 0.5, c: F.honey }
  ]));
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, MATERIALE);
  m.castShadow = true;
  g.add(m);
  const p = skiltPlate(teksturer.vare, 0.56, 0.21);
  p.position.set(-1, 0.33, 0.255);
  g.add(p);
  g.userData.lengde = 3;
  return g;
}

/* Rutene på en stokk eller båt: skillelinjer mellom hver rute på 1 × 1 og
   en lys flis i midten, så man ser hvor kyllingen lander. topp = høyden på
   dekket. Én modell per lengde/høyde (geometrien deles). */
export function ruter(lengde, topp, farge = 0xE3CDA0) {
  const geo = cachet(`ruter${lengde}:${topp}:${farge}`, () => {
    const l = [];
    for (let i = 0; i < lengde; i++) {
      const cx = -lengde / 2 + 0.5 + i;
      /* en diskret ramme og et lite merke i midten, i en lysere tone av dekket */
      for (const [w, d, dz, dx] of [[0.5, 0.035, 0.235, 0], [0.5, 0.035, -0.235, 0], [0.035, 0.5, 0, 0.235], [0.035, 0.5, 0, -0.235]]) {
        l.push({ x: cx + dx, y: topp, z: dz, w, h: 0.008, d, c: farge });
      }
      l.push({ x: cx, y: topp, z: 0, w: 0.09, h: 0.008, d: 0.09, c: farge });
      if (i > 0) { l.push({ x: cx - 0.5, y: topp, z: 0, w: 0.03, h: 0.008, d: 0.62, c: farge, t: 0.75 }); }
    }
    return bokser(l);
  });
  return new THREE.Mesh(geo, MATERIALE);
}

function lagMesh(geo, lengde) {
  const m = new THREE.Mesh(geo, MATERIALE);
  m.castShadow = true;
  m.userData.lengde = lengde;
  return m;
}

/* Måka som tar kyllinger som står for lenge stille (dette er tross alt Bergen) */
/* ---------------------------------------------------------------------------
   KYLLING VERDEN – hønsehus, kornsiloer, eggkartonger og halmballer
   --------------------------------------------------------------------------- */
export function honsehusBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.82, h: 0.52, d: 0.7, c: F.paprika },
    { x, y: 0.52, z, w: 0.94, h: 0.12, d: 0.82, c: F.paprikaDeep },
    { x, y: 0.64, z, w: 0.7, h: 0.12, d: 0.6, c: F.paprikaDeep },
    { x, y: 0.02, z: z + 0.36, w: 0.24, h: 0.32, d: 0.02, c: F.ink },
    { x, y: 0.04, z: z + 0.5, w: 0.2, h: 0.03, d: 0.3, c: F.bark },
    { x: x + 0.24, y: 0.32, z: z + 0.36, w: 0.16, h: 0.12, d: 0.02, c: F.creamHi }
  ];
}
export function siloBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.6, h: 1.25, d: 0.6, c: F.creamHi },
    { x, y: 0.3, z, w: 0.64, h: 0.05, d: 0.64, c: F.fortauMork },
    { x, y: 0.75, z, w: 0.64, h: 0.05, d: 0.64, c: F.fortauMork },
    { x, y: 1.25, z, w: 0.66, h: 0.1, d: 0.66, c: F.honeyDeep },
    { x, y: 1.35, z, w: 0.42, h: 0.1, d: 0.42, c: F.honeyDeep },
    { x, y: 1.45, z, w: 0.16, h: 0.08, d: 0.16, c: F.honeyDeep }
  ];
}
export function eggBokser(x, z) {
  const l = [{ x, y: 0, z, w: 0.82, h: 0.16, d: 0.52, c: F.beige }];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) { l.push({ x: x - 0.26 + i * 0.26, y: 0.16, z: z - 0.12 + j * 0.24, w: 0.16, h: 0.2, d: 0.16, c: F.creamHi }); }
  }
  return l;
}
export function halmBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.78, h: 0.44, d: 0.52, c: 0xD9B65A },
    { x, y: 0.44, z, w: 0.78, h: 0.03, d: 0.52, c: 0xE8CC7A },
    { x: x - 0.2, y: 0, z, w: 0.04, h: 0.45, d: 0.54, c: F.honeyDeep },
    { x: x + 0.2, y: 0, z, w: 0.04, h: 0.45, d: 0.54, c: F.honeyDeep }
  ];
}

/* ---------------------------------------------------------------------------
   PYNT FRA BUTIKKEN – festes på kyllingen (hodet er rundt x 0,23, y 0,85;
   nebbet peker mot +x). Gir en modell eller null.
   --------------------------------------------------------------------------- */
const PYNT = {
  kokkelue: [
    { x: 0.23, y: 0.8, z: 0, w: 0.36, h: 0.16, d: 0.36, c: F.creamHi },
    { x: 0.23, y: 0.96, z: 0, w: 0.46, h: 0.2, d: 0.46, c: F.hvit },
    { x: 0.23, y: 1.16, z: 0, w: 0.3, h: 0.07, d: 0.3, c: F.hvit }
  ],
  caps: [
    { x: 0.2, y: 0.82, z: 0, w: 0.42, h: 0.16, d: 0.42, c: F.honey },
    { x: 0.2, y: 0.98, z: 0, w: 0.22, h: 0.05, d: 0.22, c: F.honeyDeep },
    { x: 0.5, y: 0.82, z: 0, w: 0.24, h: 0.04, d: 0.36, c: F.honeyDeep }
  ],
  krone: [
    { x: 0.23, y: 0.86, z: 0, w: 0.4, h: 0.1, d: 0.4, c: F.honey },
    { x: 0.07, y: 0.96, z: 0.16, w: 0.08, h: 0.12, d: 0.08, c: F.honey },
    { x: 0.39, y: 0.96, z: 0.16, w: 0.08, h: 0.12, d: 0.08, c: F.honey },
    { x: 0.07, y: 0.96, z: -0.16, w: 0.08, h: 0.12, d: 0.08, c: F.honey },
    { x: 0.39, y: 0.96, z: -0.16, w: 0.08, h: 0.12, d: 0.08, c: F.honey },
    { x: 0.44, y: 0.88, z: 0, w: 0.02, h: 0.06, d: 0.08, c: F.paprika }
  ],
  strahatt: [
    { x: 0.2, y: 0.84, z: 0, w: 0.78, h: 0.04, d: 0.78, c: 0xE3C673 },
    { x: 0.2, y: 0.88, z: 0, w: 0.36, h: 0.16, d: 0.36, c: 0xE3C673 },
    { x: 0.2, y: 0.88, z: 0, w: 0.38, h: 0.05, d: 0.38, c: F.paprika },
    { x: 0.2, y: 1.04, z: 0, w: 0.3, h: 0.04, d: 0.3, c: 0xD4B35E }
  ],
  gullkokkelue: [
    { x: 0.23, y: 0.8, z: 0, w: 0.36, h: 0.16, d: 0.36, c: F.honeyDeep },
    { x: 0.23, y: 0.96, z: 0, w: 0.46, h: 0.2, d: 0.46, c: 0xF2C14E },
    { x: 0.23, y: 1.16, z: 0, w: 0.3, h: 0.07, d: 0.3, c: 0xF7D47A },
    { x: 0.42, y: 0.84, z: 0, w: 0.02, h: 0.07, d: 0.07, c: F.paprika }
  ],
  /* Bryggen: sydvest og regnjakke i gult */
  sydvest: [
    { x: 0.1, y: 0.82, z: 0, w: 0.66, h: 0.04, d: 0.62, c: 0xF2C230 },
    { x: 0.2, y: 0.86, z: 0, w: 0.4, h: 0.14, d: 0.42, c: 0xF2C230 },
    { x: 0.2, y: 1.0, z: 0, w: 0.3, h: 0.04, d: 0.32, c: 0xE0B020 },
    { x: -0.18, y: 0.78, z: 0, w: 0.12, h: 0.06, d: 0.56, c: 0xE0B020 }
  ],
  regnjakke: [
    { x: 0.04, y: 0.2, z: 0, w: 0.64, h: 0.46, d: 0.53, c: 0xF2C230 },
    { x: 0.16, y: 0.64, z: 0, w: 0.4, h: 0.08, d: 0.55, c: 0xE0B020 },
    { x: 0.37, y: 0.3, z: 0, w: 0.02, h: 0.3, d: 0.04, c: F.ink },
    { x: 0.37, y: 0.52, z: 0.1, w: 0.02, h: 0.04, d: 0.04, c: F.ink },
    { x: 0.37, y: 0.42, z: 0.1, w: 0.02, h: 0.04, d: 0.04, c: F.ink },
    { x: 0.04, y: 0.2, z: 0.266, w: 0.6, h: 0.04, d: 0.01, c: F.creamHi },
    { x: 0.04, y: 0.2, z: -0.266, w: 0.6, h: 0.04, d: 0.01, c: F.creamHi }
  ],
  /* Treningssenteret: svettebånd og treningsbukse */
  svettebaand: [
    { x: 0.23, y: 0.72, z: 0, w: 0.34, h: 0.07, d: 0.51, c: F.roed },
    { x: 0.23, y: 0.745, z: 0, w: 0.35, h: 0.02, d: 0.515, c: F.creamHi }
  ],
  treningsbukse: [
    { x: 0, y: 0.13, z: 0, w: 0.5, h: 0.12, d: 0.51, c: F.blaa },
    { x: -0.1, y: 0.02, z: 0, w: 0.12, h: 0.12, d: 0.16, c: F.blaa },
    { x: 0.1, y: 0.02, z: 0, w: 0.12, h: 0.12, d: 0.16, c: F.blaa },
    { x: 0, y: 0.17, z: 0.258, w: 0.5, h: 0.03, d: 0.01, c: F.creamHi },
    { x: 0, y: 0.17, z: -0.258, w: 0.5, h: 0.03, d: 0.01, c: F.creamHi }
  ],
  /* Matboks på ryggen, med reimer */
  matboks: [
    { x: -0.14, y: 0.66, z: 0, w: 0.36, h: 0.22, d: 0.3, c: F.honey },
    { x: -0.14, y: 0.88, z: 0, w: 0.38, h: 0.04, d: 0.32, c: F.honeyDeep },
    { x: -0.14, y: 0.92, z: 0, w: 0.16, h: 0.04, d: 0.04, c: F.ink },
    { x: -0.14, y: 0.74, z: 0.151, w: 0.2, h: 0.08, d: 0.01, c: F.creamHi },
    { x: 0.06, y: 0.4, z: 0.15, w: 0.04, h: 0.3, d: 0.03, c: F.ink },
    { x: 0.06, y: 0.4, z: -0.15, w: 0.04, h: 0.3, d: 0.03, c: F.ink }
  ],
  /* Fabrikken: kokkeforkle */
  kokkeforkle: [
    { x: 0.37, y: 0.18, z: 0, w: 0.03, h: 0.44, d: 0.36, c: F.hvit },
    { x: 0.385, y: 0.4, z: 0, w: 0.02, h: 0.1, d: 0.14, c: F.honey },
    { x: 0.12, y: 0.42, z: 0.258, w: 0.5, h: 0.04, d: 0.01, c: F.hvit },
    { x: 0.12, y: 0.42, z: -0.258, w: 0.5, h: 0.04, d: 0.01, c: F.hvit },
    { x: 0.2, y: 0.18, z: 0.256, w: 0.32, h: 0.24, d: 0.01, c: F.hvit },
    { x: 0.2, y: 0.18, z: -0.256, w: 0.32, h: 0.24, d: 0.01, c: F.hvit }
  ],
  briller: [
    { x: 0.27, y: 0.7, z: 0.255, w: 0.2, h: 0.11, d: 0.03, c: F.ink },
    { x: 0.27, y: 0.7, z: -0.255, w: 0.2, h: 0.11, d: 0.03, c: F.ink },
    { x: 0.38, y: 0.79, z: 0, w: 0.04, h: 0.03, d: 0.54, c: F.ink }
  ]
};
export function pynt(id) {
  if (!PYNT[id]) { return null; }
  const m = new THREE.Mesh(bokser(PYNT[id]), MATERIALE);
  m.castShadow = true;
  return m;
}

/* En Bare Kylling-pakke å plukke opp: klar pose med kyllingfilet og etikett
   i smakens farge (Original grønn, Sweet Paprika rød). Geometrien deles. */
const PAKKE_GEO = {};
export function pakke(smak) {
  if (!PAKKE_GEO[smak]) {
    const etikett = smak === 'paprika' ? F.paprika : F.forest;
    PAKKE_GEO[smak] = bokser([
      { x: 0, y: 0, z: 0, w: 0.46, h: 0.6, d: 0.06, c: F.creamHi },
      { x: 0, y: 0.17, z: 0, w: 0.32, h: 0.24, d: 0.08, c: 0xD98A3D },
      { x: 0.04, y: 0.25, z: 0, w: 0.1, h: 0.05, d: 0.085, c: 0x8E3D20 },
      { x: 0, y: 0.02, z: 0, w: 0.47, h: 0.13, d: 0.08, c: etikett },
      { x: 0, y: 0.45, z: 0, w: 0.24, h: 0.05, d: 0.08, c: F.ink },
      { x: 0, y: 0.55, z: 0, w: 0.47, h: 0.06, d: 0.07, c: F.beige }
    ]);
  }
  const m = new THREE.Mesh(PAKKE_GEO[smak], MATERIALE);
  m.castShadow = true;
  return m;
}

export function maake() {
  const g = new THREE.Group();
  g.add(modell([
    { x: 0, y: 0, z: 0, w: 0.9, h: 0.36, d: 0.4, c: F.creamHi },
    { x: 0.5, y: 0.14, z: 0, w: 0.3, h: 0.3, d: 0.3, c: F.creamHi },
    { x: 0.72, y: 0.2, z: 0, w: 0.2, h: 0.08, d: 0.1, c: F.honey },
    { x: 0.6, y: 0.32, z: 0.155, w: 0.06, h: 0.06, d: 0.02, c: F.ink },
    { x: 0.6, y: 0.32, z: -0.155, w: 0.06, h: 0.06, d: 0.02, c: F.ink },
    { x: -0.55, y: 0.08, z: 0, w: 0.3, h: 0.16, d: 0.3, c: 0x8E9196 }
  ]));
  const vinge = (s) => {
    const w = modell([{ x: 0, y: 0, z: s * 0.45, w: 0.6, h: 0.06, d: 0.9, c: 0xA9ADB2 },
                      { x: -0.05, y: 0, z: s * 0.86, w: 0.4, h: 0.06, d: 0.2, c: F.ink }]);
    w.position.set(0, 0.3, 0);
    return w;
  };
  g.userData.venstre = vinge(1);
  g.userData.hoyre = vinge(-1);
  g.add(g.userData.venstre, g.userData.hoyre);
  return g;
}

/* ---------------------------------------------------------------------------
   SKILT SOM KOMMER IGJEN (porter, reklamevegger, plakater)
   Samme tekst deler tekstur, geometri og materiale, så nye rader ikke lager
   nye lerreter.
   --------------------------------------------------------------------------- */
const skiltCache = new Map();
export function skiltCachet(tekst, bakgrunn, forgrunn, b, h) {
  const k = [tekst, bakgrunn, forgrunn, b, h].join('|');
  if (!skiltCache.has(k)) {
    skiltCache.set(k, { geo: new THREE.PlaneGeometry(b, h), mat: new THREE.MeshLambertMaterial({ map: lappSkilt(tekst, bakgrunn, forgrunn) }) });
  }
  const { geo, mat } = skiltCache.get(k);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

/* Kjøretøy som ruller (vektskiver, treningsballer): en ytre gruppe som
   flyttes, og en indre modell som snurrer rundt aksen (z). */
function rullende(navn, lag, radius, lengde, slag) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(cachet(navn, lag), MATERIALE);
  m.castShadow = true;
  m.position.y = radius;
  g.add(m);
  Object.assign(g.userData, { lengde, slag, rull: m, radius });
  return g;
}
const medSlag = (m, slag) => { m.userData.slag = slag; return m; };

/* ---------------------------------------------------------------------------
   KYLLING VERDEN – traktor, kyllingfilet i sausebekken, høner og kyllingtoget
   --------------------------------------------------------------------------- */
export function traktor() {
  const geo = cachet('traktor', () => bokser([
    { x: 0.25, y: 0.2, z: 0, w: 0.9, h: 0.36, d: 0.5, c: F.forest },
    { x: -0.3, y: 0.2, z: 0, w: 0.5, h: 0.62, d: 0.6, c: F.forest },
    { x: -0.3, y: 0.82, z: 0, w: 0.56, h: 0.06, d: 0.66, c: F.ink },
    { x: -0.06, y: 0.46, z: 0, w: 0.04, h: 0.32, d: 0.5, c: F.glass },
    { x: 0.5, y: 0.56, z: 0.1, w: 0.06, h: 0.3, d: 0.06, c: F.ink },
    { x: 0.7, y: 0.26, z: 0, w: 0.04, h: 0.16, d: 0.4, c: F.honey },
    { x: -0.35, y: 0, z: 0.36, w: 0.56, h: 0.56, d: 0.16, c: F.ink },
    { x: -0.35, y: 0, z: -0.36, w: 0.56, h: 0.56, d: 0.16, c: F.ink },
    { x: -0.35, y: 0.2, z: 0.45, w: 0.2, h: 0.16, d: 0.02, c: F.honey },
    { x: -0.35, y: 0.2, z: -0.45, w: 0.2, h: 0.16, d: 0.02, c: F.honey },
    { x: 0.5, y: 0, z: 0.3, w: 0.3, h: 0.3, d: 0.12, c: F.ink },
    { x: 0.5, y: 0, z: -0.3, w: 0.3, h: 0.3, d: 0.12, c: F.ink }
  ]));
  return medSlag(lagMesh(geo, 1.6), 'traktor');
}

/* En stekt kyllingfilet som flyter i sausen, med grillstriper */
export function kyllingfilet(lengde) {
  const geo = cachet('filet' + lengde, () => {
    const l = [
      { x: 0, y: -0.12, z: 0, w: lengde, h: 0.26, d: 0.7, c: 0xD98A3D },
      { x: 0, y: 0.14, z: 0, w: lengde - 0.3, h: 0.06, d: 0.54, c: 0xE6A257 },
      { x: lengde / 2 - 0.08, y: -0.1, z: 0, w: 0.16, h: 0.22, d: 0.5, c: 0xC9772F },
      { x: -lengde / 2 + 0.08, y: -0.1, z: 0, w: 0.16, h: 0.22, d: 0.5, c: 0xC9772F }
    ];
    for (let x = -lengde / 2 + 0.35; x < lengde / 2 - 0.2; x += 0.42) {
      l.push({ x, y: 0.2, z: 0, w: 0.07, h: 0.01, d: 0.5, c: 0x8E3D20 });
    }
    return bokser(l);
  });
  return lagMesh(geo, lengde);
}

/* En høne som titter ut av hønsehuset (hodet flyttes opp og ned) */
export function hone() {
  const geo = cachet('hone', () => bokser([
    { x: 0, y: 0, z: 0, w: 0.26, h: 0.22, d: 0.22, c: F.creamHi },
    { x: 0.04, y: 0.22, z: 0, w: 0.16, h: 0.16, d: 0.16, c: F.creamHi },
    { x: 0.04, y: 0.38, z: 0, w: 0.1, h: 0.06, d: 0.04, c: F.paprika },
    { x: 0.14, y: 0.28, z: 0, w: 0.06, h: 0.04, d: 0.05, c: F.honey },
    { x: 0.08, y: 0.32, z: 0.081, w: 0.03, h: 0.03, d: 0.01, c: F.ink },
    { x: 0.08, y: 0.32, z: -0.081, w: 0.03, h: 0.03, d: 0.01, c: F.ink }
  ]));
  const m = new THREE.Mesh(geo, MATERIALE);
  m.castShadow = true;
  return m;
}

export function kyllingtog() {
  const geo = cachet('kyllingtog', () => {
    const l = [];
    for (let i = 0; i < 3; i++) {
      const x = -2.3 + i * 2.3;
      l.push({ x, y: 0.12, z: 0, w: 2.2, h: 0.9, d: 0.84, c: i % 2 ? F.creamHi : F.honey });
      l.push({ x, y: 0.5, z: 0.43, w: 1.7, h: 0.3, d: 0.02, c: F.glass });
      l.push({ x, y: 0.5, z: -0.43, w: 1.7, h: 0.3, d: 0.02, c: F.glass });
      l.push({ x, y: 1.02, z: 0, w: 2.22, h: 0.1, d: 0.86, c: F.paprika });
      l.push({ x, y: 0.12, z: 0.43, w: 2.2, h: 0.1, d: 0.02, c: F.paprikaDeep });
    }
    /* en stor kam på taket av lokomotivet */
    l.push({ x: 2.3, y: 1.12, z: 0, w: 0.5, h: 0.22, d: 0.12, c: F.paprika });
    l.push({ x: 3.42, y: 0.4, z: 0, w: 0.06, h: 0.45, d: 0.7, c: F.glass });
    l.push({ x: 3.5, y: 0.3, z: 0, w: 0.16, h: 0.08, d: 0.2, c: F.honeyDeep });
    return bokser(l);
  });
  return lagMesh(geo, 6.9);
}

/* ---------------------------------------------------------------------------
   BRYGGEN – trehus, fiskekasser, fiskevogner, båter, ferger og Fløibanen
   --------------------------------------------------------------------------- */
/* Et smalt trehus med gavl mot kameraet, slik husene på Bryggen ser ut */
export function bryggehusBokser(x, z, farge, h) {
  const b = 1.25, d = 0.9;
  const l = [{ x, y: 0, z, w: b, h, d, c: farge }];
  for (let i = 0; i < 4; i++) {
    l.push({ x, y: h + i * 0.16, z, w: b * (1 - i * 0.24), h: 0.16, d: d + 0.06, c: i === 3 ? F.ink : farge });
  }
  l.push({ x, y: h - 0.04, z: z + d / 2 + 0.02, w: b + 0.06, h: 0.06, d: 0.04, c: F.creamHi });
  for (const vx of [-0.3, 0.3]) {
    for (const vy of [0.3, 0.9, 1.5].filter((y) => y < h - 0.35)) {
      l.push({ x: x + vx, y: vy, z: z + d / 2 + 0.01, w: 0.24, h: 0.3, d: 0.03, c: F.creamHi });
      l.push({ x: x + vx, y: vy + 0.04, z: z + d / 2 + 0.02, w: 0.16, h: 0.22, d: 0.03, c: F.glassMork });
    }
  }
  return l;
}

export function fiskekasseBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.72, h: 0.24, d: 0.52, c: F.creamHi },
    { x, y: 0.24, z, w: 0.62, h: 0.03, d: 0.42, c: 0xDDEFF2 },
    { x: x - 0.12, y: 0.27, z: z - 0.06, w: 0.36, h: 0.07, d: 0.1, c: 0xB8C3CB },
    { x: x + 0.1, y: 0.27, z: z + 0.08, w: 0.36, h: 0.07, d: 0.1, c: 0xA3AFB8 },
    { x: x + 0.05, y: 0.29, z: z - 0.1, w: 0.08, h: 0.03, d: 0.04, c: F.ink },
    { x: x + 0.04, y: 0.34, z, w: 0.6, h: 0.18, d: 0.44, c: F.blaa, t: 0.9 },
    { x: x + 0.04, y: 0.52, z, w: 0.5, h: 0.03, d: 0.34, c: 0xDDEFF2 }
  ];
}

export function tonneBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.44, h: 0.56, d: 0.44, c: F.bark },
    { x, y: 0.08, z, w: 0.48, h: 0.05, d: 0.48, c: F.inkSoft },
    { x, y: 0.42, z, w: 0.48, h: 0.05, d: 0.48, c: F.inkSoft }
  ];
}

export function pullertBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.26, h: 0.36, d: 0.26, c: F.inkSoft },
    { x, y: 0.36, z, w: 0.34, h: 0.08, d: 0.34, c: F.ink }
  ];
}

/* Torgbod med stripete tak (utenfor spillflaten på Fisketorget) */
export function torgbodBokser(x, z, farge) {
  const l = [
    { x: x - 0.55, y: 0, z: z + 0.3, w: 0.06, h: 1.0, d: 0.06, c: F.inkSoft },
    { x: x + 0.55, y: 0, z: z + 0.3, w: 0.06, h: 1.0, d: 0.06, c: F.inkSoft },
    { x, y: 0, z, w: 1.2, h: 0.5, d: 0.5, c: F.bark },
    { x, y: 0.5, z, w: 1.1, h: 0.04, d: 0.42, c: 0xDDEFF2 }
  ];
  for (let i = 0; i < 4; i++) { l.push({ x: x - 0.45 + i * 0.3, y: 1.0, z, w: 0.3, h: 0.08, d: 0.8, c: i % 2 ? F.creamHi : farge }); }
  return l;
}

export function fiskevogn() {
  const geo = cachet('fiskevogn', () => bokser([
    { x: 0, y: 0.2, z: 0, w: 1.1, h: 0.1, d: 0.62, c: F.bark },
    { x: 0, y: 0.3, z: 0, w: 1.1, h: 0.16, d: 0.06, c: F.barkMork },
    { x: -0.15, y: 0.3, z: 0, w: 0.5, h: 0.22, d: 0.44, c: F.creamHi },
    { x: -0.15, y: 0.52, z: 0, w: 0.4, h: 0.03, d: 0.34, c: 0xDDEFF2 },
    { x: 0.32, y: 0.3, z: 0, w: 0.34, h: 0.18, d: 0.44, c: F.blaa },
    { x: -0.62, y: 0.3, z: 0.2, w: 0.3, h: 0.04, d: 0.04, c: F.bark },
    { x: -0.62, y: 0.3, z: -0.2, w: 0.3, h: 0.04, d: 0.04, c: F.bark },
    { x: 0, y: 0, z: 0.34, w: 0.34, h: 0.34, d: 0.06, c: F.ink },
    { x: 0, y: 0, z: -0.34, w: 0.34, h: 0.34, d: 0.06, c: F.ink }
  ]));
  return medSlag(lagMesh(geo, 1.2), 'fiskevogn');
}

/* Båter å hoppe på i havna: små trebåter og ferger */
export function baat(lengde) {
  const geo = cachet('baat' + lengde, () => {
    const l = [
      { x: 0, y: -0.14, z: 0, w: lengde, h: 0.3, d: 0.74, c: F.creamHi },
      { x: 0, y: -0.14, z: 0, w: lengde + 0.02, h: 0.08, d: 0.76, c: F.roed },
      { x: 0, y: 0.15, z: 0, w: lengde - 0.2, h: 0.04, d: 0.6, c: 0xC9A574 },
      { x: lengde / 2 - 0.06, y: -0.04, z: 0, w: 0.12, h: 0.22, d: 0.5, c: F.creamHi }
    ];
    if (lengde >= 2.5) {
      l.push({ x: -lengde / 2 + 0.45, y: 0.19, z: 0, w: 0.5, h: 0.34, d: 0.46, c: F.creamHi });
      l.push({ x: -lengde / 2 + 0.45, y: 0.4, z: 0.235, w: 0.36, h: 0.1, d: 0.01, c: F.glass });
      l.push({ x: -lengde / 2 + 0.45, y: 0.53, z: 0, w: 0.56, h: 0.04, d: 0.52, c: F.roed });
    }
    return bokser(l);
  });
  return lagMesh(geo, lengde);
}
export function ferge(lengde) {
  const geo = cachet('ferge' + lengde, () => bokser([
    { x: 0, y: -0.16, z: 0, w: lengde, h: 0.34, d: 0.8, c: F.creamHi },
    { x: 0, y: -0.05, z: 0, w: lengde + 0.02, h: 0.07, d: 0.82, c: F.blaa },
    { x: 0, y: 0.18, z: 0, w: lengde - 0.1, h: 0.03, d: 0.74, c: 0xBDB4A3 },
    { x: 0, y: 0.21, z: -0.3, w: lengde * 0.5, h: 0.3, d: 0.16, c: F.creamHi },
    { x: 0, y: 0.3, z: -0.215, w: lengde * 0.45, h: 0.1, d: 0.01, c: F.glass },
    { x: lengde * 0.15, y: 0.51, z: -0.3, w: 0.16, h: 0.26, d: 0.16, c: F.roed }
  ]));
  return lagMesh(geo, lengde);
}

/* Fløibanen: en rød vogn med trappetrinn-form (den går tross alt opp en fjellside) */
export function floibane() {
  const geo = cachet('floibane', () => {
    const l = [];
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6;
      l.push({ x, y: 0.12 + i * 0.08, z: 0, w: 0.62, h: 0.92, d: 0.84, c: F.roed });
      l.push({ x, y: 0.5 + i * 0.08, z: 0.43, w: 0.44, h: 0.32, d: 0.02, c: F.glass });
      l.push({ x, y: 0.5 + i * 0.08, z: -0.43, w: 0.44, h: 0.32, d: 0.02, c: F.glass });
      l.push({ x, y: 1.04 + i * 0.08, z: 0, w: 0.64, h: 0.07, d: 0.86, c: F.creamHi });
    }
    l.push({ x: 1.22, y: 0.5, z: 0, w: 0.04, h: 0.4, d: 0.7, c: F.glass });
    l.push({ x: 0, y: 0.06, z: 0, w: 2.4, h: 0.08, d: 0.6, c: F.ink });
    return bokser(l);
  });
  return lagMesh(geo, 2.5);
}

/* ---------------------------------------------------------------------------
   FABRIKKEN – maskiner, paller, trucker, trillebord, brett og stempelet
   --------------------------------------------------------------------------- */
export function maskinBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.84, h: 0.8, d: 0.66, c: 0xA9ADB2 },
    { x, y: 0.8, z, w: 0.6, h: 0.18, d: 0.5, c: 0x8E9196 },
    { x, y: 0.05, z: z + 0.34, w: 0.84, h: 0.1, d: 0.02, c: F.honey },
    { x: x + 0.2, y: 0.42, z: z + 0.335, w: 0.24, h: 0.2, d: 0.02, c: F.ink },
    { x: x + 0.14, y: 0.5, z: z + 0.345, w: 0.05, h: 0.05, d: 0.01, c: F.roed },
    { x: x + 0.26, y: 0.5, z: z + 0.345, w: 0.05, h: 0.05, d: 0.01, c: F.lovLys }
  ];
}

export function pallBokser(x, z) {
  return [
    { x, y: 0, z, w: 0.8, h: 0.1, d: 0.62, c: 0xC9A574 },
    { x: x - 0.18, y: 0.1, z, w: 0.38, h: 0.3, d: 0.5, c: 0xC69A6B },
    { x: x + 0.2, y: 0.1, z, w: 0.36, h: 0.3, d: 0.5, c: 0xBF925F },
    { x, y: 0.4, z, w: 0.4, h: 0.26, d: 0.46, c: 0xC69A6B },
    { x, y: 0.47, z: z + 0.235, w: 0.4, h: 0.06, d: 0.01, c: F.honey },
    { x: x - 0.18, y: 0.2, z: z + 0.255, w: 0.38, h: 0.06, d: 0.01, c: F.honey }
  ];
}

/* En lang vegg med reklame på (tekstur legges på av verdenen) */
export function reklameveggBokser(x, z) {
  return [
    { x: x - 0.9, y: 0, z, w: 0.12, h: 1.9, d: 0.12, c: F.inkSoft },
    { x: x + 0.9, y: 0, z, w: 0.12, h: 1.9, d: 0.12, c: F.inkSoft },
    { x, y: 0.9, z: z - 0.06, w: 2.0, h: 0.95, d: 0.1, c: F.ink }
  ];
}

export function truck() {
  const geo = cachet('truck', () => bokser([
    { x: -0.15, y: 0.14, z: 0, w: 0.9, h: 0.4, d: 0.64, c: F.honey },
    { x: -0.42, y: 0.54, z: 0, w: 0.34, h: 0.2, d: 0.6, c: F.honeyDeep },
    { x: -0.1, y: 0.54, z: 0.27, w: 0.05, h: 0.56, d: 0.05, c: F.ink },
    { x: -0.1, y: 0.54, z: -0.27, w: 0.05, h: 0.56, d: 0.05, c: F.ink },
    { x: -0.15, y: 1.1, z: 0, w: 0.5, h: 0.05, d: 0.6, c: F.ink },
    { x: 0.36, y: 0.1, z: 0, w: 0.08, h: 1.2, d: 0.5, c: F.inkSoft },
    { x: 0.58, y: 0.14, z: 0.16, w: 0.44, h: 0.04, d: 0.08, c: F.inkSoft },
    { x: 0.58, y: 0.14, z: -0.16, w: 0.44, h: 0.04, d: 0.08, c: F.inkSoft },
    { x: 0.62, y: 0.18, z: 0, w: 0.36, h: 0.3, d: 0.46, c: 0xC69A6B },
    hjul(0.18, 0.33), hjul(0.18, -0.33), hjul(-0.45, 0.33), hjul(-0.45, -0.33)
  ]));
  return medSlag(lagMesh(geo, 1.6), 'truck');
}

export function trillebord() {
  const geo = cachet('trillebord', () => bokser([
    { x: 0, y: 0.1, z: 0, w: 0.04, h: 0.6, d: 0.04, c: 0xA9ADB2 },
    { x: -0.4, y: 0.06, z: 0.24, w: 0.04, h: 0.64, d: 0.04, c: 0xA9ADB2 },
    { x: 0.4, y: 0.06, z: 0.24, w: 0.04, h: 0.64, d: 0.04, c: 0xA9ADB2 },
    { x: -0.4, y: 0.06, z: -0.24, w: 0.04, h: 0.64, d: 0.04, c: 0xA9ADB2 },
    { x: 0.4, y: 0.06, z: -0.24, w: 0.04, h: 0.64, d: 0.04, c: 0xA9ADB2 },
    { x: 0, y: 0.2, z: 0, w: 0.9, h: 0.04, d: 0.56, c: 0xC9CDD2 },
    { x: 0, y: 0.66, z: 0, w: 0.9, h: 0.04, d: 0.56, c: 0xC9CDD2 },
    { x: -0.15, y: 0.7, z: 0, w: 0.36, h: 0.08, d: 0.3, c: 0xD98A3D },
    { x: 0.22, y: 0.7, z: 0.05, w: 0.28, h: 0.08, d: 0.24, c: F.paprika },
    { x: -0.4, y: 0, z: 0.24, w: 0.08, h: 0.08, d: 0.08, c: F.ink },
    { x: 0.4, y: 0, z: 0.24, w: 0.08, h: 0.08, d: 0.08, c: F.ink },
    { x: -0.4, y: 0, z: -0.24, w: 0.08, h: 0.08, d: 0.08, c: F.ink },
    { x: 0.4, y: 0, z: -0.24, w: 0.08, h: 0.08, d: 0.08, c: F.ink }
  ]));
  return medSlag(lagMesh(geo, 1.0), 'trillebord');
}

/* Stålbrett på samlebåndet (kyllingen kan stå på dem) */
export function brett(lengde) {
  const geo = cachet('brett' + lengde, () => {
    const l = [
      { x: 0, y: -0.12, z: 0, w: lengde, h: 0.22, d: 0.72, c: 0xB9BDC2 },
      { x: 0, y: 0.1, z: 0.33, w: lengde, h: 0.06, d: 0.06, c: 0xD5D8DC },
      { x: 0, y: 0.1, z: -0.33, w: lengde, h: 0.06, d: 0.06, c: 0xD5D8DC }
    ];
    for (let x = -lengde / 2 + 0.4; x < lengde / 2 - 0.2; x += 0.7) {
      l.push({ x, y: 0.1, z: 0, w: 0.34, h: 0.06, d: 0.26, c: 0xD98A3D });
    }
    return bokser(l);
  });
  return lagMesh(geo, lengde);
}

/* Stempelet: et tungt hode over hele raden (spillflaten) */
export function stempelHode(bredde) {
  const geo = cachet('stempel' + bredde, () => bokser([
    { x: 0, y: 0, z: 0, w: bredde, h: 0.36, d: 0.9, c: 0x8E9196 },
    { x: 0, y: 0.36, z: 0, w: bredde - 0.3, h: 0.12, d: 0.7, c: 0x6E7176 },
    { x: 0, y: 0.08, z: 0.455, w: bredde, h: 0.1, d: 0.01, c: F.honey }
  ]));
  /* Eget materiale, så stempelet kan tones ned når kyllingen står under/foran det */
  const mat = MATERIALE.clone();
  mat.transparent = true;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/* ---------------------------------------------------------------------------
   TRENINGSSENTERET – manualer, benker, baller, vektskiver og vektstang
   --------------------------------------------------------------------------- */
export function manualBokser(x, z) {
  const l = [
    { x, y: 0, z, w: 0.8, h: 0.08, d: 0.36, c: F.ink },
    { x: x - 0.36, y: 0.08, z, w: 0.06, h: 0.24, d: 0.3, c: F.inkSoft },
    { x: x + 0.36, y: 0.08, z, w: 0.06, h: 0.24, d: 0.3, c: F.inkSoft }
  ];
  for (const dx of [-0.2, 0.08]) {
    l.push({ x: x + dx + 0.06, y: 0.12, z, w: 0.04, h: 0.04, d: 0.3, c: 0xA9ADB2 });
    l.push({ x: x + dx + 0.06, y: 0.06, z: z - 0.13, w: 0.14, h: 0.16, d: 0.07, c: F.ink });
    l.push({ x: x + dx + 0.06, y: 0.06, z: z + 0.13, w: 0.14, h: 0.16, d: 0.07, c: F.ink });
  }
  return l;
}

export function treningsbenkBokser(x, z) {
  return [
    { x: x - 0.3, y: 0, z, w: 0.08, h: 0.26, d: 0.3, c: 0xA9ADB2 },
    { x: x + 0.3, y: 0, z, w: 0.08, h: 0.26, d: 0.3, c: 0xA9ADB2 },
    { x, y: 0.26, z, w: 0.86, h: 0.12, d: 0.3, c: F.ink },
    { x: x - 0.1, y: 0.38, z, w: 0.6, h: 0.02, d: 0.26, c: F.inkSoft }
  ];
}

export function ballBokser(x, z, farge) {
  return [
    { x, y: 0.02, z, w: 0.44, h: 0.6, d: 0.44, c: farge },
    { x, y: 0.1, z, w: 0.6, h: 0.44, d: 0.6, c: farge },
    { x: x - 0.06, y: 0.5, z: z + 0.1, w: 0.12, h: 0.08, d: 0.12, c: F.creamHi, t: 1.1 }
  ];
}

/* Vektskive som triller: en skive i x/y-planet, snurrer rundt z */
export function vektskive(farge) {
  const R = 0.42;
  return rullende('skive' + farge, () => bokser([
    { x: 0, y: -R, z: 0, w: R * 0.8, h: R * 2, d: 0.18, c: farge },
    { x: 0, y: -R * 0.8, z: 0, w: R * 1.6, h: R * 1.6, d: 0.18, c: farge },
    { x: 0, y: -R * 0.4, z: 0, w: R * 2, h: R * 0.8, d: 0.18, c: farge },
    { x: 0, y: -R * 0.55, z: 0, w: R * 0.3, h: R * 1.1, d: 0.2, c: F.creamHi, t: 0.9 },
    { x: 0, y: -0.08, z: 0, w: 0.16, h: 0.16, d: 0.3, c: 0xA9ADB2 }
  ]), R, R * 2 + 0.05, 'vektskive');
}

export function treningsball(farge) {
  const R = 0.46;
  return rullende('ball' + farge, () => bokser([
    { x: 0, y: -R, z: 0, w: R, h: R * 2, d: R, c: farge },
    { x: 0, y: -R * 0.75, z: 0, w: R * 1.7, h: R * 1.5, d: R * 1.7, c: farge },
    { x: 0, y: -R * 0.35, z: 0, w: R * 2, h: R * 0.7, d: R * 2, c: farge },
    { x: 0, y: -0.05, z: 0, w: R * 2.02, h: 0.1, d: R * 0.4, c: F.creamHi }
  ]), R, R * 2, 'ball');
}

/* Vektstanga som sklir over gulvet (Treningssenterets bybane) */
export function vektstang() {
  const geo = cachet('vektstang', () => {
    const l = [{ x: 0, y: 0.42, z: 0, w: 4.4, h: 0.08, d: 0.08, c: 0xC9CDD2 }];
    for (const s of [-1, 1]) {
      l.push({ x: s * 1.75, y: 0, z: 0, w: 0.2, h: 0.92, d: 0.92, c: F.roed });
      l.push({ x: s * 1.95, y: 0.06, z: 0, w: 0.16, h: 0.8, d: 0.8, c: F.blaa });
      l.push({ x: s * 2.1, y: 0.12, z: 0, w: 0.12, h: 0.68, d: 0.68, c: F.gul });
      l.push({ x: s * 1.6, y: 0.36, z: 0, w: 0.1, h: 0.2, d: 0.2, c: 0xA9ADB2 });
    }
    return bokser(l);
  });
  return lagMesh(geo, 4.4);
}

/* ---------------------------------------------------------------------------
   KRAFTPAKKER – større enn vanlige pakker, med en glorie rundt
   skjold: Original (grønn), fart: Sweet Paprika (rød med lyn), magnet: matboks
   --------------------------------------------------------------------------- */
export function kraftpakke(slag) {
  const g = new THREE.Group();
  if (slag === 'magnet') {
    g.add(new THREE.Mesh(cachet('matboks', () => bokser([
      { x: 0, y: 0, z: 0, w: 0.56, h: 0.36, d: 0.36, c: F.honey },
      { x: 0, y: 0.36, z: 0, w: 0.58, h: 0.06, d: 0.38, c: F.honeyDeep },
      { x: -0.16, y: 0.42, z: 0, w: 0.05, h: 0.12, d: 0.05, c: F.ink },
      { x: 0.16, y: 0.42, z: 0, w: 0.05, h: 0.12, d: 0.05, c: F.ink },
      { x: 0, y: 0.52, z: 0, w: 0.37, h: 0.05, d: 0.05, c: F.ink },
      { x: 0, y: 0.12, z: 0.185, w: 0.3, h: 0.12, d: 0.01, c: F.creamHi }
    ])), MATERIALE));
  } else {
    const m = pakke(slag === 'fart' ? 'paprika' : 'original');
    m.scale.setScalar(1.25);
    g.add(m);
    if (slag === 'fart') {
      g.add(new THREE.Mesh(cachet('lyn', () => bokser([
        { x: 0.12, y: 0.62, z: 0.06, w: 0.08, h: 0.12, d: 0.02, c: F.honey },
        { x: 0.06, y: 0.52, z: 0.06, w: 0.12, h: 0.06, d: 0.02, c: F.honey },
        { x: 0.0, y: 0.4, z: 0.06, w: 0.08, h: 0.12, d: 0.02, c: F.honey }
      ])), MATERIALE));
    }
  }
  const farge = slag === 'skjold' ? F.forest : slag === 'fart' ? F.paprika : F.honey;
  g.add(new THREE.Mesh(cachet('glorie' + farge, () => bokser([
    { x: 0, y: -0.15, z: 0.42, w: 0.9, h: 0.04, d: 0.06, c: farge },
    { x: 0, y: -0.15, z: -0.42, w: 0.9, h: 0.04, d: 0.06, c: farge },
    { x: 0.42, y: -0.15, z: 0, w: 0.06, h: 0.04, d: 0.9, c: farge },
    { x: -0.42, y: -0.15, z: 0, w: 0.06, h: 0.04, d: 0.9, c: farge }
  ])), MATERIALE));
  g.children.forEach((c) => { c.castShadow = true; });
  return g;
}

/* Skjoldet rundt kyllingen: en tynn grønn ramme */
export function skjoldRamme() {
  const m = new THREE.Mesh(cachet('skjold', () => bokser([
    { x: 0, y: 0, z: 0.36, w: 0.8, h: 0.05, d: 0.05, c: F.lovLys },
    { x: 0, y: 0, z: -0.36, w: 0.8, h: 0.05, d: 0.05, c: F.lovLys },
    { x: 0.38, y: 0, z: 0, w: 0.05, h: 0.05, d: 0.76, c: F.lovLys },
    { x: -0.38, y: 0, z: 0, w: 0.05, h: 0.05, d: 0.76, c: F.lovLys },
    { x: 0.38, y: 0, z: 0.36, w: 0.06, h: 1.0, d: 0.06, c: F.lovLys },
    { x: -0.38, y: 0, z: 0.36, w: 0.06, h: 1.0, d: 0.06, c: F.lovLys },
    { x: 0.38, y: 0, z: -0.36, w: 0.06, h: 1.0, d: 0.06, c: F.lovLys },
    { x: -0.38, y: 0, z: -0.36, w: 0.06, h: 1.0, d: 0.06, c: F.lovLys }
  ])), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }));
  return m;
}
