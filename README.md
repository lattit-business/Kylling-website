# Bare Kylling – nettside

Statisk produktside for matvaremerket Bare Kylling – ferdigstekt kyllingfilet
i to smaker (Original og Sweet Paprika), «naturens proteinbar».
Ren HTML, CSS og JavaScript – ingen rammeverk, ingen byggesteg.

**Live:** https://lattit-business.github.io/Kylling-website/

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

## Kjøre lokalt

```bash
cd bare-kylling && python3 -m http.server 8000
```

Åpne deretter http://localhost:8000/.
