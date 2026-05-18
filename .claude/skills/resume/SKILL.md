---
name: resume
description: Reprend une conv Mettrik depuis son fichier d'état sauvegardé. Usage typique au démarrage d'une nouvelle session après /exit. Yann tape juste `/resume CONV-DIV` (ou CONV-DATA, CONV-CONCEPTS, CONV-SYSTEMS, CONV-BRAND, CONV-MODULE-UI-AUDIT) et la conv reprend exactement où elle était.
arguments: [conv-name]
---

# Reprise de conv Mettrik

Tu es en train de redémarrer une conversation Mettrik AI. L'état complet
de la conv a été sauvegardé dans `~/spx-app/.conv-state/<NOM>.md` avant
le `/exit` précédent.

## État sauvegardé pour `$1`

!`cat ~/spx-app/.conv-state/$1.md 2>/dev/null || echo "❌ Fichier ~/spx-app/.conv-state/$1.md introuvable. Convs valides : $(ls ~/spx-app/.conv-state/*.md 2>/dev/null | xargs -n1 basename | sed 's/\.md//' | tr '\n' ' ')"`

---

## Consignes de reprise

1. Lis intégralement le bloc d'état ci-dessus
2. Identifie : ton identité (CONV-X), les tâches en cours, les procs Python encore actifs (PIDs), les commits récents, les prochaines étapes
3. Re-lis `RULES-GOLDEN.md`, `SHARED-STATUS.md`, `CLAUDE.md` (auto-chargés par CLAUDE.md → `@RULES-GOLDEN.md` etc.)
4. Vérifie le statut des procs Python mentionnés (`ps -p <PID>`) → s'ils sont morts entre temps, considère ces batches comme terminés et reprends à l'étape suivante
5. Vérifie le SHARED-STATUS log : si une autre conv a posté un broadcast `🤝 @CONV-X` ciblant ta conv pendant ton arrêt, traite-le maintenant
6. Reprends le travail SANS demander confirmation à Yann (règle 7 RULES-GOLDEN : zéro autorisation)
7. **Ne réécris pas tout ce qui a déjà été fait.** Si l'état mentionne "X livré, Y en cours" → continue Y, ne refais pas X

## Si le fichier d'état n'existe pas

Affiche les convs valides disponibles et demande à Yann de préciser laquelle reprendre. Si vraiment aucun fichier .conv-state/*.md n'existe → la session démarre à froid, demande à Yann son brief comme d'habitude.
