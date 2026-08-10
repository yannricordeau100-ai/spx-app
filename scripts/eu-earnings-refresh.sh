#!/bin/bash
# scripts/eu-earnings-refresh.sh
#
# Chaînon d'auto-complétion KPI FR/CH (exigence Yann 2 août 2026).
# Tourne via crontab 05h15, après fr-doc-watcher (04h30) qui télécharge les
# nouveaux documents et positionne a_rafraichir dans
# src/data/_fr-doc-watcher-status.json.
#
# Ce script NE FAIT PAS d'extraction : il prépare la file
# .conv-state/eu-earnings-refresh-todo.json + une mission par sté dans
# .conv-state/eu-refresh-missions/. La conv Claude consomme cette file avec des
# sub-agents forfait Max, puis appelle --mark-done <TICKER>.
# Zéro API Anthropic payante (RULES-GOLDEN §0bis).

set -uo pipefail

PROJECT_ROOT="/Users/yann/spx-app"
PY_SCRIPT="${PROJECT_ROOT}/scripts/eu-earnings-refresh.py"

cd "${PROJECT_ROOT}" || {
    echo "[$(date -Iseconds)] FATAL: cannot cd to ${PROJECT_ROOT}" >&2
    exit 1
}

echo "[$(date -Iseconds)] === eu-earnings-refresh start ==="

if [ ! -f "${PY_SCRIPT}" ]; then
    echo "[$(date -Iseconds)] FATAL: python script not found at ${PY_SCRIPT}" >&2
    exit 2
fi

PYTHON_BIN="${PYTHON_BIN:-/opt/homebrew/bin/python3}"
# Fix 9 aout 2026 : le python du cron doit avoir yfinance (cause des 569 faux "stale")
if ! "${PYTHON_BIN}" -c "import yfinance" >/dev/null 2>&1; then
    for cand in /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 python3 /usr/bin/python3; do
        if command -v "$cand" >/dev/null 2>&1 && "$cand" -c "import yfinance" >/dev/null 2>&1; then PYTHON_BIN="$cand"; break; fi
    done
fi
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
    PYTHON_BIN="python3"
fi

"${PYTHON_BIN}" "${PY_SCRIPT}" "$@"
RC=$?

echo "[$(date -Iseconds)] === eu-earnings-refresh end (rc=${RC}) ==="
exit ${RC}
