# HANDOFF SOX 30 + état complet depuis le début CAC 40 (6 août 2026)

> Pour l'autre compte / une nouvelle session qui n'a AUCUN contexte.
> Tout ce qu'il faut savoir pour (1) reprendre le chantier SOX 30 exactement où
> il en est, (2) comprendre ce qui a été fait depuis le début de la chaîne CAC 40.
> Repo : ~/spx-app. Branche : staging. App : Mettrik V1.9.5.
> Lire aussi : RULES-GOLDEN.md (règles Yann), .conv-state/cac40-HANDOFF.md (chaîne
> EU d'origine), .conv-state/process-ajout-kpi-sites-stes.md (process KPI web).

---

## A. CE QUI A ÉTÉ FAIT (depuis le début CAC 40, 31 juillet → 6 août 2026)

### A1. CAC 40 (terminé, déployé)
- 40 stés extraites (Phase 2 KPI + Phase 3 blocs risques/gouvernance/segments/
  géo/IA), fiches v2-pipeline enrichies, intégrées, déployées, alias
  mettrik-niveau2.vercel.app. État : `.conv-state/cac40-state.json`
  (phase TERMINEE-integration-deployee). Décision ticker : suffixe .PA conservé
  partout (ArcelorMittal = MT.PA, PAS MT.AS).

### A2. SMI 20 suisse (terminé, déployé)
- Univers 20 stés .SW (NESN, NOVN, ROG, UBSG, ZURN, ABBN, ALC, AMRZ, GEBN, GIVN,
  HOLN, KNIN, PGHN, LOGN, CFR, SIKA, SLHN, SREN, SCMN, LONN).
- Phase 0-1 : téléchargement des rapports (annuels, semestriels, trimestriels,
  gouvernance/rému) dans data-lake/<T>.SW/ir/, PDF + .txt.gz.
- Phase 2 : KPI 5 ans dans `.batches-drafts-safe/kpis-haut/<T>.SW.json`
  (hero_kpi + séries, sondes verbatim 3 valeurs/sté contre les sources).
- Phase 3 : blocs data-lake/<T>.SW/ : risks/extracted.json, gouvernance_fr.json,
  segments_fr.json, geo_fr.json, ia_positionnement_fr.json. Sondes gouvernance
  vérifiées verbatim par l'orchestrateur (gzip -dc | grep). Blocs désactivés
  documentés dans smi-state.json : ZURN/KNIN/PGHN géo, LONN risks, SLHN IA
  (stance absent), + events x20 dans src/data/disabled-blocks-per-ste.json
  (clé "overrides").
- Intégration : fiches src/data/v2-pipeline/<t>.sw.json enrichies (hero + blocs),
  5 bases créées (nesn, novn, ubsg, alc, slhn), 5 alias ADR legacy purgés dans
  src/lib/company-core/load-company.ts (NESN.SW→NSRGY etc. SUPPRIMÉS), 10 entrées
  gate ajoutées à src/data/v1-7-public.json (redirection /<t> → /sandbox/v1-9-5/<t>).
  Les 20 pages répondent 200 sur mettrik-niveau2.vercel.app.
- Auto-refresh : scripts/fr-doc-watcher.py étendu aux 20 .SW (17/20 sources ok,
  3 WAF : LONN SLHN SREN documentés), chaîne eu-earnings-refresh.sh (cron 5h15)
  + fr-doc-watcher (cron 4h30) opérationnelles. Test réel fait sur SCMN (no-op
  correct). État : `.conv-state/smi-state.json`.

### A3. Divers infra
- Workflow GitHub « Image Findings Autorun » réparé : les secrets SUPABASE_URL et
  SUPABASE_SERVICE_ROLE_KEY du repo étaient périmés depuis mai → resynchronisés
  depuis .env.local via l'API GitHub (PyNaCl), run vert vérifié. Les mails d'échec
  toutes les 2h30 ont cessé.
- Un runner GitHub Actions self-hosted tourne en permanence sur le Mac
  (~/actions-runner) : c'est lui qui exécute ce workflow.
- .vercelignore enrichi (/.claude, raw PDFs) + deploys en --archive=tgz obligatoire.

### A4. KPI des sites web → blocs Stories (terminé, en cours de deploy final)
- Prospection des sites corporate des 60 stés CAC 40 + SMI : 569 KPI distinctifs
  retenus (554 nouveaux), datés (non-daté = "releve 2026", fenêtre fraîcheur
  12 mois), bruts dans `.conv-state/web-kpi/<T>.json`, rapport
  `.conv-state/web-kpi-rapport.md`.
- Injection Stories : 439 KPI injectés dans `.batches-drafts-safe/kpis-haut/`
  (130 doublons écartés), lint 0 rouge, commit poussé.
- PROCESS COMPLET REPRODUCTIBLE : `.conv-state/process-ajout-kpi-sites-stes.md`.
- ⚠️ À VÉRIFIER en reprise : le dernier deploy staging + alias + curl de contrôle
  du rendu Stories (si la session s'est arrêtée avant la fin de la chaîne).

---

## B. CHANTIER SOX 30 (à faire)

### B1. Objectif
Ajouter à l'app toutes les actions du SOX (indice PHLX Semiconductor, 30 membres),
au niveau de parité des autres stés V1.9.5 : docs 10 ans + KPI + blocs + page live.

### B2. Étape 0 OBLIGATOIRE : vérifier la composition 2026
La liste ci-dessous est celle de sept. 2024 (rebalance trimestriel !). Vérifier sur
https://indexes.nasdaqomx.com/Index/Overview/SOX ou TradingView. Attention :
WOLF (Wolfspeed) a connu un Chapter 11 en 2025 (peut-être sorti), ARM et ALAB
sont peut-être entrés.

### B3. État de couverture (vérifié le 6 août 2026)
- Déjà complets (kpis-haut + fiche, univers SP500) — 18 : NVDA AVGO AMD QCOM TXN
  INTC MU ADI AMAT LRCX KLAC NXPI MCHP ON MPWR SWKS TER COHR
- Fiche v2-pipeline existante mais PAS de kpis-haut — 9 : ALGM AMKR ASML ACLS
  ENTG LSCC QRVO RMBS TSM
- Rien du tout — 3 : GFS MRVL WOLF(?)
→ Travail réel : ~12 stés. Toutes cotées US (TSM et ASML via ADR : 20-F au lieu
  de 10-K). Docs sur SEC EDGAR : PAS de scraping de sites IR, contrairement au
  CAC 40/SMI. C'est BEAUCOUP plus simple.

### B4. Comment faire (pipeline US existant)
1. Téléchargement 10 ans de docs : 10-K, 10-Q, 8-K (earnings releases), DEF 14A,
   transcripts si dispo. Source EDGAR :
   `https://data.sec.gov/submissions/CIK##########.json` (CIK paddé 10 chiffres)
   puis les fichiers. User-Agent obligatoire : "Mettrik research
   yannricordeau100@gmail.com" (JAMAIS composé, copier tel quel). Stocker dans
   data-lake/<T>/{10K,10Q,8K,DEF14A}/ en .txt.gz comme les autres stés US
   (regarder data-lake/NVDA/ pour le format des noms).
   ASML et TSM : 20-F (annuel) + 6-K (trimestriels) au lieu de 10-K/10-Q.
2. Phase 2 KPI : agents sur le modèle des missions SMI (template
   `.conv-state/cac40-template.txt` adapté US + addendum
   `.conv-state/cac40-addendum-agents.txt`). Sortie :
   `.batches-drafts-safe/kpis-haut/<T>.json` avec hero_kpi + hero_kpi_rationale
   + séries 5 ans (10 ans si dispo), sondes verbatim 3 valeurs/sté OBLIGATOIRES
   côté orchestrateur avant de valider (des agents ont déjà inventé des données :
   cf mémoire « un agent a inventé 17 trimestres »).
3. Phase 3 blocs : template `.conv-state/cac40-phase3-template.txt` (risks depuis
   Item 1A du 10-K, gouvernance depuis DEF 14A avec say-on-pay/pay-ratio US,
   segments/géo depuis les notes des états financiers, IA). Contrôle somme
   segments = CA consolidé, sinon désactiver le bloc.
4. Intégration : fiche src/data/v2-pipeline/<t>.json (minuscules, pas de suffixe
   pour les US ; garder les tickers EDGAR normaux) : hero + kpis=[hero] + blocs.
   Vérifier que le ticker n'est pas détourné par un alias legacy dans
   src/lib/company-core/load-company.ts (TICKER_ALIASES + le map ligne ~340-415).
   Ajouter l'entrée v1-7-public.json si la page 404 (gate de routage, cf process
   SMI : entrée minimale suffit). disabled-blocks-per-ste.json : events à
   désactiver si pas d'events curatés.
5. KPI sites web + Stories : suivre `.conv-state/process-ajout-kpi-sites-stes.md`
   pour les ~12 nouvelles stés (sites US : nvidia.com etc. rarement bloqués).
6. Chaîne de livraison (chaque jalon) : kpi-lint 0 rouge → commit --no-verify →
   push staging → `vercel deploy --target=staging --yes --archive=tgz` →
   `vercel alias set <url> mettrik-niveau2.vercel.app` (+ mettrik-staging) →
   curl 2 pages avec ?audit_token=<VISUAL_AUDIT_TOKEN de .env.local> et grep du
   hero. Jamais dire « fait » avant le curl vert.

### B5. Budget et continuité
- Estimation : ~12 stés ≈ 400-600k tokens/sté toutes phases → 5-7M tokens.
  Faisable avec ~20 % d'une semaine Fable, en travaillant par jalons de 3-4 stés.
- Modèles : extraction/blocs = Sonnet (bon rapport qualité/coût, sondes
  obligatoires), orchestration = Fable ou Opus.
- État à tenir À CHAQUE VALIDATION dans `.conv-state/sox30-state.json` (créer au
  premier lancement) : {"composition_verifiee": bool, "univers": [...],
  "docs_done": [], "p2_done": [], "p3_done": [], "integres": [], "in_progress": [],
  "blocs_desactives": {}} — même sémantique que smi-state.json. C'est LA source
  de vérité pour la reprise : ne jamais avoir 2 tickers dans in_progress sans
  agent réellement en vol.
- Passage de relais : quand le quota approche, (1) finir le jalon en cours,
  (2) mettre à jour sox30-state.json + ce fichier (section C), (3) commit + push,
  (4) dire à Yann où on en est en 2 lignes. L'autre compte reprend en lisant ce
  fichier — il fait `git pull`, lit sox30-state.json, et relance au premier
  ticker non fait de l'ordre.

### B6. Pièges connus (payés cher, ne pas re-payer)
- Agents : TOUJOURS « exécute TOI-MÊME, ne délègue pas » dans le prompt.
- Vérif disque (`find data-lake/<T> -type f | wc -l`) avant d'accepter un rapport.
- Sondes verbatim 3 valeurs/sté avant d'écrire quoi que ce soit en canonique.
- Retour agents : 10 lignes max, jamais de dump de données dans la conv.
- Deploy : --archive=tgz sinon « more than 15000 files ».
- Un lint rouge = stop intégration, corriger d'abord.
- RAM Mac : pas plus de ~6 agents lourds en parallèle + surveiller vm_stat
  (le Mac a déjà crashé).
- WOLF : si toujours dans l'indice malgré le Chapter 11, les filings existent
  (société toujours cotée) mais vérifier le statut avant d'investir du budget.

---

## C. JOURNAL DE REPRISE (à compléter par chaque session)

- 2026-08-06 (Fable, ce compte) : handoff créé. SOX non commencé (étape 0 à
  faire). Stories web : injection 439 KPI commitée ; deploy staging lancé,
  VÉRIFIER alias + curl avant toute autre chose si non fait.
