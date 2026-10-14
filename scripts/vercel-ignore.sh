#!/bin/bash
# Banc d essai de la commande « ignoreCommand » de vercel.json (code 0 = PAS de build, 1 = build).
# La commande executee par Vercel est ecrite EN LIGNE dans vercel.json, car .vercelignore
# retire /scripts du depot clone : un fichier de scripts/ peut ne pas exister a ce moment.
#
# 14 oct 2026 (Yann : facture Vercel, 52 $ de minutes de build en septembre pour 738
# deploiements). Plus AUCUN build automatique sur un push ordinaire :
#  - deploiement sans git (CLI depuis une copie : scripts/deploy-niveau1.sh) : build ;
#  - cible production : build seulement depuis la branche staging, c est a dire le
#    deploiement explicite de scripts/deploy-niveau2.sh (production SANS domaine).
#    Un push sur main ne construit jamais (il attribuerait mettrik.ai tout seul) ;
#  - preview (push sur staging ou une autre branche) : build seulement si le message
#    du commit contient [build].
#
# Usage : bash scripts/vercel-ignore.sh            (rejoue les 7 cas types)
set -u
cd "$(dirname "$0")/.."
CMD=$(python3 -c "import json;print(json.load(open('vercel.json'))['ignoreCommand'])")
cas() {  # attendu  sha  env  ref  message
  local r
  env -i PATH="$PATH" VERCEL_GIT_COMMIT_SHA="$2" VERCEL_ENV="$3" VERCEL_GIT_COMMIT_REF="$4" VERCEL_GIT_COMMIT_MESSAGE="$5" sh -c "$CMD"
  r=$?
  [ "$r" = "$1" ] && echo "ok   ($r) $3 $4 « $5 »" || { echo "FAUX ($r au lieu de $1) $3 $4 « $5 »"; return 1; }
}
ko=0
cas 1 ""       preview    ""      ""                                  || ko=1  # niveau 1 (CLI, sans git)
cas 1 abc123   production staging "niveau2 2026-10-14T10:00"          || ko=1  # deploy-niveau2.sh
cas 0 abc123   production main    "Cron quotidien : main reprend"     || ko=1  # push sur main
cas 0 abc123   preview    staging "data(freshness): daily refresh"    || ko=1  # cron quotidien
cas 0 abc123   preview    staging "Relais : message pour l autre compte" || ko=1
cas 0 abc123   preview    staging "Fiches : correction du hero"       || ko=1  # travail sur le code
cas 1 abc123   preview    staging "essai [build]"                     || ko=1  # preview demandee
exit $ko
