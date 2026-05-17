#!/usr/bin/env python3
"""fix-element.py — fix dispatcher pour le Quality Registry.

Usage :
    python3 scripts/fix-element.py <TICKER> <ID>
    python3 scripts/fix-element.py NVDA hero.chart.no_partial_year
    python3 scripts/fix-element.py --auto-from-audit  # applique tous les
                                                       # fixes connus pour
                                                       # toutes les stés
                                                       # qui ont des fails
                                                       # auto-fixables.

Lit src/data/visual-audit.json pour connaître les fails actifs, mappe
chaque fail ID vers une fonction de fix correspondante, et applique.

Les fixes sont implémentés ici (Phase 5 initial - squelette + 5 exemples).
Au fur et à mesure que de nouveaux anti-patterns sont détectés, on étend
le registry FIXES ci-dessous.

Yann 16 mai 2026 — Phase 5 chantier Quality Registry.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VISUAL_AUDIT = ROOT / "src/data/visual-audit.json"


def fix_global_units_mds_not_b(ticker: str) -> tuple[bool, str]:
    """Normalise les unités B$ / $B / 60M$ → Mds $ / M $ avec espace."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    try:
        d = json.loads(pipeline.read_text())
    except Exception as e:
        return False, f"json parse error: {e}"
    changed = 0
    for k in d.get("kpis", []) or []:
        unit = k.get("unit")
        if not unit:
            continue
        # Normalisations standard
        new = unit
        new = re.sub(r"^(\d+)?B\$$", lambda m: f"{m.group(1) or ''}Mds $".strip(), new)
        new = re.sub(r"^\$B$", "Mds $", new)
        new = re.sub(r"Mds\$", "Mds $", new)
        new = re.sub(r"M\$", "M $", new)
        new = new.strip()
        if new != unit:
            k["unit"] = new
            changed += 1
    if changed > 0:
        pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        return True, f"{changed} unités normalisées"
    return False, "aucune unité à normaliser"


def fix_global_typography_no_em_dash(ticker: str) -> tuple[bool, str]:
    """Supprime les em-dashes dans les textes user-facing."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    raw = pipeline.read_text()
    if "—" not in raw:
        return False, "aucun em-dash"
    fixed = raw.replace("—", ":")
    pipeline.write_text(fixed)
    return True, f"em-dashes remplacés"


def fix_freshness_label_fr(ticker: str) -> tuple[bool, str]:
    """Aucun fix data — issue est dans le composant FreshnessIndicator.
    Le helper translateFreshnessLabel existe déjà dans ui-fix-templates.ts.
    Cette fonction VÉRIFIE que le helper est bien appliqué."""
    fi = ROOT / "src/components/freshness-indicator.tsx"
    if not fi.exists():
        return False, "freshness-indicator.tsx not found"
    src = fi.read_text()
    if "translateFreshnessLabel" in src:
        return True, "translateFreshnessLabel déjà appliqué (no-op)"
    return False, "freshness-indicator.tsx ne utilise pas translateFreshnessLabel — à intégrer manuellement (1 fix global, pas par sté)"


def fix_chart_history_linear_synthetic(ticker: str) -> tuple[bool, str]:
    """Détecte si le hero KPI a une history linéaire fabriquée et la marque
    comme unverified (réduit à 1 point + flag)."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    d = json.loads(pipeline.read_text())
    hs = d.get("hero_kpi")
    hero = next((k for k in d.get("kpis", []) if k.get("short") == hs), None)
    if not hero:
        return False, "hero KPI not found"
    h = hero.get("history") or []
    if not isinstance(h, list) or len(h) < 5:
        return False, "history too short to detect linearity"
    diffs = [h[i+1] - h[i] for i in range(len(h)-1)]
    first = diffs[0]
    all_equal = all(abs(d - first) < 0.001 for d in diffs)
    if not all_equal or abs(first) < 0.01:
        return False, "history not linear synthetic"
    # Réduire à 1 point + flag
    hero["history"] = [h[-1]]
    hero["_history_unverified"] = True
    hero["_history_unverified_reason"] = "Suite linéaire parfaite détectée (signature LLM hallucination)"
    pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    return True, f"history réduite à [last] + _history_unverified posé"


def fix_repartition_no_null_slices(ticker: str) -> tuple[bool, str]:
    """Nettoie revenue_by_segment / revenue_by_geography si slices est null."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    d = json.loads(pipeline.read_text())
    changed = False
    for key in ("revenue_by_segment", "revenue_by_geography"):
        block = d.get(key)
        if isinstance(block, dict) and block.get("slices") is None:
            d[key] = None
            changed = True
    if changed:
        pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        return True, "blocs avec slices=null nettoyés"
    return False, "rien à nettoyer"


def fix_repartition_pct_sums_100(ticker: str) -> tuple[bool, str]:
    """Recompute slices.pct depuis values pour totaliser 100%. Si values
    absents ou sum=0, no-op."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    d = json.loads(pipeline.read_text())
    changed = 0
    for key in ("revenue_by_segment", "revenue_by_geography"):
        block = d.get(key)
        if not isinstance(block, dict): continue
        slices = block.get("slices")
        if not isinstance(slices, list) or len(slices) < 2: continue
        total = sum(s.get("value", 0) for s in slices if isinstance(s.get("value"), (int, float)))
        if total <= 0: continue
        cur_sum = sum(s.get("pct", 0) for s in slices if isinstance(s.get("pct"), (int, float)))
        if abs(cur_sum - 100) < 2: continue  # already ok
        for s in slices:
            v = s.get("value")
            if isinstance(v, (int, float)):
                s["pct"] = round(100 * v / total, 1)
        changed += 1
    if changed:
        pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        return True, f"{changed} bloc(s) pct recalculé"
    return False, "rien à recalculer"


def fix_header_chips_all_filled(ticker: str) -> tuple[bool, str]:
    """Backfill chips manquants depuis enrich si dispo : country (= chip Fondée
    contexte) + ipo. Limité aux infos extractibles via yfinance API offline (= 0 RAM,
    pas d'appel)."""
    enrich = ROOT / "src/data/v2-pipeline-enrich" / f"{ticker.lower()}.json"
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    d = json.loads(pipeline.read_text())
    # Check what's missing
    missing = []
    if not d.get("founded"): missing.append("founded")
    if not d.get("ipo"): missing.append("ipo")
    if not d.get("country"): missing.append("country")
    if not missing:
        return False, "all chips already filled"
    # Try to backfill from enrich file
    if enrich.exists():
        try:
            e = json.loads(enrich.read_text())
            updated = []
            for f in missing:
                if e.get(f):
                    d[f] = e[f]
                    updated.append(f)
            if updated:
                pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
                return True, f"backfilled {','.join(updated)} from enrich"
        except: pass
    return False, f"missing {','.join(missing)} (no enrich data)"


def fix_units_consistent_across_blocs(ticker: str) -> tuple[bool, str]:
    """Si hero KPI = Mds $ mais d'autres KPIs = M $ ou B$, normalise."""
    pipeline = ROOT / "src/data/v2-pipeline" / f"{ticker.lower()}.json"
    if not pipeline.exists():
        return False, "pipeline file not found"
    d = json.loads(pipeline.read_text())
    kpis = d.get("kpis") or []
    if not kpis: return False, "no kpis"
    changed = 0
    for k in kpis:
        if not isinstance(k, dict): continue
        unit = (k.get("unit") or "").strip()
        new = unit
        # Normalise les patterns connus
        new = re.sub(r"\bB\s*\$", "Mds $", new)
        new = re.sub(r"\$\s*B\b", "Mds $", new)
        new = re.sub(r"\bM\s*\$([^a-zA-Z]|$)", r"M $\1", new)
        new = re.sub(r"Mds\$", "Mds $", new)
        new = re.sub(r"\s+", " ", new).strip()
        if new != unit:
            k["unit"] = new
            changed += 1
    if changed:
        pipeline.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        return True, f"{changed} units normalisées"
    return False, "units déjà cohérentes"


# Registry des fixes auto-applicables. Clé = ID quality-tree, valeur = fonction.
FIXES = {
    "global.units.mds_not_b": fix_global_units_mds_not_b,
    "global.units.consistent_across_blocs": fix_units_consistent_across_blocs,
    "global.typography.no_em_dash": fix_global_typography_no_em_dash,
    "freshness.label_fr": fix_freshness_label_fr,
    "hero.chart.no_linear_synthetic": fix_chart_history_linear_synthetic,
    "repartition.no_null_slices": fix_repartition_no_null_slices,
    "repartition.pct_sums_100": fix_repartition_pct_sums_100,
    "header.chips.all_filled": fix_header_chips_all_filled,
}


def apply_fix(ticker: str, issue_id: str) -> dict:
    fn = FIXES.get(issue_id)
    if not fn:
        return {"ticker": ticker, "id": issue_id, "ok": False, "msg": f"no fix registered for {issue_id}"}
    try:
        ok, msg = fn(ticker)
        return {"ticker": ticker, "id": issue_id, "ok": ok, "msg": msg}
    except Exception as e:
        return {"ticker": ticker, "id": issue_id, "ok": False, "msg": f"exception: {type(e).__name__}: {e}"}


def auto_from_audit() -> list[dict]:
    """Lit visual-audit.json, applique tous les fixes connus."""
    if not VISUAL_AUDIT.exists():
        print("❌ visual-audit.json absent")
        return []
    raw = json.loads(VISUAL_AUDIT.read_text())
    results: list[dict] = []
    for ticker, r in (raw.get("results") or {}).items():
        for fail in r.get("fails") or []:
            fid = fail.get("id")
            if fid in FIXES:
                results.append(apply_fix(ticker, fid))
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker", nargs="?", type=str, help="Ticker à fixer")
    ap.add_argument("issue_id", nargs="?", type=str, help="ID quality-tree de l'issue")
    ap.add_argument("--auto-from-audit", action="store_true", help="Applique tous les fixes auto depuis visual-audit.json")
    ap.add_argument("--list", action="store_true", help="Liste les fixes enregistrés")
    args = ap.parse_args()

    if args.list:
        print(f"Fixes enregistrés ({len(FIXES)}) :")
        for fid in sorted(FIXES.keys()):
            print(f"  - {fid}")
        sys.exit(0)

    if args.auto_from_audit:
        results = auto_from_audit()
        ok = sum(1 for r in results if r["ok"])
        print(f"\n✅ {ok}/{len(results)} fixes appliqués")
        for r in results:
            mark = "✓" if r["ok"] else "✗"
            print(f"  {mark} {r['ticker']} {r['id']}: {r['msg']}")
        sys.exit(0)

    if not args.ticker or not args.issue_id:
        ap.print_help()
        sys.exit(1)

    result = apply_fix(args.ticker.upper(), args.issue_id)
    mark = "✓" if result["ok"] else "✗"
    print(f"{mark} {result['ticker']} {result['id']}: {result['msg']}")
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
