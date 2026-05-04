#!/usr/bin/env bash
# Auto-restart Pass 3 Haiku waves until all pending stés validated
# Usage: nohup ./_pass3-haiku-orchestrator.sh > log 2>&1 &
set -e

ANTHROPIC_API_KEY="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"
export ANTHROPIC_API_KEY

ROOT="/Users/yann/spx-app"
LOG_DIR="$ROOT/sec-data/_meta/p3-logs"
cd "$ROOT"

# Wait for current 4 PIDs to all exit (passed as args)
WAVE_NUM="${1:-2}"
shift
for PID in "$@"; do
    while kill -0 "$PID" 2>/dev/null; do
        sleep 60
    done
done

# Compute remaining pending — PRIORITY: top 308 → cat 2 → cat 3 → reste cat 1
python3 -c "
import json, csv
from pathlib import Path
OUT = Path('src/data/v2-pipeline')
META = Path('sec-data/_meta')

# Sets de priorité
top308 = set()
with open(META / 'top-searched-stocks-by-country.csv') as f:
    for r in csv.DictReader(f):
        if r.get('ticker'): top308.add(r['ticker'].strip().upper())
fpi = json.loads((META / 'fpi-tickers.json').read_text())
cat2 = set(t.upper() if isinstance(t,str) else t.get('ticker','').upper() for t in fpi.get('tickers',[]))
eu = json.loads((META / 'cat3-top500-eu-list.json').read_text())
cat3 = set()
for v in eu.get('TICKERS', {}).values():
    cat3.update(t.upper() for t in v)
cat3.update(t.upper() for t in eu.get('_already_done_cat3', []))

pending = []
for f in OUT.glob('*.json'):
    n = f.name
    if n.startswith('_') or 'gemini' in n: continue
    try:
        if json.loads(f.read_text()).get('_validation'): continue
    except: continue
    pending.append(n.replace('.json','').upper())

prio = []; seen = set()
def add(t):
    if t in seen: return
    seen.add(t); prio.append(t)
for t in pending:
    if t in top308: add(t)
for t in pending:
    if t in cat2: add(t)
for t in pending:
    if t in cat3: add(t)
for t in pending: add(t)

# 4 groupes interleaved (chacun reçoit les top stés d'abord)
for i in range(4):
    grp = prio[i::4]
    Path(f'/tmp/p3-haiku-wave${WAVE_NUM}-grp{i}.txt').write_text('\n'.join(grp))
print(f'Wave ${WAVE_NUM}: {len(prio)} pending priorisés → 4 groupes (top 308 d\\'abord, puis cat 2, cat 3, reste cat 1)')
"

n=$(python3 -c "
import sys
from pathlib import Path
total = 0
for i in range(4):
    f = Path(f'/tmp/p3-haiku-wave${WAVE_NUM}-grp{i}.txt')
    if f.exists():
        total += sum(1 for l in f.read_text().splitlines() if l.strip())
print(total)
")

echo "Wave ${WAVE_NUM}: $n stés pending"
if [ "$n" -lt 4 ]; then
    echo "Less than 4 stés left, no need for parallel. Stopping orchestrator."
    exit 0
fi

# Launch 4 new groups with higher budget
for i in 0 1 2 3; do
    nohup python3 scripts/pipeline-claude-validate.py --model haiku \
        --ticker-file /tmp/p3-haiku-wave${WAVE_NUM}-grp${i}.txt --budget 4 \
        > "$LOG_DIR/wave${WAVE_NUM}-grp${i}.log" 2>&1 &
    PIDS+=($!)
done

echo "Wave ${WAVE_NUM} launched. PIDs: ${PIDS[@]}"

# Schedule next wave if still pending after these
if [ "$n" -gt 200 ] && [ "$WAVE_NUM" -lt 5 ]; then
    NEXT=$((WAVE_NUM + 1))
    nohup "$0" "$NEXT" "${PIDS[@]}" \
        > "$LOG_DIR/orchestrator-wave${NEXT}.log" 2>&1 &
    echo "Scheduled wave ${NEXT} watcher PID $!"
fi
