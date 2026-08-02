#!/usr/bin/env python3
"""
scripts/eu-earnings-refresh.py

Chaînon d'auto-complétion FR/CH (exigence Yann 2 août 2026).
Pendant US = daily-doc-watcher + quarterly-refresh-detect/run, l'Europe n'avait
que la détection (fr-doc-watcher) sans le maillon "extraction des nouveaux KPI".
Ce script est ce maillon.

Workflow :
1. (option --run-watcher) lance `scripts/fr-doc-watcher.py` pour rafraîchir
   `src/data/_fr-doc-watcher-status.json` et télécharger les nouveaux PDF.
2. Lit ce fichier de statut. Pour chaque sté `a_rafraichir: true` (CAC 40 .PA
   ET SMI 20 .SW, même fichier), liste les documents présents dans
   `data-lake/<T>/ir/` plus récents que ceux déjà intégrés
   (état `.conv-state/eu-earnings-refresh-state.json`).
3. Écrit une mission d'extraction par sté dans
   `.conv-state/eu-refresh-missions/<T>.txt`, générée depuis
   `.conv-state/eu-earnings-refresh-template.txt` (dernier point de série,
   liste des nouveaux documents, devise de publication).
4. Écrit la file de travail `.conv-state/eu-earnings-refresh-todo.json`,
   consommée par la conv Claude (sub-agents forfait Max) : ZÉRO API payante
   ici, ce script ne fait aucune extraction lui-même (RULES-GOLDEN §0bis).
5. `--mark-done <T>` : appelé par la conv après une mission réussie. Marque la
   sté traitée dans l'état, repasse `a_rafraichir` à false dans le statut du
   watcher et sort la sté de la file.

Idempotent et resume-safe : relancer ne recrée pas de mission pour une sté
dont les documents ont déjà été intégrés.

Usage :
  python3 scripts/eu-earnings-refresh.py                    # détection + missions
  python3 scripts/eu-earnings-refresh.py --run-watcher      # watcher d'abord
  python3 scripts/eu-earnings-refresh.py --tickers=NESN.SW,MC.PA
  python3 scripts/eu-earnings-refresh.py --dry-run
  python3 scripts/eu-earnings-refresh.py --mark-done NESN.SW
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
STATUS_PATH = ROOT / "src/data/_fr-doc-watcher-status.json"
STATE_PATH = ROOT / ".conv-state/eu-earnings-refresh-state.json"
TODO_PATH = ROOT / ".conv-state/eu-earnings-refresh-todo.json"
MISSIONS_DIR = ROOT / ".conv-state/eu-refresh-missions"
TEMPLATE_PATH = ROOT / ".conv-state/eu-earnings-refresh-template.txt"
CAC40_STATE = ROOT / ".conv-state/cac40-state.json"
SMI_STATE = ROOT / ".conv-state/smi-state.json"
KPIS_HAUT = ROOT / ".batches-drafts-safe/kpis-haut"
DATA_LAKE = ROOT / "data-lake"
WATCHER = ROOT / "scripts/fr-doc-watcher.py"

LOG_PREFIX = "[eu-earnings-refresh]"

# Devise de publication par sté. Défaut EUR pour .PA, CHF pour .SW.
DEVISE_OVERRIDE = {
    "NOVN.SW": "USD",
    "UBSG.SW": "USD",
    "ABBN.SW": "USD",
    "LOGN.SW": "USD",
    "ALC.SW": "USD",
    "AMRZ.SW": "USD",
    "STLAP.PA": "EUR",
    "MT.AS": "USD",
}

DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with open(path, "r", encoding="utf8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        log(f"WARN: {path.name} illisible ({exc}), valeur par défaut utilisée")
        return default


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write("\n")


def load_noms() -> dict[str, str]:
    noms: dict[str, str] = {}
    for path in (CAC40_STATE, SMI_STATE):
        for entry in (load_json(path, {}) or {}).get("univers") or []:
            if entry.get("ticker"):
                noms[entry["ticker"]] = entry.get("nom") or entry["ticker"]
    return noms


def devise_for(ticker: str) -> str:
    if ticker in DEVISE_OVERRIDE:
        return DEVISE_OVERRIDE[ticker]
    return "CHF" if ticker.endswith(".SW") else "EUR"


def ir_documents(ticker: str) -> list[str]:
    """Chemins relatifs des PDF IR de la sté, triés par date de publication."""
    ir_dir = DATA_LAKE / ticker / "ir"
    if not ir_dir.is_dir():
        return []
    docs = [p for p in ir_dir.rglob("*.pdf") if p.is_file() and p.stat().st_size > 0]

    def sort_key(p: Path) -> str:
        m = DATE_RE.search(p.name)
        return m.group(1) if m else "0000-00-00"

    return [str(p.relative_to(ROOT)) for p in sorted(docs, key=sort_key)]


def last_serie_point(ticker: str) -> str:
    """Dernier point des séries KPI de la sté (libellé), ou 'inconnu'."""
    path = KPIS_HAUT / f"{ticker}.json"
    data = load_json(path, None)
    if not data:
        return "inconnu"
    series = data.get("kpis") if isinstance(data, dict) else data
    if not isinstance(series, list):
        return "inconnu"
    labels: list[str] = []
    for kpi in series:
        if not isinstance(kpi, dict):
            continue
        history = kpi.get("history") or []
        for point in history:
            if isinstance(point, dict) and point.get("q"):
                labels.append(str(point["q"]))
    if not labels:
        return "inconnu"
    # Le libellé le plus "grand" en ordre lexical n'est pas fiable (T1-2024 vs
    # S1-2024) : on prend le dernier point de la série la plus longue.
    longest: list = []
    for kpi in series:
        if isinstance(kpi, dict) and len(kpi.get("history") or []) > len(longest):
            longest = kpi["history"]
    if longest and isinstance(longest[-1], dict) and longest[-1].get("q"):
        return str(longest[-1]["q"])
    return labels[-1]


def build_mission(ticker: str, nom: str, new_docs: list[str], dry_run: bool) -> str | None:
    template = TEMPLATE_PATH.read_text(encoding="utf8")
    mission = (
        template.replace("__T__", ticker)
        .replace("__NOM__", nom)
        .replace("__LAST__", last_serie_point(ticker))
        .replace("__DEVISE__", devise_for(ticker))
        .replace("__NEW_DOCS__", "\n".join(f"  - {d}" for d in new_docs))
    )
    out = MISSIONS_DIR / f"{ticker}.txt"
    if dry_run:
        return str(out.relative_to(ROOT))
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(mission, encoding="utf8")
    return str(out.relative_to(ROOT))


def run_watcher(tickers: list[str] | None) -> None:
    cmd = [sys.executable, str(WATCHER)]
    if tickers:
        cmd.append("--tickers=" + ",".join(tickers))
    log(f"lancement watcher: {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=str(ROOT))
    log(f"watcher rc={proc.returncode}")


def bootstrap(tickers: list[str], dry_run: bool) -> int:
    """Baseline : marque les documents déjà sur disque comme intégrés.

    Sert une seule fois par chaîne terminée (CAC 40 le 1er août 2026, SMI
    ensuite) : sans ça, la première exécution demanderait de ré-extraire la
    totalité du corpus déjà traité par la chaîne d'origine.
    """
    state = load_json(STATE_PATH, {})
    now = datetime.now(timezone.utc).isoformat()
    seeded = 0
    for ticker in tickers:
        docs = ir_documents(ticker)
        if not docs:
            log(f"{ticker}: aucun document sur disque, non baselisé")
            continue
        state[ticker] = {
            "integre_le": now,
            "bootstrap": True,
            "documents_integres": docs,
        }
        seeded += 1
        log(f"{ticker}: baseline {len(docs)} document(s)")
    if dry_run:
        log(f"DRY-RUN: {seeded} sté(s) baselisée(s), rien écrit")
        return 0
    write_json(STATE_PATH, state)
    log(f"{seeded} sté(s) baselisée(s) → {STATE_PATH.relative_to(ROOT)}")
    return 0


def mark_done(ticker: str) -> int:
    state = load_json(STATE_PATH, {})
    docs = ir_documents(ticker)
    state[ticker] = {
        "integre_le": datetime.now(timezone.utc).isoformat(),
        "documents_integres": docs,
    }
    write_json(STATE_PATH, state)

    status = load_json(STATUS_PATH, {})
    if ticker in status:
        status[ticker]["a_rafraichir"] = False
        status[ticker]["dernier_refresh_kpi"] = datetime.now(timezone.utc).isoformat()
        write_json(STATUS_PATH, status)

    todo = load_json(TODO_PATH, {})
    entries = [e for e in (todo.get("todo") or []) if e.get("ticker") != ticker]
    todo["todo"] = entries
    todo["generated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(TODO_PATH, todo)
    log(f"{ticker}: marqué intégré ({len(docs)} documents), retiré de la file")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Chaînon auto-complétion KPI FR/CH")
    parser.add_argument("--run-watcher", action="store_true",
                        help="lance fr-doc-watcher.py avant la détection")
    parser.add_argument("--tickers", default="",
                        help="restreint à une liste de tickers séparés par des virgules")
    parser.add_argument("--dry-run", action="store_true",
                        help="détection seule, aucune écriture")
    parser.add_argument("--mark-done", metavar="TICKER", default=None,
                        help="marque une sté comme intégrée (appelé après la mission)")
    parser.add_argument("--bootstrap", action="store_true",
                        help="baseline : marque comme intégrés les documents déjà sur "
                             "disque des stés passées par --tickers (une seule fois)")
    args = parser.parse_args()

    if args.mark_done:
        return mark_done(args.mark_done)

    only = [t.strip() for t in args.tickers.split(",") if t.strip()] or None

    if args.bootstrap:
        if not only:
            log("FATAL: --bootstrap exige --tickers=<liste>")
            return 1
        return bootstrap(only, args.dry_run)

    if args.run_watcher:
        run_watcher(only)

    if not TEMPLATE_PATH.exists():
        log(f"FATAL: template introuvable ({TEMPLATE_PATH})")
        return 1

    status = load_json(STATUS_PATH, {})
    if not status:
        log(f"FATAL: statut watcher vide ou absent ({STATUS_PATH})")
        return 1

    state = load_json(STATE_PATH, {})
    noms = load_noms()
    todo: list[dict] = []
    skipped = 0

    for ticker, entry in sorted(status.items()):
        if only and ticker not in only:
            continue
        if not entry.get("a_rafraichir"):
            continue
        docs = ir_documents(ticker)
        if not docs:
            log(f"{ticker}: a_rafraichir=true mais aucun PDF dans data-lake/{ticker}/ir, ignoré")
            skipped += 1
            continue
        deja = set((state.get(ticker) or {}).get("documents_integres") or [])
        new_docs = [d for d in docs if d not in deja]
        if not new_docs:
            log(f"{ticker}: aucun document nouveau depuis la dernière intégration, ignoré")
            skipped += 1
            continue
        mission = build_mission(ticker, noms.get(ticker, ticker), new_docs, args.dry_run)
        todo.append({
            "ticker": ticker,
            "nom": noms.get(ticker, ticker),
            "devise": devise_for(ticker),
            "nouveaux_documents": new_docs,
            "mission": mission,
            "derniere_publication_vue": entry.get("derniere_publication_vue"),
        })
        log(f"{ticker}: {len(new_docs)} document(s) nouveau(x) → mission {mission}")

    payload = {
        "doc": "File d'attente extraction KPI FR/CH (consommee par la conv Claude, "
               "sub-agents forfait Max, zero API payante)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "template": str(TEMPLATE_PATH.relative_to(ROOT)),
        "todo": todo,
    }
    if args.dry_run:
        log(f"DRY-RUN: {len(todo)} sté(s) à rafraîchir, {skipped} ignorée(s), rien écrit")
        print(json.dumps(payload, ensure_ascii=False, indent=1))
        return 0

    write_json(TODO_PATH, payload)
    log(f"{len(todo)} sté(s) en file, {skipped} ignorée(s) → {TODO_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
