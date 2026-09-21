# Audit de circulation des donnees vers les pages societe
Depot /Users/yann/spx-app — 21 sept 2026 — univers de reference : src/data/v1-9-5-clean-all-tickers.json (671 societes)
Lecture seule : aucun fichier de src/ modifie.

## Methode
- Analyse de portee par comptage d accolades sur src/lib/company-core/load-company.ts (3316 lignes), pas a l oeil.
- Comptage reel de presence de fichier, source par source, sur les 671 tickers.
- Verification par chargement reel via loadV17Company (npx tsx + dotenv .env.local).

---

## Defauts classes par nombre de societes touchees

### 1. La couche kpis-haut efface toutes les couches KPI non inscrites dans une liste blanche — 510 societes
**Fichier** : src/lib/company-core/load-company.ts:2829-2874 (`KEPT_SOURCES` puis `keptExtras`)
**Ce qui est perdu** : quand `.batches-drafts-safe/kpis-haut/<T>.json` existe (666 societes sur 671), la liste de KPI est REMPLACEE. Seuls survivent les KPI dont `_source` figure, en egalite de chaine exacte, dans `KEPT_SOURCES` (8 valeurs figees). Or les couches amont ecrivent des etiquettes libres.
**Compte reel** :
- 510 societes perdent au moins un KPI de la couche de base — 7 385 KPI au total.
- Par etiquette : `10-Q Q1 FY2026` 797 KPI / 164 stes, `data-lake` 395 / 153, `10Q mai 2026` 228 / 45, `10Q avril 2026` 192 / 36, `10-Q avril 2026` 151 / 33, `10-Q mai 2026` 149 / 32, sans etiquette 95 / 31, etc.
- Couche `v2-pipeline-specific-kpis` (`_source` pose ligne 1352) : 401 societes, 1 948 KPI.
- Couche `kpis-supplementary` (`_source` ligne 2217) : 316 societes, 1 496 KPI.
- Couche `kpis-v3-verif` (ligne 1458) : 23 societes, 27 KPI.
**PROUVE PAR CHARGEMENT REEL** :
```
CL       kpis-haut=42 fichier specific=22 -> KPI rendus tagges v2-pipeline-specific-kpis = 0
DIS      kpis-haut=33 fichier specific=21 -> 0
MU       kpis-haut=40 fichier specific=18 -> 0
AAPL     kpis-haut=47 fichier specific=8  -> 0
-- temoins sans kpis-haut --
DIM.PA   kpis-haut=0  fichier specific=4  -> 4
LI.PA    kpis-haut=0  fichier specific=12 -> 12
SOON.SW  kpis-haut=0  fichier specific=5  -> 5
```
**Correction proposee** : remplacer l egalite exacte sur `KEPT_SOURCES` par une regle d exclusion (on ne jette que les KPI generiques du pipeline d origine), ou inscrire les etiquettes de la couche de base et des couches specific/supplementary/v3 dans la liste blanche.

---

### 2. Les deux blocs de gouvernance « premiers actionnaires » sont coupes pour tout le monde — 512 societes
**Fichiers** : src/data/disabled-blocks.json (`disabled: ["gouvernance_top3_votes","gouvernance_top3_capital"]`, pose le 30 mai 2026) et la ligne Supabase `desk_disabled_blocks` de portee `__global__` (10 juin 2026). Gate : src/components/company-view.tsx:370-375.
**Ce qui est perdu** : le detail capital / droits de vote des premiers actionnaires.
**Compte reel** : 512 societes ont un `top_capital` renseigne, 234 un `top_voting`. La donnee est chargee et serialisee, elle n est jamais rendue.
**Correction proposee** : trancher explicitement — retirer les deux cles de disabled-blocks.json et de la ligne `__global__`, ou documenter le motif (juridique ?) dans le `_doc` du fichier.

---

### 3. Coupe de masse du 9 aout 2026 jamais revue — 93 societes (events) + 20 (ai_positioning)
**Fichier** : src/data/disabled-blocks-per-ste.json (109 societes au total), miroir Supabase `desk_disabled_blocks` (110 lignes, toutes horodatees 2026-08-09T16:42:54).
**Motif ecrit** : AUCUN. Le `_doc` ne donne qu un exemple sans rapport (BABA).
**Ce qui est perdu, et qui semble accidentel** :
- `events` coupe sur 93 societes ; 20 d entre elles ont aujourd hui des evenements reels : NESN.SW (8), NOVN.SW (7), HOLN.SW (7), KNIN.SW (7), AKZA.AS (8), VNA.DE (8), ENTG (6), MSTR (6), ARM (4), CCEP (4), ASML (3), ALGM (3), CRWV (3), FER (5), LSCC (4), QRVO (4), RKLB (2), LONN.SW (1), RMBS (1), SHOP (1).
- `ai_positioning` coupe sur 20 societes ; 18 ont aujourd hui un `summary` rempli : MC.PA, GLE.PA, ENGI.PA, BN.PA, STLAP.PA, FGR.PA, AC.PA, URW.PA, MT.PA, SLHN.SW, ACLS, ALNY, CCEP, FER, HONA, PDD, RKLB, MTX.DE.
- `risks` coupe sur LONN.SW (5 risques), SPCX (8), TRI (8) — donnees presentes.
- `gouvernance` coupe sur HONA et SPCX.
**Lecture** : coupe faite quand la donnee manquait, jamais rouverte depuis que les chaines ont rempli.
**Correction proposee** : rouvrir automatiquement un bloc per-ste des que la donnee correspondante est presente, et ecrire un motif obligatoire a chaque coupe.

---

### 4. `v2-pipeline-specific-kpis` enferme dans `if (enrich)` — 36 societes
**Fichier** : src/lib/company-core/load-company.ts:1317-1396, a l interieur du bloc `if (enrich)` ouvert ligne 850.
**Ce qui est perdu** : les KPI propres a la societe (segments, ratios bancaires, RevPAR...) pour toute societe sans src/data/v2-pipeline-enrich/<ticker>.json.
**Compte reel** : 611 societes ont le fichier specific-kpis, 608 ont le fichier enrich ; 39 ont le premier sans le second, dont **36** reellement fusionnables (`_fit_for_site` non faux, `_verification_needed` non vrai, liste non vide) : ABN.AS, AC.PA, ACA.PA, AI.PA, ASM.AS, ASRNL.AS, BMW.DE, BN.PA, BNP.PA, BVI.PA, CA.PA, CAP.PA, CS.PA, DSY.PA, ENGI.PA, HO.PA, IFX.DE, KER.PA, LR.PA, MC.PA, ML.PA, MTX.DE, OR.PA, ORA.PA, PUB.PA, QIA.DE, RI.PA, RMS.PA, RNO.PA, SAF.PA, SAN.PA, SGO.PA, SHELL.AS, SU.PA, URW.PA, VIE.PA. Double peine avec le defaut 1.
**PROUVE PAR CHARGEMENT REEL** :
```
BNP.PA  enrich=NON  fichier specific=5 -> rendus 0/5  (manquants : CET1 Ratio, Return on Tangible Equity, Leverage Ratio, Liquidity Coverage Ratio, Revenues)
MC.PA   enrich=NON  fichier specific=6 -> rendus 0/6  (Fashion & Leather Revenue, Selective Retailing, Watches & Jewelry...)
SAF.PA  enrich=NON  fichier specific=4 -> rendus 0/4  (LEAP Engine Deliveries, Civil Aftermarket Growth...)
AAPL    enrich=OUI  fichier specific=8 -> rendus 6/8  (le mecanisme marche quand le fichier enrich existe)
```
**Correction proposee** : sortir le bloc 1317-1396 du `if (enrich)`, comme cela vient d etre fait pour les graphiques moyen terme.

---

### 5. `v2-pipeline-exhaustive` enferme dans `if (enrich)` — 2 societes
**Fichier** : src/lib/company-core/load-company.ts:1843-1855.
**Ce qui est perdu** : `company.exhaustive` (18 domaines : bilan, croissance par segment, jalons, ESG structure).
**Compte reel** : 19 fichiers exhaustive, 2 societes sans enrich : ALC.SW, GEBN.SW.
**PROUVE PAR CHARGEMENT REEL** :
```
ALC.SW   enrich=NON  fichier exhaustive present -> exhaustive=absent
GEBN.SW  enrich=NON  fichier exhaustive present -> exhaustive=absent
ABBN.SW  enrich=OUI                             -> exhaustive=PRESENT
NESN.SW  enrich=OUI                             -> exhaustive=PRESENT
```
**Correction proposee** : sortir le bloc 1843-1855 du `if (enrich)`.

---

### 6. Cinq autres injections enfermees dans `if (enrich)` — 0 societe touchee aujourd hui, piege latent
Meme cause, impact nul a cette date parce qu aucune des 63 societes sans enrich ne possede la source :
| Ligne | Source | Societes avec la source mais sans enrich |
|---|---|---|
| 1402-1430 | `<t>.sa22d.json` | 0 (1 fichier au total dans l univers) |
| 1436-1466 | `<t>.kpis-v3.json` | 0 (162 fichiers) |
| 1713-1721 | `<t>.quarterly-history.json` (fusion trimestrielle) | 0 (426 fichiers) |
| 1777-1836 | table Supabase `desk_special_kpis` | 0 (3 lignes publiees, 2 societes) |
| 2227-2264 | synchro effectifs sur `key_facts.employees_count` | 0 (aucune des 63 n a ce champ) |
**Correction proposee** : sortir les cinq blocs du `if (enrich)` en meme temps que les defauts 4 et 5 — chacun casse silencieusement des qu une societe sans enrich recoit sa source.

---

### 7. Filtres silencieux — 0 societe touchee a la mesure, mais sans garde-fou
**Fichiers / lignes** :
- src/lib/company-core/load-company.ts:320-325 `readJsonOrNull` : `catch { return null }`. Un JSON mal forme est indistinguable d un fichier absent, sur TOUTES les sources.
- Lignes 1394, 1428, 1464 : `catch {}` nu (specific-kpis, sa22d, kpis-v3). Aucune trace.
- Lignes 80, 669, 690, 700, 1833, 3052 : `catch` nus (taglines, GICS, clients, moat, KPI speciaux, override hero Supabase).
**Mesure** : 0 JSON invalide sur les 9 repertoires de donnees verifies (v2-pipeline, enrich, specific-kpis, kpi-annuel-fiche, kpis-haut, att, i18n, exhaustive, cahier/clients). Casse des noms de fichier : 0 ecart entre la casse demandee et la casse sur disque sur 17 sources.
**Correction proposee** : distinguer « fichier absent » (null muet) de « fichier illisible » (console.warn nomme), au moins dans `readJsonOrNull`.

---

### 8. Traces de debogage laissees en production — 671 societes en bruit, NVDA en clair
**Fichier** : src/lib/company-core/load-company.ts:2892 et 2895 — deux `console.error("DEBUG2 kpisHaut ...")` conditionnes a `ticker === "NVDA"`.
**Correction proposee** : supprimer les deux lignes.

---

### 9. Carte des locales incomplete — 671 societes, locales sv/da/it/es
**Fichier** : src/lib/company-core/load-company.ts:2416-2424. `localeMap` ne connait que de, de-ch, en, en-gb, nl. Le commentaire juste au-dessus annonce sv et da.
**Mesure** : fichiers presents dans src/data/v2-pipeline-i18n — en 641, de 641, fr 175, nl 0, sv 0, da 0, it 0, es 0. `nl` est par ailleurs masque dans src/data/disabled-locales.json.
**Lecture** : coherent avec l interdiction de traduction en vigueur depuis le 13 sept 2026. A verifier, pas a corriger a l aveugle.
**Correction proposee** : retirer l entree `nl` morte du `localeMap` et aligner le commentaire, ou rien si l interdiction est definitive.

---

### 10. Entrees mortes dans les fichiers de desactivation — anodin
- src/data/disabled-kpis-per-ste.json : `ATCO-A.ST` et `LRLCF` ne sont plus dans l univers des 671.
- src/data/disabled-blocks-per-ste.json : `gouvernance_top3_capital` coupe nominativement sur 17 societes alors que le blocage global (defaut 2) le coupe deja partout — sans effet propre ; 16 de ces 17 n ont d ailleurs aucun `top_capital`.
- `graphiques_schemas` coupe sur ORA.PA, SGO.PA, CAP.PA, PUB.PA, AC.PA : verifie en base, aucune de ces 5 n a de graphique approuve — perte nulle aujourd hui.
- src/data/v1-9-blocks-control.json : `per_ticker_overrides` vide, tous les interrupteurs globaux a `true`. Ce fichier ne cause aucune perte.

---

## Ce que l audit a verifie et trouve sain
- Casse des noms de fichier : 0 ecart sur 17 sources (v2-pipeline, enrich et ses 8 derives, exhaustive, i18n, kpi-annuel-fiche, kpis-haut, att, cahier/clients).
- JSON mal formes : 0 sur 9 repertoires.
- Filtre d admission (load-company.ts:731, `isV18Eligible` / `isStrictPass3`) : applique AVANT la fusion enrich, mais 0 societe de l univers est recalee a tort (seul NWSA sort, et c est un alias resolu vers NWS).
- Couverture des sources lues par le chargeur, sur 671 : v2-pipeline 671, tam 671, att 671, clients 671, GICS 671, ranks 670, transcripts 670, moat 669, kpis-haut 666, specific-kpis 611, enrich 608, mettrik-description 589, description 572, kpi-annuel-fiche 514, quarterly-history 426, ai-pos 165, kpis-v3 162, hero_name_fr 64, exhaustive 19, stories_signal_patch 19, sa22d 1.
- Le defaut corrige aujourd hui (graphiques moyen terme) touchait 9 societes reelles, pas 63 : AI.PA, ASM.AS, BNP.PA, CS.PA, MC.PA, OR.PA, RMS.PA, SAF.PA, SU.PA. Verifie en base : BNP.PA rend desormais 2 graphiques.
