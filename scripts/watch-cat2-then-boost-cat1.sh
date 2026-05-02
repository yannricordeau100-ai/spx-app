#!/bin/bash
# Surveille la fin du process FPI (cat 2). Quand il termine,
# tue le process cat 1 et le relance à 9 req/s (rate-delay 0.11).
# Le coverage.json garantit zéro re-download : reprise exacte.

LOG=/Users/yann/spx-app/sec-data/_meta/_watch-cat2-then-boost.log
echo "[$(date)] Watcher démarré, attend la fin du process FPI..." >> "$LOG"

# Attendre que le process FPI se termine
while pgrep -f "sec-download-v2.py.*fpi-tickers" > /dev/null; do
  sleep 60
done
echo "[$(date)] Cat 2 (FPI) terminé." >> "$LOG"

# Stats finales FPI
python3 -c "
import json
fpi = json.load(open('/Users/yann/spx-app/sec-data/_meta/cat2-fpi-v2-progress.json'))
print(f'FPI complétés : {len(fpi[\"completed\"])}')" >> "$LOG"

# Tuer le process cat 1 actuel (à 7 req/s)
echo "[$(date)] Kill du process cat 1 (rate 7 req/s)" >> "$LOG"
pkill -f "sec-download-v2.py --all --limit 2500"
sleep 5

# Relancer cat 1 à 9 req/s (rate-delay 0.11). Reprise via coverage.json.
echo "[$(date)] Relance cat 1 à 9 req/s" >> "$LOG"
cd /Users/yann/spx-app
nohup python3 scripts/sec-download-v2.py --all --limit 2500 \
  --rate-delay 0.11 \
  > sec-data/_meta/cat1-us-v2-run.log 2>&1 &

NEW_PID=$!
echo "[$(date)] Cat 1 relancé PID=$NEW_PID à 9 req/s" >> "$LOG"
echo "Done."
