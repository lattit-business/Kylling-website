# Bare Kylling – nettside

Statisk landingsside for matvaremerket Bare Kylling. Ren HTML, CSS og
JavaScript – ingen rammeverk, ingen byggesteg.

**Live:** https://lattit-business.github.io/Kylling-website/

Selve nettsiden ligger i [`bare-kylling/`](bare-kylling/). Les
[`bare-kylling/README.md`](bare-kylling/README.md) for hvordan innholdet styres
og hva som må på plass før lansering.

## Publisering

Hver push til `main` publiserer `bare-kylling/` til GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Under
*Settings → Pages* må kilden stå til «GitHub Actions».

## Kjøre lokalt

```bash
cd bare-kylling && python3 -m http.server 8000
```

Åpne deretter http://localhost:8000/.
