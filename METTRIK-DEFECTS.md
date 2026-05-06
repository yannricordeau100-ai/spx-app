# Mettrik V1.7 — Sociétés à corriger

Auto-généré le 2026-05-06T21:09:12 par CONV-SYSTEMS via inspection programmatique du dataset _merged.json publiable (V1.7 fit_for_site).

Total inspecté : 975 stés. Logos disponibles dans `public/logos/` : 999.

## Légende des codes

- `NO_KPIS` : aucun KPI dans la fiche
- `BAD_HERO_VALUE` : value du hero non parsable ("Non disponible", "Not disclosed", null, etc.)
- `HISTORY_TOO_SHORT:N` : history du hero contient < 3 points (chart impossible)
- `LAST_POINT_ZERO` : dernier point de history vaut 0 alors que les précédents > 0
- `TTM_ANOMALY` : TTM divergent de plus de 3x du dernier point trimestriel (probable mélange unités)
- `ZEROS_IN_HISTORY` : 0 au milieu d'une série positive (donnée manquante non gérée)
- `RANKS_MISSING:N/4` : N champs ranks vides sur 4 (global_world, global_us, sector, subsector)
- `NO_LOGO` : pas de logo dédié dans public/logos/ (utilise LogoMonogram fallback)

## Stés à corriger

| Ticker | Nom | Issues |
|---|---|---|
| AAL | American Airlines Group Inc. | HISTORY_TOO_SHORT:2 |
| AAP | Advance Auto Parts, Inc. | HISTORY_TOO_SHORT:2 |
| AAT | American Assets Trust, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| ABB.ST | ABB Ltd | HISTORY_TOO_SHORT:2, NO_LOGO |
| ABNB | Airbnb, Inc. | HISTORY_TOO_SHORT:2 |
| ABT | Abbott Laboratories | HISTORY_TOO_SHORT:2 |
| ACA | Arcosa, Inc. | RANKS_MISSING:3/4 |
| ACGL | Arch Capital Group Ltd. | HISTORY_TOO_SHORT:1 |
| ACHR | Archer Aviation Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| ADBE | Adobe Inc. | HISTORY_TOO_SHORT:2 |
| ADC | Agree Realty Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| ADI | Analog Devices, Inc. | HISTORY_TOO_SHORT:2 |
| ADS.DE | adidas AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| ADUS | Addus HomeCare Corporation | TTM_ANOMALY:ttm=1505060 last=1422.53 |
| AGO | Assured Guaranty Ltd. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4 |
| AGX | Argan, Inc. | HISTORY_TOO_SHORT:2 |
| AI | C3.ai, Inc. | HISTORY_TOO_SHORT:2 |
| AIR | AAR CORP. | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4 |
| AJG | Arthur J. Gallagher & Co. | HISTORY_TOO_SHORT:2 |
| AKER.OL | Aker ASA | HISTORY_TOO_SHORT:2, NO_LOGO |
| AKRBP.OL | Aker BP ASA | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALFA.ST | Alfa Laval | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALG | Alamo Group Inc. | RANKS_MISSING:3/4 |
| ALGM | Allegro MicroSystems, Inc. | HISTORY_TOO_SHORT:0 |
| ALGT | Allegiant Travel Company | HISTORY_TOO_SHORT:2 |
| ALK | Alaska Air Group, Inc. | HISTORY_TOO_SHORT:2 |
| ALKS | Alkermes plc | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4 |
| ALRM | Alarm.com Holdings, Inc. | TTM_ANOMALY:ttm=689397 last=689.397, RANKS_MISSING:4/4 |
| ALV | Autoliv, Inc. | RANKS_MISSING:4/4 |
| ALV.DE | Allianz SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| AM | Antero Midstream Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| AMAT | Applied Materials, Inc. | HISTORY_TOO_SHORT:2 |
| AMD | Advanced Micro Devices, Inc. | HISTORY_TOO_SHORT:2 |
| AME | AMETEK, Inc. | HISTORY_TOO_SHORT:2 |
| AMH | American Homes 4 Rent | HISTORY_TOO_SHORT:2 |
| AMN | AMN Healthcare Services, Inc. | RANKS_MISSING:3/4 |
| AMR | Alpha Metallurgical Resources, Inc. | HISTORY_TOO_SHORT:2 |
| AMTM | Amentum Holdings, Inc. | RANKS_MISSING:3/4 |
| AMWD | American Woodmark Corporation | HISTORY_TOO_SHORT:2 |
| AN | AutoNation, Inc. | RANKS_MISSING:4/4 |
| ANDE | The Andersons, Inc. | HISTORY_TOO_SHORT:1 |
| APPF | AppFolio, Inc. | HISTORY_TOO_SHORT:2 |
| APTV | Aptiv PLC | HISTORY_TOO_SHORT:2 |
| ARLO | Arlo Technologies, Inc. | HISTORY_TOO_SHORT:2 |
| ARMK | Aramark | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| AROC | Archrock, Inc. | HISTORY_TOO_SHORT:1 |
| ARWR | Arrowhead Pharmaceuticals | HISTORY_TOO_SHORT:2 |
| ASGN | ASGN Incorporated | HISTORY_TOO_SHORT:2 |
| ASO | Academy Sports and Outdoors | HISTORY_TOO_SHORT:2 |
| ASTE | Astec Industries, Inc. | HISTORY_TOO_SHORT:1 |
| ASTH | Astrana Health, Inc. | HISTORY_TOO_SHORT:2 |
| ATCO-B.ST | Atlas Copco AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| ATEN | A10 Networks | RANKS_MISSING:4/4 |
| ATI | ATI Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ATO.PA | Atos | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| AUB | Atlantic Union Bankshares Corporation | TTM_ANOMALY:ttm=1172074 last=1172.074 |
| AVNT | Avient Corporation | RANKS_MISSING:3/4 |
| AVT | Avnet, Inc. | HISTORY_TOO_SHORT:2 |
| AXTA | Axalta Coating Systems Ltd. | RANKS_MISSING:4/4 |
| AZZ | AZZ Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| BAH | Booz Allen Hamilton Holding Corporation | HISTORY_TOO_SHORT:2 |
| BALL | Ball Corporation | HISTORY_TOO_SHORT:2 |
| BANC | Banc of California, Inc. | HISTORY_TOO_SHORT:0 |
| BANF | BancFirst Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4] |
| BARC.L | Barclays Bank PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| BAVA.CO | Bavarian Nordic A/S | HISTORY_TOO_SHORT:2, NO_LOGO |
| BBT | Beacon Financial Corporation | HISTORY_TOO_SHORT:2 |
| BBWI | Bath Body Works, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BCP.LS | Banque Cantonale de Genève | HISTORY_TOO_SHORT:1, NO_LOGO |
| BDC | Belden Inc. | RANKS_MISSING:3/4 |
| BEI.DE | Beiersdorf AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| BEKE | KE Holdings Inc. | RANKS_MISSING:3/4 |
| BFS | Saul Centers, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BG | Bunge Global SA | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| BHE | Benchmark Electronics, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4 |
| BJ | BJ's Wholesale Club Holdings, Inc. | RANKS_MISSING:4/4 |
| BKR | Baker Hughes Company | HISTORY_TOO_SHORT:2 |
| BLFS | BioLife Solutions, Inc. | HISTORY_TOO_SHORT:0 |
| BLND.L | Balfour Beatty | HISTORY_TOO_SHORT:2, NO_LOGO |
| BNL | Broadstone Net Lease, Inc. | HISTORY_TOO_SHORT:2 |
| BNP.PA | BNP Paribas | HISTORY_TOO_SHORT:1, NO_LOGO |
| BNR.DE | Brenntag SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| BOL.ST | Boliden AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| BPE.MI | Factorit S.p.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BPSO.MI | Banca Popolare di Sondrio | HISTORY_TOO_SHORT:2, NO_LOGO |
| BRKR | Bruker Corporation | HISTORY_TOO_SHORT:2 |
| BROS | Dutch Bros Inc. | RANKS_MISSING:3/4 |
| BSX | Boston Scientific Corporation | RANKS_MISSING:4/4 |
| BTSG | BrightSpring Health Services, Inc. | HISTORY_TOO_SHORT:2 |
| BX | Blackstone Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| BYD | Boyd Gaming Corporation | HISTORY_TOO_SHORT:0 |
| CARG | CarGurus | HISTORY_TOO_SHORT:2 |
| CARR | Carrier Global Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| CASH | Pathward Financial, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| CATY | Cathay General Bancorp | TTM_ANOMALY:ttm=206249.42 last=195.911, NO_LOGO |
| CAVA | CAVA Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:4/4 |
| CBK.DE | Commerzbank AG | HISTORY_TOO_SHORT:0, NO_LOGO |
| CBRE | CBRE Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CBU | Community Financial System, Inc. | HISTORY_TOO_SHORT:2 |
| CC | The Chemours Company | HISTORY_TOO_SHORT:1 |
| CDP | COPT Defense Properties | RANKS_MISSING:4/4 |
| CE | Celanese Corporation | HISTORY_TOO_SHORT:2 |
| CEG | Constellation Energy Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| CERT | Certara | RANKS_MISSING:4/4 |
| CF | CF Industries Holdings, Inc. | RANKS_MISSING:4/4 |
| CFFN | Capitol Federal Financial, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| CFR | Cullen/Frost Bankers, Inc. | HISTORY_TOO_SHORT:0 |
| CFR.SW | Compagnie Financière Richemont SA | HISTORY_TOO_SHORT:2, NO_LOGO |
| CHDN | Churchill Downs Incorporated | RANKS_MISSING:4/4 |
| CHH | Choice Hotels International | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4 |
| CHRD | Chord Energy Corporation | HISTORY_TOO_SHORT:2 |
| CHRW | C.H. Robinson Worldwide, Inc. | RANKS_MISSING:4/4 |
| CHTR | Charter Communications, Inc. | HISTORY_TOO_SHORT:2 |
| CIEN | Ciena Corporation | TTM_ANOMALY:ttm=5 last=1.2 |
| CLH | Clean Harbors, Inc. | RANKS_MISSING:4/4 |
| CLNX.MC | Cellnex Telecom | HISTORY_TOO_SHORT:1, NO_LOGO |
| CLOV | Clover Health Investments, Corp. | HISTORY_TOO_SHORT:2 |
| CLSK | CleanSpark, Inc. | HISTORY_TOO_SHORT:1 |
| CMS | CMS Energy Corporation | RANKS_MISSING:4/4 |
| CNS | Cohen Steers, Inc. | RANKS_MISSING:3/4 |
| CNX | CNX Resources Corporation | RANKS_MISSING:4/4 |
| CO.PA | Cnova N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| COKE | Coca-Cola Consolidated, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| COLB | Columbia Banking System, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| COLO-B.CO | Coloplast A/S | HISTORY_TOO_SHORT:1, NO_LOGO |
| CON.DE | Continental Aktiengesellschaft | HISTORY_TOO_SHORT:2, NO_LOGO |
| COP | ConocoPhillips | RANKS_MISSING:4/4, NO_LOGO |
| COR | Cencora, Inc. | RANKS_MISSING:4/4 |
| CPAY | Corpay, Inc. | HISTORY_TOO_SHORT:2 |
| CPRT | Copart, Inc. | HISTORY_TOO_SHORT:0 |
| CPT | Camden Property Trust | ZEROS_IN_HISTORY:[0, 1, 2, 3, 4], RANKS_MISSING:4/4 |
| CRC | California Resources Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4 |
| CRDA.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| CRGY | Crescent Energy Company | HISTORY_TOO_SHORT:0 |
| CSR | Centerspace | HISTORY_TOO_SHORT:2 |
| CSX | CSX Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4] |
| CTRA | Coterra Energy Inc. | HISTORY_TOO_SHORT:2 |
| CURB | Curbline Properties Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| CUZ | Cousins Properties Incorporated | HISTORY_TOO_SHORT:1 |
| CVCO | Cavco Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CWEN | Clearway Energy, Inc. | RANKS_MISSING:4/4 |
| CXM | Sprinklr, Inc. | HISTORY_TOO_SHORT:1 |
| CXW | CoreCivic, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4 |
| DAL | Delta Air Lines, Inc. | HISTORY_TOO_SHORT:1 |
| DB1.DE | IHK Offenbach am Main | HISTORY_TOO_SHORT:1, NO_LOGO |
| DBK.DE | Deutsche Bank | HISTORY_TOO_SHORT:2, NO_LOGO |
| DCH | Dauch Corporation | HISTORY_TOO_SHORT:2 |
| DCOM | Dime Community Bancshares, Inc. | RANKS_MISSING:4/4 |
| DDOG | Datadog | HISTORY_TOO_SHORT:2 |
| DEA | Easterly Government Properties, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4 |
| DEC.PA | JCDecaux SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| DECK | Deckers Outdoor Corporation | RANKS_MISSING:4/4, NO_LOGO |
| DKS | Dick's Sporting Goods | RANKS_MISSING:4/4, NO_LOGO |
| DLX | Deluxe Corporation | HISTORY_TOO_SHORT:2 |
| DOCN | DigitalOcean Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| DOV | Dover Corporation | HISTORY_TOO_SHORT:2 |
| DOW | Dow Inc. | RANKS_MISSING:4/4 |
| DSY.PA | Dassault Systèmes | RANKS_MISSING:4/4, NO_LOGO |
| DT | Dynatrace | RANKS_MISSING:4/4 |
| DTE | DTE Energy Company | HISTORY_TOO_SHORT:1 |
| DTG.DE | Daimler Truck Holding AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| DV | DoubleVerify Holdings, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| DXC | DXC Technology Company | HISTORY_TOO_SHORT:2 |
| DXPE | DXP Enterprises, Inc. | HISTORY_TOO_SHORT:2 |
| EAT | Brinker International, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], NO_LOGO |
| ECL | Ecolab | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| EDV.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| EFX | Equifax Inc. | RANKS_MISSING:4/4 |
| EGL.LS | Mota-Engil Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| ELISA.HE | Elisa Oyj | HISTORY_TOO_SHORT:0, NO_LOGO |
| ELS | Equity LifeStyle Properties, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| EMR | Emerson Electric Co. | RANKS_MISSING:4/4 |
| EPAM | EPAM Systems, Inc. | HISTORY_TOO_SHORT:2 |
| EPRT | Essential Properties Realty Trust, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EQNR.OL | Equinor Insurance AS | HISTORY_TOO_SHORT:2, NO_LOGO |
| ESAB | ESAB Corporation | HISTORY_TOO_SHORT:2 |
| ESE | ESCO Technologies Inc. | HISTORY_TOO_SHORT:1 |
| ESI | Element Solutions | RANKS_MISSING:4/4 |
| ESS | Essex Property Trust, Inc. | HISTORY_TOO_SHORT:2 |
| EVTC | EVERTEC, Inc. | HISTORY_TOO_SHORT:0 |
| EXC | Exelon Corporation | HISTORY_TOO_SHORT:2 |
| EXEL | Exelixis | HISTORY_TOO_SHORT:2 |
| EYE | National Vision Holdings, Inc. | RANKS_MISSING:3/4 |
| F | Ford Motor Company | HISTORY_TOO_SHORT:0 |
| FANG | Diamondback Energy, Inc. | HISTORY_TOO_SHORT:2 |
| FBNC | First Bancorp | HISTORY_TOO_SHORT:2, NO_LOGO |
| FBRT | Franklin BSP Realty Trust, Inc. | HISTORY_TOO_SHORT:2 |
| FCIT.L | F&C Investment Trust PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| FCPT | Four Corners Property Trust, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| FGR.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| FICO | Fair Isaac Corporation | HISTORY_TOO_SHORT:2 |
| FLR | Fluor Corporation | TTM_ANOMALY:ttm=3274.96 last=25.5, NO_LOGO |
| FLS | Flowserve Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| FND | Floor Decor Holdings, Inc. | RANKS_MISSING:4/4 |
| FOX | Fox Corporation | HISTORY_TOO_SHORT:2 |
| FOXA | Fox Corporation | HISTORY_TOO_SHORT:2 |
| FOXF | Fox Factory Holding Corp. | HISTORY_TOO_SHORT:2 |
| FPE3.DE | FUCHS SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| FR | First Industrial Realty Trust, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| FR.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| FRAS.L | Frasers Group PLC | HISTORY_TOO_SHORT:2, NO_LOGO |
| FRPT | Freshpet, Inc. | RANKS_MISSING:4/4 |
| FRT | Federal Realty Investment Trust | HISTORY_TOO_SHORT:1, NO_LOGO |
| FTI | TechnipFMC | RANKS_MISSING:4/4 |
| GALP.LS | Galp Energia, SGPS, S.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| GDYN | Grid Dynamics Holdings, Inc. | RANKS_MISSING:4/4 |
| GEBERIT.SW | Geberit Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| GEF | Greif, Inc. | RANKS_MISSING:4/4 |
| GEN | Gen Digital Inc. | RANKS_MISSING:4/4 |
| GEO | The GEO Group, Inc. | RANKS_MISSING:4/4 |
| GFC.PA | Gecina | HISTORY_TOO_SHORT:2, NO_LOGO |
| GIVN.SW | Givaudan SA | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLE.PA | Societe Generale | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLPG.AS | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLPI | Gaming and Leisure Properties, Inc. | HISTORY_TOO_SHORT:2 |
| GLW | Corning Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| GME | GameStop Corp. | HISTORY_TOO_SHORT:2 |
| GNTX | Gentex Corporation | RANKS_MISSING:4/4 |
| GNW | Genworth Financial, Inc. | RANKS_MISSING:4/4 |
| GPC | Genuine Parts Company | RANKS_MISSING:4/4 |
| GSK.L | GSK plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| GTM | ZoomInfo Technologies Inc. | HISTORY_TOO_SHORT:2 |
| GTY | Getty Realty Corp. | RANKS_MISSING:4/4 |
| GVA | Granite Construction Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| GXO | GXO Logistics, Inc. | HISTORY_TOO_SHORT:2 |
| HAYW | Hayward Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| HE | Hawaiian Electric Industries, Inc. | HISTORY_TOO_SHORT:2 |
| HEN.DE | Henkel AG & Co. KGaA | HISTORY_TOO_SHORT:2, NO_LOGO |
| HFG.DE | HelloFresh SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| HFWA | Heritage Financial Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| HIK.L | Hikma Pharmaceuticals PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| HLI | Houlihan Lokey, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| HM-B.ST | H & M Hennes & Mauritz AB | HISTORY_TOO_SHORT:1, NO_LOGO |
| HMN | Horace Mann Educators Corporation | HISTORY_TOO_SHORT:2 |
| HNI | HNI Corporation | HISTORY_TOO_SHORT:1 |
| HOG | Harley-Davidson, Inc. | HISTORY_TOO_SHORT:2 |
| HOOD | Robinhood Markets, Inc. | HISTORY_TOO_SHORT:2 |
| HP | Helmerich & Payne | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| HQY | HealthEquity | RANKS_MISSING:4/4, NO_LOGO |
| HR | Healthcare Realty Trust Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| HRB | H R Block | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4 |
| HWKN | Hawkins, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HWM | Howmet Aerospace Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4] |
| IAG.L | International Consolidated Airlines Grou | HISTORY_TOO_SHORT:2, NO_LOGO |
| IAG.MC | International Consolidated Airlines Grou | HISTORY_TOO_SHORT:2, NO_LOGO |
| IBP | Installed Building Products, Inc. | RANKS_MISSING:3/4 |
| ICE | Intercontinental Exchange, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| ICG.L | Irish Continental Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| ICHR | Ichor Holdings, Ltd. | HISTORY_TOO_SHORT:2 |
| IDA | IDACORP, Inc. | TTM_ANOMALY:ttm=333063.49 last=323.5 |
| IDR.MC | Indra Sistemas, S.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| IEX | IDEX Corporation | HISTORY_TOO_SHORT:2 |
| IFX.DE | Infineon Technologies AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| IHG.L | InterContinental Hotels Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| IIIN | Insteel Industries Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| INSW | International Seaways, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| IOSP | Innospec Inc. | HISTORY_TOO_SHORT:1 |
| IPGP | IPG Photonics Corporation | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| IPN.PA | Ipsen | HISTORY_TOO_SHORT:1, NO_LOGO |
| IRM | Iron Mountain Incorporated | HISTORY_TOO_SHORT:2 |
| ITRK.L | Intertek Group plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| ITW | Illinois Tool Works Inc. | RANKS_MISSING:4/4 |
| IVZ | Invesco Ltd. | RANKS_MISSING:4/4 |
| JBL | Jabil Inc. | RANKS_MISSING:4/4 |
| JBTM | JBT Marel Corporation | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| JCI | Johnson Controls International plc | HISTORY_TOO_SHORT:0 |
| JCQ.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| JD.L | JD Sports Fashion Plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| JJSF | J J Snack Foods Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| JKHY | Jack Henry Associates, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| KAI | Kadant Inc. | RANKS_MISSING:4/4 |
| KBR | KBR, Inc. | HISTORY_TOO_SHORT:2 |
| KDP | Keurig Dr Pepper Inc. | RANKS_MISSING:4/4 |
| KGF.L | Kingfisher plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| KHC | The Kraft Heinz Company | HISTORY_TOO_SHORT:2 |
| KMB | Kimberly-Clark Corporation | HISTORY_TOO_SHORT:2 |
| KMI | Kinder Morgan, Inc. | RANKS_MISSING:4/4 |
| KMPR | Kemper Corporation | RANKS_MISSING:3/4 |
| KMT | Kennametal Inc. | HISTORY_TOO_SHORT:2 |
| KN | Knowles Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| KNSL | Kinsale Capital Group, Inc. | RANKS_MISSING:3/4 |
| KNX | Knight-Swift Transportation Holdings Inc | HISTORY_TOO_SHORT:2 |
| KR | The Kroger Co. | HISTORY_TOO_SHORT:2 |
| KSS | Kohl's Corporation | RANKS_MISSING:4/4 |
| L | Loews Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| LAD | Lithia Motors, Inc. | RANKS_MISSING:3/4 |
| LGIH | LGI Homes, Inc. | HISTORY_TOO_SHORT:2 |
| LGND | Ligand Pharmaceuticals Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| LH | Labcorp Holdings Inc. | HISTORY_TOO_SHORT:2 |
| LHX | L3Harris Technologies | RANKS_MISSING:4/4 |
| LI.PA | Klépierre | HISTORY_TOO_SHORT:1, NO_LOGO |
| LIF | Life360, Inc. | HISTORY_TOO_SHORT:1 |
| LLOY.L | Lloyds Banking Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| LMP.L | LondonMetric Property PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| LNA.PA | LNA Santé | HISTORY_TOO_SHORT:2, NO_LOGO |
| LONN.SW | Lonza Group Ltd | HISTORY_TOO_SHORT:2, NO_LOGO |
| LOPE | Grand Canyon Education, Inc. | HISTORY_TOO_SHORT:1 |
| LPX | Louisiana-Pacific Corporation | RANKS_MISSING:4/4 |
| LQDT | Liquidity Services | TTM_ANOMALY:ttm=13.5 last=1.6, RANKS_MISSING:3/4 |
| LRCX | Lam Research Corporation | RANKS_MISSING:4/4 |
| LRN | Stride, Inc. | HISTORY_TOO_SHORT:2 |
| LULU | lululemon athletica inc. | RANKS_MISSING:3/4 |
| LUMN | Lumen Technologies, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| LVS | Las Vegas Sands Corp. | HISTORY_TOO_SHORT:2 |
| LW | Lamb Weston Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| LYB | LyondellBasell Industries N.V. | HISTORY_TOO_SHORT:2 |
| LYG | Lloyds Banking Group plc | HISTORY_TOO_SHORT:2 |
| M | Macy's, Inc. | HISTORY_TOO_SHORT:2 |
| MAERSK-B.CO | A.P. Moller - Maersk A/S | HISTORY_TOO_SHORT:2, NO_LOGO |
| MAS | Masco Corporation | HISTORY_TOO_SHORT:2 |
| MAT | Mattel, Inc. | HISTORY_TOO_SHORT:2 |
| MBIN | Merchants Bancorp | HISTORY_TOO_SHORT:0, NO_LOGO |
| MEDP | Medpace Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| MEL.MC | Melia Hotels International | HISTORY_TOO_SHORT:0, NO_LOGO |
| META | Meta Platforms, Inc. | HISTORY_TOO_SHORT:0 |
| MGEE | MGE Energy, Inc. | HISTORY_TOO_SHORT:2 |
| MGY | Magnolia Oil Gas Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| MHK | Mohawk Industries, Inc. | RANKS_MISSING:4/4 |
| MKC | McCormick | RANKS_MISSING:4/4 |
| MKSI | MKS Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4 |
| MMI | Marcus Millichap, Inc. | RANKS_MISSING:4/4 |
| MMM | 3M Company | HISTORY_TOO_SHORT:2 |
| MNRO | Monro, Inc. | LAST_POINT_ZERO, RANKS_MISSING:3/4 |
| MOH | Molina Healthcare, Inc. | HISTORY_TOO_SHORT:2 |
| MRCY | Mercury Systems | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| MRNA | Moderna | RANKS_MISSING:4/4 |
| MRO.L | Melrose Industries PLC | RANKS_MISSING:3/4, NO_LOGO |
| MRSH | Marsh McLennan Companies, Inc. | TTM_ANOMALY:ttm=3.29 last=12.5 |
| MSM | MSC Industrial Direct Co., Inc. | TTM_ANOMALY:ttm=3769.5 last=3.24, RANKS_MISSING:4/4 |
| MTCH | Match Group, Inc. | RANKS_MISSING:4/4 |
| MTX | Minerals Technologies Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| MTZ | MasTec, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| MUFG | Mitsubishi UFJ Financial Group | RANKS_MISSING:4/4, NO_LOGO |
| MUSA | Murphy USA Inc. | HISTORY_TOO_SHORT:2 |
| MWA | Mueller Water Products | RANKS_MISSING:4/4 |
| MXL | MaxLinear, Inc. | HISTORY_TOO_SHORT:2 |
| NABL | N-able, Inc. | HISTORY_TOO_SHORT:2 |
| NEOG | Neogen Corporation | RANKS_MISSING:4/4 |
| NHY.OL | Norsk Hydro ASA | HISTORY_TOO_SHORT:1, NO_LOGO |
| NK.PA | IMERYS | HISTORY_TOO_SHORT:2, NO_LOGO |
| NPK | National Presto Industries, Inc. | HISTORY_TOO_SHORT:2 |
| NSA | National Storage Affiliates Trust | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| NSIT | Insight Enterprises | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| NSSC | NAPCO SECURITY TECHNOLOGIES, INC. | HISTORY_TOO_SHORT:2 |
| NTCT | NetScout Systems, Inc. | RANKS_MISSING:4/4 |
| NUE | Nucor Corporation | HISTORY_TOO_SHORT:0 |
| NVRI | Enviri Corporation | HISTORY_TOO_SHORT:0 |
| NVT | nVent Electric plc | RANKS_MISSING:4/4 |
| NWL | Newell Brands Inc. | HISTORY_TOO_SHORT:2 |
| NXPI | NXP Semiconductors N.V. | HISTORY_TOO_SHORT:2 |
| OFG | OFG Bancorp | HISTORY_TOO_SHORT:2 |
| OII | Oceaneering International | RANKS_MISSING:4/4 |
| OKLO | Oklo Inc. | HISTORY_TOO_SHORT:2 |
| OLN | Olin Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| OPCH | Option Care Health, Inc. | RANKS_MISSING:4/4 |
| OPEN | Opendoor Technologies Inc. | HISTORY_TOO_SHORT:1 |
| ORK.OL | Orkla ASA | HISTORY_TOO_SHORT:1, NO_LOGO |
| ORLY | O'Reilly Automotive, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| OSIS | OSI Systems, Inc. | HISTORY_TOO_SHORT:2 |
| OTTR | Otter Tail Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| PANW | Palo Alto Networks | RANKS_MISSING:4/4 |
| PARR | Par Pacific Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| PATH | UiPath | RANKS_MISSING:3/4 |
| PATK | Patrick Industries, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| PDFS | PDF Solutions, Inc. | HISTORY_TOO_SHORT:2 |
| PEB | Pebblebrook Hotel Trust | HISTORY_TOO_SHORT:2 |
| PECO | Phillips Edison Company, Inc. | HISTORY_TOO_SHORT:2 |
| PEG | Public Service Enterprise Group Incorpor | RANKS_MISSING:4/4 |
| PEN | Penumbra, Inc. | RANKS_MISSING:4/4 |
| PENG | Penguin Solutions, Inc. | HISTORY_TOO_SHORT:2 |
| PGHN.SW | Danske Invest Allocation | HISTORY_TOO_SHORT:1, NO_LOGO |
| PGNY | Progyny, Inc. | RANKS_MISSING:3/4 |
| PHIN | PHINIA Inc. | HISTORY_TOO_SHORT:2 |
| PHM | PulteGroup, Inc. | HISTORY_TOO_SHORT:2 |
| PIPR | Piper Sandler Companies | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4 |
| PLD | Prologis, Inc. | HISTORY_TOO_SHORT:1 |
| PLTR | Palantir Technologies Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PLXS | Plexus Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| PNC | The PNC Financial Services Group, Inc. | HISTORY_TOO_SHORT:2 |
| PNDORA.CO | Pandora | HISTORY_TOO_SHORT:1, NO_LOGO |
| PNW | Pinnacle West Capital Corporation | HISTORY_TOO_SHORT:1 |
| POR | Portland General Electric Company | RANKS_MISSING:4/4 |
| POST | Post Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| PR | Permian Resources Corporation | RANKS_MISSING:4/4 |
| PRAA | PRA Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4 |
| PRGS | Progress Software Corporation | HISTORY_TOO_SHORT:1 |
| PRK | Park National Corporation | HISTORY_TOO_SHORT:0 |
| PRU | Prudential Financial Inc | HISTORY_TOO_SHORT:2 |
| PRX.AS | Prosus N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PSON.L | Pearson plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| PTEN | Patterson-UTI Energy, Inc. | HISTORY_TOO_SHORT:2 |
| PYPL | PayPal Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| PZZA | Papa John's International, Inc. | RANKS_MISSING:4/4 |
| QBTS | D-Wave Quantum Inc. | HISTORY_TOO_SHORT:2 |
| QDEL | QuidelOrtho Corporation | RANKS_MISSING:3/4 |
| QRVO | Qorvo, Inc. | HISTORY_TOO_SHORT:2 |
| R3NK.DE | RENK Group AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| REC.MI | Recordati Industria Chimica e Farmaceuti | HISTORY_TOO_SHORT:2, NO_LOGO |
| REZI | Resideo Technologies, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RGLD | Royal Gold, Inc. | HISTORY_TOO_SHORT:2 |
| RHI | Robert Half Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RHK.DE | RHÖN-KLINIKUM AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| RIO.L | Rio Tinto | HISTORY_TOO_SHORT:2, NO_LOGO |
| RKLB | Rocket Lab Corporation | HISTORY_TOO_SHORT:1 |
| RLI | RLI Corp. | HISTORY_TOO_SHORT:1 |
| RMD | ResMed Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4] |
| RMV.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| RNG | RingCentral | RANKS_MISSING:3/4 |
| ROCK | Gibraltar Industries, Inc. | HISTORY_TOO_SHORT:1 |
| ROCK-B.CO | ROCKWOOL Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| ROG | Rogers Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| ROL | Rollins, Inc. | HISTORY_TOO_SHORT:2 |
| RR.L | Rolls-Royce Holdings plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| RRC | Range Resources Corporation | HISTORY_TOO_SHORT:2 |
| RRR | Red Rock Resorts | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| RSG | Republic Services | RANKS_MISSING:3/4 |
| RTX | RTX Corporation | RANKS_MISSING:4/4 |
| RUSHA | Rush Enterprises, Inc. | HISTORY_TOO_SHORT:2 |
| RWE.DE | RWE AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| RXL.PA | Rexel | HISTORY_TOO_SHORT:1, NO_LOGO |
| RXO | RXO, Inc. | RANKS_MISSING:4/4 |
| RYAN | Ryan Specialty Holdings, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4 |
| SAIA | Saia, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| SBH | Sally Beauty Holdings, Inc. | RANKS_MISSING:3/4 |
| SBRY.L | J Sainsbury plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| SBUX | Starbucks Corporation | ZEROS_IN_HISTORY:[0] |
| SCI | Service Corporation International | RANKS_MISSING:4/4 |
| SCMN.SW | Swisscom AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| SCR.PA | SCOR SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| SCSC | ScanSource, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| SDR.L | J. Henry Schroder Wagg & Co. Limited | HISTORY_TOO_SHORT:2, NO_LOGO |
| SF | Stifel Financial Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| SHB-A.ST | Svenska Handelsbanken AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| SHC | Sotera Health Company | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| SHOP | Shopify Inc. | RANKS_MISSING:4/4 |
| SHW | The Sherwin-Williams Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| SIG | Signet Jewelers Limited | LAST_POINT_ZERO, RANKS_MISSING:3/4 |
| SIGI | Selective Insurance Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4] |
| SIKA.SW | Sika AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| SKYW | SkyWest, Inc. | RANKS_MISSING:4/4 |
| SLB | SLB N.V. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| SLGN | Silgan Holdings Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| SLVM | Sylvamo Corporation | HISTORY_TOO_SHORT:2 |
| SMCI | Super Micro Computer, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| SMFG | Sumitomo Mitsui Financial Group | HISTORY_TOO_SHORT:0 |
| SMP | Standard Motor Products | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SMPL | The Simply Good Foods Company | RANKS_MISSING:3/4 |
| SNEX | StoneX Group Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4 |
| SOLS | Solstice Advanced Materials Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4, NO_LOGO |
| SOLV | Solventum Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| SON.LS | Sonae | HISTORY_TOO_SHORT:2, NO_LOGO |
| SOON.SW | Sonova Holding AG | HISTORY_TOO_SHORT:1, NO_LOGO |
| SPG | Simon Property Group | HISTORY_TOO_SHORT:1 |
| SPHR | Sphere Entertainment Co. | HISTORY_TOO_SHORT:0, NO_LOGO |
| SPX.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| SREN.SW | Swiss Re | HISTORY_TOO_SHORT:2, NO_LOGO |
| SSB | SouthState Bank Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| ST | Sensata Technologies Holding plc | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| STAN.L | Standard Chartered Bank Zambia Plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| STC | Stewart Information Services Corporation | HISTORY_TOO_SHORT:1 |
| STEL | Stellar Bancorp, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| STX | Seagate Technology Holdings plc | HISTORY_TOO_SHORT:2 |
| SUPN | Supernus Pharmaceuticals, Inc. | HISTORY_TOO_SHORT:2 |
| SVT.L | Severn Trent Plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| SW | Smurfit Westrock | HISTORY_TOO_SHORT:2, NO_LOGO |
| SWKS | Skyworks Solutions, Inc. | RANKS_MISSING:4/4 |
| SXT | Sensient Technologies Corporation | RANKS_MISSING:4/4 |
| SYK | Stryker Corporation | RANKS_MISSING:4/4 |
| SYNA | Synaptics Incorporated | HISTORY_TOO_SHORT:2 |
| TBBK | The Bancorp, Inc. | RANKS_MISSING:3/4 |
| TCBI | Texas Capital Bancshares, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4 |
| TDC | Teradata Corporation | HISTORY_TOO_SHORT:2 |
| TEL2-B.ST | Tele2 AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| TER | Teradyne, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4 |
| THRM | Gentherm Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| TKO | TKO Group Holdings, Inc. | HISTORY_TOO_SHORT:0 |
| TKR | The Timken Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| TLN | Talen Energy Corporation | HISTORY_TOO_SHORT:0 |
| TLS1V.HE | Thermo Fisher Scientific | HISTORY_TOO_SHORT:1, NO_LOGO |
| TMO | Thermo Fisher Scientific Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| TMP | Tompkins Financial Corporation | HISTORY_TOO_SHORT:1 |
| TOL | Toll Brothers, Inc. | HISTORY_TOO_SHORT:2 |
| TPH | Tri Pointe Homes | RANKS_MISSING:4/4 |
| TR | Tootsie Roll Industries | HISTORY_TOO_SHORT:2, NO_LOGO |
| TRMB | Trimble Inc. | RANKS_MISSING:4/4 |
| TRMK | Trustmark Corporation | HISTORY_TOO_SHORT:2 |
| TRV | The Travelers Companies, Inc. | HISTORY_TOO_SHORT:2 |
| TSCO | Tractor Supply Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| TT | Trane Technologies plc | BAD_HERO_VALUE:"Not disclosed", HISTORY_TOO_SHORT:0 |
| TTD | The Trade Desk | HISTORY_TOO_SHORT:2 |
| UA | UNDER ARMOUR, INC. | HISTORY_TOO_SHORT:1 |
| UAA | Under Armour | RANKS_MISSING:4/4 |
| UBER | Uber Technologies, Inc. | HISTORY_TOO_SHORT:2 |
| UBSI | United Bankshares, Inc. | HISTORY_TOO_SHORT:1 |
| UE | Urban Edge Properties | HISTORY_TOO_SHORT:1, NO_LOGO |
| UFPT | UFP Technologies, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| UGI | UGI Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| UHR.SW | Swatch Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| UHS | Universal Health Services, Inc. | HISTORY_TOO_SHORT:2 |
| UNF | UniFirst Corporation | HISTORY_TOO_SHORT:2 |
| UNM | Unum Group | HISTORY_TOO_SHORT:2 |
| UNP | Union Pacific Corporation | RANKS_MISSING:4/4 |
| URI | United Rentals, Inc. | HISTORY_TOO_SHORT:1 |
| USFD | US Foods Holding Corp. | RANKS_MISSING:4/4 |
| UTDI.DE | United Internet AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| UTL | UNITIL CORPORATION | HISTORY_TOO_SHORT:2 |
| UU.L | United Utilities Group PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| VAL | Valaris Limited | HISTORY_TOO_SHORT:0 |
| VALE | Vale S.A. | HISTORY_TOO_SHORT:2 |
| VFC | V.F. Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4 |
| VIAV | Viavi Solutions Inc. | RANKS_MISSING:3/4 |
| VICI | VICI Properties Inc. | TTM_ANOMALY:ttm=3278709 last=2541 |
| VIRT | Virtu Financial, Inc. | HISTORY_TOO_SHORT:2 |
| VK.PA | Vallourec | HISTORY_TOO_SHORT:1, NO_LOGO |
| VNO | Vornado Realty Trust | RANKS_MISSING:4/4 |
| VNOM | Viper Energy, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| VOW.DE | Volkswagen Group | RANKS_MISSING:4/4, NO_LOGO |
| VRSN | VeriSign, Inc. | HISTORY_TOO_SHORT:2 |
| VRTS | Virtus Investment Partners, Inc. | HISTORY_TOO_SHORT:2 |
| VSCO | Victoria's Secret Co. | HISTORY_TOO_SHORT:2 |
| VTOL | Bristow Group Inc. | HISTORY_TOO_SHORT:2 |
| VYX | NCR Voyix Corporation | RANKS_MISSING:4/4 |
| VZ | Verizon Communications Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WBD | Warner Bros. Discovery, Inc. | HISTORY_TOO_SHORT:2 |
| WDAY | Workday, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4 |
| WELL | Welltower Inc. | RANKS_MISSING:3/4 |
| WEX | WEX Inc. | RANKS_MISSING:4/4 |
| WFRD | Weatherford International plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| WGO | Winnebago Industries, Inc. | HISTORY_TOO_SHORT:2 |
| WHD | Cactus, Inc. | HISTORY_TOO_SHORT:1 |
| WING | Wingstop Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4 |
| WKC | World Kinect Corporation | HISTORY_TOO_SHORT:2 |
| WLY | John Wiley & Sons | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4 |
| WMT | Walmart Inc. | HISTORY_TOO_SHORT:2 |
| WPC | W. P. Carey Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:4/4 |
| WRB | W. R. Berkley Corporation | RANKS_MISSING:4/4 |
| WRLD | World Acceptance Corporation | RANKS_MISSING:4/4 |
| WSFS | WSFS Financial Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| WSM | Williams-Sonoma, Inc. | HISTORY_TOO_SHORT:0 |
| WSR | Whitestone REIT | HISTORY_TOO_SHORT:1 |
| WTRG | Essential Utilities, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WTS | Watts Water Technologies | RANKS_MISSING:4/4 |
| WTW | Willis Towers Watson Public Limited Comp | RANKS_MISSING:3/4, NO_LOGO |
| WU | The Western Union Company | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4 |
| WWW | Wolverine World Wide | HISTORY_TOO_SHORT:2 |
| WYNN | Wynn Resorts, Limited | RANKS_MISSING:4/4 |
| XEL | Xcel Energy Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| XHR | Xenia Hotels Resorts, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| XPEL | XPEL, INC. | HISTORY_TOO_SHORT:2 |
| XPO | XPO, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4] |
| XYZ | Block, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| YELP | Yelp Inc. | RANKS_MISSING:4/4 |

## Stats

- Stés vraiment OK (graph + ranks + logo) : **277**
- Stés avec UNIQUEMENT NO_LOGO : **146**
- Stés avec problème data (potentiellement + NO_LOGO) : **552**
- Total inspecté : **975**
