# Bare Kylling – nettside

Statisk produktside for matvaremerket Bare Kylling – ferdigstekt kyllingfilet
i to smaker (Original og Sweet Paprika), «naturens proteinbar».
Ren HTML, CSS og JavaScript – ingen rammeverk, ingen byggesteg.

**Live:** https://barekylling.no/ (Vercel). Kopi på GitHub Pages:
https://lattit-business.github.io/Kylling-website/ – `canonical` peker til barekylling.no.

Selve nettsiden ligger i [`bare-kylling/`](bare-kylling/) og består av sju sider:

| Fil | Side |
|---|---|
| `index.html` | Forside |
| `smakene.html` | Smakene (Original, Sweet Paprika) |
| `hvorfor.html` | Hvorfor kylling? – naturens proteinbar |
| `om-oss.html` | Om oss |
| `faq.html` | Spørsmål og svar |
| `venteliste.html` | Venteliste |
| `404.html` | Feilside |
| `spill.html` | Spillet «Veien til Jobbsenteret» |

Les [`bare-kylling/README.md`](bare-kylling/README.md) for hvordan innholdet
styres, hvordan de felles blokkene holdes i sync, og hva som må på plass før
lansering.

## Sjekk før du committer

```bash
python3 tools/sjekk.py
```

Sjekker at felles topp/bunn er identiske på alle sider, at alle lenker, ankere
og figurer finnes, at ingen udokumenterte påstander står i HTML-en, og at hver
side har én `<h1>` og unik tittel. `python3 tools/sjekk.py --fiks` kopierer
felles blokker fra `index.html` inn i de andre sidene.

## Publisering

Nettstedet er rene statiske filer, så det kan hostes hvor som helst.

### Vercel (anbefalt)

[`vercel.json`](vercel.json) ligger klar: `outputDirectory` peker på
`bare-kylling/`, så Vercel publiserer den mappen som rot. Ingen bygging,
ingen avhengigheter.

`vercel.json` må være ren JSON uten kommentarfelter. Vercel avviser filen
hvis den har felter den ikke kjenner (f.eks. `"//"`), og da feiler hver
publisering med en lenke til «project configuration». Det som ville stått
som kommentarer:

- `outputDirectory: "bare-kylling"` – nettstedet er rene statiske filer i
  `bare-kylling/`, uten bygging; mappen publiseres som rot.
- `headers` – css/js har ikke innholdshash i filnavnet, så de revalideres
  hver gang (en ny versjon slår gjennom med én gang). Bilder byttes sjelden
  og caches en dag.

Førstegangsoppsett:

1. Gå til [vercel.com/new](https://vercel.com/new) og logg inn med GitHub.
2. Velg **Kylling-website**. Behold standardvalgene – `vercel.json` gjør
   resten. La *Framework Preset* stå på «Other» og ikke fyll inn noe
   build-kommando.
3. **Deploy.** Etter et halvt minutt ligger siden på
   `kylling-website-*.vercel.app`.

Etterpå bygger og publiserer Vercel automatisk ved hver push til `main`, og
lager en egen forhåndsvisning for hver pull request.

[`.vercelignore`](.vercelignore) holder interne README-filer utenfor det som
legges ut. Originalbildene ligger i `bilder-originaler/` i repo-rota, utenfor
`bare-kylling/`, og publiseres dermed verken på Vercel eller GitHub Pages.

### GitHub Pages

Workflowen i [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
publiserer fortsatt `bare-kylling/` ved hver push. Når Vercel er i drift bør
den slås av, så det ikke ligger to kopier av nettstedet ute – to adresser med
samme innhold svekker synligheten i søk:

*Settings → Pages → Source: None*, og slett `.github/workflows/pages.yml`.

## Eget domene

Når domenet er registrert og DNS er lagt inn, bytter dette skriptet alle
adresser og setter inn `canonical`:

```bash
python3 tools/domene.py barekylling.no          # viser hva som vil skje
python3 tools/domene.py barekylling.no --skriv  # gjør endringene
```

Skriptet sjekker DNS først og nekter å skrive hvis postene mangler. Poster
som skal inn hos domeneleverandøren:

| Type | Navn | Verdi |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com.` |

Legg deretter domenet inn i Vercel: *prosjektet → Settings → Domains → Add*.
HTTPS-sertifikat ordnes automatisk.

Blir dere værende på GitHub Pages, kjør med `--pages` i stedet – da lages
`CNAME`-fila og skriptet sjekker GitHubs fire A-poster.

## Global toppliste (spillet)

Spillet har en global topp 10 som lagres i en ekte database. Koden er
Vercel-funksjonen [`api/toppliste.js`](api/toppliste.js); Vercel finner
`api/`-mappa av seg selv. Databasen er Upstash Redis (gratisnivået holder godt).

### Slik kobler du til databasen (ca. 2 minutter, gjøres én gang)

Nettsiden publiseres av seg selv: hver push til `main` på GitHub bygges og
legges ut på barekylling.no av Vercel. Du trenger ikke laste opp noe. Det eneste
som må gjøres for hånd, er å lage databasen:

1. Logg inn på [vercel.com](https://vercel.com) og åpne prosjektet
   **Kylling-website** (det som har domenet barekylling.no).
2. Trykk på fanen **Storage** øverst.
3. Trykk **Create Database** (eller *Connect Database*). Velg **Upstash** →
   **Upstash for Redis** og trykk **Continue**.
4. Velg gratisplanen (**Free**) og regionen **Frankfurt (eu-central-1)**, som
   ligger nærmest Norge. Gi databasen et navn, f.eks. `bare-kylling-toppliste`,
   og trykk **Create**.
5. Når Vercel spør hvilket prosjekt databasen skal kobles til, velger du
   **Kylling-website** og huker av alle miljøene (Production, Preview,
   Development). Trykk **Connect**. Prefikset på variablene kan stå som det er –
   funksjonen finner dem uansett.
6. Gå til fanen **Deployments**, trykk **⋯** på den øverste og velg
   **Redeploy**. Det trengs fordi nye miljøvariabler bare blir med i nye
   publiseringer.
7. Sjekk at det virker: åpne `barekylling.no/spill.html`. Under «Topp 10» skal
   det stå «Ingen på lista ennå. Bli den første!» i stedet for «Den globale
   topplista er ikke koblet til ennå». Eller åpne `barekylling.no/api/toppliste`
   – der skal det stå `{"liste":[]}`.

Valgfritt: legg inn `TOPPLISTE_HEMMELIGHET` (en lang tilfeldig tekst) under
*Settings → Environment Variables*. Ellers lages signaturnøkkelen fra
databasenøkkelen.

Uten database svarer funksjonen 503, og spillet viser bare de beste rundene på
enheten (det samme skjer på GitHub Pages og lokalt med `http.server`). Da står
det «Bare denne enheten» over lista i stedet for «Global toppliste».

### Ser du bare dine egne rekorder?

Da er databasen ikke koblet til, og hver nettleser har sin egen liste. Åpne
`barekylling.no/api/toppliste`:

| Svar | Betyr | Gjør dette |
|---|---|---|
| `{"liste":[…]}` | Alt virker | Lista oppdaterer seg selv hvert 20. sekund. |
| `"hjelp":"Ingen database er koblet til …"` | Databasen mangler | Følg stegene over. |
| `"hjelp":"Fant en database, men ikke av riktig type …"` | Feil type database (f.eks. «Redis» fra Redis Cloud) | Lag en **Upstash for Redis** i stedet, og publiser på nytt. |
| 404 | Funksjonen ble ikke publisert | Sjekk at `api/` ligger i repo-rota og at prosjektet publiseres fra `main`. |

Husk å publisere på nytt (*Redeploy*) etter at databasen er koblet til.
Spiller noen på kopien på GitHub Pages, ser de bare sin egen liste; der lenker
spillet til barekylling.no.

Lista hentes på nytt hvert 20. sekund mens siden er synlig, og Vercels CDN
cacher svaret i 5 sekunder, så mange spillere samtidig gir få databasekall.
Grensene per IP-adresse (800 runder og 60 innsendinger per 10 minutter) er
satt høyt nok til at en hel skoleklasse bak samme nettverk kan spille samtidig.

Vern mot juks: hver runde får en signert billett som bare kan brukes én gang,
spillet sender en logg over hoppene som serveren regner etter (samme poeng,
ingen hopp raskere enn mulig, ikke lenger runde enn billetten har levd),
grenser per IP (bare en hash lagres) og sjekk av kallenavn. Kallenavn er ikke
kontoer – samme navn deler plass. Et nettleserspill kan aldri bli helt
juksesikkert, men dette gjør det tungvint.

### Kallenavn huskes, og tilhører én enhet

Første gang du kommer på lista, skriver du et kallenavn. Det huskes i
nettleseren, så senere topp 10-runder sendes inn av seg selv. «Bytt
kallenavn» på sluttkortet lar deg velge et nytt.

Hver nettleser får en tilfeldig enhetsnøkkel (`bk-spill-enhet` i
localStorage). Et kallenavn tilhører enheten som først kom på lista med det
(`bk:eier` i databasen, bare en hash av nøkkelen lagres), så ingen andre kan
sende inn under ditt navn. Det er enhet og ikke IP-adresse fordi en hel skole
ofte deler én IP. Tømmer noen nettleseren, mister de navnet sitt; slett da
navnet fra `bk:eier` i Upstash-konsollen så de kan ta det igjen.

### Bare Kylling-pakker

Noen rader har en Bare Kylling-pakke som kan plukkes opp. Pakkene har sin
egen topp 10 («Flest pakker», `bk:pakker` og `bk:pnavn`). Det er maks én pakke
per rad, så serveren godtar aldri flere pakker enn poeng.

### Topp 10 og topp 100

Alle runder sendes inn (med kallenavnet du har valgt), ikke bare de som kommer
på topp 10. Databasen beholder de 100 beste per liste; når den er full, slettes
den svakeste. Bryteren «Topp 10 / Topp 100» over lista velger hvor mange som
vises (`GET /api/toppliste?antall=100`), og valget huskes på enheten.

### Butikken og Kylling Verden

- **Butikken** (`js/spill/butikk.js`): pakkene du plukker opp, legges i en
  lommebok på enheten (`bk-spill-lommebok`). For dem kjøper du pynt
  (kokkelue, solbriller, caps, krone) og farger (Paprika, Original, Gull) til
  kyllingen. Alt lagres i nettleseren og gir ingen fordel på topplista.
- **Kylling Verden** (rad 63–250, `KV` i `verden.js`): honningbakke,
  hønsehus, kornsiloer, eggkartonger, sausebekker, Bare Kylling-biler og
  flere pakker. Port inn, skilt ut, og vanlig by igjen etter 250.
- **Premier:** Stråhatt låses opp på rad 150 og Gull-kokkelue på rad 250
  (din beste poengsum på enheten). De tas på av seg selv når du låser dem
  opp, og ligger i butikken etterpå. De kan ikke kjøpes for pakker.
- **Gud-modus:** med kallenavnet «barefjær» dør ikke kyllingen (biler,
  bybanen, vann, drift og måka). Merket «Gud-modus» vises i hjørnet. Rundene
  sendes aldri til topplista, og serveren har navnet som reservert.

### Kallenavn og stygge ord

Kallenavn må ha 2–16 tegn: vanlige bokstaver (a–å, også é, ü osv.), tall,
mellomrom, punktum, bindestrek og understrek. Bokstaver fra andre alfabeter er
ikke lov, så ingen kan lure filteret med kyrilliske tegn som ligner.

Filteret (`sjekkNavn` i `api/toppliste.js`) stopper rasisme, hatsymboler,
homofobe ord, seksuelle ord og banning på norsk og engelsk – også når noen
prøver å skjule dem: med mellomrom eller tegn mellom bokstavene («n.e.g.e.r»),
tall i stedet for bokstaver («n3g3r»), gjentatte bokstaver («neeeger») eller
aksenter («nëger»). Ord som også er vanlige navn eller ord (f.eks. «hore» i
«Thoresen», «ass» i «Glass») stoppes bare når de står alene. Listene står
øverst i avsnittet «Kallenavn» i filen; legg til ord der.

Ingen filter er perfekt. Slipper et stygt navn gjennom, fjerner du det slik:
Upstash-konsollen (Vercel → Storage → databasen → *Open in Upstash*) →
**Data Browser** → nøkkelen `bk:topp` → slett navnet. Slett det også fra
`bk:navn`.

Testene kjøres uten database (fetch byttes ut med en Redis i minnet):

```bash
node tools/test-toppliste.js
```

Vil du tømme lista: slett nøklene `bk:topp` og `bk:navn` i Upstash-konsollen.

## Kjøre lokalt

```bash
cd bare-kylling && python3 -m http.server 8000
```

Åpne deretter http://localhost:8000/.
