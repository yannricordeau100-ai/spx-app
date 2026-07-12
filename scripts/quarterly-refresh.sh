#!/bin/bash
# scripts/quarterly-refresh.sh
# Orchestrateur du rafraichissement trimestriel Mettrik (go Yann 12 juil 2026).
# detect -> run -> audit pages -> rapport .conv-state/quarterly-refresh-report.json
# NE COMMIT / NE DEPLOY PAS (validation Yann d'abord).
# Lance par launchd (com.mettrik.quarterly-refresh) tous les jours 07h30 Europe/Paris.
set -u

ROOT="/Users/yann/spx-app"
LOGDIR="$ROOT/logs/quarterly-refresh"
LOCK="$ROOT/.conv-state/quarterly-refresh.lock"
DETECTED="$ROOT/.conv-state/quarterly-refresh-detected.json"
RUNRESULT="$ROOT/.conv-state/quarterly-refresh-run-result.json"
REPORT="$ROOT/.conv-state/quarterly-refresh-report.json"
AUDIT_REPORT="$ROOT/.conv-state/audit-pages-report.json"

mkdir -p "$LOGDIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGDIR/run-$TS.log"
exec >>"$LOG" 2>&1
echo "[quarterly-refresh] start $TS"

cd "$ROOT" || exit 1

# Lock anti-double-run
if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
else
  echo "[quarterly-refresh] lock present ($LOCK), run deja en cours. Abandon."
  exit 0
fi

# 1. DETECTION (SEC EDGAR submissions, throttle 0.5s)
python3 scripts/quarterly-refresh-detect.py --out "$DETECTED"
DETECT_RC=$?

N=$(python3 -c "import json,sys
try: print(len(json.load(open('$DETECTED'))['detected']))
except Exception: print(0)")
echo "[quarterly-refresh] detect rc=$DETECT_RC, $N ste(s) a rafraichir"

if [ "$N" = "0" ]; then
  python3 - <<PYEOF
import json, datetime
report = {
    "run_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "detect_rc": $DETECT_RC,
    "stes_rafraichies": [],
    "kpi_etendus": {},
    "a_faire_llm": {},
    "audit": None,
    "erreurs": [],
    "note": "aucun nouveau filing detecte",
}
json.dump(report, open("$REPORT", "w"), ensure_ascii=False, indent=2)
PYEOF
  echo "[quarterly-refresh] rien a faire, rapport ecrit. done."
  exit 0
fi

# 2. RUN (download filings + facts.json + KPI + todo-llm)
python3 scripts/quarterly-refresh-run.py --detected "$DETECTED"
RUN_RC=$?
echo "[quarterly-refresh] run rc=$RUN_RC"

# 3. AUDIT fidele des pages touchees
TICKERS=$(python3 -c "import json
d=json.load(open('$RUNRESULT'))
print(' '.join(r['ticker'] for r in d.get('results', [])))" 2>/dev/null)
AUDIT_RC=0
if [ -n "$TICKERS" ]; then
  echo "[quarterly-refresh] audit pages: $TICKERS"
  npx tsx scripts/audit-pages-full.ts $TICKERS
  AUDIT_RC=$?
fi

# 4. RAPPORT FINAL
python3 - <<PYEOF
import json, datetime
from pathlib import Path

def load(p):
    try: return json.loads(Path(p).read_text("utf8"))
    except Exception: return None

run = load("$RUNRESULT") or {"results": []}
audit = load("$AUDIT_REPORT")
todo = load("/Users/yann/spx-app/.conv-state/quarterly-refresh-todo-llm.json") or {"todo": {}}

results = run.get("results", [])
tickers = [r["ticker"] for r in results]
report = {
    "run_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "detect_rc": $DETECT_RC, "run_rc": $RUN_RC, "audit_rc": $AUDIT_RC,
    "stes_rafraichies": tickers,
    "par_ste": {
        r["ticker"]: {
            "type": r["type"],
            "blocs_auto": r["blocks_auto"],
            "blocs_en_attente_llm": r["blocks_pending_llm"],
            "filings": r["filings_downloaded"],
            "erreurs": r["errors"],
        } for r in results
    },
    "kpi_etendus": {r["ticker"]: r["blocks_auto"]["kpi_updated"] + r["blocks_auto"]["kpi_added"]
                    for r in results},
    "a_faire_llm": {t: v.get("flags") for t, v in todo.get("todo", {}).items() if t in tickers},
    "audit": ({"report": "$AUDIT_REPORT",
               "issues": {t: a for t, a in ((audit or {}).items() if isinstance(audit, dict) else [])
                          if isinstance(a, (list, dict)) and t in tickers}} if audit else None),
    "erreurs": [{"ticker": r["ticker"], "erreurs": r["errors"]} for r in results if r["errors"]],
    "note": "AUCUN commit/deploy automatique : validation Yann requise. "
            "Blocs LLM a traiter par la conv Claude via quarterly-refresh-todo-llm.json.",
}
json.dump(report, open("$REPORT", "w"), ensure_ascii=False, indent=2)
print(f"[quarterly-refresh] rapport ecrit: $REPORT ({len(tickers)} stes)")
PYEOF

echo "[quarterly-refresh] done $(date +%Y%m%d-%H%M%S)"
exit 0
