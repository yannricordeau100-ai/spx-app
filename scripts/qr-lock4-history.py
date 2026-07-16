#!/usr/bin/env python3
"""
VERROU 4 — Historique des runs (go Yann 16 juil 2026).

Agrège le résultat complet d'un run (détection, extraction, verrou 1 double
extraction, verrou 2 complétude, verrou 3 audit rendu) dans
src/data/_quarterly-refresh-history.json (affiché dans /sandbox/refresh-status).
Conserve les 120 derniers runs. Statut global par sté :
  PUBLIABLE  = lock1 OK + lock2 COMPLETE + audit sans bloquant
  BLOQUÉE    = sinon (avec les raisons)
"""
from __future__ import annotations
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
HIST = ROOT / "src/data/_quarterly-refresh-history.json"


def load(p: Path):
    try:
        return json.loads(p.read_text("utf8"))
    except Exception:
        return None


def main() -> int:
    run = load(ROOT / ".conv-state/quarterly-refresh-run-result.json") or {"results": []}
    lock1 = load(ROOT / ".conv-state/qr-lock1-result.json") or {}
    lock2 = load(ROOT / ".conv-state/qr-lock2-result.json") or {}
    audit = load(ROOT / ".conv-state/audit-pages-report.json") or {}
    detected = load(ROOT / ".conv-state/quarterly-refresh-detected.json") or {}

    stes = {}
    for r in run.get("results", []):
        t = r["ticker"]
        l1 = lock1.get(t, {})
        l2 = lock2.get(t, {})
        a = audit.get(t) if isinstance(audit, dict) else None
        audit_issues = []
        if isinstance(a, list):
            audit_issues = a
        elif isinstance(a, dict):
            audit_issues = a.get("issues", []) or []
        raisons = []
        if l1.get("status") == "MISMATCH":
            raisons.append(f"verrou1: {len(l1.get('mismatches', []))} écart(s) entre companyfacts et le document")
        if l2.get("status") == "INCOMPLETE":
            if l2.get("kpi_manquants"):
                raisons.append(f"verrou2: {len(l2['kpi_manquants'])} KPI sans nouveau point")
            if l2.get("todo_llm"):
                raisons.append(f"verrou2: blocs texte en attente {l2['todo_llm']}")
        if audit_issues:
            raisons.append(f"verrou3: {len(audit_issues)} problème(s) d'audit de page")
        stes[t] = {
            "statut": "PUBLIABLE" if not raisons else "BLOQUÉE",
            "raisons": raisons,
            "filings": r.get("filings_downloaded", []),
            "kpi_maj": (r.get("blocks_auto", {}) or {}).get("kpi_updated", []),
            "lock1": {"status": l1.get("status"), "ok": l1.get("ok"), "checked": l1.get("checked")},
            "lock2": {"status": l2.get("status"), "kpi_a_jour": l2.get("kpi_a_jour"),
                      "kpi_total": l2.get("kpi_total")},
            "audit_issues": len(audit_issues),
        }

    entry = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "detectees": len((detected or {}).get("detected", []) or []),
        "traitees": len(stes),
        "publiables": sum(1 for s in stes.values() if s["statut"] == "PUBLIABLE"),
        "bloquees": sum(1 for s in stes.values() if s["statut"] == "BLOQUÉE"),
        "stes": stes,
    }

    hist = load(HIST) or {"_doc": "Historique des runs du cron quarterly-refresh (verrou 4). "
                                  "Affiché dans /sandbox/refresh-status.", "runs": []}
    hist["runs"] = ([entry] + hist.get("runs", []))[:120]
    HIST.write_text(json.dumps(hist, ensure_ascii=False, indent=2))
    print(f"[lock4] run archivé: {entry['traitees']} sté(s), "
          f"{entry['publiables']} publiable(s), {entry['bloquees']} bloquée(s) → {HIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
