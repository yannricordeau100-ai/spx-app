#!/usr/bin/env python3
"""
Audit unifié — économe bande passante (0 net):
  A) Hero KPI génériques sur V1.9.5 + plan promotion
  D) PIL audit transparence PNG logos

Usage: python3 scripts/audit-hero-generic-and-logos.py
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
PUBLIC_LOGOS = ROOT / "public/logos"
DATA = ROOT / "src/data"

# === ÉTAPE A : audit hero générique ===

def normalize(s):
    return re.sub(r"[\s_-]+", "", (s or "").lower())

def load_generic_set():
    with open(DATA / "kpi-generic-library.json") as f:
        lib = json.load(f)
    return {normalize(x["short"]) for x in lib}

def load_universe():
    with open(DATA / "v1-9-5-clean-all-tickers.json") as f:
        return json.load(f)

def slug(t):
    return t.lower().replace(".", "").replace("-", "")

def safe_load(p):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None

def audit_hero():
    generic = load_generic_set()
    universe = load_universe()
    if isinstance(universe, dict):
        tickers = universe.get("tickers") or list(universe.keys())
    else:
        tickers = universe
    print(f"[A] Univers V1.9.5 = {len(tickers)} stés")

    pipeline_dir = DATA / "v2-pipeline"
    spec_dir = DATA / "v2-pipeline-specific-kpis"

    stats = {
        "total": len(tickers),
        "no_pipeline": 0,
        "no_hero": 0,
        "hero_specific_ok": 0,
        "hero_generic_promotable": 0,
        "hero_generic_no_candidate": 0,
    }
    plan = []
    no_candidate = []

    for t in tickers:
        s = slug(t)
        p = pipeline_dir / f"{s}.json"
        data = safe_load(p)
        if not data:
            stats["no_pipeline"] += 1
            continue

        hero_raw = data.get("hero_kpi")
        if isinstance(hero_raw, dict):
            hero_short = hero_raw.get("short")
        else:
            hero_short = hero_raw
        if not hero_short:
            stats["no_hero"] += 1
            continue

        if normalize(hero_short) not in generic:
            stats["hero_specific_ok"] += 1
            continue

        # Hero est générique → chercher candidat spécifique
        # Sources: pipeline kpis[] OU v2-pipeline-specific-kpis/<T>.json
        candidates = []
        for k in (data.get("kpis") or []):
            short = k.get("short")
            if not short:
                continue
            if normalize(short) in generic:
                continue
            hist = k.get("history") or []
            if len(hist) < 4:
                continue
            candidates.append({
                "short": short,
                "name_fr": k.get("name_fr"),
                "history_len": len(hist),
                "source": "pipeline",
            })

        # Specific-kpis file
        spec = safe_load(spec_dir / f"{t.upper()}.json")
        if spec:
            for k in (spec.get("new_kpis") or []) + (spec.get("kpis") or []):
                short = k.get("short")
                if not short:
                    continue
                if normalize(short) in generic:
                    continue
                hist = k.get("history") or []
                if len(hist) < 4:
                    continue
                candidates.append({
                    "short": short,
                    "name_fr": k.get("name_fr"),
                    "history_len": len(hist),
                    "source": "specific",
                    "pv_score": k.get("pv_score"),
                })

        if not candidates:
            stats["hero_generic_no_candidate"] += 1
            no_candidate.append(t)
            continue

        # Tri: pv_score desc, puis history_len desc
        candidates.sort(
            key=lambda c: (c.get("pv_score") or 0, c["history_len"]),
            reverse=True,
        )
        best = candidates[0]
        plan.append({
            "ticker": t,
            "current_hero": hero_short,
            "new_hero": best["short"],
            "new_hero_name_fr": best.get("name_fr"),
            "source": best["source"],
            "history_len": best["history_len"],
            "alternatives": [c["short"] for c in candidates[1:5]],
        })
        stats["hero_generic_promotable"] += 1

    # Output
    out_dir = ROOT / "tmp-audit"
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "hero-promotion-plan.json", "w") as f:
        json.dump({"stats": stats, "plan": plan, "no_candidate": no_candidate}, f, indent=2)
    print(f"[A] Stats: {json.dumps(stats, indent=2)}")
    print(f"[A] Plan écrit: tmp-audit/hero-promotion-plan.json")
    return stats, plan, no_candidate

# === ÉTAPE D : PIL audit transparence ===

def audit_logos():
    try:
        from PIL import Image
    except ImportError:
        print("[D] PIL manquant. pip install Pillow.")
        return None

    logos = sorted(PUBLIC_LOGOS.glob("*.png"))
    print(f"[D] {len(logos)} PNG à auditer")

    needs_light_bg = []
    transparent_ratios = {}
    errors = []

    for png in logos:
        try:
            img = Image.open(png).convert("RGBA")
            w, h = img.size
            pixels = img.getdata()
            total = w * h
            transparent = sum(1 for px in pixels if px[3] < 128)
            ratio = transparent / total if total else 0
            transparent_ratios[png.stem] = round(ratio, 3)
            # Si > 3% pixels transparents OU si bords (corners) transparents → besoin fond
            # Test plus précis : sample des 4 coins
            corners = [
                img.getpixel((0, 0)),
                img.getpixel((w - 1, 0)),
                img.getpixel((0, h - 1)),
                img.getpixel((w - 1, h - 1)),
            ]
            corner_transparent = sum(1 for c in corners if c[3] < 128)
            # Critère: fond transparent si ≥2 coins transparents OU ratio total > 5%
            if corner_transparent >= 2 or ratio > 0.05:
                needs_light_bg.append(png.stem)
        except Exception as e:
            errors.append({"file": png.name, "error": str(e)})

    out_dir = ROOT / "tmp-audit"
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "logos-transparency.json", "w") as f:
        json.dump({
            "total": len(logos),
            "needs_light_bg_count": len(needs_light_bg),
            "needs_light_bg": sorted(needs_light_bg),
            "errors": errors,
        }, f, indent=2)

    print(f"[D] {len(needs_light_bg)}/{len(logos)} PNG avec fond transparent détecté")
    print(f"[D] Output: tmp-audit/logos-transparency.json")
    return needs_light_bg

if __name__ == "__main__":
    print("=== AUDIT A : hero KPI génériques V1.9.5 ===")
    audit_hero()
    print()
    print("=== AUDIT D : PIL transparence logos ===")
    audit_logos()
    print()
    print("Done.")
