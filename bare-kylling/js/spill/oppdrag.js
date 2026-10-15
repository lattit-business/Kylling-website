/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — OPPDRAG
   Tre oppdrag om gangen, lagret på enheten (localStorage). Et oppdrag som
   klares, gir tre pakker i lommeboka (bare til butikken) og byttes ut når
   neste runde starter.
   ============================================================================= */
const NOKKEL = 'bk-spill-oppdrag';
const BELONNING = 3;

/* r: det som har skjedd i runden { poeng, pakker, kraft, kombo, levering, stjalet, dagens } */
export const OPPDRAG = [
  { id: 'pakker5', tekst: 'Samle 5 pakker i én runde', ok: (r) => r.pakker >= 5 },
  { id: 'pakker12', tekst: 'Samle 12 pakker i én runde', ok: (r) => r.pakker >= 12 },
  { id: 'rad40', tekst: 'Kom til rad 40', ok: (r) => r.poeng >= 40 },
  { id: 'jobb', tekst: 'Kom deg på jobb (rad 60)', ok: (r) => r.poeng >= 60 },
  { id: 'kylling', tekst: 'Kom inn i Kylling Verden', ok: (r) => r.poeng >= 63 },
  { id: 'brygge', tekst: 'Nå Bryggen', ok: (r) => r.poeng >= 131 },
  { id: 'fabrikk', tekst: 'Overlev helt til Fabrikken', ok: (r) => r.poeng >= 201 },
  { id: 'kraft', tekst: 'Ta en kraftpakke', ok: (r) => r.kraft > 0 },
  { id: 'kombo', tekst: 'Få kombo: 10 hopp på rad', ok: (r) => r.kombo },
  { id: 'dagens', tekst: 'Spill dagens rute', ok: (r) => r.dagens },
  { id: 'levering', tekst: 'Ta en pakke fra varebilen', ok: (r) => r.levering > 0 },
  { id: 'maake', tekst: 'Bli ranet av måka (det skjer)', ok: (r) => r.stjalet }
];
const finn = (id) => OPPDRAG.find((o) => o.id === id);

function les() {
  try {
    const d = JSON.parse(localStorage.getItem(NOKKEL) || 'null');
    if (d && Array.isArray(d.aktive)) { return { aktive: d.aktive.filter((a) => finn(a.id)), klart: Number(d.klart) || 0 }; }
  } catch (e) { /* privat modus eller ødelagt */ }
  return { aktive: [], klart: 0 };
}
function skriv(d) { try { localStorage.setItem(NOKKEL, JSON.stringify(d)); } catch (e) { /* privat modus */ } }

/* Fyller opp til tre: ferdige oppdrag byttes ut (kalles når en runde starter) */
export function fyllPaa() {
  const d = les();
  const ferdige = d.aktive.filter((a) => a.ferdig).map((a) => a.id);
  d.aktive = d.aktive.filter((a) => !a.ferdig);
  const ledige = OPPDRAG.filter((o) => !d.aktive.some((a) => a.id === o.id) && !ferdige.includes(o.id));
  while (d.aktive.length < 3 && ledige.length) {
    const o = ledige.splice(Math.floor(Math.random() * ledige.length), 1)[0];
    d.aktive.push({ id: o.id, ferdig: false });
  }
  skriv(d);
  return aktive();
}

export const aktive = () => les().aktive.map((a) => ({ ...a, tekst: finn(a.id).tekst }));
export const antallKlart = () => les().klart;

/* Sjekker oppdragene mot runden. Gir de som nettopp ble klart. */
export function sjekk(r) {
  const d = les(), nye = [];
  for (const a of d.aktive) {
    if (!a.ferdig && finn(a.id).ok(r)) { a.ferdig = true; d.klart++; nye.push({ ...a, tekst: finn(a.id).tekst }); }
  }
  if (nye.length) { skriv(d); }
  return nye;
}
export { BELONNING };

/* Tegner oppdragene i en <ul> */
const BOKS = '<svg class="oppdrag__boks" viewBox="0 0 7 7" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="#11110F" d="M0 0h7v1H0zM0 6h7v1H0zM0 0h1v7H0zM6 0h1v7H6z"/><path class="oppdrag__hake" fill="#334D29" d="M1 3h1v1H1zM2 4h1v1H2zM3 3h1v1H3zM4 2h1v1H4zM5 1h1v1H5z"/></svg>';
export function tegn(ul) {
  if (!ul) { return; }
  ul.textContent = '';
  for (const a of aktive()) {
    const li = document.createElement('li');
    li.className = 'oppdrag__rad' + (a.ferdig ? ' er-ferdig' : '');
    li.insertAdjacentHTML('afterbegin', BOKS);
    const t = document.createElement('span');
    t.textContent = a.tekst;
    if (a.ferdig) { const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' (klart)'; t.append(sr); }
    li.append(t);
    ul.appendChild(li);
  }
}
