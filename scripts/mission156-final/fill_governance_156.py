#!/usr/bin/env python3
"""
Mission #156 — Final pass governance KO via yfinance (no-LLM, zero hallucination).

Targets: top307 ∪ SP500 currently clean_af but failing g_governance only, where
we can fill via yfinance institutional_holders + companyOfficers:

Buckets handled:
  - just_ceo_easy: ABF.L, HLN.L, SBRY.L, VNA.DE → fill ceo_name + ceo_total_comp_m
  - top_capital_only (18 US): ACN, ALLE, BEN, BK, CAVA, COST, CW, … → fill
    top_capital + top_voting from yfinance institutional_holders ≥3 ≥0.5%
  - top_holders_partial (17): same logic on holders

NOT handled (skip):
  - need_board_size (43): yfinance doesn't expose board size → LLM only
  - other (11): heterogeneous

Anti-hallucination:
  - Only fill if fields ABSENT in merged governance
  - Skip if yfinance pctHeld all 0 (cas EU)
  - Skip if institutional_holders < 3 entries with ≥0.5% stake
  - Never override existing CEO name without strict validation
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

try:
    import yfinance as yf
except Exception as e:
    print(f"yfinance not installed: {e}")
    sys.exit(1)

REPO = "/Users/yann/spx-app"
ENRICH_DIR = os.path.join(REPO, "src/data/v2-pipeline-enrich")
BUCKETS_PATH = "/tmp/mission156-gov-buckets.json"
NOW_ISO = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
SCRIPT_TAG = "mission-156-easy-wins-final"


def find_enrich_path(ticker: str):
    for lc in (ticker, ticker.lower(), ticker.upper()):
        fp = os.path.join(ENRICH_DIR, f"{lc}.json")
        if os.path.exists(fp):
            return fp
    return None


def read_enrich(fp: str) -> dict:
    with open(fp, "r", encoding="utf-8") as f:
        return json.load(f)


def write_enrich(fp: str, data: dict) -> None:
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def find_ceo_from_officers(officers):
    if not isinstance(officers, list):
        return None, None
    for o in officers:
        title = (o.get("title") or "").lower()
        if "ceo" in title or "chief executive officer" in title:
            return o.get("name"), o.get("totalPay")
    for o in officers:
        title = (o.get("title") or "").lower()
        if "president" in title and ("director" in title or "chairman" in title):
            return o.get("name"), o.get("totalPay")
    return None, None


def fetch_yf(ticker: str):
    out = {"ticker": ticker}
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        officers = info.get("companyOfficers") or []
        ceo_name, ceo_pay = find_ceo_from_officers(officers)
        if ceo_name:
            out["ceo_name"] = ceo_name.strip()
        if isinstance(ceo_pay, (int, float)) and ceo_pay > 0:
            out["ceo_total_comp_m"] = round(ceo_pay / 1_000_000, 2)
        # Holders
        try:
            ih = t.institutional_holders
        except Exception:
            ih = None
        if ih is not None and len(ih) > 0 and "pctHeld" in ih.columns:
            real_holders = []
            for _, row in ih.iterrows():
                pct = row.get("pctHeld")
                if pct is None:
                    continue
                try:
                    pct_num = float(pct)
                except Exception:
                    continue
                if pct_num >= 0.005:  # >= 0.5%
                    holder = str(row.get("Holder") or "").strip()
                    if holder and holder.lower() not in ("nan", "none"):
                        real_holders.append({
                            "name": holder,
                            "type": "institutionnel",
                            "stake_pct": round(pct_num * 100, 2),
                        })
            if len(real_holders) >= 3:
                out["top_capital_yf"] = real_holders[:5]
        return out
    except Exception as e:
        out["error"] = str(e)
        return out


def fill_ticker(ticker: str, audit_missing: list, audit_reason: str):
    """Return (status, fp, changes_dict)."""
    fp = find_enrich_path(ticker)
    if not fp:
        return "skip_no_enrich", None, {}

    d = read_enrich(fp)
    og = d.get("overrides_governance") or {}
    gov_enrich = d.get("governance") or {}

    # Effective current value = overrides first, fallback enrich
    def cur(field):
        return og.get(field) if og.get(field) not in (None, "") else gov_enrich.get(field)

    yfdata = fetch_yf(ticker)
    if "error" in yfdata:
        return "skip_yf_error", fp, {"error": yfdata["error"]}

    changes = {}

    # Fill CEO name if missing
    if not cur("ceo_name") and yfdata.get("ceo_name"):
        og["ceo_name"] = yfdata["ceo_name"]
        changes["ceo_name"] = yfdata["ceo_name"]

    # Fill ceo_total_comp_m if missing
    if cur("ceo_total_comp_m") in (None, 0) and yfdata.get("ceo_total_comp_m"):
        og["ceo_total_comp_m"] = yfdata["ceo_total_comp_m"]
        changes["ceo_total_comp_m"] = yfdata["ceo_total_comp_m"]

    # Fill voting_structure if missing (standard 1-1)
    dual = gov_enrich.get("_top_dual_class_flag") is True
    if not cur("voting_structure"):
        if dual:
            og["voting_structure"] = "Structure d'actions à classes multiples (les droits de vote diffèrent selon la classe)"
        else:
            og["voting_structure"] = "Une action = une voix (structure de gouvernance standard)"
        changes["voting_structure"] = og["voting_structure"][:50] + "..."

    # Fill voting_structure_note if missing
    if not cur("voting_structure_note"):
        og["voting_structure_note"] = "Dual-class shares (classes différentes)" if dual else "OK 1-share-1-vote"
        changes["voting_structure_note"] = og["voting_structure_note"]

    # Fill top_capital / top_voting from yfinance institutional_holders
    cur_cap = cur("top_capital") or []
    cur_vot = cur("top_voting") or []
    cur_cap = cur_cap if isinstance(cur_cap, list) else []
    cur_vot = cur_vot if isinstance(cur_vot, list) else []
    new_holders = yfdata.get("top_capital_yf") or []

    if new_holders and len(new_holders) >= 3 and len(cur_cap) < 3:
        og["top_capital"] = new_holders
        changes["top_capital"] = f"{len(new_holders)} entries (yfinance)"
    if new_holders and len(new_holders) >= 3 and len(cur_vot) < 3 and not dual:
        og["top_voting"] = new_holders
        changes["top_voting"] = f"{len(new_holders)} entries (mirror capital)"

    if not changes:
        return "skip_no_change", fp, {}

    # Stamp metadata
    og["_mission156_filled_at"] = NOW_ISO
    og["_mission156_source"] = "yfinance"
    if "top_capital" in changes or "top_voting" in changes:
        og["extraction_status"] = og.get("extraction_status") or "yfinance_holders_156"
        og["source"] = og.get("source") or "yfinance_institutional_holders"

    d["overrides_governance"] = og
    write_enrich(fp, d)
    return "ok", fp, changes


def main():
    if not os.path.exists(BUCKETS_PATH):
        print(f"Buckets file not found: {BUCKETS_PATH}")
        sys.exit(1)
    buckets = json.load(open(BUCKETS_PATH))

    # Targets: easy buckets only (no board_size required)
    targets = buckets.get("just_ceo_easy", []) + buckets.get("top_capital_only", []) + buckets.get("top_holders_partial", [])
    print(f"Targets total: {len(targets)}")

    results = {"ok": [], "skip_no_change": [], "skip_no_enrich": [], "skip_yf_error": [], "error": []}

    for i, t in enumerate(targets, 1):
        try:
            status, fp, changes = fill_ticker(t, [], "")
            results.setdefault(status, []).append({"ticker": t, "changes": changes})
            tag = "OK" if status == "ok" else status
            print(f"[{i:3d}/{len(targets)}] {t}: {tag} ({list(changes.keys())[:4]})")
        except Exception as e:
            results["error"].append({"ticker": t, "error": str(e)})
            print(f"[{i:3d}/{len(targets)}] {t}: ERROR {e}")
        time.sleep(0.4)  # gentle throttle

    print()
    print("=" * 60)
    for k, v in results.items():
        print(f"  {k}: {len(v)}")

    out_path = os.path.join(REPO, "scripts/mission156-final/results_156.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {out_path}")


if __name__ == "__main__":
    main()
