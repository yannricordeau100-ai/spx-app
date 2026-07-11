#!/usr/bin/env python3
"""Télécharge UNIQUEMENT le transcript Motley Fool le plus récent par sté SP500
pour le chantier Synthèses Earning Call (state .conv-state/ts-summ-state.json).

- Choisit l'URL la plus récente de l'index (date calendaire dans l'URL).
- Resume-safe : skip si le fichier destination existe.
- Throttle 1.2s, min 3000 chars, log .conv-state/ts-summ-fetch.log
- Met à jour src/data/transcripts/<t>.json si le nouveau transcript est
  plus récent que le doc existant.
"""
import json, re, html as H, time, subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
DOCS = Path("/Users/yann/Mettrik/docs")
STATE = ROOT / ".conv-state/ts-summ-state.json"
INDEX = ROOT / ".conv-state/fool-transcript-index.json"
LOG = ROOT / ".conv-state/ts-summ-fetch.log"
TRANS = ROOT / "src/data/transcripts"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
THROTTLE = 1.2

def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    with open(LOG, "a") as f:
        f.write(line + "\n")
    print(line, flush=True)

def fetch(url, retries=3):
    for i in range(retries):
        r = subprocess.run(["curl", "-s", "-m", "40", "-A", UA, url],
                           capture_output=True, text=True)
        if r.returncode == 0 and len(r.stdout) > 500:
            return r.stdout
        time.sleep(5 * (i + 1))
    return None

BODY_RE = re.compile(r'<div[^>]*class="[^"]*article-body[^"]*"[^>]*>(.*?)</div>\s*<div', re.S)

def extract_text(page):
    m = BODY_RE.search(page)
    raw = m.group(1) if m else page
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = H.unescape(t)
    return re.sub(r"[ \t]+", " ", t).strip()

URL_DATE_RE = re.compile(r"/(20\d\d)/(\d\d)/(\d\d)/")
Q_RE = re.compile(r"Q([1-4])-(20\d\d)")

def best_url(entries):
    """entries: {"Q1-2026": url, ...} -> (quarter, year, date, url) le plus récent."""
    best = None
    for qk, url in entries.items():
        m = URL_DATE_RE.search(url)
        if not m:
            continue
        date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        qm = Q_RE.match(qk)
        if not qm:
            continue
        cand = (date, int(qm.group(1)), int(qm.group(2)), url)
        if best is None or cand[0] > best[0]:
            best = cand
    return best  # (date, q, y, url)

def main():
    state = json.load(open(STATE))
    index = json.load(open(INDEX))
    work = [t for t, v in state["tickers"].items()
            if v.get("status") in ("todo", "refresh", "no_transcript", "transcript_court")]
    log(f"start: {len(work)} stés")
    ok = skip = fail = 0
    for t in sorted(work):
        entries = index.get(t)
        if not entries:
            state["tickers"][t]["fetch"] = "absent_index"
            fail += 1
            continue
        b = best_url(entries)
        if not b:
            state["tickers"][t]["fetch"] = "url_indate_illisible"
            fail += 1
            continue
        date, q, y, url = b
        outdir = DOCS / t / "transcript"
        outdir.mkdir(parents=True, exist_ok=True)
        out = outdir / f"fool_Q{q}-{y}_{date}.txt"
        if out.exists() and out.stat().st_size > 3000:
            skip += 1
        else:
            page = fetch(url)
            time.sleep(THROTTLE)
            if not page:
                state["tickers"][t]["fetch"] = "fetch_fail"
                log(f"FAIL fetch {t}")
                fail += 1
                continue
            txt = extract_text(page)
            if len(txt) < 3000:
                state["tickers"][t]["fetch"] = f"texte_court_{len(txt)}"
                log(f"COURT {t} {len(txt)}c")
                fail += 1
                continue
            out.write_text(txt)
            ok += 1
        # met à jour le state + TranscriptDoc si plus récent
        v = state["tickers"][t]
        v.update({"path": str(out), "quarter": q, "year": y, "date": date, "fetch": "ok"})
        if v["status"] in ("no_transcript", "transcript_court"):
            v["status"] = "todo"
        low = t.lower()
        doc_file = TRANS / f"{low}.json"
        alt = TRANS / f"{t}.json"
        target = alt if alt.exists() and not doc_file.exists() else doc_file
        write_doc = True
        if target.exists():
            try:
                old = json.load(open(target))
                if old.get("latest", {}).get("date", "") >= date:
                    write_doc = False
            except Exception:
                pass
        if write_doc:
            doc = {"ticker": t, "fetched_at": datetime.now(timezone.utc).isoformat(),
                   "latest": {"quarter": str(q), "year": str(y), "date": date,
                              "content": out.read_text(errors="replace")}}
            target.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
        if (ok + skip + fail) % 25 == 0:
            json.dump(state, open(STATE, "w"), indent=1)
            log(f"progress ok={ok} skip={skip} fail={fail}")
    json.dump(state, open(STATE, "w"), indent=1)
    log(f"FIN ok={ok} skip={skip} fail={fail}")

if __name__ == "__main__":
    main()
