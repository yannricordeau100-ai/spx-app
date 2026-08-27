# Session V195 du 27 aout 2026, reprise autonome (10h)

## Etat au demarrage
- clean-all-tickers : 862 (l univers avait grossi de 656 a 862 dans la nuit,
  commits 66871dcc8c, 146bce502d, 68eee79c83, 317c5d07dd).
- online (desk_curated_companies) : 853, dont 848 dans clean-all.
- 14 non-online = les bloques structurels connus, plus 5 online hors clean-all.
- Alias mettrik-niveau2 sain (api 200), casse des fichiers propre.

## Travail fait

### 5 stes publiees
SAND.ST (Sandvik), NDA-FI.HE (Nordea), EDP.LS (EDP), MAP.MC (Mapfre), UNM (Unum).
Aucune n a d equivalent deja en ligne. Publiees dans Supabase ET ajoutees a
v1-9-5-clean-all-tickers.json (867).

Les 4 premieres etaient bloquees par le seuil de 4 KPI specifiques du qualifieur,
leur hero etait deja valide. 3 a 5 KPI extraits verbatim par agent depuis
/Users/yann/Mettrik/sec-data/cat3-european/<T>/annual-text.

### Nouvelle famille de defaut : la couche <t>.hero_name_fr.json degrade le hero
`v2-pipeline-enrich/unm.hero_name_fr.json` repointait le hero UNM de
"Unum US Premium Income" (20 trimestres) vers "Premium Income" (12 trimestres),
sous le seuil de profondeur du qualifieur. Le garde-fou `canReplaceHero` de
load-company.ts ne bloque cette couche tardive que si le candidat est GENERIQUE ;
un candidat specifique mais moins profond passe.

Test de detection (relancable) : pour chaque `v2-pipeline-enrich/*.hero_name_fr.json`
comparer `hero_kpi_override` au `hero_kpi` de la base et la longueur des deux
history. 57 fiches repointees, 23 ou la base est plus profonde. ATTENTION : dans
22 des 23 cas l override n existe pas dans base.kpis (longueur -1), il est resolu
par une autre couche et l audit qualifieur les donne PASS. Ne pas corriger en masse,
seul UNM etait un vrai defaut.

### Audit qualifieur des 848 stes en ligne
842 PASS, 6 FAIL. Aucune regression malgre les 206 tickers ajoutes a clean-all
depuis le dernier audit exhaustif (642 stes le 22 aout).
- GOOGL : doublon d historique exact entre `paid_subscriptions` et
  "Total paid subscriptions across consumer services" [270, 300, 325, 350].
  Le second retire de la base. Introduit par le commit 7ca5cb12cb.
- Les 5 autres sont les blocages structurels connus : APP (mono-segment),
  RDDT (14 trim), CRWV (7 trim), GEV (10 trim), SW (10 trim).

### Gate de visibilite
5 tickers etaient online mais hors clean-all, donc leur fiche redirigeait :
- BK et SATS : renommes en BNY et ECHO, plus aucune fiche de donnees. DEPUBLIES.
- DGE.L (Diageo) et CLNX.MC (Cellnex) : `v2-pipeline/<t>.json` a `kpis: []` et
  `hero_kpi: null`, la fiche rend vide. Les KPI existent pourtant dans
  v2-pipeline-specific-kpis et v2-pipeline-enrich mais ces couches ne sont PAS
  fusionnees quand la base est vide. Extraction verbatim lancee.
  A noter : la table Supabase `desk_hero_kpi_overrides` porte pour CLNX.MC un
  override vers "Towers Owned EU", un short qui n existe dans aucune couche.
- SPM.MI (Saipem) : hero valide, 1 KPI specifique sur 4. Extraction lancee.

### Pipeline CA
Relance, 141 blocs traites : ok=23, reject=101 (legitimes, slices<2 sur des
mono-geographies), no_source=17. Les 23 blocs valides un par un avant commit.
4 blocs retires puis remis en file (couple retire de `done` dans
/tmp/ca-pipeline-checkpoint.json, methode documentee) :
- WPP.L segment : 97,3 Mds £ pour Global Integrated Agencies quand le CA du
  groupe est 14,4 Mds £, facteur d environ 8.
- BME.L geographie : total 2 749 M £ (un semestre) face a un bloc segment annuel
  a 5,5 Mds £. Perimetres temporels differents.
- MUFG geographie et NMR segment : 0 part chiffree, blocs vides a l affichage.

## A ARBITRER PAR YANN

### ADTTF (Advantest) : donnees suspectes, non publiee
L agent d extraction signale deux KPI de la fiche incompatibles avec le rapport
integre 2025 : `Headcount` [6.8, 6.9, 7, 7.1, 7.2] K et `Memory Tester Revenue`
[55, 65, 80, 95, 110]. Les deux series sont trop regulieres pour etre verbatim.
Le rapport ne contient AUCUN detail par segment hors SoC Test Systems, aucun
backlog, aucune commande recue (verifie aussi par pdftotext sur le PDF). Les deux
KPI vides `HPC / Cloud` et `HPC/Cloud Revenue` ne sont remplissables par aucune
source locale. Fiche laissee hors ligne.

### ITRK.L (Intertek) : 3 KPI specifiques sur 4, non publiee
Le hero `Products Division Revenue` s arrete a 2022. Les divisions Trade et
Resources n existent plus au-dela de 2021-2022 dans les sources locales et les
5 divisions actuelles n ont que 4 exercices. Seuls les effectifs (moyens et de fin
d exercice, note 4 des AR2022 a AR2025) sont extractibles sur 5 ans, ce qui donne
3 KPI specifiques. Il manque une source recente (rapport annuel 2026).

### NDA-SE.ST et NDA-DK.CO : pas de fiche de base
Les KPI Nordea extraits valent pour les trois cotations, mais
`src/data/v2-pipeline/nda-se.st.json` et `nda-dk.co.json` n existent pas, seuls
`src/data/companies/<t>.json` sont presents, avec des heros inexploitables
(Return on Equity, CET1 Ratio). Il faudrait creer les deux fiches de base.

### 26 stes restent depubliees
Les 31 de la session precedente moins UNM, EDP.LS, MAP.MC, NDA-FI.HE, SAND.ST.
La plupart sont des ADR doublons dont le ticker principal est deja en ligne
(AZN/AZN.ST, RELX/REL.L, EQNR/EQNR.OL, BBVA/BBVA.MC, BNPQY/BNP.PA, DNKEY/DANSKE.CO,
SAP/SAP.DE, SU/SU.PA, SIEGY/SIE.DE). Sans equivalent : NBIX, BWA, ITRK.L, SPM.MI,
NDA-SE.ST, NDA-DK.CO, MURGY, ADTTF, TSCO.L, FORTUM.HE, BNT, VCISY, MT.AS, AMUN.PA.

BWA (BorgWarner) est un cas structurel du type FLEX : la segmentation a ete
refondue plusieurs fois, aucune serie de segment n atteint 16 trimestres
(le plus long fait 8). Ne pas re-tenter sans nouvelle source.


## Complements de fin de run

### Ecarts entre les deux onglets de repartition, 14 blocs retires
Test tranchant : comparer chaque total au CA reel de la fiche, pas le rapport des
deux totaux. Sur ces 14 fiches un onglet collait au CA et l autre couvrait un
perimetre partiel ou une segmentation perimee.
- Onglet geographie retire : ABI.BR (2 parts pour 28,4 Mds face a 59,8 de segments),
  BA (129,3 Mds), L, POWL, SNAP, TDY, TRI (19,9 Mds face a un CA de 7,3).
- Onglet segment retire : CAT (116,0 Mds face a 67,6 de geographie), COHR, DD
  (segmentation DowDuPont d avant la scission Qnity), DIS, IT, MPWR, VOW.DE
  (26,2 Mds face a un CA de 321,9).
Les 14 couples sont inscrits dans `done` du checkpoint : DD, DIS et L avaient deja
ete retires le 22 aout et etaient revenus faute de ce verrou.

En arbitrage, non touches : MCK (les deux onglets douteux, 403,4 contre 231,1),
NG.L (blocs en livres face a un CA de fiche en dollars), SLHN.SW (les deux
partiels). Ecartes comme legitimes et a ne plus signaler : ARES et KKR (AUM),
C, JPM, MS, RJF, MCO, IBKR (revenus nets contre bruts), APA et EOG (ligne
d achats de petrole), HLT (hors remboursements de couts), APP et EPAM.

### Fraicheur des fiches contre kpis-haut
541 comparaisons, une seule derive reelle : PNC NIM restee au T1 2026 a 2,95 %
quand kpis-haut porte 2,96 % au T2 2026. Corrigee, yoy recalcule a +16 pb
(2,96 contre 2,80 au T2 2025). Le resync des runs precedents tient.
