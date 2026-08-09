# V195 N2 : etat au 9 aout 2026

## Chiffres
- **845 stes en ligne** (table Supabase `desk_curated_companies`, lue au runtime
  par /api/online-tickers, aucun redeploy necessaire pour publier).
- Univers V195 (`v1-9-5-clean-all-tickers.json`, 589 tickers) : **577/589 en ligne**.
- Publication du 9 aout : IMB.L publie puis **retire le meme jour** (voir plus bas :
  sa fiche n'existe pas, la page redirige vers l'overview).

## ⚠ A ARBITRER EN PRIORITE : 269 stes en ligne SANS fiche
La page V1.9.5 (`src/app/sandbox/v1-9-5/[ticker]/page.tsx`, ligne 226) redirige
vers l'overview **toute ste absente de `v1-9-5-clean-all-tickers.json`**, meme si
`loadV17Company` rend des KPIs. Or 269 des 845 stes publiees dans Supabase sont
hors de cette liste : elles apparaissent dans la recherche et renvoient
l'overview au clic. Verifie en vue connectee (audit_token) : la page fait
2 166 745 octets a l'identique pour BABA, SHEL, TM, HSBC, UBS, TD, MUFG, UL,
9984.T, contre 361 a 415 Ko pour une vraie fiche (JNJ, MSI, ADBE).

Liste complete : `.conv-state/v195-online-hors-clean-9aout.txt`. Elle contient des
noms lourds : BABA, SHEL, TM, HSBC, UBS, GSK, NVO, RY, BP, AZN, SAP, RELX, BARC.L,
SIE.DE, VOW.DE, toute la cote canadienne .TO deja publiee, etc.

Deux issues possibles, c'est un arbitrage de perimetre, pas un fix technique :
1. **etendre** `v1-9-5-clean-all-tickers.json` a ces 269 tickers (elles ont des
   donnees, il faut verifier bloc par bloc avant de les rendre visibles) ;
2. **depublier** les 269 le temps de la verification (`publish-online.ts --hide`).

Je n'ai pas tranche seul : rendre 269 fiches visibles ou les retirer de la
recherche change ce que voient les clients.

## Univers V195 : la queue est fermee
Les 12 tickers restants echouent tous pour raison structurelle, verifiee.
Ne pas re-tenter sans nouvelle source :

| Ticker | Blocage |
|---|---|
| BG | Agribusiness supprime au 1er juillet 2025 (absorption Viterra). 10 trimestres verbatim max (Q1 2023 a Q2 2025), aucun 10-Q local avant 2024, les 8-K locaux n'ont que la page de couverture sans exhibit 99.1. |
| ALAB | 14 trimestres max (Q1 2023 a Q2 2026). Aucune desagregation par gamme Aries/Taurus/Leo/Scorpio : la seule ventilation est annuelle Product sales vs Engineering services, et Product sales = CA total en 2025. |
| PSKY | 10 trimestres (fusion Paramount Skydance). |
| SNDK | 11 trimestres (spin-off Western Digital fevrier 2025), hero = CA total. |
| TKO | 10 trimestres (entite creee 2023), hero = CA total. |
| Q | 8 trimestres (spin-off). |
| NBIS | 8 trimestres. |
| SPCX | 4 trimestres, 0 KPI specifique. |
| HONA | 2 semestres, 0 KPI specifique. |
| ARM, SOLV, AMRZ.SW, GFS | deja au blocked tail (AMRZ.SW : comptes carve-out depuis FY2022 seulement ; GFS : Foreign Private Issuer 20-F, end-market en dollars sur 2 exercices). |

## Chemin des filings : correction
Les filings sont dans **`/Users/yann/spx-app/data-lake/<TICKER>/{10K,10Q,8K}`**
(2189 tickers). `/Users/yann/Mettrik/sec-data/cat1-us|cat2|cat3` existe aussi mais
est incomplet : un agent y a cherche ALAB en vain alors que data-lake avait
2 10-K et 8 10-Q. Toujours pointer les agents sur data-lake en premier.

## 2e univers (`v1-9-universe.json`, 990 tickers) : cartographie faite
204 hors ligne, dont 9 couverts par la table d'alias de `load-company.ts`.
**194 qualifies le 9 aout**, resultat :

- **137 REDIRECT/empty** : `loadV17Company` ne renvoie aucun KPI. Ce n'est PAS un
  probleme de hero, donc **hors perimetre N2**. Deux causes distinctes :
  1. le ticker est aliase vers un canonical vide (LLOY.L vers LYG, RR.L vers
     RYCEF, BMW.DE vers BMWYY, BATS.L vers BTAFF) ;
  2. le ticker n'a aucune fiche generee (ENB.TO, BMO.TO, CNQ.TO, CP.TO, toute
     la cote canadienne .TO, et une partie de Vienne .VI).
  Il faut une generation de fiche (N1/N0), pas un fix hero.
- **28 hero generique**, 3 hero = CA total, ~10 profondeur insuffisante.
- **9 PASS bruts**, ramenes a **5 apres durcissement du qualifieur** (voir plus bas).

## Heros suspects a arbitrer (rien publie, revue Yann)

| Ticker | Hero | Valeur | Pourquoi je n'ai pas publie |
|---|---|---|---|
| 7203.T | Vehicle Sales (M unites, 5 ans) | 10,31 | Double blocage : hors clean-all (pas de fiche), et **TM est deja en ligne** donc publier creerait une 2e fiche Toyota. A traiter par un alias 7203.T vers TM dans `load-company.ts`. |
| CBK.DE | NET_Q | 898 | Resultat net trimestriel : ligne comptable, pas un KPI de demande. 23 KPIs specifiques disponibles, un meilleur hero existe surement. |
| HLMA.L | Adjusted Profit Before Tax | 422 | Ligne comptable ajustee. |
| INF.L | Dividend | 20 | Un dividende n'est pas une mesure d'activite. Hero a repointer. |
| UTG.L | One & Done | 35 | Libelle opaque, sans unite claire. A verifier a la source. |

## Contamination grave detectee : ENI.MI
La fiche ENI.MI (Eni SpA, petrolier italien) porte les KPIs d'une **autre entite** :
"Congress Attendance" 225, "Congress Countries" 11, "Loss Prevention Colloquium" 80,
extraits d'un Geschaftsbericht de l'IVR (association de la navigation fluviale).
Le `_validation` du fichier le dit lui-meme : "Ticker ENI.MI ne correspond pas a IVR
(association non cotee) mais conserve tel que fourni". A purger avant toute
publication d'ENI.MI.

## Durcissement du qualifieur (commits du 9 aout)

### 1. Gate de visibilite (le plus important)
Le qualifieur declarait PASS des stes dont la fiche n'existe pas : il lisait
`loadV17Company` mais pas la liste de visibilite de la page. C'est ce qui m'a fait
publier IMB.L, dont la page redirigeait vers l'overview. `qualify-stes.ts` charge
desormais `v1-9-5-clean-all-tickers.json` (avec la meme normalisation de
separateurs que la page) et rejette d'emblee tout ticker absent.

Effet immediat : IMB.L et 7203.T tombent en FAIL "hors clean-all", AAPL et JNJ
restent PASS.

### 2. Heros CA total deguises
`scripts/qualify-stes.ts` laissait passer des CA total sous des libelles non couverts.
Deux ajouts :
1. 17 variantes ajoutees a `TOTAL_REV` : `ca t`, `rev fy`, `rev q`, `group revenue`,
   `consolidated revenue`, `turnover`, `group turnover`, etc.
2. Nouveau rejet **par nom seul** : si le `short` normalise du hero est un libelle de
   CA total, on rejette meme si aucune autre valeur ne coincide. Necessaire car les
   unites divergent entre KPIs d'une meme fiche (IMCD.AS "CA_T" en M € face a
   "Revenue" en Mds €), ce qui faisait echouer la detection par valeur.

Effet : TEP.PA, VER.VI, WKL.AS et IMCD.AS, qui passaient a tort, tombent
maintenant. `npx tsc --noEmit` propre.

## Pipeline CA
`ca-pipeline-autonome.py` relance le 9 aout : **0 (ticker,block) a traiter**, file vide.
Plus rien a backfiller cote revenue_by_segment / geography sur les V195.

## Prochaine action utile
Le travail N2 sur l'univers V195 est termine. Les gisements restants sont, par
ordre de rendement :
1. Generer les fiches manquantes de la cote canadienne (.TO) et de Vienne (.VI) :
   ~137 tickers sans aucune donnee, c'est du N1/N0.
2. Repointer les 28 heros generiques du 2e univers qui ont deja une fiche rendue.
3. Purger ENI.MI et arbitrer les 5 heros suspects ci-dessus.
