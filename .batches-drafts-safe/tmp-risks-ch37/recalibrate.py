#!/usr/bin/env python3
"""Recalibrate risks for chunk 37 tickers. Uses hand-crafted mapping per ticker."""
import json, re, sys, os
from datetime import datetime, timezone

SRC_DIR = ".batches-drafts-safe/tmp-risks-ch37/src"
DATA_DIR = "src/data/v2-pipeline-enrich"

# Keyword regex patterns per canonical French title (helps locate risk in source)
KEYWORDS = {
    "Inflation et pression sur les coûts": r"inflation",
    "Pression concurrentielle": r"competit",
    "Pandémies et événements sanitaires": r"pandemic|epidemic|health emergency|COVID",
    "Litiges et procédures judiciaires": r"litigation|legal proceeding|lawsuit|claims",
    "Chaîne d'approvisionnement et fournisseurs": r"supply chain|supplier",
    "Tensions géopolitiques et tarifs douaniers": r"geopolit|tariff|trade (war|polic|relation)",
    "Risque de taux d'intérêt": r"interest rate",
    "Intelligence artificielle et nouvelles technologies": r"artificial intelligence|\bAI\b|machine learning|generative",
    "Risques climatiques et événements extrêmes": r"climate|natural disaster|catastroph|weather|extreme",
    "Réputation et image de marque": r"reputation|brand",
    "Risques réglementaires et juridiques": r"regulat|legal requirement|compliance",
    "Dépendance aux tiers et prestataires": r"third[- ]part|vendor|service provider|outsourc",
    "Risques financiers": r"financing|liquidity|indebted|debt|leverag",
    "Cybersécurité et sécurité de l'information": r"cyber|security breach|hack|data breach|information security",
    "Qualité et sécurité des produits": r"product (quality|safety|liab)|recall|defect",
    "Capital humain et relations sociales": r"employees|talent|labor|workforce|attract and retain",
    "Propriété intellectuelle": r"intellectual property|patent|trademark|copyright",
    "Engagements de retraite": r"pension|retirement plan|postretirement",
    "Acquisitions et intégrations": r"acquisition|integrat|business combination",
    "Évolution des préférences clients": r"consumer preference|customer preference|changing tastes|demand for our",
    "Protection des données personnelles": r"privacy|personal (data|information)|GDPR|CCPA",
    "Risques opérationnels": r"operational|operations|disrupt",
    "Risques technologiques et IT": r"system|technology|IT infrastructure|software",
    "Opérations internationales": r"international operations|foreign operations|outside the U",
    "Récession et ralentissement économique": r"recession|economic downturn|slowdown|economic condition",
    "Restructuration et plan de réduction des coûts": r"restructur|cost reduction|reorganiz",
    "Réseau immobilier et points de vente": r"stores|real estate|lease|facilit|locations",
}

# Manual per-ticker recalibrations: title -> (new_score, position_label, cite, rationale_fr, drop?)
# We'll build them below per ticker after reading sources.
def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def find_cite(src, pattern):
    """Return (position_char, third_label, quote_up_to_15_words)."""
    m = re.search(pattern, src, re.IGNORECASE)
    if not m:
        return None
    pos = m.start()
    total = len(src)
    if pos < total/3:
        third = "haut de l'Item 1A"
    elif pos < 2*total/3:
        third = "milieu de l'Item 1A"
    else:
        third = "bas de l'Item 1A"
    # Take up to ~30 words after match, then trim
    tail = src[pos:pos+600]
    words = tail.split()
    return pos, third, words

# Manually crafted risk plans per ticker
# Format: ticker -> list of (title, score, cite_str, rationale, keep=True)
# We'll build after inspecting.
PLANS = {}

# The main flow: load each ticker JSON, apply plan (recalibrated_at, drop, score, severity, rationale)
def apply(ticker, plan):
    path = f"{DATA_DIR}/{ticker}.json"
    d = json.load(open(path, "r", encoding="utf-8"))
    old_risks = d.get("risks", [])
    new_risks = []
    stats = {"down":0,"up":0,"dropped":0,"same":0}
    old_by_title = {r.get("title"): r for r in old_risks}
    for entry in plan:
        title, score, cite, rat = entry
        r = old_by_title.get(title)
        if r is None:
            continue
        old_score = r.get("score", 3)
        if score is None:
            stats["dropped"] += 1
            continue
        r = dict(r)
        r["score"] = score
        r["severity"] = score
        r["score_rationale"] = rat
        new_risks.append(r)
        if score < old_score: stats["down"] += 1
        elif score > old_score: stats["up"] += 1
        else: stats["same"] += 1
    # Handle dropped (titles in old_risks not in plan)
    planned_titles = {p[0] for p in plan}
    for title in old_by_title:
        if title not in planned_titles:
            stats["dropped"] += 1
    d["risks"] = new_risks
    d["_risks_recalibrated_at"] = now_iso()
    with open(path,"w",encoding="utf-8") as f:
        json.dump(d,f,ensure_ascii=False,indent=2)
    return stats

if __name__ == "__main__":
    # Load plans from a JSON built externally
    plans_path = sys.argv[1]
    plans = json.load(open(plans_path))
    results = {}
    for ticker, plan in plans.items():
        results[ticker] = apply(ticker, plan)
    print(json.dumps(results, indent=2))
