"""
_schema_v19.py — Schéma référence v1-9-complete (sub-agent #112 patch)
====================================================================
Source de vérité : src/data/v1-9-complete/AAPL.json + HSBA.L.json.

Schéma top-level réel (27 champs) :
  ticker, name, sector, subsector, country, sources, founded, ipo, tagline,
  hero_kpi (str scalar), hero_kpi_rationale,
  kpis [list], kpis_story [list],
  governance {top_capital, top_voting, voting_structure_note, _top_*},
  revenue_by_segment {unit, source_date, source, slices, total},
  revenue_by_geography {unit, source_date, source, slices, total},
  risks [list], ai_positioning {stance, summary, evidence, source_note, _bucket, _subsector, _sources_used, _generated_at, ticker},
  market_positions [list], events [list], ranks {global_world, global_us, sector, subsector},
  latest_filing, next_earnings_date, publication_date, company_description,
  _built_at, _missing_blocks.

Incompatibilités avec scripts sub-agent #109 originaux :
  - "name" (pas "company_name") ✓
  - "subsector" (pas "sub_industry") ✓
  - "revenue_by_segment" / "revenue_by_geography" (PAS "repartition.segments/geographies") ✗
  - "events" liste (PAS "events" dict) ✓
  - "hero_kpi" string scalar (PAS "hero" dict) ✗
  - "kpis" liste top-level (PAS "stories" dict) ✗
  - "risks" liste top-level (PAS "risks.items") ✗
  - "ai_positioning" dict (PAS "stories.ai_positioning") ✗
"""

REQUIRED_TOP_KEYS = [
    "ticker", "name", "sector", "subsector", "country", "sources",
    "hero_kpi", "kpis", "revenue_by_segment", "revenue_by_geography",
    "risks", "ai_positioning", "events", "ranks", "company_description",
    "_built_at", "_missing_blocks",
]

KPI_SCHEMA_KEYS = [
    "short", "name_fr", "name_en", "value", "unit", "yoy",
    "history", "period_type", "description_fr", "description_en",
]

REPARTITION_SCHEMA = {
    "unit": "str",
    "source_date": "str ISO",
    "source": "str (10-K p.X, 20-F note Y, etc.)",
    "slices": [{"label": "str", "value": "float", "share_pct": "float"}],
    "total": "float",
}

RISK_SCHEMA_KEYS = ["title", "category", "quote", "trend", "score", "score_rationale"]

AI_POSITIONING_SCHEMA = {
    "stance": "leader | integrator | cautious | absent",
    "summary": "str",
    "evidence": ["str"],
    "source_note": "str",
}


def build_v19_skeleton(target: dict, yf_data: dict, sec_data: dict) -> dict:
    """Construit un squelette v1-9-complete CONFORME au schéma réel.

    Tous les blocs LLM-dépendants sont marqués TODO_LLM (à remplir par
    cron Cerebras 02:05). Les champs structurels (ticker/name/country/
    sources/sector) sont remplis depuis yf_data si dispo, sinon fallback
    sur target.
    """
    info = yf_data.get("info", {}) or {}
    import time
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    return {
        "ticker": target["ticker"],
        "name": target.get("name") or info.get("longName") or info.get("shortName") or target["ticker"],
        "sector": info.get("sector") or "TODO_LLM",
        "subsector": info.get("industry") or "TODO_LLM",
        "country": target.get("country") or info.get("country") or "TODO_LLM",
        "sources": target.get("sources") or ["sub-agent-112-skeleton"],
        "founded": info.get("foundedYear") or None,
        "ipo": None,
        "tagline": info.get("longBusinessSummary", "")[:200] if info.get("longBusinessSummary") else "TODO_LLM",
        "hero_kpi": "TODO_LLM",
        "hero_kpi_rationale": "TODO_LLM",
        "kpis": [],
        "kpis_story": [],
        "governance": {
            "top_capital": [],
            "top_voting": [],
            "voting_structure_note": "TODO_LLM",
            "_top_source": "todo",
        },
        "revenue_by_segment": {
            "unit": "TODO_LLM",
            "source_date": now_iso,
            "source": "TODO_LLM",
            "slices": [],
            "total": 0,
        },
        "revenue_by_geography": {
            "unit": "TODO_LLM",
            "source_date": now_iso,
            "source": "TODO_LLM",
            "slices": [],
            "total": 0,
        },
        "risks": [],
        "ai_positioning": {
            "stance": "TODO_LLM",
            "summary": "TODO_LLM",
            "evidence": [],
            "source_note": "TODO_LLM",
            "_generated_at": now_iso,
            "ticker": target["ticker"],
        },
        "market_positions": [],
        "events": [],
        "ranks": {
            "global_world": "TODO_LLM",
            "global_us": "TODO_LLM",
            "sector": "TODO_LLM",
            "subsector": "TODO_LLM",
        },
        "latest_filing": None,
        "next_earnings_date": "",
        "publication_date": None,
        "company_description": info.get("longBusinessSummary") or "TODO_LLM",
        "_built_at": now_iso,
        "_missing_blocks": [
            "hero_kpi", "kpis", "kpis_story", "governance",
            "revenue_by_segment", "revenue_by_geography", "risks",
            "ai_positioning", "events", "ranks",
        ],
        "_skeleton_source": "sub-agent-112-schema-patched",
        "_extraction": {
            "script": "extract_*_v19.py",
            "agent": "sub-agent-109-patched-by-112",
            "extracted_at_utc": now_iso,
            "yf_ok": bool(info) and not yf_data.get("info_error"),
            "sec_ok": bool(sec_data),
        },
    }


def validate_against_reference(obj: dict, reference_path: str) -> list:
    """Compare keys d'un dict construit vs AAPL.json référence.

    Retourne une liste d'erreurs (clé manquante / clé en trop top-level).
    """
    import json
    with open(reference_path) as f:
        ref = json.load(f)
    ref_keys = set(ref.keys())
    obj_keys = set(obj.keys())
    missing = ref_keys - obj_keys
    extra = obj_keys - ref_keys - {"_skeleton_source", "_extraction"}  # allow these
    errors = []
    if missing:
        errors.append(f"MISSING top-level keys: {sorted(missing)}")
    if extra:
        errors.append(f"EXTRA top-level keys: {sorted(extra)}")
    return errors
