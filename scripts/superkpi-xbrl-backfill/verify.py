#!/usr/bin/env python3
"""Vérifie post-backfill :
1. Tous les fichiers v2-pipeline US sont du JSON valide.
2. Compte combien de stés US ont désormais les 3 inputs (Revenue/Margin/Capex).
3. Simule ruleOf40 / capitalIntensity / qualityOfCompounding pour un échantillon
   afin de confirmer que les Super-KPI ne renvoient plus N/A.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib_common as L


def num(v):
    try:
        return float(str(v).replace(",", "").replace(" ", ""))
    except Exception:
        return None


def _normh(h):
    """Réplique normalizeHistory : accepte nombres ou objets {value}."""
    out = []
    for x in h or []:
        if isinstance(x, (int, float)):
            out.append(float(x))
        elif isinstance(x, dict):
            v = x.get("value", x.get("v"))
            if isinstance(v, (int, float)):
                out.append(float(v))
    return out


def yoy_from_history(h):
    h = _normh(h)
    if len(h) < 2:
        return None
    prev, last = h[-2], h[-1]
    if not prev:
        return None
    return (last - prev) / abs(prev) * 100


def cagr(h):
    h = _normh(h)
    if len(h) < 2:
        return None
    first, last = h[0], h[-1]
    if first <= 0 or last <= 0:
        return None
    n = len(h) - 1
    return (last / first) ** (1 / n) - 1


def get_rev_kpi(c):
    for s in L.REVENUE_SHORTS:
        k = L._find_kpi(c.get("kpis", []), s)
        if k and k.get("unit") != "%" and isinstance(k.get("history"), list) and len(k["history"]) >= 2:
            return k
    return None


def get_margin_val(c):
    for s in L.MARGIN_SHORTS:
        k = L._find_kpi(c.get("kpis", []), s)
        if k and k.get("unit") == "%":
            return num(k.get("value"))
    return None


def get_capex_kpi(c):
    for s in L.CAPEX_SHORTS:
        k = L._find_kpi(c.get("kpis", []), s)
        if k:
            return k
    return None


def main():
    us = L.load_us_tickers()
    bad_json = []
    have3 = 0
    have_rev = have_mgn = have_cap = 0
    total_files = 0
    for t in us:
        p = L.pipeline_path(t)
        if not p.exists():
            continue
        total_files += 1
        try:
            c = json.loads(p.read_text())
        except Exception as e:
            bad_json.append((t, str(e)))
            continue
        r = L.has_revenue(c)
        m = L.has_margin(c)
        cap = L.has_capex(c)
        have_rev += r
        have_mgn += m
        have_cap += cap
        if r and m and cap:
            have3 += 1

    print(f"US files present         : {total_files}")
    print(f"Invalid JSON             : {len(bad_json)} {bad_json[:10]}")
    print(f"Have Revenue             : {have_rev}")
    print(f"Have Operating Margin    : {have_mgn}")
    print(f"Have Capex               : {have_cap}")
    print(f"Have ALL 3 (R/M/Capex)   : {have3}")

    # Simulate super-KPI on a sample
    print("\n--- Super-KPI simulation (sample) ---")
    for t in ["AMZN", "AMD", "GM", "CSCO", "AAPL", "F", "GILD", "FSLR"]:
        p = L.pipeline_path(t)
        if not p.exists():
            print(f"  {t}: no file")
            continue
        c = json.loads(p.read_text())
        rev = get_rev_kpi(c)
        mgn = get_margin_val(c)
        cap = get_capex_kpi(c)
        # Rule of 40
        r40 = "N/A"
        if rev and mgn is not None:
            ry = yoy_from_history(rev["history"])
            if ry is not None:
                r40 = round(ry + mgn, 1)
        # Capital Intensity
        ci = "N/A"
        if rev and cap is not None:
            rv = num(rev.get("value"))
            cv = num(cap.get("value"))
            if rv and cv is not None and rv != 0:
                ci = round(abs(cv) / rv * 100, 1)
        # QoC
        qoc = "N/A"
        if rev and mgn is not None:
            g = cagr(rev["history"])
            if g is not None:
                qoc = round(g * 100 * mgn / 100, 2)
        print(f"  {t:6s} RuleOf40={r40}  CapIntensity={ci}%  QoC={qoc}")


if __name__ == "__main__":
    main()
