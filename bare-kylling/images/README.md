# Bildefiler

Filnavnene under er hardkodet i HTML-filene, så de må stemme nøyaktig.
`python3 tools/sjekk.py` (fra repo-rota) sier fra om referanser som ikke finnes.
Mangler en fil, viser nettleseren `alt`-teksten.

Alle filene er JPEG, maks 1800 px brede og under 300 kB. Hvert bilde har i
tillegg en mindre variant (`-720.jpg` for stående/4:3, `-900.jpg` for liggende)
som brukes via `srcset` på mobil. Lag den slik når du bytter et bilde:

```bash
sips --resampleWidth 720 -s format jpeg -s formatOptions 76 navn.jpg --out navn-720.jpg
```

## I bruk

| Filnavn | Motiv | Brukes |
|---|---|---|
| `bare-kylling-pakker.jpg` | Tre pakker på rad, kremhvit bakgrunn (16:9) | Hero på forsiden + `og:image` |
| `smak-brown-sugar-paprika.jpg` | Brown Sugar Paprika med paprikapulver, hvitløk og brunt sukker. Pakken til høyre | Smakskort (forside) + bånd (smakene.html) |
| `smak-smoky-chili-lime.jpg` | Smoky Chili Lime med lime og chili på mørk grønn bakgrunn. Pakken til venstre | Smakskort + bånd |
| `smak-sitron-og-urter.jpg` | Sitron & Urter med sitron, timian og basilikum. Pakken til høyre | Smakskort + bånd |
| `pakke-apnet.jpg` | Sitron & Urter, enkeltpakke (3:4) | «Allerede ferdig» (hvorfor.html) |
| `bruk-ris.jpg` | Bolle med ris, skivet stekt kylling, agurk og lime (4:5) | «Faktisk mat» (hvorfor.html) + flis «Over ris» (forside) |
| `pakke-i-sekk.jpg` | Treningsbag med håndkle, flaske og en pakke oppi (3:4) | «Ta den med» (hvorfor.html) |
| `bruk-wrap.jpg` | Sitron & Urter ved siden av en ferdig wrap (4:5) | «Kald eller varm» (hvorfor.html) + flis «I wrap» (forside) |
| `bruk-etter-trening.jpg` | To pakker på treningsbenk med håndkle og drikkeflaske (4:5) | Flis «Etter trening» (forside) |
| `bruk-skole.jpg` | Åpen skolesekk på pult med bøker, flaske og pakke (4:5) | Flis «På skolen» (forside) |
| `bruk-jobb.jpg` | Tre pakker i et lyst kjøkkenmiljø (16:9) | Bred flis «På jobb» (forside) + «Historien» (om-oss.html) |
| `lei-ultraprosessert.jpg` | Proteinbarer i folie, proteinpulver og shaker (4:3) | «Vi er lei»-kort 1 (forside) |
| `lei-ingrediensliste.jpg` | Kvinne studerer en lang ingrediensliste (4:3) | «Vi er lei»-kort 2 (forside) |
| `lei-mikroplast.jpg` | Innpakkede snacks og ferdigrett på kjøkkenbenk (4:3) | «Vi er lei»-kort 3 «matbokser» (forside) |
| `figurer.svg` | Tegnede figurer: maskot, doodles og ikoner (SVG-sprite) | Alle sider – se `../README.md` |

Smaksbildene beskjæres med `object-fit: cover`. Beskjæringen er ankret mot
pakken (`object-position` i `css/style.css`), slik at det er ingrediensene i
kanten som kuttes – ikke emballasjen.

## Bilder som bør byttes ut

Alle produktbildene er generert, og emballasjen på dem viser merker og tall
(«36g protein», «185 kalorier», «Nyt Norge», «Uten tilsetningsstoffer») som
ikke er dokumentert og som nettsiden derfor ikke skriver. Fileten ser også
rå ut, mens produktet er ferdigstekt. Når dere har ekte pakker og stekt
kylling: ta nye bilder i samme lys og format, behold filnavnene, og lag
`-720`/`-900`-variantene på nytt.

## `ubrukt/`

| Filnavn | Hva |
|---|---|
| `kylling-naerbilde.jpg` | Brown Sugar Paprika, enkeltpakke (3:4). Var stand-in for et nærbilde av kjøttet |
| `kylling-i-wrap.jpg` | Smoky Chili Lime, enkeltpakke (3:4). Var stand-in for kylling i wrap |
| `to-pakker-side-om-side.jpg` | Brown Sugar Paprika og Smoky Chili Lime side om side (3:4) |
| `pakke-sitron-og-urter-alternativ.png` | Alternativt bilde av Sitron & Urter-pakken (original, ukomprimert) |
| `kyllingikon.png` | Kyllingikonet. Trengs ikke – logoen ligger som inline-SVG |

## Logoen

Kyllingikonet ligger som inline-SVG i toppen av hver side, tegnet etter logoen deres.
Det er skarpt i alle størrelser og arver farge fra CSS, så det trenger ingen fil.
