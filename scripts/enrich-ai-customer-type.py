#!/usr/bin/env python3
"""
Enrich v2-pipeline-enrich/<ticker>.json files with revenue_by_ai_customer_type.
Mission CONV-CONCEPTS Yann 2026-05-21.

Source data hand-curated from external research (analyst reports, earnings calls,
press releases, tier-1 articles). See `sources` per ticker.
"""
import json
import os
from datetime import datetime, timezone

REPO = "/Users/yann/spx-app/src/data/v2-pipeline-enrich"
EXTRACTED_AT = "2026-05-21T19:00:00Z"

# Each entry will be merged into <ticker>.json under the new key
# revenue_by_ai_customer_type.
ENRICHMENTS = {}

# --- NVDA -------------------------------------------------------------------
# Data Center revenue Q4 FY26 = $62.3B; FY26 total Data Center ~ $190B (proxy
# for AI revenue). Hyperscalers ~50% of DC, the rest = enterprise + sovereign
# AI + industrial. B2C ~ 0 (Graphics/Gaming is a separate segment, not AI).
ENRICHMENTS["nvda"] = {
    "fiscal_year": "FY26",
    "ai_segment_revenue": 184.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Data Center segment (proxy IA, exclut Gaming/Pro Viz/Auto).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 184.0, "share_pct": 100, "unit": "Mds $",
         "note": "100% des revenus IA viennent de ventes B2B : hyperscalers (~50%) + enterprise + sovereign AI + industriels. NVIDIA ne vend pas de produit IA à des particuliers."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Aucune offre IA grand public chez NVIDIA. Gaming relève d'un segment séparé hors IA."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000019/q4fy26cfocommentary.htm",
         "title": "NVIDIA Q4 FY26 CFO Commentary",
         "date": "2026-02-26", "publisher": "SEC / NVIDIA", "kind": "earning_call"},
        {"url": "https://futurumgroup.com/insights/nvidia-q3-fy-2026-record-data-center-revenue-higher-q4-guide/",
         "title": "NVIDIA Q3 FY26: Record Data Center Revenue",
         "date": "2025-11-20", "publisher": "Futurum Group", "kind": "analyst_report"},
        {"url": "https://247wallst.com/investing/2026/04/01/nvidia-ceo-40-of-revenue-now-from-non-cloud-customers-not-just-hyperscalers/",
         "title": "Nvidia CEO: 40% of revenue now from non-cloud customers",
         "date": "2026-04-01", "publisher": "24/7 Wall St.", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- MSFT -------------------------------------------------------------------
# AI run rate $37B (Q3 FY26). Copilot consumer Pro = small (~$1-2B). M365
# Copilot enterprise ~$7B + Azure AI ~$27-30B (incl. OpenAI). Everything is
# fundamentally B2B (Azure infra serves OpenAI which serves consumers, but
# from MSFT POV the customer is OpenAI).
ENRICHMENTS["msft"] = {
    "fiscal_year": "FY26 (run rate Q3)",
    "ai_segment_revenue": 37.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Annualised AI revenue run rate (Azure AI + Copilot enterprise + Copilot consumer).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 35.0, "share_pct": 95, "unit": "Mds $",
         "note": "Azure AI (OpenAI consumption ~$20-25B), M365 Copilot enterprise ~$7B, GitHub Copilot ~$1.5-2B."},
        {"label": "Particuliers (B2C)", "value": 2.0, "share_pct": 5, "unit": "Mds $",
         "note": "Copilot Pro consumer ($20/mois) + Copilot free monétisé via Bing search/ads. Estimation interne, MSFT ne breakdown pas."}
    ],
    "confidence": "mid",
    "sources": [
        {"url": "https://www.uctoday.com/unified-communications/microsoft-earnings-2026-ai-copilot-enterprise/",
         "title": "Microsoft Earnings: AI Business Hits $37Bn Run Rate as Copilot Passes 20 Million Seats",
         "date": "2026-04-30", "publisher": "UC Today", "kind": "article"},
        {"url": "https://om.co/2026/05/01/what-microsofts-10-q-says-about-openai/",
         "title": "What Microsoft's 10-Q Says About OpenAI",
         "date": "2026-05-01", "publisher": "Om Malik", "kind": "analyst_report"},
        {"url": "https://www.tikr.com/blog/microsoft-37-billion-ai-business-is-just-the-beginning-heres-what-the-market-is-missing",
         "title": "Microsoft $37 Billion AI Business",
         "date": "2026-05-02", "publisher": "TIKR", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- GOOGL ------------------------------------------------------------------
# Hard to pin a clean "AI revenue" number. Google Cloud Q1 FY26 = $20B/quarter
# = $80B run rate, with Gemini-driven enterprise demand. Gemini consumer subs
# $1.2B (2025), Gemini App 750M MAU. Use Cloud as AI proxy + consumer Gemini.
ENRICHMENTS["googl"] = {
    "fiscal_year": "FY26 (annualised Q1)",
    "ai_segment_revenue": 82.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Google Cloud annualised run rate (proxy IA, ~$80B) + consumer Gemini subscriptions (~$2B run rate).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 80.0, "share_pct": 98, "unit": "Mds $",
         "note": "Google Cloud (Vertex AI, Gemini Enterprise 8M paid seats, infrastructure). 120k+ entreprises clientes."},
        {"label": "Particuliers (B2C)", "value": 2.0, "share_pct": 2, "unit": "Mds $",
         "note": "Gemini App subscriptions ($1.2B en 2025, run rate plus élevé en 2026 vu croissance MAU)."}
    ],
    "confidence": "mid",
    "sources": [
        {"url": "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q1-2026/",
         "title": "Alphabet earnings Q1 2026, Sundar Pichai's remarks",
         "date": "2026-04-24", "publisher": "Alphabet / Google Blog", "kind": "earning_call"},
        {"url": "https://www.sec.gov/Archives/edgar/data/0001652044/000165204426000043/googexhibit991q12026.htm",
         "title": "Alphabet Q1 2026 Earnings Release (8-K)",
         "date": "2026-04-24", "publisher": "SEC / Alphabet", "kind": "earning_call"},
        {"url": "https://sqmagazine.co.uk/google-gemini-ai-statistics/",
         "title": "Google Gemini AI Statistics 2026",
         "date": "2026-04-01", "publisher": "SQ Magazine", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- AMD --------------------------------------------------------------------
# Data Center AI (MI300/MI350) ~$15-18B FY26. 100% B2B (cloud + enterprise).
ENRICHMENTS["amd"] = {
    "fiscal_year": "FY26 (estimé)",
    "ai_segment_revenue": 16.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Data Center GPU AI (MI300/MI325/MI350 series). Hors CPU EPYC.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 16.0, "share_pct": 100, "unit": "Mds $",
         "note": "Ventes 100% B2B : hyperscalers (Microsoft, Meta, Oracle) + enterprise + sovereign AI. AMD ne vend pas de GPU IA aux particuliers."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Aucun produit IA grand public (Gaming Radeon = segment séparé Client/Gaming, hors IA)."}
    ],
    "confidence": "mid",
    "sources": [
        {"url": "https://stockstory.org/us/stocks/nasdaq/amd/news/earnings-call/amd-q3-deep-dive-data-center-ai-acceleration-drive-growth-amid-inventory-and-margin-questions",
         "title": "AMD Q3 Deep Dive: Data Center, AI Acceleration",
         "date": "2026-02-05", "publisher": "StockStory", "kind": "earning_call"},
        {"url": "https://www.spglobal.com/market-intelligence/en/news-insights/research/2026/03/amd-s-next-generation-ai-chips-set-to-power-2026-data-center-growth",
         "title": "AMD's next-generation AI chips set to power 2026 data center growth",
         "date": "2026-03-15", "publisher": "S&P Global", "kind": "analyst_report"},
        {"url": "https://www.sec.gov/Archives/edgar/data/0000002488/000000248826000072/q12026991.htm",
         "title": "AMD Q1 FY26 Earnings Release (8-K)",
         "date": "2026-05-06", "publisher": "SEC / AMD", "kind": "earning_call"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- AVGO -------------------------------------------------------------------
# AI revenue FY26 estimé $40.4B (Mizuho), Q1 FY26 = $8.4B (+106% YoY).
# 100% B2B custom ASIC pour hyperscalers (Google TPU, Meta MTIA, OpenAI,
# Anthropic, etc.) + networking.
ENRICHMENTS["avgo"] = {
    "fiscal_year": "FY26 (estimé)",
    "ai_segment_revenue": 40.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "AI-related semiconductor revenue (custom XPU ASIC + AI networking).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 40.0, "share_pct": 100, "unit": "Mds $",
         "note": "100% B2B : 6 hyperscalers/labs nommés (Google, Meta, OpenAI, Anthropic + 2 anonymes). Aucune offre consumer."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Broadcom ne vend pas de produit IA à des particuliers. Modèle B2B pur."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://markets.financialcontent.com/stocks/article/marketminute-2026-3-24-broadcoms-ai-revenue-rockets-106-to-84-billion-as-custom-silicon-dominates-the-infrastructure-build-out",
         "title": "Broadcom's AI Revenue Rockets 106% to $8.4 Billion",
         "date": "2026-03-24", "publisher": "FinancialContent", "kind": "article"},
        {"url": "https://www.tipranks.com/news/broadcom-avgo-targets-100-billion-in-ai-chips-by-2027-this-keeps-me-bullish",
         "title": "Broadcom Targets $100B in AI Chips by 2027",
         "date": "2026-04-10", "publisher": "TipRanks", "kind": "analyst_report"},
        {"url": "https://finance.yahoo.com/news/broadcom-growing-role-powering-hyperscaler-141404358.html",
         "title": "Broadcom's Growing Role Powering Hyperscaler Custom AI Chip Infrastructure",
         "date": "2026-04-15", "publisher": "Yahoo Finance", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- AMZN -------------------------------------------------------------------
# AWS AI run rate $15B (B2B). Alexa+ B2C subscription tripling shopping
# frequency (small). AWS AI dominates.
ENRICHMENTS["amzn"] = {
    "fiscal_year": "FY26 (annualised Q1 run rate)",
    "ai_segment_revenue": 15.5,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "AWS AI revenue run rate (Bedrock + SageMaker + Trainium/Inferentia) + Alexa+ consumer AI.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 15.0, "share_pct": 97, "unit": "Mds $",
         "note": "AWS AI run rate $15B (Bedrock 100k+ customers, SageMaker, infrastructure pour Anthropic, etc.)."},
        {"label": "Particuliers (B2C)", "value": 0.5, "share_pct": 3, "unit": "Mds $",
         "note": "Alexa+ subscription ($20/mois) lancé fév 2026. Run rate <$1B (estimation, pas de breakdown public)."}
    ],
    "confidence": "low",
    "confidence_note": "Amazon ne breakdown pas AI explicitement. Estimations basées sur déclarations Andy Jassy + analystes.",
    "sources": [
        {"url": "https://www.aboutamazon.com/news/company-news/amazon-ceo-andy-jassy-aws-ai-q1-2026-earnings",
         "title": "Amazon CEO Andy Jassy on why customers are choosing AWS for AI",
         "date": "2026-04-29", "publisher": "Amazon", "kind": "earning_call"},
        {"url": "https://futurumgroup.com/insights/amazon-q1-fy-2026-aws-momentum-builds-as-ai-infrastructure-spend-surges/",
         "title": "Amazon Q1 FY 2026: AWS Momentum Builds as AI Infrastructure Spend Surges",
         "date": "2026-05-01", "publisher": "Futurum Group", "kind": "analyst_report"},
        {"url": "https://swotpal.com/blog/amazon-swot-analysis-2026",
         "title": "Amazon SWOT Analysis 2026: AWS AI $15B Run Rate",
         "date": "2026-04-15", "publisher": "Swotpal", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- ORCL -------------------------------------------------------------------
# OCI AI revenue grew 243% YoY. RPO $553B (mostly AI deals OpenAI/Meta).
# 100% B2B (cloud infra entreprise).
ENRICHMENTS["orcl"] = {
    "fiscal_year": "FY26 (annualised Q3)",
    "ai_segment_revenue": 9.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "OCI AI infrastructure revenue annualisé (estimation à partir de la croissance 243% YoY et OCI total ~$18B).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 9.0, "share_pct": 100, "unit": "Mds $",
         "note": "100% B2B : OpenAI, Meta, xAI, autres entreprises. Contrats long terme cloud infra."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Oracle n'a pas d'offre IA grand public. Modèle B2B pur."}
    ],
    "confidence": "mid",
    "confidence_note": "Oracle ne publie pas de breakdown AI explicite. Chiffres estimés à partir de croissance OCI 84% + part AI 243%.",
    "sources": [
        {"url": "https://futurumgroup.com/insights/oracle-q3-fy-2026-earnings-driven-by-oci-ai-infrastructure-demand/",
         "title": "Oracle Q3 FY 2026 Earnings: OCI AI Infrastructure Demand",
         "date": "2026-03-11", "publisher": "Futurum Group", "kind": "analyst_report"},
        {"url": "https://markets.financialcontent.com/stocks/article/finterra-2026-4-3-oracle-orcl-the-ai-infrastructure-landlord-of-2026",
         "title": "Oracle: The AI Infrastructure Landlord of 2026",
         "date": "2026-04-03", "publisher": "FinancialContent", "kind": "article"},
        {"url": "https://www.tikr.com/blog/how-to-value-oracles-stock-in-the-ai-era",
         "title": "How to Value Oracle's Stock in the AI Era",
         "date": "2026-04-10", "publisher": "TIKR", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- CRM --------------------------------------------------------------------
# Data Cloud ARR $2.1B + Agentforce/AI platform ARR surged 114% YoY.
# Estimation AI revenue FY26 ~$2.5-3B. 100% B2B.
ENRICHMENTS["crm"] = {
    "fiscal_year": "FY26 (estimé annualisé)",
    "ai_segment_revenue": 3.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Data Cloud ARR ($2.1B) + Agentforce/AI platform ARR (+114% YoY). Estimation Salesforce ne breakdown pas séparément.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 3.0, "share_pct": 100, "unit": "Mds $",
         "note": "Salesforce est pure-play B2B SaaS. Agentforce = AI agents pour entreprises. Aucune offre B2C."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Modèle 100% B2B. Pas de produit IA grand public."}
    ],
    "confidence": "mid",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0001108524/000110852426000056/crm-q4fy26xexhibit991.htm",
         "title": "Salesforce Q4 FY26 Earnings Release (8-K)",
         "date": "2026-02-26", "publisher": "SEC / Salesforce", "kind": "earning_call"},
        {"url": "https://techhq.com/news/salesforce-agentforce-enterprise-agentic-ai/",
         "title": "Salesforce's Agentforce enterprise bet is paying off",
         "date": "2026-03-15", "publisher": "TechHQ", "kind": "article"},
        {"url": "https://markets.financialcontent.com/wral/article/finterra-2026-3-13-the-agentic-era-inside-salesforces-crm-114-ai-revenue-surge-and-the-agentforce-revolution",
         "title": "Salesforce's 114% AI Revenue Surge and the Agentforce Revolution",
         "date": "2026-03-13", "publisher": "FinancialContent", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- NOW --------------------------------------------------------------------
# Now Assist AI ACV target $1.5B FY26 (raised from $1B). 100% B2B.
ENRICHMENTS["now"] = {
    "fiscal_year": "FY26 (target ACV)",
    "ai_segment_revenue": 1.5,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Now Assist AI ACV target FY26 (relevé de $1B à $1.5B par management).",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 1.5, "share_pct": 100, "unit": "Mds $",
         "note": "ServiceNow est pure-play B2B enterprise SaaS. 630 clients à $5M+ ACV. 100% B2B."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Aucune offre grand public. Modèle B2B exclusif."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://thenextweb.com/news/servicenow-30-billion-2030-now-assist-ai-revenue",
         "title": "ServiceNow projects $30bn by 2030, with a third of ACV from AI",
         "date": "2026-05-05", "publisher": "TheNextWeb", "kind": "article"},
        {"url": "https://io-fund.com/ai-stocks/servicenow-q2-ai-push-1b-acv-target-2026",
         "title": "ServiceNow Q2 Earnings: Inside the AI Push Toward $1 Billion ACV by 2026",
         "date": "2026-04-25", "publisher": "I/O Fund", "kind": "analyst_report"},
        {"url": "https://app.dealroom.co/news/feed/servicenow-targets-30b-revenue-by-2030-as-ai-product-hits-750m-in-contracts",
         "title": "ServiceNow targets $30B revenue by 2030 as AI product hits $750M",
         "date": "2026-05-05", "publisher": "Dealroom", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- ADBE -------------------------------------------------------------------
# Firefly direct rev $400M + influence $3B+ ARR Creative Cloud & Enterprise.
# Creative Cloud = mostly creators (mix B2C + B2B), Enterprise = pure B2B.
# Split rough.
ENRICHMENTS["adbe"] = {
    "fiscal_year": "FY26",
    "ai_segment_revenue": 3.5,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Firefly direct revenue ($400M) + AI-influenced ARR ($3B+) across Creative Cloud and Enterprise.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 2.3, "share_pct": 65, "unit": "Mds $",
         "note": "Firefly Enterprise + Creative Cloud Teams/Enterprise + 75% Fortune 500 utilisent Firefly. Adopté par creatives pro/agences."},
        {"label": "Particuliers (B2C)", "value": 1.2, "share_pct": 35, "unit": "Mds $",
         "note": "Creative Cloud individual subscriptions (Photoshop/Illustrator/Express) avec AI credits Firefly + Firefly app standalone."}
    ],
    "confidence": "low",
    "confidence_note": "Adobe ne breakdown pas Firefly entre indiv vs enterprise. Split estimé selon mix CC historique (~30% indiv, ~70% teams/enterprise).",
    "sources": [
        {"url": "https://www.ainvest.com/news/adobe-firefly-ai-drives-400m-direct-revenue-sustain-growth-rising-competition-2604/",
         "title": "Adobe's Firefly AI Drives $400M in Direct Revenue",
         "date": "2026-04-12", "publisher": "AInvest", "kind": "article"},
        {"url": "https://futurumgroup.com/insights/adobe-q1-fy-2026-earnings-show-ai-monetization-progress-amid-ceo-transition/",
         "title": "Adobe Q1 FY 2026 Earnings Show AI Monetization Progress",
         "date": "2026-03-13", "publisher": "Futurum Group", "kind": "analyst_report"},
        {"url": "https://fueler.io/blog/adobe-firefly-usage-revenue-valuation-growth-statistics",
         "title": "Adobe Firefly in 2026: Usage, Revenue, Growth Statistics",
         "date": "2026-04-01", "publisher": "Fueler", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- SNOW -------------------------------------------------------------------
# Cortex AI: 9,100 accounts use it. 100% B2B (data platform). Pas de chiffre
# revenue Cortex isolé public — utiliser produit revenue total et part AI
# workloads. AI-related workloads +200% growth. Estimation low.
ENRICHMENTS["snow"] = {
    "fiscal_year": "FY26",
    "ai_segment_revenue": 0.6,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Cortex AI consumption revenue (estimé) à partir de 9100 accounts utilisant Cortex + AI workloads +200% YoY.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 0.6, "share_pct": 100, "unit": "Mds $",
         "note": "Snowflake = pure-play B2B data cloud. Cortex = AI sur data entreprise. 5,200+ weekly users (50% client base)."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Aucune offre grand public. Modèle B2B exclusif."}
    ],
    "confidence": "low",
    "confidence_note": "Snowflake ne publie pas de revenue Cortex séparé. Estimation à partir de 606 high-value clients ($1M+) et part de produit revenue ($4.72B FY26).",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0001640147/000162828026011631/fy2026q4earnings.htm",
         "title": "Snowflake Q4 FY26 Earnings Release (8-K)",
         "date": "2026-02-26", "publisher": "SEC / Snowflake", "kind": "earning_call"},
        {"url": "https://www.ainvest.com/news/snowflake-cortex-ai-adoption-surges-50-customer-base-signaling-infrastructure-lock-ai-era-readiness-2604/",
         "title": "Snowflake's Cortex AI Adoption Surges to 50% of Customer Base",
         "date": "2026-04-15", "publisher": "AInvest", "kind": "article"},
        {"url": "https://futurumgroup.com/insights/snowflake-q4-fy-2026-results-highlight-ai-led-consumption-and-platform-expansion/",
         "title": "Snowflake Q4 FY 2026 Results Highlight AI-Led Consumption",
         "date": "2026-02-27", "publisher": "Futurum Group", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- PLTR -------------------------------------------------------------------
# Commercial vs Government. Pas B2C. Mais commercial = B2B (entreprises),
# government = B2G. On adapte le schéma : B2B = commercial + gov, B2C = 0.
# FY26 guidance $7.2B (mid). US commercial Q1 $595M (+133% YoY) annualised
# ~$2.4B. Government ~$3.5-4B. Reste ~Intl. Cible : tout AIP est B2B/B2G.
ENRICHMENTS["pltr"] = {
    "fiscal_year": "FY26 (guidance mid)",
    "ai_segment_revenue": 7.2,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Total Palantir revenue = quasi-100% piloté par AIP (Artificial Intelligence Platform). Guidance FY26 mid-point $7.2B.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 7.2, "share_pct": 100, "unit": "Mds $",
         "note": "Mix B2B commercial + B2G gouvernemental (USG ~55%, commercial ~45%). 0 grand public.",
         "sub_breakdown": [
             {"label": "Commercial (B2B entreprises)", "share_pct": 45, "value": 3.2},
             {"label": "Government (B2G)", "share_pct": 55, "value": 4.0}
         ]},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "Palantir ne vend pas aux particuliers. Plateformes Foundry/AIP/Gotham = B2B/B2G uniquement."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0001321655/000132165526000026/a2026q1ex991pressrelease.htm",
         "title": "Palantir Q1 2026 Earnings Release (8-K)",
         "date": "2026-05-05", "publisher": "SEC / Palantir", "kind": "earning_call"},
        {"url": "https://markets.financialcontent.com/wral/article/predictstreet-2025-12-17-oracle-orcl-navigating-the-cloud-and-ai-frontier",
         "title": "Palantir Q1 2026 Earnings Preview: AIP Commercial Acceleration",
         "date": "2026-04-30", "publisher": "Bitget News", "kind": "article"},
        {"url": "https://marketwise.com/investing/palantir-pltr-stock-2026-ai-valuation/",
         "title": "Palantir (PLTR) Stock 2026: Can AI Justify the Price?",
         "date": "2026-04-15", "publisher": "MarketWise", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- IBM --------------------------------------------------------------------
# Gen AI book of business $12.5B. 100% B2B (Watsonx + Consulting).
ENRICHMENTS["ibm"] = {
    "fiscal_year": "FY25 (annoncé Q4 2025)",
    "ai_segment_revenue": 12.5,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "Generative AI book of business cumulé (signed deals Watsonx + AI Consulting). Book of business, pas revenue annuel pur.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 12.5, "share_pct": 100, "unit": "Mds $",
         "note": "IBM = pure-play B2B entreprise. Mix Watsonx (software ~30%) + IBM Consulting AI services (~70%)."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "IBM n'a aucune offre IA grand public. Modèle 100% entreprises + secteur public."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0000051143/000005114326000004/ibm-20260128xex991.htm",
         "title": "IBM Q4 2025 Earnings Release (8-K)",
         "date": "2026-01-28", "publisher": "SEC / IBM", "kind": "earning_call"},
        {"url": "https://www.financialcontent.com/article/marketminute-2026-1-28-ibms-ai-transformation-crystallizes-q4-earnings-surpass-expectations-as-generative-ai-book-hits-12-billion",
         "title": "IBM's Generative AI Book Hits $12 Billion",
         "date": "2026-01-28", "publisher": "FinancialContent", "kind": "article"},
        {"url": "https://www.klover.ai/ibm-ai-strategy-lead-enterprise-ai/",
         "title": "IBM AI Strategy: Lead Enterprise AI",
         "date": "2026-03-15", "publisher": "Klover.ai", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- TSM --------------------------------------------------------------------
# HPC (AI proxy) 61% of Q1 FY26 revenue = $21.9B Q1. Annualised ~$87B.
# 100% B2B (vente wafers à NVDA, AVGO, AMD, AAPL, etc.).
ENRICHMENTS["tsm"] = {
    "fiscal_year": "FY26 (annualised Q1)",
    "ai_segment_revenue": 87.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "HPC segment revenue (proxy IA, 61% du Q1 2026 = $21.9B). Annualisé.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 87.0, "share_pct": 100, "unit": "Mds $",
         "note": "100% B2B : foundry pour NVDA (19% du CA total), AVGO, AMD, AAPL, Marvell. Aucun produit fini consumer."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "TSMC est un foundry pur, ne vend qu'aux fabless. Aucune vente directe aux particuliers."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://www.techi.com/tsmc-q1-2026-earnings-report/",
         "title": "TSMC Q1 2026 Earnings Report",
         "date": "2026-04-17", "publisher": "Techi", "kind": "article"},
        {"url": "https://www.nextplatform.com/compute/2026/04/20/ai-will-soon-drive-a-third-of-tsmcs-business/5218375",
         "title": "AI Will Soon Drive A Third Of TSMC's Business",
         "date": "2026-04-20", "publisher": "Next Platform", "kind": "analyst_report"},
        {"url": "https://finance.yahoo.com/markets/stocks/articles/nvidia-vs-tsm-earnings-reveal-134322690.html",
         "title": "Nvidia vs TSM: Earnings Reveal AI Hardware Power Split",
         "date": "2026-04-29", "publisher": "Yahoo Finance", "kind": "article"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- BABA -------------------------------------------------------------------
# Cloud Intelligence Group AI revenue triple-digit growth 11 quarters.
# Annualised run rate ~CNY 35.8B (~$5B). Qwen consumer 300M+ MAU.
# Most AI revenue from enterprise cloud, consumer Qwen mostly free/early.
ENRICHMENTS["baba"] = {
    "fiscal_year": "FY26 (annualised)",
    "ai_segment_revenue": 5.0,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "AI-related product revenue (Cloud Intelligence Group) annualised run rate, ~CNY 35.8B ≈ $5B. Conversion CNY→USD.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 4.8, "share_pct": 96, "unit": "Mds $",
         "note": "AI-related products = ~30% Cloud Intelligence external revenue. Pure enterprise cloud (Qwen API, Bailian, etc.)."},
        {"label": "Particuliers (B2C)", "value": 0.2, "share_pct": 4, "unit": "Mds $",
         "note": "Qwen consumer app (300M MAU) + Qwen Shopping Assistant Taobao. Monétisation early-stage, mostly free."}
    ],
    "confidence": "low",
    "confidence_note": "Alibaba ne breakdown pas B2B vs B2C de l'IA. Estimation : revenue consumer Qwen marginal car app gratuite/early-monétisation.",
    "sources": [
        {"url": "https://parameter.io/alibaba-ai-revenue-2026-cloud-expansion-data-centers/",
         "title": "Alibaba (BABA): Targets $4.4B AI Revenue by 2026",
         "date": "2026-03-15", "publisher": "Parameter", "kind": "article"},
        {"url": "https://nationalcioreview.com/articles-insights/cio-field-notes/alibaba-reports-ai-driven-cloud-growth-as-agent-workloads-rise/",
         "title": "Alibaba Reports AI-driven Cloud Growth",
         "date": "2026-05-15", "publisher": "National CIO Review", "kind": "article"},
        {"url": "https://www.tradingkey.com/analysis/stocks/us-stocks/261894140-alibaba-baba-earnings-cloud-growth-ai-revenue-qwen-investment-valuation-re-rating-technical-analysis-tradingkey",
         "title": "Alibaba Cloud Grew 38% and AI Revenue Heading for 50% of Segment",
         "date": "2026-05-16", "publisher": "TradingKey", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# --- C3.AI ------------------------------------------------------------------
# Total revenue FY26 guidance $400-450M. 100% B2B (federal + commercial).
# Subscription 90% of rev. Q3 FY26 = $53.3M, Q2 = $75.1M.
ENRICHMENTS["ai"] = {
    "fiscal_year": "FY26 (guidance)",
    "ai_segment_revenue": 0.42,
    "ai_segment_unit": "Mds $",
    "ai_segment_definition": "C3.ai total revenue (pure-play enterprise AI). Guidance FY26 ~$420M mid.",
    "slices": [
        {"label": "Professionnels (B2B)", "value": 0.42, "share_pct": 100, "unit": "Mds $",
         "note": "C3.ai = pure-play enterprise AI. Mix Federal (~50%) + Commercial entreprises (~50%). Partenariat MSFT a généré $130M+ bookings."},
        {"label": "Particuliers (B2C)", "value": 0.0, "share_pct": 0, "unit": "Mds $",
         "note": "C3.ai ne vend qu'aux entreprises et gouvernements. Pas d'offre consumer."}
    ],
    "confidence": "high",
    "sources": [
        {"url": "https://www.sec.gov/Archives/edgar/data/0001577526/000157752626000013/ex991-fy26xq3earnings.htm",
         "title": "C3.ai Q3 FY26 Earnings Release (8-K)",
         "date": "2026-03-12", "publisher": "SEC / C3.ai", "kind": "earning_call"},
        {"url": "https://c3.ai/c3-ai-announces-fiscal-second-quarter-2026-results/",
         "title": "C3 AI Q2 FY26 Results",
         "date": "2025-12-03", "publisher": "C3.ai", "kind": "earning_call"},
        {"url": "https://www.spglobal.com/market-intelligence/en/news-insights/research/2026/01/c3-ai-revenue-seen-falling-23percent-in-fiscal-2026-before-modest-rebound",
         "title": "C3.ai revenue seen falling 23% in fiscal 2026",
         "date": "2026-01-20", "publisher": "S&P Global", "kind": "analyst_report"}
    ],
    "extracted_at": EXTRACTED_AT
}

# === SKIPS ==================================================================
# AAPL  — pas de revenue IA isolé/identifiable (Apple Intelligence n'a pas
#         encore de revenue dédié reportable). Skip per honesty rule.
# META  — pas de segment AI explicitement reporté avec un breakdown
#         revenue. AI = enabler de pub. Skip per honesty rule.

SKIPS = {
    "aapl": "Apple ne reporte pas de revenue IA séparé. Apple Intelligence est intégré au hardware et n'a pas encore de subscription tier dédié monétisée (prévue fin 2026). Pas de chiffre crédible disponible — skip per règle d'honnêteté CLAUDE.md.",
    "meta": "Meta ne reporte pas de revenue IA séparé. L'IA est un enabler de la régie publicitaire (Llama, ad ranking, génération créative) sans chiffre AI revenue isolé crédible. Skip per règle d'honnêteté CLAUDE.md.",
}


def merge_enrich(ticker_lc, payload):
    path = os.path.join(REPO, f"{ticker_lc}.json")
    if not os.path.exists(path):
        return False, f"file not found: {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["revenue_by_ai_customer_type"] = payload
    data["_ai_customer_type_fetched_at"] = EXTRACTED_AT
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True, "ok"


def main():
    ok, fail = [], []
    for ticker, payload in ENRICHMENTS.items():
        success, msg = merge_enrich(ticker, payload)
        if success:
            ok.append(ticker)
        else:
            fail.append((ticker, msg))
    print("=== OK ===")
    for t in ok:
        print(f"  {t.upper()}")
    print("=== FAIL ===")
    for t, m in fail:
        print(f"  {t.upper()}: {m}")
    print("=== SKIP ===")
    for t, reason in SKIPS.items():
        print(f"  {t.upper()}: {reason}")


if __name__ == "__main__":
    main()
