#!/bin/bash
# Mise en ligne sur NIVEAU 1 (mettrik-niveau1.vercel.app) : vague sp5001000 SEULE.
# Decision de Yann du 9 oct 2026 : le Russell 1000 devient un indice couvert ; ses
# societes absentes de Mettrik sont d abord servies UNIQUEMENT ici. Le niveau 1
# ne montre QUE ces fiches (aucune societe de l univers principal, aucun outil),
# mettrik.ai et le niveau 2 n en montrent aucune tant que Yann n a pas dit « go ».
#
# Principe (modele : scripts/deploy-niveau2.sh) :
#  - deploiement PREVIEW construit depuis une COPIE du depot (fichiers suivis par
#    git dans leur etat du poste + fichiers nouveaux de src/, public/ et des KH),
#    car les fiches de la vague ne sont pas commitees. Aucun commit, aucun push ;
#  - variable UNIVERS=sp5001000 posee sur CE deploiement seulement (--env et
#    --build-env), jamais dans les variables du projet Vercel (controle rouge de
#    scripts/verif-release.py) ;
#  - controles sur l adresse du deploiement AVANT l alias, puis sur l alias :
#    une societe existante (/nvda) n est pas servie, une fiche prete l est ;
#  - mettrik.ai (niveau 0) et mettrik-niveau2.vercel.app ne sont JAMAIS touches.
#
# Usage : bash scripts/deploy-niveau1.sh            (au moins 5 fiches pretes)
#         N1_MIN=1 bash scripts/deploy-niveau1.sh   (seuil abaisse, essai)
#         N1_TEST=snow bash scripts/deploy-niveau1.sh (fiche controlee, sinon la 1re prete)
set -euo pipefail
cd /Users/yann/spx-app
TOKEN=$(grep "^VERCEL_TOKEN=" .env.local | cut -d= -f2)
AUDIT=$(grep "^VISUAL_AUDIT_TOKEN=" .env.local | cut -d= -f2 | tr -d '"')
TEAM=team_3A8Ft1Kze0wYzGbuyHmsaEwC
ALIAS=mettrik-niveau1.vercel.app
MIN=${N1_MIN:-5}

# 1) Fiches pretes (src/data/univers-sp5001000.json, ecrit par scripts/sp5001000-onboard.py)
NB=$(python3 -c "import json;print(len(json.load(open('src/data/univers-sp5001000.json'))['tickers']))")
if [ "$NB" -lt "$MIN" ]; then
  echo "REFUS : $NB fiche(s) prete(s) dans univers-sp5001000.json, il en faut au moins $MIN (python3 scripts/sp5001000-onboard.py)."
  exit 1
fi
# Chaque fiche listee doit etre presente et a nous (un agent peut avoir efface un fichier
# temporaire du meme nom) : sinon relancer l onboarding, qui retire les fiches absentes.
python3 - <<'PY' || { echo "REFUS : liste du niveau 1 incoherente, relancer python3 scripts/sp5001000-onboard.py"; exit 1; }
import json, os, sys
d = json.load(open("src/data/univers-sp5001000.json"))
ko = []
for t in d["tickers"]:
    pl = f"src/data/v2-pipeline/{t.lower()}.json"
    try:
        ok = os.path.basename(pl) in os.listdir(os.path.dirname(pl)) and isinstance(json.load(open(pl)).get("_sp5001000"), dict)
    except Exception:
        ok = False
    kh = f".batches-drafts-safe/kpis-haut/{t}.json"
    if not ok or t + ".json" not in os.listdir(os.path.dirname(kh)):
        ko.append(t)
if ko:
    print("fiches absentes ou remplacees :", ", ".join(ko))
    sys.exit(1)
PY
TEST=$(python3 -c "
import json,os
d=json.load(open('src/data/univers-sp5001000.json'))
t=os.environ.get('N1_TEST','').upper()
print((t if t in d['tickers'] else ('SNOW' if 'SNOW' in d['tickers'] else d['tickers'][0])).lower())")
echo "niveau 1 : $NB fiche(s) prete(s), fiche de controle /$TEST"

# 2) Disque (la copie du depot fait ~1 Go) et typage
LIBRE=$(df -k /System/Volumes/Data | awk 'NR==2{print int($4/1048576)}')
[ "$LIBRE" -ge 4 ] || { echo "REFUS : $LIBRE Go libres sur le disque (4 Go minimum)."; exit 1; }
npx tsc --noEmit -p tsconfig.json || { echo "REFUS : erreurs de typage (npx tsc --noEmit)."; exit 1; }

# 3) Copie de travail (supprimee a la fin)
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/mettrik-n1.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
python3 - "$STAGE" <<'PY'
import os, shutil, subprocess, sys
stage = sys.argv[1]
# Ce que lit le build et l execution (memes regles que .vercelignore et
# outputFileTracingExcludes de next.config.ts) : fichiers a la racine, src/, public/,
# docs/ (cahier lu par le chargeur), drafts kpis-haut, fichiers de premier niveau de
# .conv-state/ (att-state.json, earnings-refresh-state.json...). Rien d autre.
RACINES = ("src/", "public/", "docs/", ".batches-drafts-safe/kpis-haut/")
EXCLUS = ("src/data/companies/", "src/data/v2-pipeline-i18n/", "src/data/v1-9-complete/")
def retenu(rel):
    if rel.endswith((".log", ".DS_Store")) or rel.startswith(EXCLUS):
        return False
    if "/" not in rel:
        return True
    if rel.startswith(".conv-state/"):
        return rel.count("/") == 1
    return rel.startswith(RACINES)
def liste(args):
    out = subprocess.run(["git", "ls-files", "-z", *args], capture_output=True, check=True).stdout
    return [p for p in out.decode("utf-8", "surrogateescape").split("\0") if p]
suivis = liste([])
nouveaux = liste(["--others", "--exclude-standard", "--", "src", "public", ".batches-drafts-safe/kpis-haut"])
n = 0
for rel in dict.fromkeys(suivis + nouveaux):
    if not retenu(rel):
        continue
    src = os.path.join(os.getcwd(), rel)
    if not os.path.lexists(src) or os.path.isdir(src):
        continue  # fichier supprime du poste
    dst = os.path.join(stage, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cible = os.path.realpath(src) if os.path.islink(src) else src
    if not os.path.isfile(cible):
        continue
    shutil.copy2(cible, dst)
    n += 1
os.makedirs(os.path.join(stage, ".vercel"), exist_ok=True)
shutil.copy2(".vercel/project.json", os.path.join(stage, ".vercel/project.json"))
print(f"copie de travail : {n} fichiers")
PY
du -sh "$STAGE" | awk '{print "taille de la copie : "$1}'

# 4) Deploiement preview avec la variable d univers (sans attendre la fin du build)
echo "envoi vers Vercel (preview, UNIVERS=sp5001000)..."
URL=$(cd "$STAGE" && npx vercel deploy --archive=tgz --yes --no-wait --token "$TOKEN" --scope $TEAM \
  --env UNIVERS=sp5001000 --build-env UNIVERS=sp5001000 \
  --env NEXT_PUBLIC_DEPLOY_TARGET=staging --build-env NEXT_PUBLIC_DEPLOY_TARGET=staging \
  --meta niveau=1 --meta univers=sp5001000 2>/dev/null | grep -Eo 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
[ -n "$URL" ] || { echo "ECHEC : adresse du deploiement introuvable."; exit 1; }
HOTE=${URL#https://}
echo "deploiement $HOTE : attente du build..."
for i in $(seq 1 120); do
  ETAT=$(curl -s "https://api.vercel.com/v13/deployments/$HOTE?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import json,sys; print(json.loads(sys.stdin.read(),strict=False).get('readyState',''))" 2>/dev/null || true)
  case "$ETAT" in
    READY) break;;
    ERROR|CANCELED) echo "BUILD EN ECHEC ($ETAT) : $URL ; alias $ALIAS inchange."; exit 1;;
  esac
  sleep 30
done
[ "${ETAT:-}" = "READY" ] || { echo "TIMEOUT : build non termine ; alias $ALIAS inchange."; exit 1; }

# 5) Controles sur l adresse du deploiement AVANT de deplacer l alias
titre() { curl -s -m 90 "$1/$2?audit_token=$AUDIT&cb=$RANDOM" | grep -o '<title>[^<]*</title>' | head -1; }
controle() {
  local base=$1 ok=1
  local t_nvda t_test code_sb
  t_nvda=$(titre "$base" nvda)
  t_test=$(titre "$base" "$TEST")
  code_sb=$(curl -s -o /dev/null -w "%{http_code}" "$base/sandbox/v1-9-5")
  echo "  /nvda    -> ${t_nvda:-sans titre}"
  echo "  /$TEST -> ${t_test:-sans titre}"
  echo "  /sandbox/v1-9-5 -> HTTP $code_sb"
  case "$t_nvda" in *"(NVDA)"*) echo "  ERREUR : une societe de l univers principal est servie"; ok=0;; esac
  case "$t_test" in *"($(echo "$TEST" | tr a-z A-Z))"*) ;; *) echo "  ERREUR : la fiche /$TEST n est pas servie"; ok=0;; esac
  [ "$code_sb" = "404" ] || { echo "  ERREUR : l outillage repond"; ok=0; }
  [ $ok = 1 ]
}
echo "controles sur $URL :"
controle "$URL" || { echo "CONTROLES EN ECHEC : alias $ALIAS inchange ($URL reste consultable)."; exit 1; }

# 6) Alias niveau 1 puis memes controles sur l alias
npx vercel alias set "$URL" $ALIAS --token "$TOKEN" --scope $TEAM >/dev/null
echo "NIVEAU 1 = $HOTE (UNIVERS=sp5001000, $NB fiches). mettrik.ai et niveau 2 inchanges."
echo "controles sur https://$ALIAS :"
controle "https://$ALIAS" || { echo "CONTROLES EN ECHEC SUR L ALIAS"; exit 1; }
echo "OK"
