#!/usr/bin/env python3
"""
Merge FR ready proposed canonical drafts into src/data/v2-pipeline/<ticker>.json.

Supports two scopes (--scope flag):
  - ready (9 stés, default historical scope): /tmp/eu5n-fr-canonical-ready/
  - massive (82 stés FR ready_to_merge ≥10/11): /tmp/eu5n-fr-canonical-massive/

Modes:
  --dry-run (default): show diff per ste, write NOTHING
  --apply: write to canonical. Requires:
      --confirm "<phrase>" (depends on scope, see CONFIRM_PHRASES)
      --tickers <T1,T2,...> (explicit list, must be a subset of scope tickers)

Safety:
  - Backup <ticker>.before-<scope>-merge.bak.json BEFORE any write
    (ready scope -> before-canonical-merge.bak.json, massive -> before-massive-merge.bak.json)
  - Append-only on kpis: NEVER overwrites a KPI whose `short` already exists
    (preserves signed KPIs from CONV-DATA / CONV-SUBAGENT-KPIS-*)
  - Existing kpis array is preserved; new kpis from proposed are appended
    if their `short` (or `key`) is not already present
  - Sector/subsector/ranks/hero_kpi from existing canonical are preserved
    if proposed lacks them in compatible format
"""

import argparse
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime, timezone

# Historical scope (9 stés, kept for backward compatibility)
READY_TICKERS_9 = ["AC.PA", "ACA.PA", "AIR.PA", "BNP.PA", "DSY.PA", "MC.PA", "OR.PA", "SAN.PA", "TTE.PA"]

# Massive scope (82 stés FR ready_to_merge ≥10/11 from
# /tmp/eu5n-fr-mass-extract-unified/_AUDIT.json category=ready_to_merge)
READY_TICKERS_82 = [
    "AC.PA", "ACA.PA", "AI.PA", "AIR.PA", "AKE.PA", "ALD.PA", "ALO.PA", "AMUN.PA",
    "ATO.PA", "BB.PA", "BIM.PA", "BN.PA", "BNP.PA", "BVI.PA", "CA.PA", "CAP.PA",
    "CGG.PA", "CO.PA", "COFA.PA", "CS.PA", "DEC.PA", "DG.PA", "DSY.PA", "EDEN.PA",
    "EL.PA", "EN.PA", "ENGI.PA", "ERF.PA", "EXAE.PA", "FGR.PA", "FR.PA", "GET.PA",
    "GFC.PA", "GLE.PA", "HO.PA", "ICAD.PA", "INF.PA", "IPN.PA", "IPS.PA", "JCQ.PA",
    "KER.PA", "LI.PA", "LNA.PA", "LR.PA", "MAU.PA", "MC.PA", "ML.PA", "MMB.PA",
    "MRN.PA", "NEX.PA", "NK.PA", "OR.PA", "ORA.PA", "PUB.PA", "PVL.PA", "RCO.PA",
    "RMS.PA", "RNO.PA", "RUI.PA", "RXL.PA", "SAF.PA", "SAN.PA", "SCR.PA", "SGO.PA",
    "SOI.PA", "SOP.PA", "SPIE.PA", "STLAP.PA", "STMPA.PA", "SU.PA", "SW.PA", "TEP.PA",
    "TKO.PA", "TTE.PA", "UBI.PA", "URW.PA", "VIE.PA", "VIV.PA", "VK.PA", "VLA.PA",
    "VRLA.PA", "WLN.PA",
]

CANONICAL_DIR = Path("/Users/yann/spx-app/src/data/v2-pipeline")

# Scope configuration: each scope = (proposed dir, ticker list, confirm phrase, backup suffix)
SCOPES = {
    "ready": {
        "proposed_dir": Path("/tmp/eu5n-fr-canonical-ready"),
        "tickers": READY_TICKERS_9,
        "confirm_phrase": "MERGE FR READY 9 STES",
        "backup_suffix": "before-canonical-merge.bak.json",
        "label": "FR READY 9 STES",
    },
    "massive": {
        "proposed_dir": Path("/tmp/eu5n-fr-canonical-massive"),
        "tickers": READY_TICKERS_82,
        "confirm_phrase": "MERGE FR MASSIVE 82 STES",
        "backup_suffix": "before-massive-merge.bak.json",
        "label": "FR MASSIVE 82 STES",
    },
}

# Backward compatibility (referenced elsewhere)
READY_TICKERS = READY_TICKERS_9
PROPOSED_DIR = SCOPES["ready"]["proposed_dir"]
CONFIRM_PHRASE = SCOPES["ready"]["confirm_phrase"]


def load_json(path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception as e:
        print(f"ERROR loading {path}: {e}", file=sys.stderr)
        return None


def find_canonical_path(ticker, must_exist=False):
    """Return canonical path: prefer lowercase, fallback to uppercase, else lowercase as creation path."""
    tl = ticker.lower()
    for variant in [tl, ticker]:
        p = CANONICAL_DIR / f"{variant}.json"
        if p.exists():
            return p
    if must_exist:
        return None
    return CANONICAL_DIR / f"{tl}.json"


def kpi_identifier(kpi):
    """Return canonical identifier for a KPI (used for dedup)."""
    if not isinstance(kpi, dict):
        return None
    for k in ("short", "key", "name_en", "name_fr"):
        v = kpi.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    return None


def merge_kpis_append_only(existing_kpis, proposed_kpis):
    """Merge KPIs: keep all existing, append proposed KPIs whose identifier is new."""
    if not isinstance(existing_kpis, list):
        existing_kpis = []
    if not isinstance(proposed_kpis, list):
        proposed_kpis = []
    seen = set()
    for k in existing_kpis:
        ident = kpi_identifier(k)
        if ident:
            seen.add(ident)
    merged = list(existing_kpis)
    appended = 0
    for k in proposed_kpis:
        ident = kpi_identifier(k)
        if ident and ident not in seen:
            merged.append(k)
            seen.add(ident)
            appended += 1
        elif not ident:
            # Cannot dedup, append conservatively but mark
            k2 = dict(k) if isinstance(k, dict) else k
            if isinstance(k2, dict):
                k2["_appended_without_dedup"] = True
            merged.append(k2)
            appended += 1
    return merged, appended


# Blocks that come from proposed and replace/fill in existing
SIMPLE_OVERWRITE_BLOCKS = [
    "ai_positioning", "governance", "risks", "events", "market_positions",
    "description", "customer_type", "freshness", "profit_warning",
    "i18n", "transcript_summary", "geography", "segments",
    "revenue_by_segment", "revenue_by_geography", "country",
]

# Blocks we never overwrite if existing has a value (preserve CONV-DATA work)
PRESERVE_IF_PRESENT = [
    "ranks", "hero_kpi", "sector", "subsector", "company_description",
    "founded", "ipo", "last_data_date", "next_earnings_date", "tagline",
    "logo_treatment", "stories_kpis",
]


def block_is_present(value):
    if value is None:
        return False
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def build_merged(existing, proposed):
    """Produce the merged dict to be written canonically."""
    existing = existing or {}
    out = dict(existing)  # start from existing (preserves all unknown fields)

    # 1. Append-only kpis
    proposed_kpis = proposed.get("kpis", [])
    merged_kpis, appended = merge_kpis_append_only(existing.get("kpis", []), proposed_kpis)
    if merged_kpis:
        out["kpis"] = merged_kpis

    # 2. Simple overwrite for enrichment blocks (proposed wins if present)
    for blk in SIMPLE_OVERWRITE_BLOCKS:
        if blk in proposed and block_is_present(proposed[blk]):
            out[blk] = proposed[blk]

    # 3. Preserve if present in existing
    for blk in PRESERVE_IF_PRESENT:
        if blk in existing and block_is_present(existing[blk]):
            # keep existing; do NOT overwrite from proposed
            pass
        elif blk in proposed and block_is_present(proposed[blk]):
            out[blk] = proposed[blk]

    # 4. Always carry name/ticker (existing first)
    for blk in ("ticker", "name"):
        if blk in existing and block_is_present(existing[blk]):
            out[blk] = existing[blk]
        elif blk in proposed and block_is_present(proposed[blk]):
            out[blk] = proposed[blk]

    # 5. Stamp merge meta
    out["_canonical_merged_at"] = datetime.now(timezone.utc).isoformat()
    out["_canonical_merge_source"] = proposed.get("_proposed_source", "unknown")
    out["_canonical_kpis_appended"] = appended

    return out


def do_dry_run(tickers, scope_cfg):
    proposed_dir = scope_cfg["proposed_dir"]
    label = scope_cfg["label"]
    print("=" * 60)
    print(f"DRY-RUN [{label}] — {len(tickers)} stés")
    print(f"  proposed dir: {proposed_dir}")
    print("=" * 60)
    for t in tickers:
        prop = load_json(proposed_dir / f"{t}.proposed.json")
        existing_path = find_canonical_path(t, must_exist=True)
        existing = load_json(existing_path) if existing_path else None
        if prop is None:
            print(f"\n{t}: ❌ no proposed file")
            continue
        merged = build_merged(existing, prop)
        old_kpis = len(existing.get("kpis", [])) if existing else 0
        new_kpis = len(merged.get("kpis", []))
        appended = merged.get("_canonical_kpis_appended", 0)
        print(f"\n{t}:")
        print(f"  existing canonical: {existing_path or '(none — would create)'}")
        print(f"  proposed source: {prop.get('_proposed_source','?')}")
        print(f"  kpis: {old_kpis} → {new_kpis} (appended {appended} new)")
        keys_added = sorted(set(merged.keys()) - set(existing.keys() if existing else set()))
        print(f"  top-level keys added: {len(keys_added)}: {keys_added[:8]}{'...' if len(keys_added)>8 else ''}")


def do_apply(tickers, scope_cfg):
    proposed_dir = scope_cfg["proposed_dir"]
    backup_suffix = scope_cfg["backup_suffix"]
    label = scope_cfg["label"]
    print("=" * 60)
    print(f"APPLY [{label}] — {len(tickers)} stés (WRITING TO CANONICAL)")
    print(f"  proposed dir: {proposed_dir}")
    print(f"  backup suffix: {backup_suffix}")
    print("=" * 60)
    for t in tickers:
        prop = load_json(proposed_dir / f"{t}.proposed.json")
        if prop is None:
            print(f"\n{t}: ❌ no proposed file — SKIP")
            continue
        existing_path = find_canonical_path(t, must_exist=True)
        existing = load_json(existing_path) if existing_path else None
        # Determine target path
        target_path = existing_path if existing_path else find_canonical_path(t, must_exist=False)
        # Backup
        if target_path.exists():
            bak = target_path.parent / f"{target_path.stem}.{backup_suffix}"
            shutil.copy2(target_path, bak)
            print(f"\n{t}: 💾 backup → {bak.name}")
        else:
            print(f"\n{t}: 📝 creating new file (no backup needed)")
        merged = build_merged(existing, prop)
        target_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
        kpis = len(merged.get("kpis", []))
        appended = merged.get("_canonical_kpis_appended", 0)
        print(f"  ✅ wrote {target_path} (kpis={kpis}, appended={appended})")


def main():
    parser = argparse.ArgumentParser(description="Merge FR ready proposed drafts into canonical")
    parser.add_argument(
        "--scope", type=str, default="massive", choices=list(SCOPES.keys()),
        help="Merge scope: 'ready' (9 stés legacy) or 'massive' (82 stés FR ready). Default: massive."
    )
    parser.add_argument("--apply", action="store_true", help="Actually write to canonical (default: dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Dry-run mode (default)")
    parser.add_argument("--confirm", type=str, default="", help="Required confirmation phrase for --apply")
    parser.add_argument(
        "--tickers", type=str, default="",
        help="Comma-separated explicit list of tickers (required for --apply). "
             "Must be subset of scope's READY_TICKERS list (--scope ready=9 stés, --scope massive=82 stés)."
    )
    args = parser.parse_args()

    scope_cfg = SCOPES[args.scope]
    valid_tickers = scope_cfg["tickers"]
    confirm_phrase = scope_cfg["confirm_phrase"]

    if args.apply:
        if args.confirm != confirm_phrase:
            print(f"❌ --apply --scope {args.scope} requires --confirm \"{confirm_phrase}\"", file=sys.stderr)
            sys.exit(2)
        if not args.tickers:
            print(f"❌ --apply requires --tickers <T1,T2,...> (explicit list)", file=sys.stderr)
            sys.exit(2)
        requested = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        unknown = [t for t in requested if t not in valid_tickers]
        if unknown:
            print(f"❌ Unknown tickers (not in scope '{args.scope}' READY list): {unknown}", file=sys.stderr)
            sys.exit(2)
        do_apply(requested, scope_cfg)
    else:
        # dry-run
        tickers = (
            [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
            if args.tickers else valid_tickers
        )
        do_dry_run(tickers, scope_cfg)


if __name__ == "__main__":
    main()
