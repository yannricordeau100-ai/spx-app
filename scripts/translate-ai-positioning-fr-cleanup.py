#!/usr/bin/env python3
"""
Second-pass cleanup: re-translate any ai_positioning_fr entries
(summary_fr or evidence_fr[].text_fr) that still look English.

Uses a TIGHT EN heuristic to avoid retranslating FR text that
contains common English technical terms (AI, machine learning, etc.).
"""
import json
import os
import re
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

CEREBRAS_KEYS = [
    k for k in [
        os.environ.get("CEREBRAS_API_KEY", ""),
        os.environ.get("CEREBRAS2_API_KEY", ""),
        os.environ.get("CEREBRAS3_API_KEY", ""),
    ] if k
]
if not CEREBRAS_KEYS:
    print("[fatal] no CEREBRAS keys", file=sys.stderr); sys.exit(1)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "gpt-oss-120b"

ROOT = Path(__file__).parent.parent
DST_DIR = ROOT / "src/data/v2-pipeline-enrich"

# Tight EN detector: count tokens that are EN function-words / verbs
# unlikely to appear in FR financial prose.
EN_TIGHT = re.compile(
    r"\b(the|of|and|for|with|provides?|offers?|delivering|enables?|operates?|"
    r"including|across|through|their|business|are|is|was|were|have|has|"
    r"customers|products|services|growth|operations|focus|focused|leveraging|"
    r"deploys?|develops?|integrates?|partners?|leading|emerging|emphasis|"
    r"adding|expansion|new|growing|within|portfolio|investment|investments|"
    r"strategy|strategic|will|continue|continues|expand|expanded|across|"
    r"references?|materials|reports?|annual|fiscal|year|years|company|enterprise|"
    r"committed|commitment|innovation|innovations|enhance|enhances|enhanced|"
    r"transform|transformation|transformative|drive|driving|driven|primary)\b",
    re.I,
)
FR_HINTS = re.compile(
    r"\b(le|la|les|du|de|des|une|un|et|aux|aux|sur|dans|pour|avec|sans|notre|leurs?|"
    r"société|sociétés|entreprise|chiffre|d'affaires|exercice|produits|"
    r"services|stratégie|développe|déploie|intègre|mentionne|mentionner|"
    r"position|positionne|aucune?|cette|ces|son|sa|ses|n['e]a|n'est|"
    r"clients|marché|marchés|technologies?|croissance|opérationnelle|opérations)\b",
    re.I,
)


def looks_english(s: str) -> bool:
    """Aggressive: returns True if text is mostly English."""
    if not isinstance(s, str) or len(s.strip()) < 10:
        return False
    en = len(EN_TIGHT.findall(s))
    fr = len(FR_HINTS.findall(s))
    # If EN tokens dominate and almost no FR markers, it's EN
    if en >= 2 and fr == 0:
        return True
    if en >= 4 and fr <= 1:
        return True
    return False


SYSTEM_PROMPT = (
    "Traducteur EN->FR pour site SaaS d'analyse d'actions. "
    "Règles : 1) JAMAIS de tiret cadratin (—), utiliser virgule. "
    "2) Préserver les guillemets et leur structure. "
    "3) Préserver acronymes (10-K, MD&A, IA, R&D, etc.), 'AI'->'IA' dans le texte. "
    "4) Noms propres, marques, chiffres, dates inchangés. "
    "5) Retourner UNIQUEMENT le texte traduit, sans préface. "
    "6) Si le texte est déjà FR, retourner tel quel. "
    "7) Style sobre d'analyste financier français."
)


def translate(text: str, key_idx: int = 0) -> str:
    if not text or not text.strip():
        return text
    for attempt in range(3):
        key = CEREBRAS_KEYS[(key_idx + attempt) % len(CEREBRAS_KEYS)]
        try:
            r = requests.post(
                CEREBRAS_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 2000,
                },
                timeout=60,
            )
            if r.status_code == 200:
                out = r.json()["choices"][0]["message"]["content"].strip()
                return out.replace("—", ", ")
            if r.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
        except Exception:
            time.sleep(1 + attempt)
    return text


def process_file(p: Path, key_idx: int) -> dict:
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return {"path": str(p), "status": f"parse_err:{e}"}
    if "ai_positioning_fr" not in d:
        return {"path": str(p), "status": "no_field"}
    ap = d["ai_positioning_fr"]
    s = ap.get("summary_fr", "") or ""
    evs = ap.get("evidence_fr", []) or []
    fixed = 0
    if looks_english(s):
        new_s = translate(s, key_idx)
        if new_s and not looks_english(new_s):
            ap["summary_fr"] = new_s
            fixed += 1
    for e in evs:
        t = e.get("text_fr", "") or ""
        if looks_english(t):
            new_t = translate(t, key_idx)
            if new_t and not looks_english(new_t):
                e["text_fr"] = new_t
                fixed += 1
    if fixed == 0:
        return {"path": str(p), "status": "clean"}

    # Read-modify-write with retry
    for attempt in range(5):
        try:
            latest = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            latest = {}
        latest["ai_positioning_fr"] = ap
        tmp = p.with_suffix(f".json.tmp.{os.getpid()}.{attempt}")
        tmp.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(p)
        try:
            check = json.loads(p.read_text(encoding="utf-8"))
            if check.get("ai_positioning_fr", {}).get("summary_fr") == ap["summary_fr"]:
                break
        except Exception:
            pass
        time.sleep(0.5)
    return {"path": str(p), "status": "fixed", "fixes": fixed}


def main() -> int:
    import glob
    paths = [Path(p) for p in glob.glob(str(DST_DIR / "*.json"))]
    print(f"[info] scanning {len(paths)} files", flush=True)

    # Filter to those that need work
    todo = []
    for p in paths:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if "ai_positioning_fr" not in d:
            continue
        ap = d["ai_positioning_fr"]
        s = ap.get("summary_fr", "") or ""
        evs = ap.get("evidence_fr", []) or []
        if looks_english(s):
            todo.append(p); continue
        for e in evs:
            if looks_english(e.get("text_fr", "") or ""):
                todo.append(p); break

    print(f"[info] need cleanup: {len(todo)}", flush=True)
    if not todo:
        return 0

    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(process_file, p, i % len(CEREBRAS_KEYS)): p for i, p in enumerate(todo)}
        done = 0
        for fut in as_completed(futs):
            res = fut.result()
            results.append(res)
            done += 1
            print(f"[{done}/{len(todo)}] {Path(res['path']).name} {res['status']}", flush=True)

    fixed = sum(1 for r in results if r["status"] == "fixed")
    clean = sum(1 for r in results if r["status"] == "clean")
    print(f"\n[done] fixed={fixed} clean={clean} total={len(results)} elapsed={time.time()-start:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
