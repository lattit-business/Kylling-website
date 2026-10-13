---
name: build-website
description: Build or change pages on the Bare Kylling website (bare-kylling/). Use when asked to add a page, edit page content or styling, or change the shared header, CTA or footer.
---

# Build website: Bare Kylling

The site is plain HTML, CSS and JavaScript in `bare-kylling/`. There is no framework and no build step. Read `bare-kylling/README.md` first if you need details.

## Where things live

- Editable text content: `bare-kylling/js/content.js`
- Styling and design tokens: `bare-kylling/css/style.css`
- Interaction: `bare-kylling/js/main.js`
- Figures and icons: `bare-kylling/images/figurer.svg` (sprite, used with `<use href="images/figurer.svg#name">`)
- `index.html` is the source of truth for the shared blocks marked `<!-- BK:FELLES ... START/END -->` (head, top, CTA, footer).

## Workflow

1. Make the change in the relevant file(s).
2. If you changed a shared block, edit it in `index.html` only, then run `python3 tools/sjekk.py --fiks` to copy it into the other pages.
3. If you added a page: link it in the menu and footer (shared blocks), add it to `bare-kylling/sitemap.xml`, and give it one `<h1>`, a unique `<title>` and a meta description.
4. Run `python3 tools/sjekk.py` and fix every error and warning before finishing.
5. Preview locally if useful: `cd bare-kylling && python3 -m http.server 8000`.
6. Commit with a short, descriptive message.

## Rules

- Write site copy in Norwegian (bokmål), matching the existing tone.
- Do not add undocumented claims (health, nutrition or sourcing statements). `tools/sjekk.py` flags these.
- The site is an information page, not a shop: no cart or ordering.
- Keep it dependency-free: no frameworks, bundlers or external scripts.
- Original images live in `bilder-originaler/` and are not published.
