#!/bin/bash
# Chaine quotidienne 23h00 (heure du Mac, Europe/Zurich) — Yann 27 aout 2026.
# Le Mac n est quasiment jamais allume a l aube : les veilles documentaires
# sont donc rejouees ICI, juste avant l extraction, pour que la chaine soit
# complete en une seule fenetre du soir.
#   1. veille US (nouveaux depots SEC)
#   2. veille Europe (pages investisseurs, 124 stes)
#   3. extraction et ecriture des nouveaux points (moteur : session Claude
#      Code locale — profil ~/.claude-20x s il existe, sinon profil defaut)
cd /Users/yann/spx-app || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin"
{
  echo "=== $(date '+%F %T') veille US ==="
  nice -n 10 python3 scripts/daily-doc-watcher.py
  echo "=== $(date '+%F %T') veille EU ==="
  nice -n 10 python3 scripts/fr-doc-watcher.py
  echo "=== $(date '+%F %T') extraction ==="
  nice -n 10 python3 scripts/earnings-refresh.py --apply
  echo "=== $(date '+%F %T') fin ==="
} >> /tmp/earnings-refresh.log 2>&1
