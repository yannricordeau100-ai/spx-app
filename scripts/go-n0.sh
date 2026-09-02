#!/bin/bash
# OUVERTURE / MISE A JOUR DU SITE PUBLIC mettrik.ai (niveau 0) : Yann 3 sept 2026.
# Seule commande qui touche mettrik.ai. Elle promeut EXACTEMENT le deploiement
# actuellement servi sur niveau2 (meme build, pas de recompilation) apres la
# verification scripts/verif-release.py. Usage : bash scripts/go-n0.sh
set -euo pipefail
cd /Users/yann/spx-app
python3 scripts/verif-release.py --strict || { echo "VERIFICATION EN ECHEC : promotion refusee."; exit 1; }
TOKEN=$(grep "^VERCEL_TOKEN=" .env.local | cut -d= -f2)
TEAM=team_3A8Ft1Kze0wYzGbuyHmsaEwC
N2=$(npx vercel alias ls 2>/dev/null | awk '$2=="mettrik-niveau2.vercel.app"{print $1}' | head -1)
[ -n "$N2" ] || { echo "alias niveau2 introuvable"; exit 1; }
echo "Promotion en production de $N2 (identique a niveau2)..."
npx vercel promote "https://$N2" --yes 2>&1 | tail -2
for i in $(seq 1 40); do
  CUR=$(npx vercel alias ls 2>/dev/null | awk '$2=="mettrik.ai"{print $1}' | head -1)
  [ "$CUR" = "$N2" ] && break; sleep 15
done
echo "mettrik.ai = $(npx vercel alias ls 2>/dev/null | awk '$2=="mettrik.ai"{print $1}' | head -1)"
curl -s -o /dev/null -w "mettrik.ai health: %{http_code}\n" https://mettrik.ai/api/billing/health
