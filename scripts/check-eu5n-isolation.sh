#!/usr/bin/env bash
# check-eu5n-isolation.sh
# Vérifie l'étanchéité du cohort EU5+N vs V1.9.5.
# - Liste les tickers EU5+N exclusifs (231) qui NE doivent PAS apparaître dans src/data/v1-9-*.json
# - Liste les tickers du shared (67) qui peuvent légitimement apparaître dans V1.9.5
# - Identifie tout chemin sec-data/cat3-european/<ticker EU5+N exclusif>/ référencé par mégarde
#
# Sortie : /tmp/eu5n-isolation-check.txt
# Code retour : 0 si étanche, 1 si fuite détectée.

set -uo pipefail

ROOT="/Users/yann/spx-app"
DATA_DIR="${ROOT}/src/data"
MANIFEST="${ROOT}/sec-data/_meta/eu5n-cohort.json"
OVERLAP_JSON="${ROOT}/sec-data/_meta/eu5n-vs-v195-overlap.json"
REPORT="/tmp/eu5n-isolation-check.txt"

: > "${REPORT}"

log() {
    echo "$*" | tee -a "${REPORT}"
}

log "================================================================"
log "VÉRIFICATION ÉTANCHÉITÉ EU5+N vs V1.9.5"
log "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "================================================================"

if [[ ! -f "${MANIFEST}" ]]; then
    log "ERREUR : manifest absent ${MANIFEST}"
    exit 2
fi
if [[ ! -f "${OVERLAP_JSON}" ]]; then
    log "ERREUR : overlap JSON absent ${OVERLAP_JSON}"
    exit 2
fi

# Liste des tickers EU5+N EXCLUSIFS (231 stés) — ceux qu'on veut ABSOLUMENT pas voir dans V1.9.5
EXCL_LIST=$(mktemp)
jq -r '.v195_overlap.eu5n_only[]' "${MANIFEST}" > "${EXCL_LIST}"
EXCL_COUNT=$(wc -l < "${EXCL_LIST}" | tr -d ' ')
log ""
log "Tickers EU5+N EXCLUSIFS (à ne pas trouver dans V1.9.5) : ${EXCL_COUNT}"

# Liste shared (légitime)
SHARED_LIST=$(mktemp)
jq -r '.v195_overlap.shared[]' "${MANIFEST}" > "${SHARED_LIST}"
SHARED_COUNT=$(wc -l < "${SHARED_LIST}" | tr -d ' ')
log "Tickers shared (V1.9.5 ∩ EU5+N, légitimes)             : ${SHARED_COUNT}"
log ""

# 1) Scan des fichiers V1.9.5 CRITIQUES (production publishable) pour références EU5+N exclusifs
# Note : on ne scanne PAS tous les v1-9-*.json (la plupart sont des audits diagnostiques qui
# listent légitimement les stés hors V1.9.5). On scanne uniquement les fichiers qui ALIMENTENT
# la prod V1.9.5 publiable.
log "------------------------------------------------"
log "Étape 1 : recherche références EXCLUSIVES EU5+N dans fichiers V1.9.5 production"
log "------------------------------------------------"

# Liste des fichiers qui définissent la prod V1.9.5 publiable
PROD_FILES=(
    "${DATA_DIR}/v1-9-publishable-strict.json"
    "${DATA_DIR}/v1-9-publishable.json"
    "${DATA_DIR}/v1-9-publishable-195-listing.json"
    "${DATA_DIR}/v1-9-publishable-details.json"
    "${DATA_DIR}/v1-9-5-clean-all-tickers.json"
)

LEAKS=$(mktemp)
: > "${LEAKS}"

# Construit un pattern grep : tickers EU5+N exclusifs entre guillemets
PATTERN_FILE=$(mktemp)
while read -r tk; do
    printf '"%s"\n' "${tk}"
done < "${EXCL_LIST}" > "${PATTERN_FILE}"

log "Fichiers production V1.9.5 scannés : ${#PROD_FILES[@]}"

for f in "${PROD_FILES[@]}"; do
    [[ ! -f "${f}" ]] && { log "  (absent) $(basename "${f}")"; continue; }
    fname=$(basename "${f}")
    matches=$(grep -Ff "${PATTERN_FILE}" "${f}" 2>/dev/null || true)
    if [[ -n "${matches}" ]]; then
        leaked_tickers=$(echo "${matches}" | grep -oE '"[A-Z0-9-]+\.(PA|DE|MI|SW|AS|ST|CO|HE|OL)"' | sort -u | tr -d '"' | grep -Ff "${EXCL_LIST}" || true)
        if [[ -n "${leaked_tickers}" ]]; then
            log "  FUITE PROD dans ${fname} :"
            while IFS= read -r tk; do
                log "    - ${tk}"
                echo "${fname}:${tk}" >> "${LEAKS}"
            done <<< "${leaked_tickers}"
        else
            log "  OK ${fname} (aucun EU5+N exclusif)"
        fi
    else
        log "  OK ${fname} (aucun EU5+N exclusif)"
    fi
done

LEAK_COUNT=$(wc -l < "${LEAKS}" | tr -d ' ')
log ""
if [[ "${LEAK_COUNT}" -eq 0 ]]; then
    log "  OK : aucune fuite EU5+N exclusif dans les fichiers production V1.9.5"
else
    log "  ALERTE : ${LEAK_COUNT} fuite(s) détectée(s) dans la prod"
fi

# 1bis) Info supplémentaire : présence dans l'univers global V1.9 (990 stés)
log ""
log "Info : présence EU5+N exclusifs dans v1-9-universe.json (univers global, pas la prod)"
UNI_FILE="${DATA_DIR}/v1-9-universe.json"
if [[ -f "${UNI_FILE}" ]]; then
    uni_overlap=$(grep -oE '"[A-Z0-9-]+\.(PA|DE|MI|SW|AS|ST|CO|HE|OL)"' "${UNI_FILE}" | sort -u | tr -d '"' | grep -Ff "${EXCL_LIST}" | wc -l | tr -d ' ')
    log "  ${uni_overlap} tickers EU5+N exclusifs présents dans l'univers V1.9 (990 stés total)"
    log "  → Normal : univers ≠ prod publiable. La prod est filtrée via publishable-strict (663)."
fi

# 2) Recherche chemins sec-data/cat3-european/<EXCL_TICKER> dans src/ (TS/JSON)
log ""
log "------------------------------------------------"
log "Étape 2 : recherche chemins sec-data/cat3-european/<EXCL_TICKER> dans src/"
log "------------------------------------------------"

PATH_LEAKS=$(mktemp)
: > "${PATH_LEAKS}"

# On scanne uniquement les fichiers source de routes / loaders, pas les data files
ROUTE_FILES=$(find "${ROOT}/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" \) 2>/dev/null)
ROUTE_COUNT=$(echo "${ROUTE_FILES}" | wc -l | tr -d ' ')
log "Fichiers source TS/JS scannés : ${ROUTE_COUNT}"

# Pattern : "cat3-european/<ticker>" ou "/cat3-european/<ticker>"
PATH_PATTERN=$(mktemp)
while read -r tk; do
    printf 'cat3-european/%s\n' "${tk}"
done < "${EXCL_LIST}" > "${PATH_PATTERN}"

# Search in chunks pour éviter d'exploser la RAM
for f in ${ROUTE_FILES}; do
    matches=$(grep -Ff "${PATH_PATTERN}" "${f}" 2>/dev/null || true)
    if [[ -n "${matches}" ]]; then
        rel=${f#${ROOT}/}
        log "  RÉFÉRENCE dans ${rel} :"
        echo "${matches}" | head -3 | while IFS= read -r line; do
            log "    > ${line:0:120}"
        done
        echo "${rel}" >> "${PATH_LEAKS}"
    fi
done

PATH_LEAK_COUNT=$(wc -l < "${PATH_LEAKS}" | tr -d ' ')
log ""
if [[ "${PATH_LEAK_COUNT}" -eq 0 ]]; then
    log "  OK : aucune route src/ ne référence un ticker EU5+N exclusif sous cat3-european/"
else
    log "  ALERTE : ${PATH_LEAK_COUNT} fichier(s) source(s) référencent EU5+N exclusif"
fi

# 3) Résumé
log ""
log "================================================================"
log "RÉSUMÉ ÉTANCHÉITÉ"
log "================================================================"
log "Cohorte EU5+N totale       : 298 stés"
log "Shared avec V1.9.5         : ${SHARED_COUNT} (légitime)"
log "EU5+N exclusifs            : ${EXCL_COUNT} (à isoler)"
log "Fuites JSON v1-9-*         : ${LEAK_COUNT}"
log "Fuites routes src/         : ${PATH_LEAK_COUNT}"

TOTAL_LEAKS=$((LEAK_COUNT + PATH_LEAK_COUNT))
log ""
if [[ "${TOTAL_LEAKS}" -eq 0 ]]; then
    log "VERDICT : ÉTANCHE — aucune contamination détectée"
    log "================================================================"
    log "Rapport sauvegardé : ${REPORT}"
    rm -f "${EXCL_LIST}" "${SHARED_LIST}" "${LEAKS}" "${PATTERN_FILE}" "${PATH_LEAKS}" "${PATH_PATTERN}"
    exit 0
else
    log "VERDICT : FUITES (${TOTAL_LEAKS}) — décision Yann requise"
    log "Pour chaque fuite, soit :"
    log "  a) Ajouter le ticker au v195_overlap.shared (intégration explicite V1.9.5)"
    log "  b) Retirer la référence du code/data V1.9.5"
    log "================================================================"
    log "Rapport sauvegardé : ${REPORT}"
    rm -f "${EXCL_LIST}" "${SHARED_LIST}" "${LEAKS}" "${PATTERN_FILE}" "${PATH_LEAKS}" "${PATH_PATTERN}"
    exit 1
fi
