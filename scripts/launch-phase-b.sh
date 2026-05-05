#!/bin/bash
# Phase B — pipeline LLM sur les 1506 sociétés SP1500.
#
# Étapes :
#   1. Attend que pass 2 batch (35 stés validation) soit fini
#   2. Pass 1 sur les 1500 nouvelles stés (extraction Hero + KPI + stories)
#   3. Pass 2 enrichissement (risks + governance + AI)
#   4. Re-build merged JSON
#
# Logs : sec-data/_meta/phase-b.log
# Sortie : src/data/v2-pipeline/<ticker>.json (1500+)
#
# Usage : nohup bash scripts/launch-phase-b.sh > /tmp/phase-b.log 2>&1 &

set -e
cd /Users/yann/spx-app
LOG=/Users/yann/spx-app/sec-data/_meta/phase-b.log
mkdir -p $(dirname "$LOG")

echo "[$(date)] === PHASE B démarré ===" >> "$LOG"

# 1. Attend fin pass 2
echo "[$(date)] Attente fin pass 2..." >> "$LOG"
while pgrep -f "pipeline-llm-pass2.py" > /dev/null; do
  sleep 60
done
echo "[$(date)] Pass 2 terminé." >> "$LOG"

# 2. Build sp1500 ticker list (skip ceux déjà faits dans v2-pipeline)
echo "[$(date)] Build liste 1500 stés à traiter..." >> "$LOG"
python3 << 'PYEOF' >> "$LOG" 2>&1
import json, os
sp1500 = json.load(open('/Users/yann/spx-app/sec-data/_meta/sp1500.json'))
existing = set(f.replace('.json','').upper() for f in os.listdir('/Users/yann/spx-app/src/data/v2-pipeline') if f.endswith('.json') and not f.startswith('_'))
todo = [t['ticker'] for t in sp1500['tickers'] if t['ticker'].upper() not in existing]
print(f'sp1500 total: {len(sp1500["tickers"])}, déjà fait: {len(existing)}, à traiter: {len(todo)}')
# Sauvegarde la liste
with open('/tmp/phase-b-tickers.txt', 'w') as f:
    f.write(','.join(todo))
PYEOF

# 3. Lance pass 1 par chunks de 50 (pour éviter command line trop long)
TICKERS=$(cat /tmp/phase-b-tickers.txt)
TOTAL=$(echo "$TICKERS" | tr ',' '\n' | wc -l | tr -d ' ')
echo "[$(date)] Pass 1 sur $TOTAL stés..." >> "$LOG"

python3 scripts/pipeline-llm.py --ticker "$TICKERS" --cat 1 >> "$LOG" 2>&1
echo "[$(date)] Pass 1 terminé." >> "$LOG"

# 4. Pass 2 enrichissement sur tous (y compris les nouveaux)
echo "[$(date)] Pass 2 enrichissement..." >> "$LOG"
python3 scripts/pipeline-llm-pass2.py --all >> "$LOG" 2>&1
echo "[$(date)] Pass 2 terminé." >> "$LOG"

# 5. Re-build merged JSON
echo "[$(date)] Re-build merged JSON..." >> "$LOG"
npx tsx scripts/build-v2-pipeline-merged.ts >> "$LOG" 2>&1

echo "[$(date)] === PHASE B TERMINÉE ===" >> "$LOG"
touch /tmp/phase-b-done.flag
