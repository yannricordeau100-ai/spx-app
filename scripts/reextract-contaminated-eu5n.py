#!/usr/bin/env python3
"""reextract-contaminated-eu5n.py — Re-extraction Cerebras des 39 stés contaminées HPC/Cloud.

CONTEXTE
========
Audit `sec-data/_meta/hpc-cloud-contamination-audit.json` section
`contamination_confirmee` a confirmé 39 stés v2-pipeline avec un faux
hero_kpi "HPC / Cloud" et un faux `sector="Technologie"`. Réelles
sociétés diverses : assurance (ZURN.SW), énergie (BP.L, BKR, EDP.LS, ENLT),
biotech/pharma (EVO, PHIA.AS, GEHC, SHL.DE, GN.CO), industriels (ETN,
JCI, HO.PA, LR.PA, GE, etc.), financier (TKO.PA, CSHR), conso (FMX,
RCO.PA, VIS.MC, AVY), mining (FPHOY), utilities (EDP.LS, ELCPF, ENLT),
waste (VIE.PA, TOM.OL), médias (DIS), shipping (FRO.OL, CISS), oil
services (TGS.OL, BKR, NESTE.HE, RUI.PA).

WORKFLOW
========
1. Lit les drafts `/tmp/eu5n-contamination-fix-drafts/*-spec.md` (générés
   par `_gen_drafts.py` dans le même répertoire).
2. Pour chaque sté :
   - Charge le rapport annuel (source listée dans le draft).
   - Construit le prompt Cerebras adapté secteur (depuis le draft).
   - Appelle Cerebras qwen-3-235b-a22b-instruct-2507 (free tier, 3 clés
     rotation via env CEREBRAS_API_KEY_0/1/2).
   - Parse la réponse JSON.
   - Écrit le draft KPIs dans `/tmp/eu5n-reextraction-results/<TICKER>.json`.
3. NE TOUCHE PAS à `src/data/v2-pipeline/<t>.json` ni à
   `src/data/v2-pipeline-enrich/<t>.json` (règle §0nonies Mettrik AI).

MODES
=====
`--dry-run` (DÉFAUT) : affiche les prompts qui seraient envoyés sans
appeler Cerebras, vérifie la dispo des sources, et écrit `_dryrun.json`
récapitulatif. Aucun coût.

`--apply` : exécute pour de vrai (nécessite passage explicite).

CONTRAINTES
===========
- Max 2 procs Python parallèles (Mac fragile, cf SHARED-STATUS §6).
- Budget 0 € (Cerebras free tier uniquement).
- Anti-invention strict : si la réponse Cerebras contient un KPI
  technologie / cloud / HPC → REJET du fichier complet et flag.
- Pas d'écriture SHARED-STATUS.md.
- NE PAS LANCER sans Yann (mode --dry-run par défaut, --apply requis).

USAGE
=====
    # Dry-run (validation des sources + prompts)
    python3 scripts/reextract-contaminated-eu5n.py --dry-run

    # Vraie exécution (après go Yann)
    CEREBRAS_API_KEY_0=... python3 scripts/reextract-contaminated-eu5n.py --apply

    # Sous-ensemble
    python3 scripts/reextract-contaminated-eu5n.py --tickers ZURN.SW,BP.L --apply
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi  # noqa: F401
    import ssl as _ssl
    SSL_CTX = _ssl.create_default_context(cafile=__import__("certifi").where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DRAFT_DIR = Path("/tmp/eu5n-contamination-fix-drafts")
RESULT_DIR = Path("/tmp/eu5n-reextraction-results")
INDEX_PATH = DRAFT_DIR / "_INDEX.json"
SEC_ROOT = PROJECT_ROOT / "sec-data"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 4.0
CTX_MAX_CHARS = 22000

# KPIs technologie interdits (anti-récidive)
FORBIDDEN_TECH_KPIS = {
    "hpc", "cloud", "hpc / cloud", "service / arr", "cloud revenue",
    "gross margin tech", "data center revenue", "bookings tech",
    "r&d %", "saas", "subscription revenue", "arr",
}


def load_filing(source: dict, ticker: str) -> str | None:
    """Charge le texte du filing depuis le path indiqué dans la source draft."""
    if source["kind"] == "MISSING":
        return None

    src_dir = PROJECT_ROOT / source["dir"]
    fname = source["latest"]
    fp = src_dir / fname

    if not fp.exists():
        return None

    try:
        if fname.endswith(".gz"):
            with gzip.open(fp, "rt", errors="replace") as fh:
                html = fh.read()
            # strip HTML tags rapidement
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text)
            return text
        else:
            return fp.read_text(errors="replace")
    except Exception as exc:  # noqa: BLE001
        print(f"  ⚠️  {ticker}: erreur lecture {fp}: {exc}", file=sys.stderr)
        return None


def extract_kpi_sections(text: str, max_chars: int) -> str:
    """Concatène les sections les plus pertinentes pour extraction KPIs."""
    # priorité : MDA / Item 7 / Segment information / Financial highlights
    # heuristique simple : chercher mots-clés et prendre window
    lower = text.lower()
    snippets: list[str] = []

    anchors = [
        "management's discussion and analysis",
        "item 7",
        "segment information",
        "reportable segment",
        "operating segment",
        "financial highlights",
        "key performance",
        "consolidated statements of operations",
        "results of operations",
        "key figures",
        "key indicators",
    ]

    for anchor in anchors:
        idx = lower.find(anchor)
        if idx >= 0:
            window = text[max(0, idx - 200): idx + 8000]
            snippets.append(window)
            if sum(len(s) for s in snippets) >= max_chars:
                break

    if not snippets:
        # fallback : début du document
        return text[:max_chars]

    out = "\n\n---\n\n".join(snippets)
    return out[:max_chars]


def build_cerebras_payload(prompt: str, filing_text: str) -> dict:
    """Insère le texte du filing dans le prompt préparé."""
    final = prompt.replace("<INSÉRER LE TEXTE DU FILING ICI>", filing_text)
    return {
        "model": MODEL_ID,
        "max_completion_tokens": 4000,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Tu es un analyste financier. Réponds STRICTEMENT en JSON valide."},
            {"role": "user", "content": final},
        ],
    }


def call_cerebras(payload: dict, api_key: str, retries: int = 3) -> dict | None:
    """Call Cerebras avec retry exponentiel."""
    req_body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(retries):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=req_body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as resp:
                data = json.loads(resp.read())
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
        except urllib.error.HTTPError as exc:
            wait = 5.0 * (attempt + 1)
            print(f"  ⚠️  HTTPError {exc.code} attempt {attempt+1}/{retries}, wait {wait}s", file=sys.stderr)
            time.sleep(wait)
        except Exception as exc:  # noqa: BLE001
            wait = 5.0 * (attempt + 1)
            print(f"  ⚠️  Exception {exc} attempt {attempt+1}/{retries}, wait {wait}s", file=sys.stderr)
            time.sleep(wait)
    return None


def has_forbidden_tech_kpi(parsed: dict) -> tuple[bool, list[str]]:
    """Vérifie qu'aucun KPI technologie ne s'est glissé dans la réponse."""
    found: list[str] = []
    hero = (parsed.get("hero_kpi") or "").lower().strip()
    if hero in FORBIDDEN_TECH_KPIS:
        found.append(f"hero={hero}")
    for kpi in parsed.get("kpis", []) or []:
        short = (kpi.get("short") or "").lower().strip()
        name_fr = (kpi.get("name_fr") or "").lower().strip()
        if short in FORBIDDEN_TECH_KPIS:
            found.append(f"short={short}")
        if any(k in name_fr for k in ("hpc", "cloud computing", "saas", "arr")):
            found.append(f"name_fr={name_fr}")
    return (bool(found), found)


def extract_prompt_from_draft(draft_md: str) -> str:
    """Extrait le bloc prompt Cerebras depuis le draft .md."""
    m = re.search(
        r"## Prompt Cerebras suggéré\s*\n\s*```\s*\n(.*?)\n```",
        draft_md,
        re.DOTALL,
    )
    if not m:
        raise ValueError("prompt block introuvable dans le draft")
    return m.group(1).strip()


def process_one(ticker: str, draft_entry: dict, dry_run: bool, api_key: str | None) -> dict:
    """Traite une sté."""
    result: dict = {
        "ticker": ticker,
        "status": "pending",
        "dry_run": dry_run,
        "started_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
    }

    draft_path = DRAFT_DIR / f"{ticker}-spec.md"
    if not draft_path.exists():
        result["status"] = "draft_missing"
        return result

    try:
        prompt = extract_prompt_from_draft(draft_path.read_text())
    except Exception as exc:  # noqa: BLE001
        result["status"] = "prompt_parse_error"
        result["error"] = str(exc)
        return result

    source = draft_entry["source"]
    filing_text = load_filing(source, ticker)

    if filing_text is None:
        result["status"] = "source_unavailable"
        result["source"] = source
        return result

    sections = extract_kpi_sections(filing_text, CTX_MAX_CHARS)
    result["source"] = source
    result["filing_chars_loaded"] = len(filing_text)
    result["sections_chars_for_llm"] = len(sections)
    result["prompt_preview"] = prompt[:500] + ("…" if len(prompt) > 500 else "")

    if dry_run:
        result["status"] = "dry_run_ok"
        result["template_key"] = draft_entry["template_key"]
        result["needs_rescrape_first"] = draft_entry["needs_rescrape_first"]
        return result

    # apply mode
    if not api_key:
        result["status"] = "no_api_key"
        return result

    payload = build_cerebras_payload(prompt, sections)
    parsed = call_cerebras(payload, api_key)

    if parsed is None:
        result["status"] = "cerebras_fail"
        return result

    has_forbid, forbid_items = has_forbidden_tech_kpi(parsed)
    if has_forbid:
        result["status"] = "rejected_tech_contamination"
        result["forbidden_items"] = forbid_items
        result["raw_response"] = parsed
        return result

    out_path = RESULT_DIR / f"{ticker}.json"
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    out_obj = {
        "ticker": ticker,
        "real_name": draft_entry["real_name"],
        "real_sector": draft_entry["real_sector"],
        "real_industry": draft_entry["real_industry"],
        "template_key": draft_entry["template_key"],
        "extracted_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "source_used": source,
        "cerebras_model": MODEL_ID,
        "extraction": parsed,
        "_validation_yann_required": True,
        "_note": "DRAFT — ne pas écrire dans src/data/v2-pipeline/ sans validation Yann (règle §0nonies).",
    }
    out_path.write_text(json.dumps(out_obj, indent=2, ensure_ascii=False))

    result["status"] = "ok"
    result["output_path"] = str(out_path)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", default=True, help="Mode dry-run (défaut)")
    parser.add_argument("--apply", action="store_true", help="Vraie exécution (override dry-run)")
    parser.add_argument("--tickers", type=str, default="", help="Sous-ensemble de tickers, comma-separated")
    parser.add_argument("--key-index", type=int, default=0, help="Index clé Cerebras (0, 1, 2)")
    args = parser.parse_args()

    dry_run = not args.apply

    if not INDEX_PATH.exists():
        print(f"❌ INDEX_PATH manquant : {INDEX_PATH}", file=sys.stderr)
        print("   Lance d'abord : python3 /tmp/eu5n-contamination-fix-drafts/_gen_drafts.py", file=sys.stderr)
        return 1

    index = json.loads(INDEX_PATH.read_text())
    drafts = index["drafts"]

    if args.tickers:
        wanted = {t.strip() for t in args.tickers.split(",") if t.strip()}
        drafts = [d for d in drafts if d["ticker"] in wanted]

    api_key = os.environ.get(f"CEREBRAS_API_KEY_{args.key_index}")
    if not api_key and not dry_run:
        print(f"❌ CEREBRAS_API_KEY_{args.key_index} manquant en env (mode --apply)", file=sys.stderr)
        return 1

    mode = "DRY-RUN" if dry_run else f"APPLY (key idx {args.key_index})"
    print(f"🚀 Mode : {mode}")
    print(f"   {len(drafts)} stés à traiter")
    print(f"   Output dir : {RESULT_DIR}")
    print()

    results: list[dict] = []
    for idx, draft in enumerate(drafts, 1):
        ticker = draft["ticker"]
        print(f"[{idx:2d}/{len(drafts)}] {ticker:10s} ({draft['template_key']:30s})", end=" ", flush=True)
        try:
            res = process_one(ticker, draft, dry_run, api_key)
        except Exception as exc:  # noqa: BLE001
            res = {"ticker": ticker, "status": "exception", "error": str(exc)}
        print(f"→ {res['status']}")
        results.append(res)
        if not dry_run:
            time.sleep(SLEEP_BETWEEN_CALLS)

    # summary
    counts: dict[str, int] = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print()
    print("✅ Bilan :")
    for status, count in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"   - {status}: {count}")

    out_summary = RESULT_DIR / ("_dryrun.json" if dry_run else "_apply.json")
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    out_summary.write_text(json.dumps({
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "total": len(results),
        "status_counts": counts,
        "results": results,
    }, indent=2, ensure_ascii=False))
    print(f"📄 Récap : {out_summary}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
