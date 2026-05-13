#!/usr/bin/env python3
"""Génère src/data/ir-coverage-per-ticker.json — détail SEC + IR par sté.

Pour chaque ticker top 307 V1.8 (+ extras V1 demo : META, SPGI, CAT) :
  - Compte SEC EDGAR par form (10-K, 10-Q, 8-K, DEF14A, 20-F, 6-K)
  - Compte IR scraper par doctype (results, presentation, press, esg, transcript, proxy, misc)
  - Compte Desktop DATA (CONV-CONCEPTS scraper V3 historique, 19 stés)
  - Détail par doc-type pour identifier les manques
  - Catégorisation cat 1 (US) / cat 2 (FPI ADR) / cat 3 (EU)
"""
import json
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
SEC = Path.home() / "Mettrik/sec-data"
SCRAPE = SEC / "ir-scrape"
DESKTOP = Path.home() / "Desktop/Projets 2025 26/App KPI/DATA"

DESKTOP_ALIASES = {
    "ASML":"ASML","AZN":"AZN","CATERPILLAR":"CAT","Google":"GOOGL","HDB":"HDB",
    "HSBC":"HSBC","META":"META","MSCI":"MSCI","NVO":"NVO","NVS":"NVS","RIO":"RIO",
    "SAP":"SAP","SEA":"SE","SHEL":"SHEL","SHOP":"SHOP","SPGI":"SPGI","TOYOTA":"TM","TSM":"TSM",
}

def cat(t, fpi_set):
    if t == "BABA": return "cat4"
    suf = t.split(".")[-1] if "." in t else ""
    if suf in ("PA","DE","SW","MI","MC","AS","BR","LS","HE","ST","CO","OL","L","VI","IR","LU"): return "cat3"
    if suf == "T": return "cat2"
    if t in fpi_set: return "cat2"
    return "cat1"

def count_sec(t, form, base_dir):
    base = SEC / base_dir / form
    out = defaultdict(int)
    if not base.exists(): return out
    for yr in base.iterdir():
        if not yr.is_dir() or not yr.name.isdigit(): continue
        n = sum(1 for f in yr.iterdir() if f.name.startswith(t+"_"))
        if n > 0: out[yr.name] = n
    return out

def count_eu(t):
    base = SEC / "cat3-european" / t
    out = {}
    if not base.exists(): return out
    for sub in base.iterdir():
        if sub.is_dir():
            n = sum(1 for f in sub.iterdir() if f.is_file())
            if n > 0: out[sub.name] = n
    return out

def count_scrape(t):
    """Retourne dict doctype → count + total."""
    base = SCRAPE / t
    out = defaultdict(int)
    if not base.exists(): return out
    for sub in base.iterdir():
        if not sub.is_dir(): continue
        if sub.name.startswith("_"): continue
        if sub.name == "snapshots": continue
        n = sum(1 for f in sub.rglob("*") if f.is_file() and f.suffix.lower()==".pdf")
        if n > 0: out[sub.name] = n
    return out

def count_desktop(t):
    """Cherche dans Desktop DATA via alias."""
    base = None
    for alias, ticker in DESKTOP_ALIASES.items():
        if ticker == t:
            cand = DESKTOP / alias
            if cand.exists():
                base = cand
                break
    if not base: return {}
    out = {}
    for sub in base.iterdir():
        if sub.is_dir():
            n = sum(1 for f in sub.rglob("*") if f.is_file())
            if n > 0: out[sub.name] = n
    return out

def main():
    fpi_raw = json.load(open(ROOT/"sec-data/_meta/fpi-tickers.json"))
    fpi_set = set()
    for t in fpi_raw.get("tickers", []):
        if isinstance(t, dict): fpi_set.add(t.get("ticker"))
        elif isinstance(t, str): fpi_set.add(t)

    v18 = json.load(open(ROOT/"src/data/v1-8-tickers-sorted.json"))
    targets = list(v18) + ["META","SPGI","CAT"]  # ajoute V1 demo missing
    seen = set()
    coverage = {}

    for t in targets:
        if t in seen: continue
        seen.add(t)
        c = cat(t, fpi_set)
        # SEC
        sec_us = {}
        if c in ("cat1","cat4"):
            for form in ("10K","10Q","8K","DEF14A"):
                d = count_sec(t, form, "cat1-us")
                if d: sec_us[form] = dict(d)
        sec_fpi = {}
        if c == "cat2":
            for form in ("20F","6K","40F-canadian"):
                d = count_sec(t, form, "cat2-foreign-adr")
                if d: sec_fpi[form] = dict(d)
        sec_eu = count_eu(t) if c == "cat3" else {}
        # IR scrape
        ir = dict(count_scrape(t))
        # Desktop fallback
        desktop = count_desktop(t)

        # Totals
        sec_total = (sum(sum(d.values()) for d in sec_us.values()) +
                     sum(sum(d.values()) for d in sec_fpi.values()) +
                     sum(sec_eu.values()))
        ir_total = sum(ir.values()) + sum(desktop.values())

        coverage[t] = {
            "ticker": t,
            "cat": c,
            "sec_total": sec_total,
            "ir_total": ir_total,
            "grand_total": sec_total + ir_total,
            "sec_us": sec_us,
            "sec_fpi": sec_fpi,
            "sec_eu": sec_eu,
            "ir_scrape": ir,
            "desktop_legacy": desktop,
        }

    # Bilan
    by_cat = defaultdict(lambda: {"count":0,"sec_avg":0,"ir_avg":0,"sec_sum":0,"ir_sum":0})
    for t, d in coverage.items():
        c = d["cat"]
        by_cat[c]["count"] += 1
        by_cat[c]["sec_sum"] += d["sec_total"]
        by_cat[c]["ir_sum"] += d["ir_total"]
    for c, s in by_cat.items():
        if s["count"]:
            s["sec_avg"] = round(s["sec_sum"] / s["count"], 1)
            s["ir_avg"] = round(s["ir_sum"] / s["count"], 1)

    # Stats globales
    no_docs_at_all = [t for t,d in coverage.items() if d["grand_total"] == 0]
    only_sec = [t for t,d in coverage.items() if d["ir_total"] == 0 and d["sec_total"] > 0]
    only_ir = [t for t,d in coverage.items() if d["sec_total"] == 0 and d["ir_total"] > 0]
    both = [t for t,d in coverage.items() if d["sec_total"] > 0 and d["ir_total"] > 0]

    out = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "universe": "V1.8 top 305 + V1 demo extras (META, SPGI, CAT)",
        "total_tickers": len(coverage),
        "by_cat": dict(by_cat),
        "stats": {
            "no_docs_at_all": len(no_docs_at_all),
            "only_sec": len(only_sec),
            "only_ir": len(only_ir),
            "both_sec_and_ir": len(both),
        },
        "no_docs_at_all_list": no_docs_at_all,
        "only_sec_list": sorted(only_sec)[:30],
        "coverage": coverage,
    }

    out_path = ROOT / "src/data/ir-coverage-per-ticker.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"✅ Écrit : {out_path}")
    print()
    print(f"=== Bilan ({len(coverage)} stés) ===")
    print(f"  ❌ 0 doc (ni SEC ni IR)    : {len(no_docs_at_all)}")
    print(f"  ✅ Que SEC EDGAR (sans IR) : {len(only_sec)}")
    print(f"  ✅ Que IR (sans SEC)       : {len(only_ir)}")
    print(f"  ✅ Les 2 (SEC + IR)        : {len(both)}")
    print()
    print(f"=== Par catégorie ===")
    print(f"{'cat':<6} {'stés':<6} {'SEC avg':<9} {'IR avg':<9}")
    for c in sorted(by_cat.keys()):
        s = by_cat[c]
        print(f"{c:<6} {s['count']:<6} {s['sec_avg']:<9} {s['ir_avg']:<9}")
    if no_docs_at_all:
        print(f"\n0 doc total : {no_docs_at_all[:20]}")


if __name__ == "__main__":
    main()
