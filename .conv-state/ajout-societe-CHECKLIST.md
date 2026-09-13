# Ajout d une societe a Mettrik : check-list de raccordement (13 sept 2026)

Toute nouvelle societe doit avoir EXACTEMENT les memes artefacts que les autres, sinon les
mises a jour generales l ignorent. Modele a copier pour la structure : TSM (americaine, complete).

## Fichiers par societe (T = ticker majuscule, t = minuscule)
1. `src/data/v2-pipeline/<t>.json` : fiche principale (ticker, name, sector, subsector, gics_code, tagline, founded, ipo, ranks, hero_kpi, hero_kpi_rationale, kpis[] (5 ans, history + history_periods, period_type, last_data_date, unit, name_fr/name_en, type, is_wow/is_generic/is_short_history), stories_kpis, ai_positioning, risks[] (title, category, severity, score_rationale), governance (dirigeants, remuneration, agm_date), _validation).
2. `src/data/v2-pipeline-enrich/<t>.json` : revenue_by_segment, revenue_by_geography (source, source_date), financial_snapshot, key_facts, company_description, peers, latest_filing, next_earnings_date, publication_date, dividend_meta.
3. `src/data/v2-pipeline-enrich/<t>.ranks.json` (genere par scripts/ranks-univers.py) et `<t>.description.json`, `<t>.tam.json` (bloc Position de marche, cf docs/cahier/tam/<T>.json).
4. `.batches-drafts-safe/kpis-haut/<T>.json` : KPI avances (history {q,v}, frequency, pv_score, signal, description_fr/en) ; c est la couche la plus lue.
5. `src/data/transcripts/<t>.json` (scripts/marketbeat-transcripts.py --tickers T) et `src/data/transcript-summaries/<t>.json` (scripts/summaries-refresh.py --tickers T).
6. `src/data/att/<t>.json` : anti-these (procedure .conv-state/ATT-PROCEDURE.md).
7. `src/data/companies/<t>.json` : donnees legacy si le loader les lit (verifier load-company.ts ; TSM en a un).
8. `public/logos/<T>.png` : scripts/fetch-logo-wikipedia.py T "Titre Wikipedia".
9. `docs/cahier/donnees/<T>.json`, `docs/cahier/clients/<T>.json`, `docs/cahier/tam/<T>.json`, `docs/cahier/kpi/` (sous-industrie deja couverte).
10. `src/data/v2-pipeline-i18n/<t>.en.json` et `<t>.de.json` (scripts/cron-translate-en-de.sh les produit ; sinon a lancer).
11. data-lake/<T>/ : 10K, 10Q, 8K, DEF14A (scripts/fetch-filing-dates.py + daily-doc-watcher) ; ir/ pour les europeennes.

## Listes et index a mettre a jour (sinon la societe est invisible ou ignoree)
- `src/data/v1-9-5-clean-all-tickers.json` (visibilite publique, count) ; `src/data/v1-7-public.json` (nom, secteur) ; `src/data/sp500-tickers.json` / `nasdaq100-members.json` / `exchange-indices.json` / `docs/cahier/bourses/<PAYS>.json` (appartenance) ; `src/data/indices-composition.json` (regenerer).
- `src/data/societes-gics.json` et `docs/cahier/societes-gics.json` (classification), `src/data/kpi-industries-etat.json` (regenerer), `src/data/kpi-comptes-industries.json` (scripts/compte-kpi-industries.ts), `src/data/compare-index.json` (scripts/build-compare-index*.ts).
- `src/data/market-cap-order.json` + ranks (scripts/ranks-univers.py), `src/data/home-wow-kpis.json` (scripts/build-home-wow.py), `src/data/earnings-calendar.json` (+ marketbeat), `src/data/ir-directory.json`, `src/data/logo-domain-overrides.json`, `src/data/disabled-blocks-per-ste.json`, `src/data/carte-pays-kpis.json`, `src/data/kpi-classification.json`, `src/data/produit-phare.json` (si Industrie/Conso), `src/data/moat-univers.json`, `src/data/unites-univers.json` (unites nouvelles).
- Supabase : `desk_hero_kpi_overrides` (hero), zones de floutage (defaut applique), `desk_page_content` si arbitrages.
- Sitemap et recherche lisent clean-all : rien a faire de plus. Version-bump obligatoire (cache fiches).

## Verification finale (obligatoire)
- `npx tsx scripts/verif-societe.ts T` (a ecrire si absent) : chaque artefact present, chaque liste contient T, fiche 200 en ligne, blocs affiches (hero, KPI IC >= 8 avec 5 ans, stories, synthese, risques, gouvernance, repartition, TAM, moat, clients, ATT), aucune valeur inventee (10-K fait foi, trois valeurs sondees).
