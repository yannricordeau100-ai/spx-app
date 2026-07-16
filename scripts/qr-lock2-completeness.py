#!/usr/bin/env python3
"""
VERROU 2 — Porte de complétude (go Yann 16 juil 2026).

Pour chaque sté rafraîchie : vérifie que 100 % du travail est fait.
  a) CHAQUE KPI trimestriel existant (v2-pipeline, enrich, quarterly-history)
     porte un point pour la période du nouveau dépôt (ou est explicitement
     marqué _discontinued_disclosure / _unfixable) ;
  b) aucun bloc texte de la sté n'est en attente dans la todo LLM ;
  c) le verrou 1 (double extraction) est OK (pas de MISMATCH).

Sortie : .conv-state/qr-lock2-result.json
  { "<TICKER>": { "status": "COMPLETE|INCOMPLETE",
                  "kpi_total": N, "kpi_a_jour": N,
                  "kpi_manquants": [ {file, short, dernier_point} ],
                  "todo_llm": [flags], "lock1": "OK|MISMATCH|UNVERIFIABLE" } }
"""
from __future__ import annotations
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
RESULT_IN = ROOT / ".conv-state/quarterly-refresh-run-result.json"
LOCK1 = ROOT / ".conv-state/qr-lock1-result.json"
TODO = ROOT / ".conv-state/quarterly-refresh-todo-llm.json"
OUT = ROOT / ".conv-state/qr-lock2-result.json"


def log(msg: str) -> None:
    print(f"[lock2] {msg}", flush=True)


def load(p: Path):
    try:
        return json.loads(p.read_text("utf8"))
    except Exception:
        return None


def period_key(p: str) -> tuple[int, int] | None:
    """'Q1 2026' / 'Q1-FY2026' -> (fy, q) comparable."""
    import re
    m = re.match(r"^Q([1-4])[\s-]+(?:FY)?(\d{4})$", str(p).strip())
    if not m:
        return None
    return (int(m.group(2)), int(m.group(1)))


def check_ticker(ticker: str, filing_period_end: str | None) -> dict:
    base = ticker.lower()
    files = [
        ROOT / f"src/data/v2-pipeline/{base}.json",
        ROOT / f"src/data/v2-pipeline/{base.replace('.', '-')}.json",
        ROOT / f"src/data/v2-pipeline-enrich/{base}.json",
        ROOT / f"src/data/v2-pipeline-enrich/{base}.quarterly-history.json",
    ]
    total, ok = 0, 0
    missing: list[dict] = []
    seen_files: set[str] = set()

    # Fenêtre d'acceptation : le dernier point doit finir à moins de ~100 j
    # du period_end du dépôt (couvre les fiscaux décalés et les 52/53 sem.)
    cutoff = None
    if filing_period_end:
        try:
            cutoff = datetime.fromisoformat(filing_period_end) - timedelta(days=100)
        except ValueError:
            cutoff = None

    for f in files:
        if not f.exists() or str(f) in seen_files:
            continue
        seen_files.add(str(f))
        d = load(f)
        if not d:
            continue
        for k in d.get("kpis", []):
            if k.get("period_type") != "quarter":
                continue
            if k.get("story_category") or k.get("is_short_history"):
                continue  # stories : couvertes par la todo LLM, pas par ce verrou
            total += 1
            if k.get("_discontinued_disclosure") or k.get("_unfixable"):
                ok += 1
                continue
            ldd = k.get("last_data_date") or ""
            fresh = False
            if cutoff is not None and ldd:
                try:
                    fresh = datetime.fromisoformat(ldd.split("T")[0]) >= cutoff
                except ValueError:
                    fresh = False
            elif ldd:
                fresh = True  # pas de période de dépôt connue : non bloquant
            if fresh:
                ok += 1
            else:
                missing.append({
                    "file": f.name,
                    "short": k.get("short"),
                    "dernier_point": ldd or (k.get("history_periods") or ["?"])[-1],
                })

    todo = (load(TODO) or {}).get("todo", {})
    todo_flags = list((todo.get(ticker) or {}).get("flags") or [])
    lock1 = (load(LOCK1) or {}).get(ticker, {}).get("status", "UNVERIFIABLE")

    complete = not missing and not todo_flags and lock1 != "MISMATCH"
    return {
        "status": "COMPLETE" if complete else "INCOMPLETE",
        "kpi_total": total,
        "kpi_a_jour": ok,
        "kpi_manquants": missing,
        "todo_llm": todo_flags,
        "lock1": lock1,
    }


def main() -> int:
    run = load(RESULT_IN) or {"results": []}
    out: dict[str, dict] = {}
    for r in run.get("results", []):
        t = r["ticker"]
        # période du dépôt le plus récent traité par le run
        pe = None
        for f in r.get("filings_downloaded", []) or []:
            if isinstance(f, dict):
                cand = str(f.get("period_end") or f.get("filing_date") or "")
            else:
                # chemin de fichier "data-lake/T/10Q/T_2026-05-01.htm.gz"
                import re as _re
                m = _re.search(r"(\d{4}-\d{2}-\d{2})", str(f))
                # date de DÉPÔT ≈ period_end + ~35 j : on recule d'un mois.
                cand = ""
                if m:
                    from datetime import datetime as _dt, timedelta as _td
                    cand = (_dt.fromisoformat(m.group(1)) - _td(days=35)).date().isoformat()
            pe = max(pe or "", cand)
        out[t] = check_ticker(t, pe or None)
        st = out[t]
        log(f"{t}: {st['status']} ({st['kpi_a_jour']}/{st['kpi_total']} KPI à jour, "
            f"{len(st['kpi_manquants'])} manquants, todo={st['todo_llm']}, lock1={st['lock1']})")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    log(f"résultat écrit: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
