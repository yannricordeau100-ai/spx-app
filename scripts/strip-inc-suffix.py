#!/usr/bin/env python3
"""
Suppression idempotente du suffixe " Inc", " Inc.", ", Inc.", etc.
des champs `name` dans les data Mettrik.

Cible :
- src/data/v2-pipeline/<ticker>.json (champ name racine)
- src/data/v2-pipeline-specific-kpis/<ticker>.json (si name)
- src/data/v2-pipeline-enrich/<ticker>.json (si name)
- src/data/companies/<ticker>.json (champ name racine)
- src/data/v2-pipeline/_merged.json (dict de ticker -> obj.name)
- src/data/{cat,google,msci,meta,spgi}.json (champ name racine)

Le _merged sera rebuilt par le script TS après ce script.
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

# Matche en fin de chaine : ", Inc", ", Inc.", " Inc", " Inc."
# Accepte virgule optionnelle, espace obligatoire devant Inc, point optionnel.
RE_INC = re.compile(r"(?:\s*,)?\s+Inc\.?\s*$", re.IGNORECASE)


def strip_inc(name):
    if not isinstance(name, str):
        return name, False
    new = RE_INC.sub("", name).strip().rstrip(",").strip()
    return new, (new != name)


def patch_root_name(path):
    """Patch dict-with-name files. Returns (changed, before, after)."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
    except (json.JSONDecodeError, OSError):
        return False, None, None
    if not isinstance(d, dict):
        return False, None, None
    if "name" not in d:
        return False, None, None
    before = d["name"]
    new, changed = strip_inc(before)
    if not changed:
        return False, before, before
    d["name"] = new
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return True, before, new


def patch_merged(path):
    """Patch _merged.json (dict ticker -> obj with .name)."""
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    if not isinstance(d, dict):
        return 0, []
    samples = []
    n = 0
    for k, v in d.items():
        if isinstance(v, dict) and "name" in v:
            before = v["name"]
            new, changed = strip_inc(before)
            if changed:
                v["name"] = new
                n += 1
                if len(samples) < 10:
                    samples.append((k, before, new))
    if n:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    return n, samples


def patch_dir(dirpath):
    """Patch tous les .json du dossier (pas les .bak.json)."""
    n = 0
    samples = []
    if not dirpath.exists():
        return n, samples
    for p in sorted(dirpath.iterdir()):
        if not p.is_file() or not p.name.endswith(".json"):
            continue
        if ".bak." in p.name or p.name.startswith("_"):
            continue
        changed, before, after = patch_root_name(p)
        if changed:
            n += 1
            if len(samples) < 5:
                samples.append((p.name, before, after))
    return n, samples


def main():
    total = 0
    all_samples = {}

    # 1) v2-pipeline (per-ticker)
    n, s = patch_dir(DATA / "v2-pipeline")
    total += n
    all_samples["v2-pipeline"] = (n, s)

    # 2) v2-pipeline-specific-kpis
    n, s = patch_dir(DATA / "v2-pipeline-specific-kpis")
    total += n
    all_samples["v2-pipeline-specific-kpis"] = (n, s)

    # 3) v2-pipeline-enrich
    n, s = patch_dir(DATA / "v2-pipeline-enrich")
    total += n
    all_samples["v2-pipeline-enrich"] = (n, s)

    # 4) companies
    n, s = patch_dir(DATA / "companies")
    total += n
    all_samples["companies"] = (n, s)

    # 5) root single-ticker files
    n = 0
    s = []
    for fname in ["cat.json", "google.json", "msci.json", "meta.json", "spgi.json"]:
        p = DATA / fname
        if p.exists():
            changed, before, after = patch_root_name(p)
            if changed:
                n += 1
                s.append((fname, before, after))
    total += n
    all_samples["root-single"] = (n, s)

    # 6) _merged.json
    merged_path = DATA / "v2-pipeline" / "_merged.json"
    if merged_path.exists():
        n_merged, s_merged = patch_merged(merged_path)
        all_samples["_merged.json"] = (n_merged, s_merged)
        # NOTE: not counted in total since _merged is derived
    else:
        all_samples["_merged.json"] = (0, [])

    print(f"\n=== TOTAL fichiers modifiés (hors _merged): {total} ===\n")
    for k, (cnt, samples) in all_samples.items():
        print(f"--- {k}: {cnt} modifs ---")
        for item in samples:
            print(f"  {item[0]}: {item[1]!r} -> {item[2]!r}")
    return total


if __name__ == "__main__":
    sys.exit(0 if main() >= 0 else 1)
