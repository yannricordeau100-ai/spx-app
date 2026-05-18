#!/usr/bin/env python3
"""
Image Findings Autorun — worker autonome déclenché par GitHub Action.

Usage:
    python3 scripts/image-findings-autorun.py --request-id <UUID>
    python3 scripts/image-findings-autorun.py --all-pending

Yann 18 mai 2026 : squelette POC. Insert un finding bidon "AUTORUN POC"
pour valider la chaîne complète (webhook → GitHub Action → Python →
Supabase update + insert). Le scraping intelligent réel des 9 sources
(web, x_anon, x_authed, reddit, substack, ddg_images, huggingface,
company_docs, high_rep) sera fait en V2.

Env vars requises :
    SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY
    GEMINI_API_KEY (free tier 1500/jour, pour scraping intelligent V2)
    ANTHROPIC_API_KEY (fallback)
"""
import argparse
import json
import os
import sys
import traceback
from datetime import datetime, timezone

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERREUR: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis", file=sys.stderr)
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# Les 9 sources canoniques (cf IMAGE-FINDINGS-PROCESS.md)
SOURCES = [
    "web",
    "x_anon",
    "x_authed",  # nécessite Chrome MCP → skip en autorun, marker manual_pending
    "reddit",
    "substack",
    "ddg_images",
    "huggingface",
    "company_docs",
    "high_rep",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_pending_requests() -> list:
    """Récupère toutes les demandes status='claude_pending'."""
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {
        "select": "id,display_number,title,query,target_tickers,languages,status",
        "status": "eq.claude_pending",
        "order": "display_number.asc",
    }
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_request_by_id(request_id: str) -> dict | None:
    """Récupère une demande spécifique par UUID."""
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {
        "select": "id,display_number,title,query,target_tickers,languages,status",
        "id": f"eq.{request_id}",
    }
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def update_request(request_id: str, patch: dict) -> None:
    """PATCH une demande (status, error_msg, etc.)."""
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {"id": f"eq.{request_id}"}
    r = requests.patch(url, headers=HEADERS, params=params, json=patch, timeout=30)
    if not r.ok:
        print(f"[warn] update request {request_id} fail: HTTP {r.status_code} {r.text[:200]}", file=sys.stderr)


def insert_finding(finding: dict) -> bool:
    """Insert un finding dans desk_image_findings."""
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings"
    r = requests.post(url, headers=HEADERS, json=finding, timeout=30)
    if not r.ok:
        print(f"[warn] insert finding fail: HTTP {r.status_code} {r.text[:200]}", file=sys.stderr)
        return False
    return True


def process_request(req: dict) -> dict:
    """
    Traite une demande : update status in_progress → scrape les 9 sources →
    insert findings → update status pending_review.

    POC actuel : insert 1 finding bidon "AUTORUN POC" pour valider la chaîne.
    V2 : vrai scraping intelligent (Gemini 2.5 Flash + BeautifulSoup).
    """
    request_id = req["id"]
    query = req.get("query", "")
    target_tickers = req.get("target_tickers", []) or []
    languages = req.get("languages", ["en"]) or ["en"]
    display_n = req.get("display_number", "?")

    print(f"=== Demande #{display_n} ({request_id[:8]}) : {query[:80]}")
    print(f"    Tickers: {target_tickers} | Langues: {languages}")

    # 1. Mark in_progress
    update_request(request_id, {
        "status": "in_progress",
        "error_msg": None,
        "updated_at": now_iso(),
    })

    inserted = 0
    skipped = 0
    errors = []

    try:
        # POC : insert 1 finding "AUTORUN POC" pour valider la chaîne.
        # V2 : remplacer par vrai scraping des 9 sources avec Gemini Flash.
        for source in SOURCES:
            if source == "x_authed":
                # Nécessite Chrome MCP authentifié, pas dispo dans GHA → skip
                print(f"    [{source}] skip (requiert Chrome MCP authentifié, manual_pending)")
                skipped += 1
                continue

            # TODO V2 : scraping réel via requests/BeautifulSoup + filtrage
            # Gemini 2.5 Flash pour décider quelles images sont pertinentes.
            # Pour l'instant : on log juste.
            print(f"    [{source}] TODO V2 : scraping réel + filtrage Gemini Flash")

        # POC : 1 finding bidon pour valider que l'insertion BDD marche
        poc_finding = {
            "request_id": request_id,
            "target_tickers": target_tickers,
            "languages": languages,
            "source_url": "https://example.com/autorun-poc",
            "source_author": "Autorun POC",
            "source_handle": None,
            "source_date": None,
            "source_platform": "autorun_poc",
            "image_url": "https://example.com/poc.png",
            "image_local_path": None,
            "title": "AUTORUN POC",
            "caption": "Finding POC inséré par image-findings-autorun.py — à supprimer après validation chaîne",
            "summary": "Squelette autorun fonctionne. V2 : remplacer par vrai scraping multi-source.",
            "title_i18n": {"en": "AUTORUN POC", "fr": "POC AUTORUN", "de": "AUTORUN POC"},
            "summary_i18n": {
                "en": "Autorun pipeline works. V2: replace with real multi-source scraping.",
                "fr": "Le pipeline autorun fonctionne. V2 : remplacer par vrai scraping multi-source.",
                "de": "Autorun-Pipeline funktioniert. V2: durch echtes Multi-Source-Scraping ersetzen.",
            },
            "detected_kpi_topics": [],
            "approved": False,
            "rejected": False,
            "show_summary": True,
            "display_order": 0,
        }
        if insert_finding(poc_finding):
            inserted += 1

    except Exception as e:
        errors.append(f"{type(e).__name__}: {str(e)[:200]}")
        traceback.print_exc()

    # 2. Final status
    if errors:
        update_request(request_id, {
            "status": "error",
            "error_msg": " | ".join(errors)[:500],
            "updated_at": now_iso(),
        })
        print(f"    → status=error, {inserted} inséré(s), {len(errors)} erreur(s)")
    else:
        update_request(request_id, {
            "status": "pending_review",
            "error_msg": None,
            "updated_at": now_iso(),
        })
        print(f"    → status=pending_review, {inserted} inséré(s), {skipped} skip")

    return {
        "request_id": request_id,
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request-id", help="UUID demande spécifique")
    parser.add_argument("--all-pending", action="store_true", help="Traite tous les claude_pending")
    args = parser.parse_args()

    if not args.request_id and not args.all_pending:
        print("ERREUR: --request-id ou --all-pending requis", file=sys.stderr)
        sys.exit(2)

    requests_to_process = []

    if args.request_id:
        req = fetch_request_by_id(args.request_id)
        if not req:
            print(f"Demande {args.request_id} introuvable", file=sys.stderr)
            sys.exit(0)
        # On traite même si pas en claude_pending (workflow_dispatch manuel)
        requests_to_process = [req]
    else:
        requests_to_process = fetch_pending_requests()

    if not requests_to_process:
        print("Aucune demande à traiter. Exit.")
        return

    print(f"=== {len(requests_to_process)} demande(s) à traiter ===\n")

    total_inserted = 0
    total_errors = 0
    for req in requests_to_process:
        result = process_request(req)
        total_inserted += result["inserted"]
        if result["errors"]:
            total_errors += 1

    print(f"\n=== Fin : {total_inserted} finding(s) inséré(s), {total_errors} demande(s) en erreur ===")


if __name__ == "__main__":
    main()
