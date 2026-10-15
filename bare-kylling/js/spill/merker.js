/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — MERKER
   Merker du låser opp for godt, lagret på enheten (localStorage). De vises i
   et eget panel i butikken. Bare til pynt – de gir ingen fordel.
   ============================================================================= */
const NOKKEL = 'bk-spill-merker';
const PAKKER = 'bk-spill-pakker-totalt';

/* s: { poeng, pakkerTotalt, dager } */
export const MERKER = [
  { id: 'jobb', navn: 'Første dag på jobb', tekst: 'Kom deg til Jobbsenteret.', ok: (s) => s.poeng >= 60 },
  { id: 'kylling', navn: 'Kylling Verden', tekst: 'Gå gjennom porten til Kylling Verden.', ok: (s) => s.poeng >= 63 },
  { id: 'brygge', navn: 'Bryggen', tekst: 'Kom deg til Bryggen.', ok: (s) => s.poeng >= 131 },
  { id: 'fabrikk', navn: 'Fabrikken', tekst: 'Kom deg inn i Fabrikken.', ok: (s) => s.poeng >= 201 },
  { id: 'trening', navn: 'Treningssenteret', tekst: 'Kom deg til Treningssenteret.', ok: (s) => s.poeng >= 271 },
  { id: 'pakker100', navn: '100 pakker', tekst: 'Samle 100 pakker til sammen.', ok: (s) => s.pakkerTotalt >= 100 },
  { id: 'dager10', navn: 'Ti dager med dagens rute', tekst: 'Spill dagens rute ti forskjellige dager.', ok: (s) => s.dager >= 10 }
];

const les = (n, std) => { try { const v = localStorage.getItem(n); return v === null ? std : JSON.parse(v); } catch (e) { return std; } };
const skriv = (n, v) => { try { localStorage.setItem(n, JSON.stringify(v)); } catch (e) { /* privat modus */ } };

export const opplast = () => les(NOKKEL, {}) || {};
export const pakkerTotalt = () => Math.max(0, Number(les(PAKKER, 0)) || 0);
export function leggTilPakker(n) { if (n > 0) { skriv(PAKKER, pakkerTotalt() + n); } }

/* Låser opp merker som er oppnådd. Gir de nye. */
export function sjekk(s) {
  const har = opplast(), nye = [];
  const dato = new Date().toISOString().slice(0, 10);
  for (const m of MERKER) {
    if (!har[m.id] && m.ok(s)) { har[m.id] = dato; nye.push(m); }
  }
  if (nye.length) { skriv(NOKKEL, har); }
  return nye;
}

/* Medalje i piksler: bånd og en rund medalje (grå når den er låst) */
const medalje = (paa) => `<svg class="merke__ikon" viewBox="0 0 9 12" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
<path fill="${paa ? '#B5502C' : '#9C988E'}" d="M1 0h2v4H1zM6 0h2v4H6z"/><path fill="${paa ? '#334D29' : '#BDB4A3'}" d="M3 0h3v4H3z"/>
<path fill="#11110F" d="M2 4h5v1H2zM1 5h1v5H1zM7 5h1v5H7zM2 10h5v1H2z"/>
<path fill="${paa ? '#F1B240' : '#CFC7B8'}" d="M2 5h5v5H2z"/><path fill="${paa ? '#FAF8F3' : '#E8E1D5'}" d="M3 6h1v1H3z"/></svg>`;

export function tegn(ul) {
  if (!ul) { return; }
  const har = opplast();
  ul.textContent = '';
  for (const m of MERKER) {
    const li = document.createElement('li');
    li.className = 'merke' + (har[m.id] ? ' er-opplast' : '');
    li.insertAdjacentHTML('afterbegin', medalje(!!har[m.id]));
    const t = document.createElement('span');
    t.className = 'merke__tekst';
    const b = document.createElement('b'); b.textContent = m.navn;
    const sm = document.createElement('small');
    if (har[m.id]) { const [aa, mm, dd] = har[m.id].split('-'); sm.textContent = `${m.tekst} Låst opp ${dd}.${mm}.${aa.slice(2)}.`; }
    else { sm.textContent = `${m.tekst} Ikke låst opp ennå.`; }
    t.append(b, sm);
    li.append(t);
    ul.appendChild(li);
  }
}
