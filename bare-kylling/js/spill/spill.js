/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — SPILLET
   Et isometrisk 3D-spill i voxel-stil: hopp logokyllingen fra Bare Kylling-
   butikken, over veier, elver og bybaneskinner, fram til Jobbsenteret – og
   videre så langt du kommer.

   Moduler:  voxel.js (klosser og logokyllingen)  modeller.js (alt i byen)
             verden.js (radene, trafikken, kollisjoner)  lyd.js (lyd og musikk)
             toppliste.js (rekorder og global toppliste)
   ============================================================================= */
import * as THREE from '../vendor/three.module.min.js';
import { F, MATERIALE, logoKylling } from './voxel.js';
import * as M from './modeller.js';
import { Verden, KOL, JOBB, KV, iKV, vanske } from './verden.js';
import { Lyd } from './lyd.js';
import * as T from './toppliste.js';

const $ = (s, c) => (c || document).querySelector(s);
const scene_ = $('#spill');
if (scene_) { start().catch((e) => { feilmelding(); console.error(e); }); }

function feilmelding() {
  const f = $('[data-spill-feil]');
  if (f) { f.hidden = false; }
  const st = $('[data-spill-start]');
  if (st) { st.hidden = true; }
}

async function start() {
  const lerret = $('canvas', scene_);
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) { feilmelding(); return; }

  /* Skiltene bruker nettsidens skrift – vent på den (men ikke for lenge) */
  try {
    await Promise.race([
      Promise.all([document.fonts.load('900 40px Archivo'), document.fonts.load('700 14px Manrope')]),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch (e) { /* skriften er pynt */ }

  /* -------------------------------------------------------------------------
     GRUNNOPPSETT: tegner, scene, kamera og lys
     ------------------------------------------------------------------------- */
  const tegner = new THREE.WebGLRenderer({ canvas: lerret, antialias: true, powerPreference: 'high-performance' });
  tegner.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  tegner.shadowMap.enabled = true;
  tegner.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(F.cream);
  scene.fog = new THREE.Fog(F.cream, 21, 36);

  const kamera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 80);
  const KAMERA_AVSTAND = new THREE.Vector3(3.3, 10, 7.4);
  const fokus = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xFFF6E8, 0x8A9A66, 1.55));
  const sol = new THREE.DirectionalLight(0xFFF0D8, 2.1);
  sol.castShadow = true;
  const mobil = Math.min(window.innerWidth, window.innerHeight) < 600;
  sol.shadow.mapSize.set(mobil ? 1024 : 2048, mobil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 15, bottom: -15, near: 1, far: 45 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.02;
  scene.add(sol, sol.target);

  function tilpass() {
    const b = scene_.clientWidth, h = scene_.clientHeight;
    if (!b || !h) { return; }
    tegner.setSize(b, h, false);
    const forhold = b / h;
    const bredde = forhold < 0.75 ? 8.6 : forhold < 1.1 ? 9.8 : forhold < 1.6 ? 11 : 12;
    kamera.left = -bredde / 2; kamera.right = bredde / 2;
    kamera.top = bredde / 2 / forhold; kamera.bottom = -bredde / 2 / forhold;
    kamera.updateProjectionMatrix();
  }
  new ResizeObserver(tilpass).observe(scene_);
  tilpass();

  /* -------------------------------------------------------------------------
     TEKSTURER, LYD OG UI
     ------------------------------------------------------------------------- */
  const teksturer = { butikk: M.butikkSkilt(), vare: M.vareSkilt(), jobb: M.jobbSkilt() };
  const reklame = new M.Reklame();
  const lyd = new Lyd();

  const ui = {
    poeng: $('[data-poeng]'), pakker: $('[data-pakker]'), sluttPakker: $('[data-slutt-pakker]'), rekord: $('[data-rekord]'), maal: $('[data-maal]'), maalFyll: $('[data-maal-fyll]'),
    melding: $('[data-melding]'), start: $('[data-spill-start]'), slutt: $('[data-spill-slutt]'),
    sluttPoeng: $('[data-slutt-poeng]'), sluttRekord: $('[data-slutt-rekord]'), sluttTittel: $('[data-slutt-tittel]'),
    sluttTekst: $('[data-slutt-tekst]'), nyRekord: $('[data-ny-rekord]'), navnSkjema: $('[data-navn-skjema]'),
    navn: $('[data-navn]'), navnStatus: $('[data-navn-status]'), igjen: $('[data-igjen]'),
    lydKnapp: $('[data-lyd]'), musikkKnapp: $('[data-musikk]'), omstart: $('[data-omstart]'),
    liste: $('[data-toppliste]'), listeStatus: $('[data-toppliste-status]'), listeMerke: $('[data-toppliste-merke]'), listeInfo: $('[data-toppliste-info]'), listeTittel: $('#toppliste-tittel'), pakkeTittelTall: $('[data-pakke-tittel-tall]'),
    pakkeliste: $('[data-pakkeliste]'), pakkeStatus: $('[data-pakkeliste-status]'),
    startRekord: $('[data-start-rekord]'), sluttInfo: $('[data-slutt-info]'), byttNavn: $('[data-bytt-navn]'), feiring: $('[data-feiring]')
  };

  /* -------------------------------------------------------------------------
     KYLLINGEN – logoen som voxelfigur
     ------------------------------------------------------------------------- */
  const kyllingGeo = logoKylling();
  const spiller = {
    gruppe: new THREE.Group(), snu: new THREE.Group(), kropp: new THREE.Mesh(kyllingGeo, MATERIALE),
    x: 0, rad: 0, fraX: 0, fraRad: 0, tilX: 0, tilRad: 0, hopp: 1, kø: null,
    yaw: Math.PI / 2, maalYaw: Math.PI / 2, paa: null, tomgang: 0, klemt: 0
  };
  spiller.kropp.castShadow = true;
  spiller.snu.add(spiller.kropp);
  spiller.gruppe.add(spiller.snu);
  scene.add(spiller.gruppe);
  const HOPP = 0.135;   /* sekunder per hopp */

  /* Måka */
  const maake = M.maake();
  maake.visible = false;
  scene.add(maake);

  /* -------------------------------------------------------------------------
     PIKSELPARTIKLER – støv, fjær, vannsprut og konfetti (én instansmodell)
     ------------------------------------------------------------------------- */
  const ANTALL = 420;
  const partikkelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), ANTALL);
  partikkelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  partikkelMesh.frustumCulled = false;
  const partikler = [];
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), skala = new THREE.Vector3(), farge = new THREE.Color();
  for (let i = 0; i < ANTALL; i++) {
    partikler.push({ aktiv: false, p: new THREE.Vector3(), v: new THREE.Vector3(), liv: 0, maks: 1, str: 0.1, rot: 0, spinn: 0, g: 9 });
    mtx.makeScale(0, 0, 0); partikkelMesh.setMatrixAt(i, mtx);
    partikkelMesh.setColorAt(i, farge.setHex(F.creamHi));
  }
  scene.add(partikkelMesh);
  let nestePartikkel = 0;

  function sprut(x, y, z, antall, farger, o = {}) {
    for (let i = 0; i < antall; i++) {
      const p = partikler[nestePartikkel];
      partikkelMesh.setColorAt(nestePartikkel, farge.setHex(farger[i % farger.length]));
      nestePartikkel = (nestePartikkel + 1) % ANTALL;
      const v = Math.random() * Math.PI * 2, fart = (o.fart || 2) * (0.4 + Math.random() * 0.8);
      p.aktiv = true;
      p.p.set(x + (Math.random() - 0.5) * (o.spredning || 0.3), y, z + (Math.random() - 0.5) * (o.spredning || 0.3));
      p.v.set(Math.cos(v) * fart, (o.opp || 2.5) * (0.6 + Math.random() * 0.7), Math.sin(v) * fart);
      p.maks = p.liv = (o.liv || 0.6) * (0.7 + Math.random() * 0.6);
      p.str = (o.str || 0.08) * (0.7 + Math.random() * 0.6);
      p.rot = Math.random() * 6; p.spinn = (Math.random() - 0.5) * 12;
      p.g = o.tyngde === undefined ? 9 : o.tyngde;
    }
    partikkelMesh.instanceColor.needsUpdate = true;
  }

  function oppdaterPartikler(dt) {
    for (let i = 0; i < ANTALL; i++) {
      const p = partikler[i];
      if (!p.aktiv) { continue; }
      p.liv -= dt;
      if (p.liv <= 0) { p.aktiv = false; mtx.makeScale(0, 0, 0); partikkelMesh.setMatrixAt(i, mtx); continue; }
      p.v.y -= p.g * dt;
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.02 && p.v.y < 0) { p.p.y = 0.02; p.v.multiplyScalar(0.4); p.v.y = 0; }
      p.rot += p.spinn * dt;
      const s = p.str * Math.min(1, (p.liv / p.maks) * 2.2);
      e3.set(p.rot, p.rot * 0.7, 0);
      mtx.compose(p.p, q.setFromEuler(e3), skala.set(s, s, s));
      partikkelMesh.setMatrixAt(i, mtx);
    }
    partikkelMesh.instanceMatrix.needsUpdate = true;
  }

  /* -------------------------------------------------------------------------
     TILSTAND
     ------------------------------------------------------------------------- */
  let verden = null;
  let tilstand = 'meny';             /* meny | spill | dod | over */
  let poeng = 0, rekord = T.personligRekord(), forrigeRekord = rekord;
  let pakker = 0;                    /* Bare Kylling-pakker plukket opp denne runden */
  let rull = 0, rullAktiv = false, feiringTid = 0, jobbNaadd = false, rekordMeldt = false;
  let billett = null, logg = [], sisteTrekk = 0;
  let dodTid = 0, dodAarsak = '', dodTekst = '', dodTog = null, dodBane = null, risting = 0;
  /* «Redusert bevegelse»: kameraet rister ikke */
  const ristSkala = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  /* Topplista: 'global' (felles for alle), 'lokal' (ingen database – bare
     enhetens egen liste) eller 'ukjent' (ikke fått svar ennå). listeFeil er
     satt når siste henting feilet midlertidig; da beholdes den forrige lista. */
  let listeModus = 'ukjent', globalListe = [], globalPakker = [], listeFeil = '';
  let treg = 1, tidsSkala = 1;   /* bare for testing (?test): sakte film */
  let meldingTid = 0;
  let runder = 0;

  const MELDINGER = {
    start: ['Jobbsenteret venter på deg!'],
    igjen: ['Én runde til? Selvfølgelig!', 'Ny dag, nye muligheter!', 'Jobbsenteret venter fortsatt!'],
    bil: ['Du ble nesten til nuggets!', 'Det der var nesten en kyllingburger.', 'Se til begge sider, kylling!'],
    varebil: ['Påkjørt av vår egen varebil. Pinlig!'],
    lastebil: ['Lastebilen hadde det travelt.', 'Du ble nesten til nuggets!'],
    buss: ['Bussen stopper ikke for kyllinger.'],
    bane: ['Bybanen venter ikke på noen.', 'Ding ding! Den var rask.'],
    vann: ['Plask! Kyllinger er ikke laget for svømming.', 'Kyllingfilet skal stekes, ikke kokes.'],
    drift: ['Du drev til havs. Ha det!', 'Neste stopp: Nordsjøen.'],
    maake: ['Måka tok deg. Typisk Bergen.', 'Ikke stå stille – måkene følger med.'],
    rekord: ['Du er offisielt en legendekylling!'],
    jobb: ['Gratulerer! Du kom deg på jobb!']
  };
  const velg = (liste) => liste[Math.floor(Math.random() * liste.length)];

  function melding(tekst, varighet = 2.2) {
    if (!ui.melding) { return; }
    ui.melding.textContent = tekst;
    ui.melding.classList.remove('er-synlig'); void ui.melding.offsetWidth;
    ui.melding.classList.add('er-synlig');
    meldingTid = varighet;
  }

  function oppdaterHud() {
    if (ui.poeng) { ui.poeng.textContent = String(poeng); }
    if (ui.pakker) { ui.pakker.textContent = String(pakker); }
    if (ui.rekord) { ui.rekord.textContent = String(Math.max(rekord, poeng)); }
    if (ui.maal) {
      ui.maal.textContent = !jobbNaadd ? `Jobbsenteret om ${Math.max(0, JOBB - poeng)}`
        : iKV(poeng) ? `Kylling Verden · ${KV.til - poeng + 1} igjen` : 'Uendelig modus';
    }
    if (ui.maalFyll) {
      const fyll = !jobbNaadd ? Math.min(1, poeng / JOBB) : iKV(poeng) ? (poeng - KV.fra) / (KV.til - KV.fra) : 1;
      ui.maalFyll.style.transform = `scaleX(${fyll})`;
    }
  }

  /* -------------------------------------------------------------------------
     NY RUNDE
     ------------------------------------------------------------------------- */
  function nyVerden() {
    if (verden) { verden.fjernAlt(); }
    verden = new Verden(scene, teksturer, reklame, (Math.random() * 2 ** 32) >>> 0);
    verden.sikre(-10, 26);
    Object.assign(spiller, { x: 0, rad: 0, fraX: 0, fraRad: 0, tilX: 0, tilRad: 0, hopp: 1, kø: null, paa: null, tomgang: 0, klemt: 0 });
    spiller.yaw = spiller.maalYaw = Math.PI / 2;
    spiller.gruppe.position.set(0, 0, 0);
    spiller.gruppe.visible = true;
    spiller.snu.rotation.set(0, spiller.yaw, 0);
    spiller.kropp.scale.set(1, 1, 1);
    spiller.kropp.position.set(0, 0, 0);
    poeng = 0; pakker = 0; rull = -1; rullAktiv = false; jobbNaadd = false; feiringTid = 0; rekordMeldt = false;
    forrigeRekord = rekord = T.personligRekord();
    logg = []; billett = null; dodTog = dodBane = null; dodTekst = '';
    maake.visible = false;
    plasserKamera(1);
    oppdaterHud();
  }

  function startSpill() {
    lyd.vekk();
    if (tilstand === 'over' || tilstand === 'dod') { nyVerden(); }
    tilstand = 'spill';
    runder++;
    ui.start && (ui.start.hidden = true);
    ui.slutt && (ui.slutt.hidden = true);
    melding(velg(runder > 1 ? MELDINGER.igjen : MELDINGER.start), 2.4);
    lyd.startMusikk();
    sisteTrekk = performance.now();
    /* Billetten hører til denne runden; en sen billett fra en avbrutt runde brukes ikke */
    const runde = runder;
    if (listeModus !== 'lokal') { T.startRunde().then((b) => { if (runde === runder) { billett = b; } }); }
  }

  /* -------------------------------------------------------------------------
     BEVEGELSE
     ------------------------------------------------------------------------- */
  const RETNING = { u: [0, 1], d: [0, -1], l: [-1, 0], r: [1, 0] };
  const YAW = { u: Math.PI / 2, d: -Math.PI / 2, l: Math.PI, r: 0 };

  function trekk(r) {
    if (tilstand === 'meny') { startSpill(); }
    if (tilstand === 'over') { return; }
    if (tilstand !== 'spill') { return; }
    if (spiller.hopp < 1) { spiller.kø = r; return; }
    utfor(r);
  }

  function utfor(r) {
    const [dx, dr] = RETNING[r];
    /* snu mot den nye retningen (korteste vei rundt) */
    let maal = YAW[r];
    while (maal - spiller.yaw > Math.PI) { maal -= Math.PI * 2; }
    while (maal - spiller.yaw < -Math.PI) { maal += Math.PI * 2; }
    spiller.maalYaw = maal;

    const nyRad = spiller.rad + dr;
    const radNa = verden.rad(spiller.rad), radNy = verden.rad(nyRad);
    let nyX;
    if (dr !== 0) { nyX = radNy && radNy.type === 'elv' ? spiller.x : Math.round(spiller.x); }
    else { nyX = radNa && radNa.type === 'elv' ? spiller.x + dx : Math.round(spiller.x) + dx; }

    const tilElv = radNy && radNy.type === 'elv';
    const ugyldig = !radNy || (tilElv ? Math.abs(nyX) > KOL + 0.45 : verden.blokkert(nyX, nyRad));
    if (ugyldig) {
      lyd.bonk();
      spiller.klemt = 0.12;
      /* små påskeegg der man ikke kommer videre */
      if (r === 'l' && spiller.rad >= 0 && spiller.rad <= 2 && Math.round(spiller.x) === -KOL + 1) { melding('Butikken åpner snart. Sett deg på ventelista.'); }
      else if (r === 'd' && spiller.rad <= -1) { melding('Feil vei! Jobbsenteret er fremover.'); }
      else if (radNy && radNy.type === 'jobb' && Math.round(nyX) !== 0) { melding('Døra er i midten!'); }
      return;
    }

    spiller.fraX = spiller.x; spiller.fraRad = spiller.rad;
    spiller.tilX = nyX; spiller.tilRad = nyRad;
    spiller.hopp = 0;
    spiller.paa = null;
    spiller.tomgang = 0;
    lyd.hopp();
    const radStoev = radNa ? radNa.type : 'gress';
    const stoev = radStoev === 'vei' ? [F.veiMork, F.stein] : radStoev === 'fortau' || radStoev === 'start' ? [F.fortauMork, F.creamHi] : radStoev === 'elv' ? [F.skum, F.vann] : [F.gressMork, F.lov];
    sprut(spiller.x, 0.05, -spiller.rad, 3, stoev, { fart: 0.9, opp: 1.2, liv: 0.35, str: 0.07 });

    const naa = performance.now();
    logg.push(r + Math.max(0, Math.round((naa - sisteTrekk) / 10)).toString(36));
    sisteTrekk = naa;

    if (nyRad > poeng) {
      poeng = nyRad;
      rullAktiv = true;
      if (poeng % 10 === 0 && poeng !== JOBB) { lyd.poeng(); }
      if (poeng === 10) { melding('10 ruter! Godt i gang.'); }
      else if (poeng === 25) { melding('25! Nå snakker vi.'); }
      else if (poeng === JOBB - 10) { melding('Jobbsenteret er rett der fremme!'); }
      else if (poeng === KV.fra) { melding('Velkommen til Kylling Verden! Her ligger det ekstra mange pakker.', 3); lyd.poeng(); }
      else if (poeng === KV.til + 1) { melding('Du klarte Kylling Verden! Tilbake til byen.', 3); lyd.seier(); }
      else if (poeng === 100) { melding('100 ruter! Legendarisk.'); }
      if (!rekordMeldt && forrigeRekord > 0 && poeng > forrigeRekord) { rekordMeldt = true; melding('Ny rekord underveis!'); lyd.poeng(); }
      oppdaterHud();
    }
  }

  function landet() {
    spiller.x = spiller.tilX; spiller.rad = spiller.tilRad;
    spiller.klemt = 0.1;
    const rad = verden.rad(spiller.rad);
    if (rad && rad.type === 'elv') {
      const m = verden.flyter(spiller.x, spiller.rad);
      if (m) {
        spiller.paa = m;
        lyd.lande();
        sprut(spiller.x, 0.02, -spiller.rad, 4, [F.skum, F.vann], { fart: 0.8, opp: 1.4, liv: 0.4, str: 0.06 });
      } else { do_('vann'); return; }
    }
    if (verden.plukk(spiller.x, spiller.rad)) {
      pakker++;
      lyd.pakke();
      sprut(spiller.x, 0.5, -spiller.rad, 14, [F.honey, F.creamHi, F.paprika, F.forest], { fart: 1.6, opp: 3, liv: 0.6, str: 0.07, tyngde: 6 });
      if (pakker === 1) { melding('Bare Kylling-pakke! Samle så mange du kan.', 2); }
      else if (pakker % 5 === 0) { melding(`${pakker} pakker! Matpakka er sikret.`, 2); }
      oppdaterHud();
    }
    if (spiller.rad === JOBB && !jobbNaadd) { feirJobb(); }
    if (spiller.kø) { const k = spiller.kø; spiller.kø = null; utfor(k); }
  }

  function feirJobb() {
    jobbNaadd = true;
    feiringTid = 4;
    lyd.seier();
    melding(MELDINGER.jobb[0], 3.6);
    if (ui.feiring) { ui.feiring.hidden = false; ui.feiring.classList.remove('er-synlig'); void ui.feiring.offsetWidth; ui.feiring.classList.add('er-synlig'); }
    const z = -JOBB;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => sprut((Math.random() - 0.5) * 6, 3.5, z + 0.6, 26,
        [F.honey, F.paprika, F.forest, F.creamHi, F.blaa, F.rosa], { fart: 3.2, opp: 4.5, liv: 1.8, str: 0.11, tyngde: 5, spredning: 4 }), i * 160);
    }
    oppdaterHud();
  }

  /* -------------------------------------------------------------------------
     DØD – tre måter å tape på, alle med sin egen lille animasjon
     ------------------------------------------------------------------------- */
  function do_(aarsak, kjoretoy, r) {
    if (tilstand !== 'spill') { return; }
    tilstand = 'dod';
    dodTid = 0;
    dodAarsak = aarsak;
    spiller.kø = null;
    lyd.stoppMusikk();
    const x = spiller.gruppe.position.x, z = spiller.gruppe.position.z;
    let tekst;
    if (aarsak === 'bil') {
      const len = kjoretoy && kjoretoy.len;
      tekst = velg(len === 1.75 ? MELDINGER.varebil : len === 2.6 ? MELDINGER.lastebil : len === 2.9 ? MELDINGER.buss : MELDINGER.bil);
      lyd.krasj();
      risting = 0.35 * ristSkala;
      sprut(x, 0.4, z, 22, [F.creamHi, F.beige, F.creamHi, F.paprika], { fart: 2.6, opp: 3.4, liv: 1.1, str: 0.09, tyngde: 4 });
    } else if (aarsak === 'bane') {
      tekst = velg(MELDINGER.bane);
      const rad = verden.rad(r);
      dodTog = kjoretoy; dodBane = rad && rad.bane;
      lyd.krasj(); lyd.bjelle();
      risting = 0.5 * ristSkala;
      sprut(x, 0.4, z, 30, [F.creamHi, F.beige, F.paprika], { fart: 4, opp: 4, liv: 1.2, str: 0.1, tyngde: 4 });
    } else if (aarsak === 'vann' || aarsak === 'drift') {
      tekst = velg(MELDINGER[aarsak]);
      lyd.plask();
      sprut(x, 0, z, 26, [F.skum, F.vann, F.hvit], { fart: 1.6, opp: 4.2, liv: 0.9, str: 0.08 });
    } else {
      tekst = velg(MELDINGER.maake);
      lyd.maake();
      maake.visible = true;
      maake.position.set(x + 6, 6, z + 2);
    }
    dodTekst = tekst;
    melding(tekst, 2.8);
    window.setTimeout(() => lyd.tapt(), 450);
    window.setTimeout(visSlutt, (aarsak === 'maake' ? 1900 : 1300) * treg);
  }

  function oppdaterDod(dt) {
    dodTid += dt;
    const k = spiller.kropp;
    if (dodAarsak === 'bane' && dodTog && dodBane) {
      /* Kyllingen klistres til fronten av bybanen og blir med på turen */
      const t = Math.min(1, dodTid / 0.1);
      const p = spiller.gruppe.position;
      if (!dodBane.aktiv) { spiller.gruppe.visible = false; return; }
      p.x = dodTog.x + dodBane.retning * (dodTog.len / 2 + 0.16);
      p.y = 0.3 * t;
      spiller.yaw = spiller.maalYaw = dodBane.retning > 0 ? Math.PI : 0;
      spiller.snu.rotation.y = spiller.yaw;
      k.scale.set(1 - 0.6 * t, 1 + 0.12 * t, 1 + 0.2 * t);
      spiller.snu.rotation.x = Math.sin(dodTid * 9) * 0.12;
    } else if (dodAarsak === 'bil' || dodAarsak === 'bane') {
      const t = Math.min(1, dodTid / 0.12);
      k.scale.set(1 + 0.45 * t, 1 - 0.86 * t, 1 + 0.45 * t);
    } else if (dodAarsak === 'vann' || dodAarsak === 'drift') {
      spiller.gruppe.position.y = -Math.min(0.9, dodTid * 1.1);
      spiller.snu.rotation.z = Math.sin(dodTid * 14) * 0.2;
      if (dodTid > 0.8) { spiller.gruppe.visible = false; }
    } else if (dodAarsak === 'maake') {
      /* Måka stuper ned, griper kyllingen og flyr av gårde med den */
      const p = spiller.gruppe.position;
      const v = maake.userData;
      v.venstre.rotation.x = Math.sin(dodTid * 22) * 0.7;
      v.hoyre.rotation.x = -Math.sin(dodTid * 22) * 0.7;
      if (dodTid < 0.6) {
        const t = dodTid / 0.6;
        maake.position.set(p.x + 6 * (1 - t), 0.9 + 5 * (1 - t) * (1 - t), p.z + 2 * (1 - t));
        maake.rotation.y = Math.PI * 0.85;
      } else {
        const t = dodTid - 0.6;
        maake.position.set(p.x - t * 4, 0.9 + t * 4.5, p.z - t * 2);
        maake.rotation.set(0, Math.PI * 0.85, 0.3);
        spiller.gruppe.position.set(maake.position.x, maake.position.y - 0.85, maake.position.z);
        spiller.snu.rotation.z = Math.sin(dodTid * 8) * 0.3;
      }
    }
  }

  /* -------------------------------------------------------------------------
     SLUTT – poengsum, rekord og toppliste
     ------------------------------------------------------------------------- */
  async function visSlutt() {
    tilstand = 'over';
    const nyRekord = poeng > forrigeRekord;
    if (nyRekord) { rekord = poeng; T.settRekord(poeng); }
    T.leggTilLokal(poeng, T.sisteNavn() || 'Deg', pakker);
    if (ui.sluttPakker) { ui.sluttPakker.textContent = String(pakker); }
    if (ui.sluttPoeng) { ui.sluttPoeng.textContent = String(poeng); }
    if (ui.sluttRekord) { ui.sluttRekord.textContent = String(rekord); }
    const TITLER = { bil: 'Påkjørt!', bane: 'Tatt av bybanen!', vann: 'Plask!', drift: 'Drev til havs!', maake: 'Tatt av måka!' };
    if (ui.sluttTittel) { ui.sluttTittel.textContent = jobbNaadd ? 'Du kom deg på jobb!' : TITLER[dodAarsak] || 'Runden er over'; }
    if (ui.sluttTekst) {
      const fram = jobbNaadd
        ? `Du nådde Jobbsenteret og kom ${poeng - JOBB} ${poeng - JOBB === 1 ? 'rute' : 'ruter'} videre.`
        : poeng > 0 ? `Du kom ${poeng} ${poeng === 1 ? 'rute' : 'ruter'}, ${JOBB - poeng} igjen til Jobbsenteret.` : 'Hopp framover med piltastene, WASD eller ved å sveipe.';
      ui.sluttTekst.textContent = jobbNaadd || !dodTekst ? fram : `${dodTekst} ${fram}`;
    }
    if (ui.nyRekord) { ui.nyRekord.hidden = !nyRekord || poeng === 0; }
    if (ui.navnSkjema) { ui.navnSkjema.hidden = true; }
    if (ui.navnStatus) { ui.navnStatus.textContent = ''; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = ''; }
    if (ui.slutt) { ui.slutt.hidden = false; }
    oppdaterHud();
    if (nyRekord && poeng > 0) {
      lyd.rekord();
      melding(MELDINGER.rekord[0], 3);
      const p = spiller.gruppe.position;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => sprut(p.x, 1.5, p.z, 30, [F.honey, F.paprika, F.forest, F.creamHi, F.rosa, F.blaa], { fart: 3, opp: 4, liv: 1.6, str: 0.1, tyngde: 5, spredning: 2 }), i * 180);
      }
    }
    if (ui.igjen) { ui.igjen.focus({ preventScroll: true }); }

    /* Kom poengsummen på den globale lista? Da kan du skrive kallenavn. */
    await oppdaterToppliste();
    if (listeModus === 'global') { T.forberedBillett(); }   /* klar til neste runde */
    if (ui.byttNavn) { ui.byttNavn.hidden = !(listeModus === 'global' && T.sisteNavn()); }
    if (poeng > 0 && tilstand === 'over' && ui.navnSkjema) {
      if (listeModus === 'global') {
        /* Alle runder kan sendes inn; serveren beholder de 100 beste og sletter
           den svakeste når lista er full. Med husket navn skjer det av seg selv. */
        const topp10 = globalListe.length < 10 || poeng > globalListe[globalListe.length > 10 ? 9 : globalListe.length - 1].poeng;
        if (billett && T.sisteNavn()) { await sendRunde(T.sisteNavn()); }
        else if (billett) { visNavnSkjema('send', topp10 ? 'Du er på topp 10! Skriv inn et kallenavn:' : 'Skriv inn et kallenavn for å komme på topplista:'); }
        else if (ui.sluttInfo) {
          ui.sluttInfo.textContent = 'Runden fikk ikke kontakt med topplista da den startet, så den kan ikke sendes inn. Prøv en runde til!';
        }
      } else if (listeModus === 'lokal' && !T.sisteNavn() && T.lokalListe().some((r) => r.navn === 'Deg' && r.poeng === poeng)) {
        /* Uten global liste: gi runden et navn på enhetens egen liste */
        visNavnSkjema('lokal', 'Gi runden et kallenavn på lista til denne enheten:');
      }
    }
  }

  /* Skjemaet brukes til tre ting: 'send' (navngi og send inn runden),
     'bytt' (velg nytt kallenavn til neste runde) og 'lokal' (enhetens liste) */
  let navnModus = 'send';
  function visNavnSkjema(modus, tekst, status = '') {
    navnModus = modus;
    const etikett = $('label', ui.navnSkjema);
    if (etikett) { etikett.textContent = tekst; }
    ui.navnSkjema.hidden = false;
    if (ui.navnStatus) { ui.navnStatus.textContent = status; }
    if (ui.navn) {
      ui.navn.value = modus === 'bytt' ? '' : T.sisteNavn();
      if (modus === 'bytt' || status) { ui.navn.focus({ preventScroll: true }); }
    }
  }

  /* Sender inn runden under et kallenavn. Navnet huskes på enheten, så neste
     topp 10-runde sendes inn av seg selv. */
  async function sendRunde(navn) {
    const knapp = $('button', ui.navnSkjema);
    if (knapp) { knapp.disabled = true; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = `Lagrer som «${navn}» …`; }
    const svar = await T.sendInn({ billett, navn, poeng, pakker, logg: logg.join(',') });
    if (knapp) { knapp.disabled = false; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = ''; }
    if (svar.ok) {
      T.lagreNavn(navn);
      billett = null;
      ui.navnSkjema.hidden = true;
      const plasser = [svar.plass ? `nummer ${svar.plass} på topplista` : '',
        svar.pakkePlass ? `nummer ${svar.pakkePlass} på pakkelista` : ''].filter(Boolean).join(' og ');
      if (ui.sluttInfo) { ui.sluttInfo.textContent = plasser ? `Lagret som «${navn}» – ${plasser}!` : `Lagret som «${navn}».`; }
      if (ui.byttNavn) { ui.byttNavn.hidden = false; }
      melding(plasser ? `Du er ${plasser}!` : 'Lagret!', 3);
      globalListe = svar.liste; globalPakker = svar.pakker; listeFeil = '';
      tegnListe();
      oppdaterStartKort();
      lyd.poeng();
    } else if (svar.tatt && billett) {
      /* Navnet er tatt av en annen enhet: velg et nytt, runden er ikke brukt opp */
      visNavnSkjema('send', 'Velg et annet kallenavn:', svar.melding);
    } else {
      visNavnSkjema('send', 'Du er på topp 10! Skriv inn et kallenavn:', svar.melding);
    }
  }

  /* Henter topplista (én forespørsel om gangen) og tegner den på nytt */
  let henterListe = null, sistHentet = -Infinity;
  function oppdaterToppliste() {
    if (!henterListe) {
      henterListe = T.hentListe().then((svar) => {
        henterListe = null;
        sistHentet = performance.now();
        if (svar.ok) { listeModus = 'global'; globalListe = svar.liste; globalPakker = svar.pakker; listeFeil = ''; }
        else if (svar.grunn === 'ikke-koblet') { listeModus = 'lokal'; listeFeil = ''; }
        else { listeFeil = svar.grunn; }
        tegnListe();
        oppdaterStartKort();
        return svar;
      });
    }
    return henterListe;
  }

  /* Bryter: topp 10 eller topp 100 */
  function settBryter() {
    const n = T.visAntall();
    document.querySelectorAll('[data-antall]').forEach((k) => k.setAttribute('aria-pressed', String(Number(k.dataset.antall) === n)));
    if (ui.listeTittel) { ui.listeTittel.textContent = `Topp ${n}`; }
    if (ui.pakkeTittelTall) { ui.pakkeTittelTall.textContent = n === 100 ? ' (topp 100)' : ''; }
    [ui.liste, ui.pakkeliste].forEach((ol) => ol && ol.classList.toggle('toppliste__liste--lang', n === 100));
  }
  document.querySelectorAll('[data-antall]').forEach((k) => k.addEventListener('click', () => {
    T.settVisAntall(Number(k.dataset.antall));
    settBryter();
    tegnListe();
    if (listeModus !== 'lokal') { oppdaterToppliste(); }
  }));
  settBryter();

  /* Startkortet: din rekord, og rekorden du skal slå */
  function oppdaterStartKort() {
    if (!ui.startRekord) { return; }
    const deler = rekord > 0 ? [`Din rekord: ${rekord}`] : [];
    const topp = listeModus === 'global' && globalListe[0];
    if (topp) {
      const meg = T.sisteNavn().toLowerCase();
      deler.push(meg && topp.navn.toLowerCase() === meg ? `Du leder topplista med ${topp.poeng}!` : `Rekorden å slå: ${topp.poeng} (${topp.navn})`);
    }
    ui.startRekord.textContent = deler.join(' · ');
  }

  /* Kopien på GitHub Pages har ingen api/, så den kan bare vise enhetens egen liste */
  const paaKopi = /\.github\.io$/.test(location.hostname);

  /* Egen pikselkrone til førsteplassen (ingen emojier) */
  const KRONE = '<svg class="krone" viewBox="0 0 11 8" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="#F1B240" d="M0 0h1v1H0zM5 0h1v1H5zM10 0h1v1h-1zM0 1h2v1H0zM4 1h3v1H4zM9 1h2v1H9zM0 2h3v1H0zM4 2h3v1H4zM8 2h3v1H8zM0 3h11v3H0z"/><path fill="#11110F" d="M0 6h11v2H0z"/><path fill="#A8492A" d="M2 4h1v1H2zM5 4h1v1H5zM8 4h1v1H8z"/></svg>';

  function tegnListe() {
    if (!ui.liste) { return; }
    const global = listeModus === 'global';
    const liste = global ? globalListe : T.lokalListe();
    if (ui.listeMerke) { ui.listeMerke.textContent = global ? 'Global toppliste' : 'Bare denne enheten'; }
    if (ui.listeInfo) {
      ui.listeInfo.textContent = global
        ? 'Topplista er felles for alle som spiller, og oppdaterer seg selv. Skriv inn et kallenavn etter første runde, så kommer rundene dine på lista. De 100 beste lagres.'
        : 'Rekordene her lagres bare i denne nettleseren. Andre som spiller, ser dem ikke.';
    }
    if (ui.listeStatus) {
      const s = ui.listeStatus;
      s.textContent = '';
      if (listeFeil) {
        s.textContent = global ? 'Fikk ikke oppdatert topplista akkurat nå. Prøver igjen …' : 'Fikk ikke kontakt med topplista. Prøver igjen …';
      } else if (global && !liste.length) {
        s.textContent = 'Ingen på lista ennå. Bli den første!';
      } else if (!global && paaKopi) {
        const lenke = document.createElement('a');
        lenke.className = 'link'; lenke.href = 'https://barekylling.no/spill.html'; lenke.textContent = 'barekylling.no';
        s.append('Den felles topplista finnes bare på ', lenke, '. Her er rundene på denne enheten.');
      } else if (!global) {
        s.textContent = 'Den felles topplista er ikke koblet til ennå, så her står bare rundene på denne enheten.';
      }
    }
    tegnRader(ui.liste, liste, 'poeng');
    /* Flest Bare Kylling-pakker */
    const pliste = global ? globalPakker : T.lokalPakkeliste();
    if (ui.pakkeStatus) { ui.pakkeStatus.textContent = pliste.length ? '' : 'Ingen har samlet pakker ennå. Plukk dem opp på veien!'; }
    tegnRader(ui.pakkeliste, pliste, 'pakker');
  }

  function tegnRader(ol, liste, felt) {
    if (!ol) { return; }
    /* Ditt kallenavn markeres (navn er like uansett store og små bokstaver) */
    const meg = T.sisteNavn().toLowerCase();
    ol.textContent = '';
    liste.slice(0, T.visAntall()).forEach((rad, i) => {
      const li = document.createElement('li');
      const erDeg = meg && String(rad.navn).toLowerCase() === meg;
      if (erDeg) { li.classList.add('er-deg'); }
      const plass = document.createElement('span'); plass.className = 'toppliste__plass'; plass.textContent = String(i + 1);
      if (i === 0) { plass.insertAdjacentHTML('beforeend', KRONE); }
      const navn = document.createElement('span'); navn.className = 'toppliste__navn'; navn.textContent = rad.navn;
      if (erDeg) { const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' (deg)'; navn.append(sr); }
      const p = document.createElement('span'); p.className = 'toppliste__poeng'; p.textContent = String(rad[felt]);
      const dato = document.createElement('time'); dato.className = 'toppliste__dato';
      if (rad.dato) {
        dato.dateTime = rad.dato;
        const [aa, mm, dd] = String(rad.dato).slice(0, 10).split('-');
        dato.textContent = `${dd}.${mm}.${String(aa).slice(2)}`;
      }
      li.append(plass, navn, p, dato);
      ol.appendChild(li);
    });
  }

  if (ui.navnSkjema) {
    ui.navnSkjema.addEventListener('submit', async (e) => {
      e.preventDefault();
      const navn = (ui.navn.value || '').trim().replace(/\s+/g, ' ');
      if (navn.length < 2 || navn.length > 16) { ui.navnStatus.textContent = 'Kallenavnet må ha 2–16 tegn.'; ui.navn.focus(); return; }
      if (navnModus === 'lokal') {
        T.lagreNavn(navn);
        T.navngiLokal(poeng, navn);
        tegnListe();
        ui.navnSkjema.hidden = true;
        melding('Lagret på denne enheten!', 2.5);
        lyd.poeng();
        return;
      }
      if (navnModus === 'bytt') {
        const knapp = $('button', ui.navnSkjema);
        knapp.disabled = true;
        ui.navnStatus.textContent = 'Sjekker …';
        const svar = await T.sjekkNavn(navn);
        knapp.disabled = false;
        if (!svar.ok) { ui.navnStatus.textContent = svar.melding; return; }
        T.lagreNavn(svar.navn);
        ui.navnSkjema.hidden = true;
        ui.navnStatus.textContent = '';
        if (ui.sluttInfo) { ui.sluttInfo.textContent = `Fra neste runde heter du «${svar.navn}».`; }
        tegnListe();
        lyd.klikk();
        return;
      }
      ui.navnStatus.textContent = '';
      await sendRunde(navn);
    });
  }
  if (ui.byttNavn) {
    ui.byttNavn.addEventListener('click', () => {
      visNavnSkjema('bytt', `Nytt kallenavn (nå: «${T.sisteNavn()}»). Det brukes fra neste runde:`);
    });
  }

  /* -------------------------------------------------------------------------
     STYRING – piltaster/WASD, sveip og trykk
     ------------------------------------------------------------------------- */
  const TAST = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
  let synlig = true;
  new IntersectionObserver((o) => { synlig = o[0].intersectionRatio > 0.4; }, { threshold: [0, 0.4, 1] }).observe(scene_);

  document.addEventListener('keydown', (e) => {
    const iFelt = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (iFelt || e.altKey || e.ctrlKey || e.metaKey) { return; }
    const r = TAST[e.key];
    if (r && synlig) {
      e.preventDefault();
      if (!e.repeat) { trekk(r); }
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && synlig && tilstand === 'meny') { e.preventDefault(); trekk('u'); }
  });

  let beroring = null;
  scene_.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, a, input, form')) { return; }
    const t = e.changedTouches[0];
    beroring = { x: t.clientX, y: t.clientY, tid: performance.now() };
  }, { passive: true });
  scene_.addEventListener('touchmove', (e) => { if (beroring) { e.preventDefault(); } }, { passive: false });
  scene_.addEventListener('touchend', (e) => {
    if (!beroring) { return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - beroring.x, dy = t.clientY - beroring.y;
    beroring = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) { trekk('u'); }
    else if (Math.abs(dx) > Math.abs(dy)) { trekk(dx > 0 ? 'r' : 'l'); }
    else { trekk(dy > 0 ? 'd' : 'u'); }
    e.preventDefault();
  }, { passive: false });
  lerret.addEventListener('mousedown', (e) => { if (e.button === 0) { trekk('u'); } });

  /* Knapper */
  const settKnapp = (knapp, paa) => { if (knapp) { knapp.setAttribute('aria-pressed', String(paa)); } };
  settKnapp(ui.lydKnapp, lyd.lydPaa);
  settKnapp(ui.musikkKnapp, lyd.musikkPaa);
  ui.lydKnapp && ui.lydKnapp.addEventListener('click', () => { lyd.vekk(); lyd.settLyd(!lyd.lydPaa); settKnapp(ui.lydKnapp, lyd.lydPaa); lyd.klikk(); });
  ui.musikkKnapp && ui.musikkKnapp.addEventListener('click', () => {
    lyd.vekk(); lyd.settMusikk(!lyd.musikkPaa); settKnapp(ui.musikkKnapp, lyd.musikkPaa);
    if (lyd.musikkPaa && tilstand === 'spill') { lyd.startMusikk(); }
  });
  const omstart = () => { lyd.vekk(); lyd.klikk(); lyd.stoppMusikk(); nyVerden(); tilstand = 'meny'; startSpill(); };
  ui.omstart && ui.omstart.addEventListener('click', (e) => { omstart(); e.currentTarget.blur(); });
  ui.igjen && ui.igjen.addEventListener('click', () => { omstart(); });
  ui.start && ui.start.addEventListener('click', (e) => { if (!e.target.closest('a')) { trekk('u'); } });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { lyd.pause(true); } else { lyd.pause(false); forrige = performance.now(); }
  });

  /* -------------------------------------------------------------------------
     KAMERA – følger kyllingen og glir sakte framover (måka følger med!)
     ------------------------------------------------------------------------- */
  const kamX = { v: 0 };
  function plasserKamera(t) {
    const maalZ = -(rull + 2.2);
    const maalX = Math.max(-1.6, Math.min(1.6, spiller.gruppe.position.x * 0.45));
    fokus.z += (maalZ - fokus.z) * t;
    kamX.v += (maalX - kamX.v) * t;
    fokus.x = kamX.v;
    kamera.position.copy(fokus).add(KAMERA_AVSTAND);
    if (risting > 0) { kamera.position.x += (Math.random() - 0.5) * risting * 0.5; kamera.position.y += (Math.random() - 0.5) * risting * 0.5; }
    kamera.lookAt(fokus);
    sol.position.set(fokus.x - 5, 12, fokus.z + 5);
    sol.target.position.copy(fokus);
  }

  function oppdaterRull(dt) {
    const spillerRad = -spiller.gruppe.position.z;
    if (tilstand === 'spill' && rullAktiv && feiringTid <= 0) {
      rull += (0.3 + vanske(poeng) * 0.5) * dt;
    }
    if (spillerRad > rull + 1) { rull += (spillerRad - 1 - rull) * Math.min(1, dt * 3.5); }
    if (tilstand === 'spill' && spillerRad < rull - 4.2) { do_('maake'); }
  }

  /* -------------------------------------------------------------------------
     LØKKA
     ------------------------------------------------------------------------- */
  let forrige = performance.now(), reklameTid = 0;
  function steg(naa) {
    requestAnimationFrame(steg);
    let dt = (naa - forrige) / 1000;
    forrige = naa;
    if (dt <= 0) { return; }
    dt = Math.min(dt, 0.05) * tidsSkala;

    reklameTid += dt;
    if (reklameTid > 1 / 24) { reklame.oppdater(reklameTid); reklameTid = 0; }

    const hendelser = verden.oppdater(dt);
    for (const h of hendelser) {
      if (h.type === 'bybane' && Math.abs(h.rad - spiller.rad) < 7) { lyd.bjelle(); }
    }

    if (feiringTid > 0) { feiringTid -= dt; }
    if (meldingTid > 0) { meldingTid -= dt; if (meldingTid <= 0 && ui.melding) { ui.melding.classList.remove('er-synlig'); } }
    if (risting > 0) { risting = Math.max(0, risting - dt); }

    if (tilstand === 'spill' || tilstand === 'meny') { oppdaterSpiller(dt); }
    if (tilstand === 'dod') { oppdaterDod(dt); }
    oppdaterRull(dt);
    plasserKamera(Math.min(1, dt * 5));
    toneJobb(dt);
    toneHimmel(dt);
    malKvalitet(dt);
    verden.sikre(Math.floor(rull) - 10, Math.floor(rull) + 28);
    oppdaterPartikler(dt);
    tegner.render(scene, kamera);
  }

  /* Himmelen blir varmere i Kylling Verden */
  const HIMMEL = new THREE.Color(F.cream), HIMMEL_KV = new THREE.Color(0xF7DFA4), himmelMaal = new THREE.Color();
  function toneHimmel(dt) {
    himmelMaal.copy(iKV(-fokus.z) ? HIMMEL_KV : HIMMEL);
    scene.background.lerp(himmelMaal, Math.min(1, dt * 1.5));
    scene.fog.color.copy(scene.background);
  }

  /* Jobbsenteret tones ned når kyllingen er bak det, så den ikke forsvinner */
  let jobbSynlig = 1;
  function toneJobb(dt) {
    const rad = verden.rad(JOBB);
    if (!rad || !rad.bygg) { return; }
    const bak = -spiller.gruppe.position.z > JOBB + 0.6 && -spiller.gruppe.position.z < JOBB + 6;
    jobbSynlig += ((bak ? 0.28 : 1) - jobbSynlig) * Math.min(1, dt * 6);
    for (const m of rad.bygg.userData.materialer) { m.opacity = jobbSynlig; m.depthWrite = jobbSynlig > 0.95; }
  }

  /* Tilpasset kvalitet: går det tregt de første sekundene, skrues
     oppløsningen og skyggene ned (svake mobiler og gamle PC-er). */
  let maalTid = 0, maalRammer = 0, kvalitet = 2;
  function malKvalitet(dt) {
    if (kvalitet === 0 || tilstand !== 'spill') { return; }
    maalTid += dt; maalRammer++;
    if (maalTid < 2.5) { return; }
    const fps = maalRammer / maalTid;
    maalTid = 0; maalRammer = 0;
    if (fps < 40 && kvalitet === 2) {
      kvalitet = 1;
      tegner.setPixelRatio(1);
      sol.shadow.mapSize.set(1024, 1024);
      sol.shadow.map && sol.shadow.map.dispose(); sol.shadow.map = null;
      tegner.shadowMap.type = THREE.PCFShadowMap;
      scene.traverse((o) => { if (o.material) { o.material.needsUpdate = true; } });
      tilpass();
    } else if (fps < 24 && kvalitet === 1) {
      kvalitet = 0;
      tegner.shadowMap.enabled = false;
      scene.traverse((o) => { if (o.material) { o.material.needsUpdate = true; } });
    }
  }

  function oppdaterSpiller(dt) {
    const s = spiller, g = s.gruppe;
    if (s.hopp < 1) {
      s.hopp = Math.min(1, s.hopp + dt / HOPP);
      const t = s.hopp;
      const x = s.fraX + (s.tilX - s.fraX) * t;
      const zRad = s.fraRad + (s.tilRad - s.fraRad) * t;
      g.position.set(x, Math.sin(t * Math.PI) * 0.42, -zRad);
      s.kropp.scale.set(0.94, 1.12, 0.94);
      if (s.hopp >= 1) { g.position.y = 0; landet(); }
    } else {
      /* Står stille: puster, og blir med stokken hvis den står på en */
      if (s.paa) {
        const rad = verden.rad(s.rad);
        s.x += (rad ? rad.fart : 0) * dt;
        if (Math.abs(s.x) > KOL + 0.75) { do_('drift'); return; }
      }
      g.position.set(s.x, s.paa ? s.paa.mesh.position.y : 0, -s.rad);
      s.tomgang += dt;
      const pust = 1 + Math.sin(s.tomgang * 4) * 0.025;
      if (s.klemt > 0) {
        s.klemt -= dt;
        s.kropp.scale.set(1.12, 0.8, 1.12);
      } else {
        s.kropp.scale.set(1, pust, 1);
      }
      /* Av og til et lite nikk (som om den hakker etter noe) */
      const nikk = (s.tomgang % 3.6) > 3.25 ? Math.sin(((s.tomgang % 3.6) - 3.25) / 0.35 * Math.PI) * 0.35 : 0;
      s.kropp.rotation.z = -nikk;
    }
    /* Snu mykt, med litt overskudd */
    s.yaw += (s.maalYaw - s.yaw) * Math.min(1, dt * 22);
    s.snu.rotation.y = s.yaw;

    /* Kollisjoner med trafikken (også midt i hoppet) */
    if (tilstand === 'spill') {
      const radNa = s.hopp < 0.55 ? s.fraRad : s.tilRad;
      const m = verden.treff(g.position.x, radNa);
      if (m) { do_(m.tog ? 'bane' : 'bil', m, radNa); }
      /* Lyd når noe kjører tett forbi */
      for (const dr of [-1, 0, 1]) {
        const rad = verden.rad(s.rad + dr);
        if (!rad || rad.type !== 'vei') { continue; }
        for (const k of rad.flytt) {
          k.lyd = Math.max(0, (k.lyd || 0) - dt);
          if (k.lyd === 0 && Math.abs(k.x - g.position.x) < 1.2) {
            k.lyd = 2.5;
            lyd.forbi(dr === 0 ? 0.07 : 0.04);
            if (k.horn && Math.random() < 0.35) { lyd.horn(); }
          }
        }
      }
    }
  }

  /* -------------------------------------------------------------------------
     I GANG
     ------------------------------------------------------------------------- */
  nyVerden();
  oppdaterStartKort();
  oppdaterToppliste().then((svar) => { if (svar.ok) { T.forberedBillett(); } });

  /* Topplista oppdateres av seg selv mens siden er synlig, så nye rekorder fra
     andre dukker opp uten at noen må laste siden på nytt. */
  const OPPDATER_HVERT = 20000;
  window.setInterval(() => {
    if (document.hidden || listeModus === 'lokal') { return; }
    if (performance.now() - sistHentet >= OPPDATER_HVERT) { oppdaterToppliste(); }
  }, 2500);
  requestAnimationFrame((t) => { forrige = t; steg(t); });
  scene_.classList.add('er-klar');

  /* For automatiske tester (bare med ?test i adressen): litt innsyn og en
     snarvei til en senere rad, så Jobbsenteret kan testes uten å spille dit. */
  if (/[?&]test\b/.test(location.search)) {
    window.__bkSpill = {
      trekk, tilstand: () => tilstand, poeng: () => poeng, pakker: () => pakker,
      pakkeRader: () => [...Array(80).keys()].map((r) => verden.rad(r)).filter((d) => d && d.pakke).map((d) => ({ rad: d.rad, x: d.pakke.x, tatt: d.pakke.tatt })), spiller: () => ({ x: spiller.x, rad: spiller.rad }),
      rull: () => ({ rull, rullAktiv, feiringTid, z: spiller.gruppe.position.z }),
      treg: (k) => { treg = k; }, sakte: (k) => { tidsSkala = k; },
      rad: (r) => { const d = verden.rad(r); return d ? { type: d.type, blokk: [...d.blokk], fart: d.fart, flytt: d.flytt.map((m) => ({ x: m.x, len: m.len })) } : null },
      hoppTil: (n, x = 0) => {
        verden.sikre(-10, n + 28);
        Object.assign(spiller, { x, rad: n, tilX: x, tilRad: n, hopp: 1, paa: null });
        spiller.gruppe.position.set(x, 0, -n);
        poeng = n; rull = n - 1; oppdaterHud();
      }
    };
  }
}
