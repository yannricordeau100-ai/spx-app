#!/bin/bash
# Mise en ligne sur NIVEAU 2 (mettrik-niveau2.vercel.app) : Yann 3 sept 2026.
# Principe de non-contamination : niveau2 = alias vers un deploiement du commit
# courant de la branche staging, construit en cible production SANS domaine
# (14 oct 2026, voir plus bas). mettrik.ai (niveau 0) n est JAMAIS touche ici :
# il ne bouge que par scripts/go-n0.sh, sur ordre explicite (controle avant/apres).
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
# 14 oct 2026 (facture Vercel) : niveau2 est construit UNE fois, en cible PRODUCTION
# SANS attribution de domaine (equivalent API de « vercel deploy --prod --skip-domain »,
# champ autoAssignCustomDomains=false). mettrik.ai ne bouge pas ; scripts/go-n0.sh le
# promeut ensuite instantanement, sans recompilation (avant : ~35 min de build en plus).
# Les pushes ordinaires ne construisent plus rien (ignoreCommand de vercel.json).
# Repli : N2_CIBLE=preview bash scripts/deploy-niveau2.sh (ancien chemin : commit [build],
# preview du push, go n0 recompile alors en production).
CIBLE=${N2_CIBLE:-production}
BRANCHE=$(git branch --show-current)
[ "$BRANCHE" = "staging" ] || { echo "REFUS : branche $BRANCHE, niveau2 se construit depuis staging."; exit 1; }
alias_de() { npx vercel alias ls --token "$TOKEN" --scope $TEAM 2>/dev/null | awk -v n="$1" '$2==n{print $1}' | head -1; }
N0_AVANT=$(alias_de mettrik.ai)
[ -n "$N0_AVANT" ] || { echo "REFUS : alias mettrik.ai illisible (controle de non-contamination impossible)."; exit 1; }

if [ "$CIBLE" = "preview" ]; then
  git commit -q --allow-empty -m "[build] niveau2 $(date +%Y-%m-%dT%H:%M)"
  SHA=$(git rev-parse HEAD)
  git push origin HEAD >/dev/null 2>&1 || true
  echo "commit $SHA : attente du build preview..."
  for i in $(seq 1 120); do
    OUT=$(curl -s "https://api.vercel.com/v6/deployments?app=mettrik&limit=8&teamId=$TEAM" -H "Authorization: Bearer $TOKEN")
    URL=$(printf '%s' "$OUT" | python3 -c "
import json,sys
for d in json.loads(sys.stdin.read(),strict=False)['deployments']:
    if d.get('meta',{}).get('githubCommitSha')=='$SHA' and d.get('target')!='production':
        print(d['state']+' '+d['url']); break")
    case "$URL" in
      READY*) DEP=${URL#READY }; break;;
      ERROR*|CANCELED*) echo "BUILD EN ERREUR : $URL"; exit 1;;
    esac
    sleep 30
  done
else
  SHA=$(git rev-parse HEAD)
  git push origin HEAD >/dev/null 2>&1 || true
  DISTANT=$(git ls-remote origin "refs/heads/$BRANCHE" | cut -f1)
  [ "$DISTANT" = "$SHA" ] || { echo "REFUS : origin/$BRANCHE = ${DISTANT:0:10}, local = ${SHA:0:10} (push refuse ?)."; exit 1; }
  PROJET=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['projectId'])")
  REPO=$(curl -s "https://api.vercel.com/v9/projects/$PROJET?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import json,sys;print(json.loads(sys.stdin.read(),strict=False)['link']['repoId'])")
  CORPS=$(python3 -c "
import json,sys
print(json.dumps({'name':'mettrik','project':'$PROJET','target':'production','autoAssignCustomDomains':False,
  'gitSource':{'type':'github','repoId':int('$REPO'),'ref':'$BRANCHE','sha':'$SHA'},'meta':{'niveau':'2'}}))")
  REP=$(curl -s -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM&skipAutoDetectionConfirmation=1" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$CORPS")
  read -r ID DEP TGT <<<"$(printf '%s' "$REP" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read(),strict=False)
print(d.get('id',''), d.get('url',''), d.get('target',''))")"
  [ -n "$ID" ] && [ "$TGT" = "production" ] || { echo "ECHEC de creation du deploiement : $(printf '%s' "$REP" | head -c 300)"; exit 1; }
  echo "commit $SHA : build production sans domaine $DEP (ETA 35 min)..."
  ETAT=""
  for i in $(seq 1 120); do
    ETAT=$(curl -s "https://api.vercel.com/v13/deployments/$ID?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import json,sys;print(json.loads(sys.stdin.read(),strict=False).get('readyState',''))" 2>/dev/null || true)
    case "$ETAT" in READY|ERROR|CANCELED) break;; esac
    # Garde-fou : mettrik.ai ne doit JAMAIS bouger pendant ce build.
    N0_COUR=$(alias_de mettrik.ai)
    [ -z "$N0_COUR" ] || [ "$N0_COUR" = "$N0_AVANT" ] || break
    sleep 30
  done
  [ "$ETAT" = "READY" ] || DEP=""
  [ -n "$DEP" ] || echo "BUILD $ID en etat ${ETAT:-inconnu}."
fi
# Garde-fou de non-contamination : si mettrik.ai a bouge, retour immediat a l ancien deploiement.
N0_APRES=$(alias_de mettrik.ai)
[ -n "$N0_APRES" ] || { sleep 10; N0_APRES=$(alias_de mettrik.ai); }
if [ -n "$N0_APRES" ] && [ "$N0_APRES" != "$N0_AVANT" ]; then
  echo "ALERTE : mettrik.ai est passe de $N0_AVANT a ${N0_APRES:-?}. Retour a $N0_AVANT..."
  npx vercel promote "https://$N0_AVANT" --yes --token "$TOKEN" --scope $TEAM 2>&1 | tail -2
  exit 1
fi
[ -n "${DEP:-}" ] || { echo "ECHEC : niveau2 inchange."; exit 1; }
npx vercel alias set "https://$DEP" mettrik-niveau2.vercel.app --token "$TOKEN" --scope $TEAM >/dev/null
echo "NIVEAU 2 = $DEP (commit $SHA, cible $CIBLE). mettrik.ai inchange ($N0_AVANT)."
curl -s -o /dev/null -w "niveau2 health: %{http_code}\n" https://mettrik-niveau2.vercel.app/api/billing/health
