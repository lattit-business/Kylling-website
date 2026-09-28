#!/usr/bin/env python3
"""
Bytt nettstedet fra en midlertidig adresse til et eget domene.

    python3 tools/domene.py barekylling.no                   # vis hva som vil skje
    python3 tools/domene.py barekylling.no --skriv           # gjør endringene
    python3 tools/domene.py barekylling.no --pages --skriv   # hvis dere blir på GitHub Pages

Standard er Vercel. Skriptet gjør tre ting:
  1. Bytter alle forekomster av den gamle adressen i HTML, sitemap og
     robots.txt til det nye domenet (og:url, og:image, JSON-LD, noscript).
  2. Legger inn <link rel="canonical"> på hver side. Canonical var bevisst
     utelatt så lenge adressen var midlertidig – en canonical mot feil
     domene skader synligheten i søk.
  3. Håndterer CNAME-fila: lager den for GitHub Pages, fjerner den for
     Vercel (der brukes den ikke, og den holder domenet bundet til Pages).

Skriptet sjekker DNS først og nekter å skrive hvis postene mangler, slik at
den fungerende siden ikke blir utilgjengelig.
"""
import re
import subprocess
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent / "bare-kylling"
GAMMEL = "lattit-business.github.io/Kylling-website/"

VERTER = {
    "vercel": {
        "navn": "Vercel",
        # Vercels felles apex-adresse (vercel.com/docs/projects/domains)
        "apex": {"76.76.21.21"},
        "www": "cname.vercel-dns.com",
        "cname_fil": False,
    },
    "pages": {
        "navn": "GitHub Pages",
        # GitHubs fire apex-adresser (docs.github.com – «Managing a custom domain»)
        "apex": {"185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"},
        "www": "lattit-business.github.io",
        "cname_fil": True,
    },
}


def dig(navn: str, typ: str) -> set:
    try:
        ut = subprocess.run(["dig", "+short", typ, navn], capture_output=True, text=True, timeout=10)
        return {l.strip().rstrip(".") for l in ut.stdout.split("\n") if l.strip()}
    except Exception:
        return set()


def sjekk_dns(domene: str, vert: dict) -> bool:
    """True hvis DNS ser riktig ut. Skriver en forklaring uansett."""
    if not dig(domene, "A") and not dig(domene, "NS") and not dig(domene, "SOA"):
        print(f"  FEIL   {domene} finnes ikke i DNS (domenet er ikke registrert eller delegert).")
        return False

    ok = True
    apex = dig(domene, "A")
    if apex >= vert["apex"]:
        print(f"  OK     {domene} → {vert['navn']}")
    else:
        mangler = ", ".join(sorted(vert["apex"] - apex))
        fant = ", ".join(sorted(apex)) or "ingenting"
        print(f"  FEIL   {domene} mangler A-post(er): {mangler}  (fant: {fant})")
        ok = False

    www = dig("www." + domene, "CNAME")
    if any(w == vert["www"] or w.endswith("." + vert["www"]) for w in www):
        print(f"  OK     www.{domene} → {vert['www']}")
    else:
        fant = ", ".join(sorted(www)) or "ingenting"
        print(f"  FEIL   www.{domene} mangler CNAME → {vert['www']}  (fant: {fant})")
        ok = False

    return ok


def main() -> int:
    argv = [a for a in sys.argv[1:]]
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 1

    domene = argv[0].strip().lower()
    for p in ("https://", "http://", "www."):
        domene = domene.removeprefix(p)
    domene = domene.rstrip("/")

    skriv = "--skriv" in argv
    vert = VERTER["pages" if "--pages" in argv else "vercel"]
    ny = domene + "/"

    print(f"Domene: {domene}")
    print(f"Vert:   {vert['navn']}\n")
    print("DNS:")
    dns_ok = sjekk_dns(domene, vert)
    print()

    if not dns_ok and skriv:
        print("Avbryter: DNS er ikke klar. Endrer vi adressene nå, peker siden et sted som ikke svarer.")
        print("Legg inn postene under, vent til «dig» viser dem, og kjør på nytt:\n")
        for a in sorted(vert["apex"]):
            print(f"  A      @      {a}")
        print(f"  CNAME  www    {vert['www']}.")
        return 1

    endret = []

    # 1. CNAME-fila (bare GitHub Pages bruker den)
    cname = ROT / "CNAME"
    if vert["cname_fil"]:
        if not cname.exists() or cname.read_text().strip() != domene:
            endret.append(("CNAME", f"→ {domene}"))
            if skriv:
                cname.write_text(domene + "\n", encoding="utf-8")
    elif cname.exists():
        endret.append(("CNAME", "slettes (brukes ikke av Vercel)"))
        if skriv:
            cname.unlink()

    # 2. + 3. Adresser og canonical
    for fil in sorted(list(ROT.glob("*.html")) + [ROT / "sitemap.xml", ROT / "robots.txt"]):
        if not fil.exists():
            continue
        s = opprinnelig = fil.read_text(encoding="utf-8")
        treff = s.count(GAMMEL)
        s = s.replace(GAMMEL, ny)

        if fil.suffix == ".html" and 'rel="canonical"' not in s:
            s = re.sub(r"\n<!-- FØR EGET DOMENE:.*?-->", "", s, flags=re.S)
            m = re.search(r'(<meta property="og:url" content="([^"]+)"[^>]*/>)', s)
            if m:
                s = s.replace(m.group(1), f'{m.group(1)}\n<link rel="canonical" href="{m.group(2)}" />')

        if s != opprinnelig:
            endret.append((fil.name, f"{treff} adresse(r)" if treff else "canonical"))
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
        if vert["cname_fil"]:
            print("\nDeretter: GitHub → Settings → Pages → Custom domain.")
        else:
            print("\nDeretter: Vercel → prosjektet → Settings → Domains → Add.")
            print("Husk å slå av GitHub Pages-publiseringen, så det ikke ligger to")
            print("kopier av nettstedet ute (Settings → Pages → Source: None).")
    else:
        print("\nKjør på nytt med --skriv når DNS er klar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
