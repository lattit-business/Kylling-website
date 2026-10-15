/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — VERDENEN
   Verden er en rekke rader (rad r ligger på z = −r). Hver rad er gress, park,
   fortau, vei, elv eller bybane. Radene lages etter hvert som kyllingen går
   framover, og fjernes når de er langt bak. Alt som står stille i en rad, slås
   sammen til én modell; biler og tømmerstokker er egne modeller som flyttes.

   Rettferdighet: det finnes alltid en åpen sti gjennom hindringene, det er
   alltid luft mellom bilene, og hullene mellom stokkene er aldri for store.
   Vanskeligheten øker jevnt med avstanden (vanske()).

   Hvilke rader som kommer, og hvor pakkene ligger, avgjøres av banen i
   bane.mjs (felles med serveren). Her bygges radene i 3D. Rutene der det
   ligger pakker, holdes fri for hindringer.
   ============================================================================= */
import * as THREE from '../vendor/three.module.min.js';
import { F, modell } from './voxel.js';
import * as M from './modeller.js';

import { KOL, JOBB, vanske, lagRng, verdenFor, VERDENER } from './bane.mjs';
export { KOL, JOBB, vanske, lagRng, verdenFor, VERDENER };

const VID = 14;                  /* hvor bred bakken tegnes (halv bredde) */
const OPPE = 1.7;                /* stempelhodet i hvilestilling */
const SYKLUS = 26;               /* kjøretøy og stokker går i ring over denne lengden */
const KV_BILER = [F.honey, F.paprika, F.forest, F.creamHi, F.honeyDeep];
const BRYGGE_BILER = [F.creamHi, F.inkSoft, F.blaa, F.sage];
const SKIVER = [F.roed, F.blaa, F.gul, F.forest];
const BALLER = [F.rosa, F.blaa, F.lilla];

/* Utseendet til hver verden: bakkefarger (lys/mørk rad) og pynt.
   Radtypene er de samme overalt; det er bare utseendet som skiller dem. */
const TEMA = {
  by: { gress: [F.gress, F.gressMork], park: [F.park, F.gress], fortau: [F.fortau, F.fortauMork], vei: [F.vei, F.veiMork], vann: [F.vann, F.vannMork], skum: F.skum, bane: [F.stein, 0x8F8B82],
        hus: [F.creamHi, F.roed, F.gul, F.beige, F.sage, F.blaa], tak: F.inkSoft },
  kylling: { gress: [0xE9C36A, 0xDDB55A, 0xD7AD52], park: [0xF0CF7A, 0xE9C36A, 0xD7AD52], fortau: [F.creamHi, F.beige], vei: [F.vei, F.veiMork], vann: [0xC8653A, 0xB45730], skum: F.honey, bane: [F.stein, 0x8F8B82],
        hus: [F.honey, F.paprika, F.forest, F.creamHi], tak: F.ink },
  brygge: { gress: [0xA77B50, 0x9A6F46, 0x3F6F86], park: [0xB9B4AA, 0xADA89E], fortau: [0xB0ABA0, 0xA49F94], vei: [0x6E6A64, 0x63605A], vann: [0x3F6F86, 0x376378], skum: 0xD6E6EC, bane: [0x8F8B82, 0x85817A],
        hus: [F.roed, F.gul, F.creamHi, 0xC77B3A, 0xA8492A], tak: F.ink },
  fabrikk: { gress: [0xE4E6E8, 0xD9DCDF], park: [0xBFC2C4, 0xB4B7B9], fortau: [0xC9CCCF, 0xC0C3C6], vei: [0x5A5D60, 0x515457], vann: [0xC8562F, 0xB84C28], skum: F.honey, bane: [0x7F8285, 0x76797C],
        hus: [0xA9ADB2, 0x8E9196, 0xC9CDD2], tak: F.inkSoft },
  trening: { gress: [0x3B3C40, 0x35363A], park: [0x4C5A78, 0x46536F], fortau: [0xC9A574, 0xBF9A69], vei: [0x2F3034, 0x2A2B2F], vann: [F.vann, F.vannMork], skum: F.skum, bane: [0x45464A, 0x3F4044],
        hus: [0x6E7176, 0x5A5D62], tak: F.ink }
};

/* Porten inn til hver verden */
const PORT = {
  kylling: { stolpe: F.honeyDeep, topp: F.paprika, bg: F.honey, fg: F.ink },
  brygge: { stolpe: F.bark, topp: F.roed, bg: F.roed, fg: F.creamHi },
  fabrikk: { stolpe: 0x8E9196, topp: F.honey, bg: F.ink, fg: F.honey },
  trening: { stolpe: F.ink, topp: F.blaa, bg: F.blaa, fg: F.creamHi }
};

const mellom = (a, b, t) => a + (b - a) * t;
const BILFARGER = [F.roed, F.blaa, F.gul, F.creamHi, F.sage, F.paprika, F.inkSoft, F.oransje, F.lilla];

export class Verden {
  /* bane: en Bane fra bane.mjs (radene og pakkene, laget av frøet) */
  constructor(scene, teksturer, reklame, bane) {
    this.scene = scene;
    this.tex = teksturer;
    this.reklame = reklame;
    this.bane = bane;
    /* Egen tilfeldighet for pynt, trafikk og hindringer (påvirker ikke poeng) */
    this.rng = lagRng((bane.frø ^ 0x5BD1E995) >>> 0);
    this.rader = new Map();
    this.laget = -11;          /* høyeste rad som er bygget */
    this.sti = 0;              /* kolonnen som alltid holdes åpen gjennom gresset */
    this.tavler = 0;
    this.harEgg = false;
    this.tid = 0;
  }

  /* Sørger for at radene fra «fra» til «til» finnes, og fjerner de som er bak */
  sikre(fra, til) {
    while (this.laget < til) {
      this.laget++;
      /* Rader langt bak trenger ikke bygges (f.eks. etter hoppTil i testene) */
      if (this.laget >= -10 && this.laget >= fra - 1) { this.bygg(this.bane.spek(this.laget)); }
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
    const r = spek.rad, z = -r, rng = this.rng, d = vanske(r);
    const vd = verdenFor(r), v = vd.id, kv = v === 'kylling', tema = TEMA[v];
    const tempo = 1 + 0.12 * vd.runde;        /* litt raskere for hver runde i ringen */
    const rad = { rad: r, type: spek.type, verden: v, blokk: new Set(), flytt: [], fart: 0, gruppe: new THREE.Group(), spek };
    /* Ruter med pakker skal aldri få hindringer */
    const pakkeRuter = new Set(this.bane.pakker(r).map((p) => p.x));
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
    const hindring = (x, t) => {
      if (kv) {
        if (t < 0.4) { l.push(...M.honsehusBokser(x, z)); this.leggHone(rad, x, z); }
        else { l.push(...(t < 0.62 ? M.siloBokser(x, z) : t < 0.82 ? M.halmBokser(x, z) : M.eggBokser(x, z))); }
      } else if (v === 'brygge') {
        l.push(...(t < 0.45 ? M.fiskekasseBokser(x, z) : t < 0.75 ? M.tonneBokser(x, z) : M.pullertBokser(x, z)));
      } else if (v === 'fabrikk') {
        l.push(...(t < 0.5 ? M.pallBokser(x, z) : M.maskinBokser(x, z)));
      } else if (v === 'trening') {
        l.push(...(t < 0.4 ? M.manualBokser(x, z) : t < 0.7 ? M.treningsbenkBokser(x, z) : M.ballBokser(x, z, BALLER[Math.floor(rng() * BALLER.length)])));
      } else if (t < 0.52) { l.push(...M.treBokser(x, z, Math.floor(rng() * 3))); }
      else if (t < 0.8) { l.push(...M.buskBokser(x, z)); }
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
          if (r === -1) {
            /* Bergens viktigste regel, rett bak startstreken */
            const skilt = M.skiltCachet('Ikke mat\nmåkene.', F.honey, F.ink, 1.8, 0.68);
            skilt.position.set(2, 1.15, z + 0.06);
            rad.gruppe.add(skilt);
            l.push({ x: 2, y: 0, z, w: 0.1, h: 0.82, d: 0.1, c: F.ink });
            rad.blokk.add(2);
          }
        }
        break;
      }

      case 'gress':
      case 'park': {
        const park = spek.type === 'park';
        const farger = park ? tema.park : tema.gress;
        bakke(lys ? farger[0] : farger[1], 0, 0.6, farger[2]);
        this.bakkePynt(v, spek.type, l, z, rng);
        kantPynt((x, t) => {
          if (kv) {
            if (t < 0.3) { l.push(...M.siloBokser(x, z)); }
            else if (t < 0.55) { l.push(...M.honsehusBokser(x, z)); if (Math.abs(x) < KOL + 4) { this.leggHone(rad, x, z); } }
            else { l.push(...(t < 0.8 ? M.halmBokser(x, z) : M.eggBokser(x, z))); }
            return;
          }
          if (v === 'brygge') {
            if (park) { if (t < 0.35 && Math.abs(x) % 3 === 0) { l.push(...M.torgbodBokser(x, z, t < 0.17 ? F.roed : F.blaa)); } else if (t < 0.6) { l.push(...M.fiskekasseBokser(x, z)); } }
            else if (Math.abs(x) > KOL + 2) { /* vann på utsiden av brygga */ }
            else if (t < 0.5) { l.push(...M.pullertBokser(x, z)); } else if (t < 0.8) { l.push(...M.tonneBokser(x, z)); }
            return;
          }
          if (v === 'fabrikk') { l.push(...(t < 0.4 ? M.maskinBokser(x, z) : t < 0.75 ? M.pallBokser(x, z) : M.tonneBokser(x, z))); return; }
          if (v === 'trening') { l.push(...(t < 0.35 ? M.manualBokser(x, z) : t < 0.6 ? M.treningsbenkBokser(x, z) : t < 0.8 ? M.ballBokser(x, z, BALLER[Math.floor(rng() * BALLER.length)]) : [])); return; }
          if (park && t < 0.25) { l.push(...M.benkBokser(x, z)); }
          else if (t < 0.6) { l.push(...M.treBokser(x, z, Math.floor(rng() * 3))); }
          else if (t < 0.85) { l.push(...M.buskBokser(x, z)); }
          else { l.push(...M.blomsterBokser(x, z, rng)); }
        });
        /* Hindringer på spillflaten, men stien holdes åpen */
        /* Stien flytter seg av og til én rute. Både den gamle og den nye ruta
           holdes åpne, så det alltid går en sammenhengende vei framover. */
        const gammelSti = this.sti;
        if (rng() < 0.45) { this.sti = Math.max(-KOL + 1, Math.min(KOL - 1, this.sti + (rng() < 0.5 ? -1 : 1))); }
        const tetthet = spek.lett ? 0.1 : mellom(park ? 0.12 : 0.2, park ? 0.22 : 0.34, d);
        let antall = 0;
        for (let x = -KOL; x <= KOL; x++) {
          if (x === this.sti || x === gammelSti || pakkeRuter.has(x) || antall >= 4) { continue; }
          if (rng() < tetthet) { hindring(x, rng()); antall++; }
          else if (park && v === 'by' && rng() < 0.3) { l.push(...M.blomsterBokser(x, z, rng)); }
        }
        if (park && v === 'by' && !this.harEgg && r > 14 && rng() < 0.5) {
          /* Påskeegget: et kjempeegg med et skilt (hva kom først?) */
          this.harEgg = true;
          l.push({ x: 6.2, y: 0, z, w: 0.9, h: 1.1, d: 0.8, c: F.creamHi },
                 { x: 6.2, y: 1.1, z, w: 0.6, h: 0.3, d: 0.55, c: F.creamHi },
                 { x: 6.2, y: 0.3, z: z + 0.41, w: 0.3, h: 0.08, d: 0.02, c: F.honey });
          const skilt = M.skiltCachet('Hva kom\nførst?', F.creamHi, F.ink, 1.1, 0.42);
          skilt.position.set(7.6, 0.9, z + 0.2);
          rad.gruppe.add(skilt);
          l.push({ x: 7.6, y: 0, z, w: 0.08, h: 0.7, d: 0.08, c: F.bark });
        }
        break;
      }

      case 'fortau': {
        bakke(lys ? tema.fortau[0] : tema.fortau[1], 0, 0.6);
        for (let x = -VID + 1; x < VID; x += 1) { l.push({ x: x + 0.5, y: 0, z, w: 0.04, h: 0.01, d: 1, c: v === 'trening' ? 0xA88A5E : F.fortauMork }); }
        if (v === 'fabrikk') { for (const s2 of [-0.42, 0.42]) { l.push({ x: 0, y: 0, z: z + s2, w: VID * 2, h: 0.012, d: 0.08, c: F.honey }); } }
        const kz = spek.kant === 'foran' ? z - 0.46 : z + 0.46;   /* kantstein mot veien */
        if (spek.kant) { l.push({ x: 0, y: 0, z: kz, w: VID * 2, h: 0.06, d: 0.08, c: F.stein }); }
        if (v !== 'trening' && v !== 'fabrikk') { l.push(...M.lyktBokser(-KOL - 0.7, z)); }
        if (v === 'by' && rng() < 0.5) { l.push(...M.skiltBokser(KOL + 0.7, z, [F.blaa, F.roed, F.honey][Math.floor(rng() * 3)])); }
        /* Hus langs fortauet, utenfor spillflaten (trehus på Bryggen) */
        for (const s2 of [-1, 1]) {
          for (let x = KOL + 2.5; x < VID; x += v === 'brygge' ? 1.4 : 2.6) {
            if (rng() < (v === 'brygge' ? 0.85 : 0.7)) {
              const farge = tema.hus[Math.floor(rng() * tema.hus.length)];
              if (v === 'brygge') { l.push(...M.bryggehusBokser(s2 * x, z - 0.1, farge, 1.4 + rng() * 0.8)); }
              else { l.push(...M.husBokser(s2 * x, z - 0.1, 2.2, 0.8, 1.2 + rng() * 1.0, farge, tema.tak)); }
            }
          }
        }
        this.veggSkilt(v, rad, z, rng);
        if (spek.jobb && r === JOBB - 2) {
          const skilt = M.skiltCachet('Jobbsenteret\nrett fram ↑', F.forest, F.creamHi, 1.4, 0.55);
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
          if (x !== this.sti && !pakkeRuter.has(x)) {
            if (v === 'by' || v === 'kylling') { l.push(...(rng() < 0.5 ? M.benkBokser(x, z) : M.soppelBokser(x, z))); }
            else { hindring(x, rng()); }
            rad.blokk.add(x);
          }
        }
        break;
      }

      case 'vei': {
        bakke(tema.vei[0], -0.02, 0.58, tema.vei[1]);
        const stripe = v === 'fabrikk' ? F.honey : v === 'trening' ? F.creamHi : F.stripe;
        if (v === 'brygge') {
          /* brostein */
          for (let x = -VID + 0.5; x < VID; x += 0.9) { l.push({ x: x + (r % 2) * 0.45, y: -0.02, z, w: 0.05, h: 0.01, d: 1, c: 0x56534E }); }
        } else if (spek.stripe) {
          for (let x = -VID; x < VID; x += 1.4) { l.push({ x, y: -0.02, z: z + 0.5, w: 0.6, h: 0.012, d: 0.06, c: stripe }); }
        }
        if (spek.zebra !== null && spek.zebra !== undefined) {
          for (let i = -2; i <= 2; i++) {
            l.push({ x: spek.zebra + i * 0.36, y: -0.02, z, w: 0.2, h: 0.012, d: 0.86, c: F.stripe });
          }
        }
        /* Trafikken: lik fart i hele raden, alltid luft mellom bilene */
        const fart = mellom(1.0, 2.3, d) * (0.75 + rng() * 0.55) * spek.retning * tempo;
        rad.fart = fart;
        const minGap = mellom(2.6, 2.1, d), maksGap = mellom(6.5, 3.8, d);
        let x = -SYKLUS / 2 + rng() * 2;
        while (true) {
          const mesh = this.kjoretoy(v, rng(), d);
          const len = mesh.userData.lengde;
          if (x + len > SYKLUS / 2 - minGap) { break; }
          const m = { mesh, x: x + len / 2, len, lyd: 0, horn: mesh.userData.lengde === 1.75, slag: mesh.userData.slag || '' };
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
        /* Elva er havna på Bryggen, sausebekken i Kylling Verden og
           krydderkaret under samlebåndet i Fabrikken */
        bakke(lys ? tema.vann[0] : tema.vann[1], -0.18, 0.42);
        for (const s2 of [-1, 1]) { l.push({ x: s2 * (VID - 0.5), y: -0.18, z, w: 1, h: 0.1, d: 1, c: v === 'fabrikk' ? 0x8E9196 : F.stein }); }
        if (v === 'fabrikk') {
          /* skinnene til samlebåndet */
          for (const s2 of [-0.44, 0.44]) { l.push({ x: 0, y: -0.2, z: z + s2, w: VID * 2, h: 0.12, d: 0.06, c: 0x6E7176 }); }
        }
        const fart = mellom(0.75, 1.45, d) * (0.8 + rng() * 0.4) * spek.retning * tempo;
        rad.fart = fart;
        const maksGap = Math.min(3.1, mellom(2.0, 3.1, d));
        let x = -SYKLUS / 2;
        let stokker = 0;
        while (true) {
          const raft = !stokker && rng() < 0.08;
          const len = raft ? 2.6 : Math.round((mellom(3.4, 2.2, d) + rng() * 1.2) * 2) / 2;
          if (x + len > SYKLUS / 2 - 1.2) { break; }
          const mesh = this.flyterMesh(v, len, raft);
          const m = { mesh, x: x + len / 2, len, fase: rng() * 6 };
          mesh.position.set(m.x, 0, z);
          rad.gruppe.add(mesh);
          rad.flytt.push(m);
          stokker++;
          x += len + 1.1 + rng() * (maksGap - 1.1);
        }
        /* litt skum som driver med strømmen */
        for (let i = 0; i < 3; i++) {
          const mesh = modell([{ x: 0, y: -0.17, z: 0, w: 0.3, h: 0.02, d: 0.08, c: tema.skum }], false);
          const m = { mesh, x: (rng() - 0.5) * SYKLUS, len: 0, skum: true };
          mesh.position.set(m.x, 0, z + (rng() - 0.5) * 0.7);
          rad.gruppe.add(mesh);
          rad.flytt.push(m);
        }
        break;
      }

      case 'bane': {
        bakke(lys ? tema.bane[0] : tema.bane[1], -0.02, 0.58);
        const variant = { by: 'bybane', kylling: 'kyllingtog', brygge: 'floibane', fabrikk: 'stempel', trening: 'stang' }[v];
        if (variant === 'stempel' || variant === 'stang') {
          /* varselstriper på gulvet */
          for (let x = -VID; x < VID; x += 0.8) { l.push({ x, y: -0.02, z: z + 0.44, w: 0.4, h: 0.012, d: 0.1, c: F.honey }); l.push({ x, y: -0.02, z: z - 0.44, w: 0.4, h: 0.012, d: 0.1, c: F.honey }); }
        } else {
          for (let x = -VID; x < VID; x += 0.6) { l.push({ x, y: -0.02, z, w: 0.16, h: 0.05, d: 0.9, c: F.sville }); }
          for (const s2 of [-0.26, 0.26]) { l.push({ x: 0, y: 0.03, z: z + s2, w: VID * 2, h: 0.06, d: 0.07, c: F.skinne }); }
        }
        if (variant === 'floibane') {
          /* Fjellsiden opp mot Fløyen, med skinnene videre opp */
          for (let x = KOL + 1; x < VID; x++) {
            const h = (x - KOL - 0.5) * 0.4;
            l.push({ x, y: 0, z: z - 0.1, w: 1, h, d: 1.1, c: x % 2 ? F.lovMork : F.lov });
            l.push({ x, y: h, z: z, w: 1, h: 0.08, d: 0.7, c: F.sville });
          }
        }
        if (variant === 'stempel') {
          for (const s2 of [-1, 1]) {
            l.push({ x: s2 * (KOL + 0.9), y: 0, z, w: 0.4, h: 2.6, d: 0.5, c: 0x8E9196 });
            l.push({ x: s2 * (KOL + 0.9), y: 0.1, z: z + 0.26, w: 0.42, h: 0.12, d: 0.02, c: F.honey });
          }
          l.push({ x: 0, y: 2.6, z, w: KOL * 2 + 2.4, h: 0.3, d: 0.6, c: 0x6E7176 });
        }
        /* Signal: lyser rødt og ringer før bybanen kommer */
        l.push({ x: -KOL - 0.8, y: 0, z: z + 0.42, w: 0.1, h: 1.3, d: 0.1, c: F.ink });
        l.push({ x: -KOL - 0.8, y: 1.12, z: z + 0.46, w: 0.36, h: 0.3, d: 0.08, c: F.ink });
        const lampe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0x3A1410 }));
        lampe.position.set(-KOL - 0.8, 1.27, z + 0.51);
        rad.gruppe.add(lampe);
        if (variant === 'stempel') {
          const mesh = M.stempelHode(KOL * 2 + 1.6);
          mesh.position.set(0, OPPE, z);
          rad.gruppe.add(mesh);
          rad.bane = { mesh, lampe, variant, stempel: true, nedtelling: 2 + rng() * 3, varsel: false, aktiv: false, nede: false, t: 0, tempo, retning: 1 };
          rad.flytt.push({ mesh, x: 0, len: 99, stempel: true });
          break;
        }
        const mesh = variant === 'kyllingtog' ? M.kyllingtog() : variant === 'floibane' ? M.floibane() : variant === 'stang' ? M.vektstang() : M.bybane();
        mesh.position.set(-40, 0, z);
        mesh.visible = false;
        rad.gruppe.add(mesh);
        rad.bane = { mesh, lampe, variant, nedtelling: 2 + rng() * 4, varsel: false, aktiv: false, tempo, retning: rng() < 0.5 ? 1 : -1,
          fart: { bybane: 17, kyllingtog: 15, floibane: 9, stang: 12 }[variant] * tempo };
        rad.flytt.push({ mesh, x: -40, len: mesh.userData.lengde, tog: true });
        break;
      }

      case 'grill': {
        /* Grillplate: kald, så glødende (varsel), så het. To plater på rad er i utakt. */
        bakke(0x3A3A3A, 0, 0.6, 0xBFC2C4);
        for (let x = -KOL - 0.5; x <= KOL + 0.5; x += 0.25) { l.push({ x, y: 0, z, w: 0.06, h: 0.04, d: 0.96, c: 0x1E1E1E }); }
        for (const s2 of [-1, 1]) { l.push({ x: s2 * (KOL + 0.75), y: 0, z, w: 0.3, h: 0.5, d: 1, c: 0x8E9196 }); }
        const glod = new THREE.Mesh(new THREE.BoxGeometry(KOL * 2 + 1, 0.02, 0.96), new THREE.MeshBasicMaterial({ color: 0x2A2A2A }));
        glod.position.set(0, 0.012, z);
        rad.gruppe.add(glod);
        const syklus = mellom(4.8, 4.0, d) / tempo;
        rad.grill = { glod, syklus, tid: (spek.fase || 0) * syklus * 0.5 + rng() * 0.4, het: false, varsel: false, treff: { grill: true, len: 0 } };
        break;
      }

      case 'mølle': {
        /* Tredemøller: står du stille, blir du dyttet én rad bakover */
        bakke(0x3B3C40, 0, 0.6, 0x35363A);
        l.push({ x: 0, y: 0, z, w: KOL * 2 + 1, h: 0.08, d: 0.9, c: 0x1F2023 });
        for (let x = -KOL - 0.5; x <= KOL + 0.5; x++) { l.push({ x, y: 0, z, w: 0.06, h: 0.1, d: 0.92, c: 0x8E9196 }); }
        for (const s2 of [-1, 1]) {
          l.push({ x: s2 * (KOL + 0.8), y: 0, z, w: 0.12, h: 1.0, d: 0.12, c: 0x8E9196 });
          l.push({ x: s2 * (KOL + 0.8), y: 1.0, z: z + 0.1, w: 0.4, h: 0.26, d: 0.3, c: F.ink });
          l.push({ x: s2 * (KOL + 0.8), y: 1.08, z: z + 0.26, w: 0.28, h: 0.12, d: 0.01, c: F.lovLys });
        }
        const striper = [];
        for (let x = -KOL - 0.5; x <= KOL + 0.5; x += 1) {
          for (let k = 0; k < 4; k++) { striper.push({ x: x + 0.5, y: 0.08, z: -0.4 + k * 0.2, w: 0.86, h: 0.004, d: 0.05, c: 0x3A3B3F }); }
        }
        const belte = modell(striper.filter((b) => b.x <= KOL + 0.5), false);
        belte.position.z = z;
        rad.gruppe.add(belte);
        rad.belte = belte;
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

    /* Port inn til en ny verden */
    if (spek.port && PORT[spek.port]) {
      const p = PORT[spek.port];
      for (const sx of [-1, 1]) {
        l.push({ x: sx * (KOL + 0.9), y: 0, z, w: 0.36, h: 2.5, d: 0.36, c: p.stolpe });
        l.push({ x: sx * (KOL + 0.9), y: 2.5, z, w: 0.5, h: 0.14, d: 0.5, c: p.topp });
      }
      l.push({ x: 0, y: 2.38, z: z - 0.05, w: KOL * 2 + 2.2, h: 0.12, d: 0.2, c: p.topp });
      const navn = vd.navn.toUpperCase() + (vd.runde ? `\nRunde ${vd.runde + 1}` : '');
      const skilt = M.skiltCachet(navn, p.bg, p.fg, 3.4, 1.28);
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

  /* Litt mønster i bakken: planker på brygga, fliser i fabrikken, prikker på matta */
  bakkePynt(v, type, l, z, rng) {
    if (v === 'brygge' && type === 'gress') {
      for (let x = -KOL - 0.5; x <= KOL + 0.5; x += 1) { l.push({ x, y: 0, z, w: 0.04, h: 0.01, d: 1, c: 0x7A5233 }); }
      for (const s2 of [-1, 1]) { l.push({ x: s2 * (KOL + 0.6), y: 0, z, w: 0.2, h: 0.16, d: 1, c: 0x7A5233 }); }
    } else if (v === 'brygge') {
      for (let i = 0; i < 18; i++) { l.push({ x: (rng() - 0.5) * VID * 2, y: 0, z: z + (rng() - 0.5) * 0.8, w: 0.3, h: 0.012, d: 0.24, c: 0xA49F94 }); }
    } else if (v === 'fabrikk') {
      for (let x = -VID + 1; x < VID; x += 1) { l.push({ x: x + 0.5, y: 0, z, w: 0.03, h: 0.01, d: 1, c: 0xC2C6CA }); }
      l.push({ x: 0, y: 0, z: z + 0.49, w: VID * 2, h: 0.01, d: 0.03, c: 0xC2C6CA });
    } else if (v === 'trening') {
      for (let i = 0; i < 22; i++) { l.push({ x: (rng() - 0.5) * VID * 2, y: 0, z: z + (rng() - 0.5) * 0.9, w: 0.05, h: 0.008, d: 0.05, c: i % 2 ? 0x55565B : 0x6E7176 }); }
    }
  }

  /* Reklamevegger i Fabrikken og plakater på Treningssenteret */
  veggSkilt(v, rad, z, rng) {
    if ((v !== 'fabrikk' && v !== 'trening') || rng() > 0.45) { return; }
    const s2 = rng() < 0.5 ? -1 : 1;
    const valg = v === 'fabrikk'
      ? [['Original', F.forest, F.creamHi], ['Sweet\nPaprika', F.paprika, F.creamHi]]
      : [['Ekte mat etter\ntrening.', F.honey, F.ink], ['Husk\nmatpakka!', F.blaa, F.creamHi]];
    const [tekst, bg, fg] = valg[Math.floor(rng() * valg.length)];
    const x = s2 * (KOL + 3.2);
    const vegg = modell(M.reklameveggBokser(0, 0));
    vegg.position.set(x, 0, z - 0.3);
    rad.gruppe.add(vegg);
    const skilt = M.skiltCachet(tekst, bg, fg, 1.9, 0.86);
    skilt.position.set(x, 1.37, z - 0.19);
    rad.gruppe.add(skilt);
  }

  /* En høne som titter ut av hønsehuset ved x */
  leggHone(rad, x, z) {
    if ((rad.honer || []).length >= 2) { return; }
    const mesh = M.hone();
    mesh.position.set(x, -0.5, z + 0.45);
    mesh.rotation.y = -Math.PI / 2;
    rad.gruppe.add(mesh);
    (rad.honer = rad.honer || []).push({ mesh, fase: this.rng() * 6, periode: 3 + this.rng() * 3, ute: false });
  }

  kjoretoy(v, t, d) {
    const rng = this.rng;
    if (v === 'kylling') {
      if (t < 0.4) { return M.varebil(this.tex); }
      if (t < 0.62) { return M.traktor(); }
      return M.bil(KV_BILER[Math.floor(rng() * KV_BILER.length)]);
    }
    if (v === 'brygge') {
      if (t < 0.5) { return M.fiskevogn(); }
      if (t < 0.6) { return M.varebil(this.tex); }
      return M.bil(BRYGGE_BILER[Math.floor(rng() * BRYGGE_BILER.length)]);
    }
    if (v === 'fabrikk') { return t < 0.55 ? M.truck() : M.trillebord(); }
    if (v === 'trening') { return t < 0.65 ? M.vektskive(SKIVER[Math.floor(rng() * SKIVER.length)]) : M.treningsball(BALLER[Math.floor(rng() * BALLER.length)]); }
    if (t < 0.12) { return M.varebil(this.tex); }
    if (t < 0.24 + d * 0.12) { return M.lastebil(); }
    if (t < 0.32 + d * 0.16) { return M.buss(); }
    return M.bil(BILFARGER[Math.floor(rng() * BILFARGER.length)]);
  }

  flyterMesh(v, len, raft) {
    if (raft) { return M.flaate(this.tex); }
    if (v === 'kylling') { return M.kyllingfilet(len); }
    if (v === 'brygge') { return len >= 3 ? M.ferge(len) : M.baat(len); }
    if (v === 'fabrikk') { return M.brett(len); }
    return M.stokk(len);
  }

  /* Pakkene i raden (fra banen) */
  leggPakke(rad) {
    for (const p of this.bane.pakker(rad.rad)) {
      const mesh = M.pakke(p.slag);
      mesh.scale.setScalar(1.45);
      mesh.position.set(p.x, 0.2, -rad.rad);
      rad.gruppe.add(mesh);
      rad.pakke = { x: p.x, slag: p.slag, mesh, fase: (rad.rad * 1.7) % 6, tatt: false };
    }
  }

  /* Plukker pakken på (x, r) hvis det ligger en der. Gir pakken én gang, ellers null. */
  plukk(x, r) {
    const rad = this.rader.get(r);
    const p = rad && rad.pakke;
    if (!p || p.tatt || Math.round(x) !== p.x || Math.abs(x - p.x) > 0.3) { return null; }
    p.tatt = true;
    p.mesh.visible = false;
    return p;
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
      if (rad.grill) { this.oppdaterGrill(rad, dt, hendelser); continue; }
      if (rad.belte) { rad.belte.position.z = -rad.rad + ((this.tid * 0.6) % 0.2); continue; }
      if (rad.honer) {
        for (const h of rad.honer) {
          const t = (this.tid + h.fase) % h.periode, ute = t < 1.3;
          const y = ute ? Math.min(1, t / 0.18, (1.3 - t) / 0.18) : 0;
          h.mesh.position.y = -0.5 + y * 0.5;
          if (ute && !h.ute) { hendelser.push({ type: 'kakle', rad: rad.rad }); }
          h.ute = ute;
        }
      }
      for (const m of rad.flytt) {
        m.x += rad.fart * dt * (m.skum ? 1.1 : 1);
        const hjul = m.mesh.userData.rull;
        if (hjul) { hjul.rotation.z -= rad.fart * dt / m.mesh.userData.radius; }
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

  oppdaterGrill(rad, dt, hendelser) {
    const g = rad.grill;
    g.tid = (g.tid + dt) % g.syklus;
    const andel = g.tid / g.syklus;
    const varsel = andel > 0.58 && andel <= 0.78, het = andel > 0.78;
    if (het && !g.het) { hendelser.push({ type: 'grill', rad: rad.rad }); }
    g.het = het; g.varsel = varsel;
    g.glod.material.color.setHex(het ? (Math.floor(this.tid * 10) % 2 ? 0xFF6A2A : 0xF2552A) : varsel ? (Math.floor(this.tid * 6) % 2 ? 0x9A3A1E : 0x5A2A1A) : 0x2A2A2A);
  }

  oppdaterStempel(rad, dt, hendelser) {
    const b = rad.bane, hode = b.mesh;
    if (!b.aktiv) {
      b.nedtelling -= dt;
      if (!b.varsel && b.nedtelling < 1.6) { b.varsel = true; hendelser.push({ type: 'stempelvarsel', rad: rad.rad }); }
      hode.position.y = OPPE + (b.varsel ? Math.sin(this.tid * 50) * 0.03 : 0);
      if (b.varsel) { b.lampe.material.color.setHex(Math.floor(this.tid * 6) % 2 ? 0xFF3B26 : 0x3A1410); }
      if (b.nedtelling <= 0) { b.aktiv = true; b.t = 0; b.smalt = false; }
      return;
    }
    b.t += dt;
    const t = b.t;
    const y = t < 0.12 ? mellom(OPPE, 0, t / 0.12) : t < 0.62 ? 0 : t < 1.0 ? mellom(0, OPPE, (t - 0.62) / 0.38) : OPPE;
    hode.position.y = y;
    b.nede = y < 0.6;
    if (t >= 0.12 && !b.smalt) { b.smalt = true; hendelser.push({ type: 'stempel', rad: rad.rad }); }
    if (t >= 1.0) {
      b.aktiv = false; b.varsel = false; b.nede = false;
      b.nedtelling = (mellom(5.5, 3.2, vanske(rad.rad)) + this.rng() * 3) / b.tempo;
      b.lampe.material.color.setHex(0x3A1410);
    }
  }

  oppdaterBane(rad, dt, hendelser) {
    if (rad.bane.stempel) { this.oppdaterStempel(rad, dt, hendelser); return; }
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
      tog.x += b.retning * b.fart * dt;
      tog.mesh.position.x = tog.x;
      if (b.variant === 'floibane') {
        /* opp og ned fjellsiden til høyre */
        const ut = Math.max(0, tog.x - KOL - 0.5);
        tog.mesh.position.y = ut * 0.4;
        tog.mesh.rotation.z = ut > 0 ? 0.38 * b.retning : 0;
      }
      b.lampe.material.color.setHex(Math.floor(this.tid * 6) % 2 ? 0xFF3B26 : 0x3A1410);
      if (Math.abs(tog.x) > VID + 7) {
        b.aktiv = false; b.varsel = false;
        tog.mesh.visible = false;
        tog.x = -40;
        b.nedtelling = (mellom(7, 3.5, vanske(rad.rad)) + this.rng() * 4) / b.tempo;
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
    if (!rad) { return null; }
    if (rad.grill) { return rad.grill.het && Math.abs(x) <= KOL + 0.5 ? rad.grill.treff : null; }
    if (rad.bane && rad.bane.stempel) { return rad.bane.nede && Math.abs(x) <= KOL + 0.5 ? rad.flytt[0] : null; }
    if (rad.type !== 'vei' && rad.type !== 'bane') { return null; }
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
