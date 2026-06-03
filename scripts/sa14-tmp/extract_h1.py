#!/usr/bin/env python3
"""SA14: extract H1+FY KPIs from half-year interim PDFs via Cerebras gpt-oss-120b.
Updates src/data/v2-pipeline-enrich/<slug>.json _quarterly_history_extension
to use period_type='semester' with H1 + FY history.
"""
import json
import os
import re
import sys
import time
import urllib.request
import ssl
from pathlib import Path

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY_0") or "csk-twetcf6mwdpf8kwjf5ct269c464ef5emytt8y96dx8tdwv6t",
    os.environ.get("CEREBRAS_API_KEY_1") or "csk-ky54wh42fvycff3yyn88ty455kjeth4x8wnt6n3vvwm5xdd4",
    os.environ.get("CEREBRAS_API_KEY_2") or "csk-8xjy6949c6e9djtkmyxk3pw4dc4j59wv82xfmn29xrcyv24x",
]
MODEL = "gpt-oss-120b"
SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

CURRENCY_MAP = {
    "BP.L": "$",  # BP reports in USD
    "BN.PA": "€",
    "DTE.DE": "€",
    "HEN.DE": "€",
    "ITRK.L": "£",
    "PAH3.DE": "€",
}

CURRENCY_UNIT = {
    "$": "Mds $",
    "€": "Mds €",
    "£": "Mds £",
    "CHF": "Mds CHF",
}

PROMPT_TPL = """Tu vas extraire des KPIs SEMESTRIELS (H1) ET ANNUELS (FY) pour {ticker} depuis ce texte de rapport semestriel ({year}).

Pour chaque KPI distinct, retourne JSON strict avec les valeurs trouvées dans le rapport.
KPIs à chercher : Total Revenue, Net Income (or Profit for the period attributable to shareholders), Operating Income (or Operating profit), Operating Cash Flow.

Le rapport H1 {year} contient souvent : H1 {year}, H1 {year_prev}, et parfois FY {year_prev}.
Cherche les chiffres EXPLICITES (pas calculés). Retourne en milliards (Mds) dans la devise native.

Format strict (JSON pur, pas de markdown) :
{{
  "kpis": [
    {{
      "kpi_short": "Total Revenue",
      "history": [
        {{"period": "H1 {year}", "value": X, "date": "{year}-06-30"}},
        {{"period": "H1 {year_prev}", "value": Y, "date": "{year_prev}-06-30"}}
      ]
    }},
    ...
  ]
}}

REGLES ABSOLUES :
- NULL ou OMETTRE si valeur non chiffrée explicitement dans le texte.
- NE PAS calculer H2 = FY - H1.
- Valeurs en Mds (milliards). Ex : 12.5 = 12,5 Mds. Convertis si besoin (M -> Mds en divisant par 1000).
- Devise native : {currency}.

TEXTE DU RAPPORT (premiers 25000 caracteres):
{text}
"""


def call_cerebras(prompt, key_idx=0):
    key = CEREBRAS_KEYS[key_idx % len(CEREBRAS_KEYS)]
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 3000,
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://api.cerebras.ai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "curl/7.79.1",
        },
    )
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
            resp = json.loads(r.read())
        content = resp["choices"][0]["message"]["content"]
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        return json.loads(content), None
    except urllib.error.HTTPError as e:
        return None, f"http_{e.code}"
    except Exception as e:
        return None, f"err_{type(e).__name__}_{e}"


BASE = "/Users/yann/Mettrik/sec-data/cat3-european"
ENRICH = "/Users/yann/spx-app/src/data/v2-pipeline-enrich"

TICKERS = ["BN.PA", "BP.L", "DTE.DE", "HEN.DE", "ITRK.L", "PAH3.DE"]


def main():
    all_results = {}
    key_idx = 0

    for ticker in TICKERS:
        slug = ticker.lower()
        ticker_dir = os.path.join(BASE, ticker, "half-year")
        if not os.path.isdir(ticker_dir):
            print(f"SKIP {ticker} no half-year dir")
            continue

        currency = CURRENCY_MAP.get(ticker, "€")
        unit = CURRENCY_UNIT.get(currency, "Mds €")
        all_kpi_data = {}  # kpi_short -> { (period, date) -> value }

        txt_files = sorted([f for f in os.listdir(ticker_dir) if f.endswith(".txt")])
        for txt_file in txt_files:
            year_match = re.match(r"(\d{4})-H1\.txt", txt_file)
            if not year_match:
                continue
            year = int(year_match.group(1))
            year_prev = year - 1

            txt_path = os.path.join(ticker_dir, txt_file)
            with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()[:25000]

            prompt = PROMPT_TPL.format(
                ticker=ticker, year=year, year_prev=year_prev,
                currency=currency, text=text,
            )

            result, err = call_cerebras(prompt, key_idx)
            key_idx += 1
            if err or not result:
                print(f"FAIL {ticker} {year}: {err}")
                time.sleep(4)
                continue

            kpis = result.get("kpis", [])
            print(f"OK   {ticker} {year}: {len(kpis)} kpis")
            for k in kpis:
                short = k.get("kpi_short")
                if not short:
                    continue
                hist = k.get("history", [])
                if short not in all_kpi_data:
                    all_kpi_data[short] = {}
                for h in hist:
                    period = h.get("period")
                    val = h.get("value")
                    date = h.get("date")
                    if period and val is not None and isinstance(val, (int, float)):
                        all_kpi_data[short][(period, date)] = float(val)
            time.sleep(4)  # rate limit

        # Now merge per ticker
        if not all_kpi_data:
            print(f"SKIP {ticker}: no data extracted")
            continue

        # Build new _quarterly_history_extension with semester period_type
        kpis_out = []
        kpi_name_fr = {
            "Total Revenue": "Chiffre d'affaires",
            "Net Income": "Résultat net",
            "Operating Income": "Résultat opérationnel",
            "Operating Cash Flow": "Cash-flow opérationnel",
        }
        for short, points in all_kpi_data.items():
            history = []
            for (period, date), val in sorted(points.items(), key=lambda x: x[0][1] or ""):
                history.append({
                    "period": period,
                    "value": val,
                    "date": date,
                    "source": f"interim report PDF SA14 ({currency})",
                })
            if len(history) < 2:
                continue
            kpis_out.append({
                "kpi_short": short,
                "kpi_name_fr": kpi_name_fr.get(short, short),
                "unit": unit,
                "period_type": "semester",
                "history": history,
                "last_data_date": max(h["date"] for h in history if h.get("date")),
                "source": "SA14 interim report scrape + Cerebras gpt-oss-120b",
            })

        if not kpis_out:
            print(f"SKIP {ticker}: no valid kpis after merge")
            continue

        # Load enrich JSON, MERGE with existing SA11 FY data (preserve!)
        enrich_path = os.path.join(ENRICH, f"{slug}.json")
        if not os.path.exists(enrich_path):
            print(f"FAIL {ticker}: enrich file missing")
            continue
        with open(enrich_path, "r") as f:
            enrich = json.load(f)

        existing_ext = enrich.get("_quarterly_history_extension", {})
        existing_kpis = existing_ext.get("kpis", [])

        # Normalize key for matching (e.g. "Op Cash Flow" vs "Operating Cash Flow")
        def norm_short(s):
            return s.lower().replace("operating", "op").replace(".", "").strip()

        # Build merge map indexed by normalized short
        merged_by_short = {}
        for k in existing_kpis:
            merged_by_short[norm_short(k["kpi_short"])] = k

        # Add SA14 H1 data: merge into existing OR create new entry
        for new_k in kpis_out:
            norm = norm_short(new_k["kpi_short"])
            new_hist = new_k["history"]  # H1 data
            if norm in merged_by_short:
                # merge: keep SA11 FY data, add H1 points, switch period_type to semester
                existing_k = merged_by_short[norm]
                # Convert SA11 'quarter' field -> 'period' field for uniformity
                existing_hist = existing_k.get("history", [])
                normalized_existing = []
                for h in existing_hist:
                    period = h.get("period") or h.get("quarter")
                    if not period:
                        continue
                    normalized_existing.append({
                        "period": period,
                        "value": h["value"],
                        "date": h.get("date"),
                        "source": h.get("source", existing_k.get("source", "SA11 yfinance")),
                    })
                # Union by period
                seen = {h["period"] for h in normalized_existing}
                for h in new_hist:
                    if h["period"] not in seen:
                        normalized_existing.append(h)
                merged_hist = sorted(normalized_existing, key=lambda x: x.get("date") or "")
                existing_k["history"] = merged_hist
                existing_k["period_type"] = "semester"
                existing_k["last_data_date"] = max(h["date"] for h in merged_hist if h.get("date"))
                # update unit if SA14 provides a more displayable one (Mds €)
                if new_k.get("unit"):
                    existing_k["unit"] = new_k["unit"]
                existing_k.setdefault("source", new_k.get("source"))
                # remove deprecated fields
                existing_k.pop("history_periods", None)
                existing_k.pop("_sec_tag", None)
            else:
                # New KPI entirely from SA14 (e.g. Op Cash Flow not in SA11)
                merged_by_short[norm] = new_k

        merged_kpis = list(merged_by_short.values())

        enrich["_quarterly_history_extension"] = {
            "ticker": ticker,
            "kpis": merged_kpis,
            "_sa14_extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "_sa14_source": "interim H1 PDFs + Cerebras gpt-oss-120b; FY from SA11 yfinance preserved",
        }
        kpis_out = merged_kpis  # for stats output

        with open(enrich_path, "w") as f:
            json.dump(enrich, f, indent=2, ensure_ascii=False)

        all_results[ticker] = {
            "kpis_extracted": len(kpis_out),
            "total_points": sum(len(k["history"]) for k in kpis_out),
        }
        print(f"WROTE {ticker}: {len(kpis_out)} KPIs, {sum(len(k['history']) for k in kpis_out)} points total")

    print("\n=== SUMMARY ===")
    print(json.dumps(all_results, indent=2))


if __name__ == "__main__":
    main()
