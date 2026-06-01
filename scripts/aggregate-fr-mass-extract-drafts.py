#!/usr/bin/env python3
"""
Agrégateur drafts FR mass extract -> fichier unifié par ticker.

Sources scannées :
  - /tmp/eu5n-fr-mass-extract/<TICKER>.json
      (batch 1-4 KPIs + hero, structure squelette ou avec valeurs)
  - /tmp/eu5n-fr-mass-extract-v2/<TICKER>.json
      (KPIs enrichis avec valeurs chiffrées, écrase null des batches 1-4)
  - /tmp/eu5n-fr-mass-extract-enrich/<TICKER>.{segments-geo,risks,gov-ai,
        events-history,market-positions,transcript-summary,i18n,
        metadata-bundle}.json

Output :
  /tmp/eu5n-fr-mass-extract-unified/<TICKER>.unified.json
  /tmp/eu5n-fr-mass-extract-unified/_aggregate.log

Règles agrégation :
  - Anti-invention strict : pas de transformation des valeurs, pas de calculs.
  - Append-only : ne pas écraser un champ non-null avec un null venant
    d'une autre source. Les valeurs chiffrées de v2 remplacent les null
    des batches 1-4.
  - Marquage source pour chaque sous-bloc (_source_file).
  - Champ `_requires_yann_validation=True` toujours présent.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE_DIR = Path("/tmp/eu5n-fr-mass-extract")
V2_DIR = Path("/tmp/eu5n-fr-mass-extract-v2")
ENRICH_DIR = Path("/tmp/eu5n-fr-mass-extract-enrich")
OUT_DIR = Path("/tmp/eu5n-fr-mass-extract-unified")

ENRICH_SUFFIXES = [
    "segments-geo",
    "risks",
    "gov-ai",
    "events-history",
    "market-positions",
    "transcript-summary",
    "i18n",
    "metadata-bundle",
]

AGGREGATOR_VERSION = "1.0"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def safe_load(p: Path) -> dict | None:
    """Charge un JSON ; renvoie None si fichier absent / cassé."""
    if not p.exists():
        return None
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  WARN  parse error {p}: {exc}", file=sys.stderr)
        return None


def list_tickers() -> list[str]:
    """Tickers présents dans au moins une des sources."""
    tickers: set[str] = set()
    for d in (BASE_DIR, V2_DIR):
        if d.exists():
            for p in d.glob("*.json"):
                tickers.add(p.stem)
    if ENRICH_DIR.exists():
        for p in ENRICH_DIR.glob("*.json"):
            stem = p.name
            # Format <TICKER>.<suffix>.json
            for sfx in ENRICH_SUFFIXES:
                marker = f".{sfx}.json"
                if stem.endswith(marker):
                    tickers.add(stem[: -len(marker)])
                    break
    return sorted(tickers)


def merge_kpis(base: list[dict] | None, v2: list[dict] | None) -> list[dict]:
    """v2 surcharge les KPIs base sur la clé `short` (insensible casse)."""
    if not base and not v2:
        return []
    base = list(base or [])
    v2 = list(v2 or [])
    by_short: dict[str, dict] = {}
    for k in base:
        short = (k.get("short") or "").strip().lower()
        if short:
            by_short[short] = dict(k)
    for k in v2:
        short = (k.get("short") or "").strip().lower()
        if not short:
            continue
        if short in by_short:
            existing = by_short[short]
            for field, val in k.items():
                if val is None:
                    continue
                if existing.get(field) is None:
                    existing[field] = val
                elif field == "history" and isinstance(val, list):
                    # Merge history: garde la version la plus "remplie"
                    existing_hist = existing.get("history") or []
                    if sum(1 for v in val if v is not None) > sum(
                        1 for v in existing_hist if v is not None
                    ):
                        existing[field] = val
                elif field == "value" and val is not None:
                    # Préfère valeur non-null
                    existing[field] = val
        else:
            by_short[short] = dict(k)
    return list(by_short.values())


def merge_hero(base_hero: dict | None, v2_hero: dict | None) -> dict | None:
    """Fusion non-destructive du hero_kpi."""
    if not base_hero and not v2_hero:
        return None
    base_hero = dict(base_hero or {})
    v2_hero = dict(v2_hero or {})
    out = dict(base_hero)
    for k, v in v2_hero.items():
        if v is None:
            continue
        if out.get(k) is None:
            out[k] = v
        elif k == "history" and isinstance(v, list):
            existing = out.get("history") or []
            if sum(1 for x in v if x is not None) > sum(
                1 for x in existing if x is not None
            ):
                out[k] = v
    return out


def aggregate_one(ticker: str) -> dict:
    base = safe_load(BASE_DIR / f"{ticker}.json") or {}
    v2 = safe_load(V2_DIR / f"{ticker}.json") or {}

    # Métadonnées de base : on prend base puis v2 comme fallback.
    name = base.get("name") or v2.get("name")
    country = base.get("country") or v2.get("country")
    sector_real = base.get("sector_real") or v2.get("sector_real")
    source = base.get("source") or v2.get("source")
    extracted_at_base = base.get("extracted_at") or v2.get("extracted_at")

    unified: dict[str, Any] = {
        "ticker": ticker,
        "name": name,
        "country": country,
        "sector_real": sector_real,
        "extracted_at": extracted_at_base,
        "_aggregated_at": now_iso(),
        "_aggregator_version": AGGREGATOR_VERSION,
        "_requires_yann_validation": True,
        "_sources_present": [],
        "_source_main": source,
    }

    sources_present: list[str] = []

    # KPIs + hero (merge base + v2)
    hero = merge_hero(base.get("hero_kpi"), v2.get("hero_kpi"))
    if hero is not None:
        unified["hero_kpi"] = hero
    kpis_merged = merge_kpis(base.get("kpis"), v2.get("kpis"))
    if kpis_merged:
        unified["kpis"] = kpis_merged
    if base:
        sources_present.append("base")
    if v2:
        sources_present.append("v2")

    # KPIs enrichis bruts (gardés séparément pour audit)
    if v2.get("kpis") is not None:
        unified["kpis_enriched"] = v2.get("kpis")

    # Enrich files
    enrich_map = {
        "segments-geo": "segments_geo",
        "risks": "risks_bundle",
        "gov-ai": "gov_ai",
        "events-history": "events_history",
        "market-positions": "market_positions_bundle",
        "transcript-summary": "transcript_summary_bundle",
        "i18n": "i18n_bundle",
        "metadata-bundle": "metadata_bundle",
    }
    for sfx, key in enrich_map.items():
        p = ENRICH_DIR / f"{ticker}.{sfx}.json"
        data = safe_load(p)
        if data is None:
            continue
        sources_present.append(sfx)
        unified[f"_raw_{key}"] = data

    # Vues normalisées (sans déballer les valeurs - on aplatit juste pour lisibilité)
    seg = unified.get("_raw_segments_geo") or {}
    if seg:
        unified["segments"] = seg.get("revenue_by_segment")
        unified["geography"] = seg.get("revenue_by_geography")

    risks_b = unified.get("_raw_risks_bundle") or {}
    if risks_b:
        unified["risks"] = risks_b.get("risks")

    gov_ai = unified.get("_raw_gov_ai") or {}
    if gov_ai:
        unified["governance"] = gov_ai.get("governance")
        unified["ai_positioning"] = gov_ai.get("ai_positioning")

    eh = unified.get("_raw_events_history") or {}
    if eh:
        unified["events"] = eh.get("events")
        unified["hero_history"] = eh.get("hero_history_extension")

    mp = unified.get("_raw_market_positions_bundle") or {}
    if mp:
        unified["market_positions"] = mp.get("market_positions") or []
        if mp.get("_no_tam_disclosed"):
            unified["market_positions_meta"] = {
                "no_tam_disclosed": True,
                "note": mp.get("_note"),
            }

    ts = unified.get("_raw_transcript_summary_bundle") or {}
    if ts:
        unified["transcript_summary"] = ts.get("transcript_summary")

    i18n_b = unified.get("_raw_i18n_bundle") or {}
    if i18n_b:
        unified["i18n"] = i18n_b.get("i18n")

    md = unified.get("_raw_metadata_bundle") or {}
    if md:
        # On garde tout le bundle sous metadata sans toucher aux champs.
        unified["metadata"] = {k: v for k, v in md.items() if not k.startswith("_")}

    unified["_sources_present"] = sources_present
    unified["_sources_count"] = len(sources_present)
    return unified


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tickers = list_tickers()
    log_lines: list[str] = []
    log_lines.append(f"# aggregate-fr-mass-extract-drafts.py run @ {now_iso()}")
    log_lines.append(f"# tickers detected: {len(tickers)}")

    ok = 0
    skipped = 0
    for t in tickers:
        try:
            unified = aggregate_one(t)
        except Exception as exc:  # noqa: BLE001
            log_lines.append(f"FAIL  {t}: {exc}")
            skipped += 1
            continue
        out_path = OUT_DIR / f"{t}.unified.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(unified, f, ensure_ascii=False, indent=2)
        srcs = ",".join(unified.get("_sources_present") or [])
        log_lines.append(f"OK    {t}  sources={srcs}")
        ok += 1

    log_lines.append("")
    log_lines.append(f"# total ok={ok} skipped={skipped}")
    (OUT_DIR / "_aggregate.log").write_text("\n".join(log_lines), encoding="utf-8")
    print(f"aggregated tickers: ok={ok} skipped={skipped}", file=sys.stderr)
    print(f"output dir: {OUT_DIR}", file=sys.stderr)
    return 0 if skipped == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
