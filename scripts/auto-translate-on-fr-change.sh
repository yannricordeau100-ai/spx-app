#!/bin/bash
# auto-translate-on-fr-change.sh
#
# Watcher idempotent : détecte les fichiers FR modifiés dans v2-pipeline/
# et v2-pipeline-enrich/ depuis le dernier commit, et déclenche traduction
# EN + DE via les scripts existants pour les tickers concernés.
#
# - Lit `git diff HEAD~1 HEAD` (ou HEAD vs HEAD~N pour rattraper)
# - Idempotent : ne traduit que si le fichier EN/DE existant n'a pas la
#   même empreinte (mtime + hash) que le FR source
# - 3 clés Cerebras rotation déjà gérées par les scripts Python
#
# Usage (cron toutes les 15 min) :
#   */15 * * * * /Users/yann/spx-app/scripts/auto-translate-on-fr-change.sh \
#       >> /tmp/auto-translate.log 2>&1
#
# Yann 26 mai 2026.

set -uo pipefail

REPO_ROOT="/Users/yann/spx-app"
cd "$REPO_ROOT" || exit 1

LOG_PREFIX="[auto-translate $(date -u +%Y-%m-%dT%H:%M:%SZ)]"
echo "$LOG_PREFIX start"

# 1. Détecter fichiers FR modifiés depuis le dernier rebuild horaire
#    (HEAD~1 = précédent commit ; on prend ~5 pour rattraper si plusieurs
#    commits ont eu lieu entre 2 runs du watcher)
CHANGED_FILES=$(git diff --name-only HEAD~5 HEAD -- \
    'src/data/v2-pipeline/*.json' \
    'src/data/v2-pipeline-enrich/*.json' 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
    echo "$LOG_PREFIX no FR data changed in last 5 commits, exit"
    exit 0
fi

# 2. Extraire les tickers uniques (lowercase, sans extension, sans path)
TICKERS=$(echo "$CHANGED_FILES" | sed 's|.*/||; s|\.json$||' | sort -u | tr '\n' ',' | sed 's/,$//')

if [ -z "$TICKERS" ]; then
    echo "$LOG_PREFIX no tickers extracted, exit"
    exit 0
fi

echo "$LOG_PREFIX changed tickers: $TICKERS"

# 3. Filtrer : ne garder que les tickers dont le fichier EN ou DE est
#    plus ancien que le fichier FR (idempotence)
TODO_EN=""
TODO_DE=""
IFS=',' read -ra TICKER_ARR <<< "$TICKERS"
for tk in "${TICKER_ARR[@]}"; do
    tk_lower=$(echo "$tk" | tr '[:upper:]' '[:lower:]')
    FR_FILE="src/data/v2-pipeline/${tk_lower}.json"
    [ ! -f "$FR_FILE" ] && continue

    EN_FILE="src/data/v2-pipeline-i18n/${tk_lower}.en.json"
    DE_FILE="src/data/v2-pipeline-i18n/${tk_lower}.de.json"

    # Si EN absent ou plus ancien que FR → retraduire
    if [ ! -f "$EN_FILE" ] || [ "$FR_FILE" -nt "$EN_FILE" ]; then
        TODO_EN="${TODO_EN}${tk_lower},"
    fi
    if [ ! -f "$DE_FILE" ] || [ "$FR_FILE" -nt "$DE_FILE" ]; then
        TODO_DE="${TODO_DE}${tk_lower},"
    fi
done

TODO_EN="${TODO_EN%,}"
TODO_DE="${TODO_DE%,}"

if [ -z "$TODO_EN" ] && [ -z "$TODO_DE" ]; then
    echo "$LOG_PREFIX all FR changes already translated EN+DE, exit"
    exit 0
fi

# 4. Charger keys Cerebras (3 keys rotation) depuis .env.local si présent
if [ -f "$REPO_ROOT/.env.local" ]; then
    set -a
    source "$REPO_ROOT/.env.local" 2>/dev/null || true
    set +a
fi

if [ -z "${CEREBRAS_API_KEY:-}" ] && [ -z "${CEREBRAS2_API_KEY:-}" ] && [ -z "${CEREBRAS3_API_KEY:-}" ]; then
    echo "$LOG_PREFIX no CEREBRAS_API_KEY available, skip translation"
    exit 0
fi

# 5. Lancer traduction EN (1 proc, sleep 1.5s intégré dans le script)
if [ -n "$TODO_EN" ]; then
    echo "$LOG_PREFIX translate EN: $TODO_EN"
    python3 scripts/translate-v17-kpis-to-en.py --tickers "$TODO_EN" \
        --skip-existing 2>&1 | sed "s/^/[en] /"
fi

# 6. Lancer traduction DE
if [ -n "$TODO_DE" ]; then
    echo "$LOG_PREFIX translate DE: $TODO_DE"
    python3 scripts/translate-v17-kpis-to-de.py --tickers "$TODO_DE" \
        --skip-existing 2>&1 | sed "s/^/[de] /"
fi

echo "$LOG_PREFIX done"
