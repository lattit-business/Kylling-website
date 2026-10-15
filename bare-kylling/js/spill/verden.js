/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — VERDENEN
   Verden er en rekke rader (rad r ligger på z = −r). Hver rad er gress, park,
   fortau, vei, elv eller bybane. Radene lages etter hvert som kyllingen går
   framover, og fjernes når de er langt bak. Alt som står stille i en rad, slås
   sammen til én modell; biler og tømmerstokker er egne modeller som flyttes.

   Rettferdighet: det finnes alltid en åpen sti gjennom hindringene, det er
   alltid luft mellom bilene, og hullene mellom stokkene er aldri for store.
   Vanskeligheten øker jevnt med avstanden (vanske()).

   Bare Kylling-pakker: noen rader på land har en pakke som kan plukkes opp.
   Det er aldri mer enn én pakke per rad, så antall pakker kan aldri bli
   høyere enn hvor langt du kom (serveren sjekker det).
   ============================================================================= */
import * as THREE from '../vendor/three.module.min.js';
import { F, modell } from './voxel.js';
import * as M from './modeller.js';

export const KOL = 4;            /* spillbare kolonner: −4 … 4 */
export const JOBB = 60;          /* raden der Jobbsenteret står */
const VID = 14;                  /* hvor bred bakken tegnes (halv bredde) */
const SYKLUS = 26;               /* kjøretøy og stokker går i ring over denne lengden */

/* Frøbasert tilfeldighet, så samme frø gir samme verden */
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

/* Kylling Verden: en egen kyllingby fra rett etter Jobbsenteret til rad 250 */
export const KV = { fra: JOBB + 3, til: 250 };
export const iKV = (r) => r >= KV.fra && r <= KV.til;
const KV_BILER = [F.honey, F.paprika, F.forest, F.creamHi, F.honeyDeep];

export const vanske = (r) => Math.max(0, Math.min(1, (r - 4) / 130));
const mellom = (a, b, t) => a + (b - a) * t;
const BILFARGER = [F.roed, F.blaa, F.gul, F.creamHi, F.sage, F.paprika, F.inkSoft, F.oransje, F.lilla];

export class Verden {
  constructor(scene, teksturer, reklame, frø) {
    this.scene = scene;
    this.tex = teksturer;
    this.reklame = reklame;
    this.rng = lagRng(frø);
    /* Egen tilfeldighet for pakkene, så de ikke endrer resten av verdenen */
    this.pakkeRng = lagRng((frø ^ 0x9E3779B9) >>> 0);
    this.rader = new Map();
    this.plan = [];            /* kommende rader (spesifikasjoner) */
    this.neste = -10;          /* neste rad som skal planlegges */
    this.laget = -11;          /* høyeste rad som er bygget */
    this.sti = 0;              /* kolonnen som alltid holdes åpen gjennom gresset */
    this.forrigeBlokk = '';
    this.tavler = 0;
    this.harEgg = false;
    this.tid = 0;
  }

  /* ---------------------------------------------------------------------------
     PLANLEGGING – hvilke rader kommer, i blokker
     --------------------------------------------------------------------------- */
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

  leggTil(spek) {
    spek.rad = this.neste++;
    this.plan.push(spek);
  }

  /* Sørger for at radene fra «fra» til «til» finnes, og fjerner de som er bak */
  sikre(fra, til) {
    while (this.laget < til) {
      while (!this.plan.length) { this.planlegg(); }
      const spek = this.plan.shift();
      this.bygg(spek);
      this.laget = spek.rad;
    }
    for (const [r, rad] of this.rader) {
      if (r < fra) { this.fjernRad(rad); this.rader.delete(r); }
    }
  }

  fjernRad(rad) {
    this.scene.remove(rad.gruppe);
    if (rad.statisk) { rad.statisk.geometry.dispose(); }
  }

  fjernAlt() {
    for (const rad of this.rader.values()) { this.fjernRad(rad); }
    this.rader.clear();
  }

  /* ---------------------------------------------------------------------------
     BYGGING AV EN RAD
     --------------------------------------------------------------------------- */
  bygg(spek) {
    const r = spek.rad, z = -r, rng = this.rng, d = vanske(r), kv = iKV(r);
    const rad = { rad: r, type: spek.type, blokk: new Set(), flytt: [], fart: 0, gruppe: new THREE.Group(), spek };
    const l = [];                         /* klosser som slås sammen */
    const lys = r % 2 === 0;

    const bakke = (farge, y, h, fargeKant) => {
      l.push({ x: 0, y: y - h, z, w: KOL * 2 + 1, h, d: 1, c: farge });
      l.push({ x: -(KOL + 0.5 + (VID - KOL - 0.5) / 2), y: y - h, z, w: VID - KOL - 0.5, h, d: 1, c: fargeKant || farge, t: 0.8 });
      l.push({ x: KOL + 0.5 + (VID - KOL - 0.5) / 2, y: y - h, z, w: VID - KOL - 0.5, h, d: 1, c: fargeKant || farge, t: 0.8 });
    };
    const kantPynt = (lag) => {           /* trær og busker utenfor spillflaten */
      for (const s of [-1, 1]) {
        for (let x = KOL + 1; x <= VID - 1; x++) {
          if (rng() < 0.55) { lag(s * x, rng()); }
        }
      }
    };
    const hindring = (x, v) => {
      if (kv) {
        l.push(...(v < 0.4 ? M.honsehusBokser(x, z) : v < 0.62 ? M.siloBokser(x, z) : v < 0.82 ? M.halmBokser(x, z) : M.eggBokser(x, z)));
        rad.blokk.add(x);
        return;
      }
      if (v < 0.52) { l.push(...M.treBokser(x, z, Math.floor(rng() * 3))); }
      else if (v < 0.8) { l.push(...M.buskBokser(x, z)); }
      else { l.push(...M.steinBokser(x, z)); }
      rad.blokk.add(x);
    };

    switch (spek.type) {
      case 'plass':
      case 'start': {
        bakke(lys ? F.fortau : F.fortauMork, 0, 0.6);
        for (let x = -VID + 1; x < VID; x += 1) { l.push({ x: x + 0.5, y: 0, z, w: 0.04, h: 0.01, d: 1, c: F.fortauMork }); }
        if (spek.type === 'plass' && r <= -3) { l.splice(0, l.length); bakke(lys ? F.gress : F.gressMork, 0, 0.6); }
        if (spek.type === 'plass') {
          /* Bak start: blomsterkasser og hus. Hit kommer du ikke. */
          for (let x = -VID; x <= VID; x++) { rad.blokk.add(x); }
          if (r === -2) {
            for (let x = -KOL; x <= KOL; x += 2) {
              l.push({ x, y: 0, z, w: 1.3, h: 0.28, d: 0.5, c: F.bark });
              l.push(...M.blomsterBokser(x, z, rng));
            }
          } else if (r <= -3) {
            /* en liten park bak butikken */
            for (let x = -VID + 1; x < VID; x++) {
              const v = rng();
              if (v < 0.3) { l.push(...M.treBokser(x, z, Math.floor(rng() * 3))); }
              else if (v < 0.45) { l.push(...M.buskBokser(x, z)); }
              else if (v < 0.6) { l.push(...M.blomsterBokser(x, z, rng)); }
            }
          }
        } else {
          /* Startplassen: butikken til venstre, varebilen og en reklametavle til høyre */
          for (let x = -VID; x <= -KOL; x++) { rad.blokk.add(x); }
          if (r === 0) {
            const b = M.butikk(this.tex);
            b.position.set(-5.65, 0, -1.3);
            rad.gruppe.add(b);
            const t = M.reklametavle(this.reklame.tex, 2.8);
            t.position.set(7.2, 0, -1.2);
            rad.gruppe.add(t);
            l.push(...M.lyktBokser(KOL + 0.8, z + 0.3));
            l.push(...M.benkBokser(2.4, z + 0.2));
          }
          if (r === 2) {
            const v = M.varebil(this.tex);
            v.position.set(3.6, 0, z);
            rad.gruppe.add(v);
            rad.blokk.add(3); rad.blokk.add(4);
            l.push(...M.soppelBokser(-3.2, z));
            rad.blokk.add(-3);
          }
          if (r === 1) { l.push(...M.skiltBokser(KOL + 0.9, z, F.blaa)); }
        }
        break;
      }

      case 'gress':
      case 'park': {
        const park = spek.type === 'park';
        if (kv) { bakke(park ? (lys ? 0xF0CF7A : 0xE9C36A) : (lys ? 0xE9C36A : 0xDDB55A), 0, 0.6, 0xD7AD52); }
        else { bakke(park ? (lys ? F.park : F.gress) : (lys ? F.gress : F.gressMork), 0, 0.6); }
        kantPynt((x, v) => {
          if (kv) {
            l.push(...(v < 0.3 ? M.siloBokser(x, z) : v < 0.55 ? M.honsehusBokser(x, z) : v < 0.8 ? M.halmBokser(x, z) : M.eggBokser(x, z)));
            return;
          }
          if (park && v < 0.25) { l.push(...M.benkBokser(x, z)); }
          else if (v < 0.6) { l.push(...M.treBokser(x, z, Math.floor(rng() * 3))); }
          else if (v < 0.85) { l.push(...M.buskBokser(x, z)); }
          else { l.push(...M.blomsterBokser(x, z, rng)); }
        });
        /* Hindringer på spillflaten, men stien holdes åpen */
        if (rng() < 0.45) { this.sti = Math.max(-KOL + 1, Math.min(KOL - 1, this.sti + (rng() < 0.5 ? -1 : 1))); }
        const tetthet = spek.lett ? 0.1 : mellom(park ? 0.12 : 0.2, park ? 0.22 : 0.34, d);
        let antall = 0;
        for (let x = -KOL; x <= KOL; x++) {
          if (Math.abs(x - this.sti) <= 0 || antall >= 4) { continue; }
          if (rng() < tetthet) { hindring(x, rng()); antall++; }
          else if (park && !kv && rng() < 0.3) { l.push(...M.blomsterBokser(x, z, rng)); }
        }
        if (park && !this.harEgg && r > 14 && rng() < 0.5) {
          /* Påskeegget: et kjempeegg med et skilt (hva kom først?) */
          this.harEgg = true;
          l.push({ x: 6.2, y: 0, z, w: 0.9, h: 1.1, d: 0.8, c: F.creamHi },
                 { x: 6.2, y: 1.1, z, w: 0.6, h: 0.3, d: 0.55, c: F.creamHi },
                 { x: 6.2, y: 0.3, z: z + 0.41, w: 0.3, h: 0.08, d: 0.02, c: F.honey });
          const skilt = M.skiltPlate(M.lappSkilt('Hva kom\nførst?', F.creamHi, F.ink), 1.1, 0.42);
          skilt.position.set(7.6, 0.9, z + 0.2);
          rad.gruppe.add(skilt);
          l.push({ x: 7.6, y: 0, z, w: 0.08, h: 0.7, d: 0.08, c: F.bark });
        }
        break;
      }

      case 'fortau': {
        bakke(kv ? (lys ? F.creamHi : F.beige) : (lys ? F.fortau : F.fortauMork), 0, 0.6);
        for (let x = -VID + 1; x < VID; x += 1) { l.push({ x: x + 0.5, y: 0, z, w: 0.04, h: 0.01, d: 1, c: F.fortauMork }); }
        const kz = spek.kant === 'foran' ? z - 0.46 : z + 0.46;   /* kantstein mot veien */
        if (spek.kant) { l.push({ x: 0, y: 0, z: kz, w: VID * 2, h: 0.06, d: 0.08, c: F.stein }); }
        l.push(...M.lyktBokser(-KOL - 0.7, z));
        if (rng() < 0.5) { l.push(...M.skiltBokser(KOL + 0.7, z, [F.blaa, F.roed, F.honey][Math.floor(rng() * 3)])); }
        /* Hus og butikker langs fortauet, utenfor spillflaten */
        for (const s of [-1, 1]) {
          for (let x = KOL + 2.5; x < VID; x += 2.6) {
            if (rng() < 0.7) {
              l.push(...M.husBokser(s * x, z - 0.1, 2.2, 0.8, 1.2 + rng() * 1.0,
                kv ? [F.honey, F.paprika, F.forest, F.creamHi][Math.floor(rng() * 4)] : [F.creamHi, F.roed, F.gul, F.beige, F.sage, F.blaa][Math.floor(rng() * 6)],
                kv ? F.ink : F.inkSoft));
            }
          }
        }
        if (spek.jobb && r === JOBB - 2) {
          const skilt = M.skiltPlate(M.lappSkilt('Jobbsenteret\nrett fram ↑', F.forest, F.creamHi), 1.4, 0.55);
          skilt.position.set(KOL + 1.2, 1.2, z + 0.3);
          rad.gruppe.add(skilt);
          l.push({ x: KOL + 1.2, y: 0, z, w: 0.08, h: 0.95, d: 0.08, c: F.inkSoft });
        } else if ((this.tavler < 8 && rng() < 0.32) || spek.jobb) {
          this.tavler++;
          const t = M.reklametavle(this.reklame.tex, 2.4);
          t.position.set((rng() < 0.5 ? -1 : 1) * (KOL + 3.2), 0, z - 0.1);
          rad.gruppe.add(t);
        }
        /* Av og til en benk eller søppelkasse på selve fortauet */
        if (!spek.jobb && rng() < 0.4) {
          const x = (rng() < 0.5 ? -1 : 1) * (2 + Math.floor(rng() * 3));
          if (x !== this.sti) { l.push(...(rng() < 0.5 ? M.benkBokser(x, z) : M.soppelBokser(x, z))); rad.blokk.add(x); }
        }
        break;
      }

      case 'vei': {
        bakke(F.vei, -0.02, 0.58, F.veiMork);
        if (spek.stripe) {
          for (let x = -VID; x < VID; x += 1.4) { l.push({ x, y: -0.02, z: z + 0.5, w: 0.6, h: 0.012, d: 0.06, c: F.stripe }); }
        }
        if (spek.zebra !== null && spek.zebra !== undefined) {
          for (let i = -2; i <= 2; i++) {
            l.push({ x: spek.zebra + i * 0.36, y: -0.02, z, w: 0.2, h: 0.012, d: 0.86, c: F.stripe });
          }
        }
        /* Trafikken: lik fart i hele raden, alltid luft mellom bilene */
        const fart = mellom(1.0, 2.3, d) * (0.75 + rng() * 0.55) * spek.retning;
        rad.fart = fart;
        const minGap = mellom(2.6, 2.1, d), maksGap = mellom(6.5, 3.8, d);
        let x = -SYKLUS / 2 + rng() * 2;
        while (true) {
          const v = rng();
          let mesh;
          if (v < (kv ? 0.45 : 0.12)) { mesh = M.varebil(this.tex); }
          else if (v < 0.24 + d * 0.12) { mesh = M.lastebil(); }
          else if (v < 0.32 + d * 0.16) { mesh = M.buss(); }
          else { const farger = kv ? KV_BILER : BILFARGER; mesh = M.bil(farger[Math.floor(rng() * farger.length)]); }
          const len = mesh.userData.lengde;
          if (x + len > SYKLUS / 2 - minGap) { break; }
          const m = { mesh, x: x + len / 2, len, lyd: 0, horn: mesh.userData.lengde === 1.75 };
          mesh.position.set(m.x, 0, z);
          mesh.rotation.y = fart > 0 ? 0 : Math.PI;
          rad.gruppe.add(mesh);
          rad.flytt.push(m);
          x += len + minGap + rng() * (maksGap - minGap);
        }
        break;
      }

      case 'elv': {
        /* I Kylling Verden er elvene sausebekker */
        bakke(kv ? (lys ? 0xC8653A : 0xB45730) : (lys ? F.vann : F.vannMork), -0.18, 0.42);
        /* Bredden langs elva */
        for (const s of [-1, 1]) { l.push({ x: s * (VID - 0.5), y: -0.18, z, w: 1, h: 0.1, d: 1, c: F.stein }); }
        const fart = mellom(0.75, 1.45, d) * (0.8 + rng() * 0.4) * spek.retning;
        rad.fart = fart;
        const maksGap = Math.min(3.1, mellom(2.0, 3.1, d));
        let x = -SYKLUS / 2;
        let stokker = 0;
        while (true) {
          const raft = !stokker && rng() < 0.08;
          const len = raft ? 2.6 : Math.round((mellom(3.4, 2.2, d) + rng() * 1.2) * 2) / 2;
          if (x + len > SYKLUS / 2 - 1.2) { break; }
          const mesh = raft ? M.flaate(this.tex) : M.stokk(len);
          const m = { mesh, x: x + len / 2, len, fase: rng() * 6 };
          mesh.position.set(m.x, 0, z);
          rad.gruppe.add(mesh);
          rad.flytt.push(m);
          stokker++;
          x += len + 1.1 + rng() * (maksGap - 1.1);
        }
        /* litt skum som driver med strømmen */
        for (let i = 0; i < 3; i++) {
          const mesh = modell([{ x: 0, y: -0.17, z: 0, w: 0.3, h: 0.02, d: 0.08, c: kv ? F.honey : F.skum }], false);
          const m = { mesh, x: (rng() - 0.5) * SYKLUS, len: 0, skum: true };
          mesh.position.set(m.x, 0, z + (rng() - 0.5) * 0.7);
          rad.gruppe.add(mesh);
          rad.flytt.push(m);
        }
        break;
      }

      case 'bane': {
        bakke(lys ? F.stein : 0x8F8B82, -0.02, 0.58);
        for (let x = -VID; x < VID; x += 0.6) { l.push({ x, y: -0.02, z, w: 0.16, h: 0.05, d: 0.9, c: F.sville }); }
        for (const s of [-0.26, 0.26]) { l.push({ x: 0, y: 0.03, z: z + s, w: VID * 2, h: 0.06, d: 0.07, c: F.skinne }); }
        /* Signal: lyser rødt og ringer før bybanen kommer */
        l.push({ x: -KOL - 0.8, y: 0, z: z + 0.42, w: 0.1, h: 1.3, d: 0.1, c: F.ink });
        l.push({ x: -KOL - 0.8, y: 1.12, z: z + 0.46, w: 0.36, h: 0.3, d: 0.08, c: F.ink });
        const lampe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0x3A1410 }));
        lampe.position.set(-KOL - 0.8, 1.27, z + 0.51);
        rad.gruppe.add(lampe);
        const mesh = M.bybane();
        mesh.position.set(-40, 0, z);
        mesh.visible = false;
        rad.gruppe.add(mesh);
        rad.bane = { mesh, lampe, nedtelling: 2 + rng() * 4, varsel: false, aktiv: false, retning: rng() < 0.5 ? 1 : -1 };
        rad.flytt.push({ mesh, x: -40, len: mesh.userData.lengde, tog: true });
        break;
      }

      case 'jobb': {
        bakke(lys ? F.fortau : F.fortauMork, 0, 0.6);
        for (let x = -VID; x <= VID; x++) { if (x !== 0) { rad.blokk.add(x); } }
        if (r === JOBB) {
          const bygg = M.jobbsenter(this.tex);
          bygg.position.set(0, 0, z - 0.98);   /* fasaden like bak raden: kyllingen står på trappa */
          rad.gruppe.add(bygg);
          rad.bygg = bygg;
        }
        break;
      }
      default: break;
    }

    /* Port inn til Kylling Verden, og skilt når den slutter */
    if (r === KV.fra || r === KV.til + 1) {
      const inn = r === KV.fra;
      for (const sx of [-1, 1]) {
        l.push({ x: sx * (KOL + 0.9), y: 0, z, w: 0.36, h: 2.5, d: 0.36, c: inn ? F.honeyDeep : F.inkSoft });
        l.push({ x: sx * (KOL + 0.9), y: 2.5, z, w: 0.5, h: 0.14, d: 0.5, c: inn ? F.paprika : F.ink });
      }
      l.push({ x: 0, y: 2.38, z: z - 0.05, w: KOL * 2 + 2.2, h: 0.12, d: 0.2, c: inn ? F.paprika : F.ink });
      const skilt = M.skiltPlate(M.lappSkilt(inn ? 'KYLLING VERDEN' : 'Tilbake til byen', inn ? F.honey : F.forest, inn ? F.ink : F.creamHi), 3.4, 1.28);
      skilt.position.set(0, 1.85, z + 0.07);
      rad.gruppe.add(skilt);
    }

    this.leggPakke(rad);

    if (l.length) {
      rad.statisk = modell(l);
      rad.gruppe.add(rad.statisk);
    }
    this.scene.add(rad.gruppe);
    this.rader.set(r, rad);
    return rad;
  }

  /* En pakke på en ledig rute i noen av radene på land */
  leggPakke(rad) {
    const r = rad.rad, rng = this.pakkeRng;
    if (r < 4 || r === JOBB - 3 || !['gress', 'park', 'fortau', 'vei'].includes(rad.type)) { return; }
    const sjanse = (rad.type === 'vei' ? 0.16 : 0.24) * (iKV(r) ? 1.7 : 1);
    if (rng() > sjanse) { return; }
    const ledige = [];
    for (let x = -KOL; x <= KOL; x++) { if (!rad.blokk.has(x)) { ledige.push(x); } }
    if (!ledige.length) { return; }
    const x = ledige[Math.floor(rng() * ledige.length)];
    const mesh = M.pakke(rng() < 0.5 ? 'original' : 'paprika');
    mesh.scale.setScalar(1.45);
    mesh.position.set(x, 0.2, -r);
    rad.gruppe.add(mesh);
    rad.pakke = { x, mesh, fase: rng() * 6, tatt: false };
  }

  /* Plukker pakken på (x, r) hvis det ligger en der. Gir true én gang. */
  plukk(x, r) {
    const rad = this.rader.get(r);
    const p = rad && rad.pakke;
    if (!p || p.tatt || Math.round(x) !== p.x || Math.abs(x - p.x) > 0.3) { return false; }
    p.tatt = true;
    p.mesh.visible = false;
    return true;
  }

  /* ---------------------------------------------------------------------------
     SIMULERING
     Gir tilbake hendelser (bybane-varsel osv.) som spillet kan lage lyd av.
     --------------------------------------------------------------------------- */
  oppdater(dt) {
    this.tid += dt;
    const hendelser = [];
    for (const rad of this.rader.values()) {
      if (rad.pakke && !rad.pakke.tatt) {
        const p = rad.pakke;
        p.mesh.rotation.y = this.tid * 1.8 + p.fase;
        p.mesh.position.y = 0.2 + Math.sin(this.tid * 3 + p.fase) * 0.07;
      }
      if (rad.bane) { this.oppdaterBane(rad, dt, hendelser); continue; }
      for (const m of rad.flytt) {
        m.x += rad.fart * dt * (m.skum ? 1.1 : 1);
        if (m.x > SYKLUS / 2) { m.x -= SYKLUS; }
        if (m.x < -SYKLUS / 2) { m.x += SYKLUS; }
        m.mesh.position.x = m.x;
        if (rad.type === 'elv' && !m.skum) {
          m.mesh.position.y = Math.sin(this.tid * 2.2 + m.fase) * 0.025;
        }
      }
    }
    return hendelser;
  }

  oppdaterBane(rad, dt, hendelser) {
    const b = rad.bane, tog = rad.flytt[0];
    if (!b.aktiv) {
      b.nedtelling -= dt;
      if (!b.varsel && b.nedtelling < 1.6) { b.varsel = true; hendelser.push({ type: 'bybane', rad: rad.rad }); }
      if (b.varsel) { b.lampe.material.color.setHex(Math.floor(this.tid * 6) % 2 ? 0xFF3B26 : 0x3A1410); }
      if (b.nedtelling <= 0) {
        b.aktiv = true;
        tog.x = b.retning > 0 ? -VID - 6 : VID + 6;
        tog.mesh.visible = true;
        tog.mesh.rotation.y = b.retning > 0 ? 0 : Math.PI;
      }
    } else {
      tog.x += b.retning * 17 * dt;
      tog.mesh.position.x = tog.x;
      b.lampe.material.color.setHex(Math.floor(this.tid * 6) % 2 ? 0xFF3B26 : 0x3A1410);
      if (Math.abs(tog.x) > VID + 7) {
        b.aktiv = false; b.varsel = false;
        tog.mesh.visible = false;
        tog.x = -40;
        b.nedtelling = mellom(7, 3.5, vanske(rad.rad)) + this.rng() * 4;
        b.retning = this.rng() < 0.5 ? 1 : -1;
        b.lampe.material.color.setHex(0x3A1410);
      }
    }
  }

  /* ---------------------------------------------------------------------------
     SPØRSMÅL FRA SPILLET
     --------------------------------------------------------------------------- */
  rad(r) { return this.rader.get(r); }

  /* Kan kyllingen stå på (x, r)? */
  blokkert(x, r) {
    const rad = this.rader.get(r);
    if (!rad) { return true; }
    if (Math.abs(x) > KOL + 0.01) { return true; }
    return rad.blokk.has(Math.round(x));
  }

  /* Et kjøretøy (eller bybanen) som treffer x i rad r */
  treff(x, r) {
    const rad = this.rader.get(r);
    if (!rad || (rad.type !== 'vei' && rad.type !== 'bane')) { return null; }
    for (const m of rad.flytt) {
      if (m.tog && !rad.bane.aktiv) { continue; }
      if (Math.abs(x - m.x) < m.len / 2 + 0.28) { return m; }
    }
    return null;
  }

  /* Stokken eller flåten kyllingen står på i rad r (eller null = vann) */
  flyter(x, r) {
    const rad = this.rader.get(r);
    if (!rad || rad.type !== 'elv') { return null; }
    for (const m of rad.flytt) {
      if (!m.skum && Math.abs(x - m.x) < m.len / 2 + 0.12) { return m; }
    }
    return null;
  }
}
