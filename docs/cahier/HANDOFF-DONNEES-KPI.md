# Passage de relais : recherche des données annuelles des KPI (mis à jour en temps réel)

> Ce fichier est tenu à jour à chaque lot terminé. Une session Claude Code qui reprend le travail lit ce fichier, puis `docs/cahier/README.md`, et continue exactement là où la précédente s'est arrêtée. Toujours `git pull` avant de commencer, `git push` à chaque étape.

## REPRISE (06/09/2026 11:40) : mission donnees KPI TERMINEE

FAIT le 06/09 (14h) : n0 deploye (build 77b15e96, identique a niveau2), pages legales servies en pre-lancement, domaine mettrik.ai valide dans la Search Console pour yannricordeau100 ET mettrikai (deux TXT chez Spaceship, a conserver), branding OAuth Google valide et publie (nom Mettrik AI visible a la connexion Google). Ancienne consigne, pour memoire : DEPLOYER LE N0 (mettrik.ai) pour que Google puisse lire les pages legales pendant la validation OAuth. Procedure : verifier que l alias mettrik-niveau2.vercel.app pointe le build du HEAD de staging (sinon relancer scripts/alias-niveau2-attente.sh et attendre READY), puis `bash scripts/go-n0.sh` (corrige le 06/09 pour passer VERCEL_TOKEN explicitement, le jeton CLI etant mort ; il verifie la release puis promeut EXACTEMENT le build de niveau2). Le site RESTE en pre-lancement apres deploiement (interrupteur en base, rien ne s ouvre). Verifier ensuite : curl https://mettrik.ai/legal/confidentialite doit renvoyer 200 avec le texte legal (plus de redirection vers /maintenance). Les controles Google restants (page d accueil accessible et objectif de l app) exigent une ouverture temporaire du site via /sandbox/lancement par le proprietaire, puis re-fermeture.


Les 11 secteurs sont faits et contre-verifies (voir « Ce qui est terminé »). Il ne reste AUCUN lot a lancer. Travaux residuels possibles : les 6 decisions du proprietaire listees en fin de `_CORRECTIONS.md` (TTD, ORA.PA, VMRK, DTE, BF.B, SYK), et les 2 societes jamais classees.

## Où en est le travail

Voir la ligne « Dernière mise à jour » ci-dessous et lancer :

```
python3 docs/cahier/donnees/_prochains.py --prochains 6
```

qui affiche : sociétés faites / 666, l'avancement par secteur, et les 6 prochains lots à lancer (partiels d'abord).

Dernière mise à jour : 06/09/2026 23:30. Sociétés faites : 666 / 666. Technologie (45) : 97 / 97 terminée ; Industrie (20) : 115 / 115 terminée ; Finance (40) : 100 / 100 terminée ; Santé (35) : 75 / 75 terminée ; Consommation discrétionnaire (25) : 70 / 70 terminée ; Consommation de base (30) : 48 / 48 terminée ; Matériaux (15) : 36 / 36 terminée ; Collectivités (55) : 35 / 35 terminée ; Immobilier (60) : 33 / 33 terminée ; Communication (50) : 31 / 31 terminée ; Énergie (10) : 24 / 24 terminée. Contre-vérification : technologie lancée le 05/09 19h15 (livrable `donnees/_VERIFICATION-45.md`). Ordre des secteurs : 45, 20, 40, 35, 25, 30, 15, 55, 60, 50, 10.

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

- Energie (10) : contre-vérification du 06/09 : 72 séries sondées (144 valeurs), 72 conformes, 0 corrigée, 0 non vérifiable. Livrable : donnees/_VERIFICATION-10.md.

- MISSION TERMINEE le 06/09/2026 : les 11 secteurs faits (664/666, les 2 restantes sont les 2 sociétés jamais classées) et TOUS contre-vérifiés. Sondages cumulés environ 1 460 séries, 5 corrigées, 0 invention dans le Cahier. Corrections de fiches en ligne appliquées sous la règle du 10-K fait foi : voir _CORRECTIONS.md (dont 6 cas restant à la décision du propriétaire).

- Communication (50) : contre-vérification du 06/09 : 74 séries sondées (148 valeurs), 74 conformes, 0 corrigée, 0 non vérifiable. Livrable : donnees/_VERIFICATION-50.md.

- Collectivites (55) : contre-vérification du 06/09 : 87 séries sondées (174 valeurs), 84 conformes, 1 corrigée (PPL : base d actifs 2016-2020 reprenait la colonne du segment britannique au lieu du Kentucky, valeurs rétablies), 2 non vérifiables (ATO 2021, source en 403). Livrable : donnees/_VERIFICATION-55.md.

- Immobilier (60) : contre-vérification du 06/09 : 120 séries sondées, 119 conformes, 1 corrigée (CCI 2024/2025 intervertis, remis en ordre), 0 non vérifiable. VMRK (fusion AvalonBay + Equity Residential d août 2026) : identité de la fiche à arbitrer, sources = dépôts AvalonBay. Livrable : donnees/_VERIFICATION-60.md.

- Conso discretionnaire (25) : contre-vérification du 06/09 : 200 séries sondées (400 valeurs, 671 documents), 199 conformes, 1 corrigée (ADS.DE BRAND_GROWTH 2017, 12 corrigé en 18, la source donnait la seule Europe de l Ouest), 0 non vérifiable. HD et ULTA datent leurs séries sur le nom d exercice de la société (décalage d un an vs la convention du brief), valeurs exactes, non re-datées. Livrable : donnees/_VERIFICATION-25.md.

- Materiaux (15) : contre-vérification du 06/09 : 86 séries sondées, 85 conformes, 0 corrigée, 1 non vérifiable (DSFIR.AS PRICE_MIX 2023, passée en autre). Livrable : donnees/_VERIFICATION-15.md.

- Conso de base (30) : contre-vérification du 06/09 : 105 séries sondées (210 valeurs), 105 conformes, 0 corrigée, 0 non vérifiable. Une URL de source corrigée (BF.B 10-K 2018). Livrable : donnees/_VERIFICATION-30.md.

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
