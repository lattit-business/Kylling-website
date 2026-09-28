#!/usr/bin/env python3
"""
Bytt nettstedet fra en midlertidig adresse til et eget domene.

    python3 tools/domene.py barekylling.no                   # vis hva som vil skje
    python3 tools/domene.py barekylling.no --skriv           # gjør endringene
    python3 tools/domene.py barekylling.no --pages --skriv   # hvis dere blir på GitHub Pages
    python3 tools/domene.py barekylling.no --skriv --uten-dns
        # når maskinen ikke kan slå opp DNS (mangler «dig» eller nett), men
        # dere har sett at domenet allerede viser siden. Sjekk det selv etterpå.

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
        # Vercel bytter apex-IP innimellom (76.76.21.21 → 216.198.79.1 …), så vi
        # sjekker ikke adressen, men om domenet faktisk svarer fra Vercel.
        "server": "vercel",
        "cname_fil": False,
        "poster": [("A", "@", "se Vercel → Settings → Domains"),
                   ("CNAME", "www", "se Vercel → Settings → Domains")],
    },
    "pages": {
        "navn": "GitHub Pages",
        "server": "github.com",
        "cname_fil": True,
        "poster": [("A", "@", "185.199.108.153"), ("A", "@", "185.199.109.153"),
                   ("A", "@", "185.199.110.153"), ("A", "@", "185.199.111.153"),
                   ("CNAME", "www", "lattit-business.github.io.")],
    },
}


def dig(navn: str, typ: str) -> set:
    try:
        ut = subprocess.run(["dig", "+short", typ, navn], capture_output=True, text=True, timeout=10)
        return {l.strip().rstrip(".") for l in ut.stdout.split("\n") if l.strip()}
    except Exception:
        return set()


def hent(url: str):
    """(status, endelig url, server-header) – eller None hvis den ikke svarer."""
    try:
        ut = subprocess.run(
            ["curl", "-sIL", "--max-time", "15", "-o", "/dev/null",
             "-w", "%{http_code}\t%{url_effective}", url],
            capture_output=True, text=True, timeout=20)
        if ut.returncode != 0 or not ut.stdout.strip():
            return None
        kode, _, sluttadresse = ut.stdout.strip().partition("\t")
        hoder = subprocess.run(["curl", "-sIL", "--max-time", "15", url],
                               capture_output=True, text=True, timeout=20).stdout.lower()
        server = ""
        for linje in hoder.split("\n"):
            if linje.startswith("server:"):
                server = linje.split(":", 1)[1].strip()
        return kode, sluttadresse, server
    except Exception:
        return None


def sjekk_dns(domene: str, vert: dict) -> bool:
    """True hvis domenet faktisk serveres av den valgte verten."""
    if not dig(domene, "NS") and not dig(domene, "A"):
        print(f"  FEIL   {domene} finnes ikke i DNS (ikke registrert eller ikke delegert).")
        return False
    print(f"  OK     delegert til {', '.join(sorted(dig(domene, 'NS'))) or 'ukjent navnetjener'}")

    svar = hent("https://" + domene)
    if svar is None:
        print(f"  FEIL   https://{domene} svarer ikke ennå (DNS eller sertifikat er ikke klart).")
        return False

    kode, slutt, server = svar
    if vert["server"] not in server:
        print(f"  FEIL   {domene} svarer, men fra «{server or 'ukjent'}» – ikke {vert['navn']}.")
        return False

    if kode != "200":
        print(f"  FEIL   {domene} endte på HTTP {kode} ({slutt}).")
        return False

    print(f"  OK     https://{domene} → {vert['navn']}, HTTP 200")
    if slutt.rstrip("/") != "https://" + domene:
        print(f"  MERK   videresender til {slutt}")
        print(f"         Adressene i koden settes til {domene}. Skal den andre være")
        print(f"         hovedadressen, kjør skriptet med den i stedet.")
    return True


def main() -> int:
    argv = [a for a in sys.argv[1:]]
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 1

    domene = argv[0].strip().lower()
    for p in ("https://", "http://"):
        domene = domene.removeprefix(p)
    # www. beholdes: begge varianter er gyldige hovedadresser, og valget
    # avgjør hva og:url, canonical og sitemap skal peke på.
    domene = domene.rstrip("/")

    skriv = "--skriv" in argv
    vert = VERTER["pages" if "--pages" in argv else "vercel"]
    ny = domene + "/"

    print(f"Domene: {domene}")
    print(f"Vert:   {vert['navn']}\n")
    print("DNS:")
    if "--uten-dns" in argv:
        print(f"  MERK   DNS og HTTP ble ikke sjekket (--uten-dns). Åpne https://{domene}")
        print(f"         selv og kontroller at siden vises før dere stoler på endringen.")
        dns_ok = True
    else:
        dns_ok = sjekk_dns(domene, vert)
    print()

    if not dns_ok and skriv:
        print("Avbryter: DNS er ikke klar. Endrer vi adressene nå, peker siden et sted som ikke svarer.")
        print("Legg inn postene under, vent til «dig» viser dem, og kjør på nytt:\n")
        for typ, navn, verdi in vert["poster"]:
            print(f"  {typ:<6} {navn:<6} {verdi}")
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

        uten_kommentarer = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        if fil.suffix == ".html" and 'rel="canonical"' not in uten_kommentarer:
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
