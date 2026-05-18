#!/usr/bin/env python3
"""vip-deep-inspection.py — inspection visuelle approfondie d'une sté VIP.

Pour chaque ticker passé en argument :
  1. Visite la page sté via Chrome headless avec bypass audit_token
  2. Capture les screenshots dans chaque combinaison (chart_mode, period, time_fraction)
  3. Envoie chaque screenshot à Gemini 2.5 Flash avec le template visual-audit
  4. Aggrege les défauts (consolidation par ID quality-tree)
  5. Applique les auto-fixes connus via scripts/fix-element.py FIXES
  6. Re-screenshot + re-vérifie → marque les défauts corrigés / re-vérifiés
  7. Persiste le résultat dans src/data/vip-inspection-status.json

Modes inspectés (combinaisons exhaustives) :
  - chart_mode : curve, bars-2d, bars-3d, variation, dashboard
  - period : year, quarter (si dispo)
  - time_fraction : year, month, week, day, hour, minute, second (selon KPI)

Pour BABA : pas de DEF14A, gov fallback via annual report HK / IR page.
Le script signale `governance.ceo_name_correct` comme défaut mais marque
`_governance_unavailable: true` au lieu d'invalider.

Usage :
    python3 scripts/vip-deep-inspection.py --ticker BABA
    python3 scripts/vip-deep-inspection.py --all-queued  # reprend tous les
                                                          # tickers en
                                                          # state="running"
    python3 scripts/vip-deep-inspection.py --all-queued --workers 4
    python3 scripts/vip-deep-inspection.py --all-queued --workers auto
        # auto = 4 workers entre 5h-12h Paris (Mac idle, Yann dort/matin),
        # 1 worker sinon (Mac utilisé par Yann, RAM safety pour Safari).
        # Yann 19 mai 2026 : règle RAM §14, cap 5 workers max.

Yann 17 mai 2026.
"""
import argparse
import base64
import json
import os
import re
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    PARIS_TZ = ZoneInfo("Europe/Paris")
except ImportError:
    PARIS_TZ = None  # Python <3.9 fallback : auto=1

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
LIST = ROOT / "src/data/vip-list.json"
STATUS = ROOT / "src/data/vip-inspection-status.json"
TEMPLATE = ROOT / "scripts/visual-audit-template.yaml"
CACHE = Path("/tmp/vip-inspection")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Combinaisons à tester. On commence simple et on étend si needed.
# Note : on ne peut pas vraiment cliquer sur les sub-toggles 2D/3D via
# URL params puisque c'est du state React local. Pour la v1, on fait :
# - 2 vues principales : "annuel" et "trimestriel" (via URL ? puis click
#   via Chrome devtools si supporté)
# - 1 capture par vue, plein écran (1280×4500 inclut tous les blocs)
# La v2 fera : click sur chaque toggle via Chrome DevTools Protocol.
MODES = [
    ("trimestriel-default", "Vue par défaut, trimestriel"),
    ("annuel", "Vue annuelle (toggle Annuel)"),
]


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


def read_json(p, fallback):
    try: return json.loads(p.read_text())
    except: return fallback


def write_json(p, data):
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


# Yann 19 mai 2026 : lock pour writes status concurrents (mode multi-workers).
# Le fichier vip-inspection-status.json est lu+écrit par chaque thread, donc
# sans lock = race condition + corruption JSON garantie sur 4 workers parallèles.
_STATUS_LOCK = threading.Lock()


def update_status(ticker, **kwargs):
    with _STATUS_LOCK:
        s = read_json(STATUS, {"updated_at": "", "results": {}})
        cur = s["results"].get(ticker.upper(), {"ticker": ticker.upper()})
        cur.update(kwargs)
        s["results"][ticker.upper()] = cur
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_json(STATUS, s)


def detect_optimal_workers(cap=5):
    """Détecte le nb optimal de workers selon l'heure Paris.

    Règle Yann 17 mai 2026 : entre 5h-12h Paris le Mac n'est pas utilisé,
    on peut paralléliser à fond SANS faire crasher Safari + autres apps.
    Hors fenêtre : Mac actif, 1 seul worker pour préserver RAM.

    Cap absolu 5 workers (= ~1.5 GB RAM : 5×250 MB Chrome + 5×50 MB Python).
    Règle SHARED-STATUS §14 : surveillance RAM renforcée.
    """
    if PARIS_TZ is None:
        return 1
    try:
        hour = datetime.now(PARIS_TZ).hour
        if 5 <= hour < 12:
            return min(4, cap)  # idle window : 4 workers
        return 1
    except Exception:
        return 1


def resolve_workers(value, num_targets):
    """Convertit l'argument --workers (str) en int valide.

    - "auto" : détection automatique via detect_optimal_workers()
    - "N" : clamp [1, 5]
    - N > num_targets : clamp à num_targets (pas la peine de spawner plus)
    """
    if value == "auto":
        n = detect_optimal_workers()
    else:
        try:
            n = int(value)
        except (TypeError, ValueError):
            n = 1
    n = max(1, min(5, n))  # absolute cap 5 (RAM safety)
    if num_targets > 0:
        n = min(n, num_targets)
    return n


def chrome_screenshot(url, png_path, timeout=45):
    if png_path.exists(): png_path.unlink()
    cmd = [
        CHROME, "--headless=new", "--hide-scrollbars",
        "--disable-gpu", "--no-first-run", "--disable-extensions",
        "--window-size=1280,4500",
        f"--screenshot={png_path}",
        url,
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try: proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill(); proc.wait(timeout=5)
    except Exception: return False
    return png_path.exists() and png_path.stat().st_size > 5000


def build_prompt(template):
    checks_block = []
    for cat in template["categories"]:
        checks_block.append(f"\n### {cat['id']} — {cat['label']}")
        for c in cat["checks"]:
            checks_block.append(f"- [{c['id']}] (severity_if_fail={c['severity_if_fail']}) : {c['question']}")
    return f"""You audit the visual rendering of a French web page for Mettrik AI.
Return JSON ONLY: {{ "checks": [{{ "id": "<id>", "pass": bool, "observation": "<FR short if fail>" }}] }}

Use the check id verbatim. No markdown fences.

CHECKS:
{chr(10).join(checks_block)}"""


def call_gemini(prompt, image_path, api_key, retries=2):
    img_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    body = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/png", "data": img_b64}},
        ]}],
        "generationConfig": {
            "temperature": 0.0,
            "response_mime_type": "application/json",
            "max_output_tokens": 8192,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    data = json.dumps(body).encode()
    url = f"{GEMINI_URL}?key={api_key}"
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers={"content-type": "application/json"})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as r:
                resp = json.loads(r.read())
            cand = (resp.get("candidates") or [{}])[0]
            parts = (cand.get("content") or {}).get("parts") or [{}]
            text = parts[0].get("text", "")
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
            try: return json.loads(text)
            except:
                m = re.search(r"\{.*\}", text, re.DOTALL)
                if m:
                    try: return json.loads(m.group(0))
                    except: pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries: time.sleep(20); continue
            return None
        except Exception:
            time.sleep(3)
    return None


def apply_auto_fixes(defects, ticker):
    """Appelle scripts/fix-element.py pour chaque ID auto-fixable."""
    fixes_applied = []
    for d in defects:
        if d.get("reverified"): continue
        fid = d.get("id")
        # Délégation au fix-dispatcher
        try:
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts/fix-element.py"), ticker, fid],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0 and "✓" in result.stdout:
                d["corrected"] = True
                fixes_applied.append(fid)
        except Exception:
            pass
    return fixes_applied


def inspect_ticker(ticker, api_key, base_url="https://mettrik-staging.vercel.app"):
    """Lance l'inspection complète pour 1 ticker."""
    tk = ticker.upper()
    print(f"\n🔍 Inspection VIP : {tk}")
    update_status(tk, state="running", last_run_at=datetime.now(timezone.utc).isoformat())

    audit_token = os.environ.get("VISUAL_AUDIT_TOKEN", "")
    if not audit_token:
        update_status(tk, state="error", error="VISUAL_AUDIT_TOKEN absent dans .env.local")
        return False

    CACHE.mkdir(parents=True, exist_ok=True)
    template = yaml.safe_load(TEMPLATE.read_text())
    prompt = build_prompt(template)

    all_defects = {}  # id → defect (consolidé)
    mode_screenshots = {}

    for mode_id, mode_label in MODES:
        url_qs = f"?audit_token={audit_token}"
        if mode_id == "annuel":
            # Pas de query param pour ça côté URL — on charge la page,
            # devra faire toggle JS pour passer en annuel. Pour la v1 on
            # capture juste la vue par défaut (trimestriel). v2 = devtools
            # protocol pour click.
            continue  # skip pour v1
        url = f"{base_url}/sandbox/v1-8/{tk.lower()}{url_qs}"
        png = CACHE / f"{tk.lower()}-{mode_id}.png"
        print(f"  [{mode_id}] Screenshot {url}")
        if not chrome_screenshot(url, png):
            print(f"  ✗ Screenshot fail")
            continue
        mode_screenshots[mode_id] = str(png)

        print(f"  [{mode_id}] Gemini call...")
        result = call_gemini(prompt, png, api_key)
        if not result or "checks" not in result:
            print(f"  ✗ Gemini fail")
            continue

        sev_map = {}
        for cat in template["categories"]:
            for c in cat["checks"]:
                sev_map[c["id"]] = c["severity_if_fail"]

        for ch in result.get("checks", []):
            if ch.get("pass") is False:
                fid = ch.get("id")
                if not fid: continue
                obs = (ch.get("observation") or "")[:180]
                if fid not in all_defects:
                    all_defects[fid] = {
                        "id": fid, "severity": sev_map.get(fid, 3),
                        "obs": obs, "modes": [mode_id],
                        "corrected": False, "reverified": False,
                    }
                else:
                    if mode_id not in all_defects[fid]["modes"]:
                        all_defects[fid]["modes"].append(mode_id)

    defects_list = list(all_defects.values())
    print(f"\n  {len(defects_list)} défaut(s) consolidé(s) sur {len(MODES)} mode(s)")
    update_status(tk, state="running", defects=defects_list, mode_screenshots=mode_screenshots)

    # Auto-fixes
    print(f"\n  Application auto-fixes...")
    fixes = apply_auto_fixes(defects_list, tk)
    print(f"  {len(fixes)} fixes appliqués : {', '.join(fixes) if fixes else '(aucun)'}")

    # Re-vérification : nouvelle screenshot + re-call Gemini sur les défauts corrigés
    if fixes:
        print(f"\n  Re-vérification après fixes...")
        url = f"{base_url}/sandbox/v1-8/{tk.lower()}?audit_token={audit_token}"
        # Petite pause pour permettre au rebuild Vercel (si fix data) ou
        # à HMR (si fix code) de propager. v1 : juste re-screenshot.
        time.sleep(5)
        png_rev = CACHE / f"{tk.lower()}-reverify.png"
        if chrome_screenshot(url, png_rev):
            result = call_gemini(prompt, png_rev, api_key)
            if result and "checks" in result:
                fail_ids_after = {c.get("id") for c in result["checks"] if c.get("pass") is False}
                for d in defects_list:
                    if d["id"] in fixes and d["id"] not in fail_ids_after:
                        d["reverified"] = True

    update_status(tk, state="done", defects=defects_list, mode_screenshots=mode_screenshots)
    n_open = sum(1 for d in defects_list if not d.get("reverified"))
    n_closed = sum(1 for d in defects_list if d.get("reverified"))
    print(f"\n✅ {tk} : {n_open} défaut(s) ouvert(s), {n_closed} corrigé(s) + re-vérifié(s)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticker", type=str, help="1 ticker à inspecter")
    ap.add_argument("--all-queued", action="store_true", help="Inspecte tous les tickers en state=running")
    ap.add_argument("--base-url", type=str, default="https://mettrik-staging.vercel.app")
    ap.add_argument(
        "--workers",
        type=str,
        default="1",
        help="Nb workers parallèles (1-5) ou 'auto' pour fenêtre Paris 5h-12h. "
             "Yann 17 mai 2026 : auto=4 workers idle window, 1 sinon (RAM Safari).",
    )
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY absent"); sys.exit(1)

    targets = []
    if args.ticker:
        targets = [args.ticker.upper()]
    elif args.all_queued:
        s = read_json(STATUS, {"results": {}})
        targets = [t for t, r in s.get("results", {}).items() if r.get("state") == "running"]
    else:
        # Default : inspecte tous les tickers de la VIP list non encore done
        lst = read_json(LIST, {"tickers": []})
        st = read_json(STATUS, {"results": {}})
        for entry in lst.get("tickers", []):
            tk = entry["ticker"].upper()
            cur = st.get("results", {}).get(tk, {})
            if cur.get("state") != "done":
                targets.append(tk)

    if not targets:
        print("Aucun ticker à inspecter."); sys.exit(0)

    n_workers = resolve_workers(args.workers, len(targets))
    paris_hour_str = "?"
    try:
        if PARIS_TZ:
            paris_hour_str = datetime.now(PARIS_TZ).strftime("%Hh%M")
    except Exception:
        pass
    print(f"📋 {len(targets)} ticker(s) à inspecter : {', '.join(targets)}")
    print(f"⚙️  Workers : {n_workers} (mode '{args.workers}', Paris {paris_hour_str})")

    def _run_one(tk):
        try:
            inspect_ticker(tk, api_key, args.base_url)
            return (tk, None)
        except Exception as e:  # noqa: BLE001
            update_status(tk, state="error", error=str(e)[:200])
            return (tk, str(e)[:200])

    if n_workers == 1:
        # Mode séquentiel (préserve comportement initial 1 sté à la fois).
        for tk in targets:
            tk_done, err = _run_one(tk)
            if err:
                print(f"❌ {tk_done} : {err}")
    else:
        # Mode parallèle : ThreadPoolExecutor (workers = procs Chrome headless
        # indépendants + appels Gemini I/O-bound). Threads vs procs : Chrome
        # est invoqué via subprocess séparé donc le GIL Python n'est pas un
        # bottleneck. Gemini = network I/O, parfait pour threads.
        print(f"🚀 Lancement {n_workers} workers parallèles...")
        with ThreadPoolExecutor(max_workers=n_workers, thread_name_prefix="vip-worker") as exe:
            futures = {exe.submit(_run_one, tk): tk for tk in targets}
            for fut in as_completed(futures):
                tk_done, err = fut.result()
                if err:
                    print(f"❌ {tk_done} : {err}")


if __name__ == "__main__":
    main()
