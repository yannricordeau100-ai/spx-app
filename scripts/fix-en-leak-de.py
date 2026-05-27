#!/usr/bin/env python3
"""
Scan tous les *.de.json et identifie les stés avec EN-leak (>3 markers).
Pour chaque sté, identifie les champs spécifiques qui contiennent l'EN,
appelle Groq Llama 3.3 70B pour traduire FR/EN→DE inline.
"""
import json, os, sys, time, urllib.request, urllib.error, ssl, glob, re
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).parent.parent
I18N = ROOT / "src/data/v2-pipeline-i18n"

KEY = os.environ.get("GROQ_API_KEY", "")
API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

EN_MARKERS = [
    r'\bthrough\b', r'\bof the\b', r'\bto the\b', r'\bin the\b', r'\bfor the\b',
    r'\bagainst\b', r'\bbecause\b', r'\bbetween\b', r'\bduring\b', r'\bthroughout\b',
    r'\binvolving\b', r'\baccording\b', r'\brevenue growth\b', r'\bcustomers?\b',
    r'\bbusinesses?\b', r'\bunited states\b', r'\bcompliance\b', r'\boperations\b',
    r'\binvestments?\b', r'\bsignificant(?:ly)?\b', r'\bdelivered\b',
    r'\bcompared\b', r'\bgrowing\b', r'\benvironment\b', r'\bbusiness model\b',
    r'\binability\b', r'\bcontinue to\b', r'\bwillingness\b', r'\bstrategy to\b',
    r'\baddress\b', r'\battract\b', r'\bhire\b', r'\bdevelop\b', r'\bmotivate\b',
    r'\bretain\b',
]
en_re = re.compile('|'.join(EN_MARKERS), re.IGNORECASE)


def call_groq(prompt, max_retries=3):
    for attempt in range(max_retries):
        body = json.dumps({
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "Tu es un traducteur professionnel EN→DE pour rapports financiers. Réponds STRICTEMENT en JSON. Pas de texte hors JSON."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 3000,
            "temperature": 0.0,
        }).encode("utf-8")
        req = urllib.request.Request(API_URL, data=body, headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "User-Agent": "curl/7.79.1",
        }, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                return json.loads(r.read().decode())["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep((attempt + 1) * 10)
                continue
            print(f"  [{e.code}] {e.read().decode()[:150]}")
            time.sleep(2)
        except Exception as e:
            print(f"  [err] {e}")
            time.sleep(2)
    return ""


def find_en_leaks(obj, path=""):
    """Récupère tous les strings dans un JSON avec marker EN."""
    leaks = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{path}.{k}" if path else k
            leaks.extend(find_en_leaks(v, new_path))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            new_path = f"{path}[{i}]"
            leaks.extend(find_en_leaks(v, new_path))
    elif isinstance(obj, str):
        # Skip champs légitimement EN
        if any(k in path for k in ('short', 'name_en', 'label_en', 'evidence[', '_translator', 'ticker', 'locale')):
            return leaks
        if len(obj) < 20: return leaks  # ignore courts (acronyms, etc.)
        if en_re.search(obj) and not re.search(r'^[A-Z]{2,}$', obj):
            # Skip "United States" quote in segments / geography labels (legit)
            if path.endswith('label') and obj in ('United States', 'Europe', 'Asia'):
                return leaks
            leaks.append((path, obj))
    return leaks


def main():
    if not KEY:
        print("[fatal] no GROQ_API_KEY")
        sys.exit(1)

    # Identifier stés avec EN-leak >3 dans .de.json
    targets = []
    for f in sorted(glob.glob(str(I18N / "*.de.json"))):
        try:
            d = json.load(open(f))
            leaks = find_en_leaks(d)
            if len(leaks) >= 3:
                targets.append((f, d, leaks))
        except: pass

    print(f"Stés DIRTY (≥3 EN leaks dans .de.json): {len(targets)}")
    if not targets:
        print("Rien à faire.")
        return

    fixed_files = 0
    fixed_strings = 0
    for f, d, leaks in targets[:200]:  # cap 200 stés first pass
        ticker = d.get('ticker', os.path.basename(f).replace('.de.json',''))
        # Take top 15 leaks per sté (more risque overflow context)
        leaks_to_fix = leaks[:15]
        items = "\n".join(f"{i}. {s[:300]}" for i, (_, s) in enumerate(leaks_to_fix))
        prompt = f"""Traduis ces {len(leaks_to_fix)} strings EN ou FR vers ALLEMAND professionnel.

RÈGLES :
- Garde nombres, dates, units, acronymes (EPS, EBITDA, FCF, etc.) + noms propres inchangés
- Style allemand financier business
- Si déjà partiellement allemand, complète la traduction

Strings :
{items}

RÉPONDS UNIQUEMENT en JSON :
{{"0": "traduction DE #0", "1": "traduction DE #1", ...}}

Pas de texte hors JSON."""
        out = call_groq(prompt)
        if not out: continue
        try:
            start = out.find('{'); end = out.rfind('}') + 1
            mapping = json.loads(out[start:end])
            modified = False
            for i, (path, original) in enumerate(leaks_to_fix):
                translated = mapping.get(str(i))
                if translated and isinstance(translated, str) and len(translated) > 10:
                    # Find original in JSON and replace
                    content_str = json.dumps(d, ensure_ascii=False)
                    # JSON-encoded original
                    orig_enc = json.dumps(original, ensure_ascii=False)[1:-1]
                    target_enc = json.dumps(translated, ensure_ascii=False)[1:-1]
                    if f'"{orig_enc}"' in content_str:
                        content_str = content_str.replace(f'"{orig_enc}"', f'"{target_enc}"', 1)
                        try:
                            d = json.loads(content_str)
                            modified = True
                            fixed_strings += 1
                        except json.JSONDecodeError:
                            pass
            if modified:
                Path(f).write_text(json.dumps(d, ensure_ascii=False, indent=2))
                fixed_files += 1
                print(f"  ✓ {ticker}: {len(leaks_to_fix)} strings traités")
        except Exception as e:
            print(f"  ✗ {ticker}: {e}")
        time.sleep(1.0)

    print(f"\nDONE. {fixed_files} files, {fixed_strings} strings")


if __name__ == "__main__":
    main()
