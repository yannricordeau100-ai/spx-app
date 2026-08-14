#!/usr/bin/env python3
"""
audit-ceo-vs-8k.py — détecte les fiches dont `governance.ceo_name` ne
correspond plus au dernier changement de dirigeant annoncé dans un 8-K
Item 5.02 présent dans `data-lake/<TICKER>/8K/`.

Déclencheur : CSX affichait Joseph Hinrichs alors que le 8-K du 29 sept.
2025 nomme Stephen Angel. Règle d'or Mettrik : une sté citée = bug
potentiellement systémique → on audite tout l'univers V1.9.5.

Sortie : src/data/v1-9-5-ceo-vs-8k-audit.json
  - stale     : le CEO stocké est explicitement celui qui PART dans le 8-K
                (signal fort, quasi zéro faux positif)
  - suspect   : un 8-K nomme un CEO dont le nom ne matche pas le stocké
                (signal moyen, à relire à la main)
  - ok        : concordance ou aucun 8-K de transition CEO

Usage :
  python3 scripts/audit-ceo-vs-8k.py [--since 2024-01-01] [--tickers CSX,UNP]
"""
from __future__ import annotations

import argparse
import glob
import gzip
import html
import json
import os
import re
import sys
import unicodedata
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERSE = os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")
OUT = os.path.join(ROOT, "src/data/v1-9-5-ceo-vs-8k-audit.json")

# Prénoms + initiales ("Joseph R. Hinrichs", "Lip-Bu Tan", "A. Scott Davis")
NAME = r"(?:[A-Z][A-Za-z'’\-]*\.?\s+){1,3}[A-Z][A-Za-z'’\-]+"

# "X est nommé CEO"
APPOINT_PATTERNS = [
    re.compile(r"appointed\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.)?\s*(" + NAME + r")[^.]{0,160}?Chief Executive Officer"),
    re.compile(r"named\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.)?\s*(" + NAME + r")[^.]{0,160}?Chief Executive Officer"),
    re.compile(r"elected\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.)?\s*(" + NAME + r")[^.]{0,160}?Chief Executive Officer"),
    re.compile(r"(" + NAME + r")\s+(?:has been|was|will be|would be)\s+(?:appointed|named|elected|promoted)[^.]{0,160}?Chief Executive Officer"),
    re.compile(r"(" + NAME + r")\s+(?:will|shall)\s+(?:become|serve as|assume the role of)[^.]{0,120}?Chief Executive Officer"),
    re.compile(r"(" + NAME + r")\s+as\s+(?:its\s+|the\s+|our\s+)?(?:new\s+)?(?:President and\s+)?(?:Chief Executive Officer|CEO)\b"),
]

# "X succède à Y" / "Y quitte ses fonctions de CEO" → Y = sortant
OUTGOING_PATTERNS = [
    re.compile(r"succeed(?:s|ing|ed)?\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.)?\s*(" + NAME + r")"),
    re.compile(r"(" + NAME + r")[^.]{0,200}?(?:separated from (?:his|her) employment|stepped down|will step down|resigned|retire[sd]?|will retire|departure)[^.]{0,160}?(?:Chief Executive Officer|CEO)\b"),
    re.compile(r"(?:resignation|retirement|departure|separation)\s+of\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.)?\s*(" + NAME + r")"),
]

# Faux positifs fréquents (entités, titres, boilerplate)
STOP_TOKENS = {
    "the", "company", "board", "directors", "committee", "corporation", "inc",
    "llc", "plc", "securities", "exchange", "commission", "act", "form",
    "current", "report", "item", "chief", "executive", "officer", "president",
    "annual", "meeting", "common", "stock", "class", "series", "united",
    "states", "washington", "york", "street", "trading", "symbol", "name",
    "each", "title", "registrant", "emerging", "growth", "general",
    "instruction", "exhibit", "press", "release", "regulation", "financial",
    "statements", "business", "employment", "agreement", "plan", "compensation",
    "december", "january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "effective", "pursuant",
}

TAG_RE = re.compile(r"<[^>]*>")
WS_RE = re.compile(r"\s+")
DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_name(s: str) -> str:
    s = strip_accents(s).lower()
    s = re.sub(r"\b(mr|ms|mrs|dr|jr|sr|iii|ii|iv)\b\.?", " ", s)
    s = re.sub(r"[^a-z ]", " ", s)
    return WS_RE.sub(" ", s).strip()


def last_name(s: str) -> str:
    parts = norm_name(s).split()
    return parts[-1] if parts else ""


def plausible_person(s: str) -> bool:
    toks = norm_name(s).split()
    if any(t in STOP_TOKENS for t in toks):
        return False
    # les initiales ("R." dans "Joseph R. Hinrichs") ne comptent pas comme mot
    words = [t for t in toks if len(t) > 1]
    return 2 <= len(words) <= 4


# Si l'un de ces titres s'intercale entre le nom et "Chief Executive Officer",
# la nomination concerne un autre poste (président du conseil, CFO, COO…).
OTHER_ROLE_RE = re.compile(
    r"Chairman|Chief Financial Officer|Chief Operating Officer|Chief Accounting|"
    r"Chief Legal|Chief Human|Chief Commercial|Chief Technology|Chief Digital|"
    r"General Counsel|Lead Independent|as a director|as director|to the Board",
    re.I,
)


def extract_new_ceo(win: str) -> str | None:
    """Nom du dirigeant nommé CEO dans cette fenêtre Item 5.02, sinon None."""
    for pat in APPOINT_PATTERNS:
        for m in pat.finditer(win):
            cand = m.group(1).strip()
            if not plausible_person(cand):
                continue
            # texte entre le nom et la mention "Chief Executive Officer"
            seg = win[m.end(1): m.end()]
            head = seg[: seg.lower().find("chief executive officer")] if "chief executive officer" in seg.lower() else seg
            if OTHER_ROLE_RE.search(head):
                continue
            return cand
    return None


def read_filing(path: str) -> str:
    try:
        with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as fh:
            raw = fh.read()
    except OSError:
        return ""
    txt = html.unescape(TAG_RE.sub(" ", raw))
    return WS_RE.sub(" ", txt)


def item502_windows(txt: str) -> list[str]:
    """Fenêtres de texte qui suivent chaque 'Item 5.02'."""
    out = []
    for m in re.finditer(r"Item\s*5\.0?2", txt, re.I):
        out.append(txt[m.start(): m.start() + 8000])
    return out


def stored_ceo(ticker: str) -> tuple[str, dict]:
    """CEO tel qu'affiché : v2-pipeline + fallbacks enrich (même ordre que le loader)."""
    meta: dict = {}
    base = os.path.join(ROOT, "src/data/v2-pipeline", f"{ticker.lower()}.json")
    gov = {}
    try:
        with open(base, encoding="utf-8") as fh:
            gov = (json.load(fh) or {}).get("governance") or {}
    except (OSError, json.JSONDecodeError):
        gov = {}
    name = (gov.get("ceo_current") or gov.get("ceo_name") or "").strip()
    meta["fiscal_year"] = gov.get("fiscal_year")
    meta["agm_date"] = gov.get("agm_date")
    if not name:
        enr = os.path.join(ROOT, "src/data/v2-pipeline-enrich", f"{ticker.lower()}.json")
        try:
            with open(enr, encoding="utf-8") as fh:
                e = json.load(fh) or {}
            name = ((e.get("overrides_governance") or {}).get("ceo_name") or "").strip()
            if not name:
                name = ((e.get("governance") or {}).get("ceo_name") or "").strip()
        except (OSError, json.JSONDecodeError):
            pass
    return name, meta


def audit_ticker(ticker: str, since: str) -> dict:
    name, meta = stored_ceo(ticker)
    res = {
        "ticker": ticker,
        "stored_ceo": name,
        "fiscal_year": meta.get("fiscal_year"),
        "status": "ok",
        "evidence": [],
    }
    files = sorted(glob.glob(os.path.join(ROOT, "data-lake", ticker, "8K", "*.gz")))
    files = [f for f in files if (DATE_RE.search(os.path.basename(f)) or [""]) and
             (DATE_RE.search(os.path.basename(f)).group(1) >= since if DATE_RE.search(os.path.basename(f)) else False)]
    if not name:
        res["status"] = "no_ceo_stored"
    if not files:
        return res

    stored_last = last_name(name)
    appointments: list[dict] = []  # {date, new_ceo, outgoing, file}
    for f in files:
        fdate = DATE_RE.search(os.path.basename(f)).group(1)
        txt = read_filing(f)
        if not txt or "Chief Executive Officer" not in txt:
            continue
        for win in item502_windows(txt):
            if "Chief Executive Officer" not in win:
                continue
            new_ceo = extract_new_ceo(win)
            outgoing = []
            for pat in OUTGOING_PATTERNS:
                for m in pat.finditer(win):
                    cand = m.group(1).strip()
                    if plausible_person(cand):
                        outgoing.append(cand)
            if new_ceo or outgoing:
                appointments.append({
                    "date": fdate,
                    "new_ceo": new_ceo,
                    "outgoing": outgoing[:3],
                    "file": os.path.relpath(f, ROOT),
                })
    if not appointments:
        return res

    appointments.sort(key=lambda a: a["date"])
    res["evidence"] = appointments[-4:]

    # 1) signal fort : le CEO stocké est nommé comme sortant
    for a in appointments:
        if stored_last and any(last_name(o) == stored_last for o in a["outgoing"]):
            res["status"] = "stale"
            res["8k_date"] = a["date"]
            res["8k_new_ceo"] = a["new_ceo"]
            res["8k_file"] = a["file"]
    if res["status"] == "stale":
        return res

    # 2) signal moyen : dernière nomination CEO ≠ nom stocké.
    #    Ignoré si le 8-K est ANTÉRIEUR au proxy qui a fourni la donnée
    #    stockée (notre data est alors plus récente que le filing).
    ref_date = ""
    agm = meta.get("agm_date")
    if isinstance(agm, str) and DATE_RE.match(agm.strip()):
        ref_date = agm.strip()
    else:
        # fiscal_year peut être 2025, "2025" ou "exercice 2025"
        fy = re.search(r"(19|20)\d{2}", str(meta.get("fiscal_year") or ""))
        if fy:
            ref_date = f"{int(fy.group(0)) + 1}-03-31"
    latest_named = [a for a in appointments if a["new_ceo"]]
    if ref_date:
        latest_named = [a for a in latest_named if a["date"] >= ref_date]
    if latest_named:
        a = latest_named[-1]
        if stored_last and last_name(a["new_ceo"]) != stored_last:
            res["status"] = "suspect"
            res["8k_date"] = a["date"]
            res["8k_new_ceo"] = a["new_ceo"]
            res["8k_file"] = a["file"]
        elif not stored_last:
            res["status"] = "no_ceo_stored"
            res["8k_new_ceo"] = a["new_ceo"]
            res["8k_date"] = a["date"]
    return res


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2024-01-01", help="ignore les 8-K antérieurs")
    ap.add_argument("--tickers", default="", help="liste CSV pour un run ciblé")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    else:
        with open(UNIVERSE, encoding="utf-8") as fh:
            tickers = json.load(fh)["tickers"]

    rows = []
    for i, t in enumerate(tickers, 1):
        rows.append(audit_ticker(t, args.since))
        if i % 50 == 0:
            print(f"  {i}/{len(tickers)}", file=sys.stderr, flush=True)

    buckets: dict[str, list] = {}
    for r in rows:
        buckets.setdefault(r["status"], []).append(r)

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "universe": "v1-9-5-clean-all-tickers",
        "since": args.since,
        "counts": {k: len(v) for k, v in sorted(buckets.items())},
        "stale": buckets.get("stale", []),
        "suspect": buckets.get("suspect", []),
        "no_ceo_stored": buckets.get("no_ceo_stored", []),
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print(json.dumps(payload["counts"], indent=1))
    print(f"→ {os.path.relpath(args.out, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
