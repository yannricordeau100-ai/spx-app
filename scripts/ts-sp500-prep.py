#!/usr/bin/env python3
"""Prépare l'état du chantier Synthèses Earning Call SP500.

- Liste les stés SP500 sans src/data/transcript-summaries/<t>.json
- Pour chacune, repère le transcript Motley Fool local le plus récent
  (~/Mettrik/docs/<T>/transcript/fool_Q*-YYYY_date.txt)
- Crée src/data/transcripts/<t>.json (TranscriptDoc) si absent, de façon
  déterministe depuis le txt (le bloc UI exige ce fichier pour s'afficher)
- Écrit l'état dans .conv-state/ts-summ-state.json (resume-safe)

Phase 2 (refresh) : marque aussi les stés avec synthèse existante dont le
transcript local est PLUS récent que summary.quarter (status=refresh).
Ne touche à rien d'existant : la génération refresh viendra après les missing.
"""
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = Path("/Users/yann/Mettrik/docs")
TRANS = ROOT / "src/data/transcripts"
SUMM = ROOT / "src/data/transcript-summaries"
STATE = ROOT / ".conv-state/ts-summ-state.json"

FNAME_RE = re.compile(r"fool_Q([1-4])-(20\d\d)_(20\d\d-\d\d-\d\d)\.txt$")

def latest_fool(t: str):
    d = DOCS / t / "transcript"
    if not d.is_dir():
        return None
    best = None
    for f in d.glob("fool_*.txt"):
        m = FNAME_RE.search(f.name)
        if not m:
            continue
        q, y, date = int(m.group(1)), int(m.group(2)), m.group(3)
        key = (date, y, q)
        if best is None or key > best[0]:
            best = (key, f, q, y, date)
    return best and {"path": str(best[1]), "quarter": best[2], "year": best[3], "date": best[4]}

def qkey(quarter_str):
    """'2026Q1' -> (2026,1) pour comparaison."""
    m = re.match(r"(20\d\d)Q([1-4])", quarter_str or "")
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)

def main():
    sp = [t.upper() for t in json.load(open(ROOT / "src/data/sp500-tickers.json"))]
    state = {"generated_at": datetime.now(timezone.utc).isoformat(), "tickers": {}}
    if STATE.exists():
        state = json.load(open(STATE))

    for t in sp:
        cur = state["tickers"].get(t, {})
        if cur.get("status") == "done":
            continue
        low = t.lower()
        summ_file = SUMM / f"{low}.json"
        info = latest_fool(t)
        if summ_file.exists():
            # Phase 2 : refresh seulement si transcript local plus récent
            try:
                existing_q = qkey(json.load(open(summ_file)).get("quarter"))
            except Exception:
                existing_q = (0, 0)
            if info and (info["year"], info["quarter"]) > existing_q:
                state["tickers"][t] = {"status": "refresh", **info,
                                       "existing_quarter": f"{existing_q[0]}Q{existing_q[1]}"}
            else:
                state["tickers"][t] = {"status": "done", "note": "synthese existante a jour"}
            continue
        if not info:
            state["tickers"][t] = {"status": "no_transcript"}
            continue
        # crée le TranscriptDoc si absent (requis par le loader UI)
        doc_file = TRANS / f"{low}.json"
        doc_file_up = TRANS / f"{t}.json"
        if not doc_file.exists() and not doc_file_up.exists():
            content = Path(info["path"]).read_text(errors="replace")
            if len(content) < 3000:
                state["tickers"][t] = {"status": "transcript_court", **info, "chars": len(content)}
                continue
            doc = {"ticker": t, "fetched_at": datetime.now(timezone.utc).isoformat(),
                   "latest": {"quarter": str(info["quarter"]), "year": str(info["year"]),
                              "date": info["date"], "content": content}}
            doc_file.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
        state["tickers"][t] = {"status": "todo", **info}

    json.dump(state, open(STATE, "w"), indent=1)
    counts = {}
    for v in state["tickers"].values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    print(json.dumps(counts, indent=1))
    stale = [t for t, v in state["tickers"].items()
             if v.get("status") == "todo" and v.get("date", "9999") < "2025-07-08"]
    print("transcripts >12 mois:", stale)

if __name__ == "__main__":
    main()
