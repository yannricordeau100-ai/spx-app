#!/usr/bin/env bash
# loop_wakeup.sh — Exécute un cycle complet du /loop monitor Mettrik
# Usage: bash scripts/datalake/loop_wakeup.sh
# Écrit le résultat dans /tmp/loop_wakeup_result.json (JAMAIS dans la conversation)
set -e
cd ~/spx-app

RESULT=/tmp/loop_wakeup_result.json
LOG=/tmp/loop_wakeup.log

echo "[$(date)] === LOOP WAKEUP DÉMARRÉ ===" >> "$LOG"

# 1. Copier du datalake central
cp -rn ~/data-lake/* data-lake/ 2>/dev/null || true

# 2. Ingest
python3 scripts/datalake/ingest_drafts.py >> "$LOG" 2>&1

# 3. Build status
python3 scripts/datalake/build_status.py >> "$LOG" 2>&1

# 4. Git add + commit + push
git add src/data/extraction-status.json
if git diff --cached --quiet; then
    COMMIT_STATUS="NO_CHANGE"
    COMMIT_SHA=""
else
    git commit -m "monitor refresh auto" >> "$LOG" 2>&1
    git push origin staging >> "$LOG" 2>&1
    COMMIT_STATUS="PUSHED"
    COMMIT_SHA=$(git rev-parse HEAD)
fi

# 5. Deploy Vercel si commit pushé
DEPLOY_STATUS="SKIPPED"
ALIAS_STATUS="SKIPPED"
if [ "$COMMIT_STATUS" = "PUSHED" ]; then
    source .env.local 2>/dev/null || true
    if [ -n "$VERCEL_TOKEN" ]; then
        # Trigger deploy via hook ou API
        TEAM_ID="team_3A8Ft1Kze0wYzGbuyHmsaEwC"
        PROJECT_ID="prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA"

        # Poll deployments for our commit SHA
        DEPLOY_URL=""
        for i in $(seq 1 20); do
            sleep 15
            DEPLOY_JSON=$(curl -s "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=5" \
                -H "Authorization: Bearer $VERCEL_TOKEN" 2>/dev/null || echo "{}")
            DEPLOY_URL=$(python3 -c "
import json, sys
d = json.loads('''$DEPLOY_JSON''')
for dep in d.get('deployments', []):
    if dep.get('meta', {}).get('githubCommitSha', '').startswith('$COMMIT_SHA'[:8]) and dep.get('state') == 'READY':
        print(dep.get('url', ''))
        sys.exit(0)
" 2>/dev/null || echo "")
            if [ -n "$DEPLOY_URL" ]; then
                break
            fi
        done

        if [ -n "$DEPLOY_URL" ]; then
            npx vercel alias set "https://$DEPLOY_URL" mettrik-niveau2.vercel.app --token="$VERCEL_TOKEN" >> "$LOG" 2>&1 && ALIAS_STATUS="OK" || ALIAS_STATUS="FAIL"
            DEPLOY_STATUS="READY:$DEPLOY_URL"
        else
            DEPLOY_STATUS="TIMEOUT"
        fi
    else
        DEPLOY_STATUS="NO_TOKEN"
    fi
fi

# 6. Lire les compteurs depuis extraction-status.json
COUNTERS=$(python3 - <<'PYEOF'
import json
try:
    with open('src/data/extraction-status.json') as f:
        s = json.load(f)
    tickers = s.get('tickers', {})
    blocs = ['financier', 'kpi_normaux', 'story', 'gouvernance']
    out = {b: {'vert': 0, 'rouge': 0, 'orange': 0} for b in blocs}
    for ticker_data in tickers.values():
        for bloc in blocs:
            if bloc in ticker_data:
                sv = ticker_data[bloc].get('s', '')
                if sv == 'green': out[bloc]['vert'] += 1
                elif sv == 'red': out[bloc]['rouge'] += 1
                elif sv == 'orange': out[bloc]['orange'] += 1
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({'error': str(e)}))
PYEOF
)

# 7. Vérifier stop condition
STOP=$(python3 -c "
import json
c = json.loads('$COUNTERS')
kpi = c.get('kpi_normaux', {}).get('vert', 0)
gov = c.get('gouvernance', {}).get('vert', 0)
print('true' if kpi >= 470 and gov >= 470 else 'false')
" 2>/dev/null || echo "false")

# 8. Écrire le résultat JSON
python3 - <<PYEOF
import json, os
from datetime import datetime

result = {
    "ts": datetime.utcnow().isoformat() + "Z",
    "commit_status": "$COMMIT_STATUS",
    "commit_sha": "$COMMIT_SHA",
    "deploy_status": "$DEPLOY_STATUS",
    "alias_status": "$ALIAS_STATUS",
    "stop": "$STOP" == "true",
    "counts": $COUNTERS
}
with open('/tmp/loop_wakeup_result.json', 'w') as f:
    json.dump(result, f, indent=2)
print("Result written to /tmp/loop_wakeup_result.json")
PYEOF

echo "[$(date)] STOP=$STOP COMMIT=$COMMIT_STATUS" >> "$LOG"
