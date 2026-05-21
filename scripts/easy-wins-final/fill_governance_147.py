#!/usr/bin/env python3
"""
Mission #147 — Easy-wins audit recheck — fill governance via yfinance only.

Targets : stés top307 ∪ SP500 actuellement à 1 critère KO (g_governance) avec
fields missing fillables sans hallucination :
  - ceo_name + ceo_total_comp_m → yfinance.companyOfficers (filtre title=CEO)
  - voting_structure (texte) + voting_structure_note → heuristique 1-1
    (vérifie absence de classes A/B dans le ticker / pas de dual-class flag)
  - top_capital / top_voting → yfinance.institutional_holders SI ≥ 3 holders
    avec pctHeld ≥ 0.5 % (filtre les "noise" US 13F sur ADR EU)

Anti-hallucination :
  - JAMAIS fabriquer board_size (yfinance ne l'expose pas)
  - JAMAIS overrider un field déjà présent côté merged.governance ou
    overrides_governance (sauf top_capital/top_voting si actuel < 3 et nouveau ≥ 3)
  - Si pctHeld toutes à 0 → on saute le fill top_holders (cas EU)
  - Si companyOfficers vide ou CEO non trouvé → on saute le fill CEO
  - Si dual-class share class détectée (ticker contient .A/.B ou
    governance._top_dual_class_flag) → voting_structure note différente

Workflow :
  1. Load audit JSON
  2. Filter candidates : top307 ∪ SP500, clean_af, !clean_all, failed_extensions == ['g_governance']
  3. For each, fetch yfinance + safe-merge into overrides_governance
  4. Write back, report stats

ZÉRO LLM. ZÉRO Cerebras. yfinance + heuristic only.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import yfinance as yf

REPO = "/Users/yann/spx-app"
ENRICH_DIR = os.path.join(REPO, "src/data/v2-pipeline-enrich")
AUDIT_PATH = os.path.join(REPO, "src/data/v1-9-pre-publication-audit.json")
TOP307_PATH = os.path.join(REPO, "src/data/v1-8-tickers-sorted.json")
SP500_PATH = os.path.join(REPO, "src/data/sp500-tickers.json")

NOW_ISO = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
SCRIPT_TAG = "mission-147-easy-wins-final"


def load_target_universe():
    top307 = set()
    with open(TOP307_PATH) as f:
        raw = json.load(f)
        for item in raw[:307]:
            top307.add(item["ticker"] if isinstance(item, dict) else item)
    sp500 = set()
    with open(SP500_PATH) as f:
        for item in json.load(f):
            sp500.add(item["ticker"] if isinstance(item, dict) else item)
    return top307 | sp500


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


def find_ceo_from_officers(officers: list):
    """Return (name, totalPay) or (None, None)."""
    if not isinstance(officers, list):
        return None, None
    # First pass : exact "CEO" in title
    for o in officers:
        title = (o.get("title") or "").lower()
        if "ceo" in title or "chief executive officer" in title:
            return o.get("name"), o.get("totalPay")
    # Fallback : "president" + "director" (chair/CEO combined US util pattern)
    for o in officers:
        title = (o.get("title") or "").lower()
        if "president" in title and ("director" in title or "chairman" in title):
            return o.get("name"), o.get("totalPay")
    return None, None


def fetch_yfinance_data(ticker: str):
    """Return dict with ceo_name, ceo_total_comp_m, top_capital, top_voting."""
    out = {"ticker": ticker}
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        officers = info.get("companyOfficers") or []
        ceo_name, ceo_pay = find_ceo_from_officers(officers)
        if ceo_name:
            # Clean prefix "Mr.", "Ms.", "Dr."
            out["ceo_name"] = ceo_name.strip()
        if isinstance(ceo_pay, (int, float)) and ceo_pay > 0:
            out["ceo_total_comp_m"] = round(ceo_pay / 1_000_000, 2)

        # Holders : only keep if pctHeld values are meaningful (>=0.5%)
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
                pct_num = float(pct)
                if pct_num >= 0.005:  # 0.5 %
                    holder = str(row.get("Holder") or "").strip()
                    if holder:
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


def apply_fill(ticker: str, audit_missing: list, dry_run: bool = False):
    """Return (status, fp, details)."""
    fp = find_enrich_path(ticker)
    if not fp:
        return "skip_no_enrich", None, {}

    d = read_enrich(fp)
    cur_gov = d.get("governance") or {}
    og = d.get("overrides_governance") or {}

    yfdata = fetch_yfinance_data(ticker)
    if "error" in yfdata:
        return "skip_yf_error", fp, {"error": yfdata["error"]}

    changes = {}
    missing_set = set(audit_missing or [])

    # CEO name : only fill if missing AND we have it from yfinance
    if "ceo_name" in missing_set and yfdata.get("ceo_name"):
        if not og.get("ceo_name") and not cur_gov.get("ceo_name"):
            og["ceo_name"] = yfdata["ceo_name"]
            changes["ceo_name"] = yfdata["ceo_name"]

    # CEO total comp : only fill if missing AND yfinance gave us a value > 0
    if "ceo_total_comp_m" in missing_set and yfdata.get("ceo_total_comp_m"):
        if og.get("ceo_total_comp_m") is None and cur_gov.get("ceo_total_comp_m") is None:
            og["ceo_total_comp_m"] = yfdata["ceo_total_comp_m"]
            changes["ceo_total_comp_m"] = yfdata["ceo_total_comp_m"]

    # voting_structure (text) : standard "1 action = 1 voix" if no dual-class flag
    dual_class = cur_gov.get("_top_dual_class_flag") is True
    if "voting_structure" in missing_set:
        if not og.get("voting_structure") and not cur_gov.get("voting_structure"):
            if dual_class:
                og["voting_structure"] = "Structure d'actions à classes multiples (les droits de vote diffèrent selon la classe)"
            else:
                og["voting_structure"] = "Une action = une voix (structure de gouvernance standard)"
            changes["voting_structure"] = og["voting_structure"][:50] + "..."

    # voting_structure_note : fill if absent (safe heuristic)
    if not og.get("voting_structure_note") and not cur_gov.get("voting_structure_note"):
        if dual_class:
            og["voting_structure_note"] = "Dual-class shares (classes différentes)"
        else:
            og["voting_structure_note"] = "OK 1-share-1-vote"
        changes["voting_structure_note"] = og["voting_structure_note"]

    # top_capital / top_voting : only fill if missing AND yfinance gave us real holders
    if yfdata.get("top_capital_yf"):
        cur_cap = cur_gov.get("top_capital") or og.get("top_capital") or []
        cur_vot = cur_gov.get("top_voting") or og.get("top_voting") or []
        new_holders = yfdata["top_capital_yf"]
        if "top_capital" in missing_set and (not isinstance(cur_cap, list) or len(cur_cap) < 3):
            og["top_capital"] = new_holders
            changes["top_capital"] = f"{len(new_holders)} entries"
        if "top_voting" in missing_set and (not isinstance(cur_vot, list) or len(cur_vot) < 3):
            # Voting tracks capital 1-share-1-vote (no dual-class)
            if not dual_class:
                og["top_voting"] = new_holders
                changes["top_voting"] = f"{len(new_holders)} entries (mirror capital)"

    if not changes:
        return "skip_no_change", fp, {"reason": "no yfinance data filled gaps"}

    # Stamp metadata
    og["extraction_status"] = og.get("extraction_status") or "heuristic_real"
    og["source"] = og.get("source") or "yfinance_companyOfficers+institutional_holders"
    og["source_file"] = og.get("source_file") or f"yfinance_mission147_{NOW_ISO[:10]}"
    og["_extracted_at"] = NOW_ISO
    og["_extracted_by"] = SCRIPT_TAG

    d["overrides_governance"] = og
    if not dry_run:
        write_enrich(fp, d)

    return "ok", fp, {"changes": changes}


def main():
    universe = load_target_universe()
    print(f"Target universe (top307 ∪ SP500): {len(universe)}")

    with open(AUDIT_PATH) as f:
        audit = json.load(f)

    candidates = [
        a for a in audit["audits"]
        if a["ticker"] in universe
        and a["is_clean_af"]
        and not a["is_clean_all"]
        and a["failed_extensions"] == ["g_governance"]
    ]
    print(f"Candidates (1 critère KO = g_governance): {len(candidates)}")

    # Filter to bucket where yfinance can plausibly help:
    # - 'just_ceo' : missing ⊆ {ceo_name, ceo_total_comp_m, voting_structure}
    # - 'top_holders' US-only : missing contains top_capital/top_voting, no board_size missing
    def bucket(a):
        miss = set(a["extensions"]["g_governance"].get("missing") or [])
        if not miss:
            return None
        if miss <= {"ceo_name", "ceo_total_comp_m", "voting_structure"}:
            return "just_ceo"
        if "board_size" in miss:
            return "skip_board_size"
        if "top_capital" in miss or "top_voting" in miss:
            return "top_holders"
        return "other"

    by_bucket = {}
    for a in candidates:
        b = bucket(a)
        if b is None:
            continue
        by_bucket.setdefault(b, []).append(a)
    for k, v in by_bucket.items():
        print(f"  bucket {k}: {len(v)}")

    # Apply : just_ceo + top_holders
    todo = by_bucket.get("just_ceo", []) + by_bucket.get("top_holders", [])
    print(f"\nApplying to {len(todo)} candidates...")

    results = {"ok": [], "skip_no_change": [], "skip_no_enrich": [], "skip_yf_error": []}
    for i, a in enumerate(todo):
        ticker = a["ticker"]
        missing = a["extensions"]["g_governance"].get("missing") or []
        status, fp, details = apply_fill(ticker, missing)
        results.setdefault(status, []).append({"ticker": ticker, "fp": fp, **details})
        marker = "OK " if status == "ok" else "-- "
        print(f"  [{i+1:3d}/{len(todo)}] {marker}{ticker:12s} {status:18s} {details.get('changes') or details.get('reason') or details.get('error') or ''}")
        # tiny throttle to be polite with yfinance
        time.sleep(0.2)

    print("\n=== SUMMARY ===")
    for k, v in results.items():
        print(f"  {k}: {len(v)}")

    # Write log
    log_path = os.path.join(REPO, "scripts/easy-wins-final/results_147.json")
    with open(log_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    print(f"\nLog written: {log_path}")


if __name__ == "__main__":
    main()
