# V195 - arbitrages ouverts (run planifie 28 aout 2026)

## 1. Ecarts value / history restants apres correction (echelle inverse : history cassee)
MTB Shareholders Equity (val 29,177 Mds $, history [0,016 .. 0,029]) et MTB Net Interest Income
(val 6,948 Mds $, history [0,004 .. 0,007]) : la value est juste, c est l history qui est divisee.
Remultiplier par 1000 donnerait une serie a 2 chiffres significatifs (16, 18, 25, 27, 29, 29),
donc plate sur les deux derniers points. Source verbatim necessaire. Meme famille : AKZA.AS Revenue,
TEL2-B.ST Revenue et Capex, CCI Adjusted Site Rental Gross Margin, MTB Other Income, CHTR Capex.

## 2. Descriptions mal cadrees (chiffre annuel sur un KPI trimestriel), non fausses en soi
ELAN Capex (276 M$ annuel, KPI trimestriel a 51 M$), LYB Capex (1 900 M$ annuel, KPI trimestriel a 269 M$).
Laissees intactes : le chiffre cite est exact, seul le cadrage differe.

## 3. YoY incoherents avec la serie : 331 KPI, dont 145 de signe oppose
NON CORRIGES volontairement : impossible de trancher entre un yoy verbatim correct et une history
incomplete ou decalee sans revenir aux sources. Exemple AAPL iPad Revenue, yoy +8 % contre une serie
annuelle [8,595 ; 6,914] alors que le vrai CA iPad est autour de 26 Mds $ : c est l history qui est fausse.
Liste complete dans /tmp/yoy-bugs.json (a rejouer avec scripts/scan-yoy.py).

Top 25 par ecart de signe :
  A         DPS                              yoy=   -22.2% calcule=    2.8 % (0.248 -> 0.255) [quarter]
  A         Cap Return                       yoy=   -50.4% calcule=    2.9 % (0.07 -> 0.072) [quarter]
  A         Payout Ratio                     yoy=    +1.8% calcule=  -35.0 % (32.6 -> 21.2) [quarter]
  AAPL      iPad Revenue                     yoy=    +8.0% calcule=  -19.6 % (8.595 -> 6.914) [year]
  AAPL      Wearables/Home/Acc               yoy=    +5.0% calcule=  -31.3 % (11.493 -> 7.901) [year]
  AEE       Capex                            yoy=   +19.6% calcule=   -4.4 % (4319 -> 4128) [year]
  AEP       EPS                              yoy=   +19.4% calcule=  -11.1 % (1.8 -> 1.6) [quarter]
  AFL       DPS                              yoy=   +16.0% calcule=  -73.7 % (2.32 -> 0.61) [year]
  AGN.AS    Cap Return                       yoy=   -20.8% calcule=   14.4 % (521 -> 596) [year]
  AKZA.AS   Total Revenue                    yoy=    +0.4% calcule=   -8.9 % (2.619 -> 2.386) [quarter]
  AMGN      Prolia                           yoy=    +9.0% calcule=   -2.2 % (1165 -> 1139) [quarter]
  APP       Capex                            yoy=   -52.4% calcule=   12.5 % (4.25 -> 4.78) [year]
  BBY       EPS                              yoy=   -24.6% calcule=    4.0 % (1.26 -> 1.31) [quarter]
  BDX       Headcount                        yoy=    -6.7% calcule=    2.7 % (70093 -> 72000) [year]
  BG        Capex                            yoy=   -61.5% calcule=   25.2 % (1376 -> 1723) [year]
  BIIB      Cash & Equivalents               yoy=   +57.8% calcule=  -32.4 % (2.3265 -> 1.5738) [quarter]
  BKNG      DPS                              yoy=    +9.7% calcule=  -72.7 % (1.536 -> 0.42) [year]
  BKR       DPS                              yoy=    +9.5% calcule=  -50.0 % (0.92 -> 0.46) [year]
  BKR       EPS                              yoy=   -12.8% calcule=   75.0 % (-0.08 -> -0.02) [quarter]
  BLDR      Cash & Equivalents               yoy=   +20.0% calcule=  -14.8 % (115.371 -> 98.342) [quarter]
  BMRN      Cost of sales                    yoy=   +23.6% calcule=   -8.3 % (580.2 -> 532.1) [year]
  BMRN      SG&A                             yoy=   +14.3% calcule=  -11.6 % (1.009 -> 0.892) [year]
  BMY       Growth Portfolio Revenue         yoy=    -2.0% calcule=   11.6 % (4.3 -> 4.8) [quarter]
  C         RoTCE                            yoy=   +31.4% calcule=  -10.7 % (7.5 -> 6.7) [year]
  C         CET1 Capital Ratio               yoy=    -1.5% calcule=    0.7 % (13.5 -> 13.6) [year]

## 4. Faux positifs verifies, ne pas re-signaler
VICI Charge_Credit_CECL et VICI Rev_Prets : la description cite la HAUSSE (+51,2 M $ et +83,9 M $),
pas le niveau. Coherent avec l history. Idem TAP (royalty exclu), WY (10 + 14 = 24 M acres),
PWR (925 M$ d acquisitions), SLB (879 M$ ChampionX), ROST (~80 magasins par an), LUV (1 mile), WBD (16 Mds de desendettement sur 4 ans).
## 5. Deuxieme lot du meme run : unites et KPI vides

Corriges : GL Premium et WELL Resident fees etiquetes "Mds $" alors que la serie est en M $
(2 438 M $ et 4 265 M $, pas 2 438 Mds) ; CAT R&D, SHW Operating Cash Flow et SLB Operating
Cash Flow dont la value etait a deux ou trois ordres de grandeur sous leur serie ; APP Capex
realigne sur le dernier point.

Quinze KPI vides retires des fiches enrich : series entierement nulles (EVRG Dividend Payout
Ratio, ORLY Comp Sales) ou constantes a zero contre une realite non nulle (HEIA.AS, INGA.AS et
VOW.DE versent tous un dividende, leur DPS, Cap Return et Payout Ratio etaient a zero sur cinq
points), plus des KPI non chiffres (NVS et NOVN.SW "AI Integration" avec une serie textuelle
Growing/Expanding/Deepening, RIVN "Autonomy+ Platform", MO Cost Savings a 600 M $ sur une serie
de zeros). Cas notable : le DPS a zero d INGA.AS dans enrich masquait la vraie serie de
kpis-haut (1,086 EUR sur dix points), le retrait la laisse remonter.

Qualifieur avant et apres retrait : 9/9 PASS, aucun hero deplace.

## 6. Restent a arbitrer sur les series

Trois effectifs dont l history contient un point aberrant, non corriges : FAST (dernier point
1 148 179 pour environ 24 000 salaries), NOW (8 700 apres 26 293), GE (serie a 10 000 pour une
value de 57 milliers). CHTR Capex / Line Extensions : value 4 216 contre une serie [11,1 ; 11,7]
en Mds $, les deux ne mesurent pas la meme chose. Vingt-deux series a trous internes, surtout
des Payout Ratio et DPS europeens (SHEL, BCP.LS, FRE.DE, PHG, PHIA.AS), affichables mais lacunaires.
