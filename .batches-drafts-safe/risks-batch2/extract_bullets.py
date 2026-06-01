#!/usr/bin/env python3
"""
For each ticker text, identify candidate risk-factor headings/bullets.
Heuristics:
- Look for sentences after '• ' (bullet) until next bullet or '. ' (sentence end)
- Look for short bold-style headings (sentences ending with no period followed by Risk-ish text)
- Capture first 12 candidates

Output: JSON {ticker: [bullet_text...]}
"""
import os, re, json

TEXT_DIR = "/tmp/risks-batch2/texts"
OUT = "/tmp/risks-batch2/bullets.json"

PREAMBLE_PATTERNS = [
    r'^(?:there\s+are|these\s+are|the\s+following)',
    r'^(?:additional|other|further|these)\s+risks',
    r'^(?:factors\s+not\s+currently|risks\s+not\s+presently|additional\s+risks)',
    r'^(?:you\s+should|investors\s+should)',
    r'^(?:if\s+any\s+of\s+these|any\s+of\s+the\s+foregoing|if\s+any\s+(?:of\s+the\s+)?risks)',
    r'^(?:the\s+(?:events|risks|factors)\s+(?:and|of|described|discussed))',
    r'^(?:some\s+of\s+the\s+factors)',
    r'^(?:these\s+factors\s+may|these\s+risks)',
    r'^(?:we\s+(?:have|are)\s+(?:identified|subject\s+to)\s+(?:the\s+following|various))',
    r'^(?:risks\s+(?:and|related|relating)\s+to\s+(?:our|the)\s+(?:business|company|operations))$',
    r'^(?:risk\s+factors)\s',
    r'individually\s+or\s+in\s+combination',
    r'we\s+may\s+not\s+be\s+able\s+to\s+successfully\s+execute',
    r'^(?:trading\s+price)',
    r'^(?:our\s+business\s+(?:could|may)\s+also)',
    r'^(?:business\s+disruptions)',
    r'^(?:in\s+addition,?\s*these)',
    r'discussed\s+(?:below|herein|elsewhere)',
]

def is_preamble(s):
    sl = s.lower().strip()
    for p in PREAMBLE_PATTERNS:
        if re.search(p, sl):
            return True
    return False

def find_bullets(text):
    """Find bullet-list risk items."""
    bullets = []
    parts = re.split(r'(?:•|◦|·|\*|•|◦)\s+', text)
    for p in parts[1:]:
        m = re.search(r'^(.+?)(?:\.\s|;|\n|$)', p[:600])
        if m:
            s = m.group(1).strip()
            if 20 <= len(s) <= 350 and re.search(r'(may|could|risk|adverse|affect|fail|loss|harm|impact)', s, re.I):
                if not is_preamble(s):
                    bullets.append(s)
    seen = set(); uniq = []
    for b in bullets:
        key = b[:80].lower()
        if key not in seen:
            seen.add(key); uniq.append(b)
    return uniq[:20]

def find_headings(text):
    """If no bullets, find heading-style risk factors: short sentences ending in ., before paragraphs."""
    # Naive: split by sentence, take ones that look like risk headings
    sents = re.split(r'(?<=[\.\!\?])\s+(?=[A-Z])', text)
    headings = []
    for s in sents:
        s = s.strip()
        if 30 <= len(s) <= 250 and re.search(r'\b(may|could|might)\b.*\b(adverse|harm|impact|affect|fail)', s, re.I):
            headings.append(s)
        elif 30 <= len(s) <= 250 and re.search(r'^(if|risks|failure|cyber|climate|competition|regulation)', s, re.I):
            headings.append(s)
        if len(headings) >= 30: break
    return headings[:15]

result = {}
for fn in sorted(os.listdir(TEXT_DIR)):
    if not fn.endswith(".txt"): continue
    t = fn[:-4]
    path = f"{TEXT_DIR}/{fn}"
    with open(path) as fh:
        content = fh.read()
    # Skip first line metadata
    body = content.split("\n", 1)[1] if "\n" in content else content
    if body.startswith("---raw_excerpt---") or content.startswith("NO_RISK_SECTION"):
        result[t] = {"status": "no_section", "candidates": []}
        continue
    if content.startswith("ERROR"):
        result[t] = {"status": "error", "candidates": []}
        continue
    bullets = find_bullets(body)
    if len(bullets) < 4:
        headings = find_headings(body)
        bullets = bullets + headings
    # final dedup
    seen=set(); fin=[]
    for b in bullets:
        k = b[:80].lower()
        if k not in seen:
            seen.add(k); fin.append(b)
    # Capture first line meta
    meta_line = content.split("\n",1)[0]
    result[t] = {"status": "ok" if len(fin) >= 3 else "low", "meta": meta_line, "candidates": fin[:14]}

with open(OUT, "w") as f:
    json.dump(result, f, indent=1, ensure_ascii=False)

# Summary
ok = sum(1 for v in result.values() if v["status"]=="ok")
low = sum(1 for v in result.values() if v["status"]=="low")
ns = sum(1 for v in result.values() if v["status"]=="no_section")
err = sum(1 for v in result.values() if v["status"]=="error")
print(f"OK={ok} LOW={low} NO_SECTION={ns} ERROR={err}")
