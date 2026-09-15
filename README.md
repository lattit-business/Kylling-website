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

## Publisering

Hver push til `main` publiserer `bare-kylling/` til GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Under
*Settings → Pages* må kilden stå til «GitHub Actions».

## Kjøre lokalt

```bash
cd bare-kylling && python3 -m http.server 8000
```

Åpne deretter http://localhost:8000/.
