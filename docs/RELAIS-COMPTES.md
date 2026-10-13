# Relais entre les deux comptes Claude : quoi sauvegarder, où, comment (13 oct 2026)

Document de reference unique. Les deux comptes le lisent EN PREMIER (pointe par CLAUDE.md). Objectif de Yann : chaque compte
reprend le travail de l autre sans rien perdre et sans rien lui demander.

## 1. Quand
- A 96 % de la limite HEBDOMADAIRE (outil get_usage de session_mgmt) : D ABORD arreter tous les workflows et agents
  (TaskStop), PUIS mettre docs/relais/EN-COURS.md a jour, PUIS une seule sauvegarde complete (section 3), PUIS plus rien
  (supprimer la tache planifiee). On n attend pas 98 % (demande de Yann du 13 oct) : rien ne tourne apres la sauvegarde,
  donc l autre compte ne refait jamais un travail deja fait.
- Avant tout changement de compte annonce par Yann, et a chaque fin de grosse etape.
- Les deux comptes partagent le meme Mac et le meme depot : la sauvegarde sert surtout ce qui n est PAS dans git
  (contexte de la conversation, travail en cours non commite, etats des workflows, consignes orales de Yann).

## 2. Ou (supports communs)
| Type de donnee | Support commun | Contenu |
|---|---|---|
| Etat du projet et consignes | docs/REPRISE-2026-10-09.md (relais courant) + docs/RELAIS-COMPTES.md | demandes de Yann, decisions, chantiers en cours, ordre des etapes |
| Contexte de la conversation | docs/relais/CONTEXTE-<date>.md | resume fidele : ce que Yann a demande et dans quels termes, decisions et refus, regles nouvelles, questions en attente, ton attendu |
| Code et donnees commitees | depot git (branche staging, pousse sur origin) | tout ce qui est commite |
| Travail non commite | ~/Mettrik-sauvegardes/<date>-<etiquette>/ (diff, archives) | modifs-non-commitees.diff, non-commites.tgz, statut.txt |
| Etats des chantiers | data-lake/_sp5001000/ (blocs/, parite/, etat-extraction/, blocs-etat.json, merge-blocs-rapport.json), data-lake/_kpi-instit/, data-lake/_rail-integration/, data-lake/_etats-vides/, data-lake/_hero/, data-lake/_analytics-compte/ | fichiers d etat lus par les scripts de reprise |
| Scripts de workflows | data-lake/_sp5001000/scripts/ (workflow-blocs.js, workflow-parite.js, workflow-extraction.js, merge-blocs.py, compare-n1-n2.py) + copie des scripts de ~/.claude/projects/*/workflows/scripts dans la sauvegarde | pour relancer a l identique |
| Taches planifiees de la session | docs/relais/TACHES-PLANIFIEES.md | texte exact du prompt de reprise automatique et frequence (elles meurent avec la session : a recreer avec CronCreate) |
| Agents et workflows en cours | docs/relais/EN-COURS.md (registre unique, statuts fait / en cours / interrompu / a faire) | ce qui tournait, sur quelle liste, ou trouver le resultat, comment relancer ; journal des sauvegardes : docs/relais/SAUVEGARDES.log |
| Memoire automatique | ~/.claude/projects/-Users-yann/memory/ (commune aux deux comptes sur ce Mac) + archive dans la sauvegarde | regles durables |
| Transcriptions brutes | ~/.claude/projects/-Users-yann/*.jsonl (deux plus recentes copiees dans la sauvegarde) | en dernier recours, ne pas relire en entier |
| SQL a coller par Yann | supabase/migrations/ + liste dans le relais | Yann colle lui meme |
| Cles et secrets | .env.local (jamais dans git, jamais dans un message) | copie protegee chmod 600 dans la sauvegarde |

## 3. Comment (procedure complete, autonome)
1. `bash scripts/sauvegarde-relais.sh <etiquette>` : bundle git, diff et archives du non commite, etats des chantiers, scripts de
   workflows, memoire, transcriptions, copie de .env.local, puis commit des documents de relais.
2. Ecrire ou mettre a jour, AVANT de lancer le script : docs/relais/CONTEXTE-<date>.md, docs/relais/EN-COURS.md,
   docs/relais/TACHES-PLANIFIEES.md, et la section du jour dans docs/REPRISE-2026-10-09.md.
3. `git push origin staging` (jamais git add -A ; jamais src/data/companies/wkl.as.json ; jamais le stash avant-go-n0-25sept).
4. Verifier : le dossier de sauvegarde existe, sa taille est coherente, le dernier commit est pousse.

## 4. Reprise par l autre compte
1. Lire CLAUDE.md, puis ce document, puis docs/relais/CONTEXTE-<date la plus recente>.md, EN-COURS.md, puis la derniere section
   de docs/REPRISE-2026-10-09.md.
2. Verifier l usage (get_usage) et l etat reel : git status, git log -5, workflows (/workflows), fichiers d etat des chantiers.
3. Recreer la tache planifiee de reprise (texte dans TACHES-PLANIFIEES.md) avec CronCreate.
4. Relancer UNIQUEMENT les lignes « interrompu » ou « a faire » de EN-COURS.md, a partir des fichiers de sortie deja
   ecrits (les workflows sautent ce qui existe). Toute ligne « fait » ou dont la sortie existe et est verifiee n est pas refaite.
   Avant chaque lancement, passer la ligne en « en cours » ; a la fin, « fait » avec le commit.
5. Repondre a Yann en francais, court, fini par TERMINE, avec ETA ; ne jamais lui redemander une decision deja prise
   (elles sont dans CONTEXTE et REPRISE).
