/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — BUTIKKEN
   Pakkene du plukker opp, havner i en lommebok på enheten. I butikken kjøper
   du pynt og farger til kyllingen for pakkene. Alt lagres i nettleseren
   (localStorage); det er bare utseende og gir ingen fordel på topplista.
   ============================================================================= */
import { F } from './voxel.js';

/* type: 'hode' (lue/krone, én om gangen), 'ansikt' (briller) eller 'farge' (kroppen) */
export const VARER = [
  { id: 'kokkelue', navn: 'Kokkelue', pris: 10, type: 'hode' },
  { id: 'briller', navn: 'Solbriller', pris: 15, type: 'ansikt' },
  { id: 'caps', navn: 'Honning-caps', pris: 20, type: 'hode' },
  { id: 'paprika', navn: 'Paprika-kylling', pris: 30, type: 'farge', farge: 0xE07A4F },
  { id: 'original', navn: 'Original-kylling', pris: 30, type: 'farge', farge: 0x8DB86A },
  { id: 'krone', navn: 'Krone', pris: 50, type: 'hode' },
  { id: 'gull', navn: 'Gullkylling', pris: 100, type: 'farge', farge: 0xF2C14E },
  /* Premier: låses opp ved å komme langt, kan ikke kjøpes */
  { id: 'strahatt', navn: 'Stråhatt', rad: 150, type: 'hode' },
  { id: 'gullkokkelue', navn: 'Gull-kokkelue', rad: 250, type: 'hode' }
];
export const PREMIER = VARER.filter((v) => v.rad);
export const KROPP_STANDARD = F.creamHi;

const les = (n, std) => { try { const v = localStorage.getItem(n); return v === null ? std : JSON.parse(v); } catch (e) { return std; } };
const skriv = (n, v) => { try { localStorage.setItem(n, JSON.stringify(v)); } catch (e) { /* privat modus */ } };

export const saldo = () => Math.max(0, Math.floor(Number(les('bk-spill-lommebok', 0)) || 0));
export function leggTil(n) { if (n > 0) { skriv('bk-spill-lommebok', saldo() + n); } return saldo(); }
/* Beste poengsum på enheten (samme nøkkel som toppliste.js bruker) */
const rekord = () => Number(les('bk-spill-rekord', 0)) || 0;
export const eier = (id) => {
  const v = VARER.find((x) => x.id === id);
  if (v && v.rad) { return rekord() >= v.rad; }
  return les('bk-spill-eier', []).includes(id);
};
/* { hode, ansikt, farge }: id-ene du har på deg */
export const paaDeg = () => Object.assign({ hode: null, ansikt: null, farge: null }, les('bk-spill-paa', {}));
export const vare = (id) => VARER.find((v) => v.id === id);

/* { ok, melding } */
export function kjop(id) {
  const v = vare(id);
  if (!v) { return { ok: false, melding: 'Fant ikke varen.' }; }
  if (v.rad) { return { ok: false, melding: `${v.navn} låses opp når du kommer til rad ${v.rad}.` }; }
  if (eier(id)) { return { ok: true }; }
  if (saldo() < v.pris) { return { ok: false, melding: `Du trenger ${v.pris - saldo()} pakker til.` }; }
  skriv('bk-spill-lommebok', saldo() - v.pris);
  skriv('bk-spill-eier', [...les('bk-spill-eier', []), id]);
  bruk(id);
  return { ok: true };
}

/* Tar på varen (eller av, hvis du allerede har den på) */
export function bruk(id) {
  const v = vare(id);
  if (!v || !eier(id)) { return paaDeg(); }
  const paa = paaDeg();
  paa[v.type] = paa[v.type] === id ? null : id;
  skriv('bk-spill-paa', paa);
  return paa;
}

/* Tar på en premie uten å bytte ut noe annet enn hodeplagget */
export function taPaa(id) {
  const v = vare(id);
  if (!v) { return; }
  const paa = paaDeg();
  paa[v.type] = id;
  skriv('bk-spill-paa', paa);
}

export function kroppsfarge() {
  const f = vare(paaDeg().farge);
  return f ? f.farge : KROPP_STANDARD;
}
