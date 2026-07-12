# Cron de rafraîchissement trimestriel Mettrik (go Yann 12 juil 2026)

Quand une sté SP500 publie un nouveau trimestre (10-Q / 10-K / 8-K earnings item 2.02),
ses données se rafraîchissent : filings data-lake, facts.json XBRL, KPI
(value / yoy / last_data_date / history), et les blocs LLM sont inscrits en todo.

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
- `risks` : re-extraction des risques (uniquement si nouveau 10-K).
- `segments_geo` : répartition CA segments/géo depuis le 10-Q/10-K.
- `events` : événements matériels du 8-K (M&A, guidance, dirigeants).
- `profit_warning` : à évaluer si l'ER du 8-K est négatif.

Workflow : traiter les flags par lots, puis retirer la sté de `todo` (ou passer
ses flags à false), relancer `npx tsx scripts/audit-pages-full.ts <T>`, et
validation Yann avant tout commit/deploy (chaîne edit→tsc→commit→push→deploy→alias→curl).

## Règles

- SEC EDGAR = seule source, zéro invention de données.
- Throttle 0.5s (2 req/s, limite SEC 10 req/s).
- Le détecteur n'écrit jamais le state : seul run.py marque une sté traitée
  après succès. Relancer le shell est toujours sans danger.
- Bootstrap : sté absente du state = baseline prise sur le dernier filing déjà
  présent dans `data-lake/<T>/{10K,10Q,8K}/`.
