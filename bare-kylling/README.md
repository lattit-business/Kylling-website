# Bare Kylling — nettside

Statisk landingsside. Ren HTML, CSS og JavaScript uten rammeverk, byggesteg
eller avhengigheter. Åpne `index.html` i en nettleser, så kjører den.

## Filstruktur

```
bare-kylling/
├── index.html          Hele siden, semantisk oppmerket
├── css/style.css       Design tokens og all styling
├── js/content.js       ← ALT innhold som skal kunne endres
├── js/main.js          Interaksjon (meny, FAQ, skjema, animasjon)
└── images/             Bildefiler — se images/README.md
```

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
5. **Legg inn domenet.** Øverst i `index.html` ligger tre kommenterte linjer
   (`canonical`, `og:url`, `og:image`). Fyll inn det ekte domenet og fjern
   kommentaren. De er bevisst tomme nå — en canonical mot feil domene skader
   synligheten i søk.
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
- Fungerer uten JavaScript: alt innhold unntatt ingredienslistene er i HTML-en.
- To webfonter fra Google Fonts (Archivo og Manrope). Ingen andre eksterne kall.

## Publisering

Mappen er selvstendig og kan legges rett på GitHub Pages, Netlify, Vercel eller
en vanlig webserver. Ingen bygging.
