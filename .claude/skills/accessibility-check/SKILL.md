---
name: accessibility-check
description: Check the Bare Kylling website for accessibility (universell utforming, WCAG). Use when asked about accessibility, screen readers, contrast, keyboard use or mobile friendliness.
---

# Accessibility check

Review the HTML, CSS and JS in `bare-kylling/` and report findings in a table (page, problem, fix). Fix them if the user asks.

Checklist:

- Every `<img>` has `alt`; decorative images and SVG figures use `alt=""` or `aria-hidden="true"`.
- Form fields have a visible `<label>`; errors are explained in text, not only by colour.
- Everything works with the keyboard: visible focus outline, logical tab order, skip link works, menu opens and closes with the keyboard.
- Text contrast is at least 4.5:1 (3:1 for large text). Check the honey-coloured bands in particular.
- Heading order is correct and each page has one `<h1>`.
- Animations respect `prefers-reduced-motion` (the site already has an `anim--myk` fallback; keep it).
- Tap targets are at least 44 px on mobile; the page works at 320 px width without sideways scrolling.
- Links have descriptive text (not "klikk her").

Finish by running `python3 tools/sjekk.py`.
