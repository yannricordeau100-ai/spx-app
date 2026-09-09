#!/usr/bin/env python3
"""
Logo officiel depuis Wikipedia / Wikimedia Commons (9 sept 2026, demande du
proprietaire : plus de fournisseur par domaine, ex Clearbit qui a servi le
logo d une autre societe pour SpaceX).

Usage :
  python3 scripts/fetch-logo-wikipedia.py SPCX "SpaceX"
  python3 scripts/fetch-logo-wikipedia.py TSM "TSMC" --dry

Cherche dans l infobox de l article (image ou logo), rend le SVG/PNG en PNG
960 px via Commons, puis compose un carre 512 x 512 sur fond blanc dans
public/logos/<TICKER>.png (convention de l app : ticker avec - a la place de .).
"""
from __future__ import annotations
import io, json, re, sys, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
UA = "Mettrik-AI/1.0 (https://mettrik.ai; contact: yannricordeau100@gmail.com)"
API = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"


def get(url: str) -> bytes:
    # curl plutot qu urllib : le Python systeme n a pas la chaine de certificats.
    import subprocess
    return subprocess.run(["curl", "-sL", "-A", UA, url], capture_output=True, timeout=60, check=True).stdout


def gj(url: str) -> dict:
    return json.loads(get(url).decode())


def fichier_logo(titre: str) -> str | None:
    """Nom du fichier logo de l infobox (parse du wikitext), sinon premier fichier 'logo'."""
    q = urllib.parse.urlencode({"action": "parse", "page": titre, "prop": "wikitext", "format": "json", "redirects": 1})
    try:
        wt = gj(f"{API}?{q}")["parse"]["wikitext"]["*"]
    except Exception:
        wt = ""
    m = re.search(r"\|\s*logo\s*=\s*(?:\[\[)?(?:File:|Image:)?([^\|\]\n]+?\.(?:svg|png|jpg|jpeg))", wt, re.I)
    if m:
        return "File:" + m.group(1).strip()
    q = urllib.parse.urlencode({"action": "query", "titles": titre, "prop": "images", "imlimit": 100, "format": "json", "redirects": 1})
    pages = gj(f"{API}?{q}")["query"]["pages"]
    for p in pages.values():
        for im in p.get("images", []):
            t = im["title"]
            if "logo" in t.lower() and not any(x in t for x in ("Commons-logo", "Wikinews", "Wikiquote", "Wikisource", "Wikibooks", "Wikidata", "Wiktionary")):
                return t
    return None


def url_png(fichier: str, largeur: int = 960) -> str | None:
    q = urllib.parse.urlencode({"action": "query", "titles": fichier, "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": largeur, "format": "json"})
    # Commons d abord, puis en.wikipedia (logos non libres televerses localement, ex TSMC).
    for base in (COMMONS, API):
        pages = gj(f"{base}?{q}")["query"]["pages"]
        for p in pages.values():
            ii = (p.get("imageinfo") or [None])[0]
            if ii:
                return ii.get("thumburl") or ii.get("url")
    return None


def compose(png: bytes, dest: Path, taille: int = 512, marge: int = 36) -> None:
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    r = min((taille - 2 * marge) / im.width, (taille - 2 * marge) / im.height)
    im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
    out = Image.new("RGBA", (taille, taille), (255, 255, 255, 255))
    out.paste(im, ((taille - im.width) // 2, (taille - im.height) // 2), im)
    out.convert("RGB").save(dest, optimize=True)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__); return 2
    ticker, titre = sys.argv[1].upper(), sys.argv[2]
    dry = "--dry" in sys.argv
    f = fichier_logo(titre)
    if not f:
        print(f"[{ticker}] aucun logo trouve sur l article « {titre} »"); return 1
    u = url_png(f)
    if not u:
        print(f"[{ticker}] fichier {f} sans URL"); return 1
    print(f"[{ticker}] {f} -> {u}")
    if dry:
        return 0
    dest = ROOT / "public" / "logos" / f"{ticker.replace('.', '-')}.png"
    compose(get(u), dest)
    print(f"[{ticker}] ecrit {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
