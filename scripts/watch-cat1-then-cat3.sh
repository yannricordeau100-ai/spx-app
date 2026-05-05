#!/bin/bash
# Watcher : attend la fin de cat1, puis lance cat3 (eu-download.py).
# Log : /Users/yann/spx-app/sec-data/_meta/watch-cat1-then-cat3.log
# Sentinelles : /tmp/cat1-done.flag /tmp/cat3-done.flag

LOG=/Users/yann/spx-app/sec-data/_meta/watch-cat1-then-cat3.log
FLAG_CAT1=/tmp/cat1-done.flag
FLAG_CAT3=/tmp/cat3-done.flag
rm -f "$FLAG_CAT1" "$FLAG_CAT3"

echo "[$(date)] Watcher démarré, attend fin cat1..." >> "$LOG"

# Attendre que cat1 finisse
while pgrep -f "sec-download-v2.py --all --limit 2500" > /dev/null; do
  sleep 120
done

echo "[$(date)] Cat1 terminé." >> "$LOG"
python3 -c "
import json
d = json.load(open('/Users/yann/spx-app/sec-data/_meta/cat1-us-v2-progress.json'))
print(f'Cat1 final : {len(d[\"completed\"])}/2500 completed')
" >> "$LOG"
touch "$FLAG_CAT1"

# Lancer cat3 (eu-download.py)
echo "[$(date)] Lancement cat3 (eu-download.py)..." >> "$LOG"
cd /Users/yann/spx-app
nohup python3 scripts/eu-download.py >> "$LOG" 2>&1 &
CAT3_PID=$!
echo "[$(date)] Cat3 PID=$CAT3_PID" >> "$LOG"

# Attendre fin cat3
while pgrep -f "eu-download.py" > /dev/null; do
  sleep 120
done

echo "[$(date)] Cat3 terminé." >> "$LOG"
python3 -c "
import json
try:
    d = json.load(open('/Users/yann/spx-app/sec-data/_meta/cat3-_progress.json'))
    print(f'Cat3 final : {len(d.get(\"completed\",[]))} completed, {len(d.get(\"failed\",[]))} failed')
except Exception as e:
    print(f'Cat3 progress lookup failed: {e}')
" >> "$LOG"
touch "$FLAG_CAT3"
echo "[$(date)] Watcher Done." >> "$LOG"
