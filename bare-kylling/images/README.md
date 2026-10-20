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
| `rett-fra-pakken` | Ung mann med solbriller biter i en kyllingfilet, oransje bakgrunn (3:4) | «Hva du får» med «Rett fra pakken» (forside) |
| `spis-ute` | Kvinne biter i en kyllingfilet ute på gresset. Beskåret: stempel og rå kjøttpakke nederst er fjernet | Flis «Mellom måltider» (forside) |
| `proteinbar-salt-karamell` | En påbitt proteinbar med salt karamell i blå innpakning (4:3) | «Problemet» (forside + hvorfor.html) |
| `krydder-oppskrift` | Krydder veies opp og noteres, krydret kyllingfilet på brett (3:2) | «Status» (om-oss.html) |
| `prototype-to-smaker` | **Ekte foto.** Prøvepakkene på kjøkkenbenken: Sweet Paprika til venstre, Original til høyre (4:5) | Stort bilde i «Prototypen» (om-oss.html). Etikettene ligger under hver sin pose |
| `prototype-kjokkenbenk` | **Ekte foto.** Prøvepakkene foran skjærebrettet, sett ovenfra (ca. 6:7) | «Prototypen» (om-oss.html) |
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
| `ubrukt-spis-rett-fra-pakken-caps.png` | Tidligere bilde i «Hva du får» (gutt med oransje caps). Byttet ut med `rett-fra-pakken` |
| `kyllingikon.png` | Logoen ligger som inline-SVG i toppen av hver side og trenger ingen fil |
| `ubrukt-prototype-i-hand.heic` | En hånd holder opp prøvepakkene foran en lys vegg. Var med i «Prototypen» som «Prøvepakkene», men er tatt ut. Plassen har en tekstflis i stedet |
| `ubrukt-prototype-i-hand-2.heic` | Nesten likt `ubrukt-prototype-i-hand`, men hånden er kuttet i kanten |
| `ubrukt-prototype-skra.heic` | Samme motiv som `prototype-to-smaker`, tatt på skrå og mindre ryddig |
| `ubrukt-prototype-to-smaker-uskarp.heic` | Tatt et sekund etter `prototype-to-smaker`, men uskarpt |

## Prototype-bildene (ekte foto)

Originalene er iPhone-bilder i HEIC (`bilder-originaler/prototype-*.heic`).
GPS-posisjonen er fjernet fra dem med `exiftool -gps:all= -overwrite_original`.
Det endrer bare metadataene, ikke selve bildet. Gjør det samme med nye
mobilbilder før de legges i repoet, for posisjonen viser hvor bildet er tatt.

Variantene er beskåret og har fått en mild justering av kontrast og farge.
Bildene på nettsiden har ingen metadata, fordi Pillow ikke tar med EXIF når
`exif=` ikke er oppgitt. Slik lager du dem på nytt (krever
`pip install pillow pillow-heif`):

```python
from PIL import Image, ImageOps, ImageEnhance
import pillow_heif
pillow_heif.register_heif_opener()
UTSNITT = {  # (venstre, topp, høyre, bunn) i originalen, 3024 × 4032
    'prototype-to-smaker':   (0, 121, 3024, 3901),
    'prototype-kjokkenbenk': (0, 470, 3024, 4032),
}
for navn, boks in UTSNITT.items():
    im = Image.open(f'bilder-originaler/{navn}.heic').convert('RGB').crop(boks)
    im = ImageOps.autocontrast(im, cutoff=0.3, preserve_tone=True)
    im = ImageEnhance.Color(ImageEnhance.Contrast(im).enhance(1.05)).enhance(1.05)
    for b in (540, 800, 1200):
        im.resize((b, round(im.height * b / im.width)), Image.LANCZOS) \
          .save(f'bare-kylling/images/{navn}-{b}.webp', 'WEBP', quality=74, method=6)
    im.resize((800, round(im.height * 800 / im.width)), Image.LANCZOS) \
      .save(f'bare-kylling/images/{navn}.jpg', 'JPEG', quality=78, optimize=True, progressive=True)
```

## Må ses på før lansering

Alle produktbildene er generert, bortsett fra prototype-bildene. De viser
prøvepakker i vanlige vakuumposer, ikke den ferdige emballasjen. Bildeteksten
på om-oss.html sier det. Emballasjen på de genererte bildene viser:

- **Paprika-pakken heter bare «Paprika»**, mens produktnavnet er «Sweet Paprika».
  Oppdater etiketten før ekte pakker trykkes og fotograferes.
- **Udokumenterte tall og merker:** «36 g protein», «185 kalorier»,
  «Uten tilsetningsstoffer», «Nyt Norge» og «100 % kylling – ingen tilsatt vann».
  Nettsiden skriver ikke disse i tekst (se `../README.md`).

Når dere har ekte pakker: ta nye bilder i samme lys og format, behold
filnavnene og lag variantene på nytt.
