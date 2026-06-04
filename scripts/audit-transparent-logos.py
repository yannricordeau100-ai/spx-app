#!/usr/bin/env python3
"""
Audit PIL des PNG logos : detecte ceux qui ont du fond transparent.
Tout PNG avec >5% pixels alpha<128 doit etre force sur fond blanc
(LIGHT_BG_TICKERS) pour eviter marge noire visible.

Output: src/data/light-bg-tickers.json (merge avec existing).
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "logos"
OUT_FILE = ROOT / "src" / "data" / "light-bg-tickers.json"

TRANSPARENT_THRESHOLD = 0.05  # 5% pixels with alpha < 128 -> "transparent"

def is_transparent(png_path: Path) -> bool:
    try:
        img = Image.open(png_path).convert("RGBA")
    except Exception:
        return False
    w, h = img.size
    if w == 0 or h == 0:
        return False
    pixels = img.getdata()
    alpha_low = sum(1 for p in pixels if p[3] < 128)
    return alpha_low / (w * h) > TRANSPARENT_THRESHOLD

def main():
    existing = []
    if OUT_FILE.exists():
        existing = json.loads(OUT_FILE.read_text())
    existing_set = set(t.upper() for t in existing)

    transparent_tickers = []
    pngs = sorted(LOGOS_DIR.glob("*.png"))
    for p in pngs:
        ticker = p.stem.upper()
        if is_transparent(p):
            transparent_tickers.append(ticker)

    new_set = existing_set | set(transparent_tickers)
    sorted_list = sorted(new_set)

    added = sorted(set(transparent_tickers) - existing_set)
    print(f"Total PNG scanned: {len(pngs)}")
    print(f"Transparent detected: {len(transparent_tickers)}")
    print(f"Existing light-bg: {len(existing_set)}")
    print(f"Added by audit: {len(added)}")
    print(f"Final total: {len(sorted_list)}")
    if added[:20]:
        print(f"Sample added: {added[:20]}")

    OUT_FILE.write_text(json.dumps(sorted_list, ensure_ascii=False, indent=2))
    print(f"Written {OUT_FILE}")

if __name__ == "__main__":
    main()
