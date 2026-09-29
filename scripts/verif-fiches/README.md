# Vérification exhaustive des fiches (29 sept 2026)

Chaîne utilisée pour relire les 662 fiches servies. Les chemins de travail pointent vers le
dossier de brouillon de la session (`/private/tmp/claude-501/.../scratchpad`) : adapter la
variable `S` en tête de chaque script avant réemploi.

1. `npx tsx scripts/dump-fiches-servies.ts <dossier>` : copie JSON de chaque fiche telle que servie
   (vrai chargeur + assainissement client).
2. `python3 verif-mecanique.py [sous-dossier]` : contrôles mécaniques (textes, blocs, KPI, dates,
   doublons) et extraits lisibles par société (`extraits/<T>.txt`) pour la relecture par agents.
3. `python3 corrige-textes.py [--ecrit]` : corrections de texte sûres (accents d une liste fermée,
   apostrophes, décimales, codes de documents, tirets, marques internes), champs visibles seulement.
4. `python3 corrige-donnees.py [--ecrit]` : dates de dernière donnée manquantes ou futures, noms de KPI
   en français (`noms-fr.json`), doublons exacts, KPI codes sans unité.
5. `bash crawl.sh` : HTML servi des 662 pages sur la préversion (jeton d audit), codes HTTP.
6. `node export-test.cjs '<cas JSON>'` : téléchargements réels des PNG (Playwright) pour les exports.
7. Relecture par agents : workflow `verif-fiches-mettrik` (lots de 6 sociétés, contre-expertise, synthèse).
