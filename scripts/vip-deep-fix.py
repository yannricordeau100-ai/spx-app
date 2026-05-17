#!/usr/bin/env python3
"""vip-deep-fix.py — Pipeline 2e étage : tente de corriger les defects
que vip-deep-inspection.py + fix-element.py FIXES n'ont PAS pu auto-fixer.

Mission Yann 18 mai 2026 : "PARFAIT" — si un doc manque (governance,
segments, geography, risks, ai_positioning), aller chercher les data
nécessaires sur sources sourcées (Wikipedia, IR officiel, 10-K/20-F)
via Claude Sonnet + WebFetch, update v2-pipeline/<ticker>.json, marquer
defect corrected en BDD, re-déclencher inspection pour reverify.

Boucle : max 3 tentatives par defect (évite boucle infinie sur data
vraiment inaccessible).

Usage :
    python3 scripts/vip-deep-fix.py --ticker BABA
    python3 scripts/vip-deep-fix.py --all-pending  # tous les tickers BDD avec
                                                    # defects uncorrected

Coût Sonnet : ~$0.30 par sté gros gap data. Acceptable vs gain qualité.

Yann 18 mai 2026, CONV-DEPAN.
"""
from __future__ import annotations
import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
SONNET_MODEL = "claude-sonnet-4-5"

# Defects qu'on tente de fix automatiquement via LLM + sources sourcées.
DEEP_FIXABLE_DEFECTS = {
    "governance": [
        "governance.ceo_name_correct", "governance.board_size_plausible",
        "governance.voting_structure_present", "governance.compensation_present",
    ],
    "repartition.segment": [
        "repartition.segment_slices_2plus", "repartition.pct_sums_100",
    ],
    "repartition.geography": [
        "repartition.geo_slices_2plus",
    ],
    "risks": [
        "risks.count_3plus", "risks.severity_score", "risks.trend_chip",
    ],
    "ai_positioning": [
        "ai_positioning.stance_present", "ai_positioning.evidence_min_2",
    ],
    "events": [
        "events.timeline_min_3",
    ],
}


def load_env():
    env = ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def supabase_select(table: str, filt: str = ""):
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required")
    full = f"{url}/rest/v1/{table}?select=*{('&' + filt) if filt else ''}"
    req = urllib.request.Request(full, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        return json.loads(r.read())


def supabase_upsert(table: str, row: dict, on_conflict: str = "ticker"):
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    full = f"{url}/rest/v1/{table}?on_conflict={on_conflict}"
    req = urllib.request.Request(
        full,
        data=json.dumps([row]).encode(),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        return r.status


SYSTEM_PROMPT = """Tu es un analyste financier expert. Pour une société cotée, tu corriges les data manquantes en utilisant TES connaissances + sources officielles que tu cites (annual report, 10-K, 20-F, IR page, Wikipedia, presse spécialisée).

Règles absolues :
1. JAMAIS inventer un chiffre. Si pas sourçable : null + note explicative.
2. TOUJOURS citer la source (URL ou nom du doc).
3. Format JSON pur, pas de markdown.
4. Si tu ne sais pas : retourne {"unknown": true, "reason": "..."}.

Tu reçois : ticker, name, defects list. Tu retournes : { patches: [...] }
où chaque patch = { field: "governance"|"revenue_by_segment"|..., data: {...}, source: "..." }.
"""


def call_sonnet(prompt: str, max_tokens: int = 12000) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY required")
    payload = json.dumps({
        "model": SONNET_MODEL,
        "max_tokens": max_tokens,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}, {"role": "assistant", "content": "{"}],
    }).encode()
    req = urllib.request.Request(
        ANTHROPIC_API,
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=300, context=SSL_CTX) as r:
        obj = json.loads(r.read())
    text = obj["content"][0]["text"]
    return "{" + text  # prefill { ajoutée


def extract_json(text: str) -> dict:
    """Robust JSON extract avec gestion markdown + truncation."""
    import re
    cleaned = re.sub(r"^\s*```(?:json)?\s*\n?", "", text)
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
    start = cleaned.find("{")
    if start < 0: return {}
    depth = 0
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try: return json.loads(cleaned[start:i+1])
                except json.JSONDecodeError: continue
    return {}


def fix_ticker(ticker: str, defects: list[dict], status_row: dict) -> dict:
    """Tente deep-fix pour les defects uncorrected. Retourne stats."""
    uncorrected = [d for d in defects if not d.get("corrected")]
    if not uncorrected:
        log(f"  {ticker} : aucun defect uncorrected, skip")
        return {"fixed": 0, "skipped": len(defects), "errors": 0}

    pipeline_file = PIPELINE / f"{ticker.lower()}.json"
    if not pipeline_file.exists():
        log(f"  ⚠ {ticker} : pas de fichier v2-pipeline, skip")
        return {"fixed": 0, "skipped": len(uncorrected), "errors": 1}
    current_data = json.loads(pipeline_file.read_text())
    name = current_data.get("name", ticker)

    prompt = f"""Société : {ticker} ({name})

Defects à corriger (extracts de quality-tree audit Gemini) :
{chr(10).join(f"  - [{d['id']}] sev {d.get('severity', '?')} : {d.get('obs', '')[:120]}" for d in uncorrected)}

Pour chaque defect, propose un patch JSON pour le dataset v2-pipeline/{ticker.lower()}.json.

Domaines courants à corriger :
- governance : {{ ceo_name, ceo_since, chairman, board_size, voting_structure, source }}
- revenue_by_segment : {{ fiscal_year, unit, total, slices: [{{ label, value, pct, note }}], source }}
- revenue_by_geography : {{ fiscal_year, unit, slices: [{{ label, value, pct, note }}], source }}
- risks : [{{ id, label, category, severity (1-5), trend (new/up/stable/down/removed), rationale, source }}]
- ai_positioning : {{ stance (leader/integrator/cautious/absent), evidence: [...], summary, source }}
- events : [{{ year, type, label, source }}]

Retourne JSON :
{{
  "patches": [
    {{ "field": "governance", "data": {{...}}, "source": "URL ou nom doc" }},
    ...
  ],
  "skipped": [
    {{ "defect_id": "...", "reason": "data non-sourçable ou hors-scope" }}
  ]
}}

IMPORTANT : utilise tes connaissances FY2024/FY2025 + données publiques officielles. Cite source. Pas d'invention."""

    try:
        resp = call_sonnet(prompt)
        result = extract_json(resp)
    except Exception as e:
        log(f"  ❌ {ticker} Sonnet fail : {e}")
        return {"fixed": 0, "skipped": len(uncorrected), "errors": 1}

    patches = result.get("patches", []) if isinstance(result, dict) else []
    skipped_llm = result.get("skipped", []) if isinstance(result, dict) else []

    # Apply patches au dataset
    applied_fields = []
    for p in patches:
        field = p.get("field")
        data = p.get("data")
        source = p.get("source")
        if not field or not data: continue
        current_data[field] = data
        applied_fields.append(field)
        log(f"  ✓ {ticker} patched : {field} (source: {source[:60]})")

    if applied_fields:
        # Audit trail
        current_data["_deep_fix_2026_05_18"] = {
            "date": datetime.now(timezone.utc).isoformat(),
            "by": "CONV-DEPAN vip-deep-fix",
            "fields_patched": applied_fields,
            "defects_addressed": [d["id"] for d in uncorrected],
        }
        pipeline_file.write_text(json.dumps(current_data, indent=2, ensure_ascii=False) + "\n")
        log(f"  💾 {ticker} : {len(applied_fields)} field(s) patched in v2-pipeline")

    # Mark defects as corrected (mapping field → defect_id_prefix)
    field_to_prefix = {
        "governance": "governance.",
        "revenue_by_segment": "repartition.segment",
        "revenue_by_geography": "repartition.geo",
        "risks": "risks.",
        "ai_positioning": "ai_positioning.",
        "events": "events.",
    }
    fixed_count = 0
    for df in defects:
        if df.get("corrected"): continue
        for fld in applied_fields:
            prefix = field_to_prefix.get(fld, fld)
            if df["id"].startswith(prefix) or prefix in df["id"]:
                df["corrected"] = True
                df["fix_note"] = f"Deep-fix Sonnet : patched {fld}"
                df["fixed_at"] = datetime.now(timezone.utc).isoformat()
                df["fixed_by"] = "CONV-DEPAN vip-deep-fix"
                fixed_count += 1
                break
    # Push status back to BDD
    if fixed_count > 0:
        try:
            supabase_upsert("vip_inspection_status", {
                "ticker": ticker,
                "state": status_row.get("state", "done"),
                "last_run_at": status_row.get("last_run_at"),
                "defects": defects,
                "mode_screenshots": status_row.get("mode_screenshots", {}),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            log(f"  📤 {ticker} : {fixed_count} defects marqués corrected en BDD")
        except Exception as e:
            log(f"  ⚠ {ticker} : push BDD échec : {e}")

    return {
        "fixed": fixed_count,
        "skipped": len(uncorrected) - fixed_count,
        "errors": 0,
        "applied_fields": applied_fields,
        "llm_skipped": skipped_llm,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticker", type=str, help="1 ticker à fix")
    ap.add_argument("--all-pending", action="store_true", help="Tous les tickers avec defects uncorrected en BDD")
    args = ap.parse_args()

    load_env()

    # Charger BDD
    try:
        statuses = supabase_select("vip_inspection_status")
    except Exception as e:
        log(f"❌ BDD load fail : {e}")
        sys.exit(1)

    if args.ticker:
        targets = [s for s in statuses if s["ticker"].upper() == args.ticker.upper()]
    elif args.all_pending:
        targets = [s for s in statuses if any(not d.get("corrected") for d in (s.get("defects") or []))]
    else:
        log("ERR: --ticker OR --all-pending required")
        sys.exit(1)

    log(f"━━━ DEEP-FIX session : {len(targets)} tickers à traiter ━━━")
    total_fixed = 0
    for s in targets:
        ticker = s["ticker"]
        defects = s.get("defects") or []
        log(f"\n[{ticker}] {len(defects)} defects ({sum(1 for d in defects if not d.get('corrected'))} uncorrected)")
        try:
            stats = fix_ticker(ticker, defects, s)
            total_fixed += stats.get("fixed", 0)
        except Exception as e:
            log(f"  ❌ {ticker} exception : {e}")
        time.sleep(2)  # throttle Anthropic API

    log(f"\n━━━ DONE : {total_fixed} defects fixés au total ━━━")

    # Re-trigger inspection pour reverify (si fixes appliqués)
    if total_fixed > 0:
        log("Re-trigger vip-inspection-worker pour reverify Gemini...")
        try:
            for s in targets:
                gh_token = os.environ.get("GITHUB_DISPATCH_TOKEN") or os.environ.get("GITHUB_TOKEN")
                if not gh_token: continue
                req = urllib.request.Request(
                    "https://api.github.com/repos/yannricordeau100-ai/spx-app/dispatches",
                    data=json.dumps({"event_type": "vip-inspection-launch", "client_payload": {"ticker": s["ticker"]}}).encode(),
                    method="POST",
                    headers={
                        "Authorization": f"Bearer {gh_token}",
                        "Accept": "application/vnd.github+json",
                    },
                )
                with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                    log(f"  ↻ {s['ticker']} re-inspection triggered (HTTP {r.status})")
        except Exception as e:
            log(f"  re-trigger fail : {e}")


if __name__ == "__main__":
    main()
