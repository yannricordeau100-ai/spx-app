#!/usr/bin/env python3
"""
Translate ai_positioning.summary and ai_positioning.evidence[] EN->FR
for publishable stés where the content is still in English.

Source (read-only): src/data/v2-pipeline/<ticker>.json
Target (merge): src/data/v2-pipeline-enrich/<ticker>.json
  -> adds field "ai_positioning_fr": {
       "summary_fr": "...",
       "evidence_fr": [{"text_fr": "...", "source": "<original>"}, ...]
     }

Rules:
- Sober FR, no em-dash, no marketing fluff.
- Preserve quoted citations (the FR translation goes inside the same quotes).
- Skip stés already fully FR.
- Idempotent: skip if ai_positioning_fr already present and not --force.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

# Load .env.local manually
ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
]
CEREBRAS_KEYS = [k for k in CEREBRAS_KEYS if k]
if not CEREBRAS_KEYS:
    print("[fatal] no CEREBRAS_API_KEY found in env", file=sys.stderr)
    sys.exit(1)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "gpt-oss-120b"

ROOT = Path(__file__).parent.parent
SRC_DIR = ROOT / "src/data/v2-pipeline"
DST_DIR = ROOT / "src/data/v2-pipeline-enrich"

EN_PAT = re.compile(
    r"\b(the|of|and|for|with|provides|offers|leader|delivering|enables|operates|"
    r"company|including|across|through|its|their|business|are|is|was|were|have|has|"
    r"customers|products|services|technology|technologies|management|growth|revenue|"
    r"market|markets|operations|strategy|strategic|focus|focused|leading|leverages?|"
    r"deploys?|develops?|integrates?|partners?|partnership|solutions|platform|"
    r"automation|automated|artificial|intelligence|machine|learning|digital)\b",
    re.I,
)


def is_english(s: str) -> bool:
    if not isinstance(s, str) or not s.strip():
        return False
    return len(EN_PAT.findall(s)) >= 2


SYSTEM_PROMPT = (
    "Tu es un traducteur financier EN->FR pour un site SaaS d'analyse d'actions cotées. "
    "Traduis le texte fourni en français sobre, précis et professionnel. "
    "Règles strictes : "
    "1) Ne JAMAIS utiliser de tiret cadratin (em-dash : —). Utiliser des virgules ou parenthèses. "
    "2) Préserver les citations entre guillemets : si le texte contient \"...\" ou '...', traduire l'intérieur en FR en gardant les guillemets. "
    "3) Préserver les acronymes (10-K, MD&A, AI, IA, R&D, etc.) tels quels, mais 'AI' devient 'IA' dans le texte courant. "
    "4) Préserver les noms propres, marques, tickers, chiffres, dates. "
    "5) Pas d'introduction ni de commentaire, retourne UNIQUEMENT le texte traduit. "
    "6) Si le texte est déjà en français, retourne-le tel quel sans modification. "
    "7) Style : phrases courtes, vocabulaire d'analyste financier français (société, chiffre d'affaires, exercice, etc.)."
)


def cerebras_translate(text: str, key_idx: int = 0, max_retries: int = 3) -> str:
    """Call Cerebras to translate. Returns the FR translation."""
    if not text or not text.strip():
        return text

    for attempt in range(max_retries):
        key = CEREBRAS_KEYS[(key_idx + attempt) % len(CEREBRAS_KEYS)]
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.1,
            "max_tokens": 2000,
        }
        try:
            r = requests.post(CEREBRAS_URL, headers=headers, json=body, timeout=60)
            if r.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            if r.status_code != 200:
                if attempt == max_retries - 1:
                    print(f"[warn] cerebras {r.status_code}: {r.text[:200]}", file=sys.stderr)
                time.sleep(1 + attempt)
                continue
            out = r.json()["choices"][0]["message"]["content"].strip()
            # Strip em-dash defensively
            out = out.replace("—", ", ").replace(" -- ", ", ")
            return out
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[warn] cerebras exc: {e}", file=sys.stderr)
            time.sleep(1 + attempt)
    return text  # fallback : leave original


def translate_ticker(ticker: str, force: bool = False, key_idx: int = 0) -> dict:
    """Translate one ticker. Returns {ticker, status, summary_len, n_evidence}."""
    lower = ticker.lower()
    src_path = SRC_DIR / f"{lower}.json"
    dst_path = DST_DIR / f"{lower}.json"

    if not src_path.exists():
        return {"ticker": ticker, "status": "src_missing"}

    try:
        src = json.loads(src_path.read_text(encoding="utf-8"))
    except Exception as e:
        return {"ticker": ticker, "status": f"src_parse_err:{e}"}

    ap = src.get("ai_positioning") or {}
    summary = ap.get("summary", "") or ""
    evidence = ap.get("evidence") or []

    # Load existing dst (merge target)
    if dst_path.exists():
        try:
            dst = json.loads(dst_path.read_text(encoding="utf-8"))
        except Exception:
            dst = {}
    else:
        dst = {}

    if not force and "ai_positioning_fr" in dst:
        return {"ticker": ticker, "status": "skip_already_done"}

    # Translate summary if EN
    if is_english(summary):
        summary_fr = cerebras_translate(summary, key_idx=key_idx)
    else:
        summary_fr = summary  # already FR

    # Translate each evidence item
    evidence_fr = []
    for ev in evidence:
        if ev is None:
            continue
        if isinstance(ev, str):
            src_text = ev
        elif isinstance(ev, dict):
            src_text = ev.get("text", "") or ""
        else:
            continue
        if not src_text.strip():
            continue
        if is_english(src_text):
            tr = cerebras_translate(src_text, key_idx=key_idx)
        else:
            tr = src_text
        evidence_fr.append({"text_fr": tr, "source": src_text})

    ai_pos_fr_payload = {
        "summary_fr": summary_fr,
        "evidence_fr": evidence_fr,
        "_translated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "_source": "scripts/translate-ai-positioning-fr.py",
    }

    # Atomic-ish read-modify-write with retry to survive concurrent writers
    # (other Mettrik convs may also be touching this file).
    DST_DIR.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        # Re-read latest dst
        if dst_path.exists():
            try:
                latest = json.loads(dst_path.read_text(encoding="utf-8"))
            except Exception:
                latest = {}
        else:
            latest = {}
        latest["ai_positioning_fr"] = ai_pos_fr_payload
        if "ticker" not in latest:
            latest["ticker"] = src.get("ticker", ticker)
        tmp = dst_path.with_suffix(f".json.tmp.{os.getpid()}.{attempt}")
        tmp.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(dst_path)
        # Verify
        try:
            check = json.loads(dst_path.read_text(encoding="utf-8"))
            if "ai_positioning_fr" in check and check["ai_positioning_fr"].get("_translated_at") == ai_pos_fr_payload["_translated_at"]:
                break
        except Exception:
            pass
        time.sleep(0.5 + attempt * 0.5)

    return {
        "ticker": ticker,
        "status": "ok",
        "summary_len": len(summary_fr),
        "n_evidence": len(evidence_fr),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tickers", help="Comma-separated list (default: auto-detect publishable EN)")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    else:
        # Auto-detect from audit
        audit_path = ROOT / "src/data/v1-9-pre-publication-audit.json"
        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        pubs = [a["ticker"].upper() for a in audit.get("audits", [])]
        tickers = []
        for t in pubs:
            fp = SRC_DIR / f"{t.lower()}.json"
            if not fp.exists():
                continue
            try:
                d = json.loads(fp.read_text(encoding="utf-8"))
            except Exception:
                continue
            ap = d.get("ai_positioning") or {}
            s = ap.get("summary", "") or ""
            evs = ap.get("evidence") or []
            needs = False
            if is_english(s):
                needs = True
            else:
                for e in evs:
                    if e is None:
                        continue
                    txt = e if isinstance(e, str) else (e.get("text", "") if isinstance(e, dict) else "")
                    if is_english(txt):
                        needs = True
                        break
            if needs:
                tickers.append(t)

    if args.limit > 0:
        tickers = tickers[: args.limit]

    print(f"[info] tickers to process: {len(tickers)}", flush=True)
    if not tickers:
        return 0

    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {
            pool.submit(translate_ticker, t, args.force, i % len(CEREBRAS_KEYS)): t
            for i, t in enumerate(tickers)
        }
        done = 0
        for fut in as_completed(futs):
            t = futs[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"ticker": t, "status": f"exc:{e}"}
            results.append(res)
            done += 1
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (len(tickers) - done) / rate if rate > 0 else 0
            print(
                f"[{done}/{len(tickers)}] {res['ticker']} {res['status']} "
                f"({elapsed:.0f}s, eta {eta:.0f}s)",
                flush=True,
            )

    ok = sum(1 for r in results if r["status"] == "ok")
    skip = sum(1 for r in results if r["status"] == "skip_already_done")
    err = len(results) - ok - skip
    print(f"\n[done] ok={ok} skip={skip} err={err} elapsed={time.time()-start:.0f}s")
    if err > 0:
        print("[errors]")
        for r in results:
            if r["status"] not in ("ok", "skip_already_done"):
                print(f"  {r['ticker']}: {r['status']}")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
