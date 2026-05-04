#!/usr/bin/env bash
# AUTOPILOT Pass 3 — lancé au login Mac via LaunchAgent
# Attend disque externe, lance 6 procs Pass 3 Haiku avec cap $5 chacun ($30 total = capacité ~1200 stés)
# Log : /Users/yann/spx-app/_autopilot.log

set -u
LOG="/Users/yann/spx-app/_autopilot.log"
ROOT="/Users/yann/spx-app"
KEY="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"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $1" | tee -a "$LOG"; }

log "=== AUTOPILOT démarrage ==="

# Anti-doublon : si Pass 3 déjà actif, ne rien faire
if pgrep -f "pipeline-claude-validate" > /dev/null; then
    log "Procs Pass 3 déjà actifs, exit (anti-doublon)"
    exit 0
fi

# Attente sec-data accessible (via symlink ~/spx-app/sec-data → /Volumes/250GB OU local)
# Robuste si Yann transfère data en local et update symlink
TIMEOUT=1800
WAITED=0
while [ ! -d "/Users/yann/spx-app/sec-data/cat1-us" ]; do
    if [ "$WAITED" -ge "$TIMEOUT" ]; then
        log "TIMEOUT 30 min sans sec-data accessible, exit"
        exit 1
    fi
    sleep 60
    WAITED=$((WAITED + 60))
done
log "sec-data accessible après ${WAITED}s"

cd "$ROOT" || { log "cd fail"; exit 1; }
mkdir -p sec-data/_meta/p3-logs

# Build pending list (datasets sans backup ET sans _validation key)
python3 - <<'PYEOF'
import json
from pathlib import Path
OUT = Path('/Users/yann/spx-app/src/data/v2-pipeline')
pending = []
for f in OUT.glob('*.json'):
    n = f.name
    if n.startswith('_') or '.gemini.json' in n: continue
    backup = OUT / f'{n[:-5]}.gemini.json'
    if backup.exists(): continue
    try:
        d = json.loads(f.read_text())
        if '_validation' in d: continue
    except: continue
    pending.append(n[:-5].upper())
N = 6
for i in range(N):
    grp = pending[i::N]
    Path(f'/tmp/autopilot-p3-grp{i}.txt').write_text('\n'.join(grp))
print(f'pending={len(pending)}')
PYEOF
log "Pending list construite"

# Launch 6 procs Pass 3 Haiku, cap $5 chacun
export ANTHROPIC_API_KEY="$KEY"
PIDS=""
for i in 0 1 2 3 4 5; do
    nohup python3 scripts/pipeline-claude-validate.py --model haiku \
        --ticker-file "/tmp/autopilot-p3-grp${i}.txt" --budget 5 \
        > "sec-data/_meta/p3-logs/autopilot-grp${i}.log" 2>&1 &
    PIDS="$PIDS $!"
done
log "6 procs Pass 3 lancés. PIDs:$PIDS"
log "=== AUTOPILOT setup terminé, parent script exit ==="
