#!/usr/bin/env python3
"""visual-audit-gemini.py — audit visuel batch via Gemini 2.5 Flash.

Pipeline par sté :
  1. Chrome headless screenshot full-page de la fiche société
     (staging ou local) → PNG cache /tmp/visual-audit/<ticker>.png
  2. POST image + template prompt → Gemini 2.5 Flash
  3. Parse JSON réponse → liste défauts par check
  4. Aggrégation dans src/data/visual-audit.json (clé = ticker)

Free tier Gemini : 1500 req/jour. Sleep ~2 sec entre calls.
Coût : 0 €.

Usage :
  python3 scripts/visual-audit-gemini.py --tickers AAPL,MSFT,NVDA
  python3 scripts/visual-audit-gemini.py --limit 50
  python3 scripts/visual-audit-gemini.py --top307
  python3 scripts/visual-audit-gemini.py --base-url https://mettrik-staging.vercel.app
"""
import argparse
import base64
import json
import os
import re
import ssl
import subprocess
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

try:
    import yaml
except ImportError:
    print("❌ pip3 install pyyaml requis"); sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "scripts" / "visual-audit-template.yaml"
CACHE = Path("/tmp/visual-audit")
OUT = ROOT / "src" / "data" / "visual-audit.json"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def build_prompt(template: dict) -> str:
    checks_block = []
    for cat in template["categories"]:
        checks_block.append(f"\n### {cat['id']} — {cat['label']}")
        for c in cat["checks"]:
            checks_block.append(f"- [{c['id']}] (severity_if_fail={c['severity_if_fail']}) : {c['question']}")
    checks_text = "\n".join(checks_block)
    return f"""You audit the visual rendering of a French web page for the Mettrik AI app
(investor KPI intelligence). Below is a list of YES/NO checks. For each check,
inspect the provided screenshot and decide whether it PASSES or FAILS.

Return JSON ONLY, no commentary, schema:

{{
  "checks": [
    {{"id": "<check_id>", "pass": true | false, "observation": "<short FR if fail, empty if pass>"}}
  ]
}}

RULES:
- Use the check id verbatim.
- pass=true means the check is satisfied.
- pass=false → fill observation with a SHORT French explanation (<= 80 chars)
  pointing at the actual visible defect.
- Do NOT add checks that are not in the list.
- If a section/block is not visible at all on the screenshot (cropped or absent),
  return pass=true and observation="non visible sur capture" (not a fail unless
  the block should be mandatory like hero/header).
- Output one entry per check id, no duplicates.
- No markdown fences. JSON only.

CHECKS:
{checks_text}
"""


def screenshot(url: str, png_path: Path, timeout: int = 45) -> bool:
    if png_path.exists():
        png_path.unlink()
    cmd = [
        CHROME, "--headless=new", "--hide-scrollbars",
        "--disable-gpu", "--no-first-run", "--disable-extensions",
        "--window-size=1280,2400",
        f"--screenshot={png_path}",
        url,
    ]
    try:
        # Chrome --headless=new exits on its own once page is loaded, but
        # can hang on slow dev server. Hard kill after `timeout` sec.
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
    except Exception:
        return False
    return png_path.exists() and png_path.stat().st_size > 5000


def call_gemini(prompt: str, image_path: Path, api_key: str, retries: int = 2):
    img_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": img_b64}},
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "response_mime_type": "application/json",
            "max_output_tokens": 4096,
        },
    }
    data = json.dumps(body).encode()
    url = f"{GEMINI_URL}?key={api_key}"
    headers = {"content-type": "application/json"}
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            cand = (resp.get("candidates") or [{}])[0]
            parts = (cand.get("content") or {}).get("parts") or [{}]
            text = parts[0].get("text", "")
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", text, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            code = e.code
            body_err = e.read().decode("utf-8", errors="ignore")[:200]
            if code == 429 and attempt < retries:
                time.sleep(20)
                continue
            print(f"  HTTP {code}: {body_err}", flush=True)
            return None
        except Exception as ex:
            print(f"  Ex {type(ex).__name__}: {ex}", flush=True)
            time.sleep(3)
    return None


def load_universe(args) -> list[str]:
    if args.tickers:
        return [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    if args.top307:
        arr = json.loads((ROOT / "src/data/v1-8-tickers-sorted.json").read_text())
        return [t.upper() for t in arr[:307]]
    if args.all_v17:
        v17 = json.loads((ROOT / "src/data/v1-7-public.json").read_text())
        return list(v17.keys())
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", type=str)
    ap.add_argument("--top307", action="store_true")
    ap.add_argument("--all-v17", action="store_true", dest="all_v17")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--base-url", type=str, default="https://mettrik-staging.vercel.app")
    ap.add_argument("--route-prefix", type=str, default="/sandbox/v1-8")
    ap.add_argument("--sleep", type=float, default=2.0)
    ap.add_argument("--force", action="store_true", help="Re-audit même si déjà vu")
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY introuvable"); sys.exit(1)

    template = yaml.safe_load(TEMPLATE.read_text())
    prompt = build_prompt(template)

    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    universe = load_universe(args)
    if not universe:
        print("❌ Aucun ticker (use --tickers or --top307 or --all-v17)"); sys.exit(1)
    if args.limit:
        universe = universe[: args.limit]

    # Load existing audit
    existing = {}
    if OUT.exists():
        try: existing = json.loads(OUT.read_text())
        except: existing = {}

    pending = [t for t in universe if args.force or t not in existing.get("results", {})]
    print(f"📸 {len(pending)} stés à auditer (univers={len(universe)})", flush=True)

    audited = existing.get("results", {})
    ok = 0; shot_fail = 0; ai_fail = 0
    last_call = 0.0

    for i, t in enumerate(pending):
        elapsed = time.time() - last_call
        if elapsed < args.sleep:
            time.sleep(args.sleep - elapsed)
        last_call = time.time()

        audit_token = os.environ.get("VISUAL_AUDIT_TOKEN", "")
        token_qs = f"?audit_token={audit_token}" if audit_token else ""
        url = f"{args.base_url}{args.route_prefix}/{t.lower()}{token_qs}"
        png = CACHE / f"{t.lower()}.png"
        ok_shot = screenshot(url, png)
        if not ok_shot:
            shot_fail += 1
            audited[t] = {"ticker": t, "url": url, "error": "screenshot_failed", "ts": datetime.now(timezone.utc).isoformat()}
            continue

        result = call_gemini(prompt, png, api_key)
        if not result or "checks" not in result:
            ai_fail += 1
            audited[t] = {"ticker": t, "url": url, "error": "gemini_no_response", "ts": datetime.now(timezone.utc).isoformat()}
            continue

        # Aggrégation : compter fails par severity
        # Map severity from template
        sev_map = {}
        for cat in template["categories"]:
            for c in cat["checks"]:
                sev_map[c["id"]] = c["severity_if_fail"]
        fails = []
        for ch in result.get("checks", []):
            if ch.get("pass") is False:
                fails.append({
                    "id": ch.get("id"),
                    "severity": sev_map.get(ch.get("id"), 3),
                    "obs": (ch.get("observation") or "")[:120],
                })
        blocker = any(f["severity"] >= template["global_pass_threshold"]["blocker_severity"] for f in fails)
        audited[t] = {
            "ticker": t,
            "url": url,
            "ts": datetime.now(timezone.utc).isoformat(),
            "n_fails": len(fails),
            "blocker": blocker,
            "fails": fails,
        }
        ok += 1
        if (i + 1) % 10 == 0:
            print(f"  …{i+1}/{len(pending)} ok={ok} shot_fail={shot_fail} ai_fail={ai_fail}", flush=True)
            # Persist incremental
            OUT.write_text(json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "results": audited}, indent=2, ensure_ascii=False))

    OUT.write_text(json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "results": audited}, indent=2, ensure_ascii=False))
    print(f"\n✅ Audit fini : {ok} stés auditées, {shot_fail} shot fails, {ai_fail} ai fails", flush=True)
    print(f"   Écrit : {OUT}")


if __name__ == "__main__":
    main()
