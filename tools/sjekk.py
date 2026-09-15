#!/usr/bin/env python3
"""
Kvalitetssjekk for bare-kylling/ (kjøres fra repo-rota: python3 tools/sjekk.py)

Sjekker
  1. Felles blokker (BK:FELLES hode/topp/cta/bunn) er identiske med index.html
  2. Alle relative lenker/ressurser peker på filer som finnes, og #ankere finnes
  3. Alle <use href="images/figurer.svg#id"> finnes i spriten (ubrukte = advarsel)
  4. Ingen udokumenterte påstander i HTML; devModus/bekreftet er ikke slått på
  5. Per side: én <h1>, <main id="hovedinnhold">, skip-lenke, unik title/description, og:url

Avslutter med kode 1 hvis noe feiler.

  python3 tools/sjekk.py --fiks   kopierer de felles blokkene fra index.html inn i
                                  de andre sidene (aria-current på egen side beholdes)
"""
import re
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent / "bare-kylling"
KANONISK = "index.html"
BLOKKER = ("hode", "topp", "cta", "bunn")
FORBUDT = [
    r"36\s?g", r"\b185\b", r"100\s?%", r"tilsetningsstoff", r"nyt norge",
    r"tilsatt vann", r"\bkcal\b", r"kalori",
]
LIVE = "https://lattit-business.github.io/Kylling-website/"

feil, advarsler = [], []


def les(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def blokk(html: str, navn: str):
    m = re.search(
        rf"<!-- BK:FELLES {navn} START -->(.*?)<!-- BK:FELLES {navn} END -->",
        html, re.S,
    )
    return m.group(1) if m else None


def normaliser(s: str) -> str:
    s = re.sub(r'\s*aria-current="page"', "", s)
    return re.sub(r"\s+", " ", s).strip()


def fiks() -> None:
    """Skriv de kanoniske blokkene fra index.html inn i alle andre sider."""
    kanon = les(ROT / KANONISK)
    for p in sorted(ROT.glob("*.html")):
        if p.name in (KANONISK,) or p.name.startswith("_"):
            continue
        html = les(p)
        for navn in BLOKKER:
            ref, egen = blokk(kanon, navn), blokk(html, navn)
            if ref is None or egen is None:
                continue
            ny = ref
            if navn == "topp":
                ny = ny.replace(f'<a href="{p.name}">', f'<a href="{p.name}" aria-current="page">')
            html = html.replace(egen, ny)
        p.write_text(html, encoding="utf-8")
        print("oppdatert", p.name)


def main() -> int:
    if "--fiks" in sys.argv:
        fiks()
    sider = sorted(p for p in ROT.glob("*.html") if not p.name.startswith("_"))
    if not sider:
        print("Fant ingen HTML-filer i", ROT)
        return 1
    html = {p.name: les(p) for p in sider}
    kanon = html.get(KANONISK)
    if kanon is None:
        print("Mangler", KANONISK)
        return 1

    # 1. Felles blokker
    for navn in BLOKKER:
        ref = blokk(kanon, navn)
        if ref is None:
            feil.append(f"{KANONISK}: mangler blokk BK:FELLES {navn}")
            continue
        for fil, s in html.items():
            b = blokk(s, navn)
            if b is None:
                if navn == "cta" and fil in ("venteliste.html", "404.html"):
                    continue
                feil.append(f"{fil}: mangler blokk BK:FELLES {navn}")
            elif normaliser(b) != normaliser(ref):
                feil.append(f"{fil}: blokk «{navn}» avviker fra {KANONISK}")

    # 2. Lenker og ankere
    sprite = ROT / "images" / "figurer.svg"
    sprite_ids = set(re.findall(r'<symbol[^>]*\bid="([^"]+)"', les(sprite))) if sprite.exists() else set()
    brukte_ids = set()
    attr = re.compile(r'<(a|img|link|script|use|source)\b[^>]*?\b(?:href|src)="([^"]+)"', re.I)
    for fil, s in html.items():
        ids = set(re.findall(r'\bid="([^"]+)"', s))
        for tag, ref in attr.findall(s):
            if ref.startswith(("http://", "https://", "mailto:", "data:", "tel:")):
                continue
            if ref.startswith("/"):
                feil.append(f"{fil}: absolutt sti «{ref}» (Pages ligger under /Kylling-website/)")
                continue
            sti, _, frag = ref.partition("#")
            if tag.lower() == "use":
                brukte_ids.add(frag)
                if sti and not (ROT / sti).exists():
                    feil.append(f"{fil}: <use> peker på manglende fil «{sti}»")
                elif sprite_ids and frag not in sprite_ids:
                    feil.append(f"{fil}: <use> peker på ukjent symbol «#{frag}»")
                continue
            if sti:
                mål = ROT / sti
                if not mål.exists():
                    if tag.lower() == "img":
                        # Bilder er valgfrie: siden viser plassholder / skjuler figuren
                        advarsler.append(f"{fil}: bildet «{sti}» mangler (vises som plassholder)")
                    else:
                        feil.append(f"{fil}: «{ref}» finnes ikke")
                    continue
                mål_ids = set(re.findall(r'\bid="([^"]+)"', html.get(sti, ""))) if sti.endswith(".html") else set()
            else:
                mål_ids = ids
            if frag and frag not in mål_ids:
                feil.append(f"{fil}: ankeret «{ref}» finnes ikke")

    # 3. Ubrukte symboler
    for ubrukt in sorted(sprite_ids - brukte_ids):
        advarsler.append(f"figurer.svg: symbolet «{ubrukt}» er ikke i bruk")

    # 4. Påstander
    for fil, s in html.items():
        tekst = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        for mønster in FORBUDT:
            for m in re.finditer(mønster, tekst, re.I):
                linje = tekst.count("\n", 0, m.start()) + 1
                feil.append(f"{fil}:{linje}: forbudt påstand «{m.group(0)}»")
    innhold = re.sub(r"/\*.*?\*/", "", les(ROT / "js" / "content.js"), flags=re.S)
    innhold = re.sub(r"^\s*//.*$", "", innhold, flags=re.M)
    if re.search(r"devModus:\s*true", innhold):
        feil.append("content.js: devModus er true")
    if re.search(r"bekreftet:\s*true", innhold):
        feil.append("content.js: bekreftet: true funnet")

    # 5. Per side
    titler, beskrivelser = {}, {}
    meny = blokk(kanon, "topp") or ""
    for fil, s in html.items():
        s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        # aria-current: sider som ligger i hovedmenyen skal ha den på egen lenke
        # i både menylinjen og mobilmenyen – og ingen andre steder.
        i_menyen = f'<a href="{fil}">' in meny or f'<a href="{fil}" aria-current="page">' in meny
        current = re.findall(r'<a href="([^"]+)" aria-current="page">', s)
        if i_menyen and current != [fil, fil]:
            feil.append(f"{fil}: forventet aria-current=\"page\" på begge {fil}-lenkene, fant {current or 'ingen'}")
        elif not i_menyen and current:
            feil.append(f"{fil}: aria-current=\"page\" på {current} (siden er ikke i menyen)")
        # tag-balanse for de vanligste elementene
        for tag in ("div", "section", "main", "article", "ul", "ol", "li", "figure", "nav", "header", "footer", "a", "span", "p", "details", "summary", "form", "table", "h1", "h2", "h3"):
            aapne = len(re.findall(rf"<{tag}\b[^>]*>", s))
            lukk = len(re.findall(rf"</{tag}>", s))
            if aapne != lukk:
                feil.append(f"{fil}: <{tag}> åpnes {aapne} ganger og lukkes {lukk} ganger")
        h1 = len(re.findall(r"<h1\b", s))
        if h1 != 1:
            feil.append(f"{fil}: {h1} <h1> (skal være 1)")
        if 'id="hovedinnhold"' not in s:
            feil.append(f"{fil}: mangler <main id=\"hovedinnhold\">")
        if 'class="skip"' not in s:
            feil.append(f"{fil}: mangler skip-lenke")
        t = re.search(r"<title>(.*?)</title>", s, re.S)
        d = re.search(r'<meta name="description" content="([^"]*)"', s)
        if not t or not t.group(1).strip():
            feil.append(f"{fil}: mangler <title>")
        else:
            titler.setdefault(t.group(1).strip(), []).append(fil)
        if not d or not d.group(1).strip():
            feil.append(f"{fil}: mangler meta description")
        else:
            beskrivelser.setdefault(d.group(1).strip(), []).append(fil)
        og = re.search(r'<meta property="og:url" content="([^"]*)"', s)
        if fil == "404.html":
            if 'name="robots" content="noindex"' not in s:
                feil.append("404.html: mangler noindex")
        elif not og:
            feil.append(f"{fil}: mangler og:url")
        else:
            forventet = LIVE if fil == KANONISK else LIVE + fil
            if og.group(1) != forventet:
                feil.append(f"{fil}: og:url er «{og.group(1)}», forventet «{forventet}»")
    for t, filer in titler.items():
        if len(filer) > 1:
            feil.append(f"Samme <title> på {', '.join(filer)}: «{t}»")
    for d, filer in beskrivelser.items():
        if len(filer) > 1:
            feil.append(f"Samme description på {', '.join(filer)}")

    for a in advarsler:
        print("ADVARSEL", a)
    for f in feil:
        print("FEIL   ", f)
    print(f"\n{len(sider)} sider sjekket – {len(feil)} feil, {len(advarsler)} advarsler")
    return 1 if feil else 0


if __name__ == "__main__":
    sys.exit(main())
