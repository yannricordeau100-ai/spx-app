# HANDOFF 5x → 20x — 30 août 2026, ~06h10

> **Pour le compte 20x (yannricordeau100).** Yann colle un prompt te disant de lire ce fichier.
> **Ta PREMIÈRE réponse doit obligatoirement contenir, dans cet ordre :**
> 1. le bloc VALIDATION du §2 ci-dessous, affiché en tableau clair (Yann a demandé « "à te faire valider" quoi ? comment ? où ? » : la réponse doit être SOUS SES YEUX, il ne s'en souviendra pas sinon) ;
> 2. le lancement immédiat du chantier §3 (synthèses depuis les communiqués de résultats), décision DÉJÀ prise par Yann, ne pas redemander ;
> 3. un point d'avancement + ETA de chaque tâche du §4.
>
> Format de réponse voulu par Yann (il l'a dit explicitement) : sections numérotées reprenant chacun de ses points, tableaux pour les listes, chiffres vérifiés en prod, zéro blabla, terminer par TERMINE. Règles permanentes : réponses courtes, pas de tiret cadratin, ETA sur chaque tâche, ne dire « fait » qu'après edit → tsc → commit → push → deploy → alias → curl de vérification.

## 1. Ce qui a été fait cette nuit (tout est commité, déployé sur mettrik-niveau2.vercel.app, vérifié en prod)

Historique précis par modif : `git log` (2 484 commits horodatés depuis le 17 avril, visibles des deux comptes puisque même repo). Commits de la nuit : `0ea37d410c` → `53cd7b310a` + synthèses.

| Chantier | Détail | Vérifié |
|---|---|---|
| Risques | 8 stés aux blocs placeholder régénérés depuis les 10-K (VEEV, CCI, HST, BF.B, EME, ETR, TTWO, SBAC), APTV/VMRK recalibrés. 0 sté de l'univers avec scores uniformes | CCI en ligne |
| Logos | 134/135 réparés (Wikidata+og+Parqet+détourage). VMRK volontairement en monogramme (pas de logo public fiable). GOOGL basculé du SVG V1 fait main au PNG officiel + accent standard (le SVG s'inversait en thème clair) | OR.PA, MC.PA, MBG.DE, ML.PA, MRVL, MT.PA, STLAP.PA, GOOGL |
| Valeur qui change au clic | La vue du chart se recale sur la fréquence du KPI promu (262 stés exposées, cause : vue annuelle héritée du hero) | KO 2 % avant/après |
| « pp » et ratios | Variations des KPI en % affichées en points avec « % » (fini les « +4pp » 542 stés et les « -60,0 % » ratio 268 stés), lignes + hero | KO |
| Doublons KPI | Dedup runtime v2 dans `load-company.ts` : égalité à 1,5 %, essais des 3 échelles K/M/Mds, inclusion totale ≥6 pts, + `src/data/kpi-doublons-forces.json` (12 paires revues à la main). ~200 paires fusionnées sur ~130 stés. Épargnés à raison : KO revenue_us_q vs segrev_na_q, CPT austin/phoenix, LUV Div/Buybacks, ALL, ALGN, AIG (métriques réellement différentes) | NVDA, KO, BMY, UBER, TSLA, CRM, BKNG, CI, CVS, CFG |
| Tooltips « i » | Détecteur pérenne `scripts/scan-tooltips-vides.mts` : 35 789/35 949 KPI sans définition. Fix : icône jamais vide + repli serveur `src/lib/kpi-definitions-generiques.ts` (58 définitions pédagogiques, ~55 % couverts) | KO |
| Caviardage gratuit | `fiscal_year`, `agm_date`, `stance` préservés (« exercice 1330 » et faux « Aucun positionnement IA » d'AAPL corrigés). AAPL réel = leader (Apple Intelligence, sourcé 10-K) | AAPL en vue gratuite |
| Recherche | Ordre par défaut = ordre de la home (`home-wow-kpis.json` : MC.PA, AAPL, TSLA…) | home |
| Vitrine home | Chiffres régénérés du jour + chaque KPI porte sa période (« T1 2026 »). C'est ce que Gemini avait lu (contenu public volontaire, PAS une fuite du floutage : les anonymes sont redirigés vers la home ; ChatGPT n'a vu que la FAQ publique) | rendu réel |
| Transcripts | Chaîne transcripts+synthèses branchée dans le cron 23h (`earnings-refresh.sh`) + filet quotidien `syntheses_en_retard` dans `verifie-publications.py`. 7 transcripts frais récupérés et synthétisés (HRL Q3, ADS.DE, AIR.PA, ALC.SW, BN.PA, SAN.PA, SHELL.AS) | HRL |
| NVDA hyperscalers | KPI inventé réduit à sa seule déclaration réelle (~50 %, 1 point) et transformé en story positive, hors des IC | NVDA |

Pièges appris cette nuit : un vérificateur doit être PLUS LARGE que le correcteur (mon audit doublons partageait le critère de la dedup → angle mort NVDA) ; local ≠ prod possible → toujours confirmer par curl prod ; vérifs visuelles en tier max via `?audit_token=<VISUAL_AUDIT_TOKEN de .env.local>` + cookie `mettrik:simulate-as=max` (ou `free` pour la vue gratuite).

## 2. BLOC VALIDATION — à afficher à Yann dans ta première réponse

**Quoi** (rien n'a été touché, ce sont des corrections de DONNÉES qui attendent son oui/non ligne par ligne) :

| # | Proposition | Ampleur |
|---|---|---|
| V1 | Ré-évaluer le positionnement IA des 90 stés en `stance: "absent"` douteux (TSLA en tête, avec TXN, NEE, TMO, PLD, MO, MAR, FDX, EMR, TRV, NKE… ; 47 ont déjà des preuves renseignées, incohérent) depuis leurs 10-K/calls du data-lake, + 10 stés sans bloc IA | ~100 stés |
| V2 | Normaliser 5 années d'exercice en texte brouillon (« FY2025 (exercice clos le 30 juin 2025) » affiché tel quel au bloc gouvernance) en année propre | 5 stés |
| V3 | Compléter l'année d'exercice manquante de DPW.DE, EDEN.PA, HONA, LI.PA, P911.DE, PSKY, PUM.DE, RXL.PA, SPCX | 9 stés |
| V4 | Aligner META, MSCI, SPGI, CAT sur le logo PNG standard comme GOOGL (leurs PNG actuels ont un fond opaque : détourage nécessaire d'abord ; leurs SVG V1 s'inversent en thème clair) | 4 stés |

**Comment** : Yann répond « V1 oui, V2 oui… » (ou « tout oui ») dans la conversation. Exécution puis vérif prod, sans autre question.
**Où** : les détails techniques sont dans ce fichier ; le scan des 90 stances est reproductible (champ `ai_positioning.stance` des `src/data/v2-pipeline/*.json` + enrich).

## 3. À LANCER IMMÉDIATEMENT (décision prise par Yann, ne pas redemander) : synthèses depuis les communiqués de résultats

164 stés ont une synthèse d'earnings call en retard (liste exacte : `.conv-state/publications-manquees.json`, champ `syntheses_en_retard`) parce que Motley Fool n'a pas publié leurs transcripts (vérifié : sitemap juillet quasi vide, Alphabet T2 jamais mis en ligne, 404 ; FMP répond 402 avec nos clés free). **Yann a tranché : générer la synthèse depuis le communiqué de résultats officiel (ER) du data-lake.**

Mode opératoire recommandé :
1. Créer `scripts/summaries-from-er.py` sur le modèle de `scripts/summaries-refresh.py` (moteur `claude -p`, AUCUNE clé API) : entrée = le document ER/8-K le plus récent de `data-lake/<T>/` postérieur à la date `precedente` du calendrier ; sortie = `src/data/transcript-summaries/<t>.json` au schéma existant + champ `"source": "earnings_release"`.
2. Étiqueter dans l'UI : le bloc transcripts doit afficher « Synthèse du communiqué de résultats » (pas « earnings call ») quand `source == "earnings_release"` : petite modif du composant transcript + i18n. HONNÊTETÉ ABSOLUE : ne jamais faire passer un ER pour un call, ne jamais inventer de citation du management.
3. Batch par paquets (10-15 stés à la fois, `nice -n 10`, surveiller la RAM : le Mac a déjà crashé). GOOGL en premier (Yann l'attend), puis par jours de retard décroissants. ETA réaliste : 164 × ~1 min de génération ≈ 3-4 h, annoncer l'ETA et les jalons.
4. Quand un vrai transcript Fool arrive plus tard, le cron 23h le remplacera automatiquement (transcripts-refresh ne remplace que par plus récent, summaries-refresh régénère si le transcript change).

## 4. Autres tâches ouvertes (annoncer ETA à Yann)

| Tâche | Détail | ETA indicative |
|---|---|---|
| Batch définitions KPI spécifiques | ~16 000 KPI sans définition non couverts par le repli générique. Liste : `.conv-state/tooltips-vides.json`. NE PAS toucher aux 666 JSON canoniques : écrire un fichier dédié `src/data/kpi-definitions-specifiques.json` `{ "TICKER": { "short": "définition" } }` chargé par le loader comme 2e repli (1er = générique). Rédaction par claude -p par paquets, ton pédagogique grand public, 1-2 phrases, pas de tiret cadratin | 2-3 nuits |
| Étiquette source des synthèses | cf. §3 point 2 | inclus §3 |
| Nettoyage | `facteurEchelle()` morte dans load-company.ts ; DEFS du repli générique à enrichir au fil des retours | 10 min |

## 5. Réponses déjà données à Yann (ne pas re-répondre, sauf s'il redemande)

Historique complet = git (2 484 commits, mêmes repo/machine pour les 2 comptes). Vitrine home = contenu public voulu, désormais daté. Floutage : rien n'a fui (anonymes redirigés, testé). Hyperscalers NVDA : story positive. Ordre recherche = ordre home.
