#!/usr/bin/env python3
"""Recalibrate risks for chunk 41."""
import json, re, os
from datetime import datetime, timezone

TICKERS = ["WTW","WY","WYNN","XEL","XOM","XYL","XYZ","YUM","ZBH","ZBRA","ZTS"]

# Keyword patterns per risk-title (English + French mixed since summaries can hint)
# Maps risk title -> (english_keyword_patterns, whether_typically_boilerplate)
RISK_PATTERNS = {
    "Risque de taux d'intérêt": (["interest rate", "interest rates", "rising rates"], False),
    "Restructuration et plan de réduction des coûts": (["restructuring", "workforce reduction", "cost reduction", "cost savings program", "reorganization"], False),
    "Risques financiers": (["financial condition", "liquidity", "indebtedness", "leverage"], True),
    "Réseau immobilier et points de vente": (["real estate", "properties", "leased premises", "lease", "restaurant locations", "store locations", "facilities"], True),
    "Risques opérationnels": (["operations", "operational", "business operations"], True),
    "Litiges et procédures judiciaires": (["litigation", "legal proceedings", "lawsuit", "claims", "product liability"], False),
    "Pression concurrentielle": (["competition", "competitive", "competitors", "compete"], True),
    "Fiscalité et réformes fiscales": (["tax", "taxes", "tax law", "income tax", "tax rate"], True),
    "Tensions géopolitiques et tarifs douaniers": (["tariff", "tariffs", "geopolitical", "trade war", "trade policy", "sanctions", "trade tensions"], False),
    "Risques climatiques et événements extrêmes": (["climate change", "climate", "extreme weather", "natural disaster", "wildfire", "hurricane", "flood"], False),
    "Capital humain et relations sociales": (["attract and retain", "workforce", "employees", "labor", "human capital", "talent", "union"], True),
    "Propriété intellectuelle": (["intellectual property", "patents", "trademarks", "trade secret"], False),
    "Exécution des initiatives stratégiques": (["strategic initiatives", "strategy", "strategic plan"], True),
    "Acquisitions et intégrations": (["acquisitions", "integration", "acquire", "acquired"], False),
    "Engagements de retraite": (["pension", "retirement plan", "post-retirement", "defined benefit"], True),
    "Évolution des préférences clients": (["customer preferences", "consumer preferences", "changing tastes", "customer demand"], True),
    "Dépendance aux tiers et prestataires": (["third parties", "third-party", "suppliers", "vendors", "outsourced"], False),
    "Cybersécurité et sécurité de l'information": (["cybersecurity", "cyber", "security breach", "information security", "data breach"], False),
    "Risques réglementaires et juridiques": (["regulation", "regulatory", "compliance", "government regulations"], False),
    "Notation de crédit": (["credit rating", "credit ratings", "downgrade"], True),
    "Qualité du portefeuille de crédit": (["credit risk", "counterparty", "counterparties"], True),
    "Inflation et pression sur les coûts": (["inflation", "inflationary", "rising costs", "cost pressures"], False),
    "Chaîne d'approvisionnement et fournisseurs": (["supply chain", "suppliers", "raw materials", "components"], False),
    "Prix des matières premières": (["commodity", "commodities", "commodity prices", "oil prices", "gas prices", "raw material prices"], False),
    "Récession et ralentissement économique": (["recession", "economic downturn", "economic conditions", "slowdown"], False),
    "Opérations internationales": (["international operations", "foreign operations", "outside the united states", "international markets"], False),
    "Risque de change": (["foreign currency", "foreign exchange", "currency fluctuations", "exchange rate"], False),
    "Réputation et image de marque": (["reputation", "brand", "brand image", "goodwill"], True),
    "Protection des données personnelles": (["data privacy", "personal data", "gdpr", "privacy laws", "personal information"], False),
    "Approbations réglementaires sectorielles": (["fda", "approval", "clearance", "regulatory approval", "product approval"], False),
    "Pandémies et événements sanitaires": (["pandemic", "epidemic", "covid", "public health", "infectious disease"], False),
    "Couverture assurantielle": (["insurance", "insurance coverage", "self-insured"], True),
}

STRONG_LANG = re.compile(r"(materially adverse|material adverse effect|would materially|substantial portion|significant portion|substantially all|would have a material)", re.IGNORECASE)
MEDIUM_LANG = re.compile(r"(could materially|could adversely|may materially|adversely affect|could harm|may result|would result)", re.IGNORECASE)
WEAK_LANG = re.compile(r"(could|may|might)", re.IGNORECASE)

def find_match(text, keywords):
    """Find best keyword match position, return (position, context_start, context_end) or None."""
    text_lower = text.lower()
    best = None
    for kw in keywords:
        p = text_lower.find(kw.lower())
        if p >= 0:
            if best is None or p < best[0]:
                # extract sentence window
                s = max(0, p-100)
                # find sentence boundaries
                # look forward to end of sentence
                e = p + len(kw) + 400
                best = (p, s, min(e, len(text)))
    return best

def extract_quote(text, kw_pos, max_words=15):
    """Extract a ≤15 word English quote near position."""
    # find sentence containing kw_pos
    s = max(0, kw_pos - 200)
    e = min(len(text), kw_pos + 300)
    window = text[s:e]
    # split into sentences
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', window)
    # find sentence containing keyword (relative pos)
    rel = kw_pos - s
    off = 0
    target = None
    for sent in sentences:
        if off <= rel <= off + len(sent):
            target = sent.strip()
            break
        off += len(sent) + 1
    if not target:
        target = window[100:400].strip()
    # Get 8-15 words centered on interesting phrase
    words = target.split()
    if len(words) <= max_words:
        quote = " ".join(words)
    else:
        # try to find a substring with strong language
        m = STRONG_LANG.search(target) or MEDIUM_LANG.search(target)
        if m:
            # get 15 words around match
            before = target[:m.start()].split()[-5:]
            after = target[m.end():].split()[:8]
            middle = target[m.start():m.end()].split()
            quote_words = before + middle + after
            quote = " ".join(quote_words[:max_words])
        else:
            quote = " ".join(words[:max_words])
    # clean up
    quote = quote.strip(' .,;:')
    # ensure ends without stray punct
    return quote

def score_risk(text, kw_pos, quote, is_boilerplate):
    """Compute score based on position + language intensity."""
    total = len(text)
    rel_pos = kw_pos / total if total else 0.5
    # Language intensity in surrounding context
    ctx_s = max(0, kw_pos - 200)
    ctx_e = min(total, kw_pos + 500)
    ctx = text[ctx_s:ctx_e]
    strong = bool(STRONG_LANG.search(ctx))
    medium = bool(MEDIUM_LANG.search(ctx))
    # Base scoring by position tier
    if rel_pos < 0.15:
        base = 4 if strong else 3
    elif rel_pos < 0.35:
        base = 3 if (strong or medium) else 2
    elif rel_pos < 0.60:
        base = 2 if medium else 2
    elif rel_pos < 0.85:
        base = 2 if medium else 1
    else:
        base = 1
    # Boilerplate cap
    if is_boilerplate:
        base = min(base, 2)
    # Strong language uplift on non-boilerplate top-third
    if strong and rel_pos < 0.30 and not is_boilerplate:
        base = max(base, 4)
    return max(1, min(5, base)), rel_pos, strong, medium

def rationale(rel_pos, strong, medium, is_boilerplate, quote, new_score):
    tier_label = ("premier tiers" if rel_pos < 0.33 else
                  ("milieu de l'Item 1A" if rel_pos < 0.66 else "bas de l'Item 1A"))
    if strong:
        lang = "langage fort (« material adverse » ou équivalent)"
    elif medium:
        lang = "langage conditionnel standard (« could adversely affect »)"
    else:
        lang = "langage prudentiel générique"
    boiler = ", risque boilerplate commun à l'industrie" if is_boilerplate else ""
    quote_clean = quote.replace('"', "'").strip()
    return f'« {quote_clean} », {tier_label}, {lang}{boiler}. Note {new_score}/5.'

def process_ticker(t):
    path = f"src/data/v2-pipeline-enrich/{t.lower()}.json"
    with open(path) as f:
        d = json.load(f)
    if d.get("_risks_recalibrated_at"):
        return {"ok": True, "skipped": True}
    src_path = f".risks-tmp/{t}_item1a.txt"
    if not os.path.exists(src_path):
        return {"ok": False, "err": "no source"}
    with open(src_path) as f:
        item1a = f.read()
    risks = d.get("risks", [])
    new_risks = []
    n_down = n_up = n_removed = 0
    for r in risks:
        title = r.get("title","")
        patterns = RISK_PATTERNS.get(title)
        if not patterns:
            # Unknown title - keep with cap 2, mark generic
            keywords, is_boiler = [title.split()[0]], True
        else:
            keywords, is_boiler = patterns
        match = find_match(item1a, keywords)
        if match is None:
            # Risk not found in Item 1A -> remove
            n_removed += 1
            continue
        kw_pos = match[0]
        quote = extract_quote(item1a, kw_pos)
        new_score, rel_pos, strong, medium = score_risk(item1a, kw_pos, quote, is_boiler)
        old_score = r.get("score", 3)
        if new_score < old_score:
            n_down += 1
        elif new_score > old_score:
            n_up += 1
        new_r = {**r,
                 "score": new_score,
                 "severity": new_score,
                 "score_rationale": rationale(rel_pos, strong, medium, is_boiler, quote, new_score)}
        new_risks.append(new_r)
    # Ensure at most 2 with score >= 4 (dampen distribution if inflated)
    over4 = [i for i,r in enumerate(new_risks) if r["score"] >= 4]
    if len(over4) > 2:
        # sort by rel_pos implied by order of matches - keep the strongest (lowest position wins)
        # Just re-sort by original position via re-detection
        scored = []
        for i,r in enumerate(new_risks):
            patterns = RISK_PATTERNS.get(r["title"], ([r["title"].split()[0]], True))
            m = find_match(item1a, patterns[0])
            pos = m[0] if m else 999999
            scored.append((pos, i, r))
        scored.sort(key=lambda x: x[0])
        # Only top 2 with strong language keep >=4, others cap at 3
        kept_high = 0
        for pos, i, r in scored:
            if r["score"] >= 4:
                if kept_high < 2:
                    kept_high += 1
                else:
                    new_risks[i]["score"] = 3
                    new_risks[i]["severity"] = 3
                    n_down += 1
                    # update rationale to reflect cap
                    new_risks[i]["score_rationale"] = new_risks[i]["score_rationale"].replace("Note 4/5", "Note 3/5").replace("Note 5/5", "Note 3/5")
    d["risks"] = new_risks
    d["_risks_recalibrated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(path, "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    return {"ok": True, "n_down": n_down, "n_up": n_up, "n_removed": n_removed}

def main():
    results = {"ok":[], "revisions":{}, "fail":[]}
    for t in TICKERS:
        try:
            r = process_ticker(t)
            if not r.get("ok"):
                results["fail"].append({"t":t,"err":r.get("err")})
                continue
            results["ok"].append(t)
            results["revisions"][t] = f"{r.get('n_down',0)}_down/{r.get('n_up',0)}_up/{r.get('n_removed',0)}_supprimés"
        except Exception as e:
            results["fail"].append({"t":t,"err":str(e)})
    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    os.chdir("/Users/yann/spx-app")
    main()
