---
name: seo-check
description: Check and improve search engine optimisation (SEO) on the Bare Kylling website. Use when asked about SEO, Google, search ranking, meta tags or sitemap.
---

# SEO check

Check every page in `bare-kylling/` and report problems in a short table (page, problem, fix). Fix them if the user asks.

Checklist:

- Unique `<title>` (about 50 to 60 characters) and `<meta name="description">` (about 120 to 160 characters) on each page.
- Exactly one `<h1>`, with headings in order.
- `<link rel="canonical">` and `og:url` point to `https://barekylling.no/<file>`.
- `og:title`, `og:description` and `og:image` are present; `<html lang="nb">`.
- Every page is listed in `sitemap.xml`; `robots.txt` points to the sitemap.
- Images have meaningful `alt` text; purely decorative ones use `alt=""`.
- Structured data (`application/ld+json` in `index.html`) matches the visible content.
- Only one public address should serve the site (barekylling.no). Mention the GitHub Pages copy if it is still active.

Finish by running `python3 tools/sjekk.py`.
