#!/bin/bash
# scripts/daily-doc-watcher.sh
#
# Veille documentaire quotidienne des stés clean_all V1.9.5.
# Tourne via crontab 04h00 (avant la cron 05h00 EN/DE).
#
# Yann (27 mai 2026) : zéro API Anthropic payant (RULES-GOLDEN §0bis).
# Sources gratuites uniquement : yfinance, SEC EDGAR submissions API,
# scraping IR pages EU pures.

set -uo pipefail

PROJECT_ROOT="/Users/yann/spx-app"
LOG_FILE="/tmp/daily-doc-watcher.log"
PY_SCRIPT="${PROJECT_ROOT}/scripts/daily-doc-watcher.py"

cd "${PROJECT_ROOT}" || {
    echo "[$(date -Iseconds)] FATAL: cannot cd to ${PROJECT_ROOT}" >&2
    exit 1
}

echo "[$(date -Iseconds)] === daily-doc-watcher start (trigger=${DAILY_DOC_WATCHER_TRIGGER:-cron}) ==="

if [ ! -f "${PY_SCRIPT}" ]; then
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

# Yann 9 août 2026 : détection de retard KPI fiscal-correct APRÈS le
# téléchargement des filings. C'est le maillon qui manquait : le watcher
# téléchargeait mais personne ne vérifiait que les séries KPI suivaient
# (245 stés de retard accumulées en silence, rattrapées le 8-9 août).
# Si retard détecté → alerte dans .conv-state/kpi-lag-alert.json, lue par
# la session autonome et le sum-up horaire. Règle Yann : jamais plus
# d'1 jour de retard.
LAG_OUT=$("${PYTHON_BIN}" "${PROJECT_ROOT}/scripts/kpi-lag-detect.py" 2>&1 | grep -m1 "lagging=")
echo "[$(date -Iseconds)] kpi-lag-detect: ${LAG_OUT}"
LAG_N=$(echo "${LAG_OUT}" | sed -n 's/.*lagging=\([0-9]*\).*/\1/p')
if [ -n "${LAG_N}" ] && [ "${LAG_N}" -gt 0 ]; then
    "${PYTHON_BIN}" "${PROJECT_ROOT}/scripts/kpi-lag-detect.py" 2>/dev/null | grep -v "lagging=" \
        > "${PROJECT_ROOT}/.conv-state/kpi-lag-alert.json"
    echo "[$(date -Iseconds)] ALERTE: ${LAG_N} stés en retard KPI → .conv-state/kpi-lag-alert.json"
else
    rm -f "${PROJECT_ROOT}/.conv-state/kpi-lag-alert.json"
fi

echo "[$(date -Iseconds)] === daily-doc-watcher end (rc=${RC}) ==="
exit ${RC}
