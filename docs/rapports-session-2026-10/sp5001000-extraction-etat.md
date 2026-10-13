# Extraction sp5001000 : etat au 2026-10-13 15:22

Statuts : p3 fini 489, impossible 1 ; total 490/490

Reprise : relancer le workflow (scripts du dossier .claude workflows, ou recreer) sur les tickers absents de data-lake/_sp5001000/etat-extraction/ ou sans champ p3. Gabarits .conv-state/sox30-template-p2.txt et p3.txt. Puis scripts/sp5001000-onboard.py et scripts/deploy-niveau1.sh (voir docs/rapports-session-2026-10/n1-sp5001000.md).

| Ticker | P2 | Series | Hero | Verif | P3 ecrits |
|---|---|---|---|---|---|
| AA | fini | 31 | ALUM_PRICE_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| AAL | fini | 59 | TRASM | 4/4 | risks, gouvernance, segments, ia_positionnement |
| AAOI | fini | 31 | DC_REV_Q | -/- | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| AAON | fini | 31 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ACI | fini | 40 | PHARMACY_SALES | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ACM | fini | 21 | ADJ_EPS_FY | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| ADC | fini | 33 | AFFO_PS | 4/4 | risks, gouvernance, ia_positionnement |
| ADT | fini | 26 | DEBT | 4/4 | risks, gouvernance, segments, ia_positionnement |
| AEIS | fini | 50 | MKT_DC_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AFG | fini | 51 | PC_OP_EARN | 4/4 | risks, gouvernance, segments, ia_positionnement |
| AFRM | fini | 46 | GMV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AGCO | fini | 41 | ADJ_IFO_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AGNC | fini | 49 | NSDRI_PS | 4/4 | risks, gouvernance, ia_positionnement |
| AGO | fini | 24 | ABV_PS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| AHR | fini | 50 | REVENUE | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AIT | fini | 42 | es_sales | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| ALK | fini | 31 | RASM | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ALLY | fini | 64 | AUTO_NCO_PCT | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ALM | fini | 21 | APT_PRICE_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ALSN | fini | 35 | DEFENSE_Q | 4/4 | risks, gouvernance, segments, geo |
| AM | fini | 30 | GATH_BP | 4/4 | risks, gouvernance, segments, ia |
| AMG | fini | 35 | ECON_EPS | 4/4 | risks, gouvernance, geo, ia |
| AMH | fini | 38 | CORE_FFO_PS | 4/4 | risks, gouvernance |
| AMTM | fini | 39 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AN | fini | 69 | ADJ_EPS_FY | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| APG | fini | 44 | RPO_Q | 4/4 | risks, gouvernance, geo, ia |
| APLD | fini | 23 | CA_TOTAL | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| APPF | fini | 32 | UNITES_GEREES | 4/4 | risks, gouvernance, segments, ia_positionnement |
| AR | fini | 26 | PROD_DAILY | 4/4 | risks, gouvernance, segments |
| ARMK | fini | 36 | SLC_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ARW | fini | 51 | GC_SALES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| ARWR | fini | 20 | cash_resources | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| AS | fini | 40 | REV_TA | 4/4 | risks, segments, geo, ia_positionnement |
| ASND | fini | 19 | REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| ASTS | fini | 29 | capex | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ATI | fini | 30 | jet_engines | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| ATR | fini | 42 | PH_REV_Q | 4/4 | risques, gouvernance, segments, geo |
| AU | fini | 89 | REV_OR_FY | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr |
| AUGO | fini | 79 | ADJEBITDA_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| AUR | fini | 21 | LIQUIDITE_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, ia_positionnement_fr.json |
| AVAV | fini | 42 | FUNDED_BACKLOG | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AVT | fini | 37 | asia_q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| AVTR | fini | 46 | ORGANIC_GROWTH | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AWI | fini | 47 | AS_SALES_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AXS | fini | 73 | INS_GPW | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AXSM | fini | 27 | REV_TOTAL | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AXTA | fini | 33 | REFINISH_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| AYI | fini | 31 | ADJ_EPS | 4/4 | risks, gouvernance, segments, geo, ia |
| BAH | fini | 34 | REV_XB_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| BAM | fini | 34 | FBC_FY | 4/4 | risks/extracted.json, gouvernance_fr.json, ia_positionnement_fr.json |
| BBIO | fini | 19 | REV_TOTAL | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| BBWI | fini | 31 | BBWI_SALES_PER_SQFT | 4/4 | risks, gouvernance, segments, ia |
| BC | fini | 35 | PROP_S_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| BEPC | fini | 13 | FFO | 4/4 | risks, gouvernance, segments, ia |
| BFAM | fini | 44 | REV_BU_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| BHF | fini | 59 | SHIELD_SALES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| BILL | fini | 31 | TRANS_FEES_Q | 4/4 | risks, gouvernance, segments, ia |
| BIO | fini | 37 | Long-Term Investments (incl. Sartorius) | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| BIRK | fini | 41 | REV_FY | 4/4 | risques, segments, geo, ia |
| BJ | fini | 33 | MEMBERSHIP_FEE_INCOME | 4/4 | risks, gouvernance, segments, ia |
| BLSH | fini | 47 | SUBS_SERVICES_REV | 4/4 | risks, gouvernance, ia |
| BMNR | fini | 15 | ETH_HOLD | 4/4 | risks, gouvernance, segments |
| BMRN | fini | 44 | voxzogo_ca | 4/4 | risks, gouvernance, geo, ia_positionnement |
| BOKF | fini | 129 | TBVPS | 4/4 | risks, gouvernance, segments |
| BPOP | fini | 82 | TBVPS | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| BRKR | fini | 35 | BACKLOG_FY | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| BROS | fini | 47 | shops_total | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| BRX | fini | 40 | ABR_PSF | 4/4 | risques, gouvernance |
| BSY | fini | 31 | ARR | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| BURL | fini | 39 | STORES_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| BWA | fini | 30 | NET_SALES_FY | 4/4 | risks, gouvernance, segments, geo |
| BWXT | fini | 39 | BACKLOG | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| BYD | fini | 41 | ADJ_EPS | 4/4 | risks, gouvernance, segments |
| CACC | fini | 71 | LOANS_GROSS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CACI | fini | 41 | BACKLOG_TOTAL | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CAI | fini | 34 | Molecular Profiling Revenue | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| CAR | fini | 56 | Revenue per Day Total | 4/4 | risques, gouvernance, segments, geo |
| CART | fini | 32 | GTV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CAVA | fini | 28 | CAVA_REV | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CBC | fini | 49 | NII | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CBSH | fini | 60 | TRUST_FEES | 4/4 | risques, gouvernance, segments, ia |
| CCC | fini | 26 | SW_SUB_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CCK | fini | 31 | SEG_INC_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| CDE | fini | 93 | REVENUE | 4/4 | risks, gouvernance, segments, geo |
| CE | fini | 39 | OP_EBITDA | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CELH | fini | 31 | REV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, geo_fr.json, ia_positionnement_fr.json |
| CFR | fini | 89 | EPS_DIL | 4/4 | risques, gouvernance, segments |
| CG | fini | 51 | Fee-earning AUM | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CGNX | fini | 24 | GM_PCT | 4/4 | risks, gouvernance, segments, geo, ia |
| CHDN | fini | 42 | HR_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CHE | fini | 44 | VITAS_ADC | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CHH | fini | 32 | US_ROYALTY_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| CHRD | fini | 44 | PROD_OIL | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CHWY | fini | 30 | AUTOSHIP_SALES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| CHYM | fini | 27 | TXN_PROFIT | 4/4 | risks, gouvernance, segments, ia_positionnement |
| CLF | fini | 32 | ASP_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CLH | fini | 34 | TS_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CNA | fini | 102 | PC_CR | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| CNH | fini | 63 | AG_SALES_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CNM | fini | 25 | SALES_PVF | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| COKE | fini | 27 | STILL_SALES | 4/4 | risques, gouvernance, segments |
| COLB | fini | 71 | NIM | 4/4 | risks, gouvernance, segments, ia_positionnement |
| COLD | fini | 34 | CORE_EBITDA | 4/4 | risks, gouvernance, segments, geo |
| COLM | fini | 49 | INTL_SHARE | 4/4 | risks, gouvernance, segments, geo |
| CORT | fini | 25 | REV | 4/4 | risks, gouvernance |
| CPNG | fini | 41 | net_other_revenue_q | 4/4 | risques, gouvernance, segments, ia |
| CR | fini | 59 | BACKLOG_AAT | 4/4 | risks, gouvernance, segments, geo |
| CRBG | fini | 62 | ABVPS | 4/4 | risks, gouvernance, geo, ia_positionnement |
| CRCL | fini | 52 | USDC_CIRC | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| CRDO | fini | 31 | REV_Q | 4/4 | risks, gouvernance, geo, ia |
| CROX | fini | 43 | CROCS_DTC | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CRS | fini | 41 | SAO_OI_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CRUS | fini | 41 | HPMS_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| CSL | fini | 39 | EMARGIN_CCM | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CUBE | fini | 43 | 3rd-Party Stores | 4/4 | risks, gouvernance, segments, ia |
| CUZ | fini | 48 | OFFICE_LEASED | 4/4 | risks, gouvernance, ia_positionnement |
| CW | fini | 60 | BACKLOG | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| CWEN | fini | 30 | REN_GWH_Q | 4/4 | risques, gouvernance, segments |
| CZR | fini | 44 | Adjusted EBITDA | 4/4 | risques, gouvernance, segments, ia |
| DAR | fini | 23 | COMB_EBITDA_Q | 4/4 | risks, gouvernance, segments, geo, ia |
| DBX | fini | 35 | USERS_Q | 4/4 | risks, gouvernance, geo, ia_positionnement |
| DCI | fini | 45 | AFTERMARKET_REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| DDS | fini | 42 | EPS_DILUTED | 4/4 | risks, gouvernance, segments, ia_positionnement |
| DINO | fini | 53 | REFINING_MARGIN_BBL_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| DKNG | fini | 29 | REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| DKS | fini | 26 | comp_sales | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| DLB | fini | 36 | LIC_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| DOCN | fini | 14 | REV_Q | 4/4 | risks, gouvernance, geo, ia |
| DOCS | fini | 40 | CA_ABONNEMENT_Q | 4/4 | risques, gouvernance, segments, ia |
| DOCU | fini | 32 | SUB_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| DOX | fini | 20 | MS_REV | 4/4 | risks, gouvernance, segments, geo, ia |
| DRS | fini | 39 | BACKLOG_TOTAL | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| DT | fini | 27 | ARR | 4/4 | risks, gouvernance, segments, geo, ia |
| DTM | fini | 33 | ADJ_EBITDA | 4/4 | risks, gouvernance, segments, ia_positionnement |
| DUOL | fini | 31 | DAU | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| DY | fini | 26 | BACKLOG | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| ECG | fini | 66 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| EEFT | fini | 60 | PI_TX | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| EGP | fini | 54 | FFO_PS | 4/4 | risks, gouvernance, ia_positionnement |
| EHC | fini | 50 | DISCHARGES | 4/4 | risks, gouvernance, segments |
| ELAN | fini | 33 | PET_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ELF | fini | 38 | INTL_REV | 4/4 | risks, gouvernance, geo, ia_positionnement |
| ELS | fini | 32 | MH_RENT | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| EMN | fini | 64 | EMN_AM_REV | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr, ia_positionnement_fr |
| ENPH | fini | 23 | MW_DC_Q | 4/4 | risks, gouvernance, geo, ia_positionnement |
| ENSG | fini | 40 | DAYS_Q | 4/4 | risks, gouvernance, segments |
| EPR | fini | 43 | FFOAA_PS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| EQH | fini | 38 | AUM_TOTAL | 4/4 | risks, gouvernance, ia_positionnement |
| ESAB | fini | 34 | ADJ_EBITDA | 4/4 | risks, gouvernance_fr, segments_fr, ia_positionnement_fr |
| ESI | fini | 43 | ca_electronique | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ESTC | fini | 44 | EC_REV | 4/4 | risques, gouvernance, segments, geo, ia |
| ETSY | fini | 28 | GMS_TOTAL | 4/4 | risques, gouvernance, segments, geo, ia |
| EVR | fini | 33 | ADVISORY_FEES | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| EWBC | fini | 70 | EPS_DIL | 4/4 | risks, gouvernance, segments, ia_positionnement |
| EXEL | fini | 30 | CABOMETYX_US_REV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| EXLS | fini | 29 | active_clients | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| EXP | fini | 39 | cem_price | 4/4 | risks, gouvernance_fr, segments_fr |
| FAF | fini | 68 | TITLE_OPEN_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| FBIN | fini | 35 | WATER_OIBC_Q | 4/4 | risks, gouvernance, segments, geo |
| FCN | fini | 42 | BILLABLE_HC_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| FCNCA | fini | 66 | DEPOSITS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| FHB | fini | 101 | EPS_DIL | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| FHN | fini | 58 | TBVPS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| FIG | fini | 31 | CUST100K_Q | 4/4 | risks, gouvernance, geo, ia_positionnement |
| FIGR | fini | 44 | VOLUME_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| FIVE | fini | 46 | stores | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| FLS | fini | 40 | BACKLOG_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| FLUT | fini | 36 | AMP | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| FN | fini | 54 | OPT_Q | 4/4 | risks, gouvernance, geo, ia |
| FNB | fini | 45 | TBVPS | 4/4 | risks, gouvernance, ia |
| FND | fini | 37 | STORES | 4/4 | risks, gouvernance, segments, ia_positionnement |
| FNF | fini | 23 | FEE_PER_FILE_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| FORM | fini | 42 | DRAM_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| FOUR | fini | 27 | VOLUME_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| FPS | fini | 38 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| FR | fini | 43 | RENT_CASH | 4/4 | risks, gouvernance |
| FRHC | fini | 30 | BROK_ACCT_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| FRMI | fini | 26 | MATADOR_BUILD_Q | 4/4 | risques, gouvernance, ia |
| FRPT | fini | 26 | STORES_Q | 4/4 | risks, gouvernance, segments, ia |
| FTAI | fini | 30 | AERO_EBITDA_FY | 4/4 | risks, gouvernance, segments, geo, ia |
| FTI | fini | 47 | subsea_inbound | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| FWONK | fini | 25 | f1_rev | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| G | fini | 35 | EMPLOYEES_A | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| GAP | fini | 41 | COMP_GAP | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| GFL | fini | 34 | SW_REV | 4/4 | gouvernance_fr, segments_fr, geo_fr, ia_positionnement_fr |
| GGG | fini | 43 | RESULTAT_OP_Q | 4/4 | risks, gouvernance, segments, geo |
| GH | fini | 39 | ONC_TESTS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| GLPI | fini | 35 | AFFO_PS_Q | 4/4 | risks, gouvernance, segments |
| GLXY | fini | 29 | REV_GAINS_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| GME | fini | 39 | collectibles_q | 4/4 | risks, gouvernance, segments, geo |
| GMED | fini | 23 | ca_intl | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| GNTX | fini | 46 | UNITS_Q | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr |
| GPK | fini | 22 | ADJ_EBITDA | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| GSAT | fini | 34 | WHOLESALE_SVC_Q | 4/4 | risks, gouvernance, segments, geo |
| GTES | fini | 31 | core_growth_q | 4/4 | risks, gouvernance, segments, geo |
| GTLB | fini | 39 | saas_rev | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| GWRE | fini | 35 | ARR_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| GXO | fini | 43 | NEW_BUSINESS_WINS | 4/4 | risks, gouvernance, geo, ia_positionnement |
| H | fini | 42 | ROOMS | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| HALO | fini | 23 | ROYALTIES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| HAYW | fini | 43 | residential_pool | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr, ia_positionnement_fr |
| HEI-A | fini | 33 | backlog | 4/4 | risks, gouvernance, segments, geo, ia |
| HHH | fini | 34 | MPC_EBT_FY | 4/4 | risques, gouvernance, segments, ia |
| HL | fini | 23 | EBITDA_ADJ_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| HLI | fini | 40 | REV_CF | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| HLNE | fini | 38 | FEAUM | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| HR | fini | 16 | NFFO_PS_A | 4/4 | risks, gouvernance |
| HRB | fini | 28 | eps_cont_fy | 4/4 | risks, gouvernance_fr, segments_fr, ia_positionnement_fr |
| HUBS | fini | 42 | CUSTOMERS | 4/4 | risks, gouvernance, geo, ia_positionnement |
| HXL | fini | 44 | CA_AERO_COMM | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| IDA | fini | 35 | CUST_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| IESC | fini | 39 | BACKLOG_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| ILMN | fini | 44 | CONSUMABLES_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| INGM | fini | 62 | adj_roic | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| INGR | fini | 30 | AEPS_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| INSM | fini | 27 | arikayce_intl | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| IONQ | fini | 26 | rpo | 4/4 | risks, gouvernance, segments, geo |
| IONS | fini | 29 | COMM_REV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| IOT | fini | 36 | ARR | 4/4 | risks, gouvernance, geo, ia_positionnement |
| IPGP | fini | 36 | HP_CW_REV | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| IRDM | fini | 35 | SUB_IOT | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| IREN | fini | 16 | AI_CLOUD_REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| ITT | fini | 56 | ORDERS | 4/4 | risks, gouvernance, segments, geo |
| JAN | fini | 54 | SS_ANOI_Q | 4/4 | segments |
| JAZZ | fini | 39 | XYWAV_SALES | 4/4 | risques, gouvernance, segments, geo |
| JBS | fini | 79 | CA_BEEF_ANNUEL | 4/4 | risks, gouvernance, segments, geo |
| JEF | fini | 39 | IB_Q | 4/4 | risques, gouvernance, segments, geo |
| JHX | fini | 17 | NET_SALES | 4/4 | risks, gouvernance, segments, geo |
| JLL | fini | 36 | EPS_DILUTED | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| KBR | fini | 28 | ADJ_EBITDA_Q | 4/4 | risques, gouvernance, segments, geo, ia |
| KD | fini | 34 | Adjusted EBITDA | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| KEX | fini | 45 | REVTM_Q | 4/4 | risques, gouvernance, segments |
| KMX | fini | 62 | USED_UNITS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| KNSL | fini | 41 | GWP | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| KNX | fini | 64 | adj_operating_ratio | 4/4 | risks, gouvernance, segments, ia_positionnement |
| KRC | fini | 20 | occupancy | 4/4 | risques, gouvernance |
| KRMN | fini | 29 | BACKLOG | 4/4 | risks, gouvernance, segments, ia_positionnement |
| KTOS | fini | 49 | BACKLOG | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| KVYO | fini | 43 | REV_Q | 4/4 | risks, gouvernance, geo, ia_positionnement |
| LAD | fini | 36 | REV | 4/4 | risks, gouvernance, segments, geo |
| LAMR | fini | 29 | AFFO_PS | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| LAZ | fini | 35 | AUM_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| LBTYK | fini | 89 | telenet_broadband_subs | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| LEA | fini | 30 | CPV_EU_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| LECO | fini | 47 | AEBIT_M | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| LFUS | fini | 60 | ca_industriel | 4/4 | risks, gouvernance, segments, geo |
| LINE | fini | 54 | phys_occ | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| LKQ | fini | 29 | ORG_PS | 4/4 | risks, gouvernance, segments, geo |
| LLYVK | fini | 34 | LN_REV | 4/4 | risks, gouvernance, geo |
| LNC | fini | 54 | Encours moyens consolidés | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| LNG | fini | 16 | LNG_TBTU | 4/4 | risks, gouvernance, segments, geo |
| LOAR | fini | 41 | ADJ_EBITDA_A | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| LOPE | fini | 32 | ENR_PARTNER | 4/4 | risks, gouvernance, ia_positionnement |
| LPLA | fini | 46 | CLIENT_ASSETS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| LPX | fini | 33 | SIDING_SALES_Q | 4/4 | risks, gouvernance, segments, ia |
| LSTR | fini | 61 | TRUCK_RPL_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| LW | fini | 35 | VOLUME_VENTES | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| LYFT | fini | 33 | ACTIVE_RIDERS | 4/4 | risks, gouvernance, geo, ia_positionnement |
| M | fini | 26 | COMP_SALES | 4/4 | risks, gouvernance, segments, ia_positionnement |
| MANH | fini | 42 | RPO | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MAT | fini | 36 | HOTWHEELS_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MDB | fini | 36 | atlas_rev | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MDGL | fini | 19 | REZ_NET_SALES | 4/4 | risks, gouvernance, ia_positionnement |
| MDLN | fini | 40 | PRIME_VENDOR_SALES | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MDU | fini | 32 | EL_GWH_COM | 4/4 | risks, gouvernance, segments, ia_positionnement |
| MEDP | fini | 31 | BACKLOG | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| MHK | fini | 41 | seg_sales_ceramic | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MIDD | fini | 29 | SEG_CF_REV | 4/4 | risks, gouvernance, segments, geo |
| MKL | fini | 45 | COMBINED_RATIO | 4/4 | risks, gouvernance, segments, ia_positionnement |
| MKSI | fini | 39 | REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MKTX | fini | 44 | ADV_CREDIT_Q | 4/4 | risks, gouvernance, segments, geo, ia |
| MLI | fini | 41 | OPINC | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| MOD | fini | 50 | DC_SALES_FY | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| MOH | fini | 25 | premium_revenue | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| MORN | fini | 84 | AUMA_TOTAL_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| MP | fini | 40 | REV_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| MPT | fini | 30 | NFFO_PS | 4/4 | risques, gouvernance, segments, geo |
| MRP | fini | 41 | INVESTED_CAPITAL | 4/4 | risks, gouvernance, segments, ia |
| MSA | fini | 46 | Americas Adj Op Margin | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MSGS | fini | 22 | REV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| MSM | fini | 43 | ADS_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MTCH | fini | 33 | Payers | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| MTDR | fini | 36 | PROD_BOE | 4/4 | risks, gouvernance, segments, ia |
| MTG | fini | 66 | IIF | 4/4 | risks, gouvernance, ia_positionnement |
| MTN | fini | 43 | ETP | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| MTSI | fini | 42 | REV_DC | 4/4 | risks, gouvernance, geo, ia_positionnement |
| MTZ | fini | 31 | BACKLOG | 4/4 | risks, gouvernance, segments, ia_positionnement |
| MUSA | fini | 33 | EBITDA_Q | 4/4 | risks, gouvernance, segments |
| MWH | fini | 34 | NEWCONSTR_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| NBIX | fini | 24 | INGREZZA_VENTES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| NET | fini | 40 | large_cust | 4/4 | risks/extracted.json, gouvernance_fr.json, geo_fr.json, ia_positionnement_fr.json |
| NEU | fini | 43 | EPS_Q | 4/4 | risks, gouvernance, segments, geo |
| NFG | fini | 52 | prod | 4/4 | risks, gouvernance, segments, ia |
| NIQ | fini | 55 | ANN_SUB_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| NLY | fini | 45 | EAD | 4/4 | risks, gouvernance, segments, ia |
| NNN | fini | 35 | ABR | 4/4 | risks, gouvernance, ia_positionnement |
| NOV | fini | 45 | RIG_WW | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| NTNX | fini | 31 | ARR | 4/4 | risks, gouvernance, geo, ia_positionnement |
| NTRA | fini | 31 | TESTS_PROCESSED | 4/4 | risques, gouvernance, geo, ia |
| NU | fini | 55 | customers_q | 4/4 | risks, gouvernance, segments, ia |
| NVST | fini | 47 | SPT_SALES_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| NVT | fini | 41 | SP_SALES | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| NXST | fini | 26 | DIST_REV | 4/4 | risks, gouvernance, segments, ia_positionnement |
| NXT | fini | 34 | gw_delivered | 4/4 | risks, gouvernance, geo, ia_positionnement |
| NYT | fini | 55 | DIGITAL_SUB_REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| OC | fini | 29 | ADJ_EPS_Q | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| OGE | fini | 39 | SALES_COM_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| OGN | fini | 66 | P_NEXPLANON | 4/4 | risques, gouvernance, segments, geo |
| OHI | fini | 27 | affo | 4/4 | risks, gouvernance, segments, ia_positionnement |
| OKLO | fini | 16 | LIQ_TOTAL | 4/4 | risks, gouvernance, ia_positionnement |
| OKTA | fini | 41 | ACV100K_CUST | 4/4 | risques, gouvernance, geo, ia |
| OLED | fini | 43 | MAT_SALES | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| OLLI | fini | 45 | STORES_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| OLN | fini | 50 | E_CAPV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| OMF | fini | 35 | NET_REC | 4/4 | risks, gouvernance, ia_positionnement |
| ONON | fini | 42 | NS_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ONTO | fini | 41 | sys_rev | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ORI | fini | 53 | COMBINED_RATIO | 4/4 | risks, gouvernance, segments, ia_positionnement |
| OSK | fini | 35 | BACKLOG_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| OVV | fini | 58 | Free Cash Flow | 4/4 | risks, gouvernance, segments, ia_positionnement |
| OWL | fini | 36 | AUM_TOT | 4/4 | risks, gouvernance, segments, ia_positionnement |
| OZK | impossible | 0 |  | -/- |  |
| P | fini | 39 | SUBS_ARR | 4/4 | risks, gouvernance, geo, ia_positionnement |
| PAG | fini | 93 | RA_SP_GP | 4/4 | risks, gouvernance, segments, geo |
| PATH | fini | 42 | arr | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| PAYC | fini | 38 | ADJ_EBITDA_Q | 4/4 | risks, gouvernance, segments, ia |
| PB | fini | 74 | TA | 4/4 | risks, gouvernance |
| PCOR | fini | 37 | RPO_TOT | 4/4 | risks, gouvernance, geo, ia_positionnement |
| PCTY | fini | 30 | ADJ_EBITDA_Q | 4/4 | risks, gouvernance, ia_positionnement |
| PEGA | fini | 20 | ACV_CLOUD_Q | 4/4 | risques, gouvernance, segments, geo, ia |
| PEN | fini | 30 | US_REV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| PFGC | fini | 42 | adj_ebitda | 4/4 | risks, gouvernance, segments, ia_positionnement |
| PINS | fini | 38 | MAU_G | 4/4 | risques, gouvernance, geo, ia |
| PL | fini | 33 | rev_q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| PLNT | fini | 30 | CLUBS_TOTAL_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| PNFP | fini | 37 | TBVPS | 4/4 | risks, gouvernance, ia_positionnement |
| POST | fini | 57 | FY_ADJ_EBITDA | 4/4 | risks, gouvernance, segments |
| POWL | fini | 37 | BACKLOG_Q | 4/4 | risques, gouvernance, segments, geo |
| PPC | fini | 49 | ADJ_EBITDA_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| PPLI | fini | 24 | MGM_STAKE_VALUE | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| PR | fini | 30 | PROD_OIL | 4/4 | risques, gouvernance, segments |
| PRI | fini | 57 | client_asset_values | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| PRIM | fini | 39 | BKL_FIXED_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| PRMB | fini | 45 | EAU_PREMIUM | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| PSN | fini | 41 | BACKLOG_TOT | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| PVH | fini | 48 | SHARES_Q | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| QS | fini | 22 | ADJ_EBITDA_LOSS_Q | 4/4 | risks, gouvernance, ia_positionnement |
| QSR | fini | 63 | sws_total | 4/4 | risques, gouvernance, segments, geo, ia |
| QXO | fini | 33 | LOB_COMP | 4/4 | risks, gouvernance, segments, ia_positionnement |
| R | fini | 75 | CR_UTIL | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RAL | fini | 46 | DEF_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RBA | fini | 30 | gtv | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RBC | fini | 21 | adj_ebitda_q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| RBLX | fini | 25 | DAU | 4/4 | risks, gouvernance, geo, ia |
| RBRK | fini | 36 | ARR_SUB | 4/4 | risks, gouvernance, geo, ia |
| REXR | fini | 47 | CORE_FFO_PS | 4/4 | risks/extracted.json, gouvernance_fr.json |
| REYN | fini | 42 | adj_ebitda | 4/4 | risks, gouvernance, segments, geo |
| RGA | fini | 58 | IF_TOT | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| RGEN | fini | 34 | FILT_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RGLD | fini | 52 | GEO_SOLD | 4/4 | risques, gouvernance, segments, geo, ia |
| RHI | fini | 51 | PROT_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RITM | fini | 30 | EAD_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| RIVN | fini | 39 | DELIVERIES | 4/4 | risks, gouvernance, segments, ia_positionnement |
| RKT | fini | 48 | SERV_UPB | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| RLI | fini | 52 | GWP | 4/4 | risks, gouvernance, segments, ia_positionnement |
| RNG | fini | 38 | ARR_TOTAL | 4/4 | risques, gouvernance, segments, geo, ia |
| RNR | fini | 53 | TBVPS_DIV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ROIV | fini | 20 | LIQUIDITES | 4/4 | risques, gouvernance, ia |
| ROKU | fini | 32 | PLATFORM_REV | 4/4 | risks, gouvernance_fr, segments_fr, ia_positionnement_fr |
| RPM | fini | 38 | DIV_STREAK | 4/4 | risks, gouvernance, segments, geo |
| RPRX | fini | 28 | PORTFOLIO_RECEIPTS | 4/4 | risks, gouvernance, segments |
| RRC | fini | 42 | PROD_MCFE | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| RRX | fini | 40 | backlog | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| RS | fini | 68 | TONS_SOLD | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| RVMD | fini | 37 | RD_EXPENSE | 4/4 | risks/extracted.json, gouvernance_fr.json, ia_positionnement_fr.json |
| RYAN | fini | 20 | UM_REV | 4/4 | risques, gouvernance, segments, geo, ia |
| RYN | fini | 36 | adj_ebitda_southern | 4/4 | risks, gouvernance, segments, geo |
| S | fini | 33 | ARR | 4/4 | risks, gouvernance, geo, ia_positionnement |
| SAIA | fini | 43 | ltl_tonnes_par_jour | 4/4 | risks/extracted.json, gouvernance_fr.json, ia_positionnement_fr.json |
| SAIC | fini | 46 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| SAIL | fini | 35 | arr | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| SANM | fini | 33 | CC_REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| SARO | fini | 49 | ADJ_EBITDA_FY | 4/4 | risks, gouvernance, segments, geo |
| SCCO | fini | 68 | CASH_COST_NET | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SCI | fini | 41 | Preneed Backlog | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SEB | fini | 34 | CA_Q | 4/4 | risks, gouvernance, segments, geo |
| SEIC | fini | 38 | AUA | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SF | fini | 49 | CLIENT_ASSETS | 4/4 | risks, gouvernance, segments, geo, ia |
| SFD | fini | 71 | A_OP_PROFIT | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| SFM | fini | 49 | STORES_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| SGI | fini | 33 | DIRECT_SHARE | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SHC | fini | 34 | EBITDA_Q | 4/4 | risks, gouvernance, segments, geo |
| SIRI | fini | 45 | SX_SELFPAY | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| SITE | fini | 49 | ADJ_EBITDA_FY | 4/4 | risks, gouvernance, segments, ia_positionnement |
| SITM | fini | 38 | ced_rev | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SLGN | fini | 51 | REV_DISP_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| SLM | fini | 22 | PEL_ORIGINATIONS | 4/4 | risks, gouvernance |
| SMG | fini | 32 | US_CONS_SALES | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| SMMT | fini | 14 | CASH_INV | 4/4 | risks/extracted.json, gouvernance_fr.json |
| SMTC | fini | 27 | revenue_q | 4/4 | risques, gouvernance, segments, geo, ia_positionnement |
| SN | fini | 52 | CA_BEAUTY | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SNDR | fini | 47 | tl_rev_per_truck_week | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| SNOW | fini | 31 | product_rev | 4/4 | risks, gouvernance, geo, ia |
| SNX | fini | 56 | REVENUE | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SOFI | fini | 66 | members | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| SOLS | fini | 69 | REFRIGERANTS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json |
| SON | fini | 25 | DPS_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SPOT | fini | 47 | PREMIUM_SUBS | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| SPXC | fini | 33 | HVAC_REV_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SSB | fini | 51 | TBVPS | 4/4 | risks, gouvernance, ia_positionnement |
| SSD | fini | 37 | SALES_WOOD_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| SSNC | fini | 49 | ADJ_EBITDA | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ST | fini | 30 | ADJ_OP_MARGIN | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| STAG | fini | 32 | CORE_FFO_PS | 4/4 | risks, gouvernance, ia_positionnement |
| STRL | fini | 49 | rev_einfra | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| STWD | fini | 25 | CAPITAL_DEPLOYED | 4/4 | risks, gouvernance, segments, ia_positionnement |
| SUI | fini | 31 | CORE_FFO_PS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| SUNB | fini | 57 | REV_Q | 4/4 | risques, gouvernance, segments, geo, ia |
| TEAM | fini | 32 | CLOUD_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TEM | fini | 32 | DIAG_REV_A | 4/4 | risks, gouvernance, segments, ia |
| TFSL | fini | 42 | NIM_Q | 4/4 | risks, gouvernance, segments, ia |
| TFX | fini | 33 | CAT_INT_REV | 4/4 | risques, gouvernance, segments, geo |
| THC | fini | 34 | USPI_EBITDA | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| THG | fini | 71 | COMBINED_RATIO | 4/4 | risks, gouvernance, segments, ia_positionnement |
| THO | fini | 59 | TOT_BK_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TIGO | fini | 20 | POSTPAID_SUBS | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TKR | fini | 26 | BACKLOG_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TLN | fini | 40 | CAPACITY_REV | 4/4 | risks, gouvernance, segments, ia |
| TNL | fini | 35 | VPG | 4/4 | risks, gouvernance, segments, geo, ia |
| TOL | fini | 52 | BACKLOG_VALUE | 4/4 | risques, gouvernance, segments |
| TOST | fini | 34 | GPV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| TPG | fini | 49 | AUM_TOTAL | 4/4 | risks, gouvernance, ia |
| TREX | fini | 18 | GROSS_MARGIN_Q | 4/4 | risks, gouvernance_fr |
| TRU | fini | 48 | FS_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TTC | fini | 30 | BACKLOG_A | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| TTEK | fini | 33 | BACKLOG | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TTMI | fini | 34 | DCN_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TW | fini | 64 | ADV_TOTAL | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TWLO | fini | 30 | DBNE_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| TXRH | fini | 38 | AUV_TXRH | 4/4 | risks, gouvernance, segments, ia_positionnement |
| U | fini | 41 | FCF | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| UGI | fini | 51 | UTIL_EBIT | 4/4 | risks, gouvernance, segments |
| UHAL | fini | 33 | STORAGE_REV | 4/4 | risks, gouvernance, segments, geo, ia |
| UI | fini | 26 | ET_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ULS | fini | 54 | ULS_OCS_A | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| UNM | fini | 78 | Sales_US | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| USFD | fini | 54 | ADJ_EBITDA | 4/4 | risks, gouvernance, segments, ia_positionnement |
| UTHR | fini | 44 | TYVASO_TOTAL | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| UWMC | fini | 41 | ORIG | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| VFC | fini | 18 | TNF_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VIAV | fini | 38 | NSE_REV | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VICR | fini | 22 | BACKLOG_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VIK | fini | 73 | ANN_AGM | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| VIRT | fini | 30 | ANTI | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VKTX | fini | 14 | RD_SPEND_Q | 4/4 | risks/extracted.json, gouvernance_fr.json |
| VMI | fini | 36 | BACKLOG_FY | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VNO | fini | 30 | OCC_NY | 4/4 | risks, gouvernance, segments |
| VNOM | fini | 77 | TSR_A | 4/4 | risks, gouvernance, segments, ia_positionnement |
| VNT | fini | 39 | ADJ_EPS_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| VOYA | fini | 77 | RET_DC_CA | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| VSNT | fini | 59 | EBITDA_FY | 4/4 | risks, gouvernance, segments, ia_positionnement |
| VVV | fini | 25 | STORES_TOT_Q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| W | fini | 34 | ACTIVE_CUST_Q | 4/4 | risks, gouvernance, segments, geo, ia |
| WAL | fini | 50 | TBVPS | 4/4 | risks/extracted.json, gouvernance_fr.json |
| WCC | fini | 48 | SEG_CSS | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| WEX | fini | 37 | CORP_PV_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| WFRD | fini | 35 | ADJ_EBITDA | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| WH | fini | 46 | PIPELINE_ROOMS | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| WHR | fini | 41 | EBITONG_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| WING | fini | 26 | UNITS_Q | 4/4 | risks, gouvernance, segments, ia_positionnement |
| WLK | fini | 68 | EBITDA | 4/4 | risques, gouvernance, segments, geo |
| WMS | fini | 31 | MARGE_EBITDA_AJ | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| WPC | fini | 39 | ABR | 4/4 | risks, gouvernance, geo, ia_positionnement |
| WSC | fini | 14 | LEASING_REV_Q | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr, ia_positionnement_fr |
| WSO | fini | 35 | DIV_PER_SHARE | 4/4 | risks, gouvernance, segments, ia_positionnement |
| WTFC | fini | 48 | NetIncome | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json |
| WTM | fini | 22 | BVPS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| WTRG | fini | 25 | DIV_ANNUEL | 4/4 | risks, gouvernance, segments, ia |
| WTS | fini | 51 | ADJ_OP_MARGIN_Q | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| WU | fini | 30 | CROSS_BORDER_PRINCIPAL | 4/4 | risks, gouvernance_fr, segments_fr, geo_fr, ia_positionnement_fr |
| WULF | fini | 22 | HPC_LEASE_REV | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, ia_positionnement_fr.json |
| WWD | fini | 42 | backlog_total | 4/4 | risks, gouvernance, segments, geo |
| XE | fini | 41 | SVC_Q | 4/4 | risks, segments, geo, ia_positionnement |
| XP | fini | 43 | client_assets_q | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| XPO | fini | 42 | LTL_YIELD_EX_FUEL | 4/4 | risks, gouvernance, segments, geo, ia |
| YETI | fini | 35 | INTL | 4/4 | risks/extracted.json, gouvernance_fr.json, segments_fr.json, geo_fr.json, ia_positionnement_fr.json |
| Z | fini | 21 | REV_MORT | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ZION | fini | 123 | TBVPS | 4/4 | risks, gouvernance, segments, ia_positionnement |
| ZM | fini | 40 | clients_100k | 4/4 | risks, gouvernance, segments, geo, ia_positionnement |
| ZS | fini | 45 | RPO | 4/4 | risks, gouvernance, geo, ia_positionnement |
