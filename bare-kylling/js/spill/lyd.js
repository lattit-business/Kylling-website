/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — LYD OG MUSIKK
   Alt lages i nettleseren med Web Audio – ingen lydfiler. Lydeffektene er
   små synth-lyder i 8-bit-stil, og musikken er en kort sang som går i ring
   (melodi, arpeggio, bass og trommer). Lyd og musikk kan skrus av hver for
   seg, og valget huskes. Lyden starter først når spilleren trykker på noe
   (nettlesere tillater ikke lyd før det).
   ============================================================================= */

const lagre = (n, v) => { try { localStorage.setItem(n, v ? '1' : '0'); } catch (e) { /* privat modus */ } };
const hent = (n, std) => { try { const v = localStorage.getItem(n); return v === null ? std : v === '1'; } catch (e) { return std; } };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/* Sangen: «Veien til Jobbsenteret». 16-deler, 128 slag i minuttet, i C-dur.
   To deler (A og B) à fire takter. 0 = pause. */
const MELODI = [
  /* A */
  [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0],
  [69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 71, 0, 69, 0],
  [65, 0, 69, 0, 72, 0, 74, 0, 76, 0, 74, 0, 72, 0, 69, 0],
  [67, 0, 71, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0],
  /* B */
  [77, 0, 0, 76, 0, 74, 0, 72, 74, 0, 76, 0, 77, 0, 79, 0],
  [79, 0, 0, 77, 0, 76, 0, 74, 76, 0, 74, 0, 71, 0, 67, 0],
  [76, 0, 0, 74, 0, 72, 0, 71, 72, 0, 74, 0, 76, 0, 79, 0],
  [81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 71, 0, 72, 0, 0, 0]
];
const AKKORD = [  /* grunntone (bass) og akkord (arpeggio) per takt */
  [48, [60, 64, 67]], [45, [57, 60, 64]], [41, [53, 57, 60]], [43, [55, 59, 62]],
  [41, [53, 57, 60]], [43, [55, 59, 62]], [40, [52, 55, 59]], [45, [57, 60, 64]]
];
const TEMPO = 128;
const STEG = 60 / TEMPO / 4;

export class Lyd {
  constructor() {
    this.ctx = null;
    this.lydPaa = hent('bk-spill-lyd', true);
    this.musikkPaa = hent('bk-spill-musikk', true);
    this.spiller = false;
    this.steg = 0;
    this.nesteTid = 0;
    this.klokke = 0;
  }

  /* Må kalles fra et brukertrykk første gang */
  vekk() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return; }
      this.ctx = new AC();
      const c = this.ctx;
      this.ut = c.createDynamicsCompressor();
      this.ut.threshold.value = -14; this.ut.ratio.value = 4;
      this.ut.connect(c.destination);
      this.effekt = c.createGain(); this.effekt.gain.value = this.lydPaa ? 0.9 : 0; this.effekt.connect(this.ut);
      this.musikk = c.createGain(); this.musikk.gain.value = this.musikkPaa ? 0.32 : 0; this.musikk.connect(this.ut);
      /* hvit støy til trommer, krasj og plask */
      const len = c.sampleRate;
      this.stoyBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.stoyBuf.getChannelData(0);
      for (let i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
      /* 25 % pulsbølge, den klassiske 8-bit-lyden */
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) { im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25); }
      this.puls = c.createPeriodicWave(re, im);
    }
    if (this.ctx.state === 'suspended') { this.ctx.resume(); }
  }

  settLyd(paa) {
    this.lydPaa = paa; lagre('bk-spill-lyd', paa);
    if (this.effekt) { this.effekt.gain.setTargetAtTime(paa ? 0.9 : 0, this.ctx.currentTime, 0.02); }
  }
  settMusikk(paa) {
    this.musikkPaa = paa; lagre('bk-spill-musikk', paa);
    if (this.musikk) { this.musikk.gain.setTargetAtTime(paa ? 0.32 : 0, this.ctx.currentTime, 0.05); }
  }
  pause(paa) {
    if (!this.ctx) { return; }
    if (paa) { this.ctx.suspend(); } else { this.ctx.resume(); }
  }

  /* --- byggeklosser ------------------------------------------------------- */
  tone({ type = 'square', f0, f1, t = 0, varighet = 0.1, styrke = 0.15, ut, angrep = 0.004 }) {
    if (!this.ctx) { return; }
    const c = this.ctx, start = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    if (type === 'puls') { o.setPeriodicWave(this.puls); } else { o.type = type; }
    o.frequency.setValueAtTime(f0, start);
    if (f1) { o.frequency.exponentialRampToValueAtTime(f1, start + varighet); }
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(styrke, start + angrep);
    g.gain.exponentialRampToValueAtTime(0.0008, start + varighet);
    o.connect(g); g.connect(ut || this.effekt);
    o.start(start); o.stop(start + varighet + 0.02);
  }
  stoy({ t = 0, varighet = 0.2, styrke = 0.2, filter = 'bandpass', f0 = 1000, f1, q = 1, ut }) {
    if (!this.ctx) { return; }
    const c = this.ctx, start = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.stoyBuf;
    const fl = c.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, start);
    if (f1) { fl.frequency.exponentialRampToValueAtTime(f1, start + varighet); }
    const g = c.createGain();
    g.gain.setValueAtTime(styrke, start);
    g.gain.exponentialRampToValueAtTime(0.0008, start + varighet);
    s.connect(fl); fl.connect(g); g.connect(ut || this.effekt);
    s.start(start, Math.random() * 0.5); s.stop(start + varighet + 0.02);
  }

  /* --- lydeffekter -------------------------------------------------------- */
  hopp() {
    const v = 1 + (Math.random() - 0.5) * 0.12;
    this.tone({ type: 'puls', f0: 380 * v, f1: 760 * v, varighet: 0.085, styrke: 0.09 });
  }
  lande() { this.tone({ type: 'sine', f0: 210, f1: 120, varighet: 0.08, styrke: 0.16 }); }
  bonk() { this.tone({ type: 'square', f0: 150, f1: 110, varighet: 0.08, styrke: 0.08 }); }
  klikk() { this.tone({ type: 'puls', f0: 900, varighet: 0.035, styrke: 0.05 }); }
  krasj() {
    this.stoy({ varighet: 0.32, styrke: 0.38, filter: 'lowpass', f0: 3000, f1: 200, q: 0.7 });
    this.tone({ type: 'square', f0: 820, f1: 180, varighet: 0.34, styrke: 0.1 });
    this.tone({ type: 'square', f0: 640, f1: 140, t: 0.05, varighet: 0.3, styrke: 0.07 });
  }
  plask() {
    this.stoy({ varighet: 0.45, styrke: 0.3, filter: 'bandpass', f0: 1200, f1: 250, q: 1.4 });
    for (let i = 0; i < 4; i++) { this.tone({ type: 'sine', f0: 500 + i * 140, f1: 900 + i * 160, t: 0.12 + i * 0.07, varighet: 0.06, styrke: 0.06 }); }
  }
  maake() {
    for (let i = 0; i < 2; i++) {
      this.tone({ type: 'sawtooth', f0: 1150, f1: 760, t: i * 0.26, varighet: 0.22, styrke: 0.07 });
      this.tone({ type: 'square', f0: 1190, f1: 800, t: i * 0.26, varighet: 0.2, styrke: 0.03 });
    }
  }
  bjelle() {
    for (let i = 0; i < 2; i++) {
      this.tone({ type: 'sine', f0: 1318, t: i * 0.32, varighet: 0.42, styrke: 0.11 });
      this.tone({ type: 'sine', f0: 1975, t: i * 0.32, varighet: 0.3, styrke: 0.05 });
    }
  }
  tog() { this.stoy({ varighet: 0.9, styrke: 0.16, filter: 'lowpass', f0: 500, f1: 180, q: 0.6 }); }
  forbi(styrke = 0.05) { this.stoy({ varighet: 0.34, styrke, filter: 'bandpass', f0: 260, f1: 1100, q: 0.9 }); }
  horn() {
    this.tone({ type: 'square', f0: 330, varighet: 0.16, styrke: 0.04 });
    this.tone({ type: 'square', f0: 415, varighet: 0.16, styrke: 0.04 });
  }
  poeng() {
    [76, 79, 84].forEach((n, i) => this.tone({ type: 'puls', f0: hz(n), t: i * 0.06, varighet: 0.12, styrke: 0.07 }));
  }
  seier() {
    const fanfare = [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]];
    fanfare.forEach(([n, t]) => {
      this.tone({ type: 'puls', f0: hz(n), t, varighet: 0.22, styrke: 0.1 });
      this.tone({ type: 'triangle', f0: hz(n - 12), t, varighet: 0.24, styrke: 0.12 });
    });
    this.tone({ type: 'puls', f0: hz(88), t: 0.9, varighet: 0.6, styrke: 0.08 });
    this.stoy({ t: 0.36, varighet: 0.25, styrke: 0.12, filter: 'highpass', f0: 5000 });
    this.stoy({ t: 0.72, varighet: 0.4, styrke: 0.14, filter: 'highpass', f0: 5000 });
  }
  rekord() {
    [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone({ type: 'puls', f0: hz(n), t: i * 0.07, varighet: 0.18, styrke: 0.08 }));
    for (let i = 0; i < 6; i++) { this.tone({ type: 'triangle', f0: hz(96 + (i % 3) * 2), t: 0.5 + i * 0.08, varighet: 0.1, styrke: 0.05 }); }
  }
  tapt() {
    [67, 64, 60, 55].forEach((n, i) => this.tone({ type: 'puls', f0: hz(n), t: 0.25 + i * 0.13, varighet: 0.16, styrke: 0.06 }));
  }

  /* --- musikk -------------------------------------------------------------- */
  startMusikk() {
    if (!this.ctx || this.spiller) { return; }
    this.spiller = true;
    this.steg = 0;
    this.nesteTid = this.ctx.currentTime + 0.08;
    this.klokke = window.setInterval(() => this.planleggMusikk(), 25);
  }
  stoppMusikk() {
    this.spiller = false;
    window.clearInterval(this.klokke);
  }
  planleggMusikk() {
    const c = this.ctx;
    while (this.nesteTid < c.currentTime + 0.14) {
      this.spillSteg(this.steg, this.nesteTid - c.currentTime);
      this.nesteTid += STEG;
      this.steg = (this.steg + 1) % (MELODI.length * 16);
    }
  }
  spillSteg(steg, t) {
    const takt = Math.floor(steg / 16), i = steg % 16, ut = this.musikk;
    const note = MELODI[takt][i];
    if (note) { this.tone({ type: 'puls', f0: hz(note), t, varighet: STEG * 1.7, styrke: 0.07, ut }); }
    const [bass, akkord] = AKKORD[takt];
    if (i % 2 === 0) {
      const b = (i % 8 === 6) ? bass + 12 : bass;
      this.tone({ type: 'triangle', f0: hz(b), t, varighet: STEG * 1.6, styrke: 0.16, ut });
    }
    this.tone({ type: 'puls', f0: hz(akkord[i % 3] + 12), t, varighet: STEG * 0.8, styrke: 0.018, ut });
    /* trommer: stortromme på 1 og 3, skarptromme på 2 og 4, hi-hat på offbeat */
    if (i === 0 || i === 8 || (i === 10 && takt % 2)) { this.tone({ type: 'sine', f0: 140, f1: 45, t, varighet: 0.14, styrke: 0.3, ut }); }
    if (i === 4 || i === 12) { this.stoy({ t, varighet: 0.1, styrke: 0.12, filter: 'bandpass', f0: 1800, q: 0.8, ut }); }
    if (i % 4 === 2) { this.stoy({ t, varighet: 0.035, styrke: 0.05, filter: 'highpass', f0: 7000, ut }); }
  }
}
