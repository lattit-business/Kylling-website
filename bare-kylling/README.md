# Bare Kylling — nettside

Statisk produktside for Bare Kylling – ferdigstekt kyllingfilet i to smaker,
Original og Sweet Paprika, posisjonert som «naturens proteinbar»: et
proteinrikt mellommåltid du tar med og spiser rett fra pakken.

Ren HTML, CSS og JavaScript uten rammeverk, byggesteg eller avhengigheter.
Informasjonsside, ikke nettbutikk: ingen handlekurv, ingen bestilling.

## Filstruktur

```
bare-kylling/
├── index.html          Forside (kanonisk kilde for felles topp/CTA/bunn):
│                       hero med nøkkeltall, problemet, sammenligning, fordeler,
│                       på farten, de to smakene, kvalitet, næringsinnhold, FAQ
├── smakene.html        De to smakene (ankere: #original, #sweet-paprika)
├── hvorfor.html        Naturens proteinbar: problemet, tre bånd, hva som er i pakken
├── om-oss.html         Historien, hvem, slik jobber vi, status (#status)
├── faq.html            Spørsmål og svar
├── venteliste.html     Påmeldingsskjemaet
├── 404.html            Feilside (GitHub Pages bruker den automatisk)
├── robots.txt          Peker på sitemap.xml
├── sitemap.xml         Alle sidene (oppdater hvis du legger til en side)
├── css/style.css       Design tokens og all styling
├── js/content.js       ← ALT innhold som skal kunne endres
├── js/main.js          Interaksjon (meny, skjema, sticky CTA, innhold fra content.js)
├── images/             Bildefiler — se images/README.md
└── images/figurer.svg  Tegnede figurer (maskot, doodles, ikoner) — se under
```

## Flere sider – slik henger de sammen

Menyen, mobilmenyen, CTA-båndet og footeren er **statisk duplisert** i alle
sidene, slik at nettstedet fungerer uten JavaScript og byggesteg. Blokkene er
merket med kommentarer:

```
<!-- BK:FELLES hode START --> … <!-- BK:FELLES hode END -->   (head: fonter, css, og:-tagger)
<!-- BK:FELLES topp START --> … <!-- BK:FELLES topp END -->   (skip-lenke, infostripe «Kommer snart», meny)
<!-- BK:FELLES cta START -->  … <!-- BK:FELLES cta END -->    (honningfarget «Vil du smake først?»-bånd med påmeldingsskjema)
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
- Doodles: `doodle-salt`, `doodle-pepper` (Original),
  `doodle-paprika`, `doodle-honning` (Sweet Paprika)
- Ikoner: `ikon-riv-opp`, `ikon-kald-varm`, `ikon-hake`, `ikon-sekk`,
  `ikon-kylling`, `ikon-epost`, `ikon-bjelle`, `ikon-panne`, `ikon-oye`, `ikon-sted`
- Snakkeboble: `<div class="mascot"><svg class="figure …"/><p class="bubble">Tekst</p></div>`
  (`mascot--rev` speilvendt, `mascot--stack` boble over figur). Boblen er ekte
  tekst; figuren er `aria-hidden`.
- Det roterende stempelet i heroen (`.sticker`, «2 smaker» med navnene rundt)
  ligger inline i HTML-en og skriver teksten langs `#sirkel`, som er definert
  i toppblokken. Det er bevisst det eneste stempelet på nettstedet.

Ny figur: legg til et `<symbol id="…" viewBox="0 0 120 120" …>` i spriten
med samme strek-attributter som naboene, og referer til den med `<use>`.
`tools/sjekk.py` sier fra om symboler som ikke er i bruk.

Merk: `<use>` mot en ekstern fil krever at siden serveres over `http://`.
Åpner du HTML-filene direkte fra disk (`file://`), vises ikke figurene i
Chrome. Bruk `python3 -m http.server` (se rot-README).

## Før lansering — sjekkliste

Alt styres fra `js/content.js`.

1. **Fyll inn produktdata.** Nøkkeltallene i heroen, næringsdeklarasjonen,
   ingredienser, allergener, opprinnelse, kvalitetskontroll, holdbarhet og
   oppbevaring står som plassholdere til dere fyller dem inn og setter
   `bekreftet: true`. Se tabellen under.
2. **Oppdater paprika-etiketten.** Smakene heter «Original – Salt, Pepper &
   Urter» og «Sweet Paprika», men pakkedesignet på bildene sier bare «Paprika».
3. **Koble påmeldingsskjemaet.** `config.ventelisteEndepunkt` er satt til
   Formspree. Settes den til `null`, skjules e-postfeltet og siden sier ærlig
   at påmeldingen åpner snart. Skjemaet ligger både i CTA-båndet (alle sider)
   og på venteliste.html.
4. **Fyll inn kontakt.** `config.kontaktEpost` og `config.lenker.instagram`.
   Så lenge de er `null`, står det en setning i footeren om at de kommer.
5. **Legg inn teamet.** I `om-oss.html` ligger en kommentert `.team`-blokk med
   kort per person. Fyll inn navn, rolle og bilde, og fjern kommentartegnene.
6. **Oppdater statuslista** på Om oss (`#status`) etter hvert som resept,
   næringsanalyse, produksjon og lansering faller på plass.
7. **Legg inn domenet.** Se rot-README og `tools/domene.py`.
8. **Slå av dev-modus.** Sett `config.devModus = false`. Da forsvinner alle
   de stiplede «må verifiseres»-boksene.

## Plassholdere og påstander som ikke er dokumentert

Nettsiden viser **tydelige plassholdere** («Venter på analyse», «Kommer før
lansering», «–» i næringstabellen) der opplysningene mangler. Tallene og
merkene som står trykket på pakkedesignet, vises ikke i tekst før de er
dokumentert. I dev-modus vises de i stiplede bokser.

| Opplysning | Hvor i `content.js` | Hva som kreves |
|---|---|---|
| Protein og kalorier per pakke (hero og sammenligning) | `nokkeltall` | Næringsanalyse fra laboratorium |
| Næringsdeklarasjon per 100 g (per pakke regnes ut) | `smaker.*.naering` | Næringsanalyse fra laboratorium |
| Ingrediensliste | `smaker.*.ingredienser` | Endelig resept med mengder |
| Allergener | `smaker.*.allergener` | Endelig resept + krydderleverandørens spesifikasjon |
| Hvor kyllingen kommer fra | `opprinnelse` | Leverandøravtale med opprinnelsesland |
| Kvalitetskontroll | `kvalitetskontroll` | Beskrivelse av produksjon og internkontroll |
| Holdbarhet | `holdbarhet` | Holdbarhetstest |
| Oppbevaring | `oppbevaring` | Fastsatt oppbevaringsanvisning |
| 100 % kylling, ingen tilsatt vann, uten tilsetningsstoffer, Nyt Norge | `merker` | Resept, produksjonsprosess, Matmerk-avtale |

Når noe er dokumentert: fyll inn verdien og sett `bekreftet: true`. Da byttes
plassholderen ut automatisk på alle sider. Merk at `tools/sjekk.py` melder
`bekreftet: true` som feil – det er en bevisst sperre, så noen må se over
dokumentasjonen før publisering. Fjern den linjen i skriptet når dataene er
kontrollert.

Fast i HTML-en (bekreftet, ikke plassholdere): kyllingen er ferdigstekt og
trenger ingen tilberedning («0 min»), kan spises kald og kan varmes i
mikrobølgeovn. «200 g» er pakkestørrelsen.

Plassholdertekstene har bevisst en lett, leken tone («Lab-en jobber med
saken», «Under arbeid», «Fra en kylling – så mye kan vi love»), men lover
aldri noe som ikke er bekreftet.

## Når produktet kommer i salg

1. Bytt teksten i infostripa øverst (felles `topp`-blokk i `index.html`) og
   kjør `python3 tools/sjekk.py --fiks`.
2. Sett `config.butikkAktiv = true` i `content.js`. Hoved-CTA-ene bytter da til
   teksten i `config.cta.medButikk` («Se hvor du får kjøpt den»). Nettsiden
   har ingen handlekurv – lenken bør gå til utsalgssteder.

## Teknisk

- Mobile-first. Testet på 390 og 1440 px (pluss 768 i utvikling) uten
  horisontal scroll.
- Alle klikkmål er minst 44 px.
- Tastaturnavigasjon, synlig fokusmarkering, `aria`-merking på meny, skjema og
  den sveipbare sammenligningstabellen.
- All animasjon respekterer `prefers-reduced-motion`.
- Fungerer uten JavaScript: alt innhold er i HTML-en; JavaScript fyller bare
  inn bekreftede data fra `content.js` og styrer meny og skjema.
- En ny side starter alltid øverst (eller ved #ankeret i lenken), også i
  innebygde forhåndsvisninger som husker scrollposisjonen fra forrige side.
  Tilbake-knappen beholder posisjonen som vanlig. Se «0. NY SIDE STARTER
  ØVERST» i `js/main.js`.
- Animasjoner (se «T. ANIMASJONER» i `css/style.css` og «5. ANIMASJONER» i
  `js/main.js`): heroen bygges opp ved lasting og pakkene svever rolig,
  «200 g» teller opp, innhold toner inn når du scroller, kort og knapper
  reagerer på hover, maskotene får litt liv, rullebåndet under heroen går av
  seg selv, spørsmål åpner seg mykt og sidene glir over i hverandre
  (View Transitions). Kun CSS og litt JavaScript, ingen biblioteker, og bare
  `transform`/`opacity` animeres.
- Alt er pynt: klassen `.anim` settes i `<head>` bare når nettleseren støtter
  det og brukeren ikke har slått på «redusert bevegelse». Uten den står alt
  i ro og er synlig. Innhold som allerede vises ved lasting, og ankermål
  (elementer med id), animeres aldri inn fra scroll.
- Bilder: `<picture>` med WebP i tre bredder og JPEG-reserve. Hero-bildet
  forhåndslastes; resten lastes lat (se images/README.md).
- `404.html` setter `<base>` med et lite script fordi GitHub Pages serverer den
  på den etterspurte (dype) adressen.
- To webfonter fra Google Fonts: Archivo (variabel, med bredde-akse for de
  kondenserte overskriftene) og Manrope. Ingen andre eksterne kall.

## Publisering

Mappen er selvstendig og kan legges rett på GitHub Pages, Netlify, Vercel eller
en vanlig webserver. Ingen bygging.
