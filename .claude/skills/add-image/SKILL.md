---
name: add-image
description: Add or replace an image on the Bare Kylling website with the correct sizes and formats. Use when the user gives a new photo or asks to swap an image.
---

# Add or replace an image

Read `bare-kylling/images/README.md` first. Summary:

1. Put the original (PNG or high-quality JPEG) in `bilder-originaler/`. Originals are never published.
2. Make three WebP widths (720, 1100 and full width; portrait images use 540, 800 and full) at quality 74, plus one progressive JPEG fallback at quality 78 (width 1100). Use the Pillow snippet in `bare-kylling/images/README.md`.
3. Name files `name-720.webp`, `name-1100.webp`, `name-<full>.webp` and `name.jpg`. Keep the names of existing images exactly the same when replacing.
4. In the HTML use `<picture>` with WebP in `srcset` and the JPEG as `src`. Always set `width`, `height` and Norwegian `alt` text; use `loading="lazy"` except for the first image on the page.
5. Run `python3 tools/sjekk.py` to confirm every referenced file exists.
