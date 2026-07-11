#!/usr/bin/env python3
"""Extrait le meilleur document earnings disponible pour les 13 stés
manquantes du chantier Synthèses Earning Call SP500 :

- BF.B, BRK.B : sources déjà dans data-lake (_srctext_60k / PDF ER)
- CBOE, D, ED, EXPD, FDX, FIX, KVUE, L, NVR, PGR, SO : dernier 8-K du data-lake

Écrit :
- /Users/yann/Mettrik/docs/<T>/transcript/edgar_8k_<date>.txt
- src/data/transcripts/<t>.json (TranscriptDoc)
Met à jour .conv-state/ts-summ-state.json avec status="todo_fallback",
path, date, source_type.
"""
import gzip, json, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from html import unescape

ROOT = Path("/Users/yann/spx-app")
DL = ROOT / "data-lake"
DOCS = Path("/Users/yann/Mettrik/docs")
TRANS = ROOT / "src/data/transcripts"
STATE = ROOT / ".conv-state/ts-summ-state.json"
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

def clean_html(raw):
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", unescape(t)).strip()

def latest_in(dirpath: Path, pattern="*"):
    files = sorted(dirpath.glob(pattern))
    return files[-1] if files else None

def qtr_from_date(iso):
    y, m, _ = iso.split("-")
    q = (int(m) - 1) // 3 + 1
    return int(y), q

def extract_8k(t: str):
    d = DL / t / "8K"
    if not d.exists():
        return None
    fs = sorted(d.glob("*.htm.gz"))
    if not fs:
        return None
    fn = fs[-1].name
    m = re.search(r"_(20\d{2}-\d{2}-\d{2})_", fn)
    if not m:
        return None
    date = m.group(1)
    raw = gzip.decompress(fs[-1].read_bytes()).decode("utf-8", errors="replace")
    txt = clean_html(raw)
    return {"txt": txt, "date": date, "source": f"sec_8k_{fn}"}

def extract_brk_er():
    d = DL / "BRK-B" / "ER"
    fs = sorted(d.glob("BRK-B_*_ER.pdf"))
    if not fs:
        return None
    pdf = fs[-1]
    m = re.search(r"_(20\d{2}-\d{2}-\d{2})_", pdf.name)
    date = m.group(1) if m else "2026-03-31"
    txt_path = pdf.with_suffix(".txt")
    subprocess.run([PDFTOTEXT, "-layout", str(pdf), str(txt_path)], check=False)
    txt = txt_path.read_text(errors="replace") if txt_path.exists() else ""
    return {"txt": txt, "date": date, "source": f"berkshire_er_{pdf.name}"}

def extract_bf_srctext():
    src = DL / "BF.B" / "_srctext_60k.txt"
    if not src.exists():
        return None
    txt = src.read_text(errors="replace")
    # date fiscale FY26 = 2026-04-30 (Q4 FY26)
    return {"txt": txt, "date": "2026-06-04", "source": "sec_ex991_fy26q4_bf"}

def write(t: str, data):
    if not data or len(data["txt"]) < 1500:
        return False, "texte_court"
    outdir = DOCS / t / "transcript"
    outdir.mkdir(parents=True, exist_ok=True)
    out = outdir / f"edgar_earnings_{data['date']}.txt"
    out.write_text(data["txt"])
    y, q = qtr_from_date(data["date"])
    doc = {"ticker": t, "fetched_at": datetime.now(timezone.utc).isoformat(),
           "latest": {"quarter": str(q), "year": str(y), "date": data["date"],
                      "content": data["txt"]},
           "source_type": data["source"]}
    (TRANS / f"{t.lower()}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    return True, str(out)

def main():
    state = json.load(open(STATE))
    handlers = {
        "BF.B": extract_bf_srctext,
        "BRK.B": extract_brk_er,
    }
    for t in ("CBOE","D","ED","EXPD","FDX","FIX","KVUE","L","NVR","PGR","SO"):
        handlers[t] = (lambda tk=t: extract_8k(tk))
    for t, fn in handlers.items():
        data = fn()
        ok, info = write(t, data)
        v = state["tickers"].setdefault(t, {})
        if ok:
            v["status"] = "todo_fallback"
            v["path"] = info
            y, q = qtr_from_date(data["date"])
            v["quarter"] = q; v["year"] = y; v["date"] = data["date"]
            v["source_type"] = data["source"]
            print(f"OK {t} {data['date']} q{q}y{y} -> {info}")
        else:
            v["fallback_fail"] = info
            print(f"FAIL {t} : {info}")
    json.dump(state, open(STATE, "w"), indent=1)

if __name__ == "__main__":
    main()
