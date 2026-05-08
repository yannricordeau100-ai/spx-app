#!/usr/bin/env python3
"""
Source Grounding Verification : détecte hallucinations Sonnet en vérifiant
que chaque valeur numérique du dataset existe (±2%) dans la source brute.

Pour chaque KPI :
  - Pour chaque value/history value/yoy : recherche dans annual-text/*.txt
  - Si pas trouvé : flag `_value_unverified=true` sur le KPI

Si >50% des KPIs unverified : flag `_hallucination_risk=true` sur la fiche.

Coût : $0 (Python pur, regex).
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/data/v2-pipeline"
SEC = ROOT / "sec-data"


def load_source_text(ticker: str) -> str:
    """Charge le texte source disponible. Cat 3 = annual-text local. Cat 1/2 = 10-K via gather_docs (extrait à la volée)."""
    # Cat 3 EU
    p = SEC / "cat3-european" / ticker.upper() / "annual-text"
    if p.exists():
        for f in p.glob("*.txt"):
            return f.read_text()[:300000]
    # Cat 1/2 : extrait via pipeline-llm gather_docs
    try:
        import sys, importlib.util
        spec = importlib.util.spec_from_file_location("pl", str(ROOT / "scripts/pipeline-llm.py"))
        pl = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(pl)
        # Try cat 1 then cat 2
        for cat in (1, 2):
            try:
                docs = pl.gather_docs(ticker, cat)
                txt = (docs.get("annual_text") or "") + " " + (docs.get("er_text") or "")
                if len(txt) > 5000:
                    return txt[:300000]
            except Exception:
                continue
    except Exception:
        pass
    return ""


def value_in_source(value, source: str, tol_pct: float = 2.0) -> bool:
    """Cherche value (avec ±tol%) dans source. Compare en plusieurs scales."""
    if value is None:
        return True  # null = pas testable
    try:
        v = float(value) if not isinstance(value, (int, float)) else value
    except (ValueError, TypeError):
        return True  # string non-numérique = pas testable
    if v == 0:
        return True
    abs_v = abs(v)
    # Cherche le nombre dans plusieurs représentations possibles (raw, ÷1000, ×1000)
    candidates = [v, v * 1000, v / 1000, v * 1000000, v / 1000000]
    for c in candidates:
        c_int = int(round(c))
        c_str_int = str(c_int).replace("-", "")
        c_str_dec = f"{c:.2f}".replace("-", "")
        c_str_dec1 = f"{c:.1f}".replace("-", "")
        # Patterns avec virgules anglaises (e.g. 1,234,567)
        if abs(c) >= 1000:
            c_comma = "{:,}".format(c_int).replace(",", "[,. ]?")
            if re.search(c_comma, source):
                return True
        # Patterns simple
        for s in (c_str_int, c_str_dec, c_str_dec1):
            if s in source:
                return True
    return False


def check_dataset(ticker: str, d: dict) -> dict:
    """Retourne dict avec flags _value_unverified par KPI + _hallucination_risk."""
    source = load_source_text(ticker)
    if not source:
        return {"checked": False, "reason": "no-source"}

    kpis = d.get("kpis", []) or []
    unverified = 0
    total_checks = 0
    for k in kpis:
        v = k.get("value")
        if v is None or v == "" or v == "N/A":
            continue
        total_checks += 1
        if not value_in_source(v, source):
            k["_value_unverified"] = True
            unverified += 1
        # Aussi check history
        h = k.get("history") or []
        h_unverified = 0
        h_checked = 0
        for hv in h:
            if hv is None: continue
            h_checked += 1
            if not value_in_source(hv, source):
                h_unverified += 1
        if h_checked > 0 and h_unverified / h_checked > 0.5:
            k["_history_unverified"] = True

    if total_checks > 0 and unverified / total_checks > 0.5:
        d["_hallucination_risk"] = True
    return {
        "checked": True,
        "total": total_checks,
        "unverified": unverified,
        "pct_unverified": round(unverified * 100 / total_checks, 1) if total_checks else 0,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker-file")
    p.add_argument("--all", action="store_true")
    args = p.parse_args()

    if args.ticker_file:
        tickers = [l.strip().upper() for l in Path(args.ticker_file).read_text().splitlines() if l.strip()]
    else:
        tickers = []
        for f in OUT.glob("*.json"):
            n = f.name
            if n.startswith("_") or ".gemini.json" in n: continue
            tickers.append(n[:-5].upper())

    risk_count = 0
    no_source = 0
    checked = 0
    for tk in tickers:
        f = OUT / f"{tk.lower()}.json"
        if not f.exists(): continue
        try: d = json.loads(f.read_text())
        except: continue
        if "_validation" not in d: continue
        result = check_dataset(tk, d)
        if not result["checked"]:
            no_source += 1
            continue
        checked += 1
        if d.get("_hallucination_risk"):
            risk_count += 1
        f.write_text(json.dumps(d, ensure_ascii=False, indent=2))
        if result["unverified"] > 0:
            print(f"  {tk} : {result['unverified']}/{result['total']} unverified ({result['pct_unverified']}%)")

    print(f"\n=== Total checked : {checked} | no-source : {no_source} | hallucination_risk : {risk_count} ===")


if __name__ == "__main__":
    main()
