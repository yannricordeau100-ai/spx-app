# Sources des fiches societe : registre unique (4 oct 2026)

Regle : pour verifier ou corriger une fiche, on part TOUJOURS de
`python3 scripts/fiche-sources.py <TICKER> [--bloc gouvernance|risques|tam|repartition|kpi|ia|textes]`.
L outil montre la valeur reellement servie (vrai chargeur du site), toutes les sources candidates et LE fichier a corriger.
Ne jamais conclure « verifie » sur un seul fichier sans cet outil : plusieurs blocs ont 2 ou 3 sources.

Priorites relevees dans `src/lib/company-core/load-company.ts` (LC) le 4 oct 2026. PL = `src/data/v2-pipeline/<t>.json`,
EN = `src/data/v2-pipeline-enrich/<t>.json`, KH = `.batches-drafts-safe/kpis-haut/<T>.json`.

| Bloc | Qui gagne | Ou corriger |
|---|---|---|
| Actionnaires, remuneration | PL.governance ; EN.governance si PL vide ; EN.overrides_governance ne remplit que les vides | le fichier gagnant indique par l outil |
| Risques | EN.risks si EN._risks_reextracted_at, sinon PL.risks | idem |
| TAM | EN/<t>.tam.json si `_arbitrage_proprietaire`, sinon PL.market_positions | idem |
| Repartition du CA | PL ; EN si PL vide | idem |
| KPI IC et hero | KH remplace toute la liste (sauf `_source` dans KEPT_SOURCES) ; kpi-annuel-fiche/<T>.json ajoute ; hero : Supabase desk_hero_kpi_overrides en dernier | KH, kpi-annuel-fiche, Supabase |
| Positionnement IA | EN/<t>.ai-pos.json si PL faible ; override de stance en dernier | idem |
| These, anti-these | Supabase desk_these / desk_att, sinon src/data/these, src/data/att | Supabase en priorite |
| Clients / Moat / GICS | docs/cahier/clients/<T>.json / src/data/moat-univers.json / docs/cahier/societes-gics.json (mais EN.sector_fr ecrase le GICS) | source unique |
| Synthese des appels | src/data/transcript-summaries/<t>.json | source unique |
| Cours, capitalisation | Yahoo en direct, repli src/data/shares-outstanding.json | |

Fichiers jamais lus par le site (ne pas les corriger en croyant corriger la fiche) : EN/<t>.events.json, .governance.json,
.governance-additional.json, .risks.json, .i18n.json, src/data/companies/, src/data/v1-9-complete/ (back-office seulement),
v2-pipeline-exhaustive et v2-pipeline-i18n (exclus du deploiement).

## Documents telecharges : ou ils vont
- `data-lake/<TICKER en MAJUSCULES>/` est l emplacement unique des documents par societe :
  SEC `10K 10Q 8K DEF14A xbrl` (souvent des liens vers ~/Mettrik/sec-data) ; Europe `ir/URD` (rapport annuel), `ir/CP`
  (communiques), `ir/TRIM`, `ir/SEMESTRIEL`, `ir/SLIDES`. Nom : `<T>_<TYPE>_<EXERCICE>_<AAAA-MM-JJ>.pdf` + `.txt.gz`.
- `data-lake/_homonymes-sec/` : depots SEC d homonymes americains retires des 29 tickers europeens marques
  `_WRONG_COMPANY.txt` (ex : Moelis sous MC.PA). Ne jamais les lire.
- Hors depot : `~/Mettrik/sec-data` (96 Go, SEC brut), `~/Mettrik/docs` (13 Go, ER et transcripts). Aucune sauvegarde en ligne.

## Pieges connus (non corriges, a traiter avec precaution)
- 74 dossiers du data-lake en minuscules ; 5 tickers suivis deux fois dans git (SIE.DE/sie.de, BESI.AS, PHIA.AS, FRE.DE, SHL.DE).
- Sous-dossiers ir/ aux noms variables (CP, COMMUNIQUES, PR...).
- 25 Go non suivis et non ignores dans data-lake : jamais de `git add -A` sur data-lake.
