#!/usr/bin/env python3
"""
Bytt nettstedet fra GitHub Pages-adressen til et eget domene.

    python3 tools/domene.py barekylling.no          # vis hva som vil skje
    python3 tools/domene.py barekylling.no --skriv  # gjør endringene

Skriptet gjør fire ting:
  1. Lager bare-kylling/CNAME med domenet (det er slik GitHub Pages
     kobles til et eget domene).
  2. Bytter alle forekomster av Pages-adressen i HTML, sitemap og
     robots.txt til det nye domenet (og:url, og:image, JSON-LD, noscript).
  3. Legger inn <link rel="canonical"> på hver side. Canonical var bevisst
     utelatt så lenge adressen var midlertidig – en canonical mot feil
     domene skader synligheten i søk.
  4. Sier fra hvis DNS ikke er satt opp ennå, slik at du ikke tar den
     fungerende siden offline ved et uhell.

KJØR DETTE FØRST ETTER at DNS-postene er lagt inn og har slått gjennom.
Legger du inn CNAME før det, svarer siden 404 til DNS stemmer.
"""
import re
import subprocess
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent / "bare-kylling"
GAMMEL = "lattit-business.github.io/Kylling-website/"

# GitHub Pages' fire A-poster for apex-domener (github.com/orgs/community/discussions)
APEX = {"185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"}


def dig(navn: str, typ: str) -> set:
    try:
        ut = subprocess.run(["dig", "+short", typ, navn], capture_output=True, text=True, timeout=10)
        return {l.strip().rstrip(".") for l in ut.stdout.split("\n") if l.strip()}
    except Exception:
        return set()


def sjekk_dns(domene: str) -> bool:
    """True hvis DNS ser riktig ut. Skriver en forklaring uansett."""
    apex = dig(domene, "A")
    www = dig("www." + domene, "CNAME")
    ok = True

    if not apex and not dig(domene, "NS"):
        print(f"  FEIL   {domene} finnes ikke i DNS ennå (domenet er ikke registrert/delegert).")
        return False

    if apex >= APEX:
        print(f"  OK     {domene} peker på GitHub Pages ({len(apex)} A-poster).")
    else:
        mangler = APEX - apex
        print(f"  FEIL   {domene} mangler A-poster: {', '.join(sorted(mangler))}")
        ok = False

    ventet = None
    if www:
        ventet = next((w for w in www if w.endswith("github.io")), None)
    if ventet:
        print(f"  OK     www.{domene} peker på {ventet}.")
    else:
        print(f"  FEIL   www.{domene} mangler CNAME mot lattit-business.github.io")
        ok = False

    return ok


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    domene = sys.argv[1].strip().lower().removeprefix("https://").removeprefix("http://").rstrip("/")
    skriv = "--skriv" in sys.argv
    ny = domene + "/"

    print(f"Domene: {domene}\n")
    print("DNS:")
    dns_ok = sjekk_dns(domene)
    print()

    if not dns_ok and skriv:
        print("Avbryter: DNS er ikke klar. Legger du inn CNAME nå, blir siden utilgjengelig.")
        print("Fiks DNS-postene, vent til «dig» viser dem, og kjør på nytt.")
        return 1

    endret = []

    # 1. CNAME
    cname = ROT / "CNAME"
    if cname.read_text().strip() != domene if cname.exists() else True:
        endret.append(("CNAME", f"→ {domene}"))
        if skriv:
            cname.write_text(domene + "\n", encoding="utf-8")

    # 2. + 3. Adresser og canonical i alle filer
    for fil in sorted(list(ROT.glob("*.html")) + [ROT / "sitemap.xml", ROT / "robots.txt"]):
        if not fil.exists():
            continue
        s = opprinnelig = fil.read_text(encoding="utf-8")
        treff = s.count(GAMMEL)
        s = s.replace(GAMMEL, ny)

        if fil.suffix == ".html" and 'rel="canonical"' not in s:
            # Fjern den kommenterte påminnelsen, og sett inn ekte canonical
            s = re.sub(r"\n<!-- FØR EGET DOMENE:.*?-->", "", s, flags=re.S)
            m = re.search(r'(<meta property="og:url" content="([^"]+)"[^>]*/>)', s)
            if m:
                s = s.replace(m.group(1), f'{m.group(1)}\n<link rel="canonical" href="{m.group(2)}" />')

        if s != opprinnelig:
            notat = f"{treff} adresse(r)" if treff else "canonical"
            endret.append((fil.name, notat))
            if skriv:
                fil.write_text(s, encoding="utf-8")

    if not endret:
        print("Ingenting å endre – nettstedet bruker allerede dette domenet.")
        return 0

    print("Endringer:" if skriv else "Ville endret (kjør med --skriv):")
    for navn, notat in endret:
        print(f"  {navn:20} {notat}")

    if skriv:
        print("\nFerdig. Kjør så:")
        print("  python3 tools/sjekk.py")
        print(f'  git add -A && git commit -m "Bytt til {domene}" && git push')
        print("\nDeretter i GitHub: Settings → Pages → Custom domain → skriv inn")
        print(f"{domene}, og kryss av «Enforce HTTPS» når sertifikatet er klart (kan ta en time).")
    else:
        print(f"\nKjør på nytt med --skriv når DNS er klar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
