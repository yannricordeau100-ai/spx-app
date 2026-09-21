---
name: Glossaire Mettrik (abréviations + vocabulaire projet)
description: toutes les abréviations utilisées par l'utilisateur dans les conversations Mettrik — financières, juridiques, projet, raccourcis
type: reference
originSessionId: be2840c3-7e23-4e1e-b0ff-4125209f77dd
---
Glossaire à connaître pour comprendre les prompts de l'utilisateur sur Mettrik.

## Raccourcis user
- **PV** = plus-value (valeur ajoutée, "ce qui apporte de la PV à l'investisseur")
- **stés** = sociétés
- **conv** = conversation
- **sté** = société (singulier)

## Documents financiers (réglementaires SEC)
- **10-K** = rapport annuel (Form 10-K), publié 60-90 jours après la clôture fiscale
- **10-Q** = rapport trimestriel, publié ~40 jours après la clôture du trimestre
- **8-K** = rapport d'événement matériel (M&A, départ CEO, restructuring), publié sous 4 jours ouvrés
- **DEF 14A** = proxy statement (rapport de gouvernance + rémunération + assemblée générale), annuel
- **ER** = Earnings Release (communiqué de résultats), publié le jour des résultats
- **AGM** = Annual General Meeting (assemblée générale annuelle des actionnaires)
- **MD&A** = Management Discussion & Analysis (section narrative du 10-K et 10-Q)
- **EDGAR** = base de données SEC qui héberge tous les filings publics US

## Métriques financières
- **TAM** = Total Addressable Market (taille totale du marché adressable)
- **SAM** = Serviceable Addressable Market (sous-ensemble adressable réellement)
- **CAGR** = Compound Annual Growth Rate (taux de croissance annualisé composé)
- **YoY** = Year-over-Year (variation annuelle)
- **YTD** = Year-to-Date (depuis début d'année)
- **EPS** = Earnings Per Share / BPA en français (bénéfice par action)
- **FCF** = Free Cash Flow (flux de trésorerie disponible)
- **EBITDA** = Earnings Before Interest, Taxes, Depreciation, Amortization
- **AUM** = Assets Under Management (actifs sous gestion)
- **ARPU** = Average Revenue Per User
- **ARPP** = Average Revenue Per Person (variante Meta : famille d'apps complète)
- **DAP** = Daily Active People (Meta — utilisateurs quotidiens famille d'apps)
- **DAU/MAU** = Daily / Monthly Active Users
- **TAC** = Traffic Acquisition Costs (Google — paiements à Apple, partenaires de distribution)
- **ABF** = Asset-Based Fees (MSCI — frais sur ETF/fonds liés aux indices)
- **Run Rate** = revenu mensuel sous contrat × 12 (MSCI — annualisation projetée)
- **Backlog** = carnet de commandes (CAT — commandes fermes restant à livrer)
- **MP&E** / **ME&T** = Machinery, Power & Energy / Machinery, Energy & Transportation (segment industriel CAT, hors finance)
- **Capex** = Capital Expenditures (dépenses d'investissement, achats PP&E)
- **OPEX** = Operating Expenses
- **PP&E** = Property, Plant and Equipment

## Termes UI/projet Mettrik
- **Hero KPI** = KPI principal affiché en grand en haut de la page société (champ `hero_kpi`)
- **Shoulder** = bandeau de chips sous le grand chiffre (YoY pill + Excellent + CAGR + Top X%)
- **chart-lab** = page galerie `/chart-lab/[ticker]` avec 15 styles alternatifs (5 par chart type)
- **Mettrik / Aurora / Spatial** = les 3 variantes visuelles de l'app
- **Variant switcher** = composant top nav permettant de basculer entre les 3 variantes
- **Chip** / **pill** / **badge** = petits éléments d'affichage métadonnée (couleur + label)
- **Compare panel** = bloc d'analyse comparative quantitative (CAGR, momentum, consistency, position relative)
- **Holographic pie** = camembert 3D modal qui s'ouvre au clic sur Top 3 Voting / Capital
- **Event timeline** = bandeau d'événements clés annuels par société sous le chart
- **Freshness indicator** = pill À jour / Récent / Données vieillissantes selon `getFreshness()`

## Acronymes / brands à reconnaître
- **GOOGL** = Alphabet (parent de Google) — class A shares
- **GOOG** = Alphabet class C shares (sans droit de vote, prix très proche)
- **META** = Meta Platforms (ex-Facebook, Inc.)
- **MSCI** = MSCI Inc. (Morgan Stanley Capital International, indépendant depuis 2007)
- **SPGI** = S&P Global (issu de la fusion S&P Global + IHS Markit en fév 2022)
- **CAT** = Caterpillar Inc.

## Termes secteur / business
- **SaaS** = Software as a Service (modèle abonnement)
- **B2B** / **B2C** = Business-to-Business / Business-to-Consumer
- **CRM** = Customer Relationship Management
- **ERP** = Enterprise Resource Planning
- **ETF** = Exchange-Traded Fund
- **iOS ATT** = Apple App Tracking Transparency (changement Apple 2021 qui a cassé la pub mobile)
- **DSA / DMA** = Digital Services Act / Digital Markets Act (régulations UE numérique)
- **AI Act** = règlement UE sur l'intelligence artificielle (effectif 2024-2026)
- **GDPR** = General Data Protection Regulation (RGPD en français)
- **LLM** = Large Language Model
- **IA générative** = ChatGPT, Gemini, Claude, Llama, etc.

## Outils mentionnés en V2+
- **Groq** = service d'inférence LLM ultra-rapide, free tier généreux (Llama 3.3 70B)
- **Cerebras** = alternative Groq, encore plus rapide
- **OpenRouter** = aggrégateur d'API LLM multi-providers
- **Brave Search API** = moteur de recherche avec API gratuite (2000 req/mois)
- **Tavily** = API search orientée AI research (free tier 1000)
- **SerpAPI** = scraping Google Search (100 req/mois gratuit, insuffisant)
- **Supabase** = backend Postgres + auth, free tier suffisant pour DB V2

## Convention dates fiscales
- **FY 2025** ou **exercice 2025** = année fiscale clôturant en 2025
  (la plupart des sociétés US clôturent au 31 décembre, donc FY 2025 = jan-déc 2025)
- L'ER Q4 d'un FY est publié en jan/fév de l'année suivante
- Le 10-K d'un FY est publié 60-90 jours après la clôture
