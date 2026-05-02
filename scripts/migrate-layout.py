#!/usr/bin/env python3
"""
Migration des fichiers téléchargés vers la nouvelle structure :

  sec-data/
    _meta/
      stats.txt
      plan.md
    cat1-us/                         (sociétés US, 10-K filers)
      10K/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz
      10Q/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz
      8K/<year>/<TICKER>_<YYYY-MM-DD>_<accession>.htm.gz
      forms3-4-5/<year>/                  (vide pour l'instant)
      DEF14A/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz
      _placeholder_ER/
      _placeholder_transcripts/
      _placeholder_other/
    cat2-foreign-adr/                (étrangères cotées aux USA)
      20F/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz
      6K/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz
      40F-canadian/<year>/<TICKER>_<YYYY-MM-DD>.htm.gz   (bonus)
      _placeholder_ER/
      _placeholder_transcripts/
      _placeholder_other/
    cat3-european/                   (européennes, EuroSTOXX 600)
      rapport_annuel_URD (10K)/<year>/<COMPANY>.pdf
      rapport_semestriel (10Q)/<year>/                   (vide)
      communique_ad_hoc (8K)/<year>/                     (vide)
      declaration_transactions (form3-4-5)/<year>/       (vide)
      _placeholder_ER/
      _placeholder_transcripts/
      _placeholder_other/
"""

import json
import re
import shutil
from pathlib import Path

ROOT = Path.home() / "spx-app" / "sec-data"
META_DIR = ROOT / "_meta"
CAT1 = ROOT / "cat1-us"
CAT2 = ROOT / "cat2-foreign-adr"
CAT3 = ROOT / "cat3-european"

# Mapping form -> destination
SEC_FORM_DEST = {
    "10-K":   ("cat1-us", "10K"),
    "10-Q":   ("cat1-us", "10Q"),
    "8-K":    ("cat1-us", "8K"),
    "DEF 14A": ("cat1-us", "DEF14A"),
    "20-F":   ("cat2-foreign-adr", "20F"),
    "6-K":    ("cat2-foreign-adr", "6K"),
    "40-F":   ("cat2-foreign-adr", "40F-canadian"),
    # Future :
    "3":      ("cat1-us", "forms3-4-5"),
    "4":      ("cat1-us", "forms3-4-5"),
    "5":      ("cat1-us", "forms3-4-5"),
}

PLACEHOLDER_DIRS = [
    "_placeholder_ER",
    "_placeholder_transcripts",
    "_placeholder_other",
]


def build_skeleton():
    """Crée la nouvelle arborescence + README placeholders."""
    META_DIR.mkdir(parents=True, exist_ok=True)
    for cat_root in [CAT1, CAT2, CAT3]:
        cat_root.mkdir(parents=True, exist_ok=True)
        for ph in PLACEHOLDER_DIRS:
            (cat_root / ph).mkdir(parents=True, exist_ok=True)
            readme = cat_root / ph / "README.txt"
            if not readme.exists():
                kind = ph.replace("_placeholder_", "")
                readme.write_text(
                    f"Placeholder pour les documents '{kind}'.\n"
                    f"Pas obligation réglementaire de filer auprès de SEC / autorités EU.\n"
                    f"À ajouter manuellement ou via un futur script :\n"
                    f"  - ER (Earnings Releases / presentations)\n"
                    f"  - Call transcripts\n"
                    f"  - Investor day decks\n"
                    f"  - Sustainability reports (CSRD)\n"
                    f"  - Capital market days\n"
                )

    # Subdirs spécifiques cat1
    for sub in ["10K", "10Q", "8K", "forms3-4-5", "DEF14A"]:
        (CAT1 / sub).mkdir(parents=True, exist_ok=True)
    # cat2
    for sub in ["20F", "6K", "40F-canadian"]:
        (CAT2 / sub).mkdir(parents=True, exist_ok=True)
    # cat3 — naming exact comme demandé par user
    for sub in [
        "rapport_annuel_URD (10K)",
        "rapport_semestriel (10Q)",
        "communique_ad_hoc (8K)",
        "declaration_transactions (form3-4-5)",
    ]:
        (CAT3 / sub).mkdir(parents=True, exist_ok=True)


def slug_safe(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", s)


def migrate_sec():
    """Migre les fichiers SEC du layout `sec-data/<TICKER>/<form>/...` vers
    le nouveau layout cat1/cat2."""
    index_path = ROOT / "_index.json"
    if not index_path.exists():
        print("Pas de _index.json, skip migration SEC.")
        return 0, 0
    idx = json.loads(index_path.read_text())

    moved = 0
    skipped = 0

    for ticker, data in idx.items():
        for f in data.get("filings", []):
            form = f["form"]
            if form not in SEC_FORM_DEST:
                continue
            cat, sub = SEC_FORM_DEST[form]
            old_path = ROOT / f["path"]
            if not old_path.exists():
                # Peut être déjà migré ou supprimé
                continue
            date = f.get("date", "0000-00-00")
            year = date[:4] if len(date) >= 4 else "unknown"
            accession = f.get("accession", "")
            # Naming nouveau :
            # - 10-K, 10-Q, DEF 14A, 20-F, 40-F : 1 par société par année → ticker_date
            # - 8-K, 6-K, Forms 3/4/5 : multiples par société par année → ticker_date_accession
            if form in ("8-K", "6-K", "3", "4", "5"):
                new_name = f"{slug_safe(ticker)}_{date}_{slug_safe(accession)}.htm.gz"
            else:
                new_name = f"{slug_safe(ticker)}_{date}.htm.gz"
            dest_dir = ROOT / cat / sub / year
            dest_dir.mkdir(parents=True, exist_ok=True)
            new_path = dest_dir / new_name

            if new_path.exists():
                skipped += 1
                continue
            try:
                shutil.move(str(old_path), str(new_path))
                # Mettre à jour le path dans l'index
                f["path"] = str(new_path.relative_to(ROOT))
                f["category"] = cat
                moved += 1
            except Exception as e:
                print(f"! move failed {old_path} -> {new_path}: {e}")
                skipped += 1

    # Sauver l'index mis à jour
    index_path.write_text(json.dumps(idx, indent=2, sort_keys=True))
    return moved, skipped


def cleanup_empty_old_dirs():
    """Supprime les dossiers ticker vides après migration."""
    removed = 0
    for d in sorted(ROOT.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        if d.name in ("_meta", "cat1-us", "cat2-foreign-adr", "cat3-european", "eu", "_logs"):
            continue
        if d.name.startswith("_") or d.name.startswith("."):
            continue
        # Tenter remove récursif si dir vide
        try:
            for sub in sorted(d.rglob("*"), key=lambda p: -len(p.parts)):
                if sub.is_dir() and not any(sub.iterdir()):
                    sub.rmdir()
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
                removed += 1
        except Exception as e:
            print(f"  ! cleanup {d}: {e}")
    return removed


def migrate_eu():
    """Migre les PDFs AnnualReports.com de `sec-data/eu/<slug>/<year>_annual.pdf`
    vers `sec-data/cat3-european/rapport_annuel_URD (10K)/<year>/<slug>.pdf`."""
    eu_dir = ROOT / "eu"
    if not eu_dir.exists():
        print("Pas de dossier eu/, skip migration EU.")
        return 0, 0
    eu_idx_path = eu_dir / "_index.json"
    moved = 0
    skipped = 0
    if eu_idx_path.exists():
        eu_idx = json.loads(eu_idx_path.read_text())
        for slug, data in eu_idx.items():
            for f in data.get("filings", []):
                old_path = eu_dir / f["path"]
                if not old_path.exists():
                    continue
                year = f.get("year", "unknown")
                dest_dir = CAT3 / "rapport_annuel_URD (10K)" / year
                dest_dir.mkdir(parents=True, exist_ok=True)
                new_name = f"{slug_safe(slug)}.pdf"
                # Si plusieurs versions pour la même année (rare), garde un nom unique
                new_path = dest_dir / new_name
                if new_path.exists():
                    # Append un suffixe sur l'URL hash
                    h = hex(abs(hash(f.get("url", ""))))[-6:]
                    new_path = dest_dir / f"{slug_safe(slug)}_{h}.pdf"
                try:
                    shutil.move(str(old_path), str(new_path))
                    f["path"] = str(new_path.relative_to(ROOT))
                    f["category"] = "cat3-european"
                    moved += 1
                except Exception as e:
                    print(f"! EU move failed: {e}")
                    skipped += 1
        eu_idx_path.write_text(json.dumps(eu_idx, indent=2, sort_keys=True))
        # Move l'index dans le nouveau layout
        new_eu_idx = META_DIR / "cat3-european-index.json"
        shutil.move(str(eu_idx_path), str(new_eu_idx))

    # Move les meta files de eu/
    for fname in ["_progress.json", "_log.txt", "_missing.txt", "_run.log"]:
        old = eu_dir / fname
        if old.exists():
            shutil.move(str(old), str(META_DIR / f"cat3-{fname}"))

    # Remove empty eu dir
    try:
        for d in sorted(eu_dir.rglob("*"), key=lambda p: -len(p.parts)):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
        if eu_dir.exists() and not any(eu_dir.iterdir()):
            eu_dir.rmdir()
    except Exception as e:
        print(f"  ! cleanup eu/: {e}")

    return moved, skipped


def main():
    print("== Migration vers nouvelle structure cat1/cat2/cat3 ==")
    print()
    build_skeleton()
    print("✓ Squelette créé.")
    print()
    print("Migration SEC...")
    sec_moved, sec_skipped = migrate_sec()
    print(f"  ✓ {sec_moved} fichiers SEC déplacés ({sec_skipped} skipped).")
    print()
    print("Migration EU...")
    eu_moved, eu_skipped = migrate_eu()
    print(f"  ✓ {eu_moved} fichiers EU déplacés ({eu_skipped} skipped).")
    print()
    print("Cleanup dossiers vides...")
    removed = cleanup_empty_old_dirs()
    print(f"  ✓ {removed} dossiers vides supprimés.")
    print()
    # Move global meta files
    for src_name, dest_name in [
        ("_index.json", "cat1-cat2-index.json"),
        ("_progress.json", "cat1-cat2-progress.json"),
        ("_log.txt", "cat1-cat2-log.txt"),
        ("_run.log", "cat1-cat2-run.log"),
    ]:
        src = ROOT / src_name
        if src.exists():
            shutil.move(str(src), str(META_DIR / dest_name))
            print(f"  → {src_name} -> _meta/{dest_name}")

    print()
    print("== Migration terminée. ==")


if __name__ == "__main__":
    main()
