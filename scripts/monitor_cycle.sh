#!/usr/bin/env bash
# monitor_cycle.sh — cycle complet Monitor Mettrik, stateless, écrit dans /tmp/monitor_result.json
set -e
cd ~/spx-app

# 1. Sync data-lake
cp -rn ~/data-lake/* data-lake/ 2>/dev/null || true

# 2. Ingest + build
python3 scripts/datalake/ingest_drafts.py 2>&1 | tail -3
python3 scripts/datalake/build_status.py 2>&1 | tail -3

# 3. Git push si changements
git add src/data/extraction-status.json
if ! git diff --cached --quiet; then
  git commit -m "monitor refresh auto"
  git push origin staging
else
  echo "Pas de changement dans extraction-status.json, skip commit"
fi

# 4. Vercel deploy + alias
source .env.local
TEAM_ID="team_3A8Ft1Kze0wYzGbuyHmsaEwC"
PROJECT_ID="prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA"

# Obtenir le SHA du dernier commit staging
GIT_SHA=$(git rev-parse HEAD)

echo "En attente du deploy Vercel pour SHA $GIT_SHA..."
for i in $(seq 1 30); do
  DEPLOY_URL=$(curl -s "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=5" \
    -H "Authorization: Bearer $VERCEL_TOKEN" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data.get('deployments', []):
    if d.get('state') == 'READY' and d.get('meta', {}).get('githubCommitSha', '').startswith('$GIT_SHA'[:8]):
        print(d.get('url', ''))
        break
" 2>/dev/null)

  if [ -n "$DEPLOY_URL" ]; then
    echo "Deploy trouvé: $DEPLOY_URL"
    npx vercel alias set "$DEPLOY_URL" mettrik-niveau2.vercel.app --token "$VERCEL_TOKEN" 2>&1 | tail -2
    break
  fi

  # Si pas de match sur SHA, prendre le dernier READY
  if [ "$i" -eq 15 ]; then
    DEPLOY_URL=$(curl -s "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&teamId=$TEAM_ID&limit=5" \
      -H "Authorization: Bearer $VERCEL_TOKEN" | \
      python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data.get('deployments', []):
    if d.get('state') == 'READY':
        print(d.get('url', ''))
        break
" 2>/dev/null)
    if [ -n "$DEPLOY_URL" ]; then
      echo "Fallback deploy READY: $DEPLOY_URL"
      npx vercel alias set "$DEPLOY_URL" mettrik-niveau2.vercel.app --token "$VERCEL_TOKEN" 2>&1 | tail -2
      break
    fi
  fi

  sleep 10
done

# 5. Lire les compteurs et écrire /tmp/monitor_result.json
python3 - <<'PYEOF'
import json

with open('src/data/extraction-status.json') as f:
    d = json.load(f)

tickers = d.get('tickers', {})
counts = {}
for bloc in ['financier', 'kpi_normaux', 'story', 'gouvernance']:
    vert = sum(1 for t in tickers.values() if t.get(bloc, {}).get('s') == 'green')
    rouge = sum(1 for t in tickers.values() if t.get(bloc, {}).get('s') == 'red')
    counts[bloc] = {'vert': vert, 'rouge': rouge}

# Stop condition
stop = counts['kpi_normaux']['vert'] >= 470 and counts['gouvernance']['vert'] >= 470

result = {
    'counts': counts,
    'stop': stop,
    'total': len(tickers)
}

with open('/tmp/monitor_result.json', 'w') as f:
    json.dump(result, f, indent=2)

print(json.dumps(counts, indent=2))
print(f"STOP={stop}")
PYEOF
