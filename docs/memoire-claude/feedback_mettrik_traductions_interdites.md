---
name: feedback-mettrik-traductions-interdites
description: Yann interdit toute traduction chez Mettrik depuis le 13 sept 2026, crons de traduction desactives
metadata:
  type: feedback
---

Aucune traduction, nulle part : ni EN ni DE, ni pour une nouvelle societe, ni pour une fiche revue.

**Why:** Yann l a demande explicitement le 13 septembre 2026 (« les traductions ne doivent pas etre faite. nul part »), alors que les cles Cerebras et Groq etaient hors service et que les traductions manquantes etaient presentees comme une action a faire.

**How to apply:** les deux crons de traduction (scripts/cron-translate-en-de.sh a 5h, scripts/auto-translate-on-fr-change.sh toutes les 15 min) sont commentes dans crontab depuis le 13 sept 2026 : ne pas les reactiver. Ne pas produire de src/data/v2-pipeline-i18n/<t>.{en,de}.json, ne pas ajouter d etape de traduction dans une chaine ni dans une check-list d ajout de societe. Voir [[project-mettrik-univers-indices-only]].
