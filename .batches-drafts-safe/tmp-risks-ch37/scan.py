#!/usr/bin/env python3
"""For each ticker, for each risk title, find best keyword match in src and print
a candidate 15-word cite + position bucket + language intensity flags."""
import json, re, sys

KEYWORDS = {
    "Inflation et pression sur les coûts": r"\binflation",
    "Pression concurrentielle": r"compet(?:ition|itive)",
    "Pandémies et événements sanitaires": r"pandemic|epidemic|health emergency|COVID",
    "Litiges et procédures judiciaires": r"litigation|legal proceeding|lawsuit",
    "Chaîne d'approvisionnement et fournisseurs": r"supply chain|supplier",
    "Tensions géopolitiques et tarifs douaniers": r"geopolit|tariff",
    "Risque de taux d'intérêt": r"interest rate",
    "Intelligence artificielle et nouvelles technologies": r"artificial intelligence|generative AI|machine learning",
    "Risques climatiques et événements extrêmes": r"climate change|natural disaster|catastroph|severe weather",
    "Réputation et image de marque": r"reputation|brand",
    "Risques réglementaires et juridiques": r"regulat|governmental|compliance with law",
    "Dépendance aux tiers et prestataires": r"third[- ]part(?:y|ies)|service provider|outsourc",
    "Risques financiers": r"indebted|financing|liquidity|leverage|debt",
    "Cybersécurité et sécurité de l'information": r"cyber|security breach|information security",
    "Qualité et sécurité des produits": r"product (quality|safety|liab)|recall|defect",
    "Capital humain et relations sociales": r"attract and retain|talent|labor|workforce|employees",
    "Propriété intellectuelle": r"intellectual property|patent",
    "Engagements de retraite": r"pension|retirement",
    "Acquisitions et intégrations": r"acquisition|integrat",
    "Évolution des préférences clients": r"consumer preference|customer preference|changing tastes",
    "Protection des données personnelles": r"privacy|personal information|personal data",
    "Risques opérationnels": r"operational risk|business operation",
    "Risques technologiques et IT": r"information technology|IT system|technology infrastructure|network",
    "Opérations internationales": r"international operations|foreign operations|outside the U",
    "Récession et ralentissement économique": r"recession|economic downturn|economic condition",
    "Restructuration et plan de réduction des coûts": r"restructur|cost reduction",
    "Réseau immobilier et points de vente": r"stores|real estate|lease",
}

STRONG = ("material adverse", "materially adverse", "materially harm", "substantial", "significant portion")

def bucket(pos, total):
    if pos < total/3: return "haut"
    if pos < 2*total/3: return "milieu"
    return "bas"

def scan(ticker, titles):
    src = open(f".batches-drafts-safe/tmp-risks-ch37/src/{ticker}.txt").read()
    total = len(src)
    out = []
    for t in titles:
        pat = KEYWORDS.get(t)
        if not pat:
            out.append((t, None, None, None, None))
            continue
        # Find best match: prefer ones near "material adverse"
        best = None
        for m in re.finditer(pat, src, re.IGNORECASE):
            pos = m.start()
            window = src[max(0,pos-100):pos+400]
            score = 0
            for s in STRONG:
                if s.lower() in window.lower(): score += 1
            if best is None or score > best[2]:
                best = (pos, window, score, m)
        if best is None:
            out.append((t, None, None, None, None))
            continue
        pos, window, sc, m = best
        # Extract ~15 word cite: take from match position, first 15 words
        tail = src[m.start():m.start()+500]
        words = tail.split()[:15]
        cite = " ".join(words)
        out.append((t, bucket(pos,total), pos, sc, cite))
    return out

if __name__ == "__main__":
    ticker = sys.argv[1]
    with open("src/data/v2-pipeline-enrich/"+ticker+".json") as f:
        d = json.load(f)
    titles = [r.get("title") for r in d.get("risks",[])]
    for row in scan(ticker, titles):
        print(row)
