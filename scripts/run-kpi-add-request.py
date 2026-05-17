#!/usr/bin/env python3
"""run-kpi-add-request.py — worker pour la file `desk_kpi_requests` Supabase.

Lit les demandes pending depuis Supabase, traite ticker par ticker via LLM
(Cerebras Qwen-3 235B free par défaut, fallback Anthropic Haiku),
agrège les résultats dans la colonne JSONB `results`. NE TOUCHE PAS aux
fichiers v2-pipeline/ : l'écriture vers les datasets se fait après
validation manuelle Yann depuis le desk admin.

Usage :
    python3 scripts/run-kpi-add-request.py [--once] [--request-id <uuid>]

Variables d'env requises :
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    CEREBRAS_API_KEY   (ou ANTHROPIC_API_KEY si Haiku fallback)

Contraintes de ressources (cf RULES-GOLDEN.md §6 + SHARED-STATUS.md §14) :
    - 1 SEUL proc à la fois entre toutes les convs Mettrik
    - sleep 4s entre tickers (rate limit Cerebras free)
    - Pas de parallélisme intra-script
    - Si RAM système < 200 MB free → exit immédiat avec log

Skeleton = squelette. La logique d'extraction LLM réelle (parsing source,
prompt builder par catégorie cat1/2/3/4, fallback) est marquée TODO.
"""

from __future__ import annotations

import argparse
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
from typing import Any

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SEC_DATA = PROJECT_ROOT / "sec-data"  # symlink vers ~/Mettrik/sec-data
CAT1_DIR = SEC_DATA / "cat1-us"
CAT2_DIR = SEC_DATA / "cat2-foreign-adr"
CAT3_DIR = SEC_DATA / "cat3-european"

SLEEP_BETWEEN_TICKERS = 4.0  # sec, rate-limit Cerebras free

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5"  # fallback rapide


# ---------------------------------------------------------------------------
# Supabase HTTP client (utilise PostgREST + service_role pour bypass RLS)
# ---------------------------------------------------------------------------

def _supabase_headers() -> dict[str, str]:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY manquante")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supabase_url(table: str, query: str = "") -> str:
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not base:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL manquante")
    return f"{base.rstrip('/')}/rest/v1/{table}{query}"


def fetch_pending_requests(request_id: str | None = None) -> list[dict[str, Any]]:
    """Charge les demandes pending (ou une seule par id si fourni)."""
    if request_id:
        url = _supabase_url(
            "desk_kpi_requests",
            f"?id=eq.{request_id}&select=*",
        )
    else:
        url = _supabase_url(
            "desk_kpi_requests",
            "?status=eq.pending&select=*&order=created_at.asc&limit=10",
        )
    req = urllib.request.Request(url, headers=_supabase_headers(), method="GET")
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def patch_request(request_id: str, updates: dict[str, Any]) -> None:
    """PATCH une demande (status, progress_done, results, error_message)."""
    url = _supabase_url("desk_kpi_requests", f"?id=eq.{request_id}")
    body = json.dumps(updates).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers=_supabase_headers(),
        method="PATCH",
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
        resp.read()


# ---------------------------------------------------------------------------
# Détection catégorie (cat1/cat2/cat3) + chargement docs locaux
# ---------------------------------------------------------------------------

def detect_category(ticker: str) -> str:
    """Heuristique : suffixe .XX → cat3 EU ; pas de suffixe + dossier cat1 → cat1 ;
    sinon cat2 ADR. À affiner si nécessaire."""
    t = ticker.upper()
    if "." in t:
        # cat3 (EU) ou cat ADR avec suffixe ex .L .PA .SW
        return "cat3"
    if (CAT1_DIR / t).exists():
        return "cat1"
    if (CAT2_DIR / t).exists():
        return "cat2"
    return "cat1"  # défaut


def load_docs_for_ticker(ticker: str, max_chars: int = 25000) -> str:
    """Charge les docs locaux concaténés pour un ticker (best effort).

    TODO : améliorer le picking (10-K dernier en date, ER trimestriels,
    pondération sources). Pour le skeleton on prend le 1er fichier texte
    disponible.
    """
    t = ticker.upper()
    cat = detect_category(t)
    candidates: list[Path] = []
    if cat == "cat1":
        d = CAT1_DIR / t
        if d.is_dir():
            candidates.extend(sorted(d.rglob("*.txt"), reverse=True))
            candidates.extend(sorted(d.rglob("*.htm.gz"), reverse=True))
    elif cat == "cat2":
        d = CAT2_DIR / t
        if d.is_dir():
            candidates.extend(sorted(d.rglob("*.txt"), reverse=True))
    elif cat == "cat3":
        d = CAT3_DIR / t
        if d.is_dir():
            annual = d / "annual-text"
            if annual.is_dir():
                candidates.extend(sorted(annual.glob("*.txt"), reverse=True))

    chunks: list[str] = []
    total = 0
    for p in candidates[:3]:
        try:
            if p.suffix == ".gz":
                import gzip
                with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as fh:
                    txt = fh.read()
            else:
                txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # Strip HTML basique si .htm
        if ".htm" in p.suffixes or ".html" in p.suffixes:
            txt = re.sub(r"<[^>]+>", " ", txt)
            txt = re.sub(r"\s+", " ", txt)
        remaining = max_chars - total
        if remaining <= 0:
            break
        chunks.append(txt[:remaining])
        total += min(len(txt), remaining)
    return "\n\n---\n\n".join(chunks)


# ---------------------------------------------------------------------------
# Appel LLM (Cerebras free par défaut)
# ---------------------------------------------------------------------------

def call_cerebras(prompt: str, max_tokens: int = 1500) -> str:
    api_key = os.environ.get("CEREBRAS_API_KEY")
    if not api_key:
        raise RuntimeError("CEREBRAS_API_KEY manquante")
    body = json.dumps({
        "model": CEREBRAS_MODEL,
        "messages": [
            {"role": "system", "content": "Tu es un extracteur de KPIs financiers strict. Réponses en JSON pur."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(
        CEREBRAS_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mettrik-KPI-Worker/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def call_anthropic_haiku(prompt: str, max_tokens: int = 1500) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY manquante (fallback Haiku)")
    body = json.dumps({
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["content"][0]["text"]


def parse_llm_json(content: str) -> dict[str, Any]:
    """Extrait le JSON d'une réponse LLM (avec ou sans fence ```json)."""
    m = re.search(r"```json\s*([\s\S]*?)\s*```", content)
    raw = m.group(1) if m else content.strip()
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Extraction par ticker
# ---------------------------------------------------------------------------

def build_extraction_prompt(req: dict[str, Any], ticker: str, docs: str) -> str:
    """Compose le prompt LLM final à partir du extraction_prompt user-defined."""
    return f"""Société : {ticker}

Demande : {req['description']}

KPI à extraire : {req['kpi_short']} ({req['kpi_name_en']})
Unité attendue : {req['kpi_expected_unit']}
Type : {req['kpi_type']}

Consignes user :
{req['extraction_prompt']}

Réponds en JSON pur (rien d'autre, pas de markdown) au format :
{{
  "value": <number ou null si non trouvé>,
  "unit": "<unité réelle trouvée>",
  "year": "<année ou période>",
  "history": [<valeurs annuelles si disponibles, sinon []>],
  "source": "<doc + page/section où la valeur a été trouvée>"
}}

Si la valeur n'est PAS trouvée explicitement dans les sources : renvoie value=null.
NE JAMAIS inventer. NE JAMAIS extrapoler.

Sources (extraits des docs locaux pour {ticker}) :
{docs[:20000]}
"""


def process_ticker(req: dict[str, Any], ticker: str) -> dict[str, Any]:
    """Extrait le KPI demandé pour un ticker. Renvoie un KpiRequestResult."""
    result: dict[str, Any] = {
        "ticker": ticker,
        "value": None,
        "unit": None,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        docs = load_docs_for_ticker(ticker)
        if not docs:
            result["error"] = "no local docs found"
            return result
        prompt = build_extraction_prompt(req, ticker, docs)
        try:
            raw = call_cerebras(prompt)
        except Exception as e_cerebras:
            # Fallback Haiku si dispo
            if os.environ.get("ANTHROPIC_API_KEY"):
                raw = call_anthropic_haiku(prompt)
            else:
                raise e_cerebras
        parsed = parse_llm_json(raw)
        result.update({
            "value": parsed.get("value"),
            "unit": parsed.get("unit"),
            "year": parsed.get("year"),
            "history": parsed.get("history") or [],
            "source": parsed.get("source"),
        })
        # Flag is_short_history si history < 5 ans + fallback_story=true
        hist = result.get("history") or []
        if (
            req.get("fallback_story")
            and isinstance(hist, list)
            and 0 < len(hist) < 5
        ):
            result["is_short_history"] = True
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
    return result


def process_request(req: dict[str, Any]) -> None:
    request_id = req["id"]
    tickers: list[str] = req.get("tickers") or []
    print(f"[run-kpi] processing request {request_id} · {len(tickers)} tickers")
    patch_request(request_id, {"status": "processing", "error_message": None})

    existing_results = req.get("results") or []
    done_set = {r.get("ticker") for r in existing_results if r.get("ticker")}

    for i, ticker in enumerate(tickers):
        # Re-check status à chaque ticker pour permettre cancel à chaud
        try:
            current = fetch_pending_requests(request_id=request_id)
            if current and current[0].get("status") == "canceled":
                print(f"[run-kpi] {request_id} canceled mid-run, stop.")
                return
        except Exception:
            pass

        if ticker in done_set:
            print(f"[run-kpi]   [{i+1}/{len(tickers)}] {ticker} déjà traité, skip")
            continue
        print(f"[run-kpi]   [{i+1}/{len(tickers)}] {ticker}")
        res = process_ticker(req, ticker)
        existing_results.append(res)
        patch_request(request_id, {
            "results": existing_results,
            "progress_done": len(existing_results),
        })
        time.sleep(SLEEP_BETWEEN_TICKERS)

    patch_request(request_id, {"status": "done"})
    print(f"[run-kpi] request {request_id} done")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true",
                        help="Traite uniquement la 1ère demande pending puis exit")
    parser.add_argument("--request-id", default=None,
                        help="Traite une demande précise par id (force re-run)")
    args = parser.parse_args()

    try:
        pending = fetch_pending_requests(request_id=args.request_id)
    except Exception as e:
        print(f"[run-kpi] erreur fetch pending : {e}", file=sys.stderr)
        return 1

    if not pending:
        print("[run-kpi] aucune demande pending")
        return 0

    for req in pending:
        try:
            process_request(req)
        except Exception as e:
            print(f"[run-kpi] erreur process_request : {e}", file=sys.stderr)
            try:
                patch_request(req["id"], {
                    "status": "error",
                    "error_message": f"{type(e).__name__}: {e}",
                })
            except Exception:
                pass
        if args.once:
            break

    return 0


if __name__ == "__main__":
    sys.exit(main())
