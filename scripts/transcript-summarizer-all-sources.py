#!/usr/bin/env python3
"""
Pipeline consolidé : multi-sources (ir-scrape PDF + FMP json + EU scrape json + Desktop PDF).
Génère bullets + comparaison Q vs Q-1 via Groq Llama 3.3 70B.

Cutoff : transcripts <12 mois.
Output : src/data/transcript-summaries/<ticker>.json
"""
import json, os, re, subprocess, sys, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
IR_SCRAPE = Path("/Users/yann/Mettrik/sec-data/ir-scrape")
FMP_DIR = ROOT / "src/data/transcripts"
EU_DIR = ROOT / "src/data/transcripts-ir"
DESKTOP_ROOT = Path("/Users/yann/Desktop/Projets 2025 26/App KPI/DATA")
OUT_DIR = ROOT / "src/data/transcript-summaries"
OUT_DIR.mkdir(parents=True, exist_ok=True)
V2_PIPELINE = ROOT / "src/data/v2-pipeline"
LOG_PATH = ROOT / "_bulk-transcripts-all.log"
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

CUTOFF = datetime.now(timezone.utc) - timedelta(days=365)

KEYS = [l.split("=", 1)[1].strip() for l in ENV_PATH.read_text().splitlines() if l.startswith("GROQ_API_KEY=")]
if not KEYS: sys.exit("[fatal] no GROQ_API_KEY")
BASE = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def log(msg):
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a") as f: f.write(line + "\n")


def est_date(name: str) -> datetime:
    n = name.lower()
    m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", n)
    if m:
        try: return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except: pass
    m = re.search(r"(\d)[ -_]?q[ -_]?(\d{2,4})", n)
    if m:
        y = int(m.group(2)); q = int(m.group(1))
        if y < 100: y += 2000
        return datetime(y, q*3, 28, tzinfo=timezone.utc)
    m = re.search(r"q[ -_]?(\d)[ -_]?(20\d{2})", n)
    if m:
        return datetime(int(m.group(2)), int(m.group(1))*3, 28, tzinfo=timezone.utc)
    m = re.search(r"(20\d{2})", n)
    if m: return datetime(int(m.group(1)), 12, 31, tzinfo=timezone.utc)
    return datetime(2000, 1, 1, tzinfo=timezone.utc)


def est_qy(name: str):
    n = name.lower()
    m = re.search(r"(\d)[ -_]?q[ -_]?(\d{2,4})", n)
    if m:
        q = int(m.group(1)); y = int(m.group(2))
        if y < 100: y += 2000
        if 1 <= q <= 4 and 2000 < y < 2100: return (y, q)
    m = re.search(r"q[ -_]?(\d)[ -_]?(20\d{2})", n)
    if m: return (int(m.group(2)), int(m.group(1)))
    return (None, None)


def pdf_to_text(pdf_path: Path) -> str:
    try:
        r = subprocess.run([PDFTOTEXT, "-layout", str(pdf_path), "-"], capture_output=True, text=True, timeout=60)
        return r.stdout if r.returncode == 0 else ""
    except: return ""


def gather_sources(ticker: str) -> list[dict]:
    """Retourne liste de {date, year, quarter, text, source} pour cette sté, tri date desc."""
    out = []
    tup = ticker.upper()
    tlow = ticker.lower()

    # 1. ir-scrape PDFs
    d = IR_SCRAPE / tup
    if d.exists():
        for sub in ("transcript", "results"):
            p = d / sub
            if not p.exists(): continue
            for f in p.iterdir():
                if not f.is_file() or f.suffix.lower() != ".pdf": continue
                n = f.name.lower()
                if sub == "results" and not ("transcript" in n or "earnings-call" in n or "earnings_call" in n):
                    continue
                dt = est_date(f.name)
                if dt < CUTOFF: continue
                y, q = est_qy(f.name)
                out.append({"date": dt, "year": y, "quarter": q, "_pdf": f, "_loaded": False, "source": f"ir-scrape/{tup}/{sub}/{f.name}"})

    # 2. FMP json
    fmp_file = FMP_DIR / f"{tlow}.json"
    if fmp_file.exists():
        try:
            jd = json.loads(fmp_file.read_text())
            latest = jd.get("latest", {})
            content = latest.get("content", "")
            date_str = latest.get("date", "")
            if content and len(content) > 3000 and date_str:
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                    if dt >= CUTOFF:
                        out.append({"date": dt, "year": latest.get("year"), "quarter": latest.get("quarter"),
                                    "text": content, "_loaded": True, "source": f"fmp:{fmp_file.name}"})
                except: pass
        except: pass

    # 3. EU scrape json (excerpts only, often short)
    eu_file = EU_DIR / f"{tup.lower().replace('.','_')}.json"
    if eu_file.exists():
        try:
            jd = json.loads(eu_file.read_text())
            for t in jd.get("transcripts", []):
                ex = t.get("content_excerpt", "")
                url = (t.get("source_url") or "").lower()
                if ex and len(ex) > 500 and est_date(url) >= CUTOFF:
                    out.append({"date": est_date(url), "year": None, "quarter": None,
                                "text": ex, "_loaded": True, "source": f"eu-scrape:{t.get('source_url','')}"})
        except: pass

    # 4. Desktop V3 scraper
    desk_dir = DESKTOP_ROOT / tup / "transcripts"
    if desk_dir.exists():
        for year_dir in desk_dir.iterdir():
            if not year_dir.is_dir(): continue
            try: yr = int(year_dir.name)
            except: continue
            if yr < (datetime.now(timezone.utc).year - 1): continue
            for f in year_dir.iterdir():
                if f.suffix.lower() != ".pdf": continue
                dt = est_date(year_dir.name + "-12-31")
                y, q = est_qy(f.name)
                out.append({"date": dt, "year": y, "quarter": q, "_pdf": f, "_loaded": False, "source": f"desktop:{f.name}"})

    # Tri desc par date
    out.sort(key=lambda x: x["date"], reverse=True)
    return out


def load_text(item: dict) -> str:
    if item.get("_loaded"): return item.get("text", "")
    pdf = item.get("_pdf")
    if pdf: return pdf_to_text(pdf)
    return ""


PROMPT_DUAL = """Tu es analyste financier senior pour investisseur particulier français.

Tu reçois 2 transcripts d'earnings call CONSÉCUTIFS de la même sté (Q courant + Q-1).

OBJECTIF : (a) résumé bullets PV-driven du Q courant, (b) comparaison Q vs Q-1 (suivi promesses, changements guidance, sujets nouveaux).

REGLES :
1. JSON STRICT. Pas de texte libre.
2. Français. Citations EN entre « ... ».
3. Chiffres précis (valeur + unité + delta).
4. KPI existants à NE PAS DOUBLONNER : {existing_kpis}
5. terms_used = acronymes (YoY, EBITDA, FCF, G-SIB, CET1, NIM, NII, ROTCE, etc.) pour tooltip auto.
6. Comparaison = SEULEMENT si PV concrète. Sinon comparison.bullets = [].

=== TRANSCRIPT Q COURANT ({cur_q}/{cur_y}) ===
{cur_text}

=== TRANSCRIPT Q-1 ({prev_q}/{prev_y}) ===
{prev_text}

FORMAT JSON :
{{
  "summary": {{
    "tonalite_management": "1 phrase",
    "sentiment": "bullish | neutral | cautious",
    "bullets": [
      {{"text": "...", "type": "synthesis", "terms_used": []}}
    ],
    "new_kpis_for_stories": []
  }},
  "comparison": {{
    "prev_quarter": "{prev_label}",
    "bullets": [
      {{"text": "...", "type": "guidance_up", "terms_used": []}}
    ]
  }}
}}

Types summary : synthesis | tonalite | driver | vigilance | guidance | strategy | citation
Types comparison : promise_kept | promise_broken | guidance_up | guidance_down | new_topic | sentiment_shift

JSON only.
"""

PROMPT_SINGLE = """Tu es analyste financier senior pour investisseur particulier français.

Tu reçois 1 transcript d'earnings call. Génère résumé bullets PV-driven (Q courant uniquement, pas de Q-1 dispo).

REGLES :
1. JSON STRICT.
2. Français. Citations EN entre « ... ».
3. Chiffres précis (valeur + unité + delta vs YoY).
4. KPI existants à NE PAS DOUBLONNER : {existing_kpis}
5. terms_used = acronymes pour tooltip.

=== TRANSCRIPT Q ({cur_q}/{cur_y}) ===
{cur_text}

FORMAT JSON :
{{
  "summary": {{
    "tonalite_management": "1 phrase",
    "sentiment": "bullish | neutral | cautious",
    "bullets": [{{"text": "...", "type": "synthesis", "terms_used": []}}],
    "new_kpis_for_stories": []
  }}
}}

Types : synthesis | tonalite | driver | vigilance | guidance | strategy | citation

JSON only.
"""


def get_existing_kpis(ticker: str) -> str:
    f = V2_PIPELINE / f"{ticker.lower()}.json"
    if not f.exists(): return "(aucun)"
    try:
        d = json.loads(f.read_text())
        names = [k.get("short", "") for k in d.get("kpis", []) if k.get("short")][:15]
        return ", ".join(names) if names else "(aucun)"
    except: return "(aucun)"


def call_groq(prompt: str, key_idx=0, max_retries=4) -> dict:
    for attempt in range(max_retries):
        key = KEYS[(key_idx + attempt) % len(KEYS)]
        try:
            r = requests.post(BASE,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": MODEL, "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.2, "max_tokens": 3500, "response_format": {"type": "json_object"}},
                timeout=180)
        except Exception as e:
            if attempt == max_retries - 1: return {"error": f"request: {e}"}
            time.sleep(5); continue
        if r.status_code == 429:
            wait = 35
            m = re.search(r"try again in ([\d.]+)s", r.text)
            if m: wait = min(60, int(float(m.group(1))) + 3)
            log(f"      429, sleep {wait}s")
            time.sleep(wait); continue
        if r.status_code != 200: return {"error": f"HTTP {r.status_code}: {r.text[:200]}"}
        try: return json.loads(r.json()["choices"][0]["message"]["content"])
        except Exception as e: return {"error": f"JSON: {e}"}
    return {"error": "max_retries"}


def process_ticker(ticker: str) -> dict:
    items = gather_sources(ticker)
    if not items: return {"ticker": ticker, "status": "no_source"}
    cur = items[0]
    prev = items[1] if len(items) > 1 else None
    log(f"  {ticker}: cur={cur['source']} (date {cur['date'].date()}); prev={prev['source'] if prev else 'NONE'}")

    cur_text = load_text(cur)[:9000]
    if len(cur_text) < 2500:
        return {"ticker": ticker, "status": "cur_too_short", "chars": len(cur_text)}

    existing = get_existing_kpis(ticker)
    if prev:
        prev_text = load_text(prev)[:6000]
        if len(prev_text) < 1500: prev = None  # fallback single

    t0 = time.time()
    if prev:
        prev_q = prev["quarter"] or 0; prev_y = prev["year"] or 0
        prev_label = f"T{prev_q} {prev_y}" if prev_q and prev_y else prev["date"].strftime("T? %Y")
        prompt = PROMPT_DUAL.format(
            existing_kpis=existing,
            cur_q=cur["quarter"] or "?", cur_y=cur["year"] or cur["date"].year,
            prev_q=prev_q or "?", prev_y=prev_y or prev["date"].year,
            prev_label=prev_label, cur_text=cur_text, prev_text=prev_text)
    else:
        prompt = PROMPT_SINGLE.format(
            existing_kpis=existing,
            cur_q=cur["quarter"] or "?", cur_y=cur["year"] or cur["date"].year,
            cur_text=cur_text)
    result = call_groq(prompt)
    elapsed = time.time() - t0
    if "error" in result: return {"ticker": ticker, "status": "groq_error", "error": result["error"], "elapsed": round(elapsed, 1)}

    cur_q_label = f"T{cur['quarter']} {cur['year']}" if cur.get("quarter") and cur.get("year") else cur["date"].strftime("%b %Y")
    payload = {
        "ticker": ticker.upper(),
        "quarter": cur_q_label,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": cur["source"],
        "model": MODEL,
        "summary": result.get("summary", {}),
        "comparison": result.get("comparison") if prev else None,
        "_has_prev": prev is not None,
    }
    out_file = OUT_DIR / f"{ticker.lower()}.json"
    out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    b = len(payload["summary"].get("bullets", []))
    c = len(payload["comparison"]["bullets"]) if payload.get("comparison") else 0
    return {"ticker": ticker, "status": "ok", "bullets": b, "comparison_bullets": c, "elapsed": round(elapsed, 1)}


def main():
    limit = None
    for i, a in enumerate(sys.argv):
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    # Build union of all tickers with ≥1 recent source
    candidates = set()
    if IR_SCRAPE.exists():
        for d in IR_SCRAPE.iterdir():
            if d.is_dir() and gather_sources(d.name):
                candidates.add(d.name.upper())
    for f in FMP_DIR.iterdir():
        if f.name.endswith(".json") and gather_sources(f.stem):
            candidates.add(f.stem.upper())
    for f in EU_DIR.iterdir():
        if f.name.endswith(".json"):
            tk = f.stem.replace("_", ".")
            if gather_sources(tk): candidates.add(tk.upper())
    if DESKTOP_ROOT.exists():
        for d in DESKTOP_ROOT.iterdir():
            if d.is_dir() and gather_sources(d.name):
                candidates.add(d.name.upper())

    # Priorité : top 307 d'abord
    try:
        top307 = set(json.load(open(ROOT/'src/data/v1-8-tickers-sorted.json'))[:307])
    except: top307 = set()
    sorted_cands = sorted(candidates, key=lambda t: (0 if t in top307 else 1, t))
    log(f"START : {len(sorted_cands)} stés uniques (top 307 d'abord). Cutoff={CUTOFF.date()}")
    if limit: sorted_cands = sorted_cands[:limit]

    stats = {}
    for tk in sorted_cands:
        try:
            r = process_ticker(tk)
            st = r.get("status")
            stats[st] = stats.get(st, 0) + 1
            if st == "ok":
                log(f"  ✅ {tk}: {r['bullets']}b + {r['comparison_bullets']}c ({r['elapsed']}s)")
            else:
                log(f"  ❌ {tk}: {r}")
        except Exception as e:
            log(f"  💥 {tk}: {e}")
            stats["exc"] = stats.get("exc", 0) + 1
        time.sleep(6)  # Groq TPM 12k free tier : limite réelle ~1 call / 6-8s
    log(f"END : {stats}")


if __name__ == "__main__":
    main()
