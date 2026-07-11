#!/usr/bin/env python3
"""Télécharge en live depuis SEC EDGAR le press release earnings le plus
récent (exhibit 99.1 d'un 8-K item 2.02) pour les stés qui n'ont pas de
call Motley Fool exploitable.
"""
import json, re, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
from html import unescape

ROOT = Path("/Users/yann/spx-app")
DOCS = Path("/Users/yann/Mettrik/docs")
TRANS = ROOT / "src/data/transcripts"
STATE = ROOT / ".conv-state/ts-summ-state.json"
UA = "Mettrik AI research yann@ricordeau.local"  # SEC exige un UA identifiant

CIKS = {
    "BF.B": "14693", "BRK.B": "1067983", "CBOE": "1374310", "D": "715957",
    "ED": "1047862", "EXPD": "746515", "FDX": "1048911", "FIX": "1035983",
    "KVUE": "1944048", "L": "60086", "NVR": "906163", "PGR": "80661", "SO": "92122",
}

def curl(url):
    r = subprocess.run(["curl", "-s", "-m", "40", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""

def clean(raw):
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", unescape(t)).strip()

EARN_RE = re.compile(r"(earnings|net income|net sales|quarterly|first quarter|second quarter|third quarter|fourth quarter|revenue|net earned premiums)", re.I)

def find_and_fetch_latest_earnings(t: str):
    cik = CIKS[t].zfill(10)
    sub = curl(f"https://data.sec.gov/submissions/CIK{cik}.json")
    if not sub:
        return None
    try:
        d = json.loads(sub)
    except Exception:
        return None
    recent = d.get("filings", {}).get("recent", {})
    forms = recent.get("form", []); dates = recent.get("filingDate", [])
    accs = recent.get("accessionNumber", []); items = recent.get("items", [])
    primary = recent.get("primaryDocument", [])
    # scan la liste : 8-K récent avec 2.02 en items (ou 8-K contenant EX-99.1)
    for i, form in enumerate(forms):
        if form != "8-K":
            continue
        it = items[i] if i < len(items) else ""
        if "2.02" not in it and dates[i] < "2026-01-01":
            continue
        acc = accs[i].replace("-", "")
        # index de l'accession pour trouver les exhibits
        idx_url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
        idx = curl(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/")
        if not idx:
            time.sleep(0.3); continue
        exs = re.findall(r'href="([^"]+ex99[^"]+\.htm)"', idx, re.I)
        if not exs:
            # fallback : primary doc
            if primary[i].endswith(".htm"):
                exs = [f"/Archives/edgar/data/{int(cik)}/{acc}/{primary[i]}"]
        for path in exs:
            if not path.startswith("http"):
                path = f"https://www.sec.gov{path}" if path.startswith("/") else f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{path}"
            raw = curl(path)
            time.sleep(0.3)
            if not raw: continue
            txt = clean(raw)
            if len(txt) < 5000 or not EARN_RE.search(txt):
                continue
            return {"txt": txt, "date": dates[i], "source": f"sec_edgar_{acc}_{path.split('/')[-1]}"}
        time.sleep(0.3)
    return None

def qtr(iso):
    y, m, _ = iso.split("-")
    return int(y), (int(m) - 1) // 3 + 1

def main():
    state = json.load(open(STATE))
    TARGETS = ["CBOE","D","ED","EXPD","FDX","FIX","L","NVR","PGR","SO","BF.B","BRK.B","KVUE"]
    for t in TARGETS:
        v = state["tickers"].get(t, {})
        # skip si on a déjà un doc récent > 8k avec beaucoup de mots-clés
        cur = TRANS / f"{t.lower()}.json"
        if cur.exists():
            try:
                c = json.load(open(cur))
                if len(c["latest"]["content"]) > 15000 and len(EARN_RE.findall(c["latest"]["content"])) > 10:
                    print(f"KEEP {t} (existant OK, {len(c['latest']['content'])}c)")
                    continue
            except Exception:
                pass
        r = find_and_fetch_latest_earnings(t)
        if not r:
            print(f"FAIL {t}")
            continue
        out = DOCS / t / "transcript" / f"edgar_earnings_{r['date']}.txt"
        out.parent.mkdir(parents=True, exist_ok=True)
        # supprime anciens
        for old in out.parent.glob("edgar_earnings_*.txt"):
            if old != out: old.unlink()
        out.write_text(r["txt"])
        y, q = qtr(r["date"])
        doc = {"ticker": t, "fetched_at": datetime.now(timezone.utc).isoformat(),
               "latest": {"quarter": str(q), "year": str(y), "date": r["date"], "content": r["txt"]},
               "source_type": r["source"]}
        (TRANS / f"{t.lower()}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1))
        v.update({"path": str(out), "date": r["date"], "quarter": q, "year": y,
                  "source_type": r["source"], "status": "todo_fallback"})
        print(f"OK {t} {r['date']} q{q}y{y} len={len(r['txt'])}")
    json.dump(state, open(STATE, "w"), indent=1)

if __name__ == "__main__":
    main()
