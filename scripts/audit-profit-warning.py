#!/usr/bin/env python3
"""Audit des blocs profit_warning de src/data/v2-pipeline/*.json.

Contexte : `gen-profit-warning.py` calcule score / rationale / margin_trend
uniquement à partir des KPIs présents dans le dataset, et il ne recalcule
jamais un bloc déjà écrit (`if d.get('profit_warning'): skip`). Quand les
KPIs vieillissent ou changent, le bloc reste figé et finit par contredire
les documents source (cas PDD : rationale sur le GMV, métrique que PDD ne
publie plus depuis le T4 2021, et margin_trend "en expansion" alors que la
marge opérationnelle 2025 recule de 27,5 % à 21,6 %).

Défauts détectés :
  A1  rationale cite un hero KPI absent du dataset (KPI renommé/supprimé
      depuis la génération : le texte parle d'un KPI que la page n'affiche pas)
  A2  rationale cite un hero KPI dont la dernière valeur publiée a plus de
      MAX_AGE_YEARS ans
  A3  rationale cite un hero KPI sans last_data_date (fraîcheur invérifiable)
  B1  margin_trend "en expansion" alors que les KPIs marge du dataset ont
      plus de MAX_AGE_YEARS ans (affirmation basée sur des données périmées)
  B2  margin_trend "en expansion" alors que le KPI marge opérationnelle
      recule (yoy négatif), ou qu'il est libellé dans une unité monétaire
      et non en pourcentage (la moyenne "pts" du générateur n'a alors
      aucun sens)

Usage :
  python3 scripts/audit-profit-warning.py [--today YYYY-MM-DD] [--json out.json]
"""
import argparse
import glob
import json
import os
import re
from datetime import date

PIPE = "src/data/v2-pipeline"
MAX_AGE_YEARS = 2

HERO_RE = re.compile(r"Hero KPI\s+(.+?)\s+en\s")
OPMARGIN_RE = re.compile(r"marge\s*(op|d.exploit)|operating\s*(income\s*)?margin|ebit margin|op margin")
MARGIN_RE = re.compile(r"marg|margin")


def parse_date(s):
    if not isinstance(s, str):
        return None
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s.strip())
    if m:
        try:
            return date(*map(int, m.groups()))
        except ValueError:
            return None
    m = re.match(r"^(\d{4})$", s.strip())
    return date(int(m.group(1)), 12, 31) if m else None


def parse_yoy(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = re.match(r"^\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:%|pts|pt)", v.strip())
        if m:
            return float(m.group(1).replace(",", "."))
    return None


def label(kpi):
    return ((kpi.get("short") or "") + " " + (kpi.get("name_fr") or "")).lower()


def audit(today):
    cutoff = date(today.year - MAX_AGE_YEARS, today.month, today.day)
    out = {k: [] for k in ("A1", "A2", "A3", "B1", "B2")}
    total = with_pw = 0

    for f in sorted(glob.glob(os.path.join(PIPE, "*.json"))):
        base = os.path.basename(f)
        if base.startswith("_"):
            continue
        try:
            d = json.load(open(f))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        total += 1
        pw = d.get("profit_warning")
        if not isinstance(pw, dict):
            continue
        with_pw += 1

        ticker = d.get("ticker") or base[:-5].upper()
        kpis = [k for k in d.get("kpis", []) if isinstance(k, dict)]
        rationale = pw.get("rationale") or ""
        margin_trend = (pw.get("margin_trend") or "").lower()

        m = HERO_RE.search(rationale)
        if m:
            cited = m.group(1).strip()
            kpi = next((k for k in kpis if (k.get("short") or "").strip() == cited), None)
            if kpi is None:
                out["A1"].append({"ticker": ticker, "cited": cited, "hero_kpi": d.get("hero_kpi")})
            else:
                dt = parse_date(kpi.get("last_data_date"))
                if dt is None:
                    out["A3"].append({"ticker": ticker, "cited": cited})
                elif dt < cutoff:
                    out["A2"].append({
                        "ticker": ticker, "cited": cited, "last_data_date": dt.isoformat(),
                        "age_years": round((today - dt).days / 365.25, 1),
                    })

        if "en expansion" in margin_trend:
            margins = [k for k in kpis if MARGIN_RE.search(label(k))]
            dates = [x for x in (parse_date(k.get("last_data_date")) for k in margins) if x]
            if margins and (not dates or max(dates) < cutoff):
                out["B1"].append({
                    "ticker": ticker,
                    "margin_kpis": [k.get("short") for k in margins],
                    "last_data_date": max(dates).isoformat() if dates else None,
                })
            for k in margins:
                if not OPMARGIN_RE.search(label(k)):
                    continue
                unit = (k.get("unit") or "").strip()
                yoy = parse_yoy(k.get("yoy"))
                if unit not in ("%", "pts", ""):
                    out["B2"].append({"ticker": ticker, "kpi": k.get("short"),
                                      "issue": f"marge libellee en \"{unit}\", pas en %", "yoy": k.get("yoy")})
                elif yoy is not None and yoy < 0:
                    out["B2"].append({"ticker": ticker, "kpi": k.get("short"),
                                      "issue": "marge operationnelle en recul", "yoy": k.get("yoy")})
                break

    return out, total, with_pw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", default=date.today().isoformat())
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    today = date(*map(int, a.today.split("-")))
    out, total, with_pw = audit(today)

    print(f"datasets scannes : {total} | avec profit_warning : {with_pw}")
    labels = {
        "A1": "rationale cite un KPI absent du dataset",
        "A2": f"rationale cite un KPI publie il y a plus de {MAX_AGE_YEARS} ans",
        "A3": "rationale cite un KPI sans last_data_date",
        "B1": f"margin_trend \"en expansion\" sur des KPIs marge de plus de {MAX_AGE_YEARS} ans",
        "B2": "margin_trend \"en expansion\" mais marge operationnelle en recul ou non exprimee en %",
    }
    for key, rows in out.items():
        print(f"\n{key} ({len(rows)}) : {labels[key]}")
        for r in rows[:40]:
            print("  ", r)
        if len(rows) > 40:
            print(f"   ... +{len(rows) - 40}")
    tickers = sorted({r["ticker"] for rows in out.values() for r in rows})
    print(f"\nstes concernees (union) : {len(tickers)}")

    if a.json:
        json.dump({"generated_at": today.isoformat(), "totals": {"datasets": total, "with_profit_warning": with_pw},
                   "findings": out, "tickers": tickers},
                  open(a.json, "w"), indent=1, ensure_ascii=False)
        print(f"rapport ecrit : {a.json}")


if __name__ == "__main__":
    main()
