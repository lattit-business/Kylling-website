/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — VOXEL-VERKTØY
   Alt i spillet er bygget av klosser. For at det skal gå raskt, slås alle
   klossene i én modell sammen til én geometri med farger i hjørnene
   (vertexColors), så hver modell blir ett eneste tegnekall.
   ============================================================================= */
import * as THREE from '../vendor/three.module.min.js';

/* Fargene fra nettsiden, pluss noen få som trengs i en by (vei, vann, gress). */
export const F = {
  ink: 0x11110F, inkSoft: 0x3A3A34, cream: 0xF3F0E9, creamHi: 0xFAF8F3, beige: 0xE8E1D5,
  honey: 0xF1B240, honeyDeep: 0xD99A26, forest: 0x334D29, forestDeep: 0x24371D,
  paprika: 0xB5502C, paprikaDeep: 0x8E3D20, sage: 0xAAB39D,
  gress: 0x9DBA5F, gressMork: 0x8AAA4E, park: 0xA9C46A,
  vei: 0x4A4A47, veiMork: 0x3F3F3C, stripe: 0xF3F0E9, fortau: 0xCFC7B8, fortauMork: 0xBDB4A3,
  vann: 0x5FA3B5, vannMork: 0x4E8FA1, skum: 0xE6F2F2,
  bark: 0x7A5233, barkMork: 0x5E3E25, lov: 0x5E8C3A, lovLys: 0x77A447, lovMork: 0x4A7430,
  stein: 0x9C988E, skinne: 0x8C8C86, sville: 0x6E5640,
  glass: 0x9CC7D1, glassMork: 0x6FA3B0, hvit: 0xFFFFFF,
  roed: 0xC9483A, blaa: 0x4F7CAC, gul: 0xE9C24A, lilla: 0x8A6FB0, rosa: 0xE79AA6, oransje: 0xE07B39
};

const farge = new THREE.Color();

/* Grunnflatene til en kube: normal + fire hjørner (mot klokka sett utenfra). */
const SIDER = [
  { n: [1, 0, 0],  v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], lys: 0.86 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], lys: 0.86 },
  { n: [0, 1, 0],  v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], lys: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], lys: 0.6 },
  { n: [0, 0, 1],  v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], lys: 0.94 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], lys: 0.94 }
];

/* Samler flater og lager en BufferGeometry til slutt. */
class Bygger {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; }
  flate(side, x, y, z, sx, sy, sz, hex, toning) {
    const start = this.pos.length / 3;
    farge.setHex(hex);
    const k = side.lys * (toning || 1);
    for (const v of side.v) {
      this.pos.push(x + v[0] * sx, y + v[1] * sy, z + v[2] * sz);
      this.nor.push(side.n[0], side.n[1], side.n[2]);
      this.col.push(farge.r * k, farge.g * k, farge.b * k);
    }
    this.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  geometri() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/* bokser([{ x, y, z, w, h, d, c, t }]) → én geometri.
   x/z er sentrum, y er bunnen. c er fargen, t en valgfri toning (0–1). */
export function bokser(liste) {
  const b = new Bygger();
  for (const k of liste) {
    const x0 = k.x - k.w / 2, z0 = k.z - k.d / 2;
    for (let i = 0; i < 6; i++) {
      if (k.uten && k.uten.includes(i)) { continue; }
      b.flate(SIDER[i], x0, k.y, z0, k.w, k.h, k.d, k.c, k.t);
    }
  }
  return b.geometri();
}

/* Felles materiale for alt med fargede hjørner. */
export const MATERIALE = new THREE.MeshLambertMaterial({ vertexColors: true });

export function modell(liste, skygge = true) {
  const m = new THREE.Mesh(bokser(liste), MATERIALE);
  m.castShadow = skygge;
  m.receiveShadow = true;
  return m;
}

/* Voxelnett: rutenett[x][y][z] = farge eller 0. Bare flater som vender mot en
   tom nabo tegnes, så selv tusenvis av voxler blir en lett modell. */
export function voxelGeometri(nett, str, opphav) {
  const b = new Bygger();
  const nx = nett.length, ny = nett[0].length, nz = nett[0][0].length;
  const fyll = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz && nett[x][y][z];
  const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        const c = nett[x][y][z];
        if (!c) { continue; }
        for (let i = 0; i < 6; i++) {
          if (fyll(x + N[i][0], y + N[i][1], z + N[i][2])) { continue; }
          b.flate(SIDER[i], (x - opphav[0]) * str, (y - opphav[1]) * str, (z - opphav[2]) * str, str, str, str, c);
        }
      }
    }
  }
  return b.geometri();
}

/* ---------------------------------------------------------------------------
   LOGOKYLLINGEN
   Logoen på nettsiden (stien fra wordmark-SVG-en) tegnes ut på et lite lerret,
   og hver piksel blir en voxel: streken blir sverte, innsiden krem. Kammen
   blir paprika, nebbet og beina honning, og dybden varierer så den blir en
   ordentlig figur og ikke en pappfigur. Retningen: nebbet peker mot +x.
   --------------------------------------------------------------------------- */
const LOGO_STIER = [
  'M63.5 4c2.5-4 7.5-3 9 1.5 2.5-4 8-3 8.5 1.5 4-1.5 8 1.5 6.5 6 3 2.5 4.5 6 4.5 9.5l7.5 3.5-9 4.5',
  'M90 30.5c-1 4.5-1.5 8-1.5 12.5v15.5C88.5 73.5 77 85 62.5 85h-16C32 85 20.5 73.5 20.5 59c0-1 0-2 .2-3',
  'M21.5 61.5L2 56.5l19-12L1.5 29l25 4.5c12.5 2 24-.5 32-6.5 3.5-2.5 5.5-6.5 5.5-11',
  'M39.5 84.5V97h-8.5M60.5 84.5V97h8.5'
];
/* Usynlige streker som lukker figuren, så innsiden kan fylles (logoen er åpen
   bak hodet og ved halen). */
const LUKK = 'M64 16L63.5 4M20.7 56L21.5 61.5';

export function logoKylling() {
  const R = 26;                      /* oppløsning: R × R voxler for sideprofilen */
  const S = R / 108;                 /* logoen bor i ca. -4..104 */
  const lerret = document.createElement('canvas');
  lerret.width = R; lerret.height = R;
  const g = lerret.getContext('2d', { willReadFrequently: true });
  const tegn = (bredde, farge, ekstra) => {
    g.clearRect(0, 0, R, R);
    g.save();
    g.scale(S, S); g.translate(4, 4);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = bredde; g.strokeStyle = farge;
    for (const d of LOGO_STIER) { g.stroke(new Path2D(d)); }
    if (ekstra) { g.stroke(new Path2D(LUKK)); }
    g.restore();
    return g.getImageData(0, 0, R, R).data;
  };
  const strek = tegn(6, '#000');
  const lukket = tegn(6, '#000', true);
  /* Øyet */
  g.clearRect(0, 0, R, R);
  g.save(); g.scale(S, S); g.translate(4, 4); g.beginPath(); g.arc(75.5, 18.5, 4.6, 0, Math.PI * 2); g.fill(); g.restore();
  const oye = g.getImageData(0, 0, R, R).data;

  const er = (data, x, y) => data[(y * R + x) * 4 + 3] > 90;
  /* Flomfyll utenfra: det som ikke nås, er innsiden av kyllingen */
  const ute = Array.from({ length: R }, () => new Array(R).fill(false));
  const ko = [];
  for (let i = 0; i < R; i++) { ko.push([i, 0], [i, R - 1], [0, i], [R - 1, i]); }
  while (ko.length) {
    const [x, y] = ko.pop();
    if (x < 0 || y < 0 || x >= R || y >= R || ute[x][y] || er(lukket, x, y)) { continue; }
    ute[x][y] = true;
    ko.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const D = 13;                      /* dybde i voxler */
  const nett = Array.from({ length: R }, () => Array.from({ length: R }, () => new Array(D).fill(0)));
  for (let x = 0; x < R; x++) {
    for (let y = 0; y < R; y++) {
      const s = er(strek, x, y), inne = !ute[x][y] && !s;
      if (!s && !inne) { continue; }
      /* logo-y vokser nedover; voxel-y vokser oppover */
      const vy = R - 1 - y;
      const lx = x / S - 4, ly = y / S - 4;   /* tilbake til logo-enheter */
      let c = F.creamHi;
      let bredde = D;                          /* hvor mange voxler i dybden */
      let kant = s;                            /* logostreken: sverte ytterst på sidene */
      if (ly > 84) { c = F.honeyDeep; bredde = 3; kant = false; }                  /* bein */
      else if (ly < 11 && lx > 58 && lx < 92) { c = F.paprika; bredde = 3; kant = false; } /* kam */
      else if (lx > 91.5) { c = F.honey; bredde = 5; kant = false; }               /* nebb */
      else if (lx < 22) { bredde = 9; }                                            /* hale */
      const z0 = Math.floor((D - bredde) / 2);
      for (let z = z0; z < z0 + bredde; z++) {
        /* Streken i logoen ligger på begge sidene av kyllingen (som tegningen),
           mens toppen og ryggen er krem med en tynn sverte-kant. */
        const ytterst = z === z0 || z === z0 + bredde - 1;
        nett[x][vy][z] = kant && (ytterst || bredde < D) ? F.ink : c;
      }
    }
  }
  /* Øyet på begge sider av hodet (tvers gjennom) */
  for (let x = 0; x < R; x++) {
    for (let y = 0; y < R; y++) {
      if (er(oye, x, y) && !er(strek, x, y)) {
        for (let z = 0; z < D; z++) { if (nett[x][R - 1 - y][z]) { nett[x][R - 1 - y][z] = F.ink; } }
      }
    }
  }
  const str = 0.98 / R;               /* hele kyllingen er nesten en rute bred */
  return voxelGeometri(nett, str, [R / 2, 0, D / 2]);
}
