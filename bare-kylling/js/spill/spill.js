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
import { Verden, KOL, JOBB, vanske, verdenFor } from './verden.js';
import { Bane, dagFrø, osloDato } from './bane.mjs';
import { Lyd } from './lyd.js';
import * as T from './toppliste.js';
import * as B from './butikk.js';
import * as ME from './merker.js';
import * as D from './del.js';

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
    startRekord: $('[data-start-rekord]'), effekt: $('[data-effekt]'), sluttInfo: $('[data-slutt-info]'), byttNavn: $('[data-spill-slutt] [data-bytt-navn]'), feiring: $('[data-feiring]')
  };

  /* -------------------------------------------------------------------------
     KYLLINGEN – logoen som voxelfigur
     ------------------------------------------------------------------------- */
  const kyllingGeo = logoKylling(B.kroppsfarge());
  /* Kyllingen har eget materiale og tegnes sist, etter en «røntgen»-silhuett:
     silhuetten vises bare der noe i verdenen står foran kyllingen (stempel,
     skilt, hus), så kyllingen aldri forsvinner. */
  const kyllingMateriale = MATERIALE.clone();
  kyllingMateriale.transparent = true;
  kyllingMateriale.opacity = 1;
  const silhuettMateriale = new THREE.MeshBasicMaterial({ color: F.ink, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: THREE.GreaterDepth });
  const spiller = {
    gruppe: new THREE.Group(), snu: new THREE.Group(), kropp: new THREE.Mesh(kyllingGeo, kyllingMateriale),
    x: 0, rad: 0, fraX: 0, fraRad: 0, tilX: 0, tilRad: 0, hopp: 1, kø: null,
    yaw: Math.PI / 2, maalYaw: Math.PI / 2, paa: null, tomgang: 0, klemt: 0, molle: 0, glid: false
  };
  spiller.kropp.castShadow = true;
  spiller.kropp.renderOrder = 2;
  const silhuett = new THREE.Mesh(kyllingGeo, silhuettMateriale);
  silhuett.renderOrder = 1;
  spiller.kropp.add(silhuett);
  spiller.snu.add(spiller.kropp);
  spiller.gruppe.add(spiller.snu);
  scene.add(spiller.gruppe);
  const HOPP = 0.135;   /* sekunder per hopp */
  const HOPP_FART = 0.08;   /* med Sweet Paprika-fart */

  /* GUD-MODUS: kallenavnet «barefjær» gjør kyllingen udødelig. Slike runder
     sendes ikke til topplista (serveren har også navnet som reservert). */
  const erGudNavn = (n) => String(n || '').trim().toLowerCase().replace(/æ/g, 'ae') === 'barefjaer';
  const gud = () => erGudNavn(T.sisteNavn());
  function oppdaterGud() {
    const el = document.querySelector('[data-gud]');
    if (el) { el.hidden = !gud(); }
    if (gud() && tilstand === 'spill') { gudIRunden = true; }
    oppdaterMeg();
  }

  /* Pynt og farge fra butikken */
  const kroppGeo = new Map([[B.kroppsfarge(), kyllingGeo]]);
  function kleKylling() {
    const farge = B.kroppsfarge();
    if (!kroppGeo.has(farge)) { kroppGeo.set(farge, logoKylling(farge)); }
    spiller.kropp.geometry = kroppGeo.get(farge);
    silhuett.geometry = spiller.kropp.geometry;
    for (const barn of [...spiller.kropp.children]) { if (barn !== silhuett) { spiller.kropp.remove(barn); } }
    const paa = B.paaDeg();
    for (const id of [paa.hode, paa.ansikt, paa.kropp, paa.rygg, paa.bein]) {
      const m = id && M.pynt(id);
      /* Pynten tegnes sammen med kyllingen, så silhuetten ikke legger seg over klærne */
      if (m) { m.material = kyllingMateriale; m.renderOrder = 2; spiller.kropp.add(m); }
    }
  }
  kleKylling();
  const skjold = M.skjoldRamme();
  skjold.visible = false;
  spiller.gruppe.add(skjold);

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
  /* Kraftpakker: tidene er i ekte millisekunder (som trekkloggen), så de
     slutter på samme tid som serveren regner med */
  const effekt = { skjold: false, fartTil: 0, magnetTil: 0, uskadeligTil: 0 };
  /* Det som skjedde i runden */
  let runde = { kraft: 0, kombo: false, stjalet: false };
  const fartAktiv = () => performance.now() < effekt.fartTil;
  const magnetAktiv = () => performance.now() < effekt.magnetTil;
  /* Kombo: 10 hopp framover på rad (uten å stoppe) gir dobbel pakke i
     lommeboka. Bare lommeboka: pakkelista teller ekte pakker. */
  const KOMBO = 10, KOMBO_PAUSE = 900;
  let kombo = 0, bonus = 0;
  const komboAktiv = () => kombo >= KOMBO && performance.now() - sisteTrekk < KOMBO_PAUSE;
  let gudIRunden = false;            /* gud-modus var på en gang i runden: sendes ikke inn */
  const opplast = new Set();         /* premier låst opp i denne økta */
  let rull = 0, rullAktiv = false, feiringTid = 0, jobbNaadd = false, rekordMeldt = false;
  let billett = null, logg = [], sisteTrekk = 0;
  let dodTid = 0, dodAarsak = '', dodTekst = '', dodTog = null, dodBane = null, risting = 0, dodVerden = 'by';
  let pakketKylling = null;   /* pakken kyllingen blir til i stempelet */
  /* «Redusert bevegelse»: kameraet rister ikke */
  const ristSkala = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  /* Topplista: 'global' (felles for alle), 'lokal' (ingen database – bare
     enhetens egen liste) eller 'ukjent' (ikke fått svar ennå). listeFeil er
     satt når siste henting feilet midlertidig; da beholdes den forrige lista. */
  let listeModus = 'ukjent', globalListe = [], globalPakker = [], globalDag = [], listeFeil = '';
  let dagensRunde = false;   /* runden spilles på dagens rute */
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
    traktor: ['Traktoren hadde forkjørsrett.'],
    fiskevogn: ['Overkjørt av en fiskevogn. Ferskvare!'],
    truck: ['Trucken leverte deg til feil avdeling.'],
    trillebord: ['Trillebordet tok deg med til kjøkkenet.'],
    vektskive: ['Den skiva var 20 kilo for mye.', 'Vektskiva rullet rett over deg.'],
    ball: ['Treningsballen vant.'],
    kyllingtog: ['Kyllingtoget stopper ikke for kyllinger.'],
    floibane: ['Fløibanen skulle til Fløyen, ikke over deg.'],
    stang: ['Vektstanga tok deg. Husk å varme opp.'],
    stempel: ['Du ble pakket inn. Klar for butikk!'],
    grill: ['Grillkylling var ikke planen.', 'Varmt! Grillplata var på.'],
    vannKylling: ['Plask! Rett i sausen.', 'Kyllingfilet i saus. Ikke helt planen.'],
    vannBrygge: ['Plask! Rett i Vågen.', 'Kyllinger er ikke laget for svømming.'],
    driftBrygge: ['Du drev ut Vågen. Neste stopp: Nordsjøen.'],
    krydret: ['Du ble krydret!'],
    skjold: ['Original-skjold! Du tåler én smell.'],
    fart: ['Sweet Paprika! Full fart i fem sekunder.'],
    magnet: ['Matboks-magnet! Pakkene kommer til deg.'],
    reddet: ['Skjoldet tok støyten!', 'Puh! Skjoldet reddet deg.'],
    tyveri: ['Måka stjal en pakke! Neste gang tar den deg.', 'Typisk Bergen: måka tok matpakka.', 'Måka fikk lunsj. Du får ikke ny sjanse.'],
    rekord: ['Du er offisielt en legendekylling!'],
    jobb: ['Gratulerer! Du kom deg på jobb!']
  };
  const velg = (liste) => liste[Math.floor(Math.random() * liste.length)];
  /* Meldingen når du går inn i en ny verden */
  function velkommen(v) {
    return {
      by: 'Tilbake i byen! Nå er det bare å holde ut.',
      kylling: 'Velkommen til Kylling Verden! Her ligger det ekstra mange pakker.',
      brygge: 'Bryggen! Det regner, selvfølgelig. Måkene er sultne.',
      fabrikk: 'Fabrikken. Hold deg unna stempelet.',
      trening: pakker > 0 ? 'Ekte mat etter trening.' : 'Glemte du matpakka?'
    }[v.id];
  }

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
    const forbi = jobbNaadd || poeng > JOBB + 2, v = verdenFor(poeng);
    if (ui.maal) {
      ui.maal.textContent = !forbi ? `Jobbsenteret om ${Math.max(0, JOBB - poeng)}` : v.til === Infinity ? 'Uendelig modus' : `${v.navn} · ${v.til - poeng + 1} igjen`;
    }
    if (ui.maalFyll) {
      const fyll = !forbi ? Math.min(1, poeng / JOBB) : v.til === Infinity ? 1 : (poeng - v.fra) / (v.til - v.fra);
      ui.maalFyll.style.transform = `scaleX(${Math.max(0, Math.min(1, fyll))})`;
    }
  }

  /* -------------------------------------------------------------------------
     NY RUNDE
     ------------------------------------------------------------------------- */
  /* b: billetten fra serveren ({ billett, frø }) eller null. Verdenen bygges
     fra frøet i billetten, så serveren kan regne ut den samme banen. Uten
     billett (frakoblet eller lokalt) får runden et tilfeldig frø og kan ikke
     sendes inn. */
  function nyVerden(b = null) {
    if (verden) { verden.fjernAlt(); }
    verden = new Verden(scene, teksturer, reklame, new Bane(b ? b.frø : (Math.random() * 2 ** 32) >>> 0));
    verden.sikre(-10, 26);
    Object.assign(spiller, { x: 0, rad: 0, fraX: 0, fraRad: 0, tilX: 0, tilRad: 0, hopp: 1, kø: null, paa: null, tomgang: 0, klemt: 0, molle: 0, glid: false });
    spiller.yaw = spiller.maalYaw = Math.PI / 2;
    spiller.gruppe.position.set(0, 0, 0);
    spiller.gruppe.visible = true;
    spiller.snu.rotation.set(0, spiller.yaw, 0);
    spiller.kropp.scale.set(1, 1, 1);
    spiller.kropp.position.set(0, 0, 0);
    poeng = 0; pakker = 0; gudIRunden = false; rull = -1; rullAktiv = false; jobbNaadd = false; feiringTid = 0; rekordMeldt = false;
    forrigeRekord = rekord = T.personligRekord();
    logg = []; billett = b ? b.billett : null; dodTog = dodBane = null; dodTekst = '';
    dagensRunde = !!(b && b.dagens);
    maakeHarStjaalet = false; tyveri = null; molleMeldt = false; tryggMeldt = false;
    Object.assign(effekt, { skjold: false, fartTil: 0, magnetTil: 0, uskadeligTil: 0 });
    runde = { kraft: 0, kombo: false, stjalet: false };
    kombo = 0; bonus = 0;
    skjold.visible = false;
    if (b && listeModus === 'global') { T.forberedBillett(); }   /* neste runde har én klar */
    maake.visible = false;
    if (pakketKylling) { pakketKylling.visible = false; }
    lyd.settVerden('by');
    plasserKamera(1);
    oppdaterHud();
  }

  function startSpill() {
    lyd.vekk();
    if (tilstand === 'over' || tilstand === 'dod') { nyVerden(T.taKlarBillett()); }
    tilstand = 'spill';
    runder++;
    gudIRunden = gud();
    ui.start && (ui.start.hidden = true);
    ui.slutt && (ui.slutt.hidden = true);
    melding(gud() ? 'Gud-modus: ingenting kan stoppe deg!' : dagensRunde ? 'Dagens rute! Samme bane for alle i dag.' : velg(runder > 1 ? MELDINGER.igjen : MELDINGER.start), 2.4);
    if (dagensRunde) { T.registrerDag(osloDato()); }
    lyd.startMusikk();
    sisteTrekk = performance.now();
  }

  /* -------------------------------------------------------------------------
     BEVEGELSE
     ------------------------------------------------------------------------- */
  const RETNING = { u: [0, 1], d: [0, -1], l: [-1, 0], r: [1, 0] };
  const YAW = { u: Math.PI / 2, d: -Math.PI / 2, l: Math.PI, r: 0 };

  function trekk(r) {
    if (butikkApen || navnApen) { return; }
    if (tilstand === 'meny') { startSpill(); }
    /* Runden er over: en piltast eller WASD starter neste runde (litt
       ventetid, så et tastetrykk i det kyllingen dør ikke starter med en gang) */
    if (tilstand === 'over') { if (performance.now() - sluttTid > 600) { omstart(); } return; }
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

    /* På elva: hopp rett mot midten av ruta på stokken (der den er når
       kyllingen lander), så man ikke lander på kanten */
    let tilY = 0;
    if (tilElv) {
      const rute = verden.flyterVed(nyX, nyRad, fartAktiv() ? HOPP_FART : HOPP);
      if (rute) { nyX = rute.x; tilY = rute.topp; }
    }
    spiller.fraY = spiller.gruppe.position.y; spiller.tilY = tilY;
    spiller.fraX = spiller.x; spiller.fraRad = spiller.rad;
    spiller.tilX = nyX; spiller.tilRad = nyRad;
    spiller.hopp = 0;
    spiller.paa = null;
    spiller.tomgang = 0;
    spiller.molle = 0;
    spiller.glid = false;
    lyd.hopp();
    const radStoev = radNa ? radNa.type : 'gress';
    const stoev = radStoev === 'vei' ? [F.veiMork, F.stein] : radStoev === 'fortau' || radStoev === 'start' ? [F.fortauMork, F.creamHi] : radStoev === 'elv' ? [F.skum, F.vann] : [F.gressMork, F.lov];
    sprut(spiller.x, 0.05, -spiller.rad, 3, stoev, { fart: 0.9, opp: 1.2, liv: 0.35, str: 0.07 });
    /* Spor fra butikken (bare pynt; ikke med «redusert bevegelse») */
    const spor = ristSkala > 0 && B.vare(B.paaDeg().spor);
    if (spor) {
      sprut(spiller.x, 0.25, -spiller.rad, spor.glitter ? 7 : 5, spor.farger,
        spor.glitter ? { fart: 0.5, opp: 1.6, liv: 0.9, str: 0.05, tyngde: 0.6 } : { fart: 0.7, opp: 1.1, liv: 0.55, str: 0.05 });
    }

    const naa = performance.now();
    if (r === 'u' && naa - sisteTrekk < KOMBO_PAUSE) { kombo++; } else { kombo = r === 'u' ? 1 : 0; }
    if (kombo === KOMBO) { melding('Kombo! Doble pakker i lommeboka.', 2); lyd.kraft(); runde.kombo = true; sjekkOppdrag(); }
    logg.push(r + Math.max(0, Math.round((naa - sisteTrekk) / 10)).toString(36));
    sisteTrekk = naa;

    if (nyRad > poeng) {
      poeng = nyRad;
      rullAktiv = true;
      if (poeng % 10 === 0 && poeng !== JOBB) { lyd.poeng(); }
      const v = verdenFor(poeng);
      if (poeng === v.fra && poeng > JOBB) { melding(velkommen(v), 3); lyd.poeng(); }
      /* Premier: første gang du når rad 150 og 250 */
      const premie = B.PREMIER.find((v) => v.rad === poeng && forrigeRekord < v.rad && !opplast.has(v.id));
      if (premie) {
        opplast.add(premie.id);
        T.settRekord(Math.max(T.personligRekord(), poeng));   /* låser opp med en gang, også om runden ender straks */
        B.taPaa(premie.id); kleKylling();
        melding(`Du låste opp ${premie.navn.toLowerCase()}! Finn den i butikken.`, 3.5);
        lyd.seier();
        sprut(spiller.x, 1.2, -spiller.rad, 30, [F.honey, F.creamHi, F.paprika], { fart: 2.4, opp: 4, liv: 1.2, str: 0.09, tyngde: 5 });
      }
      if (!rekordMeldt && forrigeRekord > 0 && poeng > forrigeRekord) { rekordMeldt = true; lyd.poeng(); }
      sjekkOppdrag();
      oppdaterHud();
    }
  }

  function landet() {
    spiller.x = spiller.tilX; spiller.rad = spiller.tilRad;
    spiller.klemt = spiller.glid ? 0 : 0.1;
    spiller.glid = false;
    const rad = verden.rad(spiller.rad);
    if (rad && rad.type === 'elv') {
      const m = verden.flyter(spiller.x, spiller.rad);
      if (m) {
        spiller.paa = m;
        plask(m, spiller.x, spiller.rad);
      } else { do_('vann'); return; }
    }
    const kraft = verden.plukkKraft(spiller.x, spiller.rad);
    if (kraft) {
      logg.push(`k${spiller.rad.toString(36)}.${kraft.x + KOL}`);      /* serveren kontrollerer kraftpakken */
      const naa = performance.now();
      if (kraft.slag === 'skjold') { effekt.skjold = true; skjold.visible = true; }
      if (kraft.slag === 'fart') { effekt.fartTil = naa + 4800; }
      if (kraft.slag === 'magnet') { effekt.magnetTil = naa + 5800; }
      melding(MELDINGER[kraft.slag][0], 2.4);
      lyd.kraft();
      sprut(spiller.x, 0.6, -spiller.rad, 22, [F.honey, F.creamHi, kraft.slag === 'fart' ? F.paprika : F.forest], { fart: 2, opp: 3.4, liv: 0.8, str: 0.08, tyngde: 5 });
      runde.kraft++;
      sjekkOppdrag();
    }
    const tattPakke = verden.plukk(spiller.x, spiller.rad);
    if (tattPakke) { taPakke(tattPakke, spiller.rad); }
    trekkMagnet();
    if (spiller.rad === JOBB && !jobbNaadd) { feirJobb(); }
    if (spiller.kø) { const k = spiller.kø; spiller.kø = null; utfor(k); }
  }

  /* MERKER: låses opp for godt (første gang på jobb, hver verden, 100 pakker,
     ti dager med dagens rute) */
  const dagerSpilt = () => { try { return (JSON.parse(localStorage.getItem('bk-spill-dager') || '[]') || []).length; } catch (e) { return 0; } };
  function sjekkMerker(ekstraPakker = pakker) {
    for (const m of ME.sjekk({ poeng, pakkerTotalt: ME.pakkerTotalt() + ekstraPakker, dager: dagerSpilt() })) {
      melding(`Nytt merke: ${m.navn}!`, 3);
      lyd.seier();
    }
  }

  /* Merkene sjekkes når noe skjer i runden */
  const sjekkOppdrag = () => { if (tilstand === 'spill' || tilstand === 'over') { sjekkMerker(); } };

  /* Kraft og kombo vises i HUD-en; kyllingen blinker mens den er uskadelig */
  let sisteEffekt = '';
  function visEffekt() {
    const naa = performance.now(), deler = [];
    if (effekt.skjold) { deler.push('Skjold'); }
    if (naa < effekt.fartTil) { deler.push(`Fart ${Math.ceil((effekt.fartTil - naa) / 1000)}`); }
    if (naa < effekt.magnetTil) { deler.push(`Magnet ${Math.ceil((effekt.magnetTil - naa) / 1000)}`); }
    if (komboAktiv()) { deler.push('Kombo ×2'); }
    const tekst = deler.join(' · ');
    if (tekst !== sisteEffekt && ui.effekt) { sisteEffekt = tekst; ui.effekt.textContent = tekst; ui.effekt.hidden = !tekst; }
    spiller.kropp.visible = !(naa < effekt.uskadeligTil && Math.floor(naa / 90) % 2);
  }

  /* En pakke er plukket (rad r). Serveren får vite det i loggen. */
  function taPakke(p, r, langt = false) {
    pakker++;
    if (komboAktiv()) { bonus++; }
    queueMicrotask(sjekkOppdrag);
    logg.push(`p${r.toString(36)}.${p.x + KOL}`);
    lyd.pakke();
    sprut(p.x, 0.5, -r, langt ? 8 : 14, [F.honey, F.creamHi, F.paprika, F.forest], { fart: 1.6, opp: 3, liv: 0.6, str: 0.07, tyngde: 6 });
    oppdaterHud();
  }

  /* Magneten trekker inn pakker i raden og raden foran (to kolonner til hver side) */
  function trekkMagnet() {
    if (!magnetAktiv() || tilstand !== 'spill' || spiller.hopp < 1) { return; }
    for (const r of [spiller.rad, spiller.rad + 1]) {
      for (const p of verden.pakkerNaer(spiller.x, r, 2)) {
        p.tatt = true; p.mesh.visible = false;
        taPakke(p, r, true);
      }
    }
  }

  /* PLASK: stokken dukker, vannet spruter ut til sidene og en ring brer seg
     (ringen og vippingen ikke med «redusert bevegelse») */
  const ringer = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: F.skum, transparent: true, opacity: 0, depthWrite: false });
    const g = new THREE.Group();
    for (const [w, d, x, z] of [[1, 0.08, 0, 0.5], [1, 0.08, 0, -0.5], [0.08, 1, 0.5, 0], [0.08, 1, -0.5, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), mat);
      b.position.set(x, 0, z);
      g.add(b);
    }
    g.visible = false;
    scene.add(g);
    ringer.push({ g, mat, t: 1 });
  }
  let nesteRing = 0;
  function plask(m, x, r) {
    m.dukk = 1;
    m.dukkLok = x - m.x;
    verden.rolig = ristSkala === 0;
    lyd.lande(); lyd.plupp();
    const farger = verden.vannFarger(r), z = -r;
    const mange = ristSkala === 0 ? 3 : 10;
    for (const s of [-1, 1]) {
      sprut(x, -0.1, z + s * 0.45, mange, [farger[1], farger[0], F.hvit, farger[1]], { fart: 1.8, opp: 3.2, liv: 0.6, str: 0.1, spredning: 0.7 });
    }
    if (ristSkala === 0) { return; }
    const ring = ringer[nesteRing];
    nesteRing = (nesteRing + 1) % ringer.length;
    ring.t = 0;
    ring.mat.color.setHex(farger[1]);
    ring.g.position.set(x, -0.165, z);
    ring.g.visible = true;
  }
  function oppdaterRinger(dt) {
    for (const ring of ringer) {
      if (!ring.g.visible) { continue; }
      ring.t += dt / 0.6;
      if (ring.t >= 1) { ring.g.visible = false; continue; }
      const s = 1.1 + ring.t * 1.6;
      ring.g.scale.set(s, 1, s);
      ring.mat.opacity = 0.9 * (1 - ring.t);
    }
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
    if (gud()) { return; }   /* gud-modus: ingenting tar livet av kyllingen */
    if (performance.now() < effekt.uskadeligTil && aarsak !== 'maake' && aarsak !== 'vann' && aarsak !== 'drift') { return; }
    if (effekt.skjold && ['bil', 'bane', 'stempel', 'grill'].includes(aarsak)) {
      /* Skjoldet tar smellen, og kyllingen er uskadelig et lite øyeblikk */
      effekt.skjold = false; skjold.visible = false;
      effekt.uskadeligTil = performance.now() + 1200;
      melding(velg(MELDINGER.reddet), 2);
      lyd.bonk(); lyd.kraft();
      risting = 0.2 * ristSkala;
      sprut(spiller.gruppe.position.x, 0.6, spiller.gruppe.position.z, 18, [F.lovLys, F.forest, F.creamHi], { fart: 2.4, opp: 2.6, liv: 0.6, str: 0.08 });
      return;
    }
    tilstand = 'dod';
    dodTid = 0;
    dodAarsak = aarsak;
    spiller.kø = null;
    lyd.stoppMusikk();
    const x = spiller.gruppe.position.x, z = spiller.gruppe.position.z;
    let tekst;
    const verdenId = verdenFor(spiller.rad).id;
    dodVerden = verdenId;
    if (aarsak === 'bil') {
      const len = kjoretoy && kjoretoy.len;
      tekst = velg(MELDINGER[kjoretoy && kjoretoy.slag] || (len === 1.75 ? MELDINGER.varebil : len === 2.6 ? MELDINGER.lastebil : len === 2.9 ? MELDINGER.buss : MELDINGER.bil));
      lyd.krasj();
      risting = 0.35 * ristSkala;
      sprut(x, 0.4, z, 22, [F.creamHi, F.beige, F.creamHi, F.paprika], { fart: 2.6, opp: 3.4, liv: 1.1, str: 0.09, tyngde: 4 });
    } else if (aarsak === 'stempel') {
      tekst = velg(MELDINGER.stempel);
      lyd.stempel();
      risting = 0.4 * ristSkala;
      sprut(x, 0.3, z, 18, [F.honey, F.creamHi, 0xA9ADB2], { fart: 2.4, opp: 2.5, liv: 0.8, str: 0.08 });
    } else if (aarsak === 'grill') {
      tekst = velg(MELDINGER.grill);
      lyd.fres();
      sprut(x, 0.3, z, 22, [0x8E8E8E, 0xBFBFBF, F.oransje], { fart: 0.6, opp: 2.2, liv: 1.2, str: 0.1, tyngde: -0.5 });
    } else if (aarsak === 'bane') {
      const rad = verden.rad(r);
      tekst = velg(MELDINGER[rad && rad.bane && rad.bane.variant] || MELDINGER.bane);
      dodTog = kjoretoy; dodBane = rad && rad.bane;
      lyd.krasj(); lyd.bjelle();
      risting = 0.5 * ristSkala;
      sprut(x, 0.4, z, 30, [F.creamHi, F.beige, F.paprika], { fart: 4, opp: 4, liv: 1.2, str: 0.1, tyngde: 4 });
    } else if (aarsak === 'vann' || aarsak === 'drift') {
      const egne = verdenId === 'fabrikk' ? MELDINGER.krydret : verdenId === 'kylling' ? MELDINGER.vannKylling
        : verdenId === 'brygge' ? (aarsak === 'drift' ? MELDINGER.driftBrygge : MELDINGER.vannBrygge) : null;
      tekst = velg(egne || MELDINGER[aarsak]);
      lyd.plask();
      sprut(x, 0, z, 26, verdenId === 'fabrikk' ? [F.paprika, F.honey, F.paprikaDeep] : [F.skum, F.vann, F.hvit], { fart: 1.6, opp: 4.2, liv: 0.9, str: 0.08 });
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
    } else if (dodAarsak === 'stempel') {
      /* Flatklemt, og så: en ferdig pakke */
      const t = Math.min(1, dodTid / 0.1);
      k.scale.set(1 + 0.3 * t, 1 - 0.9 * t, 1 + 0.3 * t);
      if (dodTid > 0.35 && spiller.gruppe.visible) {
        spiller.gruppe.visible = false;
        if (!pakketKylling) { pakketKylling = M.pakke('original'); pakketKylling.scale.setScalar(1.9); scene.add(pakketKylling); }
        pakketKylling.visible = true;
        pakketKylling.position.set(spiller.gruppe.position.x, 0.05, spiller.gruppe.position.z);
        pakketKylling.rotation.set(0, 0.4, 0);
      }
    } else if (dodAarsak === 'grill') {
      const t = Math.min(1, dodTid / 0.5);
      spiller.gruppe.position.y = Math.sin(Math.min(1, dodTid / 0.4) * Math.PI) * 0.6;
      k.scale.set(1 - 0.15 * t, 1 - 0.15 * t, 1 - 0.15 * t);
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
  /* Runden som er ferdig: tas vare på med en gang, så den kan sendes inn
     selv om spilleren starter en ny runde før topplista har svart */
  let innsending = null, sluttTid = 0;

  async function visSlutt() {
    tilstand = 'over';
    sluttTid = performance.now();
    innsending = { billett, poeng, pakker, logg: logg.join(','), gud: gud() || gudIRunden };
    billett = null;
    const egen = innsending;
    /* Kjent kallenavn: send inn med en gang (vent ikke på topplista) */
    const sender = poeng > 0 && egen.billett && T.sisteNavn() && !egen.gud && listeModus !== 'lokal'
      ? sendRunde(T.sisteNavn(), egen) : null;
    const nyRekord = poeng > forrigeRekord;
    if (nyRekord) { rekord = poeng; T.settRekord(poeng); }
    T.leggTilLokal(poeng, T.sisteNavn() || 'Deg', pakker);
    B.leggTil(pakker + bonus);
    ME.leggTilPakker(pakker);
    sjekkMerker(0);
    visSaldo();
    if (ui.sluttPakker) { ui.sluttPakker.textContent = String(pakker); }
    if (ui.sluttPoeng) { ui.sluttPoeng.textContent = String(poeng); }
    if (ui.sluttRekord) { ui.sluttRekord.textContent = String(rekord); }
    const TITLER = { bil: 'Påkjørt!', bane: 'Tatt av bybanen!', vann: 'Plask!', drift: 'Drev til havs!', maake: 'Tatt av måka!', stempel: 'Pakket inn!', grill: 'Grillet!' };
    const tittel = (dodAarsak === 'vann' || dodAarsak === 'drift') && dodVerden === 'fabrikk' ? 'Krydret!'
      : dodAarsak === 'bane' && dodVerden !== 'by' ? 'Overkjørt!' : TITLER[dodAarsak];
    if (ui.sluttTittel) { ui.sluttTittel.textContent = jobbNaadd ? 'Du kom deg på jobb!' : tittel || 'Runden er over'; }
    if (ui.sluttTekst) {
      const fram = jobbNaadd
        ? `Du nådde Jobbsenteret og kom ${poeng - JOBB} ${poeng - JOBB === 1 ? 'rute' : 'ruter'} videre.`
        : poeng > 0 ? `Du kom ${poeng} ${poeng === 1 ? 'rute' : 'ruter'}, ${JOBB - poeng} igjen til Jobbsenteret.` : 'Hopp framover med piltastene, WASD eller ved å sveipe.';
      ui.sluttTekst.textContent = jobbNaadd || !dodTekst ? fram : `${dodTekst} ${fram}`;
      if (bonus > 0) { ui.sluttTekst.textContent += ` Kombo-bonus: ${bonus} ekstra ${bonus === 1 ? 'pakke' : 'pakker'} i lommeboka.`; }
    }
    if (ui.nyRekord) { ui.nyRekord.hidden = !nyRekord || poeng === 0; }
    if (ui.navnSkjema) { ui.navnSkjema.hidden = true; }
    if (ui.navnStatus) { ui.navnStatus.textContent = ''; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = ''; }
    if (ui.slutt) { ui.slutt.hidden = false; }
    const vente = $('[data-vente]', scene_);
    if (vente) { vente.hidden = false; }
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
        if (egen.gud) { if (ui.sluttInfo) { ui.sluttInfo.textContent = 'Gud-modus var på i denne runden, så den kommer ikke på topplista.'; } }
        else if (sender) { await sender; }
        else if (egen.billett && T.sisteNavn()) { await sendRunde(T.sisteNavn(), egen); }
        else if (egen.billett) { visNavnSkjema('send', topp10 ? 'Du er på topp 10! Skriv inn et kallenavn:' : 'Skriv inn et kallenavn for å komme på topplista:'); }
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
  async function sendRunde(navn, r = innsending) {
    if (!r || !r.billett) { return; }
    const knapp = $('button', ui.navnSkjema);
    if (knapp) { knapp.disabled = true; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = `Lagrer som «${navn}» …`; }
    const billettNaa = r.billett;
    r.billett = null;   /* sendes bare én gang */
    const svar = await T.sendInn({ billett: billettNaa, navn, poeng: r.poeng, pakker: r.pakker, logg: r.logg });
    if (knapp) { knapp.disabled = false; }
    if (ui.sluttInfo) { ui.sluttInfo.textContent = ''; }
    if (svar.ok) {
      T.lagreNavn(navn);
      ui.navnSkjema.hidden = true;
      const plasser = [svar.plass ? `nummer ${svar.plass} på topplista` : '',
        svar.pakkePlass ? `nummer ${svar.pakkePlass} på pakkelista` : '',
        svar.dagPlass ? `nummer ${svar.dagPlass} på dagens rute` : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' og $1');
      if (ui.sluttInfo) { ui.sluttInfo.textContent = plasser ? `Lagret som «${navn}» – ${plasser}!` : `Lagret som «${navn}».`; }
      if (ui.byttNavn) { ui.byttNavn.hidden = false; }
      melding(plasser ? `Du er ${plasser}!` : 'Lagret!', 3);
      globalListe = svar.liste; globalPakker = svar.pakker; globalDag = svar.dag; listeFeil = '';
      tegnListe();
      oppdaterStartKort();
      lyd.poeng();
    } else if (svar.status === 400 && /kallenavn|navn/i.test(svar.melding || '')) {
      /* Navnet gikk ikke gjennom filteret: billetten er ikke brukt, prøv et annet */
      r.billett = billettNaa;
      visNavnSkjema('send', 'Velg et annet kallenavn:', svar.melding);
    } else if (svar.status === 0 || svar.status === 429 || svar.status >= 500) {
      /* Fikk ikke kontakt: billetten er ikke brukt, så den kan sendes igjen */
      r.billett = billettNaa;
      visNavnSkjema('send', 'Fikk ikke lagret runden. Prøv igjen:', svar.melding);
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
        if (svar.ok) { listeModus = 'global'; globalListe = svar.liste; globalPakker = svar.pakker; globalDag = svar.dag; listeFeil = ''; }
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
    const n = T.visAntall(), dag = T.listeValg() === 'dag';
    document.querySelectorAll('[data-antall]').forEach((k) => k.setAttribute('aria-pressed', String(!dag && Number(k.dataset.antall) === n)));
    document.querySelectorAll('[data-dagliste]').forEach((k) => k.setAttribute('aria-pressed', String(dag)));
    if (ui.listeTittel) { ui.listeTittel.textContent = dag ? 'Dagens rute' : `Topp ${n}`; }
    /* Dagens liste har bare poeng, så pakkedelen skjules */
    [document.querySelector('[data-pakkedel]'), ui.pakkeStatus, ui.pakkeliste].forEach((el) => { if (el) { el.hidden = dag; } });
    if (ui.pakkeTittelTall) { ui.pakkeTittelTall.textContent = n === 100 ? ' (topp 100)' : ''; }
    [ui.liste, ui.pakkeliste].forEach((ol) => ol && ol.classList.toggle('toppliste__liste--lang', n === 100));
  }
  document.querySelectorAll('[data-dagliste]').forEach((k) => k.addEventListener('click', () => {
    T.settListeValg('dag');
    settBryter();
    tegnListe();
    if (listeModus !== 'lokal') { oppdaterToppliste(); }
  }));
  document.querySelectorAll('[data-antall]').forEach((k) => k.addEventListener('click', () => {
    T.settListeValg('alle');
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
    const global = listeModus === 'global', dag = T.listeValg() === 'dag';
    const liste = dag ? (global ? globalDag : []) : global ? globalListe : T.lokalListe();
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
      } else if (dag && !global) {
        s.textContent = 'Lista for dagens rute finnes bare når den felles topplista er koblet til.';
      } else if (dag && !liste.length) {
        s.textContent = 'Ingen har spilt dagens rute ennå. Bli den første! Ruta er ny hver dag ved midnatt.';
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
      /* Gud-modus-navnet lagres bare på enheten og sendes aldri til topplista */
      if (erGudNavn(navn)) {
        settNavn(navn);
        ui.navnSkjema.hidden = true;
        ui.navnStatus.textContent = '';
        if (ui.sluttInfo) { ui.sluttInfo.textContent = 'Gud-modus er på fra neste runde. Runder i gud-modus kommer ikke på topplista.'; }
        oppdaterGud();
        lyd.seier();
        return;
      }
      ui.navnStatus.textContent = '';
      await sendRunde(navn);
    });
  }

  /* -------------------------------------------------------------------------
     KALLENAVN-VINDUET – bytt navn eller slå av gud-modus, når som helst
     (også midt i en runde, så gud-modus aldri kan låse deg inne)
     ------------------------------------------------------------------------- */
  const navnevindu = $('[data-navnevindu]', scene_);
  let navnApen = false, kortForNavn = null;
  const NAVN_FOR_GUD = 'bk-spill-navn-for-gud';

  /* Lagrer kallenavnet. Går du inn i gud-modus, huskes navnet du hadde. */
  function settNavn(navn) {
    if (erGudNavn(navn) && !gud()) {
      try { localStorage.setItem(NAVN_FOR_GUD, JSON.stringify(T.sisteNavn())); } catch (e) { /* privat modus */ }
    }
    T.lagreNavn(navn);
    oppdaterGud();
    tegnListe();
    oppdaterStartKort();
  }
  function oppdaterMeg() {
    const meg = document.querySelector('[data-meg]'), n = T.sisteNavn();
    if (!meg) { return; }
    meg.hidden = !n;
    const b = $('[data-meg-navn]', meg); if (b) { b.textContent = n; }
  }
  function apneNavnevindu() {
    if (!navnevindu) { return; }
    lyd.vekk(); lyd.klikk();
    kortForNavn = [ui.start, ui.slutt].find((k) => k && !k.hidden) || null;
    if (kortForNavn) { kortForNavn.hidden = true; }
    navnApen = true;
    navnevindu.hidden = false;
    const n = T.sisteNavn();
    $('[data-navnevindu-naa]', navnevindu).textContent = n ? `Du heter nå «${n}».` : 'Du har ikke valgt kallenavn ennå.';
    $('[data-navnevindu-status]', navnevindu).textContent = '';
    $('[data-gud-av]', navnevindu).hidden = !gud();
    const felt = $('input', navnevindu); felt.value = ''; felt.focus({ preventScroll: true });
  }
  function lukkNavnevindu() {
    if (!navnevindu) { return; }
    navnApen = false;
    navnevindu.hidden = true;
    if (kortForNavn) { kortForNavn.hidden = false; }
  }
  if (navnevindu) {
    document.querySelectorAll('[data-bytt-navn]').forEach((k) => k.addEventListener('click', (e) => { e.stopPropagation(); apneNavnevindu(); }));
    $('[data-lukk-navnevindu]', navnevindu).addEventListener('click', lukkNavnevindu);
    $('[data-gud-av]', navnevindu).addEventListener('click', () => {
      let for_ = '';
      try { for_ = JSON.parse(localStorage.getItem(NAVN_FOR_GUD) || '""') || ''; localStorage.removeItem(NAVN_FOR_GUD); } catch (e) { for_ = ''; }
      settNavn(erGudNavn(for_) ? '' : for_);
      lyd.klikk();
      melding(for_ ? `Gud-modus er av. Du heter «${for_}» igjen.` : 'Gud-modus er av.', 2.5);
      lukkNavnevindu();
    });
    $('form', navnevindu).addEventListener('submit', async (e) => {
      e.preventDefault();
      const felt = $('input', navnevindu), status = $('[data-navnevindu-status]', navnevindu);
      const navn = (felt.value || '').trim().replace(/\s+/g, ' ');
      if (navn.length < 2 || navn.length > 16) { status.textContent = 'Kallenavnet må ha 2–16 tegn.'; felt.focus(); return; }
      if (!erGudNavn(navn) && listeModus !== 'lokal') {
        const knapp = $('button[type=submit]', navnevindu);
        knapp.disabled = true; status.textContent = 'Sjekker …';
        const svar = await T.sjekkNavn(navn);
        knapp.disabled = false;
        if (!svar.ok) { status.textContent = svar.melding; return; }
      }
      const varGud = gud();
      settNavn(navn);
      if (erGudNavn(navn)) { lyd.seier(); melding('Gud-modus er på! Runder i gud-modus kommer ikke på topplista.', 3); }
      else { lyd.klikk(); melding(varGud ? `Gud-modus er av. Du heter nå «${navn}».` : `Du heter nå «${navn}».`, 2.5); }
      lukkNavnevindu();
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
    if (navnApen) { if (e.key === 'Escape') { lukkNavnevindu(); } return; }
    if (butikkApen) { if (e.key === 'Escape') { lukkButikk(); } return; }
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
  const omstart = () => {
    if (dagensRunde) { startDagens(); return; }
    lyd.vekk(); lyd.klikk(); lyd.stoppMusikk(); nyVerden(T.taKlarBillett()); tilstand = 'meny'; startSpill();
  };
  /* DAGENS RUTE: samme bane for alle i dag. Uten kontakt med topplista
     spilles den likevel (frøet regnes ut fra datoen), men kan ikke sendes inn. */
  let henterDag = false;
  async function startDagens() {
    if (henterDag) { return; }
    henterDag = true;
    lyd.vekk(); lyd.klikk(); lyd.stoppMusikk();
    const knapper = document.querySelectorAll('[data-dagens]');
    knapper.forEach((k) => { k.disabled = true; k.textContent = 'Henter …'; });
    const b = (listeModus !== 'lokal' && await T.dagensBillett()) || { billett: null, frø: dagFrø(osloDato()), dagens: true };
    knapper.forEach((k) => { k.disabled = false; k.textContent = 'Dagens rute'; });
    henterDag = false;
    nyVerden(b);
    tilstand = 'meny';
    startSpill();
  }
  document.querySelectorAll('[data-dagens]').forEach((k) => k.addEventListener('click', (e) => { e.stopPropagation(); startDagens(); }));

  /* DEL RESULTATET: et bilde av runden som nettopp er over */
  const delKnapp = $('[data-del]', scene_);
  if (delKnapp) {
    delKnapp.addEventListener('click', async () => {
      lyd.vekk(); lyd.klikk();
      if (!innsending) { return; }
      delKnapp.disabled = true;
      const svar = await D.del({ poeng: innsending.poeng, pakker: innsending.pakker, dagens: dagensRunde });
      delKnapp.disabled = false;
      const tekst = { delt: 'Delt! Nå får de se hvem som er raskest.', lastet: 'Bildet er lastet ned. Del det hvor du vil.', feil: 'Fikk ikke laget bildet. Prøv igjen.' }[svar];
      if (tekst && ui.sluttInfo) { ui.sluttInfo.textContent = tekst; }
    });
  }
  ui.omstart && ui.omstart.addEventListener('click', (e) => { omstart(); e.currentTarget.blur(); });
  ui.igjen && ui.igjen.addEventListener('click', () => { omstart(); });
  ui.start && ui.start.addEventListener('click', (e) => { if (!e.target.closest('a, [data-apne-butikk], [data-bytt-navn], [data-dagens]')) { trekk('u'); } });

  /* -------------------------------------------------------------------------
     BUTIKKEN – bruk pakkene på pynt til kyllingen
     ------------------------------------------------------------------------- */
  const butikk = $('[data-butikk]', scene_);
  let butikkApen = false, kortForButikk = null;
  function visSaldo() {
    const n = B.saldo();
    document.querySelectorAll('[data-saldo]').forEach((el) => { el.textContent = String(n); });
  }
  function tegnButikk(melding = '') {
    const liste = $('[data-varer]', butikk);
    const paa = B.paaDeg();
    liste.textContent = '';
    /* Varene gruppert etter plass, premiene til slutt */
    const GRUPPER = [['hode', 'Hode'], ['ansikt', 'Ansikt'], ['kropp', 'Kropp'], ['rygg', 'Rygg'], ['bein', 'Bein'], ['farge', 'Farge'], ['spor', 'Spor'], ['premie', 'Premier']];
    const gruppe = (v) => (v.rad ? 'premie' : v.type);
    const sortert = GRUPPER.flatMap(([g]) => B.VARER.filter((v) => gruppe(v) === g));
    let forrigeGruppe = '';
    for (const v of sortert) {
      if (gruppe(v) !== forrigeGruppe) {
        forrigeGruppe = gruppe(v);
        const h = document.createElement('li');
        h.className = 'butikk__gruppe';
        h.textContent = GRUPPER.find(([g]) => g === forrigeGruppe)[1];
        liste.appendChild(h);
      }
      const li = document.createElement('li');
      li.className = 'butikk__vare';
      const eier = B.eier(v.id), har = paa[v.type] === v.id;
      if (har) { li.classList.add('er-paa'); }
      const navn = document.createElement('span'); navn.className = 'butikk__navn'; navn.textContent = v.navn;
      const pris = document.createElement('span'); pris.className = 'butikk__pris';
      pris.textContent = v.rad ? (eier ? (har ? 'Premie · på deg' : 'Premie · opplåst') : `Premie · lås opp på rad ${v.rad}`)
        : eier ? (har ? 'På deg' : 'Din') : `${v.pris} pakker`;
      const knapp = document.createElement('button');
      knapp.type = 'button';
      knapp.className = 'btn ' + (eier ? 'btn--ghost' : 'btn--ink') + ' butikk__knapp';
      knapp.textContent = eier ? (har ? 'Ta av' : 'Bruk') : v.rad ? 'Låst' : 'Kjøp';
      if (!eier && v.rad) { knapp.disabled = true; knapp.title = `Kom til rad ${v.rad} for å låse opp`; }
      else if (!eier && B.saldo() < v.pris) { knapp.disabled = true; knapp.title = `Du trenger ${v.pris - B.saldo()} pakker til`; }
      knapp.addEventListener('click', () => {
        let tekst = '';
        if (eier) { B.bruk(v.id); lyd.klikk(); }
        else {
          const svar = B.kjop(v.id);
          if (svar.ok) { tekst = `Du kjøpte ${v.navn.toLowerCase()}!`; lyd.pakke(); }
          else { tekst = svar.melding; lyd.bonk(); }
        }
        kleKylling(); visSaldo(); tegnButikk(tekst);
        const ny = $(`[data-vare="${v.id}"] button`, butikk);
        if (ny) { ny.focus(); }
      });
      li.dataset.vare = v.id;
      li.append(navn, pris, knapp);
      liste.appendChild(li);
    }
    const m = $('[data-butikk-melding]', butikk);
    if (m) { m.textContent = melding; }
  }
  /* Faner: Varer og Merker */
  function visFane(navn, fokus = false) {
    butikk.querySelectorAll('[data-fane]').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.fane === navn)));
    butikk.querySelectorAll('[data-fanepanel]').forEach((p) => { p.hidden = p.dataset.fanepanel !== navn; });
    if (navn === 'merker') { ME.tegn($('[data-merker]', butikk)); }
    if (fokus) { const k = $(`[data-fane="${navn}"]`, butikk); if (k) { k.focus(); } }
  }
  if (butikk) {
    butikk.querySelectorAll('[data-fane]').forEach((k) => {
      k.addEventListener('click', () => { lyd.klikk(); visFane(k.dataset.fane); });
      k.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); visFane(k.dataset.fane === 'varer' ? 'merker' : 'varer', true); }
      });
    });
  }

  function apneButikk() {
    lyd.vekk(); lyd.klikk();
    visFane('varer');
    kortForButikk = [ui.start, ui.slutt].find((k) => k && !k.hidden) || null;
    if (kortForButikk) { kortForButikk.hidden = true; }
    butikkApen = true;
    butikk.hidden = false;
    visSaldo(); tegnButikk();
    const f = $('button:not([disabled])', butikk); if (f) { f.focus({ preventScroll: true }); }
  }
  function lukkButikk() {
    butikkApen = false;
    butikk.hidden = true;
    if (kortForButikk) { kortForButikk.hidden = false; const k = $('[data-apne-butikk]', kortForButikk); if (k) { k.focus({ preventScroll: true }); } }
  }
  if (butikk) {
    document.querySelectorAll('[data-apne-butikk]').forEach((k) => k.addEventListener('click', (e) => { e.stopPropagation(); apneButikk(); }));
    $('[data-lukk-butikk]', butikk).addEventListener('click', lukkButikk);
  }
  visSaldo();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { lyd.pause(true); } else { lyd.pause(false); forrige = performance.now(); }
  });

  /* -------------------------------------------------------------------------
     MÅKA – første gang du er for treg, stjeler den en pakke i stedet for deg
     ------------------------------------------------------------------------- */
  let maakeHarStjaalet = false, tyveri = null, molleMeldt = false, tryggMeldt = false;
  const tyvPakke = M.pakke('original');
  tyvPakke.scale.setScalar(1.1);
  tyvPakke.position.set(0.82, -0.35, 0);
  tyvPakke.rotation.set(0, 0, -0.5);
  function stjelPakke(spillerRad) {
    maakeHarStjaalet = true;
    pakker--;
    runde.stjalet = true;
    sjekkOppdrag();
    logg.push('m');                         /* serveren trekker fra pakken */
    oppdaterHud();
    rull = spillerRad - 1;                  /* måka er mett en stund */
    const p = spiller.gruppe.position;
    tyveri = { tid: 0, x: p.x, z: p.z };
    maake.visible = true;
    maake.add(tyvPakke);
    tyvPakke.visible = false;
    lyd.maake();
    melding(velg(MELDINGER.tyveri), 2.8);
  }
  function oppdaterTyveri(dt) {
    if (!tyveri) { return; }
    tyveri.tid += dt;
    const t = tyveri.tid, v = maake.userData;
    v.venstre.rotation.x = Math.sin(t * 22) * 0.7;
    v.hoyre.rotation.x = -Math.sin(t * 22) * 0.7;
    if (t < 0.5) {
      const k = t / 0.5;
      maake.position.set(tyveri.x + 6 * (1 - k), 1.1 + 5 * (1 - k) * (1 - k), tyveri.z + 2 * (1 - k));
      maake.rotation.set(0, Math.PI * 0.85, 0);
    } else {
      tyvPakke.visible = true;
      const k = t - 0.5;
      maake.position.set(tyveri.x - k * 5, 1.1 + k * 4, tyveri.z - k * 3);
      maake.rotation.set(0, Math.PI * 0.85, 0.3);
      if (k > 1.6) { maake.visible = false; maake.remove(tyvPakke); tyveri = null; }
    }
  }

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
    const v = verdenFor(Math.max(0, Math.round(spillerRad)));
    /* Ringen går litt raskere for hver runde, og måkene på Bryggen er ekstra sultne */
    const brygge = v.id === 'brygge';
    /* Trygg sone rundt Jobbsenteret: måka venter, og skjermen står stille */
    const trygg = Math.abs(Math.round(spillerRad) - JOBB) <= 3;
    if (tilstand === 'spill' && rullAktiv && feiringTid <= 0 && !trygg) {
      rull += (0.3 + vanske(poeng) * 0.5) * (1 + 0.12 * v.runde) * (brygge ? 1.15 : 1) * dt;
    }
    if (spillerRad > rull + 1) { rull += (spillerRad - 1 - rull) * Math.min(1, dt * 3.5); }
    if (tilstand === 'spill' && !trygg && spillerRad < rull - (brygge ? 3.5 : 4.2) && !gud()) {
      if (!maakeHarStjaalet && pakker > 0) { stjelPakke(spillerRad); } else { do_('maake'); }
    }
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

    const hendelser = verden.oppdater(dt, -spiller.gruppe.position.z);
    for (const h of hendelser) {
      const naer = Math.abs(h.rad - spiller.rad);
      if (h.type === 'bybane' && naer < 7) { lyd.bjelle(); }
      else if (h.type === 'stempelvarsel' && naer < 6) { lyd.alarm(); }
      else if (h.type === 'stempel' && naer < 6) { lyd.stempel(naer > 1 ? 0.5 : 1); }
      else if (h.type === 'grill' && naer < 3) { lyd.fres(0.5); }
      else if (h.type === 'kakle' && naer < 4 && Math.random() < 0.35) { lyd.kakle(); }
    }

    if (feiringTid > 0) { feiringTid -= dt; }
    if (meldingTid > 0) { meldingTid -= dt; if (meldingTid <= 0 && ui.melding) { ui.melding.classList.remove('er-synlig'); } }
    if (risting > 0) { risting = Math.max(0, risting - dt); }

    if (tilstand === 'spill' || tilstand === 'meny') { oppdaterSpiller(dt); }
    if (tilstand === 'dod') { oppdaterDod(dt); }
    oppdaterTyveri(dt);
    visEffekt();
    oppdaterRinger(dt);
    oppdaterRull(dt);
    plasserKamera(Math.min(1, dt * 5));
    toneJobb(dt);
    toneHimmel(dt);
    oppdaterVaer(dt);
    malKvalitet(dt);
    verden.sikre(Math.floor(rull) - 10, Math.floor(rull) + 28);
    oppdaterPartikler(dt);
    tegner.render(scene, kamera);
  }

  /* Hver verden har sin egen himmel, og sin egen variant av musikken */
  const HIMMEL = { by: F.cream, kylling: 0xF7DFA4, brygge: 0xD6DEE4, fabrikk: 0xF3EBDD, trening: 0xE2E6EE };
  const himmelMaal = new THREE.Color();
  let himmelVerden = 'by';
  function toneHimmel(dt) {
    const id = verdenFor(Math.max(0, Math.round(-fokus.z))).id;
    himmelMaal.setHex(HIMMEL[id]);
    scene.background.lerp(himmelMaal, Math.min(1, dt * 1.5));
    scene.fog.color.copy(scene.background);
    const her = verdenFor(Math.max(0, spiller.rad)).id;
    if (her !== himmelVerden) { himmelVerden = her; lyd.settVerden(her); }
  }

  /* -------------------------------------------------------------------------
     VÆR OG MÅKER PÅ BRYGGEN – regn (ikke med «redusert bevegelse») og
     måker som sirkler over havna. Én instansmodell for alle regndråpene.
     ------------------------------------------------------------------------- */
  const DRAAPER = 160;
  const regn = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.34, 0.025), new THREE.MeshBasicMaterial({ color: 0x9FB4C2, transparent: true, opacity: 0.7 }), DRAAPER);
  regn.frustumCulled = false;
  regn.visible = false;
  const draaper = [];
  for (let i = 0; i < DRAAPER; i++) { draaper.push({ x: (Math.random() - 0.5) * 20, y: Math.random() * 9, z: (Math.random() - 0.5) * 20 }); }
  scene.add(regn);
  const pyntMaaker = [M.maake(), M.maake()];
  pyntMaaker.forEach((m) => { m.visible = false; m.scale.setScalar(0.8); scene.add(m); });
  let vaerTid = 0;
  function oppdaterVaer(dt) {
    vaerTid += dt;
    const brygge = verdenFor(Math.max(0, Math.round(-fokus.z))).id === 'brygge';
    pyntMaaker.forEach((m, i) => {
      m.visible = brygge && !maake.visible;
      if (!m.visible) { return; }
      const v = vaerTid * (0.5 + i * 0.15) + i * 3;
      m.position.set(fokus.x + Math.cos(v) * (5 + i * 2), 4.5 + i, fokus.z - 3 + Math.sin(v) * 4);
      m.rotation.set(0, -v - Math.PI / 2, 0.25);
      m.userData.venstre.rotation.x = Math.sin(vaerTid * 8 + i) * 0.5;
      m.userData.hoyre.rotation.x = -Math.sin(vaerTid * 8 + i) * 0.5;
    });
    regn.visible = brygge && ristSkala > 0;
    if (!regn.visible) { return; }
    for (let i = 0; i < DRAAPER; i++) {
      const d = draaper[i];
      d.y -= dt * 11;
      d.x -= dt * 1.2;
      if (d.y < 0) {
        if (i % 9 === 0) { sprut(fokus.x + d.x, 0.02, fokus.z + d.z, 2, [0xC9D6DE], { fart: 0.5, opp: 1, liv: 0.25, str: 0.04 }); }
        d.y += 9; d.x = (Math.random() - 0.5) * 20;
      }
      mtx.makeTranslation(fokus.x + d.x, d.y, fokus.z + d.z);
      regn.setMatrixAt(i, mtx);
    }
    regn.instanceMatrix.needsUpdate = true;
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
      s.hopp = Math.min(1, s.hopp + dt / (s.glid ? 0.3 : fartAktiv() ? HOPP_FART : HOPP));
      const t = s.hopp;
      const x = s.fraX + (s.tilX - s.fraX) * t;
      const zRad = s.fraRad + (s.tilRad - s.fraRad) * t;
      const yBunn = (s.fraY || 0) + ((s.tilY || 0) - (s.fraY || 0)) * t;   /* opp på / ned fra stokken */
      g.position.set(x, s.glid ? 0 : yBunn + Math.sin(t * Math.PI) * 0.42, -zRad);
      if (!s.glid) { s.kropp.scale.set(0.94, 1.12, 0.94); }
      if (s.hopp >= 1) { g.position.y = 0; landet(); }
    } else {
      /* Står stille: puster, og blir med stokken hvis den står på en */
      if (s.paa) {
        const rad = verden.rad(s.rad);
        s.x += (rad ? rad.fart : 0) * dt;
        if (Math.abs(s.x) > KOL + 0.75) {
          if (gud()) { s.x = Math.sign(s.x) * (KOL + 0.75); } else { do_('drift'); return; }
        }
      }
      g.position.set(s.x, s.paa ? s.paa.mesh.position.y + s.paa.topp : 0, -s.rad);
      s.tomgang += dt;
      if (magnetAktiv()) { trekkMagnet(); }
      /* Tredemølla: står du stille i ett sekund, blir du dyttet én rad bakover */
      const radHer = verden.rad(s.rad);
      if (tilstand === 'spill' && radHer && radHer.type === 'mølle') {
        s.molle += dt;
        if (s.molle >= 1.0) {
          s.molle = 0;
          if (!verden.blokkert(Math.round(s.x), s.rad - 1)) {
            logg.push('b');                       /* serveren sjekker at dette var en tredemølle */
            Object.assign(s, { fraX: s.x, fraRad: s.rad, tilX: s.x, tilRad: s.rad - 1, hopp: 0, glid: true });
            lyd.molle();
          }
        }
      } else { s.molle = 0; }
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

    /* Kollisjoner. Hitboxen følger figuren: smal når kyllingen ser fram eller
       bak, bredere når den ser til siden. Midt i et hopp mellom to rader
       (40–60 %) er den i lufta og kan ikke bli truffet. */
    if (tilstand === 'spill') {
      const iLufta = s.fraRad !== s.tilRad && s.hopp > 0.4 && s.hopp < 0.6;
      const radNa = s.hopp < 0.5 ? s.fraRad : s.tilRad;
      const halv = Math.abs(Math.cos(s.yaw)) > 0.7 ? 0.4 : 0.22;
      const m = iLufta ? null : verden.treff(g.position.x, radNa, halv);
      if (m) { do_(m.tog ? 'bane' : m.stempel ? 'stempel' : m.grill ? 'grill' : 'bil', m, radNa); }
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
  oppdaterGud();
  /* Første billett hentes med en gang (samtidig med lista), og verdenen bygges
     på nytt fra frøet hvis spillet ikke har startet */
  const forsteBillett = T.nesteBillett();
  oppdaterToppliste().then(async (svar) => {
    if (!svar.ok) { return; }
    const b = await forsteBillett;
    if (!b) { return; }
    if (tilstand === 'meny') { nyVerden(b); } else { T.leggTilbake(b); }
  });

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
      logg: () => logg.join(','), frø: () => verden.bane.frø, harBillett: () => !!billett,
      verden: () => verdenFor(spiller.rad).id, rader: (fra, til) => { const u = []; for (let r = fra; r <= til; r++) { const d = verden.rad(r); u.push(d ? d.type : null); } return u; },
      pakkeRader: (fra = 0, til = 80) => { const u = []; for (let r = fra; r <= til; r++) { const d = verden.rad(r); if (d) { d.pakker.forEach((p) => u.push({ rad: r, x: p.x, tatt: p.tatt })); } } return u; },
      kraft: (fra = 0, til = 400) => { const u = []; for (let r = fra; r <= til; r++) { const k = verden.bane.kraft(r); if (k) { u.push({ rad: r, ...k }); } } return u; },
      effekt: () => ({ skjold: effekt.skjold, fart: fartAktiv(), magnet: magnetAktiv() }), spiller: () => ({ x: spiller.x, rad: spiller.rad }),
      rull: () => ({ rull, rullAktiv, feiringTid, z: spiller.gruppe.position.z }),
      treg: (k) => { treg = k; }, sakte: (k) => { tidsSkala = k; },
      rad: (r) => { const d = verden.rad(r); return d ? { type: d.type, blokk: [...d.blokk], fart: d.fart, flytt: d.flytt.map((m) => ({ x: m.x, len: m.len })) } : null },
      hoppTil: (n, x = 0) => {
        verden.sikre(n - 10, n + 28);
        Object.assign(spiller, { x, rad: n, tilX: x, tilRad: n, hopp: 1, paa: null });
        spiller.gruppe.position.set(x, 0, -n);
        poeng = n; rull = n - 1; oppdaterHud();
      }
    };
  }
}
