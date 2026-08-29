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
# cron ne transmet ni USER ni LOGNAME. Sans eux, le CLI Claude ne retrouve pas
# ses identifiants dans le trousseau macOS et repond "Not logged in" avec un
# code de retour 0. C est ce qui a fait tomber la passe du 27 aout dans le mode
# dossier : 694 dossiers ecrits, aucun point extrait.
export USER="${USER:-$(id -un)}"
export LOGNAME="$USER"
{
  echo "=== $(date '+%F %T') veille US ==="
  nice -n 10 python3 scripts/daily-doc-watcher.py
  echo "=== $(date '+%F %T') veille EU ==="
  nice -n 10 python3 scripts/fr-doc-watcher.py
  echo "=== $(date '+%F %T') extraction ==="
  nice -n 10 python3 scripts/earnings-refresh.py --apply
  echo "=== $(date '+%F %T') controle des publications attendues ==="
  # Compare le calendrier des resultats a ce qui est reellement tombe dans le
  # data-lake. Sans ce controle, une publication captee par personne passe
  # totalement inapercue. Purement mecanique, aucun appel LLM ni reseau.
  nice -n 10 python3 scripts/verifie-publications.py
  echo "=== $(date '+%F %T') fin ==="
} >> /tmp/earnings-refresh.log 2>&1
