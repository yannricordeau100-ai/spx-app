#!/usr/bin/env python3
"""
Post-run patcher for sub-agent #131.

Walks src/data/v2-pipeline-enrich/*.json and for every file written by
#131 (_source == cerebras_paid_def14a_131), adds:
- source: "def14a_local_cerebras_real" (ends with "_real" → audit
  regex_real_sourced)
- voting_structure_note synthesized from voting_structure if absent
- _governance_extracted_by_131_at preserved

Idempotent. Touches ONLY the overrides_governance block.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"

VOTING_NOTES = {
    "one_share_one_vote": "Structure standard une action = une voix (vérifié via DEF14A).",
    "dual_class": "Structure dual class : classes d'actions avec droits de vote différents (vérifié via DEF14A).",
    "multi_class": "Structure multi-class : plusieurs classes d'actions avec droits de vote distincts (vérifié via DEF14A).",
}


def patch_one(path: Path) -> bool:
    try:
        d = json.loads(path.read_text())
    except Exception:
        return False
    og = d.get("overrides_governance")
    if not isinstance(og, dict):
        return False
    if og.get("_source") != "cerebras_paid_def14a_131":
        return False
    changed = False
    # Set source ending in _real
    if og.get("source") != "def14a_local_cerebras_real":
        og["source"] = "def14a_local_cerebras_real"
        changed = True
    if og.get("source_file") != og.get("_source_file") and og.get("_source_file"):
        og["source_file"] = og["_source_file"]
        changed = True
    # Voting structure note
    vs = og.get("voting_structure")
    if vs in VOTING_NOTES and not og.get("voting_structure_note"):
        og["voting_structure_note"] = VOTING_NOTES[vs]
        changed = True
    if changed:
        og["_patched_at"] = datetime.now(timezone.utc).isoformat()
        d["overrides_governance"] = og
        path.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    return changed


def main():
    patched = 0
    scanned = 0
    for f in sorted(V2_ENRICH.glob("*.json")):
        scanned += 1
        if patch_one(f):
            patched += 1
    print(f"patched {patched}/{scanned} files")


if __name__ == "__main__":
    main()
