#!/usr/bin/env python3
"""
scripts/daily-doc-watcher.py

Veille documentaire quotidienne des stés clean_all V1.9.5.

Workflow (Yann 27 mai 2026) :
1. Lire l'univers V1.9.5 clean_all depuis
   src/data/v1-9-pre-publication-audit.json (filtre is_clean_all=true).
2. Pour chaque ticker, via yfinance gratuit :
   - Récupérer next_earnings_date (via Ticker.calendar).
   - Récupérer la date du dernier filing (via Ticker.info, fallback EDGAR).
3. Flagger :
   - "earning_pending_unresolved" si next_earnings_date < today MAIS pas
     de nouveau filing < 90j.
   - "docs_stale" si dernier filing > 90j.
4. Pour stés US flaggées : télécharger 10-Q/10-K/8-K récents non en cache
   via SEC EDGAR submissions API.
5. Pour stés FPI ADR flaggées : 20-F / 6-K idem.
6. Pour stés EU pures flaggées : tentative IR page scrape via website
   yfinance + pattern PDF annual/half-year.
7. Met à jour src/data/_daily-doc-watcher-status.json.
8. Écrit un récap dans .conv-state/inbox/CONV-CONCEPTS/.

ZÉRO API Anthropic payant (RULES-GOLDEN §0bis). Pas de LLM, pas de fallback
qui appellerait api.anthropic.com.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import gzip
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse

PROJECT_ROOT = Path("/Users/yann/spx-app")
AUDIT_PATH = PROJECT_ROOT / "src/data/v1-9-pre-publication-audit.json"
STATUS_PATH = PROJECT_ROOT / "src/data/_daily-doc-watcher-status.json"
SEC_DATA_DIR = PROJECT_ROOT / "sec-data"
INBOX_DIR = PROJECT_ROOT / ".conv-state/inbox/CONV-CONCEPTS"
LOG_PREFIX = "[daily-doc-watcher]"

STALE_THRESHOLD_DAYS = 90
EARNING_TOLERANCE_DAYS = 7  # next_earnings_date passé il y a > 7j → flag pending_unresolved
MAX_TICKERS_PER_RUN = int(os.environ.get("DAILY_DOC_WATCHER_MAX", "660"))

USER_AGENT = "Mettrik-AI-Daily-Doc-Watcher yann@mettrik.ai"


def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def load_clean_all_tickers() -> list[dict]:
    """Lit l'audit V1.9 et retourne la liste des stés is_clean_all=True."""
    if not AUDIT_PATH.exists():
        log(f"FATAL: audit file not found at {AUDIT_PATH}")
        return []
    with open(AUDIT_PATH, "r", encoding="utf8") as f:
        data = json.load(f)
    audits = data.get("audits") or []
    clean = [
        {"ticker": a["ticker"], "market_cap_usd": a.get("market_cap_usd")}
        for a in audits
        if a.get("is_clean_all") is True
    ]
    clean.sort(key=lambda x: (x.get("market_cap_usd") or 0), reverse=True)
    return clean


def is_us_ticker(t: str) -> bool:
    """Heuristique : ticker US = sans suffixe place boursière."""
    return "." not in t and not t.endswith("F")  # foreign ADR pinks finissent souvent par F


def is_fpi_adr(t: str) -> bool:
    """ADR foreign-private-issuer : sans "." mais avec un suffixe ADR connu OU dans cat2."""
    cat2_dir = SEC_DATA_DIR / "cat2-foreign-adr"
    if not cat2_dir.exists():
        return False
    return (cat2_dir / "20F").exists() and any(
        (cat2_dir / "20F" / y / f"{t}_*.htm.gz").parent.exists()
        for y in ["2024", "2025", "2026"]
    )


def get_last_filing_date_local(ticker: str) -> datetime | None:
    """Cherche la date du dernier filing local dans sec-data."""
    candidates: list[datetime] = []
    for sub in ["cat1-us/10K", "cat1-us/10Q", "cat1-us/8K", "cat2-foreign-adr/20F", "cat2-foreign-adr/6K"]:
        base = SEC_DATA_DIR / sub
        if not base.exists():
            continue
        for year_dir in base.iterdir():
            if not year_dir.is_dir():
                continue
            pattern = re.compile(rf"^{re.escape(ticker)}_(\d{{4}}-\d{{2}}-\d{{2}})\.htm\.gz$", re.IGNORECASE)
            for f in year_dir.iterdir():
                m = pattern.match(f.name)
                if m:
                    try:
                        candidates.append(datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc))
                    except ValueError:
                        pass
    # cat3 european annual-text
    eu_dir = SEC_DATA_DIR / "cat3-european" / ticker
    if eu_dir.exists():
        for sub in ["annual-text", "annual-report", "half-year", "ad-hoc"]:
            sd = eu_dir / sub
            if not sd.exists():
                continue
            for f in sd.iterdir():
                if f.is_file():
                    # Le nom du fichier contient parfois l'année, sinon mtime.
                    try:
                        mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
                        candidates.append(mtime)
                    except OSError:
                        pass
    # Fix 9 aout 2026 : la chaine 2026 telecharge dans data-lake/<T>/..., pas
    # dans sec-data/. Sans ce bloc, 569 stes ressortaient "docs_stale" a tort.
    dl_dir = PROJECT_ROOT / "data-lake" / ticker
    if dl_dir.exists():
        date_pat = re.compile(r"(\d{4}-\d{2}-\d{2})")
        for sub in ["10K", "10Q", "8K", "20F", "6K", "40F", "DEF14A",
                    "ir/URD", "ir/RFS", "ir/TRIM", "ir/CP", "ir/SLIDES", "ir/COMM"]:
            sd = dl_dir / sub
            if not sd.exists():
                continue
            for f in sd.iterdir():
                if not f.is_file():
                    continue
                for d in date_pat.findall(f.name):
                    try:
                        dt = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        # garde-fou contre les faux matchs (numeros d'accession EDGAR)
                        if 2000 <= dt.year <= 2100:
                            candidates.append(dt)
                    except ValueError:
                        pass
    if not candidates:
        return None
    return max(candidates)


# Yann 18 aout 2026 : tickers renommes en bourse. Les donnees Mettrik restent
# stockees sous l'ancien ticker (migration a venir) mais les APIs de marche ne
# connaissent que le nouveau : sans ce mapping, yfinance renvoyait 404 chaque
# nuit sur BK et SATS (vu dans /tmp/daily-doc-watcher.log).
YF_SYMBOL_OVERRIDES = {
    "BK": "BNY",      # BNY Mellon, renomme 2026
    "SATS": "ECHO",   # EchoStar, renomme 2026
    "AVB": "VMRK",    # fusion AvalonBay + Equity Residential -> Vivmark (17/08/2026)
    "EQR": "VMRK",
}


def yf_symbol(ticker: str) -> str:
    """Ticker Mettrik -> symbole reconnu par les APIs de marche."""
    return YF_SYMBOL_OVERRIDES.get(ticker.upper(), ticker)


def fetch_yf_calendar(ticker: str) -> dict | None:
    """Retourne {next_earnings_date, last_quarter_end} ou None si yfinance fail."""
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        log("WARNING: yfinance not installed, skipping calendar fetch")
        return None
    try:
        t = yf.Ticker(yf_symbol(ticker))
        cal = t.calendar
        info = t.info if hasattr(t, "info") else {}
        next_ed = None
        if isinstance(cal, dict):
            ed = cal.get("Earnings Date") or cal.get("earningsDate")
            if isinstance(ed, list) and ed:
                next_ed = ed[0]
            elif ed:
                next_ed = ed
        elif cal is not None and hasattr(cal, "loc"):  # pandas DataFrame
            try:
                next_ed = cal.loc["Earnings Date"].iloc[0]
            except Exception:
                pass
        # normalize
        if next_ed is not None:
            try:
                next_ed = next_ed.isoformat() if hasattr(next_ed, "isoformat") else str(next_ed)
            except Exception:
                next_ed = str(next_ed)
        last_q = info.get("mostRecentQuarter") if isinstance(info, dict) else None
        if last_q and isinstance(last_q, (int, float)):
            try:
                last_q = datetime.fromtimestamp(int(last_q), tz=timezone.utc).date().isoformat()
            except Exception:
                last_q = None
        return {"next_earnings_date": next_ed, "last_quarter_end": last_q}
    except Exception as e:
        log(f"WARNING yfinance fail {ticker}: {e}")
        return None


def fetch_sec_submissions(cik: str) -> dict | None:
    """SEC EDGAR submissions API (gratuit)."""
    import urllib.request
    url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"WARNING SEC submissions fail CIK={cik}: {e}")
        return None


def cik_for_ticker(ticker: str) -> str | None:
    """Lookup CIK depuis le mapping local s'il existe, sinon SEC EDGAR ticker.txt."""
    # mapping local
    cik_map_path = SEC_DATA_DIR / "_meta" / "ticker-cik-map.json"
    if cik_map_path.exists():
        try:
            with open(cik_map_path, "r", encoding="utf8") as f:
                mp = json.load(f)
            v = mp.get(ticker.upper())
            if v:
                return str(v)
        except Exception:
            pass
    return None


def download_recent_sec_filings(
    ticker: str, since_days: int = 90, max_downloads: int = 3
) -> int:
    """Télécharge les 10-Q/10-K/8-K récents non en cache. Retourne nb téléchargés."""
    cik = cik_for_ticker(ticker)
    if not cik:
        return 0
    subs = fetch_sec_submissions(cik)
    if not subs:
        return 0
    recent = subs.get("filings", {}).get("recent", {})
    forms: list[str] = recent.get("form") or []
    dates: list[str] = recent.get("filingDate") or []
    accession: list[str] = recent.get("accessionNumber") or []
    primary_doc: list[str] = recent.get("primaryDocument") or []
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=since_days)
    downloaded = 0
    for i, form in enumerate(forms):
        if downloaded >= max_downloads:
            break
        if form not in {"10-K", "10-Q", "8-K", "20-F", "6-K"}:
            continue
        try:
            filed_date = datetime.strptime(dates[i], "%Y-%m-%d").date()
        except (ValueError, IndexError):
            continue
        if filed_date < cutoff:
            continue
        year = filed_date.year
        form_clean = form.replace("-", "")
        is_fpi = form in {"20-F", "6-K"}
        base_sub = "cat2-foreign-adr" if is_fpi else "cat1-us"
        target_dir = SEC_DATA_DIR / base_sub / form_clean / str(year)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / f"{ticker}_{filed_date.isoformat()}.htm.gz"
        if target_file.exists():
            continue
        # download primary doc
        try:
            acc_no_dash = accession[i].replace("-", "")
            doc = primary_doc[i]
            url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_no_dash}/{doc}"
            import urllib.request
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                content = resp.read()
            with gzip.open(target_file, "wb") as gz:
                gz.write(content)
            downloaded += 1
            log(f"  ↓ {ticker} {form} {filed_date} → {target_file.relative_to(PROJECT_ROOT)}")
            time.sleep(0.15)  # SEC rate limit ~10 req/sec
        except Exception as e:
            log(f"  ✗ {ticker} {form} {dates[i]}: {e}")
    return downloaded


def scrape_eu_ir_page(ticker: str) -> int:
    """
    Scrape best-effort IR page pour stés EU pures (suffixe .PA/.DE/.L/...).
    Retourne nb PDFs téléchargés. Best-effort, ne fail jamais bruyamment.
    """
    try:
        import yfinance as yf  # type: ignore
        import urllib.request
    except ImportError:
        return 0
    try:
        info = yf.Ticker(ticker).info
        website = info.get("website") if isinstance(info, dict) else None
        if not website:
            return 0
    except Exception:
        return 0
    ir_candidates = [
        urljoin(website, "/investors"),
        urljoin(website, "/investor-relations"),
        urljoin(website, "/en/investors"),
        urljoin(website, "/en/investor-relations"),
    ]
    found = 0
    for url in ir_candidates:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf8", errors="replace")
            # cherche les PDFs annual / half-year récents
            pdfs = re.findall(
                r'href="([^"]+(?:annual|half[_-]?year|interim|report)[^"]*\.pdf)"',
                html,
                flags=re.IGNORECASE,
            )
            for pdf_path in pdfs[:2]:  # max 2 PDFs par IR page
                pdf_url = urljoin(url, pdf_path)
                target_dir = SEC_DATA_DIR / "cat3-european" / ticker / "annual-report"
                target_dir.mkdir(parents=True, exist_ok=True)
                fname = urlparse(pdf_url).path.split("/")[-1] or f"doc-{int(time.time())}.pdf"
                target_file = target_dir / fname
                if target_file.exists():
                    continue
                try:
                    req2 = urllib.request.Request(pdf_url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req2, timeout=60) as resp2:
                        target_file.write_bytes(resp2.read())
                    found += 1
                    log(f"  ↓ {ticker} EU IR PDF → {target_file.relative_to(PROJECT_ROOT)}")
                except Exception as e:
                    log(f"  ✗ {ticker} IR PDF {pdf_url}: {e}")
            if found:
                break  # success on this candidate
        except Exception:
            continue
    return found


def write_status(
    flagged_earning: list[str],
    flagged_stale: list[str],
    docs_downloaded: int,
    tickers_processed: int,
    run_status: str,
) -> None:
    payload = {
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "app_version": "v1-9-5",
        "docs_downloaded_last_run": docs_downloaded,
        "stes_flagged_earning_pending_resolved": sorted(set(flagged_earning)),
        "stes_flagged_docs_stale": sorted(set(flagged_stale)),
        "tickers_processed_last_run": tickers_processed,
        "last_run_status": run_status,
        "last_run_log_path": "/tmp/daily-doc-watcher.log",
    }
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_PATH, "w", encoding="utf8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log(f"Status written: {STATUS_PATH.relative_to(PROJECT_ROOT)}")


def write_inbox_recap(
    flagged_earning: list[str],
    flagged_stale: list[str],
    docs_downloaded: int,
    tickers_processed: int,
) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    target = INBOX_DIR / f"daily-doc-watcher-{today}.md"
    body = [
        f"# Daily Doc Watcher — {today}",
        "",
        f"- Tickers traités : {tickers_processed}",
        f"- Docs téléchargés : {docs_downloaded}",
        f"- Stés flaggées earning_pending_unresolved : {len(flagged_earning)}",
        f"- Stés flaggées docs_stale : {len(flagged_stale)}",
        "",
        "## Earning pending unresolved",
        "",
        ", ".join(flagged_earning) if flagged_earning else "_aucune_",
        "",
        "## Docs stale (> 90j)",
        "",
        ", ".join(flagged_stale) if flagged_stale else "_aucune_",
        "",
        "Source : `src/data/_daily-doc-watcher-status.json`",
        "",
    ]
    target.write_text("\n".join(body), encoding="utf8")
    log(f"Inbox recap written: {target.relative_to(PROJECT_ROOT)}")


def main() -> int:
    log("Loading clean_all tickers...")
    universe = load_clean_all_tickers()
    log(f"Found {len(universe)} clean_all tickers")
    if not universe:
        write_status([], [], 0, 0, "error_no_universe")
        return 1

    # cap for safety
    universe = universe[:MAX_TICKERS_PER_RUN]
    log(f"Processing first {len(universe)} tickers (cap={MAX_TICKERS_PER_RUN})")

    today = datetime.now(timezone.utc).date()
    flagged_earning: list[str] = []
    flagged_stale: list[str] = []
    docs_downloaded = 0
    processed = 0

    for entry in universe:
        ticker = entry["ticker"]
        processed += 1
        if processed % 50 == 0:
            log(f"Progress: {processed}/{len(universe)}")

        # 1. Determine last filing date
        last_filing = get_last_filing_date_local(ticker)
        last_filing_date = last_filing.date() if last_filing else None

        # 2. Fetch yfinance calendar
        cal = fetch_yf_calendar(ticker)
        next_ed = None
        if cal and cal.get("next_earnings_date"):
            try:
                next_ed_str = str(cal["next_earnings_date"])
                # try parse YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
                next_ed = datetime.fromisoformat(next_ed_str.split()[0].split("T")[0]).date()
            except (ValueError, AttributeError):
                pass

        # 3. Flag earning_pending_unresolved
        if next_ed and next_ed < today - timedelta(days=EARNING_TOLERANCE_DAYS):
            # earning attendu mais passé sans nouveau filing récent
            if not last_filing_date or (today - last_filing_date).days > 30:
                flagged_earning.append(ticker)

        # 4. Flag docs_stale
        if last_filing_date is None:
            flagged_stale.append(ticker)
        elif (today - last_filing_date).days > STALE_THRESHOLD_DAYS:
            flagged_stale.append(ticker)

        # 5. Si flagged, télécharger nouveaux docs
        was_flagged = ticker in flagged_earning or ticker in flagged_stale
        if was_flagged:
            try:
                if is_us_ticker(ticker):
                    docs_downloaded += download_recent_sec_filings(ticker, since_days=180, max_downloads=2)
                elif "." in ticker:
                    # EU pures
                    docs_downloaded += scrape_eu_ir_page(ticker)
                else:
                    # FPI ADR : try SEC EDGAR for 20-F/6-K
                    docs_downloaded += download_recent_sec_filings(ticker, since_days=180, max_downloads=2)
            except Exception as e:
                log(f"WARNING download fail {ticker}: {e}")

        # Petite politesse yfinance
        time.sleep(0.1)

    log(f"Done. processed={processed} docs_downloaded={docs_downloaded} flagged_earning={len(flagged_earning)} flagged_stale={len(flagged_stale)}")
    write_status(flagged_earning, flagged_stale, docs_downloaded, processed, "ok")
    write_inbox_recap(flagged_earning, flagged_stale, docs_downloaded, processed)
    return 0


if __name__ == "__main__":
    try:
        rc = main()
    except KeyboardInterrupt:
        log("Interrupted by user")
        rc = 130
    except Exception as e:
        log(f"FATAL: {e}")
        import traceback
        traceback.print_exc()
        write_status([], [], 0, 0, f"error: {type(e).__name__}")
        rc = 1
    sys.exit(rc)
