#!/bin/bash
# monitor-auto.sh — cycle monitor complet hors conversation
# Ecrit résultats dans .conv-state/monitor-status.json
set -e
cd ~/spx-app

# 1. Ingest data-lake
cp -rn ~/data-lake/* data-lake/ 2>/dev/null || true
python3 scripts/datalake/ingest_drafts.py >> .conv-state/monitor-auto.log 2>&1 || true
python3 scripts/datalake/build_status.py > /tmp/_build_status_out.txt 2>&1 || true

# 2. Parse counters
parse_counter() {
  local block=$1
  local color=$2
  grep -m1 "^${block}" /tmp/_build_status_out.txt | grep -o "${color}=[0-9]*" | head -1 | cut -d= -f2 || echo 0
}

FIN_V=$(parse_counter financier vert)
FIN_R=$(parse_counter financier rouge)
KPI_V=$(parse_counter kpi_normaux vert)
KPI_R=$(parse_counter kpi_normaux rouge)
STR_V=$(parse_counter story vert)
STR_R=$(parse_counter story rouge)
GOV_V=$(parse_counter gouvernance vert)
GOV_R=$(parse_counter gouvernance rouge)

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > .conv-state/monitor-status.json <<EOF
{
  "ts": "${TS}",
  "financier":   {"vert": ${FIN_V}, "rouge": ${FIN_R}},
  "kpi_normaux": {"vert": ${KPI_V}, "rouge": ${KPI_R}},
  "story":       {"vert": ${STR_V}, "rouge": ${STR_R}},
  "gouvernance": {"vert": ${GOV_V}, "rouge": ${GOV_R}},
  "stop": $([ "$KPI_V" -ge 470 ] && [ "$GOV_V" -ge 470 ] && echo "true" || echo "false")
}
EOF

# 3. Git push
git add src/data/extraction-status.json .conv-state/monitor-status.json 2>/dev/null || true
git commit -m "monitor refresh auto ${TS}" 2>/dev/null || true
git push origin staging >> .conv-state/monitor-auto.log 2>&1 || true

# 4. Vercel deploy + alias
source .env.local 2>/dev/null || true
TEAM_ID="team_3A8Ft1Kze0wYzGbuyHmsaEwC"
PROJECT_ID="prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA"
ALIAS="mettrik-niveau2.vercel.app"

# Récupère le dernier commit SHA
SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -n "$SHA" ] && [ -n "$VERCEL_TOKEN" ]; then
  # Poll deployment matching SHA
  for i in $(seq 1 20); do
    DEPLOY_URL=$(curl -sf \
      "https://api.vercel.com/v6/deployments?teamId=${TEAM_ID}&projectId=${PROJECT_ID}&limit=5" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" | \
      python3 -c "
import sys,json
d=json.load(sys.stdin)
for dep in d.get('deployments',[]):
  if dep.get('meta',{}).get('githubCommitSha','').startswith('${SHA}'[:12]) and dep.get('readyState')=='READY':
    print(dep['url'])
    break
" 2>/dev/null || echo "")
    if [ -n "$DEPLOY_URL" ]; then
      npx vercel alias set "https://${DEPLOY_URL}" "${ALIAS}" \
        --token "${VERCEL_TOKEN}" \
        --scope "${TEAM_ID}" >> .conv-state/monitor-auto.log 2>&1 || true
      echo "{\"alias_set\": \"${DEPLOY_URL}\", \"ts\": \"${TS}\"}" > .conv-state/monitor-alias.json
      break
    fi
    sleep 15
  done
fi

echo "DONE ${TS} kpi=${KPI_V} gov=${GOV_V}"
