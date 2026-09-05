#!/usr/bin/env bash
# Attend que Vercel ait construit le commit courant (HEAD) puis pointe mettrik-niveau2.vercel.app dessus.
# Usage : nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &
set -u
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD); TEAM=team_3A8Ft1Kze0wYzGbuyHmsaEwC
for i in $(seq 1 90); do
  # 6 sept 2026 : le jeton de session du CLI (auth.json) peut etre refuse par l API ("invalidToken") ;
  # on prend d abord le jeton d acces VERCEL_TOKEN de .env.local, sinon celui du CLI.
  TOK=$(grep -o '^VERCEL_TOKEN=[^ ]*' .env.local 2>/dev/null | cut -d= -f2)
  [ -z "$TOK" ] && TOK=$(python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
  R=$(curl -s "https://api.vercel.com/v6/deployments?teamId=$TEAM&limit=6&app=mettrik" -H "Authorization: Bearer $TOK" | python3 -c "
import sys,json; d=json.load(sys.stdin)
for x in d.get('deployments',[]):
    if x.get('meta',{}).get('githubCommitSha')=='$SHA': print(x['state'], x['url']); break
else: print('ABSENT')")
  case "$R" in
    READY*) U=${R#READY }; npx vercel alias set "https://$U" mettrik-niveau2.vercel.app --scope $TEAM 2>&1 | tail -1; echo "NIVEAU 2 A JOUR sur $U ($SHA)"; exit 0;;
    ERROR*|CANCELED*) echo "ECHEC $R"; exit 1;;
  esac
  sleep 20
done
echo TIMEOUT
