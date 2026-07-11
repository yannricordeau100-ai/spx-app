#!/usr/bin/env python3
"""Améliore l'extraction : cherche dans les 8-K de la sté le plus récent qui
contient un vrai earnings release (mots-clés + longueur), pas juste un header.
"""
import gzip, json, re
from datetime import datetime, timezone
from pathlib import Path
from html import unescape

ROOT = Path("/Users/yann/spx-app")
DL = ROOT / "data-lake"
DOCS = Path("/Users/yann/Mettrik/docs")
TRANS = ROOT / "src/data/transcripts"
STATE = ROOT / ".conv-state/ts-summ-state.json"

def clean(raw):
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", unescape(t)).strip()

EARN_RE = re.compile(r"(earnings release|financial results|first quarter|second quarter|third quarter|fourth quarter|quarterly report|net income|net sales|net earned premiums)", re.I)

def score(txt):
    return len(EARN_RE.findall(txt)) * 500 + len(txt)

def find_best_8k(ticker: str, cutoff="2025-10-01"):
    d = DL / ticker / "8K"
    if not d.exists():
        return None
    fs = sorted(d.glob("*.htm.gz"), reverse=True)
    best = None
    for f in fs:
        m = re.search(r"_(20\d{2}-\d{2}-\d{2})_", f.name)
        if not m or m.group(1) < cutoff:
            break
        raw = gzip.decompress(f.read_bytes()).decode("utf-8", errors="replace")
        txt = clean(raw)
        if len(txt) < 8000:
            continue
        if not EARN_RE.search(txt):
            continue
        cand = (score(txt), m.group(1), f.name, txt)
        if best is None or cand > best:
            best = cand
    return best

def qtr(iso):
    y, m, _ = iso.split("-")
    return int(y), (int(m) - 1) // 3 + 1

def write_doc(t, date, txt, src):
    out = DOCS / t / "transcript" / f"edgar_earnings_{date}.txt"
    out.write_text(txt)
    y, q = qtr(date)
    doc = {"ticker": t, "fetched_at": datetime.now(timezone.utc).isoformat(),
           "latest": {"quarter": str(q), "year": str(y), "date": date, "content": txt},
           "source_type": src}
    (TRANS / f"{t.lower()}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    return str(out), y, q

def main():
    state = json.load(open(STATE))
    # sté à re-checker (celles avec 8K courts sur la première passe)
    TARGETS = ["CBOE","D","ED","FDX","FIX","KVUE","L","NVR","PGR","SO"]
    for t in TARGETS:
        best = find_best_8k(t)
        if not best:
            print(f"FAIL {t} : aucun 8-K earnings récent")
            continue
        _, date, fname, txt = best
        # remplace le txt existant s'il est plus long / plus pertinent
        cur = None
        try:
            cur = json.load(open(TRANS / f"{t.lower()}.json"))
        except Exception:
            pass
        if cur and score(cur["latest"]["content"]) > best[0]:
            print(f"KEEP {t} (courant meilleur)")
            continue
        # supprime l'ancien txt
        for old in (DOCS / t / "transcript").glob("edgar_earnings_*.txt"):
            old.unlink()
        path, y, q = write_doc(t, date, txt, f"sec_8k_{fname}")
        v = state["tickers"][t]
        v.update({"path": path, "date": date, "quarter": q, "year": y,
                  "source_type": f"sec_8k_{fname}", "status": "todo_fallback"})
        print(f"OK {t} {date} q{q}y{y} score={best[0]} len={len(txt)}")
    json.dump(state, open(STATE, "w"), indent=1)

if __name__ == "__main__":
    main()
