# Spec lots correction pages stés — 11 juil 2026

Objectif : zéro erreur visible sur les pages V1.9.5. Les erreurs ont été détectées
par `scripts/audit-pages-full.ts` (réplique exacte du rendu UI). Après ton lot,
l'orchestrateur re-audite : ton travail est validé UNIQUEMENT si l'erreur disparaît.

## Règles absolues (tous lots)
- ZÉRO invention de chiffre. Toute valeur vient d'un filing du data-lake
  (`data-lake/<T>/10K|10Q|ER/*.gz|pdf`, `kpis_q/extracted.json`, `xbrl/facts.json`).
- Cross-check : toute nouvelle valeur trimestrielle/annuelle doit être vue dans
  au moins 1 filing source ; en cas de doute, ne pas écrire.
- Jamais de tiret cadratin (—). FR investisseur. "Mds $" pas "B$".
- Ne JAMAIS mélanger deux KPI (pas de cross-pollution).
- Écrire en JSON valide, indent 1, ensure_ascii=False.
- Fichier data runtime : `src/data/v2-pipeline/<t>.json` (t minuscule) et
  `src/data/v2-pipeline-enrich/<t>.json`. Le loader merge enrich par short
  case-insensitive ; le winner en conflit = celui avec last_data_date+history_periods.

## Lot A — hero < 5 ans
Pour chaque {t, hero} du lot :
1. Trouve le KPI hero (short EXACT, case-insensitive) dans v2-pipeline/<t>.json kpis[].
2. Étends son historique au maximum réel disponible en lisant les 10-Q/10-K/ER
   du data-lake (gunzip). Objectif ≥ 20 trimestres (5 ans) si le KPI existe
   depuis ≥5 ans dans les filings. Écris le KPI complet dans
   v2-pipeline-enrich/<t>.json kpis[] avec le MÊME short :
   {short, name_fr, history:[...], history_periods:["Q1-FY2022",...],
    last_data_date:"YYYY-MM-DD" (fin de période), period_type:"quarter"|"year",
    unit, method:"llm-filing-crosschecked", source:"10-Q <T> ..."}.
   L'history DOIT contenir les valeurs actuelles du KPI (continuité) + les
   périodes antérieures. history_periods.length === history.length.
3. Si le KPI n'existe RÉELLEMENT que depuis <5 ans dans les filings (produit ou
   segment récent, IPO récente) : NE force pas. À la place, repointe
   `hero_kpi` dans v2-pipeline/<t>.json vers le meilleur KPI (priorité : KPI
   "wow" sectoriel avec ≥20 trimestres ou ≥5 ans annuels ; sinon Total
   Revenue/Revenue avec ≥5 ans). Mets à jour `hero_kpi_rationale` (1 phrase FR).
   L'ancien KPI reste dans la liste.
4. Auto-vérifie : le KPI hero final a ≥20 points quarterly (ou ≥5 annuels),
   periods alignés, last_data_date présent.

## Lot B — stories muettes (<2 stories usables)
Une story est "usable" si : value non nulle, name_fr non vide, ET
(signal OU description non vide). Pour chaque sté du lot :
1. Ouvre v2-pipeline/<t>.json : les stories sont les kpis[] avec
   `is_short_history:true` ET le tableau `stories_kpis` s'il existe.
2. Pour chaque story avec value non nulle et name_fr mais SANS signal ni
   description : rédige `signal` (phrase courte percutante, ≤120 chars, style
   "Skyrizi > 5 Md$/trim") et `description` (1-2 phrases FR investisseur,
   150-300 chars) en utilisant EXCLUSIVEMENT : name_fr, value, unit, yoy, type
   du KPI + le contexte de data-lake/<T>/stories/extracted.json (story_fr).
   AUCUN chiffre nouveau : uniquement ceux déjà dans ces champs.
3. Si après ça la sté a <2 stories usables (ex : 1 seule story existe), regarde
   data-lake/<T>/stories/extracted.json : transforme les stories manquantes en
   KPI story (short, name_fr, value extraite du story_fr si chiffre présent,
   unit, signal, description=story_fr, is_short_history:true,
   story_category approprié). Min 3 stories usables par sté quand la matière existe.
4. Cible finale : ≥3 stories usables (≥2 minimum absolu).

## Lot C — KPI avec history vide
Pour chaque {t: [shorts]} :
1. Cherche la série dans data-lake/<T>/kpis_q/extracted.json,
   kpis/extracted.json, xbrl/facts.json ou les 10-Q (segments).
2. Si trouvée : remplis history + history_periods + last_data_date + period_type.
3. Si introuvable dans les filings : SUPPRIME le KPI de kpis[] et ajoute-le dans
   un champ `_kpis_disabled_empty` du même fichier (traçabilité). Un KPI sans
   graph ne doit pas rester affiché.

## Lot D — divers
- R2 (<5 risques) : relis data-lake/<T>/_risks_src_30k.txt et complète la liste
  jusqu'à 5-8 risques réels du 10-K (mêmes règles que chantier-risks-spec.md :
  severity variées, score=severity, score_rationale 4 critères). Ne duplique pas.
- K2 (periods mismatch MNST) : réaligne history_periods sur history (tronque ou
  reconstruis depuis la source), zéro invention.

## Réponse finale de chaque agent
UNIQUEMENT : {"ok":[...tickers...],"actions":{"<t>":"1 ligne"},"fail":[{"t":"...","err":"..."}]}
