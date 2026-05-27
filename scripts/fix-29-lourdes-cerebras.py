#!/usr/bin/env python3
"""
fix-29-lourdes-cerebras.py — Traduit les 29 stés lourdes FR-résiduelles via
Cerebras Qwen-3 235B free tier (§0bis compliant).

Workflow :
1. Charge /tmp/fr_unique_en.json + /tmp/fr_unique_de.json (1010 strings)
2. Batch 20 strings par call Cerebras → traduction JSON
3. Sauve mapping FR→{EN,DE} dans /tmp/fr-mapping-{en,de}.json
4. Applique le mapping aux 58 fichiers cibles (29 stés × 2 langs)
"""
import json, os, sys, time, urllib.request, urllib.error, ssl
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).parent.parent
I18N_DIR = ROOT / "src/data/v2-pipeline-i18n"

KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
]
KEYS = [k for k in KEYS if k]
if not KEYS:
    print("[fatal] no CEREBRAS_API_KEY set", file=sys.stderr)
    sys.exit(1)

KEY_IDX_FILE = Path("/tmp/cerebras-key-idx.txt")

def next_key():
    """Round-robin key selection persistant via filesystem."""
    try:
        idx = int(KEY_IDX_FILE.read_text().strip())
    except Exception:
        idx = 0
    key = KEYS[idx % len(KEYS)]
    KEY_IDX_FILE.write_text(str((idx + 1) % len(KEYS)))
    return key, idx % len(KEYS)


def call_cerebras(prompt: str, max_retries: int = 3) -> str:
    """Retourne le content du LLM. Rotation key sur retry."""
    for attempt in range(max_retries):
        key, idx = next_key()
        body = json.dumps({
            "model": "qwen-3-235b-a22b-instruct-2507",
            "messages": [
                {"role": "system", "content": "Tu es un traducteur professionnel français → cible. Réponds STRICTEMENT en JSON avec la structure demandée. Aucun texte hors JSON."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 6000,
            "temperature": 0.0,
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.cerebras.ai/v1/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                # SHARED-STATUS log 14 mai : Cloudflare 1010 sur Python-urllib default UA
                "User-Agent": "curl/7.79.1",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                resp = json.loads(r.read().decode("utf-8"))
                return resp["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:200]
            if e.code == 429:
                wait = (attempt + 1) * 5
                print(f"  [429 key{idx}] wait {wait}s")
                time.sleep(wait)
                continue
            print(f"  [{e.code} key{idx}] {err_body}")
            time.sleep(2)
        except Exception as e:
            print(f"  [err key{idx}] {e}")
            time.sleep(2)
    return ""


def batch_translate(strings: list[str], target_lang: str, batch_size: int = 15) -> dict:
    """Traduit la liste FR vers target_lang. Retourne dict {fr: target}."""
    mapping = {}
    target_label = "anglais (EN)" if target_lang == "en" else "allemand (DE)"
    target_short = "EN" if target_lang == "en" else "DE"

    for i in range(0, len(strings), batch_size):
        chunk = strings[i:i + batch_size]
        items = "\n".join(f"{j}. {s}" for j, s in enumerate(chunk))
        prompt = f"""Traduis ces {len(chunk)} strings français vers {target_label}.

RÈGLES STRICTES :
- Garde inchangés : nombres, dates, units ($, €, %, Mds, M), acronymes (EPS, EBITDA, FCF, CAGR, ROIC, REIT, AFFO, EUV, ARR, MAU, DAU, TPV), noms propres (Apple, Microsoft, Sanofi, Roche, Vinci, etc.), marques.
- Garde guillemets « » ou " " et citations 10-K intactes.
- Traduction professionnelle financière, ton investisseur.

Strings français à traduire :
{items}

RÉPONDS UNIQUEMENT EN JSON valide, format strict :
{{"0": "traduction {target_short} #0", "1": "traduction {target_short} #1", ...}}

Pas de texte avant/après le JSON."""
        out = call_cerebras(prompt)
        if not out:
            print(f"  [batch {i}/{len(strings)}] {target_lang} LLM fail")
            continue
        # Extract JSON
        try:
            start = out.find("{")
            end = out.rfind("}") + 1
            if start < 0 or end <= start:
                print(f"  [batch {i}] no JSON in output")
                continue
            obj = json.loads(out[start:end])
            for j, s in enumerate(chunk):
                t = obj.get(str(j))
                if t and isinstance(t, str):
                    mapping[s] = t
            print(f"  [batch {i}/{len(strings)}] {target_lang}: +{len(obj)} mappings (total {len(mapping)})")
        except json.JSONDecodeError as e:
            print(f"  [batch {i}] JSON parse: {e}")
        time.sleep(1.0)
    return mapping


def apply_mapping(target_lang: str, tickers: list[str], mapping: dict) -> int:
    """Applique le mapping aux fichiers .{en,de}.json des tickers. Retourne count fichiers modifiés."""
    count = 0
    for t in tickers:
        path = I18N_DIR / f"{t}.{target_lang}.json"
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8")
        new_content = content
        local_count = 0
        for fr, target in mapping.items():
            # Encode FR string to JSON-safe (gestion des quotes/escape)
            fr_enc = json.dumps(fr, ensure_ascii=False)[1:-1]
            target_enc = json.dumps(target, ensure_ascii=False)[1:-1]
            if fr_enc and fr_enc in new_content:
                # Replace dans le contenu JSON-encoded
                before = new_content
                new_content = new_content.replace(f'"{fr_enc}"', f'"{target_enc}"')
                if new_content != before:
                    local_count += 1
        if local_count > 0:
            # Validate JSON
            try:
                json.loads(new_content)
                path.write_text(new_content, encoding="utf-8")
                count += 1
                print(f"  ✓ {t}.{target_lang}.json: {local_count} substitutions")
            except json.JSONDecodeError as e:
                print(f"  ✗ {t}.{target_lang}.json: JSON invalid after substitution ({e}), skipping")
    return count


def main():
    # Load unique strings
    fr_en = json.load(open("/tmp/fr_unique_en.json")) if Path("/tmp/fr_unique_en.json").exists() else []
    fr_de = json.load(open("/tmp/fr_unique_de.json")) if Path("/tmp/fr_unique_de.json").exists() else []
    print(f"EN unique strings to translate: {len(fr_en)}")
    print(f"DE unique strings to translate: {len(fr_de)}")

    tickers = [l.strip() for l in open("/tmp/i18n-lourdes-final.txt") if l.strip()]
    print(f"Tickers cibles: {len(tickers)}")

    # Translate EN
    print("\n=== EN translation ===")
    t0 = time.time()
    mapping_en = batch_translate(fr_en, "en")
    print(f"  EN done: {len(mapping_en)}/{len(fr_en)} mapped in {time.time()-t0:.1f}s")
    json.dump(mapping_en, open("/tmp/fr-mapping-en.json", "w"), ensure_ascii=False, indent=2)

    # Translate DE
    print("\n=== DE translation ===")
    t0 = time.time()
    mapping_de = batch_translate(fr_de, "de")
    print(f"  DE done: {len(mapping_de)}/{len(fr_de)} mapped in {time.time()-t0:.1f}s")
    json.dump(mapping_de, open("/tmp/fr-mapping-de.json", "w"), ensure_ascii=False, indent=2)

    # Apply
    print("\n=== Apply EN mapping ===")
    n_en = apply_mapping("en", tickers, mapping_en)
    print(f"  EN: {n_en} files modified")

    print("\n=== Apply DE mapping ===")
    n_de = apply_mapping("de", tickers, mapping_de)
    print(f"  DE: {n_de} files modified")

    print(f"\nDONE. EN={n_en} files, DE={n_de} files")


if __name__ == "__main__":
    main()
