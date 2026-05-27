#!/usr/bin/env python3
"""
Remplace les score_rationale génériques '...extraction automatique.' par
des rationales spécifiques via Cerebras Qwen-3 235B free tier.

Pour chaque risk concerné :
- title + category + severity + source_year donnés à Cerebras
- Cerebras produit un rationale FR spécifique citant la sévérité +
  position dans le filing + contexte business

Cible : 135 stés / 986 risks identifiés par audit.
"""
import json, os, sys, time, urllib.request, urllib.error, ssl, glob
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).parent.parent
ENRICH = ROOT / "src/data/v2-pipeline-enrich"

KEYS = [os.environ.get("GROQ_API_KEY", "")]
KEYS = [k for k in KEYS if k]
KEY_IDX_FILE = Path("/tmp/groq-key-idx-rationale.txt")
API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

GENERIC = "extraction automatique"


def next_key():
    try: idx = int(KEY_IDX_FILE.read_text().strip())
    except: idx = 0
    key = KEYS[idx % len(KEYS)]
    KEY_IDX_FILE.write_text(str((idx + 1) % len(KEYS)))
    return key, idx % len(KEYS)


def call_cerebras(prompt, max_retries=3):
    for attempt in range(max_retries):
        key, idx = next_key()
        body = json.dumps({
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "Analyste investisseur français. Réponds STRICTEMENT en JSON conforme à la structure demandée. Aucun texte hors JSON."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 4000,
            "temperature": 0.0,
        }).encode("utf-8")
        req = urllib.request.Request(
            API_URL,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "curl/7.79.1",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                return json.loads(r.read().decode("utf-8"))["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep((attempt + 1) * 5)
                continue
            print(f"  [{e.code} key{idx}] {e.read().decode('utf-8', errors='replace')[:150]}")
            time.sleep(2)
        except Exception as e:
            print(f"  [err key{idx}] {e}")
            time.sleep(2)
    return ""


def main():
    if not KEYS:
        print("[fatal] no CEREBRAS_API_KEY")
        sys.exit(1)

    # 1. Find all stés with generic rationale
    targets = []
    for f in sorted(glob.glob(str(ENRICH / "*.json"))):
        try:
            name = os.path.basename(f)
            if name.count('.') > 1: continue
            e = json.load(open(f))
            risks = e.get('risks') or []
            generic_indices = [i for i, r in enumerate(risks) if isinstance(r, dict) and GENERIC in (r.get('score_rationale') or '')]
            if generic_indices:
                targets.append((f, e, risks, generic_indices))
        except: pass

    print(f"Stés cible: {len(targets)}")
    total_risks = sum(len(g) for _, _, _, g in targets)
    print(f"Total risks à fixer: {total_risks}")

    if not targets:
        print("Rien à faire.")
        return

    fixed_stes = 0
    fixed_risks = 0
    for f, e, risks, generic_indices in targets:
        ticker = e.get('ticker', os.path.basename(f).replace('.json',''))
        source_year = e.get('_risks_source_year', 'inconnue')
        # Batch all generic risks of this sté in 1 call
        items_list = []
        for i in generic_indices:
            r = risks[i]
            items_list.append(f"{i}. title=\"{r.get('title','')[:200]}\" category=\"{r.get('category','operational')}\" severity={r.get('severity',3)}")
        prompt = f"""Société : {ticker} (source Item 1A {source_year})

Pour chacun des {len(items_list)} risques ci-dessous, génère un `score_rationale` FR spécifique (2-3 phrases, 60-180 caractères max) qui :
- justifie la sévérité ({r.get('severity',3)}/5) en fonction de la position habituelle dans Item 1A et du langage typique
- cite la nature business du risque (sans répéter le title)
- évite la phrase générique "extraction automatique"

Risques :
{chr(10).join(items_list)}

RÉPONDS STRICTEMENT en JSON :
{{"0": "rationale FR pour risque #0", "1": "rationale FR pour risque #1", ...}}

Aucun texte hors JSON."""
        out = call_cerebras(prompt)
        if not out: continue
        try:
            start = out.find('{'); end = out.rfind('}') + 1
            obj = json.loads(out[start:end])
            modified = False
            for i in generic_indices:
                rationale = obj.get(str(i))
                if rationale and isinstance(rationale, str) and GENERIC not in rationale:
                    risks[i]['score_rationale'] = rationale.strip()
                    fixed_risks += 1
                    modified = True
            if modified:
                e['risks'] = risks
                e['_risks_rationale_refined_at'] = "2026-05-27"
                Path(f).write_text(json.dumps(e, ensure_ascii=False, indent=2))
                fixed_stes += 1
                print(f"  ✓ {ticker}: {len([i for i in generic_indices if obj.get(str(i))])} rationales fixed")
        except Exception as ex:
            print(f"  ✗ {ticker}: parse err {ex}")
        time.sleep(0.8)

    print(f"\nDONE. {fixed_stes} stés / {fixed_risks} risks fixed")


if __name__ == "__main__":
    main()
