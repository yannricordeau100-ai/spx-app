#!/bin/bash
# 14 oct 2026 (Yann : facture Vercel 80 $ dont 52 $ de minutes de build en septembre).
# Commande « ignoreCommand » de vercel.json : code 0 = PAS de build, 1 = build.
# On ne construit que si le code ou les donnees servies changent, ou si le message contient [build]
# (scripts/deploy-niveau2.sh l ajoute toujours). Les commits de relais, docs, data-lake, scripts sautent.
git log -1 --pretty=%B | grep -q "\[build\]" && exit 1
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$BASE" 2>/dev/null || exit 1
git diff --quiet "$BASE" HEAD -- src public next.config.ts package.json package-lock.json tsconfig.json vercel.json email-templates && exit 0
exit 1
