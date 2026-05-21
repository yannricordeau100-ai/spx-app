#!/usr/bin/env python3
"""
CONV-CONCEPTS Mettrik — Audit (c) Indicateurs clés + (d) Stories
================================================================
Vérifie pour chaque société publishable (549) :
  - kpis_specific = nb de KPIs non-génériques (is_generic != true)
    Source : src/data/v2-pipeline/<TICKER>.json + merge specific-kpis
  - stories_count = nb de stories KPI
    Source : kpis avec is_short_history:true OU stories_kpis[] OU
    v2-pipeline-specific-kpis/<TICKER>.json kpis_story[]
  - market_cap_usd : v2-pipeline-enrich/<TICKER>.ranks.json

Seuils Yann :
  - MC > 100 Mds : KPIs spec >= 8  (sinon flag P0)
  - MC > 10 Mds  : KPIs spec >= 5  (sinon flag P0)
                   stories      >= 5  (sinon flag P0)
                   stories      >= 8  (sinon flag P1, max 20)

Output : src/data/v1-9-kpis-stories-audit.json
"""
import json, os, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path("/Users/yann/spx-app")
DATA = ROOT / "src" / "data"
V2P = DATA / "v2-pipeline"
V2E = DATA / "v2-pipeline-enrich"
V2S = DATA / "v2-pipeline-specific-kpis"
PUB = DATA / "v1-9-publishable-details.json"
OUT = DATA / "v1-9-kpis-stories-audit.json"


def load_publishable() -> list[dict]:
    d = json.loads(PUB.read_text())
    seen = set()
    out = []
    for scope, arr in d["scopes"].items():
        for e in arr:
            t = e["ticker"]
            if t in seen:
                continue
            seen.add(t)
            out.append({"ticker": t, "name": e.get("name"),
                        "country": e.get("country"), "scope": scope})
    return out


def find_json(dirpath: Path, ticker: str) -> Path | None:
    """Some tickers stored lowercase (e.g. 005930.ks). Try both."""
    for cand in [ticker, ticker.lower(), ticker.upper()]:
        p = dirpath / f"{cand}.json"
        if p.exists():
            return p
    return None


def find_ranks(ticker: str) -> Path | None:
    for cand in [ticker, ticker.lower(), ticker.upper()]:
        p = V2E / f"{cand}.ranks.json"
        if p.exists():
            return p
    return None


def is_specific(kpi: dict) -> bool:
    if kpi.get("is_generic") is True:
        return False
    # heuristic fallback : KPIs sans valeur numérique = pas exploitable
    if kpi.get("value") in (None, "", 0) and not kpi.get("history"):
        return False
    return True


def is_story(kpi: dict) -> bool:
    """Story = court historique. is_short_history:true OR history len<5"""
    if kpi.get("is_short_history") is True:
        return True
    hist = kpi.get("history") or []
    if isinstance(hist, list) and 0 < len(hist) < 5:
        return True
    return False


def audit_one(meta: dict) -> dict:
    ticker = meta["ticker"]
    base_p = find_json(V2P, ticker)
    spec_p = find_json(V2S, ticker)
    ranks_p = find_ranks(ticker)

    base = {}
    if base_p:
        try:
            base = json.loads(base_p.read_text())
        except Exception as e:
            base = {"_load_error": str(e)}

    spec = {}
    if spec_p:
        try:
            spec = json.loads(spec_p.read_text())
        except Exception:
            spec = {}

    mc_usd = None
    if ranks_p:
        try:
            mc_usd = json.loads(ranks_p.read_text()).get("market_cap_usd")
        except Exception:
            pass

    base_kpis = base.get("kpis", []) or []
    base_stories_kpis = base.get("stories_kpis", []) or []
    spec_kpis = spec.get("kpis", []) or []
    spec_stories = spec.get("kpis_story", []) or []

    # KPIs spec totaux : base_kpis non-generic + spec_kpis (sans doublons par short)
    seen_shorts = set()
    kpis_spec = []
    for k in base_kpis:
        if not is_specific(k):
            continue
        # ne pas compter stories ici
        if is_story(k):
            continue
        short = (k.get("short") or k.get("name_en") or k.get("name_fr") or "").lower().strip()
        if short and short in seen_shorts:
            continue
        seen_shorts.add(short)
        kpis_spec.append(short)
    for k in spec_kpis:
        short = (k.get("short") or k.get("name_en") or k.get("name_fr") or "").lower().strip()
        if short and short in seen_shorts:
            continue
        seen_shorts.add(short)
        kpis_spec.append(short)

    # Stories : base_kpis is_short_history + stories_kpis + spec_stories
    seen_st = set()
    stories = []
    for k in base_kpis:
        if not is_story(k):
            continue
        if not is_specific(k):
            continue
        short = (k.get("short") or k.get("name_en") or k.get("name_fr") or "").lower().strip()
        if short and short in seen_st:
            continue
        seen_st.add(short)
        stories.append(short)
    for k in base_stories_kpis:
        short = (k.get("short") or k.get("name_en") or k.get("name_fr") or "").lower().strip()
        if short and short in seen_st:
            continue
        seen_st.add(short)
        stories.append(short)
    for k in spec_stories:
        short = (k.get("short") or k.get("name_en") or k.get("name_fr") or "").lower().strip()
        if short and short in seen_st:
            continue
        seen_st.add(short)
        stories.append(short)

    n_spec = len(kpis_spec)
    n_stories = len(stories)

    # MC tiers en Mds USD
    mc_b = (mc_usd or 0) / 1e9
    flags = []
    if mc_b > 100 and n_spec < 8:
        flags.append("P0_kpi_spec_lt_8_mc_gt_100B")
    if mc_b > 10 and n_spec < 5:
        flags.append("P0_kpi_spec_lt_5_mc_gt_10B")
    if mc_b > 10 and n_stories < 5:
        flags.append("P0_stories_lt_5_mc_gt_10B")
    if mc_b > 10 and 5 <= n_stories < 8:
        flags.append("P1_stories_lt_8_mc_gt_10B")
    # cap stories à 20 (objectif idéal)
    if n_stories > 20:
        flags.append("INFO_stories_gt_20_cap_reco")

    return {
        "ticker": ticker,
        "name": meta.get("name"),
        "country": meta.get("country"),
        "scope": meta.get("scope"),
        "market_cap_usd": mc_usd,
        "market_cap_b_usd": round(mc_b, 2) if mc_usd else None,
        "kpis_specific_count": n_spec,
        "kpis_specific_shorts": kpis_spec,
        "stories_count": n_stories,
        "stories_shorts": stories,
        "flags": flags,
        "has_base_file": base_p is not None,
        "has_specific_file": spec_p is not None,
        "has_ranks_file": ranks_p is not None,
    }


def main():
    pubs = load_publishable()
    print(f"[audit] {len(pubs)} publishable tickers", flush=True)
    results = []
    for i, p in enumerate(pubs):
        results.append(audit_one(p))
        if (i + 1) % 100 == 0:
            print(f"  ... {i+1}/{len(pubs)}", flush=True)

    # Statistiques globales
    buckets = {"lt5": 0, "5_to_7": 0, "ge8": 0}
    p0_mc100_lt8 = []
    p0_mc10_kpi_lt5 = []
    p0_mc10_stories_lt5 = []
    p1_mc10_stories_lt8 = []
    no_base = 0
    for r in results:
        n = r["kpis_specific_count"]
        if n < 5:
            buckets["lt5"] += 1
        elif n < 8:
            buckets["5_to_7"] += 1
        else:
            buckets["ge8"] += 1
        if not r["has_base_file"]:
            no_base += 1
        if "P0_kpi_spec_lt_8_mc_gt_100B" in r["flags"]:
            p0_mc100_lt8.append(r["ticker"])
        if "P0_kpi_spec_lt_5_mc_gt_10B" in r["flags"]:
            p0_mc10_kpi_lt5.append(r["ticker"])
        if "P0_stories_lt_5_mc_gt_10B" in r["flags"]:
            p0_mc10_stories_lt5.append(r["ticker"])
        if "P1_stories_lt_8_mc_gt_10B" in r["flags"]:
            p1_mc10_stories_lt8.append(r["ticker"])

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_publishable": len(results),
        "kpis_spec_buckets": buckets,
        "no_base_file": no_base,
        "p0_mc_gt_100B_kpi_lt_8": {
            "count": len(p0_mc100_lt8), "tickers": p0_mc100_lt8},
        "p0_mc_gt_10B_kpi_lt_5": {
            "count": len(p0_mc10_kpi_lt5), "tickers": p0_mc10_kpi_lt5},
        "p0_mc_gt_10B_stories_lt_5": {
            "count": len(p0_mc10_stories_lt5), "tickers": p0_mc10_stories_lt5},
        "p1_mc_gt_10B_stories_lt_8": {
            "count": len(p1_mc10_stories_lt8), "tickers": p1_mc10_stories_lt8},
    }

    OUT.write_text(json.dumps(
        {"summary": summary, "details": results},
        indent=2, ensure_ascii=False))
    print(f"\n[audit] OK → {OUT}")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
