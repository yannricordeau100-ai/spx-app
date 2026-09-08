#!/usr/bin/env bash
# Pre-chauffage des fiches apres un deploiement (8 sept 2026, chantier lenteur).
# Le cache partage des fiches (unstable_cache, cle = VERSION) est vide apres
# chaque mise en ligne : la premiere ouverture d une fiche coute 2 a 6 s. On
# ouvre ici les N plus grosses capitalisations (ordre src/data/market-cap-order.json)
# en tier max, 4 a la fois, pour que les visiteurs trouvent des fiches chaudes.
# Usage : bash scripts/prechauffe-fiches.sh [hote] [N]   (defaut : niveau2, 120)
set -u
cd "$(dirname "$0")/.."
HOTE=${1:-https://mettrik-niveau2.vercel.app}; N=${2:-120}
python3 -c "import json;print('\n'.join(json.load(open('src/data/market-cap-order.json'))['tickers'][:$N]))" \
 | xargs -P 4 -I{} sh -c 'curl -s -o /dev/null -b "mettrik:simulate-as=max" -w "{} %{http_code} %{time_total}s\n" "'"$HOTE"'/sandbox/v1-9-5/$(echo {} | tr "[:upper:]" "[:lower:]")"'
echo "PRECHAUFFAGE TERMINE ($N fiches sur $HOTE)"
