---
description: Réveille une conv Mettrik depuis son fichier d'état sauvegardé dans ~/spx-app/.conv-state/<NOM>.md. Usage : /wake CONV-DIV (ou CONV-DATA, CONV-CONCEPTS, CONV-SYSTEMS, CONV-TRANSCRIPTS, CONV-MODULE-UI-AUDIT, CONV-MODULE-RANKS-V2). Charge l'état complet de la conv (identité, scope, tâches en cours, PIDs survivants, prochaines étapes) et reprend le travail sans qu'il faille réécrire le brief.
argument-hint: <CONV-NAME>
---

# Reprise de conv Mettrik AI

Tu es en train de redémarrer une conversation Mettrik AI. L'état complet de la conv a été sauvegardé avant le `/exit` précédent dans `~/spx-app/.conv-state/$ARGUMENTS.md`.

## État sauvegardé pour `$ARGUMENTS`

!`cat ~/spx-app/.conv-state/$ARGUMENTS.md 2>/dev/null || (echo "❌ Fichier ~/spx-app/.conv-state/$ARGUMENTS.md introuvable." && echo "" && echo "Convs disponibles :" && ls ~/spx-app/.conv-state/*.md 2>/dev/null | xargs -n1 basename | sed 's/\.md$//' | sed 's/^/  - /')`

---

## Consignes de reprise

1. **Lis intégralement le bloc d'état ci-dessus.** C'est ton contexte complet.
2. **Identifie** : ton identité (CONV-X), ton périmètre, les tâches en cours, les procs Python encore actifs (PIDs mentionnés), les commits récents, les prochaines étapes documentées.
3. **Re-lis aussi** les fichiers auto-chargés via `CLAUDE.md` : `RULES-GOLDEN.md`, `SHARED-STATUS.md`, `AGENTS.md`, `HANDOFF.md`.
4. **Vérifie le statut des procs** mentionnés dans l'état : pour chaque PID, fais `ps -p <PID>`. S'il est mort entre temps, considère ce batch comme terminé et passe à la suite. S'il tourne encore, monitore son progrès.
5. **Lis les 20 dernières lignes du log d'activité SHARED-STATUS.md** : si une autre conv a posté un broadcast `🤝 @CONV-X` ciblant ta conv pendant ton arrêt, traite-le maintenant.
6. **Reprends le travail sans demander confirmation à Yann** (règle 7 RULES-GOLDEN : zéro autorisation jamais).
7. **Ne refais pas ce qui a déjà été fait.** Si l'état mentionne "X livré, Y en cours" → continue Y, ne refais pas X.
8. **Réponds en DOB** (Direct, Objectif, Bref) — pas de récap de l'état lu, va directement à l'action ou à la phrase d'attente.

## Si le fichier d'état est absent

Affiche la liste des convs disponibles (cf. plus haut) et demande à Yann de préciser laquelle reprendre. Si vraiment aucun .conv-state/*.md n'existe → la session démarre à froid, demande à Yann son brief comme d'habitude.
