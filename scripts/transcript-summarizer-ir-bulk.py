#!/usr/bin/env python3
"""
Pipeline batch : pour chaque sté avec ≥1 transcript dans ir-scrape/,
extrait texte des 2 plus récents (Q + Q-1), génère bullets + comparaison
Q vs Q-1 via Groq Llama 3.3 70B, écrit dans transcript-summaries/.

Source : ~/Mettrik/sec-data/ir-scrape/<TICKER>/transcript/*.pdf
       + ~/Mettrik/sec-data/ir-scrape/<TICKER>/results/*transcript*.pdf

Sortie : src/data/transcript-summaries/<ticker>.json
        Schema = TranscriptBulletsSummary (cf transcript-bullets-block.tsx)

Cutoff : transcripts >12 mois ignorés (Yann règle 12 mai 2026).

Usage : python3 scripts/transcript-summarizer-ir-bulk.py [--limit N]
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
IR_SCRAPE = Path("/Users/yann/Mettrik/sec-data/ir-scrape")
OUT_DIR = ROOT / "src/data/transcript-summaries"
OUT_DIR.mkdir(parents=True, exist_ok=True)
V2_PIPELINE = ROOT / "src/data/v2-pipeline"
LOG_PATH = ROOT / "_bulk-transcripts-summarizer.log"
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

CUTOFF = datetime.now(timezone.utc) - timedelta(days=365)

KEYS = []
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("GROQ_API_KEY="):
        KEYS.append(line.split("=", 1)[1].strip())
if not KEYS:
    print("[fatal] No GROQ_API_KEY", file=sys.stderr)
    sys.exit(1)

BASE = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def log(msg: str):
    line = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def estimate_quarter_year(fname: str):
    """Devine (year, quarter) depuis le nom de fichier PDF."""
    n = fname.lower()
    m = re.search(r"(\d)[ -_]?q[ -_]?(\d{2,4})", n)
    if m:
        q = int(m.group(1)); y = int(m.group(2))
        if y < 100: y += 2000
        if 1 <= q <= 4 and 2000 < y < 2100:
            return (y, q)
    m = re.search(r"q[ -_]?(\d)[ -_]?(20\d{2})", n)
    if m:
        return (int(m.group(2)), int(m.group(1)))
    m = re.search(r"(20\d{2})[-_]q[ -_]?(\d)", n)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    return (None, None)


def estimate_date_from_filename(fname: str) -> datetime:
    n = fname.lower()
    m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", n)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except: pass
    y, q = estimate_quarter_year(fname)
    if y and q:
        return datetime(y, q * 3, 28, tzinfo=timezone.utc)
    m = re.search(r"(20\d{2})", n)
    if m:
        return datetime(int(m.group(1)), 12, 31, tzinfo=timezone.utc)
    return datetime(2000, 1, 1, tzinfo=timezone.utc)


def find_transcripts(ticker_dir: Path) -> list[dict]:
    """Retourne liste des transcripts PDFs (path, date_est, year, quarter, mtime)."""
    out = []
    for sub in ("transcript", "results"):
        d = ticker_dir / sub
        if not d.exists(): continue
        for p in d.iterdir():
            if not p.is_file() or p.suffix.lower() != ".pdf": continue
            name = p.name.lower()
            if sub == "results" and not ("transcript" in name or "earnings-call" in name or "earnings_call" in name):
                continue
            est = estimate_date_from_filename(p.name)
            if est < CUTOFF:
                continue
            y, q = estimate_quarter_year(p.name)
            mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
            out.append({"path": p, "date_est": est, "year": y, "quarter": q, "mtime": mtime, "size": p.stat().st_size})
    # Tri descendant par date estimée
    out.sort(key=lambda x: x["date_est"], reverse=True)
    return out


def pdf_to_text(pdf_path: Path) -> str:
    try:
        r = subprocess.run([PDFTOTEXT, "-layout", str(pdf_path), "-"], capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            return ""
        return r.stdout
    except Exception as e:
        log(f"  pdftotext error on {pdf_path}: {e}")
        return ""


PROMPT_DUAL = """Tu es analyste financier senior pour investisseur particulier français.

Tu reçois 2 transcripts d'earnings call CONSÉCUTIFS de la même sté (Q courant + Q-1).

OBJECTIF : produire (a) résumé bullets PV-driven du Q courant, (b) comparaison Q vs Q-1 (suivi de promesses, changements de guidance, sujets nouveaux).

REGLES :
1. Format JSON STRICT, pas de texte libre avant/après.
2. Texte en français. Citations verbatim EN entre guillemets « ... ».
3. Chiffres précis quand dispo (valeur + unité + delta vs Q-1 / YoY).
4. KPI existants à NE PAS DOUBLONNER : {existing_kpis}
5. terms_used = abréviations / acronymes utilisés dans le bullet (YoY, EBITDA, FCF, G-SIB, CET1, NIM, NII, ROTCE, etc.) pour tooltip auto UI.
6. Comparaison Q vs Q-1 = SEULEMENT si elle a une PV concrète. Si rien à dire (ex 2 trimestres similaires), retourner comparison.bullets = [].

=== TRANSCRIPT Q COURANT ({cur_q}/{cur_y}) ===
\"\"\"{cur_text}\"\"\"

=== TRANSCRIPT Q-1 ({prev_q}/{prev_y}) ===
\"\"\"{prev_text}\"\"\"

FORMAT JSON DE SORTIE EXACT :
{{
  "summary": {{
    "tonalite_management": "1 phrase courte du Q courant",
    "sentiment": "bullish | neutral | cautious",
    "bullets": [
      {{"text": "Revenue $50B (+12% YoY), beat consensus +1.5%", "type": "synthesis", "terms_used": ["YoY"]}},
      {{"text": "Marges Services 75% (+200bp YoY)", "type": "driver", "terms_used": ["YoY", "bp"]}}
    ],
    "new_kpis_for_stories": []
  }},
  "comparison": {{
    "prev_quarter": "{prev_label}",
    "bullets": [
      {{"text": "Guidance FY26 relevée de $200B à $210B (vs annonce Q-1)", "type": "guidance_up", "terms_used": []}},
      {{"text": "Promesse Q-1 « lancer 3 nouveaux produits » : 2 lancés sur 3", "type": "promise_kept", "terms_used": []}},
      {{"text": "Nouveau sujet : régulation EU AI Act, exposition à $5B revenus", "type": "new_topic", "terms_used": []}}
    ]
  }}
}}

Types autorisés summary.bullets[].type : synthesis | tonalite | driver | vigilance | guidance | strategy | citation
Types autorisés comparison.bullets[].type : promise_kept | promise_broken | guidance_up | guidance_down | new_topic | sentiment_shift

Réponds UNIQUEMENT le JSON.
"""


def get_existing_kpis(ticker: str) -> str:
    f = V2_PIPELINE / f"{ticker.lower()}.json"
    if not f.exists(): return "(aucun)"
    try:
        d = json.loads(f.read_text())
        kpis = d.get("kpis", [])
        names = [k.get("short", "") for k in kpis if k.get("short")][:15]
        return ", ".join(names) if names else "(aucun)"
    except: return "(aucun)"


def call_groq(prompt: str, key_idx: int = 0, max_retries: int = 4) -> dict:
    for attempt in range(max_retries):
        key = KEYS[(key_idx + attempt) % len(KEYS)]
        try:
            r = requests.post(
                BASE,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 3500,
                    "response_format": {"type": "json_object"},
                },
                timeout=180,
            )
        except Exception as e:
            if attempt == max_retries - 1:
                return {"error": f"request: {e}"}
            time.sleep(5)
            continue
        if r.status_code == 429:
            # parse "try again in Xs" + safety margin
            wait = 35
            m = re.search(r"try again in ([\d.]+)s", r.text)
            if m:
                wait = min(60, int(float(m.group(1))) + 3)
            log(f"      429 rate-limit, sleep {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text[:300]}"}
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except Exception as e:
            return {"error": f"JSON: {e}", "raw": content[:500]}
    return {"error": "max_retries_exhausted"}


def process_ticker(ticker: str) -> dict:
    ticker_dir = IR_SCRAPE / ticker
    transcripts = find_transcripts(ticker_dir)
    if not transcripts:
        return {"ticker": ticker, "status": "no_transcript_recent"}
    cur = transcripts[0]
    prev = transcripts[1] if len(transcripts) > 1 else None
    log(f"  {ticker}: cur={cur['path'].name} (est {cur['date_est'].date()}, Q{cur['quarter']}/{cur['year']}); prev={prev['path'].name if prev else 'NONE'}")

    cur_text = pdf_to_text(cur["path"])[:9000]
    if len(cur_text) < 3000:
        return {"ticker": ticker, "status": "cur_text_too_short", "chars": len(cur_text)}

    prev_text = pdf_to_text(prev["path"])[:6000] if prev else "(transcript Q-1 non disponible)"
    prev_q = prev["quarter"] if prev else 0
    prev_y = prev["year"] if prev else 0
    prev_label = f"T{prev_q} {prev_y}" if prev_q and prev_y else "trimestre précédent"

    existing = get_existing_kpis(ticker)
    prompt = PROMPT_DUAL.format(
        existing_kpis=existing,
        cur_q=cur["quarter"] or "?", cur_y=cur["year"] or "?",
        prev_q=prev_q or "?", prev_y=prev_y or "?",
        prev_label=prev_label,
        cur_text=cur_text,
        prev_text=prev_text,
    )
    t0 = time.time()
    result = call_groq(prompt)
    elapsed = time.time() - t0
    if "error" in result:
        return {"ticker": ticker, "status": "groq_error", "error": result["error"], "elapsed": round(elapsed, 1)}

    cur_q_label = f"T{cur['quarter']} {cur['year']}" if cur['quarter'] and cur['year'] else cur['path'].stem
    payload = {
        "ticker": ticker,
        "quarter": cur_q_label,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": f"ir-scrape:{cur['path'].relative_to(IR_SCRAPE.parent)}",
        "model": MODEL,
        "summary": result.get("summary", {}),
        "comparison": result.get("comparison") if prev else None,
        "_has_prev": prev is not None,
    }
    out_file = OUT_DIR / f"{ticker.lower()}.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    bullets_n = len(payload["summary"].get("bullets", []))
    comp_n = len(payload["comparison"]["bullets"]) if payload.get("comparison") else 0
    return {"ticker": ticker, "status": "ok", "bullets": bullets_n, "comparison_bullets": comp_n, "elapsed": round(elapsed, 1)}


def main():
    limit = None
    for i, a in enumerate(sys.argv):
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    # Find all tickers with ≥1 recent transcript
    candidates = []
    for d in sorted(IR_SCRAPE.iterdir()):
        if not d.is_dir(): continue
        ts = find_transcripts(d)
        if ts:
            candidates.append((d.name, len(ts)))
    log(f"START : {len(candidates)} tickers avec ≥1 transcript récent (<12 mois). Cutoff={CUTOFF.date()}")
    if limit:
        candidates = candidates[:limit]
        log(f"Limited to {len(candidates)}")

    stats = {"ok": 0, "no_transcript_recent": 0, "cur_text_too_short": 0, "groq_error": 0}
    for ticker, n in candidates:
        try:
            r = process_ticker(ticker)
            status = r.get("status", "unknown")
            stats[status] = stats.get(status, 0) + 1
            if status == "ok":
                log(f"  ✅ {ticker}: {r['bullets']} bullets + {r['comparison_bullets']} comparaison ({r['elapsed']}s)")
            else:
                log(f"  ❌ {ticker}: {r}")
        except Exception as e:
            log(f"  💥 {ticker}: exception {e}")
            stats["exception"] = stats.get("exception", 0) + 1
        time.sleep(2.5)  # gentle on Groq TPM 12k free tier

    log(f"END : {stats}")


if __name__ == "__main__":
    main()
