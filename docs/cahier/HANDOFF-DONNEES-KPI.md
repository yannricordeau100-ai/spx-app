# Passage de relais : recherche des données annuelles des KPI (mis à jour en temps réel)

> Ce fichier est tenu à jour à chaque lot terminé. Une session Claude Code qui reprend le travail lit ce fichier, puis `docs/cahier/README.md`, et continue exactement là où la précédente s'est arrêtée. Toujours `git pull` avant de commencer, `git push` à chaque étape.

## REPRISE URGENTE (06/09/2026 02:05) : etat exact au moment du passage de relais

La session precedente peut s etre arretee (limite de session) avec des agents EN COURS. Leurs fichiers peuvent etre absents ou partiels : `_prochains.py` et `_allongement.py` le detectent, `_valide.py` refuse tout fichier incomplet. Tout ce qui est valide a ete pousse.

- Secteurs 45, 20, 40, 35, 25 TERMINES et contre-verifies (45 : 101/101 ; 20 : 204/205 ; 40 : 185/191 ; 35 : 162 sondees en 2 passes, 0 ecart). Contre-verification du 25 EN COURS (livrable attendu `donnees/_VERIFICATION-25.md`, la relancer si absent : second prompt de `_PROMPT-AGENT.md`, avec l escalade 5 chemins avant de dire non verifiable).
- Secteur 30 (conso de base, 48 stes) : lots 30-01 et 30-02 etaient chez des agents. Relancer ce que `python3 docs/cahier/donnees/_prochains.py --prochains 6` affiche (partiels d abord).
- Allongement : A01 a A42 valides (216/235 stes). Restaient en cours : A43 (reliquat PGHN.SW), A44 (PYPL, RF, RJF), A45 (SCHW, SPGI, SREN.SW, STT, SYF). Reste ensuite A46, A47. Suivi : `python3 docs/cahier/donnees/_allongement.py --prochains 6` ; prompt = troisieme bloc de `_PROMPT-AGENT.md`.
- Corrections de fiches APPLIQUEES le 06/09 (regle du proprietaire : le 10-K / 10-Q fait foi, ecart important corrige, ecart mineur tolere) : ABT, DXCM, CON.DE, HCA, APTV, SREN.SW, AJG (detail dans `_CORRECTIONS.md`). Restent a re-sourcer : SYK (series Mako), ARES (FRE), ROST (ventes/surface).
- Onglet « A arbitrer » supprime de /sandbox/gics (v2026.09.06.3). L onglet « Arbitrages KPI » attend les reponses du proprietaire (19 points, reponse attendue : code : garder / retirer / correction).
- Deploiement : jeton CLI Vercel EXPIRE. `scripts/alias-niveau2-attente.sh` utilise VERCEL_TOKEN de .env.local (API REST). Chaine : version-bump, commit, push staging, puis nohup bash scripts/alias-niveau2-attente.sh. Verifier ensuite l alias vers le build du SHA courant via l API v4/aliases.
- Demandes du proprietaire encore ouvertes hors Cahier : (1) il configure lui-meme l ecran de consentement Google (Branding, nom Mettrik AI) : instructions deja donnees ; (2) messages attendus : ETA de fin de secteur de temps en temps, problemes importants, tableau recapitulatif par secteur termine. Pas de blabla.
- Regles : agents en Opus (6 max, jamais de sous-agents d agents), jamais le navigateur integre pour les agents, jamais de valeur inventee, jamais de prenom ni de tiret long, qualite avant vitesse, n0 (mettrik.ai) uniquement sur accord explicite du proprietaire.

## Où en est le travail

Voir la ligne « Dernière mise à jour » ci-dessous et lancer :

```
python3 docs/cahier/donnees/_prochains.py --prochains 6
```

qui affiche : sociétés faites / 666, l'avancement par secteur, et les 6 prochains lots à lancer (partiels d'abord).

Dernière mise à jour : 06/09/2026 01:54. Sociétés faites : 457 / 666. Technologie (45) : 97 / 97 terminée ; Industrie (20) : 115 / 115 terminée ; Finance (40) : 100 / 100 terminée ; Santé (35) : 75 / 75 terminée ; Consommation discrétionnaire (25) : 70 / 70 terminée. Contre-vérification : technologie lancée le 05/09 19h15 (livrable `donnees/_VERIFICATION-45.md`). Ordre des secteurs : 45, 20, 40, 35, 25, 30, 15, 55, 60, 50, 10.

## La mission (rappel)

Pour chaque société de l'univers (666), retrouver les valeurs ANNUELLES (idéalement 10 ans) des 3 à 5 KPI organiques de sa sous-industrie GICS (`docs/cahier/kpi/<code>.json`), après avoir vérifié si le KPI existe déjà sur la fiche. Sources fiables uniquement, jamais de valeur inventée, statuts `existe` / `trouve` / `non_trouve` / `actuel_seulement` / `autre` (+ commentaire). Résultat : `docs/cahier/donnees/<TICKER>.json`, affiché dans l'onglet Sociétés de https://mettrik-niveau2.vercel.app/sandbox/gics. Règles complètes : `donnees/_BRIEF.md`.

## La boucle de travail (à répéter)

1. `python3 docs/cahier/donnees/_prochains.py --prochains 6` → prendre les 6 prochains lots.
2. Pour chaque lot, lancer un agent (outil Agent, `general-purpose`, `model: opus`, arrière-plan) avec le prompt de `donnees/_PROMPT-AGENT.md` (remplacer `<LOT>`). 6 agents en parallèle au maximum ; relancer un lot dès qu'un agent se termine.
3. À chaque fin d'agent : `python3 docs/cahier/donnees/_valide.py <les 5 tickers>` doit afficher `OK 5 problemes 0`. Sinon corriger.
4. Tous les ~30 sociétés : `bash scripts/version-bump.sh "Donnees KPI : N societes <secteur>"` puis `git add -A docs/cahier src/lib/version.ts CHANGELOG.md && git commit -m "v<version> : donnees KPI ..." && git push origin staging`, puis `nohup bash scripts/alias-niveau2-attente.sh > /tmp/alias.log 2>&1 &` (met niveau2 à jour quand Vercel a construit, ~15 min).
5. Quand un secteur est complet : lancer l'agent de contre-vérification (second prompt de `_PROMPT-AGENT.md`), puis noter le résultat ici.
6. Mettre à jour ce fichier (ligne « Dernière mise à jour ») à chaque lot.

## Règles apprises (à ne pas réapprendre)

- Depuis le 05/09 au soir (ordre du propriétaire) : l'allongement à 20 ans des KPI `existe` fait PARTIE de la passe de chaque secteur (plus de passe séparée). Les secteurs 45, 20 et 40, faits avant cette règle, sont rattrapés par les lots d'allongement A01 à A47 : 235 sociétés ayant au moins un KPI `existe`, soit 492 KPI existants à allonger (115 techno, 155 industrie, 222 finance). Suivi : `python3 docs/cahier/donnees/_allongement.py --prochains 6` (marqueur « Allonge le » / « Allongement non realise » dans le commentaire).

- Les agents n'ont JAMAIS le droit d'utiliser le navigateur intégré (`mcp__Claude_Browser__*`, `mcp__claude-in-chrome__*`) : il est partagé, un agent y a détruit une lecture Morningstar en cours.
- Agents en Opus : 4 à 6 agents Fable en parallèle atteignent la limite de session en 10 minutes et cassent la chaîne (arrivé 3 fois le 5 sept). Si une limite tombe malgré tout, attendre la réinitialisation (heure indiquée dans l'erreur) et relancer les lots partiels : `_prochains.py` les liste.
- Ne jamais écrire le prénom du propriétaire ni de tiret long dans les fichiers du Cahier (`_valide.py` le refuse).
- Un lot = 5 sociétés, 15 à 25 minutes par agent. Un push = un build Vercel de ~15 min ; ne pas pousser à chaque lot.
- Les fichiers de fiche société peuvent être en minuscules ou sous une autre place de cotation (ex. STMPA.PA absent, stmmi.mi présent) : le dire aux agents.

## Ce qui est terminé (ne pas refaire)

- Santé (35) : contre-vérification du 06/09 en DEUX passes (la seconde ciblant les non vérifiables avec XBRL, EDGAR plein texte, comparatifs d autres exercices, archives). 162 séries sondées : 93 conformes, 0 corrigée, 0 passée en autre, 69 non vérifiables (surtout séries reconstituées ou sources jamais republiées ; VRTX PATIENTS_TREATED et BMY GROSS_TO_NET restent introuvables par cinq chemins). Zéro écart avéré. Livrable : donnees/_VERIFICATION-35.md.

- Finance (40) : contre-vérification du 05/09 : 191 séries sondées via 417 documents sources, 185 conformes, 0 corrigée, 6 non vérifiables (composants non isolables ou source absente). Livrable : donnees/_VERIFICATION-40.md.
- Finance (40) : 100 sociétés, 532 KPI examinés (222 existent, 110 trouvés, 104 non publiés, 93 autre, 3 valeur actuelle). Défauts en ligne notés dans _CORRECTIONS.md : SREN.SW (ratio combiné 2023 sur l ancien référentiel), PRU (ratio de prestations 2023-2024 différent des 10-K). Séries en ligne allongées par les agents : C (coefficient d exploitation 10 exercices), PNC (NIM et coefficient 2012-2025), AXP (série homogène 2017-2024), BRO (série annuelle ajoutée).

- Classification GICS 2023 (163 sous-industries), KPI organiques / complémentaires par sous-industrie (1 231 KPI, relus), 664 / 666 sociétés classées (2 arbitrées par le propriétaire).
- Moat Morningstar lu pour 661 / 666 sociétés : `docs/cahier/moat.json` (usage interne uniquement). Introuvables : CBOE, DPW.DE (= DHL.DE), EA, JDEP.AS, ROG.SW.
- Industrie (20) : contre-vérification du 05/09 : 205 séries sondées via 665 URL sources (EDGAR, XBRL, INFOFI), 204 conformes, zéro correction, 1 non vérifiable (RHM.DE book-to-bill 2024, source 403). Livrable : donnees/_VERIFICATION-20.md.
- Industrie (20) : 115 sociétés, 571 KPI examinés (154 existent, 135 trouvés, 185 non publiés, 96 autre, 1 valeur actuelle). Défauts en ligne notés dans _CORRECTIONS.md : FER (carnet 2022 non rattachable), WKL.AS (fiche polluée par une autre entité), sous-industrie 20106020 inadaptée à GWW et SNA. Séries en ligne ALLONGÉES par les agents : XYL (backlog 2 vers 11 exercices), WM (volumes 2017-2020 ajoutés).
- Technologie (45) : 97 sociétés, 410 KPI examinés (101 existent, 64 trouvés, 154 non publiés, 90 autre, 1 valeur actuelle). Contre-vérification du 05/09 : 101 séries sondées via XBRL EDGAR et 316 documents sources, 101 conformes, zéro écart, cinq définitions élargies assumées et documentées (ASML, MSFT, ORCL, SMCI, ZBRA). Livrable : donnees/_VERIFICATION-45.md.

## Ce qui reste (dans l'ordre)

1. Industrie (20) → Finance (40) → Santé (35) → Consommation discrétionnaire (25) → Consommation de base (30) → Matériaux (15) → Collectivités (55) → Immobilier (60) → Communication (50) → Énergie (10).
2. Contre-vérification par sondage après chaque secteur.
3. Défauts constatés sur des séries déjà en ligne : `donnees/_CORRECTIONS.md` (à compléter au fil des secteurs ; corrections sur les fiches seulement après validation du propriétaire).
4. Ensuite (option B validée) : pose des KPI validés sur les fiches (`src/data/companies/<T>.json` ou `.batches-drafts-safe/kpis-haut/<T>.json`), après validation dans l'onglet Sociétés.
5. Améliorations décidées le 5 sept (à appliquer dès que possible) : passe « KPI propres à la société » (partir de ce que la société publie), statut `calcule` officiel, statut `a_allonger`, API XBRL de la SEC en premier pour les sociétés américaines.

## Prompt à coller dans l'autre compte (Claude Code, dépôt ~/spx-app)

```
Tu reprends un travail en cours dans ~/spx-app (Mettrik AI). Commence par `git pull origin staging`, puis lis intégralement `docs/cahier/HANDOFF-DONNEES-KPI.md` et `docs/cahier/README.md`. Continue la boucle de travail décrite dans le handoff exactement là où elle s'est arrêtée : `python3 docs/cahier/donnees/_prochains.py --prochains 6`, lance 6 agents Opus en parallèle avec le prompt de `docs/cahier/donnees/_PROMPT-AGENT.md`, valide chaque lot avec `_valide.py`, pousse tous les ~30 sociétés avec `scripts/version-bump.sh` puis `scripts/alias-niveau2-attente.sh`, lance la contre-vérification à la fin de chaque secteur, et mets à jour la ligne « Dernière mise à jour » du handoff à chaque lot. Règles : jamais le navigateur intégré pour les agents, jamais de valeur inventée, jamais de prénom ni de tiret long dans les fichiers, qualité avant vitesse. Ne m'écris que pour un blocage réel ou un bilan de secteur (tableau : sociétés faites, KPI existants / trouvés / non trouvés / autre, défauts en ligne constatés).
```
