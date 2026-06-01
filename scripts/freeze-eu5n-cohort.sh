#!/usr/bin/env bash
# freeze-eu5n-cohort.sh
# Freeze le cohort EU5+N (5/5 années 2020-2024) : manifest + tarball + SHA256 + readonly.
# Usage:
#   bash scripts/freeze-eu5n-cohort.sh              # exécution réelle
#   bash scripts/freeze-eu5n-cohort.sh --dry-run    # affiche sans rien faire
#
# Ne modifie JAMAIS les fichiers sources cat3-european/<TICKER>/annual-text/*.txt
# Ne modifie JAMAIS src/data/v1-9-*.json
# Tâche : prépare archive readonly étanche au cas où la cohorte doit être restaurée plus tard.

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
fi

ROOT="/Users/yann/spx-app"
SEC_DATA="${ROOT}/sec-data"
SRC_ROOT="${SEC_DATA}/cat3-european"
META_DIR="${SEC_DATA}/_meta"
BACKUP_DIR="${SEC_DATA}/_backups"
MANIFEST="${META_DIR}/eu5n-cohort.json"
TICKERS_FILE="/tmp/eu5n-cohort-5-5-tickers.txt"
DATE="$(date -u +%Y-%m-%d)"
TARBALL="${BACKUP_DIR}/eu5n-cohort-${DATE}.tar.gz"
SHA_FILE="${TARBALL}.sha256"

log() { printf "[%s] %s\n" "$(date -u +%H:%M:%S)" "$*"; }

if [[ ${DRY_RUN} -eq 1 ]]; then
    log "DRY RUN — aucune écriture, aucun chmod, aucun tar."
fi

# 1. Re-générer la liste des tickers à 5/5
log "Étape 1 : identification cohorte EU5+N à 5/5 (2020-2024)"
if [[ ${DRY_RUN} -eq 0 ]]; then
    : > "${TICKERS_FILE}"
fi
cd "${SRC_ROOT}"
count=0
for suffix in .PA .DE .MI .SW .AS .ST .CO .HE .OL; do
    for t in *"${suffix}"/; do
        [[ ! -d "${t}" ]] && continue
        c=$(ls -1 "${t}annual-text/" 2>/dev/null | grep -cE "^202[0-4]\.txt$" || true)
        if [[ "${c}" -eq 5 ]]; then
            count=$((count+1))
            if [[ ${DRY_RUN} -eq 0 ]]; then
                echo "${t%/}" >> "${TICKERS_FILE}"
            fi
        fi
    done
done
log "Cohorte identifiée : ${count} stés à 5/5"

# 2. Régénérer le manifest
log "Étape 2 : régénération du manifest cohort"
BUILDER="${ROOT}/scripts/build-eu5n-manifest.py"
if [[ ${DRY_RUN} -eq 0 ]]; then
    python3 "${BUILDER}" || {
        log "ERREUR : ${BUILDER} absent ou en échec."
        exit 1
    }
else
    log "[dry-run] python3 ${BUILDER} → ${MANIFEST}"
fi

# 3. Créer le tarball
log "Étape 3 : création tarball ${TARBALL}"
mkdir -p "${BACKUP_DIR}"

if [[ ${DRY_RUN} -eq 1 ]]; then
    bytes=$(awk '{print $1}' "${MANIFEST}" 2>/dev/null | head -1 || echo "?")
    log "[dry-run] tar -czf ${TARBALL} avec ${count} stés × 5 années + manifest"
    log "[dry-run] Estimation taille brute : ~$(du -ch $(awk '{print "cat3-european/"$0"/annual-text/"}' "${TICKERS_FILE}" 2>/dev/null) 2>/dev/null | tail -1 | awk '{print $1}' || echo "?")"
else
    cd "${SEC_DATA}"
    # construit la liste exacte des fichiers à inclure : 5 années × cohorte + manifest
    file_list=$(mktemp)
    while read -r tk; do
        for yr in 2020 2021 2022 2023 2024; do
            echo "cat3-european/${tk}/annual-text/${yr}.txt"
        done
    done < "${TICKERS_FILE}" > "${file_list}"
    echo "_meta/eu5n-cohort.json" >> "${file_list}"

    log "Création tarball ($(wc -l < "${file_list}") fichiers)…"
    tar -czf "${TARBALL}" -T "${file_list}"
    rm "${file_list}"
fi

# 4. SHA256 du tarball
log "Étape 4 : SHA256 du tarball"
if [[ ${DRY_RUN} -eq 0 ]]; then
    cd "${BACKUP_DIR}"
    shasum -a 256 "$(basename "${TARBALL}")" > "${SHA_FILE}"
    log "SHA256 → ${SHA_FILE}"
    cat "${SHA_FILE}"
else
    log "[dry-run] shasum -a 256 ${TARBALL} > ${SHA_FILE}"
fi

# 5. Lock readonly
log "Étape 5 : lock readonly (chmod 444)"
if [[ ${DRY_RUN} -eq 0 ]]; then
    chmod 444 "${TARBALL}" "${SHA_FILE}" "${MANIFEST}"
    log "Lock OK : ${TARBALL}, ${SHA_FILE}, ${MANIFEST} → 444"
else
    log "[dry-run] chmod 444 ${TARBALL} ${SHA_FILE} ${MANIFEST}"
fi

# 6. Résumé
echo
echo "================================================================"
echo "RÉSUMÉ FREEZE EU5+N COHORT — ${DATE}"
echo "================================================================"
echo "Cohorte         : ${count} stés à 5/5 (2020-2024)"
echo "Manifest        : ${MANIFEST}"
echo "Tarball         : ${TARBALL}"
echo "SHA256          : ${SHA_FILE}"
if [[ ${DRY_RUN} -eq 0 ]]; then
    echo "Taille tarball  : $(du -h "${TARBALL}" | awk '{print $1}')"
    echo "Permissions     : $(stat -f '%Sp' "${TARBALL}")"
else
    echo "[DRY RUN — aucun fichier créé/modifié]"
fi
echo "================================================================"
echo
echo "Vérification intégrité ultérieure :"
echo "  cd ${BACKUP_DIR} && shasum -a 256 -c $(basename "${SHA_FILE}")"
echo
