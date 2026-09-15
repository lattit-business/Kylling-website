# Bare Kylling — nettside

Statisk landingsside. Ren HTML, CSS og JavaScript uten rammeverk, byggesteg
eller avhengigheter. Åpne `index.html` i en nettleser, så kjører den.

## Filstruktur

```
bare-kylling/
├── index.html          Forside (kanonisk kilde for felles topp/bunn)
├── smakene.html        De tre smakene (ankere: #brown-sugar-paprika osv.)
├── hvorfor.html        Problemet, fordelene, sammenligning, åpenhet
├── om-oss.html         Historien, ungdomsbedriften, «Ja. Vi er ganske glad i kylling.»
├── faq.html            Spørsmål og svar
├── venteliste.html     Påmeldingsskjemaet
├── 404.html            Feilside (GitHub Pages bruker den automatisk)
├── css/style.css       Design tokens og all styling
├── js/content.js       ← ALT innhold som skal kunne endres
├── js/main.js          Interaksjon (meny, FAQ, skjema, animasjon)
├── images/             Bildefiler — se images/README.md
└── images/figurer.svg  Tegnede figurer (maskot, doodles, ikoner) — se under
```

## Flere sider – slik henger de sammen

Menyen, mobilmenyen, CTA-båndet og footeren er **statisk duplisert** i alle
sidene, slik at nettstedet fungerer uten JavaScript og byggesteg. Blokkene er
merket med kommentarer:

```
<!-- BK:FELLES hode START --> … <!-- BK:FELLES hode END -->   (head: fonter, css, og:-tagger)
<!-- BK:FELLES topp START --> … <!-- BK:FELLES topp END -->   (skip-lenke, announce, meny)
<!-- BK:FELLES cta START -->  … <!-- BK:FELLES cta END -->    (grønt «Vil du smake først?»-bånd)
<!-- BK:FELLES bunn START --> … <!-- BK:FELLES bunn END -->   (footer)
```

`index.html` er fasit. Skal du endre noe felles:

1. Endre blokken i `index.html`.
2. Kjør `python3 tools/sjekk.py --fiks` fra repo-rota – den kopierer blokkene
   inn i de andre sidene og beholder `aria-current="page"` på hver sides egen
   menylenke.
3. Kjør `python3 tools/sjekk.py` (uten flagg) før du committer. Den sjekker at
   blokkene er identiske, at alle lenker/ankere/figurer finnes, at ingen
   udokumenterte påstander har sneket seg inn, og at hver side har én `<h1>`,
   unik tittel og beskrivelse.

Aktiv side markeres med `aria-current="page"` i HTML-en (JS setter det bare
som sikkerhetsnett). Sider uten CTA-bånd: `venteliste.html` og `404.html`.

## Figurene

`images/figurer.svg` er én sprite med `<symbol>`-er i logoens strek-stil.
Brukes slik, hvor som helst i HTML-en:

```html
<svg class="figure figure--md" aria-hidden="true" focusable="false">
  <use href="images/figurer.svg#kylling-loper"></use>
</svg>
```

- Størrelser: `figure--sm` (56 px), `figure--md` (96 px), `figure--lg`, `figure--xl`;
  ikoner bruker `class="icon"` (32 px). Fargen arves fra `color` i CSS.
- Maskot: `kylling-loper`, `kylling-titter`, `kylling-i-sekk`, `kylling-snakker`,
  `kylling-flekser`, `kylling-sover`
- Doodles: `doodle-chili`, `doodle-lime`, `doodle-sitron`, `doodle-hvitlok`,
  `doodle-urt`, `doodle-pepper`, `doodle-paprika`, `doodle-sukker`
- Ikoner: `ikon-riv-opp`, `ikon-kald-varm`, `ikon-hake`, `ikon-sekk`,
  `ikon-kylling`, `ikon-epost`, `ikon-bjelle`, `ikon-panne`
- Snakkeboble: `<div class="mascot"><svg class="figure …"/><p class="bubble">Tekst</p></div>`
  (`mascot--rev` speilvendt, `mascot--stack` boble over figur). Boblen er ekte
  tekst; figuren er `aria-hidden`.
- Roterende stempler (`.sticker`) ligger inline i HTML-en og skriver teksten
  langs `#sirkel`, som er definert i toppblokken. Ny tekst bør være 26–32 tegn.

Ny figur: legg til et `<symbol id="…" viewBox="0 0 120 120" …>` i spriten
med samme strek-attributter som naboene, og referer til den med `<use>`.
`tools/sjekk.py` sier fra om symboler som ikke er i bruk.

Merk: `<use>` mot en ekstern fil krever at siden serveres over `http://`.
Åpner du HTML-filene direkte fra disk (`file://`), vises ikke figurene i
Chrome. Bruk `python3 -m http.server` (se rot-README).

## Før lansering — sjekkliste

Alt styres fra `js/content.js`.

1. **Legg inn produktbildet.** Se `images/README.md`.
2. **Koble påmeldingsskjemaet.** Sett `config.ventelisteEndepunkt` til en URL
   (Formspree, Supabase, Mailchimp), eller `config.kontaktEpost` til en ekte
   adresse. Uten én av delene lagres ingenting, og siden sier det rett ut
   framfor å late som.
3. **Fyll inn lenker.** `config.lenker.instagram` og `config.lenker.kontakt`.
   Så lenge de er `null`, vises de som «kommer» i footeren — aldri som en
   lenke som ikke går noe sted.
4. **Verifiser påstandene.** Se avsnittet under.
5. **Legg inn domenet.** `og:url` og `og:image` peker i dag på GitHub Pages-
   adressen. Får dere eget domene: bytt adressen i alle sidene (søk etter
   `lattit-business.github.io/Kylling-website/`) og legg inn `canonical`
   (kommentert linje øverst i `index.html`). Canonical er bevisst utelatt til
   da — en canonical mot feil domene skader synligheten i søk.
6. **Slå av dev-modus.** Sett `config.devModus = false`. Da forsvinner alle
   de stiplede «må verifiseres»-boksene.

## Påstander som ikke er dokumentert

Disse står på pakkedesignet, men er ikke verifisert. De vises **ikke** på siden.
I dev-modus vises de i stiplede bokser slik at dere ser hva som gjenstår.

| Påstand | Hva som kreves før den kan brukes |
|---|---|
| 36 g protein per 200 g | Næringsanalyse fra laboratorium |
| 185 kalorier per 200 g | Næringsanalyse fra laboratorium |
| 100 % kylling | Dokumentert resept og kjøttinnhold |
| Ingen tilsatt vann | Dokumentert produksjonsprosess |
| Uten tilsetningsstoffer | Full ingrediensdeklarasjon |
| Nyt Norge | Godkjent avtale med Stiftelsen Matmerk |
| Ingredienslister | Mengder, allergener og saltinnhold fra endelig resept |
| Urteblandingen i Sitron & Urter | Pakken har ingen ingrediensliste trykket på seg |

Når noe er dokumentert: sett `bekreftet: true` på oppføringen i `content.js`.
Da vises den automatisk på siden.

Holdbarhet, oppbevaring og lanseringsdato er bevisst ikke oppgitt noe sted.
Svarene i FAQ sier ærlig at de ikke er fastsatt ennå.

## Når nettbutikken åpner

Sett `config.butikkAktiv = true` i `content.js`. Alle hoved-CTA-er bytter fra
«Få beskjed ved lansering» til «Bestill nå». Teksten og lenken justeres i
`config.cta`.

## Teknisk

- Mobile-first. Testet på 375, 390, 430, 768 og 1440 px uten horisontal scroll.
- Alle klikkmål er minst 44 px.
- Tastaturnavigasjon, synlig fokusmarkering, `aria`-merking på meny og skjema.
- All animasjon respekterer `prefers-reduced-motion`.
- Fungerer uten JavaScript: alt innhold unntatt ingredienslistene er i HTML-en,
  og navigasjonen mellom sidene er vanlige lenker.
- `404.html` setter `<base>` med et lite script fordi GitHub Pages serverer den
  på den etterspurte (dype) adressen. Uten script vises siden ustylet, men med
  en absolutt lenke til forsiden.
- To webfonter fra Google Fonts (Archivo og Manrope). Ingen andre eksterne kall.

## Publisering

Mappen er selvstendig og kan legges rett på GitHub Pages, Netlify, Vercel eller
en vanlig webserver. Ingen bygging.
