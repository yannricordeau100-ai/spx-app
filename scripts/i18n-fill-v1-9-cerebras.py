#!/usr/bin/env python3
"""
Fill EN traductions sur V1.9 publishable via Cerebras Qwen-3 235B free (3 keys rotation).
- KPI name_en manquants (93 sur 56 stés)
- Segment slices label_en (~1774)
- Geography slices label_en (~1782)

Output : src/data/v2-pipeline-enrich/<ticker>.i18n.json (canal partagé CONV-CONCEPTS).
Format :
  {
    "ticker": "<TICKER>",
    "kpi_name_en_overrides": {"<short>": "<name_en>", ...},
    "segment_label_en": ["<label_en>", ...]  // alignement par index slice
    "geography_label_en": ["<label_en>", ...]
  }

Patch load-company.ts à faire séparément : lire ce fichier, appliquer overrides
si name_en/label_en absent (anti-doublon).

Usage :
  python3 scripts/i18n-fill-v1-9-cerebras.py --field kpi_name_en
  python3 scripts/i18n-fill-v1-9-cerebras.py --field segment
  python3 scripts/i18n-fill-v1-9-cerebras.py --field geography
  python3 scripts/i18n-fill-v1-9-cerebras.py --all

Multi-procs 2 // : lancer 2 instances avec --shard 0/2 et --shard 1/2.
"""
import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
from pathlib import Path

import certifi  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
CTX = ssl.create_default_context(cafile=certifi.where())

# Load Cerebras keys (3 keys rotation)
KEYS: list[str] = []
for line in (ROOT / ".env.local").read_text().splitlines():
    if line.startswith("CEREBRAS_API_KEY=") or line.startswith("CEREBRAS2_API_KEY=") or line.startswith("CEREBRAS3_API_KEY="):
        KEYS.append(line.split("=", 1)[1].strip())
assert KEYS, "Aucune clé CEREBRAS_*_API_KEY dans .env.local"

PUB = json.load(open(ROOT / "src/data/v1-9-publishable.json"))
TICKERS: list[str] = PUB["tickers"]
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"


def load_company(ticker: str) -> dict:
    lt = ticker.lower()
    p = PIPELINE / f"{lt}.json"
    if not p.exists():
        return {}
    return json.load(open(p))


def load_i18n_override(ticker: str) -> dict:
    p = ENRICH / f"{ticker.lower()}.i18n.json"
    if p.exists():
        try:
            return json.load(open(p))
        except Exception:
            return {}
    return {}


def save_i18n_override(ticker: str, data: dict) -> None:
    p = ENRICH / f"{ticker.lower()}.i18n.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def call_cerebras(prompt: str, key_idx: int = 0, retries: int = 3) -> str | None:
    """Appel Cerebras Qwen-3 235B. Retry sur 429 avec autre clé."""
    for attempt in range(retries):
        K = KEYS[(key_idx + attempt) % len(KEYS)]
        req = urllib.request.Request(
            "https://api.cerebras.ai/v1/chat/completions",
            method="POST",
            headers={
                "Authorization": f"Bearer {K}",
                "Content-Type": "application/json",
                "User-Agent": "curl/7.79.1",
            },
            data=json.dumps({
                "model": "qwen-3-235b-a22b-instruct-2507",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "max_tokens": 800,
                "response_format": {"type": "json_object"},
            }).encode(),
        )
        try:
            r = urllib.request.urlopen(req, timeout=45, context=CTX)
            body = json.loads(r.read())
            return body["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"HTTPError {e.code} attempt {attempt}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error attempt {attempt}: {e}", file=sys.stderr)
            time.sleep(1)
    return None


def translate_batch(fr_items: list[str], context: str) -> list[str] | None:
    """Traduit N items FR → EN en un seul appel. Format JSON list."""
    if not fr_items:
        return []
    items_json = json.dumps(fr_items, ensure_ascii=False)
    prompt = (
        f"Translate this list of French {context} to English. "
        "Use concise business / finance jargon. "
        "Keep the same length and order. "
        f'Input FR: {items_json}\n'
        'Output JSON only, exact key: {"en": ["...", "...", ...]}'
    )
    raw = call_cerebras(prompt)
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        out = parsed.get("en")
        if isinstance(out, list) and len(out) == len(fr_items):
            return [str(x) for x in out]
    except Exception as e:
        print(f"Parse fail: {raw[:200]}", file=sys.stderr)
    return None


def fill_kpi_name_en(shard: int = 0, total_shards: int = 1) -> dict:
    """Fill name_en manquants sur tous les KPIs publishable."""
    stats = {"stes": 0, "kpis_filled": 0, "fail": 0}
    for i, t in enumerate(TICKERS):
        if i % total_shards != shard:
            continue
        c = load_company(t)
        if not c:
            continue
        kpis = c.get("kpis") or []
        if not isinstance(kpis, list):
            continue
        missing = [k for k in kpis if isinstance(k, dict) and not (k.get("name_en") or "").strip() and (k.get("name_fr") or "").strip()]
        if not missing:
            continue
        fr_names = [k["name_fr"] for k in missing]
        en_names = translate_batch(fr_names, "KPI names (financial / business metric labels)")
        if not en_names:
            stats["fail"] += len(missing)
            continue
        override = load_i18n_override(t)
        override.setdefault("ticker", t)
        kne = override.setdefault("kpi_name_en_overrides", {})
        for k, en in zip(missing, en_names):
            short = k.get("short")
            if short:
                kne[str(short)] = en
        save_i18n_override(t, override)
        stats["stes"] += 1
        stats["kpis_filled"] += len(missing)
        print(f"[shard {shard}/{total_shards}] {t}: +{len(missing)} name_en")
        time.sleep(0.5)
    return stats


def fill_slice_label_en(block: str, key_field: str, shard: int = 0, total_shards: int = 1) -> dict:
    """Fill label_en sur slices revenue_by_segment ou revenue_by_geography."""
    stats = {"stes": 0, "slices_filled": 0, "fail": 0}
    for i, t in enumerate(TICKERS):
        if i % total_shards != shard:
            continue
        c = load_company(t)
        if not c:
            continue
        b = c.get(block)
        if not isinstance(b, dict):
            continue
        slices = b.get("slices") or []
        if not isinstance(slices, list) or not slices:
            continue
        labels_fr: list[str] = []
        indices: list[int] = []
        for idx, s in enumerate(slices):
            if not isinstance(s, dict):
                continue
            if (s.get("label_en") or "").strip():
                continue
            l = s.get("name") or s.get("label")
            if isinstance(l, str) and l.strip():
                labels_fr.append(l)
                indices.append(idx)
        if not labels_fr:
            continue
        en = translate_batch(labels_fr, f"slice labels ({key_field} categories)")
        if not en or len(en) != len(labels_fr):
            stats["fail"] += len(labels_fr)
            continue
        override = load_i18n_override(t)
        override.setdefault("ticker", t)
        arr = override.setdefault(key_field, [None] * len(slices))
        # ajuster taille (slices peut être plus long que arr existant)
        while len(arr) < len(slices):
            arr.append(None)
        for idx, label_en in zip(indices, en):
            arr[idx] = label_en
        save_i18n_override(t, override)
        stats["stes"] += 1
        stats["slices_filled"] += len(en)
        print(f"[shard {shard}/{total_shards}] {t}: +{len(en)} {key_field}")
        time.sleep(0.5)
    return stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--field", choices=["kpi_name_en", "segment", "geography"], default=None)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--total-shards", type=int, default=1)
    args = ap.parse_args()

    if args.all:
        print("=== Pass 1: KPI name_en ===")
        s1 = fill_kpi_name_en(args.shard, args.total_shards)
        print(f"  Done: {s1}")
        print("=== Pass 2: segment label_en ===")
        s2 = fill_slice_label_en("revenue_by_segment", "segment_label_en", args.shard, args.total_shards)
        print(f"  Done: {s2}")
        print("=== Pass 3: geography label_en ===")
        s3 = fill_slice_label_en("revenue_by_geography", "geography_label_en", args.shard, args.total_shards)
        print(f"  Done: {s3}")
    elif args.field == "kpi_name_en":
        s = fill_kpi_name_en(args.shard, args.total_shards)
        print(f"Done: {s}")
    elif args.field == "segment":
        s = fill_slice_label_en("revenue_by_segment", "segment_label_en", args.shard, args.total_shards)
        print(f"Done: {s}")
    elif args.field == "geography":
        s = fill_slice_label_en("revenue_by_geography", "geography_label_en", args.shard, args.total_shards)
        print(f"Done: {s}")
    else:
        ap.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
