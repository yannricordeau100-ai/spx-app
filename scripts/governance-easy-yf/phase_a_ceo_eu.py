#!/usr/bin/env python3
"""
Sub-agent #132 Phase A — easy_ceo_yfinance 21 EU
Extract CEO name from yfinance.companyOfficers and write into
src/data/v2-pipeline-enrich/<lower>.json (overrides_governance.ceo_name).
"""
import json
import os
import re
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

# 21 EU tickers from gap_detail easy_ceo_yfinance category
TICKERS = [
    "AKZA.AS", "ATCO-A.ST", "BN.PA", "CAP.PA", "CLNX.MC", "DG.PA",
    "EQNR.OL", "ERF.PA", "FLTR.L", "KER.PA", "KVUE", "LAND.L",
    "MUV2.DE", "NESTE.HE", "NOKIA.HE", "NOVN.SW", "PHIA.AS", "PODD",
    "PRY.MI", "TEL2-B.ST", "VWS.CO"
]

CEO_TITLE_PATTERNS = [
    re.compile(r"\bchief\s+executive\s+officer\b", re.IGNORECASE),
    re.compile(r"\bCEO\b"),
    re.compile(r"\bpresident\s*&?\s*CEO\b", re.IGNORECASE),
    re.compile(r"\bCEO\s*&?\s*president\b", re.IGNORECASE),
    re.compile(r"\bgroup\s+CEO\b", re.IGNORECASE),
]


def is_ceo_title(title: str) -> bool:
    if not title:
        return False
    # Exclude vice/deputy/former
    if re.search(r"\b(vice|deputy|former|interim|acting)\b", title, re.IGNORECASE):
        # Allow "interim CEO" only if explicitly required - default skip
        if "interim" in title.lower():
            return True  # interim CEO acceptable as current
        return False
    return any(p.search(title) for p in CEO_TITLE_PATTERNS)


def clean_name(name: str) -> str:
    """Strip titles like Mr./Ms./Dr. and trailing degrees."""
    if not name:
        return ""
    # Remove leading honorifics
    name = re.sub(r"^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Sir|Mme\.?|M\.?)\s+", "", name.strip())
    # Remove trailing degrees after comma: "Jane Doe, M.B.A., Ph.D." -> "Jane Doe"
    name = re.split(r",\s+(?:M\.B\.A|Ph\.?D|M\.?Sc|B\.?Sc|CFA|CPA|MBA|J\.?D)", name)[0]
    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name).strip()
    return name


def validate_name(name: str) -> bool:
    """Non-generic: ≥3 chars, first+last name pattern (at least 2 tokens)."""
    if not name or len(name) < 3:
        return False
    tokens = [t for t in name.split() if t]
    if len(tokens) < 2:
        return False
    # Each main token must have at least 2 letters
    real_tokens = [t for t in tokens if re.search(r"[A-Za-zÀ-ÿ]{2,}", t)]
    if len(real_tokens) < 2:
        return False
    return True


def is_divisional_ceo(title: str) -> bool:
    """Detect divisional/subsidiary CEO titles ('CEO of X division/region/subsidiary')."""
    if not title:
        return False
    # 'CEO of <something>' or 'Chief Executive Officer of <something>' (excluding group/the company)
    m = re.search(r"\b(?:chief\s+executive\s+officer|CEO)\s+of\s+([A-Z][A-Za-z &]+)", title)
    if m:
        suffix = m.group(1).strip().lower()
        # If it's "of the Company"/"of Group" treat as group-level
        if suffix in ("the company", "group", "the group", "company"):
            return False
        # Otherwise it's a divisional CEO (Specialty Chemicals, Engineering, North America Region, etc.)
        return True
    return False


def title_priority(title: str) -> tuple:
    """Lower is better. Sort key for picking the best CEO candidate."""
    t = title.lower()
    # 0: Group CEO / President & CEO (top-level)
    # 1: CEO & Director / CEO & Chairman
    # 2: Chief Executive Officer (alone)
    # 3: Divisional CEO
    if re.search(r"\bgroup\s+(president\s*&?\s*)?CEO\b", t):
        return (0, len(title))
    if re.search(r"\bgroup\s+president\s*&?\s*CEO\b", t):
        return (0, len(title))
    if "president" in t and ("ceo" in t or "chief executive officer" in t) and not is_divisional_ceo(title):
        return (1, len(title))
    if "ceo" in t and ("director" in t or "chairman" in t or "executive board" in t or "management board" in t) and not is_divisional_ceo(title):
        return (2, len(title))
    if (t == "chief executive officer" or t.startswith("chief executive officer ") or t == "ceo"):
        return (2, len(title))
    if is_divisional_ceo(title):
        return (10, len(title))
    return (5, len(title))


def find_ceo(officers):
    """Return (name_cleaned, title_raw) or (None, None).

    Strict mode: skip divisional CEO titles to avoid hallucination
    (yfinance officers can list subsidiary CEOs alongside the group CEO).
    """
    if not officers:
        return None, None
    candidates = []
    for o in officers:
        if not isinstance(o, dict):
            continue
        title = o.get("title", "") or ""
        name = o.get("name", "") or ""
        if is_ceo_title(title):
            cleaned = clean_name(name)
            if validate_name(cleaned):
                candidates.append((cleaned, title))
    if not candidates:
        return None, None
    # Sort by priority — best group-level CEO first
    candidates.sort(key=lambda c: title_priority(c[1]))
    best = candidates[0]
    # If the only available candidate is a divisional CEO, REJECT (avoid hallucination)
    if is_divisional_ceo(best[1]):
        return None, None
    return best


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
            t = yf.Ticker(tk)
            info = t.info or {}
            officers = info.get("companyOfficers", [])
            name, title = find_ceo(officers)
            if not name:
                print("✗ no CEO found")
                results["fail"].append({"ticker": tk, "reason": "no_ceo_in_officers", "n_officers": len(officers)})
                time.sleep(1.0)
                continue
            lower = tk.lower()
            data, fp = load_enrich(lower)
            if data is None:
                # parse failure
                results["fail"].append({"ticker": tk, "reason": "enrich_parse_error"})
                continue
            og = data.get("overrides_governance") or {}
            # Don't overwrite if already filled with a real ceo_name
            # BUT: force overwrite if source is yfinance_companyOfficers (our own write,
            # possibly stale/divisional from prior run before priority filter)
            existing_source = og.get("source", "")
            if (og.get("ceo_name") and og.get("ceo_name").strip()
                and len(og.get("ceo_name").split()) >= 2
                and existing_source != "yfinance_companyOfficers"):
                print(f"⊘ already has ceo_name={og.get('ceo_name')} (source={existing_source})")
                results["skip"].append({"ticker": tk, "existing": og.get("ceo_name"), "source": existing_source})
                continue
            if existing_source == "yfinance_companyOfficers" and og.get("ceo_name") != name:
                print(f"↻ overwrite stale {og.get('ceo_name')} → {name}")
            og["ceo_name"] = name
            og["ceo"] = {"name": name, "title": title}
            og["source"] = "yfinance_companyOfficers"
            og["_extracted_at_phase_a"] = iso_now
            data["overrides_governance"] = og
            save_enrich(fp, data)
            print(f"✓ {name} ({title})")
            results["ok"].append({"ticker": tk, "ceo_name": name, "title": title})
        except Exception as e:
            print(f"✗ ERR: {e}")
            results["fail"].append({"ticker": tk, "reason": f"exception: {e}"})
        time.sleep(1.5)  # rate limit

    # Print summary
    print()
    print(f"Phase A summary: ok={len(results['ok'])} skip={len(results['skip'])} fail={len(results['fail'])}")
    for r in results["fail"]:
        print(f"  FAIL: {r}")
    for r in results["skip"]:
        print(f"  SKIP: {r}")
    # Persist log
    log_fp = ROOT / "scripts/governance-easy-yf/phase_a_results.json"
    with open(log_fp, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results written to {log_fp}")


if __name__ == "__main__":
    main()
