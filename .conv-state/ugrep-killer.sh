#!/bin/bash
# Tue les ugrep > 512MB toutes les 10s (protection RAM pendant workflows)
while true; do
  for p in $(pgrep ugrep 2>/dev/null); do
    rss=$(ps -o rss= -p "$p" 2>/dev/null)
    if [ "${rss:-0}" -gt 524288 ]; then
      kill "$p" 2>/dev/null
      echo "$(date +%H:%M:%S) killed $p ($((rss/1024))MB)" >> /Users/yann/spx-app/.conv-state/ugrep-killer.log
    fi
  done
  sleep 10
done
