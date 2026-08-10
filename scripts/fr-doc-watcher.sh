#!/bin/bash
# scripts/fr-doc-watcher.sh
#
# Veille documentaire quotidienne des stés clean_all V1.9.5.
# Tourne via crontab 04h00 (avant la cron 05h00 EN/DE).
#
# Yann (27 mai 2026) : zéro API Anthropic payant (RULES-GOLDEN §0bis).
# Sources gratuites uniquement : yfinance, SEC EDGAR submissions API,
# scraping IR pages EU pures.

set -uo pipefail

PROJECT_ROOT="/Users/yann/spx-app"
LOG_FILE="/tmp/fr-doc-watcher.log"
PY_SCRIPT="${PROJECT_ROOT}/scripts/fr-doc-watcher.py"

cd "${PROJECT_ROOT}" || {
    echo "[$(date -Iseconds)] FATAL: cannot cd to ${PROJECT_ROOT}" >&2
    exit 1
}

echo "[$(date -Iseconds)] === fr-doc-watcher start (trigger=${DAILY_DOC_WATCHER_TRIGGER:-cron}) ==="

if [ ! -f "${PY_SCRIPT}" "$@" ]; then
    echo "[$(date -Iseconds)] FATAL: python script not found at ${PY_SCRIPT}" >&2
    exit 2
fi

# Utilise le python du système (3.11+ requis pour yfinance récent).
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

"${PYTHON_BIN}" "${PY_SCRIPT}"
RC=$?

echo "[$(date -Iseconds)] === fr-doc-watcher end (rc=${RC}) ==="
exit ${RC}
