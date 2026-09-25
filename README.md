# Bare Kylling – nettside

Statisk landingsside for matvaremerket Bare Kylling. Ren HTML, CSS og
JavaScript – ingen rammeverk, ingen byggesteg.

**Live:** https://lattit-business.github.io/Kylling-website/

Selve nettsiden ligger i [`bare-kylling/`](bare-kylling/) og består av sju sider:

| Fil | Side |
|---|---|
| `index.html` | Forside |
| `smakene.html` | Smakene |
| `hvorfor.html` | Hvorfor Bare? |
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

## Eget domene

Når domenet er registrert og DNS er lagt inn (se tabellen under), bytter
dette skriptet alle adresser, lager `CNAME` og setter inn `canonical`:

```bash
python3 tools/domene.py barekylling.no          # viser hva som vil skje
python3 tools/domene.py barekylling.no --skriv  # gjør endringene
```

Skriptet sjekker DNS først og nekter å skrive hvis postene ikke er på plass,
slik at den fungerende siden ikke tas offline. DNS-poster som skal inn hos
domeneleverandøren:

| Type | Navn | Verdi |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `lattit-business.github.io.` |

Etterpå: *Settings → Pages → Custom domain*, og kryss av «Enforce HTTPS»
når sertifikatet er utstedt.

## Publisering

Hver push til `main` publiserer `bare-kylling/` til GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Under
*Settings → Pages* må kilden stå til «GitHub Actions».

## Kjøre lokalt

```bash
cd bare-kylling && python3 -m http.server 8000
```

Åpne deretter http://localhost:8000/.
