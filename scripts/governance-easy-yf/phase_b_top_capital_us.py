#!/usr/bin/env python3
"""
Sub-agent #132 Phase B — top_capital_voting_lt3 15 US
Extract top 5 institutional_holders via yfinance, write top_capital +
top_voting (=top_capital for US one_share_one_vote default) into
src/data/v2-pipeline-enrich/<lower>.json (overrides_governance).
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("yfinance not installed", file=sys.stderr)
    sys.exit(1)

ROOT = Path("/Users/yann/spx-app")
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"

TICKERS = [
    "BLDR", "CMG", "CRWV", "ETN", "FAST", "INCY", "INTU", "PKG",
    "RIVN", "SBAC", "STT", "SYF", "TRMB", "TYL", "UAL"
]


def fetch_top_holders(tk: str, top_n: int = 5):
    t = yf.Ticker(tk)
    try:
        ih = t.institutional_holders
    except Exception as e:
        return None, f"institutional_holders error: {e}"
    if ih is None or ih.empty:
        return None, "empty institutional_holders"
    rows = ih.head(top_n).to_dict("records")
    out = []
    for r in rows:
        holder = (r.get("Holder") or "").strip()
        pct = r.get("pctHeld")
        if not holder:
            continue
        try:
            stake_pct = round(float(pct) * 100.0, 2) if pct is not None else None
        except Exception:
            stake_pct = None
        if stake_pct is None or stake_pct <= 0:
            continue
        out.append({
            "name": holder,
            "type": "institutionnel",
            "stake_pct": stake_pct,
        })
    if len(out) < 3:
        return None, f"only {len(out)} valid holders (<3)"
    return out, None


def load_enrich(ticker_lower: str):
    fp = ENRICH_DIR / f"{ticker_lower}.json"
    if fp.exists():
        try:
            with open(fp, "r", encoding="utf-8") as f:
                return json.load(f), fp
        except Exception as e:
            print(f"  ! parse error {fp}: {e}", file=sys.stderr)
            return None, fp
    return {}, fp


def save_enrich(fp: Path, data: dict):
    fp.parent.mkdir(parents=True, exist_ok=True)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    results = {"ok": [], "skip": [], "fail": []}
    iso_now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for tk in TICKERS:
        print(f"[{tk}]", end=" ", flush=True)
        try:
            holders, err = fetch_top_holders(tk, top_n=5)
            if err:
                print(f"✗ {err}")
                results["fail"].append({"ticker": tk, "reason": err})
                time.sleep(1.5)
                continue
            lower = tk.lower()
            data, fp = load_enrich(lower)
            if data is None:
                results["fail"].append({"ticker": tk, "reason": "enrich_parse_error"})
                continue
            og = data.get("overrides_governance") or {}
            existing_source = og.get("source", "")
            # Only overwrite if missing/empty OR our own previous yfinance write
            cur_cap = og.get("top_capital") or []
            cur_vote = og.get("top_voting") or []
            if (isinstance(cur_cap, list) and len(cur_cap) >= 3
                and isinstance(cur_vote, list) and len(cur_vote) >= 3
                and existing_source not in ("yfinance_institutional_holders", "")):
                print(f"⊘ already has top_capital/top_voting ≥3 (source={existing_source})")
                results["skip"].append({"ticker": tk, "source": existing_source})
                continue
            og["top_capital"] = holders
            # For US default = one_share_one_vote → top_voting mirrors top_capital
            og["top_voting"] = list(holders)
            og["voting_structure"] = og.get("voting_structure") or "one_share_one_vote"
            og["voting_structure_note"] = og.get("voting_structure_note") or "Structure une action, un vote (US default)."
            og["source"] = "yfinance_institutional_holders"
            og["_extracted_at_phase_b"] = iso_now
            data["overrides_governance"] = og
            save_enrich(fp, data)
            top1 = holders[0]
            print(f"✓ {len(holders)} holders, top1={top1['name']} ({top1['stake_pct']}%)")
            results["ok"].append({"ticker": tk, "n_holders": len(holders), "holders": [h["name"] for h in holders]})
        except Exception as e:
            print(f"✗ ERR: {e}")
            results["fail"].append({"ticker": tk, "reason": f"exception: {e}"})
        time.sleep(1.5)

    print()
    print(f"Phase B summary: ok={len(results['ok'])} skip={len(results['skip'])} fail={len(results['fail'])}")
    for r in results["fail"]:
        print(f"  FAIL: {r}")
    for r in results["skip"]:
        print(f"  SKIP: {r}")
    log_fp = ROOT / "scripts/governance-easy-yf/phase_b_results.json"
    with open(log_fp, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results written to {log_fp}")


if __name__ == "__main__":
    main()
