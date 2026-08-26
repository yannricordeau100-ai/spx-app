#!/bin/bash
# Cron quotidien : mise a jour de tous les KPI apres publications (Yann 26 aout 2026).
# Ordre : les watchers (04h/04h30/05h15) ont deja telecharge les nouveaux
# documents ; ici on extrait et on ecrit les points. La session Claude Code
# locale sert de moteur (profil MAX 20x ~/.claude-20x si present).
cd /Users/yann/spx-app || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin"
python3 scripts/earnings-refresh.py --apply >> /tmp/earnings-refresh.log 2>&1
