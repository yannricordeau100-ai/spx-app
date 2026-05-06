# MeTTRIK V1.7 — Sociétés à corriger

Auto-généré le 2026-05-06T16:47:35.233669 par CONV-SYSTEMS via inspection programmatique du dataset _merged.json publiable (V1.7 fit_for_site).

Total inspecté : 1158 stés.

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
| AAL | American Airlines Group Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AAP | Advance Auto Parts, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AAT | American Assets Trust, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| ABB.ST | ABB Ltd | HISTORY_TOO_SHORT:2, NO_LOGO |
| ABBV | AbbVie Inc. | HISTORY_TOO_SHORT:1 |
| ABNB | Airbnb, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ABT | Abbott Laboratories | HISTORY_TOO_SHORT:2, NO_LOGO |
| ACA | Arcosa, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| ACGL | Arch Capital Group Ltd. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ACHC | Acadia Healthcare Company, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ACHR | Archer Aviation Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| ACIW | ACI Worldwide, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| ACMR | ACM Research | RANKS_MISSING:3/4, NO_LOGO |
| ADAM | Adamas Trust, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| ADBE | Adobe Inc. | HISTORY_TOO_SHORT:2 |
| ADC | Agree Realty Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| ADI | Analog Devices, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ADS.DE | adidas AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| ADUS | Addus HomeCare Corporation | TTM_ANOMALY:ttm=1505060 last=1422.53, NO_LOGO |
| AEIS | Advanced Energy Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AGO | Assured Guaranty Ltd. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| AGX | Argan, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AI | C3.ai, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AIR | AAR CORP. | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| AIR.DE | RUAG | HISTORY_TOO_SHORT:2, NO_LOGO |
| AIR.PA | Airbus | HISTORY_TOO_SHORT:2, NO_LOGO |
| AJG | Arthur J. Gallagher & Co. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AKER.OL | Aker ASA | HISTORY_TOO_SHORT:2, NO_LOGO |
| AKRBP.OL | Aker BP ASA | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALFA.ST | Alfa Laval | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALG | Alamo Group Inc. | RANKS_MISSING:3/4, NO_LOGO |
| ALGM | Allegro MicroSystems, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| ALGT | Allegiant Travel Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALK | Alaska Air Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ALKS | Alkermes plc | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| ALRM | Alarm.com Holdings, Inc. | TTM_ANOMALY:ttm=689397 last=689.397, RANKS_MISSING:4/4, NO_LOGO |
| ALV | Autoliv, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| ALV.DE | Allianz SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| AM | Antero Midstream Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| AMAT | Applied Materials, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AMD | Advanced Micro Devices, Inc. | HISTORY_TOO_SHORT:2 |
| AME | AMETEK, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AMH | American Homes 4 Rent | HISTORY_TOO_SHORT:2, NO_LOGO |
| AMKR | Amkor Technology, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| AMN | AMN Healthcare Services, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| AMR | Alpha Metallurgical Resources, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AMTM | Amentum Holdings, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| AMWD | American Woodmark Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| AN | AutoNation, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| ANDE | The Andersons, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| AON | Aon plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| AOSL | Alpha and Omega Semiconductor Limited | HISTORY_TOO_SHORT:0, NO_LOGO |
| APH | Amphenol Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| APOG | Apogee Enterprises, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| APPF | AppFolio, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| APTV | Aptiv PLC | HISTORY_TOO_SHORT:2, NO_LOGO |
| ARLO | Arlo Technologies, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ARMK | Aramark | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| AROC | Archrock, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ARWR | Arrowhead Pharmaceuticals | HISTORY_TOO_SHORT:2, NO_LOGO |
| ASGN | ASGN Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| ASO | Academy Sports and Outdoors | HISTORY_TOO_SHORT:2, NO_LOGO |
| ASTE | Astec Industries, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ASTH | Astrana Health, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ATCO-B.ST | Atlas Copco AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| ATEN | A10 Networks | RANKS_MISSING:4/4, NO_LOGO |
| ATI | ATI Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| ATO.PA | Atos | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| AUB | Atlantic Union Bankshares Corporation | TTM_ANOMALY:ttm=1172074 last=1172.074, NO_LOGO |
| AVNT | Avient Corporation | RANKS_MISSING:3/4, NO_LOGO |
| AVT | Avnet, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AXON | Axon Enterprise, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| AXTA | Axalta Coating Systems Ltd. | RANKS_MISSING:4/4, NO_LOGO |
| AZZ | AZZ Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| BAH | Booz Allen Hamilton Holding Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| BALL | Ball Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| BANC | Banc of California, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| BANF | BancFirst Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], NO_LOGO |
| BARC.L | Barclays Bank PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| BAVA.CO | Bavarian Nordic A/S | HISTORY_TOO_SHORT:2, NO_LOGO |
| BBT | Beacon Financial Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| BBWI | Bath Body Works, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BC | Brunswick Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| BCC | Boise Cascade Company | TTM_ANOMALY:ttm=6328470.18 last=6404.595, RANKS_MISSING:4/4, NO_LOGO |
| BCH | Banco de Chile | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| BCO | The Brink's Company | RANKS_MISSING:4/4, NO_LOGO |
| BCP.LS | Banque Cantonale de Genève | HISTORY_TOO_SHORT:1, NO_LOGO |
| BDC | Belden Inc. | RANKS_MISSING:3/4, NO_LOGO |
| BEI.DE | Beiersdorf AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| BEKE | KE Holdings Inc. | RANKS_MISSING:3/4, NO_LOGO |
| BFS | Saul Centers, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BG | Bunge Global SA | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| BHE | Benchmark Electronics, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| BJ | BJ's Wholesale Club Holdings, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| BKR | Baker Hughes Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| BL | BlackLine | RANKS_MISSING:4/4, NO_LOGO |
| BLFS | BioLife Solutions, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| BLND.L | Balfour Beatty | HISTORY_TOO_SHORT:2, NO_LOGO |
| BNL | Broadstone Net Lease, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BNP.PA | BNP Paribas | HISTORY_TOO_SHORT:1, NO_LOGO |
| BNR.DE | Brenntag SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| BNZL.L | Bunzl plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| BOL.ST | Boliden AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| BPE.MI | Factorit S.p.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BPSO.MI | Banca Popolare di Sondrio | HISTORY_TOO_SHORT:2, NO_LOGO |
| BRBR | BellRing Brands, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| BRKR | Bruker Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| BROS | Dutch Bros Inc. | RANKS_MISSING:3/4, NO_LOGO |
| BRX | Brixmor Property Group Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BSX | Boston Scientific Corporation | RANKS_MISSING:4/4, NO_LOGO |
| BTSG | BrightSpring Health Services, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| BX | Blackstone Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| BYD | Boyd Gaming Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| CACI | CACI International Inc | HISTORY_TOO_SHORT:0, NO_LOGO |
| CAG | Conagra Brands | HISTORY_TOO_SHORT:2, NO_LOGO |
| CARG | CarGurus | HISTORY_TOO_SHORT:2, NO_LOGO |
| CARR | Carrier Global Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CASH | Pathward Financial, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CAT | Caterpillar Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CATY | Cathay General Bancorp | TTM_ANOMALY:ttm=206249.42 last=195.911, NO_LOGO |
| CAVA | CAVA Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| CBK.DE | Commerzbank AG | HISTORY_TOO_SHORT:0, NO_LOGO |
| CBRE | CBRE Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CBU | Community Financial System, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CC | The Chemours Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| CCL | Carnival Corporation | RANKS_MISSING:4/4, NO_LOGO |
| CDP | COPT Defense Properties | RANKS_MISSING:4/4, NO_LOGO |
| CDW | CDW Corporation | RANKS_MISSING:4/4, NO_LOGO |
| CE | Celanese Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| CEG | Constellation Energy Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CERT | Certara | RANKS_MISSING:4/4, NO_LOGO |
| CF | CF Industries Holdings, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| CFFN | Capitol Federal Financial, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CFR | Cullen/Frost Bankers, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| CFR.SW | Compagnie Financière Richemont SA | HISTORY_TOO_SHORT:2, NO_LOGO |
| CHD | Church & Dwight Co., Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| CHDN | Churchill Downs Incorporated | RANKS_MISSING:4/4, NO_LOGO |
| CHH | Choice Hotels International | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4, NO_LOGO |
| CHRD | Chord Energy Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| CHRW | C.H. Robinson Worldwide, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| CHTR | Charter Communications, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CIEN | Ciena Corporation | TTM_ANOMALY:ttm=5 last=1.2, NO_LOGO |
| CLH | Clean Harbors, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| CLNX.MC | Cellnex Telecom | HISTORY_TOO_SHORT:1, NO_LOGO |
| CLOV | Clover Health Investments, Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CLSK | CleanSpark, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| CLX | The Clorox Company | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], NO_LOGO |
| CMS | CMS Energy Corporation | RANKS_MISSING:4/4, NO_LOGO |
| CNR | Core Natural Resources, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| CNS | Cohen Steers, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| CNX | CNX Resources Corporation | RANKS_MISSING:4/4, NO_LOGO |
| CO.PA | Cnova N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| COKE | Coca-Cola Consolidated, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| COLB | Columbia Banking System, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| COLO-B.CO | Coloplast A/S | HISTORY_TOO_SHORT:1, NO_LOGO |
| CON.DE | Continental Aktiengesellschaft | HISTORY_TOO_SHORT:2, NO_LOGO |
| COP | ConocoPhillips | RANKS_MISSING:4/4, NO_LOGO |
| COR | Cencora, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| COTY | Coty Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| CPAY | Corpay, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CPR.MI | Davide Campari-Milano S.p.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CPRT | Copart, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| CPT | Camden Property Trust | ZEROS_IN_HISTORY:[0, 1, 2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| CRC | California Resources Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| CRDA.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| CRGY | Crescent Energy Company | HISTORY_TOO_SHORT:0, NO_LOGO |
| CRWD | CrowdStrike Holdings, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| CSGS | CSG Systems International, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| CSR | Centerspace | HISTORY_TOO_SHORT:2, NO_LOGO |
| CSX | CSX Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| CTRA | Coterra Energy Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CTS.DE | Avic International Holding Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| CTVA | Corteva | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| CURB | Curbline Properties Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| CUZ | Cousins Properties Incorporated | HISTORY_TOO_SHORT:1, NO_LOGO |
| CVCO | Cavco Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CWEN | Clearway Energy, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| CWST | Casella Waste Systems, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| CXM | Sprinklr, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| CXW | CoreCivic, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| DAL | Delta Air Lines, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| DB1.DE | IHK Offenbach am Main | HISTORY_TOO_SHORT:1, NO_LOGO |
| DBK.DE | Deutsche Bank | HISTORY_TOO_SHORT:2, NO_LOGO |
| DCH | Dauch Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| DCI | Donaldson Company, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| DCOM | Dime Community Bancshares, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| DDOG | Datadog | HISTORY_TOO_SHORT:2, NO_LOGO |
| DEA | Easterly Government Properties, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4, NO_LOGO |
| DEC.PA | JCDecaux SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| DECK | Deckers Outdoor Corporation | RANKS_MISSING:4/4, NO_LOGO |
| DFH | Dream Finders Homes, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| DIA.MI | DiaSorin S.p.A. | HISTORY_TOO_SHORT:1, NO_LOGO |
| DIS | The Walt Disney Company | HISTORY_TOO_SHORT:2 |
| DKS | Dick's Sporting Goods | RANKS_MISSING:4/4, NO_LOGO |
| DLX | Deluxe Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| DOCN | DigitalOcean Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| DORM | Dorman Products, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| DOV | Dover Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| DOW | Dow Inc. | RANKS_MISSING:4/4, NO_LOGO |
| DSY.PA | Dassault Systèmes | RANKS_MISSING:4/4, NO_LOGO |
| DT | Dynatrace | RANKS_MISSING:4/4, NO_LOGO |
| DTE | DTE Energy Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| DTG.DE | Daimler Truck Holding AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| DUE.DE | Dürr AG | HISTORY_TOO_SHORT:1, NO_LOGO |
| DV | DoubleVerify Holdings, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| DVN | Devon Energy Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| DXC | DXC Technology Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| DXPE | DXP Enterprises, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EAT | Brinker International, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], NO_LOGO |
| ECL | Ecolab | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| EDV.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| EFX | Equifax Inc. | RANKS_MISSING:4/4, NO_LOGO |
| EGL.LS | Mota-Engil Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| ELISA.HE | Elisa Oyj | HISTORY_TOO_SHORT:0, NO_LOGO |
| ELS | Equity LifeStyle Properties, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| EMR | Emerson Electric Co. | RANKS_MISSING:4/4, NO_LOGO |
| ENR.DE | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| EPAC | Enerpac Tool Group Corp. | RANKS_MISSING:3/4, NO_LOGO |
| EPAM | EPAM Systems, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EPRT | Essential Properties Realty Trust, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EQNR.OL | Equinor Insurance AS | HISTORY_TOO_SHORT:2, NO_LOGO |
| ES | Eversource Energy | HISTORY_TOO_SHORT:2, NO_LOGO |
| ESAB | ESAB Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| ESE | ESCO Technologies Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ESI | Element Solutions | RANKS_MISSING:4/4, NO_LOGO |
| ESS | Essex Property Trust, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EVTC | EVERTEC, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| EXC | Exelon Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| EXE | Expand Energy Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| EXEL | Exelixis | HISTORY_TOO_SHORT:2, NO_LOGO |
| EXO.AS | Exor N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| EYE | National Vision Holdings, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| EZPW | EZCORP, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| F | Ford Motor Company | HISTORY_TOO_SHORT:0, NO_LOGO |
| FANG | Diamondback Energy, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| FBNC | First Bancorp | HISTORY_TOO_SHORT:2, NO_LOGO |
| FBRT | Franklin BSP Realty Trust, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| FCIT.L | F&C Investment Trust PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| FCPT | Four Corners Property Trust, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| FER.MC | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| FGR.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| FHI | Federated Hermes | RANKS_MISSING:4/4, NO_LOGO |
| FICO | Fair Isaac Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| FIZZ | National Beverage Corp. | RANKS_MISSING:4/4, NO_LOGO |
| FLO | Flowers Foods, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| FLR | Fluor Corporation | TTM_ANOMALY:ttm=3274.96 last=25.5, NO_LOGO |
| FLS | Flowserve Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| FND | Floor Decor Holdings, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| FOX | Fox Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| FOXA | Fox Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| FOXF | Fox Factory Holding Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| FPE3.DE | FUCHS SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| FR | First Industrial Realty Trust, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| FR.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| FRAS.L | Frasers Group PLC | HISTORY_TOO_SHORT:2, NO_LOGO |
| FRPT | Freshpet, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| FRT | Federal Realty Investment Trust | HISTORY_TOO_SHORT:1, NO_LOGO |
| FTDR | Frontdoor | HISTORY_TOO_SHORT:2, NO_LOGO |
| FTI | TechnipFMC | RANKS_MISSING:4/4, NO_LOGO |
| FTNT | Fortinet | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| GALP.LS | Galp Energia, SGPS, S.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| GDYN | Grid Dynamics Holdings, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| GEBERIT.SW | Geberit Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| GEF | Greif, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| GEN | Gen Digital Inc. | RANKS_MISSING:4/4, NO_LOGO |
| GEO | The GEO Group, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| GFC.PA | Gecina | HISTORY_TOO_SHORT:2, NO_LOGO |
| GIB | CGI INC. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| GIII | G-III Apparel Group, Ltd. | RANKS_MISSING:3/4, NO_LOGO |
| GIVN.SW | Givaudan SA | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLE.PA | Societe Generale | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLPG.AS | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| GLPI | Gaming and Leisure Properties, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| GLW | Corning Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| GME | GameStop Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| GNTX | Gentex Corporation | RANKS_MISSING:4/4, NO_LOGO |
| GNW | Genworth Financial, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| GPC | Genuine Parts Company | RANKS_MISSING:4/4, NO_LOGO |
| GSK.L | GSK plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| GTM | ZoomInfo Technologies Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| GTY | Getty Realty Corp. | RANKS_MISSING:4/4, NO_LOGO |
| GVA | Granite Construction Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| GXO | GXO Logistics, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HAL | Halliburton Company | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| HAYW | Hayward Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HCSG | Healthcare Services Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HE | Hawaiian Electric Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HEN.DE | Henkel AG & Co. KGaA | HISTORY_TOO_SHORT:2, NO_LOGO |
| HFG.DE | HelloFresh SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| HFWA | Heritage Financial Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| HIG | The Hartford Insurance Group, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| HIK.L | Hikma Pharmaceuticals PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| HLI | Houlihan Lokey, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| HLX | Helix Energy Solutions Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HM-B.ST | H & M Hennes & Mauritz AB | HISTORY_TOO_SHORT:1, NO_LOGO |
| HMN | Horace Mann Educators Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| HNI | HNI Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| HOG | Harley-Davidson, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HOOD | Robinhood Markets, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HP | Helmerich & Payne | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| HQY | HealthEquity | RANKS_MISSING:4/4, NO_LOGO |
| HR | Healthcare Realty Trust Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| HRB | H R Block | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| HRL | Hormel Foods Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| HWKN | Hawkins, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| HWM | Howmet Aerospace Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], NO_LOGO |
| IAG.L | International Consolidated Airlines Grou | HISTORY_TOO_SHORT:2, NO_LOGO |
| IAG.MC | International Consolidated Airlines Grou | HISTORY_TOO_SHORT:2, NO_LOGO |
| IBP | Installed Building Products, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| ICE | Intercontinental Exchange, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| ICG.L | Irish Continental Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| ICHR | Ichor Holdings, Ltd. | HISTORY_TOO_SHORT:2, NO_LOGO |
| IDA | IDACORP, Inc. | TTM_ANOMALY:ttm=333063.49 last=323.5, NO_LOGO |
| IDR.MC | Indra Sistemas, S.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| IEX | IDEX Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| IFX.DE | Infineon Technologies AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| IHG.L | InterContinental Hotels Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| IIIN | Insteel Industries Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| IMI.L | Institute of Mathematical Innovation | HISTORY_TOO_SHORT:2, NO_LOGO |
| INF.L | Informa | HISTORY_TOO_SHORT:0, NO_LOGO |
| INSW | International Seaways, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| INVX | Innovex International, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| IOSP | Innospec Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| IPGP | IPG Photonics Corporation | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| IPN.PA | Ipsen | HISTORY_TOO_SHORT:1, NO_LOGO |
| IPS.PA | IPSO | HISTORY_TOO_SHORT:0, NO_LOGO |
| IRM | Iron Mountain Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| ITRK.L | Intertek Group plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| ITW | Illinois Tool Works Inc. | RANKS_MISSING:4/4, NO_LOGO |
| IVZ | Invesco Ltd. | RANKS_MISSING:4/4, NO_LOGO |
| JBL | Jabil Inc. | RANKS_MISSING:4/4, NO_LOGO |
| JBTM | JBT Marel Corporation | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| JCI | Johnson Controls International plc | HISTORY_TOO_SHORT:0, NO_LOGO |
| JCQ.PA | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| JD.L | JD Sports Fashion Plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| JJSF | J J Snack Foods Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| JKHY | Jack Henry Associates, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| KAI | Kadant Inc. | RANKS_MISSING:4/4, NO_LOGO |
| KBR | KBR, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| KDP | Keurig Dr Pepper Inc. | RANKS_MISSING:4/4, NO_LOGO |
| KEMIRA.HE | Kemira Oyj | HISTORY_TOO_SHORT:1, NO_LOGO |
| KGF.L | Kingfisher plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| KHC | The Kraft Heinz Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| KMB | Kimberly-Clark Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| KMI | Kinder Morgan, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| KMPR | Kemper Corporation | RANKS_MISSING:3/4, NO_LOGO |
| KMT | Kennametal Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| KN | Knowles Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| KNF | Knife River Corporation | RANKS_MISSING:3/4, NO_LOGO |
| KNSL | Kinsale Capital Group, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| KNX | Knight-Swift Transportation Holdings Inc | HISTORY_TOO_SHORT:2, NO_LOGO |
| KOP | Koppers Holdings Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| KR | The Kroger Co. | HISTORY_TOO_SHORT:2, NO_LOGO |
| KSS | Kohl's Corporation | RANKS_MISSING:4/4, NO_LOGO |
| L | Loews Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| LAD | Lithia Motors, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| LBRT | Liberty Energy Inc. | BAD_HERO_VALUE:"None", HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| LGIH | LGI Homes, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LGND | Ligand Pharmaceuticals Incorporated | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| LH | Labcorp Holdings Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LHX | L3Harris Technologies | RANKS_MISSING:4/4, NO_LOGO |
| LI.PA | Klépierre | HISTORY_TOO_SHORT:1, NO_LOGO |
| LIF | Life360, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| LLOY.L | Lloyds Banking Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| LMP.L | LondonMetric Property PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| LNA.PA | LNA Santé | HISTORY_TOO_SHORT:2, NO_LOGO |
| LONN.SW | Lonza Group Ltd | HISTORY_TOO_SHORT:2, NO_LOGO |
| LOPE | Grand Canyon Education, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| LPX | Louisiana-Pacific Corporation | RANKS_MISSING:4/4, NO_LOGO |
| LQDT | Liquidity Services | TTM_ANOMALY:ttm=13.5 last=1.6, RANKS_MISSING:3/4, NO_LOGO |
| LRCX | Lam Research Corporation | RANKS_MISSING:4/4, NO_LOGO |
| LRN | Stride, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LULU | lululemon athletica inc. | RANKS_MISSING:3/4, NO_LOGO |
| LUMN | Lumen Technologies, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| LVS | Las Vegas Sands Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LW | Lamb Weston Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LYB | LyondellBasell Industries N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| LYG | Lloyds Banking Group plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| M | Macy's, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MAERSK-B.CO | A.P. Moller - Maersk A/S | HISTORY_TOO_SHORT:2, NO_LOGO |
| MAS | Masco Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| MAT | Mattel, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MBIN | Merchants Bancorp | HISTORY_TOO_SHORT:0, NO_LOGO |
| MCK | McKesson Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| MEDP | Medpace Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MEL.MC | Melia Hotels International | HISTORY_TOO_SHORT:0, NO_LOGO |
| META | Meta Platforms, Inc. | HISTORY_TOO_SHORT:0 |
| MGEE | MGE Energy, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MGY | Magnolia Oil Gas Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| MHK | Mohawk Industries, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| MKC | McCormick | RANKS_MISSING:4/4, NO_LOGO |
| MKSI | MKS Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4, NO_LOGO |
| MMI | Marcus Millichap, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| MMM | 3M Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| MNG.L | EGADZ | HISTORY_TOO_SHORT:0, NO_LOGO |
| MNRO | Monro, Inc. | LAST_POINT_ZERO, RANKS_MISSING:3/4, NO_LOGO |
| MOH | Molina Healthcare, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MPC | Marathon Petroleum Corporation | RANKS_MISSING:4/4, NO_LOGO |
| MPWR | Monolithic Power Systems, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| MRCY | Mercury Systems | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| MRNA | Moderna | RANKS_MISSING:4/4, NO_LOGO |
| MRO.L | Melrose Industries PLC | RANKS_MISSING:3/4, NO_LOGO |
| MRSH | Marsh McLennan Companies, Inc. | TTM_ANOMALY:ttm=3.29 last=12.5, NO_LOGO |
| MSM | MSC Industrial Direct Co., Inc. | TTM_ANOMALY:ttm=3769.5 last=3.24, RANKS_MISSING:4/4, NO_LOGO |
| MTCH | Match Group, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| MTX | Minerals Technologies Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| MTZ | MasTec, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| MUFG | Mitsubishi UFJ Financial Group | RANKS_MISSING:4/4, NO_LOGO |
| MUSA | Murphy USA Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| MWA | Mueller Water Products | RANKS_MISSING:4/4, NO_LOGO |
| MXL | MaxLinear, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| NABL | N-able, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| NEOG | Neogen Corporation | RANKS_MISSING:4/4, NO_LOGO |
| NETC.CO | Netcompany Group A/S | HISTORY_TOO_SHORT:0, NO_LOGO |
| NEU | NewMarket Corporation | RANKS_MISSING:4/4, NO_LOGO |
| NHY.OL | Norsk Hydro ASA | HISTORY_TOO_SHORT:1, NO_LOGO |
| NK.PA | IMERYS | HISTORY_TOO_SHORT:2, NO_LOGO |
| NOS.LS | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| NPK | National Presto Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| NPO | Enpro Inc. | RANKS_MISSING:3/4, NO_LOGO |
| NSA | National Storage Affiliates Trust | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| NSIT | Insight Enterprises | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| NSSC | NAPCO SECURITY TECHNOLOGIES, INC. | HISTORY_TOO_SHORT:2, NO_LOGO |
| NTCT | NetScout Systems, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| NUE | Nucor Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| NVO | Novo Nordisk A/S | HISTORY_TOO_SHORT:2, NO_LOGO |
| NVRI | Enviri Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| NVT | nVent Electric plc | RANKS_MISSING:4/4, NO_LOGO |
| NWL | Newell Brands Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| NXPI | NXP Semiconductors N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| OFG | OFG Bancorp | HISTORY_TOO_SHORT:2, NO_LOGO |
| OII | Oceaneering International | RANKS_MISSING:4/4, NO_LOGO |
| OKLO | Oklo Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| OLN | Olin Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| OMCL | Omnicell | HISTORY_TOO_SHORT:2, NO_LOGO |
| OPCH | Option Care Health, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| OPEN | Opendoor Technologies Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ORK.OL | Orkla ASA | HISTORY_TOO_SHORT:1, NO_LOGO |
| ORLY | O'Reilly Automotive, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| OSIS | OSI Systems, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| OTTR | Otter Tail Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| PANW | Palo Alto Networks | RANKS_MISSING:4/4, NO_LOGO |
| PARR | Par Pacific Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PATH | UiPath | RANKS_MISSING:3/4, NO_LOGO |
| PATK | Patrick Industries, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| PDFS | PDF Solutions, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PEB | Pebblebrook Hotel Trust | HISTORY_TOO_SHORT:2, NO_LOGO |
| PECO | Phillips Edison Company, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PEG | Public Service Enterprise Group Incorpor | RANKS_MISSING:4/4, NO_LOGO |
| PEN | Penumbra, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| PENG | Penguin Solutions, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PGHN.SW | Danske Invest Allocation | HISTORY_TOO_SHORT:1, NO_LOGO |
| PGNY | Progyny, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| PHIN | PHINIA Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PHM | PulteGroup, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PIPR | Piper Sandler Companies | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| PJT | PJT Partners Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| PLD | Prologis, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| PLTR | Palantir Technologies Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PLXS | Plexus Corp. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| PNC | The PNC Financial Services Group, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PNDORA.CO | Pandora | HISTORY_TOO_SHORT:1, NO_LOGO |
| PNW | Pinnacle West Capital Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| POR | Portland General Electric Company | RANKS_MISSING:4/4, NO_LOGO |
| POST | Post Holdings, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PPG | PPG Industries, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| PR | Permian Resources Corporation | RANKS_MISSING:4/4, NO_LOGO |
| PRAA | PRA Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4, NO_LOGO |
| PRGS | Progress Software Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| PRIM | Primoris Services Corporation | RANKS_MISSING:4/4, NO_LOGO |
| PRK | Park National Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| PRU | Prudential Financial Inc | HISTORY_TOO_SHORT:2, NO_LOGO |
| PRVA | Privia Health Group, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| PRX.AS | Prosus N.V. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PSON.L | Pearson plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| PTEN | Patterson-UTI Energy, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| PWR | Quanta Services, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| PYPL | PayPal Holdings, Inc. | HISTORY_TOO_SHORT:2 |
| PZZA | Papa John's International, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| Q | Qnity Electronics, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| QBTS | D-Wave Quantum Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| QDEL | QuidelOrtho Corporation | RANKS_MISSING:3/4, NO_LOGO |
| QRVO | Qorvo, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| R3NK.DE | RENK Group AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| REC.MI | Recordati Industria Chimica e Farmaceuti | HISTORY_TOO_SHORT:2, NO_LOGO |
| REG | Regency Centers Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| REX | REX American Resources Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| REZI | Resideo Technologies, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RGLD | Royal Gold, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RHI | Robert Half Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RHK.DE | RHÖN-KLINIKUM AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| RIO.L | Rio Tinto | HISTORY_TOO_SHORT:2, NO_LOGO |
| RKLB | Rocket Lab Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| RLI | RLI Corp. | HISTORY_TOO_SHORT:1, NO_LOGO |
| RMD | ResMed Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| RMV.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| RNG | RingCentral | RANKS_MISSING:3/4, NO_LOGO |
| ROCK | Gibraltar Industries, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| ROCK-B.CO | ROCKWOOL Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| ROG | Rogers Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| ROL | Rollins, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RR.L | Rolls-Royce Holdings plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| RRC | Range Resources Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| RRR | Red Rock Resorts | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| RSG | Republic Services | RANKS_MISSING:3/4, NO_LOGO |
| RTX | RTX Corporation | RANKS_MISSING:4/4, NO_LOGO |
| RUSHA | Rush Enterprises, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| RWE.DE | RWE AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| RXL.PA | Rexel | HISTORY_TOO_SHORT:1, NO_LOGO |
| RXO | RXO, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| RYAN | Ryan Specialty Holdings, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| SAIA | Saia, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SAN.MC | Santander Consumer Bank AG | HISTORY_TOO_SHORT:0, NO_LOGO |
| SBH | Sally Beauty Holdings, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| SBRY.L | J Sainsbury plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| SBUX | Starbucks Corporation | ZEROS_IN_HISTORY:[0], NO_LOGO |
| SCI | Service Corporation International | RANKS_MISSING:4/4, NO_LOGO |
| SCMN.SW | Swisscom AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| SCR.PA | SCOR SE | HISTORY_TOO_SHORT:2, NO_LOGO |
| SCSC | ScanSource, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| SDR.L | J. Henry Schroder Wagg & Co. Limited | HISTORY_TOO_SHORT:2, NO_LOGO |
| SF | Stifel Financial Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| SGI | Somnigroup International Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| SGRO.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| SHB-A.ST | Svenska Handelsbanken AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| SHC | Sotera Health Company | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SHO | Sunstone Hotel Investors, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| SHOP | Shopify Inc. | RANKS_MISSING:4/4, NO_LOGO |
| SHW | The Sherwin-Williams Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| SIG | Signet Jewelers Limited | LAST_POINT_ZERO, RANKS_MISSING:3/4, NO_LOGO |
| SIGI | Selective Insurance Group, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| SIKA.SW | Sika AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| SITM | SiTime Corporation | RANKS_MISSING:4/4, NO_LOGO |
| SKYW | SkyWest, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| SLB | SLB N.V. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SLGN | Silgan Holdings Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| SLVM | Sylvamo Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| SMCI | Super Micro Computer, Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| SMFG | Sumitomo Mitsui Financial Group | HISTORY_TOO_SHORT:0, NO_LOGO |
| SMG | The Scotts Miracle-Gro Company | RANKS_MISSING:4/4, NO_LOGO |
| SMP | Standard Motor Products | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SMPL | The Simply Good Foods Company | RANKS_MISSING:3/4, NO_LOGO |
| SNCY | Sun Country Airlines Holdings, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| SNEX | StoneX Group Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| SNX | TD SYNNEX Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| SOLS | Solstice Advanced Materials Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4, NO_LOGO |
| SOLV | Solventum Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| SON.LS | Sonae | HISTORY_TOO_SHORT:2, NO_LOGO |
| SOON.SW | Sonova Holding AG | HISTORY_TOO_SHORT:1, NO_LOGO |
| SPG | Simon Property Group | HISTORY_TOO_SHORT:1, NO_LOGO |
| SPHR | Sphere Entertainment Co. | HISTORY_TOO_SHORT:0, NO_LOGO |
| SPX.L | IVR | HISTORY_TOO_SHORT:1, NO_LOGO |
| SREN.SW | Swiss Re | HISTORY_TOO_SHORT:2, NO_LOGO |
| SSB | SouthState Bank Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| ST | Sensata Technologies Holding plc | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| STAN.L | Standard Chartered Bank Zambia Plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| STC | Stewart Information Services Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| STEL | Stellar Bancorp, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| STRL | Sterling Infrastructure, Inc. | TTM_ANOMALY:ttm=103.33 last=3.01, RANKS_MISSING:4/4, NO_LOGO |
| STX | Seagate Technology Holdings plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| SUPN | Supernus Pharmaceuticals, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| SVT.L | Severn Trent Plc | HISTORY_TOO_SHORT:2, NO_LOGO |
| SW | Smurfit Westrock | HISTORY_TOO_SHORT:2, NO_LOGO |
| SWKS | Skyworks Solutions, Inc. | RANKS_MISSING:4/4, NO_LOGO |
| SXT | Sensient Technologies Corporation | RANKS_MISSING:4/4, NO_LOGO |
| SY1.DE | Symrise AG | HISTORY_TOO_SHORT:1, NO_LOGO |
| SYK | Stryker Corporation | RANKS_MISSING:4/4, NO_LOGO |
| SYNA | Synaptics Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| TBBK | The Bancorp, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| TCBI | Texas Capital Bancshares, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[3, 4], RANKS_MISSING:4/4, NO_LOGO |
| TCOM | Trip.com Group Limited | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| TDC | Teradata Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| TEL2-B.ST | Tele2 AB | HISTORY_TOO_SHORT:2, NO_LOGO |
| TER | Teradyne, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| TEX | Terex Corporation | RANKS_MISSING:4/4, NO_LOGO |
| TFIN | Triumph Financial, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| THG | The Hanover Insurance Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| THRM | Gentherm Incorporated | HISTORY_TOO_SHORT:2, NO_LOGO |
| TIT.MI | Telecom Italia S.p.A. | HISTORY_TOO_SHORT:1, NO_LOGO |
| TKO | TKO Group Holdings, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| TKR | The Timken Company | HISTORY_TOO_SHORT:1, NO_LOGO |
| TLN | Talen Energy Corporation | HISTORY_TOO_SHORT:0, NO_LOGO |
| TLS1V.HE | Thermo Fisher Scientific | HISTORY_TOO_SHORT:1, NO_LOGO |
| TMO | Thermo Fisher Scientific Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4 |
| TMP | Tompkins Financial Corporation | HISTORY_TOO_SHORT:1, NO_LOGO |
| TOL | Toll Brothers, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| TPH | Tri Pointe Homes | RANKS_MISSING:4/4, NO_LOGO |
| TR | Tootsie Roll Industries | HISTORY_TOO_SHORT:2, NO_LOGO |
| TRGP | Targa Resources Corp. | HISTORY_TOO_SHORT:2, NO_LOGO |
| TRMB | Trimble Inc. | RANKS_MISSING:4/4, NO_LOGO |
| TRMK | Trustmark Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| TRV | The Travelers Companies, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| TSCO | Tractor Supply Company | HISTORY_TOO_SHORT:2, NO_LOGO |
| TT | Trane Technologies plc | BAD_HERO_VALUE:"Not disclosed", HISTORY_TOO_SHORT:0, NO_LOGO |
| TTC | The Toro Company | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], NO_LOGO |
| TTD | The Trade Desk | HISTORY_TOO_SHORT:2, NO_LOGO |
| TTEK | Tetra Tech | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| UA | UNDER ARMOUR, INC. | HISTORY_TOO_SHORT:1, NO_LOGO |
| UAA | Under Armour | RANKS_MISSING:4/4, NO_LOGO |
| UBER | Uber Technologies, Inc. | HISTORY_TOO_SHORT:2 |
| UBSI | United Bankshares, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| UCTT | Ultra Clean Holdings, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| UE | Urban Edge Properties | HISTORY_TOO_SHORT:1, NO_LOGO |
| UFPT | UFP Technologies, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| UGI | UGI Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| UHR.SW | Swatch Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| UHS | Universal Health Services, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| UNF | UniFirst Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| UNM | Unum Group | HISTORY_TOO_SHORT:2, NO_LOGO |
| UNP | Union Pacific Corporation | RANKS_MISSING:4/4, NO_LOGO |
| UPBD | Upbound Group, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| URI | United Rentals, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| USFD | US Foods Holding Corp. | RANKS_MISSING:4/4, NO_LOGO |
| UTDI.DE | United Internet AG | HISTORY_TOO_SHORT:2, NO_LOGO |
| UTL | UNITIL CORPORATION | HISTORY_TOO_SHORT:2, NO_LOGO |
| UU.L | United Utilities Group PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| VAL | Valaris Limited | HISTORY_TOO_SHORT:0, NO_LOGO |
| VALE | Vale S.A. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VCEL | Vericel Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| VFC | V.F. Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:4/4, NO_LOGO |
| VIAV | Viavi Solutions Inc. | RANKS_MISSING:3/4, NO_LOGO |
| VICI | VICI Properties Inc. | TTM_ANOMALY:ttm=3278709 last=2541, NO_LOGO |
| VIRT | Virtu Financial, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VK.PA | Vallourec | HISTORY_TOO_SHORT:1, NO_LOGO |
| VNO | Vornado Realty Trust | RANKS_MISSING:4/4, NO_LOGO |
| VNOM | Viper Energy, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| VOW.DE | Volkswagen Group | RANKS_MISSING:4/4, NO_LOGO |
| VRRM | Verra Mobility Corporation | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:3/4, NO_LOGO |
| VRSN | VeriSign, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VRTS | Virtus Investment Partners, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VSCO | Victoria's Secret Co. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VSEC | VSE Corporation | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| VTOL | Bristow Group Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| VTRS | Viatris Inc. | TTM_ANOMALY:ttm=0.48 last=0.12, RANKS_MISSING:3/4, NO_LOGO |
| VYX | NCR Voyix Corporation | RANKS_MISSING:4/4, NO_LOGO |
| VZ | Verizon Communications Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WBD | Warner Bros. Discovery, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WCC | WESCO International, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| WDAY | Workday, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| WDFC | WD-40 Company | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |
| WEIR.L | Weir Group PLC | HISTORY_TOO_SHORT:1, NO_LOGO |
| WELL | Welltower Inc. | RANKS_MISSING:3/4, NO_LOGO |
| WERN | Werner Enterprises, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:3/4, NO_LOGO |
| WEX | WEX Inc. | RANKS_MISSING:4/4, NO_LOGO |
| WFRD | Weatherford International plc | HISTORY_TOO_SHORT:1, NO_LOGO |
| WGO | Winnebago Industries, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WHD | Cactus, Inc. | HISTORY_TOO_SHORT:1, NO_LOGO |
| WING | Wingstop Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| WKC | World Kinect Corporation | HISTORY_TOO_SHORT:2, NO_LOGO |
| WLN.PA | Worldline | HISTORY_TOO_SHORT:1, NO_LOGO |
| WLY | John Wiley & Sons | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| WMT | Walmart Inc. | HISTORY_TOO_SHORT:2 |
| WPC | W. P. Carey Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[1, 2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| WRB | W. R. Berkley Corporation | RANKS_MISSING:4/4, NO_LOGO |
| WRLD | World Acceptance Corporation | RANKS_MISSING:4/4, NO_LOGO |
| WSFS | WSFS Financial Corporation | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| WSM | Williams-Sonoma, Inc. | HISTORY_TOO_SHORT:0, NO_LOGO |
| WSR | Whitestone REIT | HISTORY_TOO_SHORT:1, NO_LOGO |
| WTRG | Essential Utilities, Inc. | HISTORY_TOO_SHORT:2, NO_LOGO |
| WTS | Watts Water Technologies | RANKS_MISSING:4/4, NO_LOGO |
| WTW | Willis Towers Watson Public Limited Comp | RANKS_MISSING:3/4, NO_LOGO |
| WU | The Western Union Company | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], RANKS_MISSING:4/4, NO_LOGO |
| WWW | Wolverine World Wide | HISTORY_TOO_SHORT:2, NO_LOGO |
| WYNN | Wynn Resorts, Limited | RANKS_MISSING:4/4, NO_LOGO |
| XEL | Xcel Energy Inc. | HISTORY_TOO_SHORT:2, RANKS_MISSING:3/4, NO_LOGO |
| XHR | Xenia Hotels Resorts, Inc. | RANKS_MISSING:3/4, NO_LOGO |
| XPEL | XPEL, INC. | HISTORY_TOO_SHORT:2, NO_LOGO |
| XPO | XPO, Inc. | LAST_POINT_ZERO, ZEROS_IN_HISTORY:[2, 3, 4], NO_LOGO |
| XYL | Xylem | HISTORY_TOO_SHORT:2, RANKS_MISSING:4/4, NO_LOGO |
| XYZ | Block, Inc. | HISTORY_TOO_SHORT:1, RANKS_MISSING:3/4, NO_LOGO |
| YELP | Yelp Inc. | RANKS_MISSING:4/4, NO_LOGO |
| YETI | YETI Holdings, Inc. | HISTORY_TOO_SHORT:0, RANKS_MISSING:4/4, NO_LOGO |

## Stats

- Stés avec problème data (hors logo) : **672**
- Stés sans logo dédié seul : **464** (97 % des stés)
- Stés OK (graph + ranks + logo) : **22**

## Action urgente : logos

97 % des stés V1.7 utilisent un fallback générique. Il faut générer / fetcher les logos officiels pour les 1127 stés sans dédié.
