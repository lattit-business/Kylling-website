/* =============================================================================
   BARE KYLLING: VEIEN TIL JOBBSENTERET — DEL RESULTATET
   Lager et bilde av runden (logokyllingen, poeng, pakker og verden) på et
   lerret. På mobil deles det med Web Share; ellers lastes det ned.
   ============================================================================= */
import { F } from './voxel.js';
import { tegnKylling, tegnOrdmerke } from './modeller.js';
import { JOBB, verdenFor } from './bane.mjs';

const HEX = (n) => '#' + n.toString(16).padStart(6, '0');
const B = 1080, H = 1350;

/* Pakkeikonet (samme piksler som SVG-en i spill.html), s = pikselstørrelse */
function pakkeIkon(g, x, y, s) {
  const r = (c, px, py, w, h) => { g.fillStyle = c; g.fillRect(x + px * s, y + py * s, w * s, h * s); };
  r('#FAF8F3', 0, 1, 10, 12);
  r('#11110F', 0, 0, 10, 1); r('#11110F', 0, 0, 1, 13); r('#11110F', 9, 0, 1, 13); r('#11110F', 0, 12, 10, 1);
  r('#D98A3D', 2, 4, 6, 4);
  r('#334D29', 1, 9, 8, 3);
}

function midt(g, tekst, y, font, farge, maks = B - 160) {
  g.font = font;
  g.fillStyle = farge;
  g.textAlign = 'center';
  const b = g.measureText(tekst).width;
  if (b <= maks) { g.fillText(tekst, B / 2, y); return; }
  g.save(); g.translate(B / 2, y); g.scale(maks / b, 1); g.fillText(tekst, 0, 0); g.restore();
}

/* Teksten om hvor langt runden kom */
export function hvorLangt(poeng, dagens) {
  const v = verdenFor(Math.max(0, poeng));
  const sted = poeng < JOBB ? `${JOBB - poeng} ${JOBB - poeng === 1 ? 'rute' : 'ruter'} fra Jobbsenteret`
    : v.id === 'by' ? 'Kom seg på jobb!' : `Kom helt til ${v.navn}`;
  return dagens ? `Dagens rute · ${sted}` : sted;
}

/* Gir et lerret på 1080 × 1350 med resultatet */
export function lagBilde({ poeng, pakker, dagens }) {
  const c = document.createElement('canvas');
  c.width = B; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = HEX(F.cream); g.fillRect(0, 0, B, H);
  /* ordmerket øverst */
  tegnOrdmerke(g, 90, 80, 100, HEX(F.ink));
  g.textAlign = 'left';
  /* logokyllingen på en honningsirkel */
  g.fillStyle = HEX(F.honey);
  g.beginPath(); g.arc(B / 2, 500, 235, 0, Math.PI * 2); g.fill();
  tegnKylling(g, B / 2 - 190, 310, 380, HEX(F.ink), 6);
  midt(g, 'Veien til Jobbsenteret', 800, '800 44px Manrope, Arial, sans-serif', HEX(F.inkSoft));
  /* poengene */
  midt(g, String(poeng), 1010, '900 230px Archivo, Arial, sans-serif', HEX(F.ink));
  midt(g, poeng === 1 ? 'RUTE' : 'RUTER', 1062, '900 40px Archivo, Arial, sans-serif', HEX(F.inkSoft));
  /* pakkene, med pikselikon foran */
  g.font = '800 52px Manrope, Arial, sans-serif';
  const pTekst = `${pakker} ${pakker === 1 ? 'pakke' : 'pakker'}`;
  const pb = g.measureText(pTekst).width, ikonB = 10 * 5;
  const px = B / 2 - (pb + ikonB + 22) / 2;
  pakkeIkon(g, px, 1092, 5);
  g.fillStyle = HEX(F.ink); g.textAlign = 'left';
  g.fillText(pTekst, px + ikonB + 22, 1146);
  midt(g, hvorLangt(poeng, dagens), 1215, '700 40px Manrope, Arial, sans-serif', HEX(F.forest));
  /* bunnstripe med utfordringen */
  g.fillStyle = HEX(F.ink); g.fillRect(0, H - 100, B, 100);
  midt(g, 'Slå meg på barekylling.no/spill', H - 36, '900 50px Archivo, Arial, sans-serif', HEX(F.honey));
  return c;
}

/* Deler bildet (mobil) eller laster det ned (PC). Gir 'delt', 'lastet' eller 'avbrutt'. */
export async function del(data) {
  const lerret = lagBilde(data);
  const blob = await new Promise((ok) => lerret.toBlob(ok, 'image/png'));
  if (!blob) { return 'feil'; }
  const fil = new File([blob], 'bare-kylling-resultat.png', { type: 'image/png' });
  const tekst = `Jeg kom ${data.poeng} ruter i Veien til Jobbsenteret. Slå meg på barekylling.no/spill`;
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil], title: 'Bare Kylling: Veien til Jobbsenteret', text: tekst });
      return 'delt';
    } catch (e) {
      return 'avbrutt';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fil.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'lastet';
}
