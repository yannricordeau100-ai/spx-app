# Passage de relais : recherche des données annuelles des KPI (mis à jour en temps réel)

> Ce fichier est tenu à jour à chaque lot terminé. Une session Claude Code qui reprend le travail lit ce fichier, puis `docs/cahier/README.md`, et continue exactement là où la précédente s'est arrêtée. Toujours `git pull` avant de commencer, `git push` à chaque étape.

## Où en est le travail

Voir la ligne « Dernière mise à jour » ci-dessous et lancer :

```
python3 docs/cahier/donnees/_prochains.py --prochains 6
```

qui affiche : sociétés faites / 666, l'avancement par secteur, et les 6 prochains lots à lancer (partiels d'abord).

Dernière mise à jour : 05 Sep 2026, 18:37. Sociétés faites : 121 / 666. Technologie (45) : 97 / 97 terminée, contre-vérification par sondage en cours (livrable `donnees/_VERIFICATION-45.md`). Industrie (20) : en cours, lots lancés dans l'ordre (voir `_prochains.py`). Ordre des secteurs : 45, 20, 40, 35, 25, 30, 15, 55, 60, 50, 10.

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

- Les agents n'ont JAMAIS le droit d'utiliser le navigateur intégré (`mcp__Claude_Browser__*`, `mcp__claude-in-chrome__*`) : il est partagé, un agent y a détruit une lecture Morningstar en cours.
- Agents en Opus : 4 à 6 agents Fable en parallèle atteignent la limite de session en 10 minutes et cassent la chaîne (arrivé 3 fois le 5 sept). Si une limite tombe malgré tout, attendre la réinitialisation (heure indiquée dans l'erreur) et relancer les lots partiels : `_prochains.py` les liste.
- Ne jamais écrire le prénom du propriétaire ni de tiret long dans les fichiers du Cahier (`_valide.py` le refuse).
- Un lot = 5 sociétés, 15 à 25 minutes par agent. Un push = un build Vercel de ~15 min ; ne pas pousser à chaque lot.
- Les fichiers de fiche société peuvent être en minuscules ou sous une autre place de cotation (ex. STMPA.PA absent, stmmi.mi présent) : le dire aux agents.

## Ce qui est terminé (ne pas refaire)

- Classification GICS 2023 (163 sous-industries), KPI organiques / complémentaires par sous-industrie (1 231 KPI, relus), 664 / 666 sociétés classées (2 arbitrées par le propriétaire).
- Moat Morningstar lu pour 661 / 666 sociétés : `docs/cahier/moat.json` (usage interne uniquement). Introuvables : CBOE, DPW.DE (= DHL.DE), EA, JDEP.AS, ROG.SW.
- Technologie (45) : 97 sociétés, 410 KPI examinés (101 existent, 64 trouvés, 154 non publiés, 90 autre, 1 valeur actuelle).

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
