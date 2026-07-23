#!/usr/bin/env python3
"""Recalibrate risks for a ticker per Yann spec.
Usage: recalibrate.py TICKER
Reads source at .conv-state/risks-tmp/<T>_i1a.txt
Reads risks at src/data/v2-pipeline-enrich/<t>.json
Writes back updated JSON.
"""
import json, re, sys, os, datetime, difflib

TICKER = sys.argv[1]
t_lower = TICKER.lower()
SRC_PATH = f".conv-state/risks-tmp/{TICKER}_i1a.txt"
JSON_PATH = f"src/data/v2-pipeline-enrich/{t_lower}.json"

with open(SRC_PATH) as f:
    src = f.read()
src_lower = src.lower()

# Keyword sets per typical category+title
CAT_KEYWORDS = {
    "competitive": ["competitors", "competition", "competitive", "market share", "pricing pressure"],
    "regulatory": ["regulation", "regulatory", "compliance", "government", "laws", "SEC", "OFAC", "sanctions"],
    "operational": ["supply chain", "supplier", "operations", "manufacturing", "distribution", "logistics", "workforce", "employees", "talent"],
    "macro": ["economic", "inflation", "recession", "geopolitical", "trade", "tariffs", "foreign", "currency", "GDP"],
    "cyber": ["cyber", "cybersecurity", "data breach", "information security", "IT systems", "hackers"],
    "financial": ["indebtedness", "debt", "liquidity", "interest rate", "credit rating", "cash flow", "capital"],
    "reputational": ["reputation", "brand", "public perception"],
    "legal": ["litigation", "lawsuits", "legal proceedings", "claims", "class action"],
    "environmental": ["climate", "environmental", "greenhouse", "emissions", "GHG", "ESG"],
    "strategic": ["acquisition", "acquisitions", "integration", "strategy", "spin-off", "restructuring"],
    "market": ["demand", "customers", "market", "consumer"],
    "product": ["product", "quality", "recall"],
    "ip": ["intellectual property", "patents", "trademarks", "copyright"],
    "ai": ["artificial intelligence", "AI", "machine learning"],
    "credit": ["credit risk", "loan losses", "ACL", "allowance for credit"],
    "insurance": ["reserves", "reinsurance", "catastrophe", "underwriting"],
}

TITLE_HINTS = {
    "concurrence": "competitive",
    "réglement": "regulatory",
    "regulat": "regulatory",
    "opérationnel": "operational",
    "opér": "operational",
    "international": "macro",
    "géopoliti": "macro",
    "cyber": "cyber",
    "endettement": "financial",
    "liquidité": "financial",
    "taux": "financial",
    "climat": "environmental",
    "environnement": "environmental",
    "talents": "operational",
    "recrutement": "operational",
    "propriét": "ip",
    "marque": "reputational",
    "IA": "ai",
    "intelligence artif": "ai",
    "chaîne d'approvisionn": "operational",
    "approvisionn": "operational",
    "fournisseur": "operational",
    "litiges": "legal",
    "judiciaire": "legal",
    "acquisition": "strategic",
    "spin-off": "strategic",
    "restructur": "strategic",
    "contrat gouvernement": "regulatory",
    "gouvernement": "regulatory",
    "demande": "market",
    "sanitaire": "regulatory",
    "cyclicit": "macro",
    "aerospa": "strategic",
    "boeing": "strategic",
    "airbnb": "competitive",
    "ota": "competitive",
    "asset-light": "strategic",
    "franchis": "strategic",
    "airline": "market",
    "voyage": "macro",
    "dépôt": "financial",
    "crédit": "credit",
    "récession": "macro",
    "concentration": "market",
    "midwest": "market",
    "tcf": "strategic",
    "assurance": "insurance",
    "souscription": "insurance",
    "hilton honors": "reputational",
    "iot": "cyber",
    "environnementaux": "environmental",
    "obligations légacy": "legal",
    "tarifs": "macro",
    "commercial": "macro",
    "adoption": "ai",
    "nim": "financial",
    "sensibilité": "financial",
}


def keywords_for(title, cat, summary):
    all_kw = set()
    tl = (title + " " + summary).lower()
    for hint, target_cat in TITLE_HINTS.items():
        if hint in tl:
            all_kw.update(CAT_KEYWORDS.get(target_cat, []))
    all_kw.update(CAT_KEYWORDS.get(cat, []))
    return list(all_kw)


def find_quote(kws, src):
    """Find best short verbatim passage containing risk-language + a keyword.
    Return (quote<=15 words, position_frac, intensity_score) or None.
    """
    best = None
    # Look for sentences with risk verbs
    verb_patterns = [
        (r"materially adverse[a-z ]*", 5),
        (r"material adverse effect", 5),
        (r"would materially harm", 5),
        (r"could materially[ a-z]*adversely", 4),
        (r"could adversely affect", 3),
        (r"may adversely affect", 3),
        (r"may materially[ a-z]*affect", 4),
        (r"could harm", 3),
        (r"may harm", 2),
        (r"could result in", 2),
        (r"may result in", 2),
        (r"cannot assure", 2),
        (r"may be subject to", 2),
    ]
    for kw in kws:
        for m in re.finditer(re.escape(kw), src, re.I):
            pos = m.start()
            window = src[max(0, pos - 250):pos + 250]
            for pat, intensity in verb_patterns:
                vm = re.search(pat, window, re.I)
                if vm:
                    # Build a short quote: sentence containing the verb, up to 15 words
                    s_start = max(0, window.rfind(".", 0, vm.start()) + 1)
                    s_end = window.find(".", vm.end())
                    if s_end == -1:
                        s_end = min(len(window), vm.end() + 150)
                    sentence = window[s_start:s_end].strip()
                    words = sentence.split()
                    # take substring containing the verb
                    vw_idx = 0
                    joined_lower = " ".join(w.lower() for w in words)
                    m2 = re.search(pat, joined_lower)
                    if m2:
                        # find word index
                        cum = 0
                        for i, w in enumerate(words):
                            cum += len(w) + 1
                            if cum > m2.start():
                                vw_idx = i
                                break
                    lo = max(0, vw_idx - 5)
                    hi = min(len(words), vw_idx + 10)
                    quote = " ".join(words[lo:hi])[:200]
                    # limit to <=15 words
                    qw = quote.split()[:15]
                    quote = " ".join(qw)
                    if len(quote) < 25:
                        continue
                    frac = pos / max(1, len(src))
                    score = (intensity, -abs(len(quote.split()) - 12), -pos)
                    if best is None or score > best[0]:
                        best = (score, quote, frac, intensity)
    if best:
        return best[1], best[2], best[3]
    return None


BOILERPLATE_TITLES = {
    "talents", "recrutement", "litiges", "propri", "réputation", "marque",
    "concurrence", "taux d'intérêt", "environnementaux", "climat",
}


def calibrate(risk, src):
    title = risk.get("title", "")
    cat = risk.get("category", "operational")
    summary = risk.get("summary", "")
    kws = keywords_for(title, cat, summary)
    hit = find_quote(kws, src)
    if not hit:
        return None  # supprimer
    quote, frac, intensity = hit
    # Base score by position + intensity
    if intensity >= 5:
        score = 4
    elif intensity == 4:
        score = 3 if frac > 0.5 else 4
    elif intensity == 3:
        score = 3 if frac < 0.5 else 2
    else:
        score = 2
    # Boilerplate cap
    tl = title.lower()
    is_boiler = any(b in tl for b in BOILERPLATE_TITLES)
    if is_boiler and score > 2:
        score = 2
    # Financial exposure signals: presence of concrete percentages/dollars near quote
    # (approx) — bump up if "substantial portion", ">30%", or "significant portion of our revenue"
    upcontext = src.lower()
    if any(p in quote.lower() for p in ["substantial portion", "significant portion of our revenue", "material portion"]):
        score = min(5, score + 1)
    # Clamp
    score = max(1, min(5, score))
    pos_pct = int(frac * 100)
    if pos_pct < 34:
        pos_label = "premier tiers"
    elif pos_pct < 67:
        pos_label = "milieu"
    else:
        pos_label = "bas"
    lang_hint = {5: "langage maximal", 4: "langage fort", 3: "langage conditionnel", 2: "langage prudentiel générique"}.get(intensity, "langage prudentiel")
    rationale = f'Note {score} : "{quote}" ({pos_label} de l\'Item 1A, {pos_pct}%), {lang_hint}.'
    if is_boiler:
        rationale += " Risque boilerplate plafonné."
    return {"score": score, "quote": quote, "rationale": rationale}


def dedupe(risks):
    seen = {}
    out = []
    for r in risks:
        key = r.get("title", "").lower().strip()
        if key in seen:
            # Keep the one with higher new score
            prev_idx = seen[key]
            if r.get("score", 0) > out[prev_idx].get("score", 0):
                out[prev_idx] = r
            continue
        seen[key] = len(out)
        out.append(r)
    return out


with open(JSON_PATH) as f:
    d = json.load(f)

orig_risks = d.get("risks", [])
new_risks = []
n_down = n_up = n_supp = 0
for r in orig_risks:
    old_score = r.get("score", 3)
    result = calibrate(r, src)
    if not result:
        n_supp += 1
        continue
    new_score = result["score"]
    if new_score < old_score:
        n_down += 1
    elif new_score > old_score:
        n_up += 1
    r["score"] = new_score
    r["severity"] = new_score
    r["score_rationale"] = result["rationale"]
    new_risks.append(r)

new_risks = dedupe(new_risks)
n_dedup = len(orig_risks) - n_supp - len(new_risks)
n_supp += n_dedup

d["risks"] = new_risks
d["_risks_recalibrated_at"] = datetime.datetime.now().astimezone().isoformat()

with open(JSON_PATH, "w") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print(f"{TICKER}: {n_down}/{n_up}/{n_supp} (down/up/supprimés). Final={len(new_risks)}")
