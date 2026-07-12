# Cron de rafraîchissement trimestriel Mettrik (go Yann 12 juil 2026)

Quand une sté SP500 publie un nouveau document SEC utilisable (10-Q, 10-K,
8-K items pertinents, DEF 14A, S-1/S-4/424B, SC 13D/G), ses données se
rafraîchissent : filings data-lake, facts.json XBRL, KPI
(value / yoy / last_data_date / history), et les blocs LLM sont inscrits en todo.

## Documents surveillés → blocs (mapping `FORM_TO_BLOCKS` dans detect.py)

| Form | Blocs alimentés |
|---|---|
| 10-Q | kpi (auto), segments_geo, ec_synthesis, stories_rotation |
| 10-K | kpi (auto), segments_geo, risks, description, headcount, ai_positioning, ec_synthesis, stories_rotation |
| 8-K item 2.02 (résultats) | kpi (auto), ec_synthesis, stories_rotation, profit_warning, events |
| 8-K item 5.02 (dirigeants) | governance, events |
| 8-K items 1.01 / 2.01 (M&A) | events, stories_rotation |
| 8-K items 7.01 / 8.01 (annonces) | events |
| 8-K items 2.05 / 2.06 (restructurations, impairments) | risks, events |
| DEF 14A (proxy annuel) | governance (bloc Gouvernance & rémunération entier : rémunération CEO, comp_detail salaire/bonus/actions, pay ratio, say-on-pay, board, top holders) |
| S-1 / S-4 / 424B* (émissions, fusions) | events, dilution |
| SC 13D / SC 13G (participations >5%) | governance_top_holders |
| Form 4 (dirigeants) | HORS SCOPE par défaut (volume énorme) : `FORM4_ENABLED=False` dans detect.py, passer à True pour transactions CEO/CFO majeures (governance + events) |

Les 8-K sans item pertinent sont ignorés. Les amendements `/A` sont ramenés au
form de base. Anti-bruit : whitelist 424B1/424B4/424B5 uniquement (424B2/B3/B7/B8 =
prospectus dette/structured notes routiniers, les banques en déposent des
dizaines par semaine), caps par détection (424B max 2, SC 13D/G max 3,
8-K max 6, les plus récents).
Le download suit l'arborescence data-lake existante
(`10K/ 10Q/ 8K/ DEF14A/`, nouveaux dossiers `S1/ S4/ 424B/ SC13D/ SC13G/`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/quarterly-refresh-detect.py` | Détecte les stés avec nouveau filing (SEC EDGAR submissions, UA + throttle 0.5s). Read-only sur le state. |
| `scripts/quarterly-refresh-run.py` | Download filings dans `data-lake/<T>/`, refresh `xbrl/facts.json` (companyfacts), extraction KPI standard (étend history + met à jour value/yoy/last_data_date), écrit todo-llm, marque le state. |
| `scripts/quarterly-refresh.sh` | Orchestre detect + run + `npx tsx scripts/audit-pages-full.ts <stés>` + rapport. Zéro commit/deploy auto. |
| `scripts/com.mettrik.quarterly-refresh.plist` | launchd, tous les jours 07h30 heure locale (Europe/Paris). |
| `.conv-state/quarterly-refresh-state.json` | État par sté : accessions traités + baseline_date. Idempotent, resume-safe. |
| `.conv-state/quarterly-refresh-detected.json` | Sortie du détecteur. |
| `.conv-state/quarterly-refresh-todo-llm.json` | Stés en attente des étapes LLM (conv Claude, zéro API payante dans les scripts). |
| `.conv-state/quarterly-refresh-report.json` | Rapport final : stés rafraîchies, KPI étendus, blocs auto vs en attente LLM, erreurs, audit. |
| `.conv-state/quarterly-refresh-backups/` | Backups des enrich et facts.json avant chaque écriture. |
| `logs/quarterly-refresh/` | Logs (run-*.log + launchd-stdout/stderr). |

## Charger le plist

```bash
cp /Users/yann/spx-app/scripts/com.mettrik.quarterly-refresh.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.mettrik.quarterly-refresh.plist
# vérifier : launchctl list | grep quarterly
# décharger : launchctl unload ~/Library/LaunchAgents/com.mettrik.quarterly-refresh.plist
```

Test manuel sans attendre 07h30 : `bash scripts/quarterly-refresh.sh` puis lire
le dernier `logs/quarterly-refresh/run-*.log`.

## Quand todo-llm.json se remplit

Chaque sté rafraîchie y apparaît avec des flags par bloc, à traiter par la conv
Claude (sub-agents Task tool, jamais d'API payante) :

- `ec_synthesis` : synthèse Earning Call (pipeline `scripts/ts-sp500-fetch-latest.py`
  + `.conv-state/ts-summ-spec.md` + `.conv-state/fool-transcript-index-strict.json`).
- `stories_rotation` : rotation intelligente des KPI Stories, spec complète dans
  `.conv-state/quarterly-stories-rotation-spec.md` (candidates du nouveau filing,
  refresh des stories conservées, scoring, 8-16 stories, archives `_stories_archived`).
- `risks` : re-extraction des risques (10-K, ou 8-K restructuration/impairment).
- `segments_geo` : répartition CA segments/géo depuis le 10-Q/10-K.
- `events` : événements matériels (8-K, émissions/fusions S-x/424B).
- `profit_warning` : à évaluer si l'ER du 8-K est négatif.
- `governance` : bloc Gouvernance & rémunération entier depuis le DEF 14A
  (rémunération CEO, comp_detail salaire/bonus/actions, pay ratio, say-on-pay,
  board), ou mouvement dirigeants (8-K 5.02).
- `governance_top_holders` : top holders depuis SC 13D/G.
- `dilution` : impact dilution des émissions/fusions (S-1/S-4/424B).
- `description` / `headcount` / `ai_positioning` : depuis le nouveau 10-K
  (Items 1 / 1A).

Workflow : traiter les flags par lots, puis retirer la sté de `todo` (ou passer
ses flags à false), relancer `npx tsx scripts/audit-pages-full.ts <T>`, et
validation Yann avant tout commit/deploy (chaîne edit→tsc→commit→push→deploy→alias→curl).

## Règles

- SEC EDGAR = seule source, zéro invention de données.
- Throttle 0.5s (2 req/s, limite SEC 10 req/s).
- Le détecteur n'écrit jamais le state : seul run.py marque une sté traitée
  après succès. Relancer le shell est toujours sans danger.
- Bootstrap : sté absente du state = baseline prise sur le dernier filing déjà
  présent dans `data-lake/<T>/{10K,10Q,8K,DEF14A}/`.
