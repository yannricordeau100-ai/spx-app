#!/usr/bin/env python3
"""populate_data_folders.py — Copie tous les docs disponibles dans DATA/<TICKER>/
Types couverts: 10-K, 10-Q, 8-K, DEF14A, Transcripts, Données (JSON extraits)
Source principale: data-lake/<TICKER>/
Source secondaire: sec-data/cat1-us/<TYPE>/<YEAR>/ (5 ans = 2021-2025)
"""
import json, shutil
from pathlib import Path

SP500_JSON   = Path("/Users/yann/spx-app/src/data/extraction-status.json")
DATA_DIR     = Path("/Users/yann/Desktop/Projets 2025 26/App KPI/DATA")
DATA_LAKE    = Path("/Users/yann/spx-app/data-lake")
SEC_DATA     = Path("/Users/yann/spx-app/sec-data/cat1-us")
TRANSCRIPTS  = Path("/Users/yann/spx-app/src/data/transcripts")
YEARS        = {"2021", "2022", "2023", "2024", "2025"}

# Mapping: filing type → subfolder name in DATA/TICKER/
FILING_MAP = {
    "10K":    "10-K",
    "10Q":    "10-Q",
    "8K":     "8-K",
    "DEF14A": "DEF14A",
}
# JSON blocs from data-lake to copy into Données/
DATA_BLOCS = [
    "kpis_haut_fr.json", "kpis_milieu_fr.json", "kpis_interpretation_fr.json",
    "stories_fr.json", "gouvernance_fr.json", "ia_positionnement_fr.json",
    "description_fr.json", "events_fr.json", "geo_fr.json",
    "ranks_fr.json", "segments_fr.json", "profit_warning_fr.json",
    "_index.json",
]
# Subfolders in data-lake to copy extracted JSON from
EXTRACTED_SUBDIRS = ["kpis", "kpis_q", "kpis_wow", "stories", "governance", "xbrl", "hero"]

def copy_if_missing(src: Path, dst: Path):
    if not dst.exists() and src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return True
    return False

def main():
    with open(SP500_JSON) as f:
        es = json.load(f)
    sp500 = sorted(es["tickers"].keys())
    print(f"SP500: {len(sp500)} tickers")

    stats = {"10K": 0, "10Q": 0, "8K": 0, "DEF14A": 0, "transcripts": 0, "json": 0}
    done = 0

    for ticker in sp500:
        dest = DATA_DIR / ticker
        if not dest.exists():
            dest.mkdir(parents=True)

        # ── 1. data-lake source ──────────────────────────────────────────────
        dl_ticker = DATA_LAKE / ticker
        if not dl_ticker.exists():
            # Try lowercase
            dl_ticker = DATA_LAKE / ticker.lower()

        if dl_ticker.exists():
            # Copy filing types
            for filing, subfolder in FILING_MAP.items():
                src_dir = dl_ticker / filing
                if src_dir.exists():
                    dst_dir = dest / subfolder
                    dst_dir.mkdir(exist_ok=True)
                    for f in src_dir.iterdir():
                        if copy_if_missing(f, dst_dir / f.name):
                            stats[filing] += 1

            # Copy top-level JSON blocs
            donnees_dir = dest / "Données"
            donnees_dir.mkdir(exist_ok=True)
            for blob in DATA_BLOCS:
                src = dl_ticker / blob
                if src.exists():
                    if copy_if_missing(src, donnees_dir / blob):
                        stats["json"] += 1

            # Copy extracted subdirs (kpis/, kpis_q/, etc.)
            for subdir in EXTRACTED_SUBDIRS:
                src_sub = dl_ticker / subdir
                if src_sub.exists():
                    dst_sub = donnees_dir / subdir
                    dst_sub.mkdir(exist_ok=True)
                    for f in src_sub.iterdir():
                        copy_if_missing(f, dst_sub / f.name)

        # ── 2. sec-data fallback (5 ans) ────────────────────────────────────
        else:
            for filing, subfolder in FILING_MAP.items():
                sec_type_dir = SEC_DATA / filing
                if not sec_type_dir.exists():
                    continue
                dst_dir = dest / subfolder
                for yr_dir in sec_type_dir.iterdir():
                    if not yr_dir.is_dir() or yr_dir.name not in YEARS:
                        continue
                    for f in yr_dir.iterdir():
                        if f.name.upper().startswith(ticker.upper() + "_"):
                            dst_dir.mkdir(exist_ok=True)
                            if copy_if_missing(f, dst_dir / f.name):
                                stats[filing] += 1

        # ── 3. Transcripts ──────────────────────────────────────────────────
        tr_src = TRANSCRIPTS / f"{ticker.lower()}.json"
        if not tr_src.exists():
            tr_src = TRANSCRIPTS / f"{ticker}.json"
        if tr_src.exists():
            tr_dst = dest / "Transcripts" / tr_src.name
            if copy_if_missing(tr_src, tr_dst):
                stats["transcripts"] += 1

        done += 1
        if done % 50 == 0:
            print(f"  {done}/{len(sp500)}...")

    print(f"\nTerminé: {done} stés")
    print(f"  10-K: {stats['10K']} fichiers")
    print(f"  10-Q: {stats['10Q']} fichiers")
    print(f"  8-K:  {stats['8K']} fichiers")
    print(f"  DEF14A: {stats['DEF14A']} fichiers")
    print(f"  Transcripts: {stats['transcripts']} fichiers")
    print(f"  JSON data: {stats['json']} fichiers")

if __name__ == "__main__":
    main()
