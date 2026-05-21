"""
Revalidation script for sub-agent #133.

Applies extended domain_filter to:
1. The 25 stés flagged `_d_stories_requires_revalidation:true` (#128 residual).
2. JNJ retroactive (AI Design Wins hallucination case).
3. A random sample of 10 #128 stés for hallucination-rate metric.

Read-only LLM (no Cerebras / no Groq). Pure filter pass.

Outputs:
- Updates v2-pipeline-enrich/<ticker>.json:
  * Removes out-of-domain stories from stories[].
  * If post-filter count >= 5: removes the _d_stories_requires_revalidation flag.
  * Adds _d_stories_filter_pass133: ISO timestamp + counts.
- Writes /tmp/revalidate-133-report.json with full delta.
"""
from __future__ import annotations

import json
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

# Import filter module (relative path)
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from domain_filter import filter_stories, canonical_sector  # noqa: E402

REPO_ROOT = HERE.parent.parent
ENRICH_DIR = REPO_ROOT / "src" / "data" / "v2-pipeline-enrich"
PIPELINE_DIR = REPO_ROOT / "src" / "data" / "v2-pipeline"

# Find files with the flag
FLAGGED_LOWER = [
    "aee", "ares", "bnt", "burl", "danske.co", "ge", "hln.l", "hwdn.l",
    "ibkr", "iqv", "knin.sw", "ldos", "medp", "mksi", "nbix", "nvs",
    "panw", "pg", "ppl", "rddt", "rmd", "trv", "txn", "wrb", "wwd",
]


def get_sector(ticker_lower: str) -> str:
    """Look up sector from enrich -> base pipeline."""
    e_path = ENRICH_DIR / f"{ticker_lower}.json"
    if e_path.exists():
        try:
            e = json.loads(e_path.read_text())
            if e.get("sector"):
                return e["sector"]
        except Exception:
            pass
    b_path = PIPELINE_DIR / f"{ticker_lower}.json"
    if b_path.exists():
        try:
            b = json.loads(b_path.read_text())
            if b.get("sector"):
                return b["sector"]
        except Exception:
            pass
    return ""


def revalidate(ticker_lower: str, *, write: bool = True) -> dict:
    e_path = ENRICH_DIR / f"{ticker_lower}.json"
    if not e_path.exists():
        return {"ticker": ticker_lower, "status": "no_enrich_file"}
    e = json.loads(e_path.read_text())
    sector = get_sector(ticker_lower)
    canon = canonical_sector(sector)
    # Prefer the field with actual list content (some files have both keys,
    # with `stories: None`).
    candidates = []
    for f in ("stories", "stories_kpis"):
        v = e.get(f)
        if isinstance(v, list) and v:
            candidates.append((f, v))
    if not candidates:
        # Fallback: empty list if either field exists
        for f in ("stories", "stories_kpis"):
            if f in e:
                candidates.append((f, []))
                break
    if not candidates:
        return {
            "ticker": ticker_lower, "sector": sector, "canon": canon,
            "status": "no_stories_field",
        }
    stories_field, original = candidates[0]
    kept, rejected = filter_stories(original, sector)
    delta = {
        "ticker": ticker_lower,
        "sector": sector,
        "canon": canon,
        "stories_field": stories_field,
        "before": len(original),
        "kept": len(kept),
        "rejected": len(rejected),
        "rejected_labels": [
            s.get("short") or s.get("name_fr") or s.get("label") or ""
            for s in rejected if isinstance(s, dict)
        ],
        "had_flag": bool(e.get("_d_stories_requires_revalidation")),
    }
    if write and (rejected or e.get("_d_stories_requires_revalidation")):
        e[stories_field] = kept
        e["_d_stories_filter_pass133"] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "before": len(original),
            "kept": len(kept),
            "rejected": len(rejected),
            "rejected_labels": delta["rejected_labels"],
        }
        # Decide whether to clear the flag
        if len(kept) >= 5:
            e.pop("_d_stories_requires_revalidation", None)
            delta["flag_cleared"] = True
        else:
            delta["flag_cleared"] = False
        e_path.write_text(json.dumps(e, ensure_ascii=False, indent=2))
        delta["written"] = True
    else:
        delta["written"] = False
        delta["flag_cleared"] = False
    return delta


def main() -> int:
    report = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "flagged_revalidation": [],
        "jnj_retroactive": None,
        "sample_10_retroactive": [],
    }
    # 1. The 25 flagged
    for t in FLAGGED_LOWER:
        d = revalidate(t, write=True)
        report["flagged_revalidation"].append(d)
    # 2. JNJ retroactive
    report["jnj_retroactive"] = revalidate("jnj", write=True)
    # 3. Sample 10 #128 stés random (from a known list of #128-touched stés)
    # The flagged list is itself a subset of #128. Use 10 random from #128 commits.
    # We pick from enrich files modified recently (heuristic).
    candidates = []
    cutoff_ts = datetime(2026, 5, 21).timestamp()
    for f in sorted(ENRICH_DIR.glob("*.json")):
        try:
            if f.stat().st_mtime >= cutoff_ts:
                candidates.append(f.stem)
        except Exception:
            continue
    # Exclude already-revalidated
    exclude = set(FLAGGED_LOWER + ["jnj"])
    pool = [c for c in candidates if c not in exclude]
    random.seed(133)
    sample = random.sample(pool, min(10, len(pool)))
    for t in sample:
        # Read-only: don't write, just measure
        d = revalidate(t, write=False)
        report["sample_10_retroactive"].append(d)
    # Aggregate metrics
    total_rejected_flagged = sum(
        d.get("rejected", 0) for d in report["flagged_revalidation"]
    )
    total_before_flagged = sum(
        d.get("before", 0) for d in report["flagged_revalidation"]
    )
    cleared = sum(
        1 for d in report["flagged_revalidation"] if d.get("flag_cleared")
    )
    remaining_flagged = sum(
        1 for d in report["flagged_revalidation"]
        if d.get("had_flag") and not d.get("flag_cleared")
    )
    sample_rejected = sum(d.get("rejected", 0) for d in report["sample_10_retroactive"])
    sample_before = sum(d.get("before", 0) for d in report["sample_10_retroactive"])
    report["summary"] = {
        "flagged_count_input": len(FLAGGED_LOWER),
        "flagged_total_stories_before": total_before_flagged,
        "flagged_total_stories_rejected": total_rejected_flagged,
        "flagged_flags_cleared": cleared,
        "flagged_flags_remaining": remaining_flagged,
        "jnj_rejected": report["jnj_retroactive"].get("rejected", 0),
        "sample_size": len(sample),
        "sample_total_stories_before": sample_before,
        "sample_total_stories_rejected": sample_rejected,
        "sample_hallucination_rate_pct": round(
            100 * sample_rejected / sample_before, 1
        ) if sample_before else 0.0,
    }
    out = REPO_ROOT / "src" / "data" / "v1-9-revalidation-133-report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report["summary"], indent=2))
    print(f"\nReport written: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
