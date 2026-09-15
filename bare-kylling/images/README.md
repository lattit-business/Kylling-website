# Bildefiler

Filnavnene under er hardkodet i HTML-filene, så de må stemme nøyaktig. Siden
bytter automatisk til en navngitt plassholder hvis en fil mangler.
`python3 tools/sjekk.py` (fra repo-rota) sier fra om referanser som ikke finnes.

Alle filene er JPEG, maks 1800 px brede og under 300 kB.

## I bruk

| Filnavn | Motiv | Brukes |
|---|---|---|
| `bare-kylling-pakker.jpg` | Tre pakker på rad, kremhvit bakgrunn (liggende, 16:9) | Hero på forsiden + `og:image` |
| `smak-brown-sugar-paprika.jpg` | Brown Sugar Paprika med paprikapulver, hvitløk og brunt sukker. Pakken til høyre | Smakskort (forside) + bånd 01 (smakene.html) |
| `smak-smoky-chili-lime.jpg` | Smoky Chili Lime med lime og chili på mørk grønn bakgrunn. Pakken til venstre | Smakskort + bånd 02 |
| `smak-sitron-og-urter.jpg` | Sitron & Urter med sitron, timian og basilikum. Pakken til høyre | Smakskort + bånd 03 |
| `pakke-apnet.jpg` | Sitron & Urter, enkeltpakke (stående, 3:4) | «Allerede ferdig.» (hvorfor.html) |
| `kylling-naerbilde.jpg` | Brown Sugar Paprika, enkeltpakke (stående, 3:4) | «Faktisk mat.» (hvorfor.html) |
| `pakke-i-sekk.jpg` | Brown Sugar Paprika og Smoky Chili Lime side om side (stående, 3:4) | «Ta den med.» (hvorfor.html) |
| `kylling-i-wrap.jpg` | Smoky Chili Lime, enkeltpakke (stående, 3:4) | «Kald eller varm.» (hvorfor.html) |
| `bruk-etter-trening.jpg` | To pakker på treningsbenk med håndkle og drikkeflaske | Flis «Etter trening» (forside) |
| `bruk-wrap.jpg` | Sitron & Urter ved siden av en ferdig wrap på et skrivebord | Flis «I wrap» (forside) |
| `bruk-jobb.jpg` | Tre pakker i et lyst kjøkkenmiljø (liggende, 16:9) | Bred flis «På jobb» (forside) |
| `figurer.svg` | Tegnede figurer: maskot, doodles og ikoner (SVG-sprite) | Alle sider – se `../README.md` |

Filnavnene i fordelsseksjonen (`pakke-apnet`, `kylling-naerbilde`, `pakke-i-sekk`,
`kylling-i-wrap`) beskriver motivene som opprinnelig var tenkt der. Det finnes
ikke bilder av åpnet pakke, nærbilde av kjøttet, pakke i sekk eller kylling i
wrap ennå, så plassene bruker de stående produktbildene. Bytt ut filene når
slike bilder foreligger – `alt`-tekstene i `index.html` må da oppdateres.

Smaksbildene beskjæres med `object-fit: cover`. Beskjæringen er ankret mot
pakken (`object-position` i `css/style.css`), slik at det er ingrediensene i
kanten som kuttes – ikke emballasjen.

## Fliser uten bilde

«På skolen» og «Med ris» har ingen bilder ennå. «På skolen» viser kyllingen i
sekken (`kylling-i-sekk`), «Med ris» er en ren tekstflis, og «I farta» viser
den løpende kyllingen. Vil dere ha foto der, legg inn `bruk-skole.jpg` og
`bruk-ris.jpg` og gjør flisene om til bildefliser etter mønster fra de andre.

## `ubrukt/`

| Filnavn | Hva |
|---|---|
| `pakke-sitron-og-urter-alternativ.png` | Alternativt bilde av Sitron & Urter-pakken, tettere beskåret (original, ukomprimert) |
| `kyllingikon.png` | Kyllingikonet. Trengs ikke – logoen ligger som inline-SVG i `index.html` |

## Logoen

Kyllingikonet ligger som inline-SVG i toppen av hver side, tegnet etter logoen deres.
Det er skarpt i alle størrelser og arver farge fra CSS, så det trenger ingen fil.
