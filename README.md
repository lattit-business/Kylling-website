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

1. Vercel → prosjektet → **Storage** (eller *Marketplace*) → **Upstash** →
   *Redis* → opprett en database og **Connect** den til prosjektet.
   Vercel legger da inn `KV_REST_API_URL` og `KV_REST_API_TOKEN` (eller
   `UPSTASH_REDIS_REST_URL`/`_TOKEN`) som miljøvariabler.
2. Valgfritt: legg inn `TOPPLISTE_HEMMELIGHET` (en lang tilfeldig tekst) som
   miljøvariabel. Ellers lages signaturnøkkelen fra databasenøkkelen.
3. Publiser på nytt. Ferdig – topplista viser seg på `spill.html`.

Uten database svarer funksjonen 503, og spillet viser bare de beste rundene på
enheten (det samme skjer på GitHub Pages og lokalt med `http.server`).

Vern mot juks: hver runde får en signert billett som bare kan brukes én gang,
spillet sender en logg over hoppene som serveren regner etter (samme poeng,
ingen hopp raskere enn mulig, ikke lenger runde enn billetten har levd),
grenser per IP (bare en hash lagres) og sjekk av kallenavn (2–16 tegn og et
lite filter mot stygge ord). Kallenavn er ikke kontoer – samme navn deler plass.
Et nettleserspill kan aldri bli helt juksesikkert, men dette gjør det tungvint.

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
