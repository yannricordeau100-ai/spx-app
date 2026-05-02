#!/bin/bash
# Watchdog rate-limit cat1 : si > 5 erreurs 429 dans 90s, descend à 9.7 req/s ;
# si > 5 erreurs 429 encore après ce changement, descend à 9.5 req/s ;
# si encore → 9.0 req/s. Plus aucune redescente après ça.
#
# Pattern d'erreur recherché : "429" ou "Too Many Requests" dans /tmp/cat1.log

LOG_FILE=/tmp/cat1.log
WATCHDOG_LOG=/Users/yann/spx-app/sec-data/_meta/cat1-rate-watchdog.log
RATES=("0.103" "0.105" "0.111")  # 9.7 → 9.5 → 9.0 req/s
RATE_LABELS=("9.7" "9.5" "9.0")
THRESHOLD=5    # nb d'erreurs 429 avant downgrade
WINDOW=90      # fenêtre temporelle en secondes
CHECK_EVERY=30 # poll toutes les 30s

LEVEL=0
echo "[$(date)] Watchdog démarré — surveille 429 dans $LOG_FILE" >> "$WATCHDOG_LOG"

while true; do
  sleep "$CHECK_EVERY"

  # cat1 toujours actif ?
  if ! pgrep -f "sec-download-v2.py --all --limit 2500" > /dev/null; then
    echo "[$(date)] cat1 stoppé, watchdog s'arrête." >> "$WATCHDOG_LOG"
    exit 0
  fi

  # Compter les 429 dans la fenêtre récente (dernières $WINDOW secondes)
  if [ ! -f "$LOG_FILE" ]; then continue; fi

  # Sélectionne lignes du log modifiées dans la fenêtre via tail timestamp
  recent=$(tail -500 "$LOG_FILE" 2>/dev/null | grep -cE "429|Too Many Requests|Status: 429")

  if [ "$recent" -ge "$THRESHOLD" ] && [ "$LEVEL" -lt "${#RATES[@]}" ]; then
    new_rate="${RATES[$LEVEL]}"
    new_label="${RATE_LABELS[$LEVEL]}"
    echo "[$(date)] $recent erreurs 429 détectées → downgrade à $new_label req/s (rate-delay $new_rate)" >> "$WATCHDOG_LOG"

    # Kill cat1 et relance avec nouvelle rate
    pkill -f "sec-download-v2.py --all --limit 2500"
    sleep 3
    cd /Users/yann/spx-app
    nohup python3 scripts/sec-download-v2.py --all --limit 2500 --rate-delay "$new_rate" > "$LOG_FILE" 2>&1 &
    new_pid=$!
    echo "[$(date)] cat1 relancé PID=$new_pid à $new_label req/s" >> "$WATCHDOG_LOG"

    LEVEL=$((LEVEL + 1))
    sleep 60  # laisse le temps d'observer avant next check
  fi
done
