#!/usr/bin/env python3
"""enrich-eu-cerebras-blocs.py — EU stés (cat3-european).
Variante du script SP500 : lit annual-text/<year>.txt au lieu de 10K/*.htm.gz.
"""
import json
import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Import functions from the SP500 script
spec_path = Path(__file__).resolve().parent / "enrich-sp500-cerebras-blocs-unified.py"
import importlib.util
spec = importlib.util.spec_from_file_location("sp500", spec_path)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
SEC_CAT3 = PROJECT_ROOT / "sec-data/cat3-european"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", ""))
LOG = PROJECT_ROOT / f".conv-state/CONV-CONCEPTS-eu-blocs-{os.environ.get('KEY_INDEX','0')}.log"
LOG.parent.mkdir(parents=True, exist_ok=True)
SLEEP = 4.0
CTX_LEN = 22000

def log_line(msg):
    line = f"[{time.strftime('%H:%M:%S')}][{os.environ.get('KEY_INDEX','0')}] {msg}"
    print(line, flush=True)
    LOG.write_text((LOG.read_text() if LOG.exists() else "") + line + "\n")

def find_eu_text(ticker: str):
    """Trouve annual-text le plus récent pour un ticker EU."""
    d = SEC_CAT3 / ticker / "annual-text"
    if not d.exists():
        return None
    files = sorted([f for f in d.glob("*.txt") if f.stem.isdigit()], key=lambda f: f.stem, reverse=True)
    return files[0] if files else None

def main():
    mod.load_env()
    api_key = mod.get_api_key()
    if not api_key:
        log_line("❌ NO Cerebras key"); sys.exit(1)
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    log_line(f"START eu-blocs-unified ({len(pending)} stés)")
    updated_cust = updated_seg = updated_geo = updated_desc = no_source = fails = 0
    last_call = 0.0
    for i, tk in enumerate(pending):
        if i and i % 20 == 0:
            log_line(f"  [{i}/{len(pending)}] cust+{updated_cust} seg+{updated_seg} geo+{updated_geo} desc+{updated_desc} no_src={no_source} fail={fails}")
        elapsed = time.time() - last_call
        if elapsed < SLEEP: time.sleep(SLEEP - elapsed)
        last_call = time.time()
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists(): continue
        try:
            data = json.loads(p.read_text())
        except: fails += 1; continue
        cust_ok = bool(data.get("customer_type"))
        seg_ok = isinstance((data.get("revenue_by_segment") or {}).get("slices"), list) and len(data["revenue_by_segment"]["slices"]) >= 2
        geo_ok = isinstance((data.get("revenue_by_geography") or {}).get("slices"), list) and len(data["revenue_by_geography"]["slices"]) >= 2
        desc_ok = len(str(data.get("company_description") or "")) >= 50
        if cust_ok and seg_ok and geo_ok and desc_ok: continue
        f = find_eu_text(tk)
        if not f: no_source += 1; continue
        try:
            text = f.read_text(errors="ignore")
        except: no_source += 1; continue
        ctx = mod.find_section(text) if hasattr(mod, "find_section") else text[:CTX_LEN]
        if len(ctx) > CTX_LEN: ctx = ctx[:CTX_LEN]
        prompt = mod.PROMPT.format(name=data.get("name", tk), ticker=tk, ctx=ctx)
        result = mod.call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict): fails += 1; continue
        changed = False
        if not cust_ok and result.get("customer_type"):
            data["customer_type"] = result["customer_type"]
            if result.get("customer_type_label"): data["customer_type_label"] = result["customer_type_label"]
            updated_cust += 1; changed = True
        if not seg_ok and result.get("revenue_by_segment"):
            data["revenue_by_segment"] = result["revenue_by_segment"]
            updated_seg += 1; changed = True
        if not geo_ok and result.get("revenue_by_geography"):
            data["revenue_by_geography"] = result["revenue_by_geography"]
            updated_geo += 1; changed = True
        if not desc_ok and result.get("company_description"):
            data["company_description"] = result["company_description"]
            updated_desc += 1; changed = True
        if changed:
            data["_eu_blocs_extracted_at"] = mod.datetime.now(tz=mod.timezone.utc).isoformat()
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    log_line(f"END: cust={updated_cust} seg={updated_seg} geo={updated_geo} desc={updated_desc} no_src={no_source} fails={fails}")

if __name__ == "__main__":
    main()
