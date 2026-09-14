# Bildefiler

Filnavnene under er hardkodet i `index.html`, så de må stemme nøyaktig. Siden
bytter automatisk til en navngitt plassholder hvis en fil mangler.

Alle filene er JPEG, maks 1800 px brede og under 300 kB.

## I bruk

| Filnavn | Motiv | Brukes |
|---|---|---|
| `bare-kylling-pakker.jpg` | Tre pakker på rad, kremhvit bakgrunn (liggende, 16:9) | Hero + `og:image` |
| `smak-brown-sugar-paprika.jpg` | Brown Sugar Paprika med paprikapulver, hvitløk og brunt sukker. Pakken til høyre | Smaksbånd 01 |
| `smak-smoky-chili-lime.jpg` | Smoky Chili Lime med lime og chili på mørk grønn bakgrunn. Pakken til venstre | Smaksbånd 02 |
| `smak-sitron-og-urter.jpg` | Sitron & Urter med sitron, timian og basilikum. Pakken til høyre | Smaksbånd 03 |
| `pakke-apnet.jpg` | Sitron & Urter, enkeltpakke (stående, 3:4) | «Allerede ferdig.» |
| `kylling-naerbilde.jpg` | Brown Sugar Paprika, enkeltpakke (stående, 3:4) | «Faktisk mat.» |
| `pakke-i-sekk.jpg` | Brown Sugar Paprika og Smoky Chili Lime side om side (stående, 3:4) | «Ta den med.» |
| `kylling-i-wrap.jpg` | Smoky Chili Lime, enkeltpakke (stående, 3:4) | «Kald eller varm.» |
| `bruk-etter-trening.jpg` | To pakker på treningsbenk med håndkle og drikkeflaske | Flis «Etter trening» |
| `bruk-wrap.jpg` | Sitron & Urter ved siden av en ferdig wrap på et skrivebord | Flis «I wrap» |
| `bruk-jobb.jpg` | Tre pakker i et lyst kjøkkenmiljø (liggende, 16:9) | Bred flis «På jobb» |

Filnavnene i fordelsseksjonen (`pakke-apnet`, `kylling-naerbilde`, `pakke-i-sekk`,
`kylling-i-wrap`) beskriver motivene som opprinnelig var tenkt der. Det finnes
ikke bilder av åpnet pakke, nærbilde av kjøttet, pakke i sekk eller kylling i
wrap ennå, så plassene bruker de stående produktbildene. Bytt ut filene når
slike bilder foreligger – `alt`-tekstene i `index.html` må da oppdateres.

Smaksbildene beskjæres med `object-fit: cover`. Beskjæringen er ankret mot
pakken (`object-position` i `css/style.css`), slik at det er ingrediensene i
kanten som kuttes – ikke emballasjen.

## Fliser uten bilde

«På skolen» og «Med ris» har ingen bilder ennå og vises som fargede tekstfliser
(`tile--sage` og `tile--ink`). Vil dere ha bilder der, legg inn `bruk-skole.jpg`
og `bruk-ris.jpg` og gjør flisene om til bildefliser etter mønster fra de andre.

## `ubrukt/`

| Filnavn | Hva |
|---|---|
| `pakke-sitron-og-urter-alternativ.png` | Alternativt bilde av Sitron & Urter-pakken, tettere beskåret (original, ukomprimert) |
| `kyllingikon.png` | Kyllingikonet. Trengs ikke – logoen ligger som inline-SVG i `index.html` |

## Logoen

Kyllingikonet ligger som inline-SVG i `index.html`, tegnet etter logoen deres.
Det er skarpt i alle størrelser og arver farge fra CSS, så det trenger ingen fil.
