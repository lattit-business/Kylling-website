---
name: add-page
description: Add a new page to the Bare Kylling website. Use when asked to create a new page, for example Kontakt, Oppskrifter or Presse.
---

# Add a new page

Work in `bare-kylling/`. Plain HTML, no build step.

1. Copy the closest existing page (usually `om-oss.html` or `faq.html`) to a new file with a lowercase name, for example `kontakt.html`.
2. Keep the four shared blocks unchanged: `BK:FELLES hode`, `topp`, `cta`, `bunn`.
3. Set a unique `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:url` and `<link rel="canonical">` (all with `https://barekylling.no/<file>`).
4. Use exactly one `<h1>`. Use `<h2>` and `<h3>` in order below it.
5. Add the page to the menu, mobile menu and footer in `index.html`, then run `python3 tools/sjekk.py --fiks` so every page gets the same menu. Put `aria-current="page"` on the new page's own menu link.
6. Add the page to `bare-kylling/sitemap.xml`.
7. Run `python3 tools/sjekk.py` and fix all errors and warnings.
8. Write copy in Norwegian (bokmål). Do not add claims that cannot be documented.
