#!/usr/bin/env python3
"""
Yann FIX 4d (29 mai 2026) — Traduit name_fr quand name_fr == name_en
sur les KPIs des sociétés top capi (priorité GOOGL + top 30 KPIs records démo).

Source : Cerebras Llama free tier (qwen-3-235b-a22b-instruct-2507).
Écrit dans : src/data/v2-pipeline/<ticker>.json (modifie kpi.name_fr in-place).

Garde-fous :
  - name_en jamais touché (source de vérité anglaise).
  - explanation jamais touché.
  - Si Cerebras renvoie identique à l'anglais → skip (pas d'écrasement).
  - Limite top 30 KPIs records démo (paramétrable --limit).

Usage :
  CEREBRAS_API_KEY=... python3 scripts/translate-kpi-name-fr-cerebras.py --limit 30
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import ssl
import urllib.request
import urllib.error

# SSL : utilise certifi si dispo (macOS Python pas toujours configuré).
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()
    try:
        _SSL_CTX.check_hostname = False
        _SSL_CTX.verify_mode = ssl.CERT_NONE
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
V2_DIR = ROOT / "src" / "data" / "v2-pipeline"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "gpt-oss-120b"  # Cerebras free tier (validé via /v1/models 2026-05-29)

# Stés témoin V1 prioritaires (la démo)
PRIORITY_TICKERS = [
    "googl", "google", "msft", "aapl", "amzn", "meta",
    "nvda", "tsla", "v", "jpm", "lly", "brk-b", "brk.b",
    "wmt", "ma", "unh", "xom", "pg", "jnj", "hd",
    "bac", "cvx", "abbv", "pfe", "ko", "pep", "tmo",
    "cost", "avgo", "mrk", "cat", "msci", "spgi",
]


def load_keys() -> list[str]:
    keys = []
    for env_name in ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY"):
        v = os.environ.get(env_name)
        if v:
            keys.append(v)
    # Fallback : parse .env.local
    if not keys:
        env_path = ROOT / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("CEREBRAS") and "=" in line:
                    _, v = line.split("=", 1)
                    keys.append(v.strip())
    return keys


def cerebras_translate(name_en: str, ticker: str, api_key: str) -> str | None:
    prompt = f"""Traduis ce nom de KPI financier de l'anglais vers le français.

Règles :
- Garde les noms de marques propres (Google, YouTube, iPhone, Cloud, AWS, Azure).
- Privilégie les termes financiers français usuels (Revenu, Marge, Chiffre d'affaires, Trésorerie, Effectifs).
- "Revenue" → "Revenu" (ou "Chiffre d'affaires" si segment).
- "Backlog" → "Carnet de commandes".
- "Subscriptions" → "Abonnements".
- "Op Income" → "Résultat opérationnel".
- "Cash Position" → "Trésorerie".
- "RPO" → garde "RPO" (Remaining Performance Obligations, terme technique).
- Réponse : UNE seule ligne, le nom traduit, sans guillemets, sans ponctuation finale, sans préfixe explicatif.

Société : {ticker.upper()}
Nom anglais : {name_en}
Nom français :"""

    payload = {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": "Tu es un traducteur financier FR. Tu réponds uniquement par la traduction, rien d'autre."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 80,
        "temperature": 0.1,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CEREBRAS_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "curl/7.79.1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            text = body["choices"][0]["message"]["content"].strip()
            # Cleanup eventuels guillemets / préfixe
            text = text.strip().strip('"').strip("'")
            # Si Cerebras a ajouté un préfixe genre "Traduction : X"
            for prefix in ("Nom français :", "Traduction :", "Réponse :", "French:", "FR:"):
                if text.startswith(prefix):
                    text = text[len(prefix):].strip()
            # Première ligne seulement (au cas où)
            text = text.splitlines()[0].strip() if text else ""
            return text or None
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"  HTTP {e.code}: {e.reason}\n")
        return None
    except Exception as e:
        sys.stderr.write(f"  Error: {e}\n")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=30, help="Nombre de KPIs traduits max (démo)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    keys = load_keys()
    if not keys:
        sys.exit("ERROR: CEREBRAS_API_KEY manquant (env ou .env.local)")
    print(f"Loaded {len(keys)} Cerebras keys.", flush=True)

    # 1) Collecter tous les KPIs avec name_fr == name_en
    targets = []  # (priority_idx, ticker_file, kpi_index, name_en)
    files = sorted(V2_DIR.glob("*.json"))
    print(f"Scanning {len(files)} v2-pipeline files…", flush=True)

    for f in files:
        ticker = f.stem.lower()
        try:
            data = json.loads(f.read_text())
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        kpis = data.get("kpis") or []
        for i, k in enumerate(kpis):
            nfr = (k.get("name_fr") or "").strip()
            nen = (k.get("name_en") or "").strip()
            if nfr and nen and nfr == nen:
                # Priorité : si ticker dans PRIORITY_TICKERS, score = position
                try:
                    pri = PRIORITY_TICKERS.index(ticker)
                except ValueError:
                    pri = 1000
                targets.append((pri, f, i, nen))

    targets.sort(key=lambda x: x[0])
    print(f"Found {len(targets)} KPIs with name_fr == name_en. Processing top {args.limit}.", flush=True)

    # 2) Traduire les top N
    by_file: dict[Path, dict[int, str]] = {}
    translated = 0
    skipped = 0
    failed = 0

    for idx, (pri, f, kpi_i, nen) in enumerate(targets[: args.limit]):
        api_key = keys[idx % len(keys)]
        print(f"[{idx+1}/{min(args.limit, len(targets))}] {f.stem} #{kpi_i} : {nen!r}", flush=True)
        nfr_new = cerebras_translate(nen, f.stem, api_key)
        if not nfr_new:
            failed += 1
            continue
        if nfr_new.strip().lower() == nen.strip().lower():
            print(f"  -> Cerebras renvoie identique EN, skip ({nfr_new!r})", flush=True)
            skipped += 1
            continue
        print(f"  -> FR: {nfr_new!r}", flush=True)
        by_file.setdefault(f, {})[kpi_i] = nfr_new
        translated += 1
        # Throttle Cerebras free 30 req/min/key, on a 3 keys → 90/min, soit 0.7s/req min.
        time.sleep(1.2)

    # 3) Écrire les fichiers modifiés
    if args.dry_run:
        print("\n[DRY RUN] No file written.")
        print(f"Translated={translated} Skipped={skipped} Failed={failed}")
        return

    for f, updates in by_file.items():
        data = json.loads(f.read_text())
        kpis = data.get("kpis") or []
        for kpi_i, nfr_new in updates.items():
            kpis[kpi_i]["name_fr"] = nfr_new
        data["kpis"] = kpis
        # Marker de traçabilité
        data["_kpi_name_fr_translated_at"] = "2026-05-29"
        data["_kpi_name_fr_translated_by"] = "CONV-MAIN-FIX-4D-CEREBRAS-LLAMA-FREE"
        f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print(f"  Wrote {len(updates)} translations to {f.name}", flush=True)

    print(f"\nDONE. Translated={translated} Skipped={skipped} Failed={failed} Files={len(by_file)}")


if __name__ == "__main__":
    main()
