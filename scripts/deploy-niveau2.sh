#!/bin/bash
# Mise en ligne sur NIVEAU 2 (mettrik-niveau2.vercel.app) : Yann 3 sept 2026.
# Principe de non-contamination : niveau2 = alias vers le deploiement PREVIEW
# du commit courant de la branche staging. mettrik.ai (niveau 0) n est JAMAIS
# touche ici : il ne bouge que par scripts/go-n0.sh, sur ordre explicite.
set -euo pipefail
cd /Users/yann/spx-app
TOKEN=$(grep "^VERCEL_TOKEN=" .env.local | cut -d= -f2)
TEAM=team_3A8Ft1Kze0wYzGbuyHmsaEwC
# Inventaire de la structure (page /sandbox/structure) toujours a jour : regenere et
# commite si quelque chose a change (routes, API, tables, crons).
# La date de generation change a chaque passage : on ne commite que si le
# CONTENU a bouge (sinon un commit inutile a chaque mise en ligne).
python3 scripts/build-structure-map.py >/dev/null 2>&1 || true
if git diff --unified=0 -- src/data/_structure-map.json | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -qv "genere_le"; then
  git add src/data/_structure-map.json && git commit -q -m "structure : inventaire regenere"
else
  git checkout -- src/data/_structure-map.json 2>/dev/null || true
fi
# Totaux des KPI (accueil + /sandbox/comptes-kpi), Yann 8 oct 2026 : recalcules
# sur les fiches reellement servies a chaque mise en ligne, commites si un
# chiffre a bouge. En cas d echec (garde-fous du script), l ancien fichier reste.
if npx tsx scripts/genere-comptes-kpi.ts 2>/dev/null | tail -3; then
  if git diff --unified=0 -- src/data/kpi-comptes-industries.json | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -qvE '"(maj|genere_le)"'; then
    git add src/data/kpi-comptes-industries.json && git commit -q -m "comptes KPI : totaux recalcules"
  else
    git checkout -- src/data/kpi-comptes-industries.json 2>/dev/null || true
  fi
else
  echo "comptes KPI : calcul refuse, ancien fichier garde"
  git checkout -- src/data/kpi-comptes-industries.json 2>/dev/null || true
fi
# Accueil et carte des pays (8 oct 2026) : regeneres a chaque mise en ligne a
# partir des KPI REELLEMENT servis par les fiches, pour qu ils ne divergent jamais.
if python3 scripts/build-home-wow.py >/dev/null 2>&1; then
  if ! git diff --quiet -- src/data/home-wow-kpis.json src/data/carte-pays-kpis.json; then
    git add src/data/home-wow-kpis.json src/data/carte-pays-kpis.json && git commit -q -m "accueil : KPI regeneres depuis les fiches servies"
  fi
else
  echo "ATTENTION : build-home-wow.py a echoue, accueil non regenere" >&2
fi
SHA=$(git rev-parse HEAD)
git push origin HEAD >/dev/null 2>&1 || true
echo "commit $SHA : attente du build preview..."
for i in $(seq 1 90); do
  OUT=$(curl -s "https://api.vercel.com/v6/deployments?app=mettrik&limit=8&teamId=$TEAM" -H "Authorization: Bearer $TOKEN")
  URL=$(printf '%s' "$OUT" | python3 -c "
import json,sys
for d in json.loads(sys.stdin.read(),strict=False)['deployments']:
    if d.get('meta',{}).get('githubCommitSha')=='$SHA' and d.get('target')!='production':
        print(d['state']+' '+d['url']); break")
  case "$URL" in
    READY*) PREVIEW=${URL#READY }; break;;
    ERROR*) echo "BUILD EN ERREUR : $URL"; exit 1;;
  esac
  sleep 30
done
[ -n "${PREVIEW:-}" ] || { echo "TIMEOUT : preview introuvable"; exit 1; }
npx vercel alias set "https://$PREVIEW" mettrik-niveau2.vercel.app >/dev/null
echo "NIVEAU 2 = $PREVIEW (commit $SHA). mettrik.ai inchange."
curl -s -o /dev/null -w "niveau2 health: %{http_code}\n" https://mettrik-niveau2.vercel.app/api/billing/health
