#!/usr/bin/env python3
"""
reextract-hero-history-v18.py — Re-extract hero KPI history pour les
12 stés top 307 V1.8 dont l'history a été identifiée comme hallucinée
par CONV-TRANSCRIPTS (broadcast 13 mai 02:55 CEST).

Critère de hallucination : history linéaire (diffs[i+1]-diffs[i] tous
identiques). Cause : LLM original n'a pas trouvé l'history dans le 10-K
et l'a fabriquée par extrapolation.

Approche :
1. Charger v2-pipeline/<ticker>.json
2. Identifier hero_kpi + son entrée dans kpis[]
3. Charger source filing (10-K cat1-us, 20-F cat2-foreign-adr,
   annual-text cat3-european)
4. Prompt Haiku 4.5 STRICT : "si la valeur de history n'est pas
   explicitement chiffrée dans le filing pour chacune des années,
   retourner null. JAMAIS extrapoler."
5. Si Haiku retourne array valide → update history + ajout
   `_hero_history_source` avec citation
6. Si Haiku retourne null → marquer `_hero_history_unverified: true`
   + history = [value] (point unique = pas de courbe fake)

1 proc, sleep 5s, ETA 2-3 min pour 12 stés.
"""
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC = PROJECT_ROOT / "sec-data"
LOG = PROJECT_ROOT / ".conv-state/CONV-DATA-reextract-hero.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL_ID = "claude-haiku-4-5-20251001"
SLEEP_BETWEEN_CALLS = 5.0

TARGETS = [
    "BAC", "BJ", "BURL", "COST", "DANSKE.CO", "ELAN",
    "GIS", "NOKIA.HE", "NVS", "PANW", "T", "WWD",
]

# Enhance-only group : stés top 307 avec hero history courte (1-2 points)
# mais PAS identifiée fake-linéaire. Logique : enrichir si on trouve plus
# de points dans le filing, sinon GARDER l'existant (jamais downgrade).
TARGETS_ENHANCE_ONLY = [
    "AMAT", "9984.T", "BP.L", "BARC.L", "EIPAF", "DGE.L", "ON", "SHL.DE",
    "KOG.OL", "VIE.PA", "NTRS", "PHIA.AS", "HEN.DE", "NESTE.HE", "WRB",
    "CMS", "EDP.LS", "ILMN", "RBA", "MB.MI", "UNI.MI", "BIP", "GRAB",
    "YAR.OL", "AGN.AS", "MEDP", "ABVX", "PAH3.DE", "RRC", "AOS",
]

# Mode : "strict" = downgrade fake → 1 point + flag unverified
#         "enhance" = enrichir seulement, jamais downgrade
MODE = os.environ.get("REEXTRACT_MODE", "strict")


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists(): return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def _strip_html(html):
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"</td>", " | ", txt, flags=re.IGNORECASE)
    txt = re.sub(r"</tr>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;|&#160;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"&#\d+;|&[a-z]+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt


def find_filing(ticker):
    """Retourne (text, source_label)."""
    tu = ticker.upper()
    for form, label in [("10K", "10-K"), ("20F", "20-F")]:
        base = SEC / ("cat1-us" if form == "10K" else "cat2-foreign-adr") / form
        if not base.exists(): continue
        for year_dir in sorted([d for d in base.iterdir() if d.is_dir()], reverse=True)[:2]:
            for f in year_dir.glob(f"{tu}_*.htm.gz"):
                try:
                    with gzip.open(f, "rt", errors="ignore") as g:
                        return _strip_html(g.read()), f"{label} FY{year_dir.name}"
                except Exception:
                    continue
    cat3 = SEC / "cat3-european" / tu / "annual-text"
    if cat3.exists():
        try:
            txt_files = sorted(cat3.glob("*.txt"), reverse=True)
            for f in txt_files[:1]:
                return _strip_html(f.read_text(errors="ignore")), f"Annual report {f.stem}"
        except Exception:
            pass
    return None, None


def find_kpi_context(text, kpi_short, kpi_name_fr, kpi_name_en, max_chars=10000):
    """Cherche les mentions du KPI hero dans le filing."""
    if not text:
        return ""
    keywords = []
    for kw in [kpi_short, kpi_name_fr, kpi_name_en]:
        if kw and len(kw) > 2:
            keywords.append(kw)
            for word in kw.split():
                if len(word) > 4:
                    keywords.append(word)
    keywords = list(set(keywords))

    matches = []
    for kw in keywords:
        for m in re.finditer(re.escape(kw), text, re.IGNORECASE):
            matches.append(m.start())
    if not matches:
        return ""
    matches.sort()
    best = matches[len(matches) // 2]
    start = max(0, best - 3000)
    return re.sub(r"\s+", " ", text[start:start + max_chars])[:max_chars]


PROMPT = """Tu es un extracteur strict d'historique de KPI financier depuis un filing SEC.

Sté : {ticker}
KPI cible : "{kpi_short}" ({kpi_name_fr} / {kpi_name_en})
Unité : {unit}
Valeur actuelle annoncée : {current_value}

RÈGLE ABSOLUE : si la valeur historique d'une année donnée n'apparaît PAS
explicitement et chiffrée dans le texte du filing ci-dessous, tu retournes
null pour cette année. JAMAIS d'extrapolation, jamais de calcul, jamais
d'invention. Pas de série linéaire fabriquée.

Retourne UNIQUEMENT un JSON :
{{
  "found_in_filing": true | false,
  "history": [year_n4_or_null, year_n3_or_null, year_n2_or_null, year_n1_or_null, year_n_or_null],
  "years": [YYYY, YYYY, YYYY, YYYY, YYYY],
  "unit_confirmed": "$" | "Mds $" | "%" | etc.,
  "evidence": "courte citation exacte du filing avec les chiffres trouvés (1-2 phrases max)"
}}

Si found_in_filing=false : history = [null, null, null, null, null], evidence = "non trouvé"
Si found_in_filing=true mais 1-2 années manquantes : mets null pour ces années, indique les autres.

Filing extracté :
---
{context}
---"""


def call_haiku(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            content = resp.get("content", [{}])[0].get("text", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(15)
                continue
            log_line(f"  HTTPError {e.code}: {e.read().decode()[:120]}")
            return None
        except Exception as e:
            log_line(f"  Exception: {type(e).__name__} {str(e)[:80]}")
            time.sleep(3)
    return None


def process_ticker(ticker, api_key):
    pipe_path = PIPELINE / f"{ticker.lower()}.json"
    if not pipe_path.exists():
        log_line(f"  ❌ {ticker}: pipeline file manquant")
        return False

    data = json.loads(pipe_path.read_text())
    hero_short = data.get("hero_kpi")
    if not hero_short:
        log_line(f"  ⚠ {ticker}: pas de hero_kpi")
        return False

    kpis = data.get("kpis", [])
    hero_kpi = next((k for k in kpis if k.get("short") == hero_short), None)
    if not hero_kpi:
        log_line(f"  ⚠ {ticker}: hero_kpi '{hero_short}' introuvable dans kpis[]")
        return False

    existing_hist = hero_kpi.get("history") if isinstance(hero_kpi.get("history"), list) else []
    enhance_only = MODE == "enhance"

    text, source_label = find_filing(ticker)
    if not text:
        if enhance_only:
            log_line(f"  ⏭ {ticker}: filing introuvable → skip (enhance mode, garde history existant)")
            return False
        log_line(f"  🚫 {ticker}: source filing introuvable → mark unverified")
        hero_kpi["_hero_history_unverified"] = True
        hero_kpi["_hero_history_reason"] = "filing introuvable côté sec-data"
        if "value" in hero_kpi:
            hero_kpi["history"] = [hero_kpi["value"]]
        pipe_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return True

    ctx = find_kpi_context(
        text,
        hero_short,
        hero_kpi.get("name_fr", ""),
        hero_kpi.get("name_en", "")
    )
    if not ctx or len(ctx) < 500:
        if enhance_only:
            log_line(f"  ⏭ {ticker}: KPI non mentionné → skip (enhance mode)")
            return False
        log_line(f"  🚫 {ticker}: KPI '{hero_short}' non mentionné dans filing → mark unverified")
        hero_kpi["_hero_history_unverified"] = True
        hero_kpi["_hero_history_reason"] = f"KPI '{hero_short}' non trouvé dans {source_label}"
        if "value" in hero_kpi:
            hero_kpi["history"] = [hero_kpi["value"]]
        pipe_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return True

    prompt = PROMPT.format(
        ticker=ticker,
        kpi_short=hero_short,
        kpi_name_fr=hero_kpi.get("name_fr", ""),
        kpi_name_en=hero_kpi.get("name_en", ""),
        unit=hero_kpi.get("unit", ""),
        current_value=hero_kpi.get("value", "?"),
        context=ctx,
    )
    result = call_haiku(prompt, api_key)
    if not result or not isinstance(result, dict):
        if enhance_only:
            log_line(f"  ⏭ {ticker}: LLM fail → skip (enhance mode)")
            return False
        log_line(f"  ❌ {ticker}: LLM fail → mark unverified")
        hero_kpi["_hero_history_unverified"] = True
        hero_kpi["_hero_history_reason"] = "LLM call failed"
        if "value" in hero_kpi:
            hero_kpi["history"] = [hero_kpi["value"]]
        pipe_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return True

    found = result.get("found_in_filing", False)
    new_history = result.get("history", [])
    evidence = result.get("evidence", "")

    if not found:
        if enhance_only:
            log_line(f"  ⏭ {ticker}: history non trouvée → skip (enhance mode)")
            return False
        log_line(f"  ⚪ {ticker}: history non trouvée → mark unverified ({evidence[:60]})")
        hero_kpi["_hero_history_unverified"] = True
        hero_kpi["_hero_history_reason"] = f"non trouvée dans {source_label}: {evidence[:120]}"
        if "value" in hero_kpi:
            hero_kpi["history"] = [hero_kpi["value"]]
    else:
        verified = [v for v in new_history if isinstance(v, (int, float))]
        if enhance_only:
            # Mode enhance : remplace seulement si plus de points
            if len(verified) > len(existing_hist):
                hero_kpi["history"] = verified
                hero_kpi["_hero_history_source"] = source_label
                hero_kpi["_hero_history_evidence"] = evidence[:300]
                hero_kpi["_hero_history_unverified"] = False
                log_line(f"  ✅ {ticker}: {len(verified)} > {len(existing_hist)} pts → upgrade | {evidence[:60]}")
            else:
                log_line(f"  ⏭ {ticker}: {len(verified)} ≤ {len(existing_hist)} pts → skip (garde existant)")
                return False
        elif len(verified) < 2:
            log_line(f"  ⚪ {ticker}: <2 valeurs vérifiées → mark unverified")
            hero_kpi["_hero_history_unverified"] = True
            hero_kpi["_hero_history_reason"] = f"<2 valeurs chiffrées vérifiées dans {source_label}"
            if "value" in hero_kpi:
                hero_kpi["history"] = [hero_kpi["value"]]
        else:
            hero_kpi["history"] = verified
            hero_kpi["_hero_history_source"] = source_label
            hero_kpi["_hero_history_evidence"] = evidence[:300]
            hero_kpi["_hero_history_unverified"] = False
            log_line(f"  ✅ {ticker}: {len(verified)} valeurs vérifiées | {evidence[:60]}")

    data["_hero_reextracted_at"] = datetime.now(timezone.utc).isoformat()
    pipe_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return True


def main():
    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log_line("❌ ANTHROPIC_API_KEY introuvable")
        sys.exit(1)

    targets = TARGETS_ENHANCE_ONLY if MODE == "enhance" else TARGETS
    log_line(f"START re-extract hero history MODE={MODE} : {len(targets)} stés top 307 (sleep {SLEEP_BETWEEN_CALLS}s, 1 proc)")

    written = 0
    fails = 0
    last_call = 0.0
    for tk in targets:
        elapsed = time.time() - last_call
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)
        last_call = time.time()

        try:
            ok = process_ticker(tk, api_key)
            if ok:
                written += 1
            else:
                fails += 1
        except Exception as e:
            log_line(f"  ❌ {tk}: exception {type(e).__name__} {str(e)[:80]}")
            fails += 1

    log_line(f"END : written={written} fails={fails}")


if __name__ == "__main__":
    main()
