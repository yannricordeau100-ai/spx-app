#!/usr/bin/env python3
"""SA14: probe known-pattern IR URLs for H1/Interim PDFs (2021-2024).
Rate-limited, 1 process, gentle. Saves successful PDFs to /Users/yann/Mettrik/sec-data/cat3-european/<TICKER>/half-year/<year>-H1.pdf
"""
import json
import os
import subprocess
import time
import sys

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Curated direct-PDF URL templates per ticker, in priority order.
# Built from public IR page knowledge as of 2024. Use {Y} = full year.
PATTERNS = {
    "1COV.DE": [
        "https://www.covestro.com/-/media/covestro/investor-relations/financial-reports/{Y}/covestro-half-year-financial-report-{Y}.pdf",
        "https://www.covestro.com/-/media/covestro/investor-relations/financial-reports/{Y}/q2-{Y}/covestro-half-year-financial-report-{Y}.pdf",
    ],
    "AD.AS": [
        "https://media.aholddelhaize.com/media/0c50zh0d/ahold-delhaize-2024-half-year-report.pdf",
        "https://media.aholddelhaize.com/media/{Y}-half-year-report.pdf",
    ],
    "ADYEN.AS": [
        "https://www.adyen.com/dam/jcr:adyen-h1-{Y}-shareholder-letter/Adyen-H1-{Y}-shareholder-letter.pdf",
    ],
    "AGN.AS": [
        "https://www.aegon.com/contentassets/aegon-half-year-results-{Y}/aegon-half-year-results-{Y}.pdf",
    ],
    "BN.PA": [
        "https://www.danone.com/content/dam/corp/global/danonecom/investors/en-financial-reports/{Y}/Danone-H1-{Y}-Half-Year-Financial-Report.pdf",
    ],
    "BNP.PA": [
        "https://invest.bnpparibas/sites/default/files/documents/h1{Y}-bnp-paribas-half-year-financial-report.pdf",
    ],
    "BP.L": [
        "https://www.bp.com/content/dam/bp/business-sites/en/global/corporate/pdfs/investors/bp-second-quarter-{Y}-results.pdf",
    ],
    "BT-A.L": [
        "https://www.bt.com/bt-plc/assets/documents/investors/financial-reporting-and-news/quarterly-results/{Y}-{NEXT}/q2/q2-{Y}{NEXT}-bt-group-plc-results-release.pdf",
    ],
    "CAP.PA": [
        "https://www.capgemini.com/wp-content/uploads/{Y}/07/Capgemini_H1_{Y}_Half_Year_Financial_Report.pdf",
    ],
    "CCH.L": [
        "https://www.coca-colahellenic.com/content/dam/cch/cch-content/investor-relations/results-center/{Y}/h1-{Y}-results-release.pdf",
    ],
    "CPR.MI": [
        "https://www.camparigroup.com/sites/default/files/{Y}-07/Campari_HY{Y}_Half_Year_Financial_Report.pdf",
    ],
    "CS.PA": [
        "https://www-axa-com.cdn.axa-contento-118412.eu/www-axa-com%2F{Y}-{H1MONTH}%2Faxa_h1_{Y}_results_release.pdf",
    ],
    "DIM.PA": [
        "https://www.sartorius.com/download/sartorius-stedim-biotech/half-year-financial-report-{Y}.pdf",
    ],
    "EQNR.OL": [
        "https://cdn.equinor.com/files/h61q9gi9/global/equinor-{Y}-second-quarter-report.pdf",
    ],
    "ERF.PA": [
        "https://cdn.eurofins.com/cdn-shared/group/investors/{Y}/eurofins-h1-{Y}-results.pdf",
    ],
    "FRE.DE": [
        "https://www.fresenius.com/sites/default/files/{Y}-08/fresenius-q2-{Y}-financial-report.pdf",
    ],
    "FRES.L": [
        "https://www.fresnilloplc.com/media/{Y}/{Y}-interim-results.pdf",
    ],
    "HEN.DE": [
        "https://www.henkel.com/resource/blob/Henkel_HY_Report_{Y}_EN.pdf",
    ],
    "ITRK.L": [
        "https://www.intertek.com/uploadedFiles/Intertek/Investors/financial_reports/{Y}/Intertek-Interim-Report-{Y}.pdf",
    ],
    "KER.PA": [
        "https://www.kering.com/api/download-file/?path=Kering_H1_{Y}_Financial_Report_EN.pdf",
    ],
    "KOG.OL": [
        "https://www.kongsberg.com/contentassets/kog-q2-{Y}/kog-q2-{Y}-report.pdf",
    ],
    "LAND.L": [
        "https://landsec.com/sites/default/files/{Y}-09/Landsec-Half-Year-Results-{Y}.pdf",
    ],
    "LI.PA": [
        "https://www.essilorluxottica.com/sites/default/files/{Y}-08/EssilorLuxottica-H1-{Y}-Half-Year-Financial-Report.pdf",
    ],
    "MAP.MC": [
        "https://www.mapfre.com/media/accionistas/{Y}/h1-{Y}-mapfre.pdf",
    ],
    "MB.MI": [
        "https://www.mediobanca.com/static/upload_new/half/mediobanca-half-year-report-{Y}.pdf",
    ],
    "NDA-DK.CO": [
        "https://www.nordea.com/sites/default/files/{Y}-07/nordea-half-year-report-{Y}.pdf",
    ],
    "NG.L": [
        "https://www.nationalgrid.com/document/{Y}/half-year-results-{Y}.pdf",
    ],
    "NOVN.SW": [
        "https://www.novartis.com/sites/novartis_com/files/novartis-q2-{Y}-half-year-financial-report.pdf",
    ],
    "NWG.L": [
        "https://investors.natwestgroup.com/~/media/Files/R/RBS-IR/results-center/{Y}/h1-{Y}-results.pdf",
    ],
    "PAH3.DE": [
        "https://www.porsche-se.com/fileadmin/downloads/finanzpublikationen/{Y}/halbjahresfinanzbericht-{Y}-en.pdf",
    ],
    "PRY.MI": [
        "https://www.prysmiangroup.com/sites/default/files/{Y}/Prysmian-Half-Year-Financial-Report-{Y}.pdf",
    ],
    "ROG.SW": [
        "https://assets.roche.com/f/176343/x/roche-half-year-report-{Y}-en.pdf",
    ],
    "RXL.PA": [
        "https://www.rexel.com/sites/default/files/{Y}/Rexel-H1-{Y}-Half-Year-Financial-Report.pdf",
    ],
    "SAMPO.HE": [
        "https://www.sampo.com/globalassets/inc/news/financial-reports/sampo-half-year-{Y}.pdf",
    ],
    "SGSN.SW": [
        "https://www.sgs.com/-/media/sgscorp/documents/corporate/financial-reports/{Y}/sgs-{Y}-half-year-report-en.pdf",
    ],
    "SLHN.SW": [
        "https://www.swisslife.com/dam/jcr:hy-report-{Y}/swiss-life-half-year-results-{Y}.pdf",
    ],
    "SOF.BR": [
        "https://www.sofina.be/wp-content/uploads/{Y}/Sofina-H1-{Y}-Results.pdf",
    ],
    "SOON.SW": [
        "https://www.sonova.com/sites/default/files/{Y}/sonova-half-year-report-{Y}.pdf",
    ],
    "STAN.L": [
        "https://av.sc.com/corp-en/content/docs/SCB_HY_{Y}_Results_Announcement.pdf",
    ],
    "UNI.MI": [
        "https://www.unipolsai.com/sites/default/files/{Y}/h1-{Y}-half-year-report.pdf",
    ],
    "VIE.PA": [
        "https://www.veolia.com/sites/g/files/dvc4206/files/{Y}-08/H1-{Y}-half-year-financial-report.pdf",
    ],
    "VNA.DE": [
        "https://reports.vonovia.com/{Y}/half-year-report/serviceseiten/downloads/files/gesamt_vonovia_hy{Y}.pdf",
    ],
    "ZURN.SW": [
        "https://www.zurich.com/-/media/project/zurich/dotcom/investor-relations/docs/{Y}/half-year-results-{Y}-en.pdf",
    ],
    "DTE.DE": [
        "https://www.telekom.com/resource/blob/halbjahresfinanzbericht-{Y}-en.pdf",
        "https://www.telekom.com/en/investor-relations/publications/financial-publications/half-year-report-{Y}.pdf",
    ],
}

YEARS = [2021, 2022, 2023, 2024]
BASE = "/Users/yann/Mettrik/sec-data/cat3-european"


def try_url(url, out_pdf, timeout=15):
    """Download with curl. Return True if 200 + valid PDF + >100KB."""
    try:
        r = subprocess.run(
            ["curl", "-sL", "-A", UA, "--max-time", str(timeout),
             "-o", out_pdf, "-w", "%{http_code}|%{size_download}", url],
            capture_output=True, text=True, timeout=timeout + 5,
        )
        if r.returncode != 0:
            return False
        status, size = (r.stdout.strip() + "|0|0").split("|")[:2]
        size_i = int(size or 0)
        if status != "200" or size_i < 100_000:
            if os.path.exists(out_pdf) and size_i < 100_000:
                os.remove(out_pdf)
            return False
        # Verify PDF magic
        with open(out_pdf, "rb") as f:
            head = f.read(5)
        if head[:4] != b"%PDF":
            os.remove(out_pdf)
            return False
        return True
    except Exception:
        if os.path.exists(out_pdf):
            try:
                os.remove(out_pdf)
            except Exception:
                pass
        return False


def main():
    log = {"ok": [], "fail": []}
    for ticker, urls in PATTERNS.items():
        out_dir = os.path.join(BASE, ticker, "half-year")
        os.makedirs(out_dir, exist_ok=True)
        for year in YEARS:
            ystr = str(year)
            nstr = str(year + 1)[-2:]
            out_pdf = os.path.join(out_dir, f"{year}-H1.pdf")
            if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 100_000:
                log["ok"].append(f"{ticker}/{year} (already)")
                continue
            got = False
            for tpl in urls:
                url = tpl.replace("{Y}", ystr).replace("{NEXT}", nstr).replace("{H1MONTH}", "08")
                if try_url(url, out_pdf):
                    log["ok"].append(f"{ticker}/{year} <- {url}")
                    got = True
                    print(f"OK  {ticker} {year}")
                    break
                time.sleep(0.5)  # gentle
            if not got:
                log["fail"].append(f"{ticker}/{year}")
                print(f"FAIL {ticker} {year}")
            time.sleep(0.3)
    with open("/Users/yann/spx-app/scripts/sa14-tmp/scrape_log.json", "w") as f:
        json.dump(log, f, indent=2)
    print(f"\nTotal OK={len(log['ok'])} FAIL={len(log['fail'])}")


if __name__ == "__main__":
    main()
