# Bildefiler

Filnavnene under er hardkodet i HTML-filene, så de må stemme nøyaktig.
`python3 tools/sjekk.py` (fra repo-rota) sier fra om referanser som ikke finnes –
også i `srcset`.

## Format

Hvert motiv finnes i tre WebP-bredder og én JPEG-reserve:

```
navn-720.webp   navn-1100.webp   navn-<full>.webp   navn.jpg
```

(Stående bilder bruker 540/800/full. `spis-ute` brukes bare i en liten flis og har derfor kun 540 og 800.) HTML-en bruker `<picture>` med WebP i
`srcset`, og JPEG-en som `src` for nettlesere uten WebP-støtte. WebP er
kvalitet 74 (80 for utklippet), JPEG er kvalitet 78, progressiv.

Originalene (PNG, 2–4 MB) ligger i [`/bilder-originaler/`](../../bilder-originaler/)
i repo-rota. De publiseres ikke. Slik lager du variantene på nytt når et bilde
byttes (krever Pillow: `pip install pillow`):

```python
from PIL import Image
im = Image.open('bilder-originaler/smak-original.png').convert('RGB')
for b in (720, 1100, im.width):
    r = im if b == im.width else im.resize((b, round(im.height * b / im.width)), Image.LANCZOS)
    r.save(f'bare-kylling/images/smak-original-{b}.webp', 'WEBP', quality=74, method=6)
im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS) \
  .save('bare-kylling/images/smak-original.jpg', 'JPEG', quality=78, optimize=True, progressive=True)
```

## I bruk

| Filnavn | Motiv | Brukes |
|---|---|---|
| `hero-to-pakker-i-hand` | Hånd holder begge pakkene, **gjennomsiktig bakgrunn** (3:2) | Hero på forsiden, venteliste.html. JPEG-reserven har honningfarget bakgrunn (#F1B240) |
| `smak-original` | Original-pakken på mørk grønn bakgrunn med salt, pepper og urter. Pakken til venstre (16:10) | Smakskort (forside) + bånd (smakene.html) |
| `smak-sweet-paprika` | Sweet Paprika-pakken med paprikapulver, pepper og hvitløk. Pakken til høyre (16:10) | Smakskort (forside) + bånd (smakene.html) |
| `to-smaker-kjokken` | Begge pakkene på lys kjøkkenbenk med krydder (16:9) | Toppen av smakene.html |
| `to-smaker-benk` | Begge pakkene på solfylt kjøkkenbenk (16:9) | «Historien» (om-oss.html) |
| `to-pakker-forfra` | Begge pakkene forfra, lys bakgrunn (3:2) | «Kvalitet» (forside) |
| `to-pakker-hand-lys` | Hånd løfter Sweet Paprika, lys bakgrunn (4:3) | Toppen av hvorfor.html |
| `pakke-sweet-paprika` | Sweet Paprika, enkeltpakke forfra (3:4) | «Allerede ferdig» (hvorfor.html) |
| `farten-treningsbag` | Sweet Paprika i en treningsbag i garderoben (3:4) | «Etter trening» (forside) + «Ta den med» (hvorfor.html) |
| `farten-skolesekk` | Original i en skolesekk ved pulten (4:5) | «På skolen» (forside) + «Når det passer deg» (hvorfor.html) |
| `spis-rett-fra-pakken` | Ung mann biter i en kyllingfilet, oransje bakgrunn (3:4) | Stor flis «Rett fra pakken» (forside) |
| `spis-ute` | Kvinne biter i en kyllingfilet ute på gresset. Beskåret: stempel og rå kjøttpakke nederst er fjernet | Flis «Mellom måltider» (forside) |
| `proteinbar-ingrediensliste` | Baksiden av en proteinbar med lang ingrediensliste (4:3) | «Problemet» (forside + hvorfor.html) |
| `krydder-oppskrift` | Krydder veies opp og noteres, krydret kyllingfilet på brett (3:2) | «Status» (om-oss.html) |
| `og-bare-kylling.jpg` | Beskåret `to-smaker-kjokken`, 1200 × 630 | `og:image` ved deling i sosiale medier |
| `figurer.svg` | Tegnede figurer: maskot, doodles og ikoner (SVG-sprite) | Alle sider – se `../README.md` |

Smaksbildene beskjæres med `object-fit: cover`. Beskjæringen er ankret mot
pakken (`object-position` i `css/style.css`), slik at det er krydderet i
kanten som kuttes – ikke emballasjen.

## Bevisst ikke brukt

| Original | Hvorfor |
|---|---|
| `ubrukt-risbolle.png` | Viser kyllingen over ris. Nettsiden posisjonerer produktet som et mellommåltid rett fra pakken, ikke som middagsingrediens |
| `ubrukt-wrap.png` | Samme grunn – kylling i wrap |
| `kyllingikon.png` | Logoen ligger som inline-SVG i toppen av hver side og trenger ingen fil |

## Må ses på før lansering

Alle produktbildene er generert. Emballasjen på dem viser:

- **Paprika-pakken heter bare «Paprika»**, mens produktnavnet er «Sweet Paprika».
  Oppdater etiketten før ekte pakker trykkes og fotograferes.
- **Udokumenterte tall og merker:** «36 g protein», «185 kalorier»,
  «Uten tilsetningsstoffer», «Nyt Norge» og «100 % kylling – ingen tilsatt vann».
  Nettsiden skriver ikke disse i tekst (se `../README.md`).

Når dere har ekte pakker: ta nye bilder i samme lys og format, behold
filnavnene og lag variantene på nytt.
