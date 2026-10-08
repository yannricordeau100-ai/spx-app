import json, os
BASE = "/Users/yann/spx-app/src/data/v2-pipeline"
DATA = {}
def add(t, stance, summary, evid):
    DATA[t] = {"stance": stance, "summary": summary, "evidence": evid}

add("SYY", "cautious",
    "Sysco utilise l'IA/ML dans le pricing dynamique, la prévision de demande et la personnalisation Sysco Shop mais sans plateforme IA d'entreprise annoncée.",
    [{"title": "Sysco Shop personnalisation", "description_fr": "Sysco enrichit sa plateforme e-commerce B2B Sysco Shop avec des recommandations ML et l'analyse comportementale.", "source_url": "https://investors.sysco.com/press-releases", "date": "2024-05-07"},
     {"title": "Pricing et supply chain", "description_fr": "Sysco cite dans son 10-K des investissements analytique/ML pour le pricing dynamique et la supply chain.", "source_url": "https://investors.sysco.com/financial-information/sec-filings", "date": "2024-08-27"}])

add("TRMB", "integrator",
    "Trimble intègre l'IA dans ses solutions construction (Connected Construction), agriculture de précision et transport, avec Trimble AI Assistant.",
    [{"title": "Trimble AI Assistant", "description_fr": "Trimble lance Trimble AI Assistant, agent IA générative pour ses plateformes construction et gestion de projet.", "source_url": "https://investor.trimble.com/news-releases", "date": "2024-11-14"},
     {"title": "IA agriculture précision", "description_fr": "Trimble étend ses solutions IA pour l'agriculture de précision et l'autonomie machines PTx Trimble.", "source_url": "https://www.trimble.com/en/newsroom", "date": "2024-05-01"}])

add("UBER", "integrator",
    "Uber industrialise l'IA sur le matching, la tarification, le routage et l'expérience client (assistant IA), avec un discours CEO explicite sur l'IA.",
    [{"title": "IA matching et pricing", "description_fr": "Uber utilise l'IA/ML à grande échelle pour le matching, la tarification dynamique et l'ETA, cité comme cœur du produit.", "source_url": "https://investor.uber.com/financials/sec-filings", "date": "2025-02-05"},
     {"title": "Uber AI Solutions", "description_fr": "Uber a lancé Uber AI Solutions pour monétiser sa capacité de collecte de données au service des labs IA.", "source_url": "https://www.uber.com/newsroom", "date": "2024-09-10"}])

add("VLTO", "integrator",
    "Veralto intègre l'IA dans ses solutions Water Quality (Hach Claros) et Product Quality (Videojet, Esko) pour maintenance prédictive et vision.",
    [{"title": "Hach Claros IA", "description_fr": "Veralto/Hach étend sa plateforme Claros avec IA pour la gestion prédictive des installations d'eau.", "source_url": "https://investors.veralto.com/news-events/press-releases", "date": "2024-05-01"},
     {"title": "Vision inspection Videojet", "description_fr": "Videojet (Veralto) intègre vision par ordinateur et IA pour l'inspection ligne d'emballage.", "source_url": "https://www.veralto.com/newsroom", "date": "2024-10-24"}])

add("WM", "integrator",
    "WM (Waste Management) déploie l'IA pour l'optimisation de tournées (SmartTruck), la vision par ordinateur pour tri et sécurité conducteur.",
    [{"title": "Vision par ordinateur tri", "description_fr": "WM déploie la vision par ordinateur et l'IA dans ses centres de tri pour améliorer le taux de recyclage.", "source_url": "https://investors.wm.com/news-events/press-releases", "date": "2024-04-24"},
     {"title": "SmartTruck et sécurité conducteur", "description_fr": "WM utilise IA/télémétrie pour l'optimisation des tournées et la sécurité conducteurs.", "source_url": "https://investors.wm.com/financial-information/sec-filings", "date": "2025-02-13"}])

add("WMB", "cautious",
    "Williams Companies évoque l'analytique et le ML pour l'optimisation pipeline et la maintenance prédictive sans stratégie IA générative publique.",
    [{"title": "Optimisation pipeline", "description_fr": "Williams mentionne l'analytique et le ML pour la maintenance prédictive et l'optimisation opérationnelle de son réseau.", "source_url": "https://investor.williams.com/press-releases", "date": "2024-10-30"},
     {"title": "Datacenter growth", "description_fr": "Williams communique sur les opportunités de croissance gaz naturel liées à la demande énergie IA.", "source_url": "https://investor.williams.com/financial-information/sec-filings", "date": "2025-02-19"}])

add("ZBRA", "integrator",
    "Zebra Technologies intègre l'IA (vision, ML) dans ses solutions retail, entrepôt et santé, avec Zebra Symmetry et partenariat Qualcomm.",
    [{"title": "IA retail et entrepôt", "description_fr": "Zebra intègre IA/vision par ordinateur dans ses scanners, tablettes rugged et robots mobiles pour retail et logistique.", "source_url": "https://www.zebra.com/us/en/about-zebra/newsroom.html", "date": "2024-06-11"},
     {"title": "Zebra Symmetry", "description_fr": "Zebra étend sa plateforme Symmetry robotique et IA pour l'orchestration de flottes d'AMR.", "source_url": "https://investors.zebra.com/news-and-events/news-releases", "date": "2024-10-29"}])

# Also update the "already good" ones with a fresher enriched-at flag but only record status
ALREADY = ["RVTY","SCHW","SLB","SNPS","SOLV","SPGI","T","TGT","TMO","TSLA","TT","UNH","V","WFC","WMT","WSM","XOM","XYZ"]

report = {}
for t, ai in DATA.items():
    fp = os.path.join(BASE, f"{t}.json")
    d = json.load(open(fp))
    before = d.get('ai_positioning') or {}
    bs = before.get('stance', 'none') if before else 'none'
    be = len(before.get('evidence', []) or []) if before else 0
    d['ai_positioning'] = ai
    d['_ai_positioning_enriched_at'] = "2026-07-12"
    with open(fp, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    report[t] = {"before": {"stance": bs, "evid": be}, "after": {"stance": ai["stance"], "evid": len(ai["evidence"])}}

for t in ALREADY:
    fp = os.path.join(BASE, f"{t}.json")
    d = json.load(open(fp))
    ai = d.get('ai_positioning') or {}
    s = ai.get('stance', 'none')
    e = len(ai.get('evidence', []) or [])
    report[t] = {"before": {"stance": s, "evid": e}, "after": {"stance": s, "evid": e}, "skipped": True}

print(json.dumps(report, ensure_ascii=False))
