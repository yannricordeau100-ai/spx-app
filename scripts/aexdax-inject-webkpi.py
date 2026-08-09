#!/usr/bin/env python3
# Injection des KPI web (livrables .conv-state/web-kpi/<T>.json) en stories WEB_*
# dans .batches-drafts-safe/kpis-haut/<T>.json, format identique aux N100.
# Idempotent : purge d'abord les WEB_* existants du ticker puis re-injecte.
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = json.load(open(f"{ROOT}/.conv-state/aexdax-state.json"))
CATS = ["Innovation", "Marché", "Adoption", "Capacité"]
TODAY = "2026-08-09"

def slug(label):
    s = unicodedata.normalize("NFD", label).encode("ascii", "ignore").decode()
    words = re.sub(r"[^A-Za-z0-9 ]", " ", s).upper().split()
    return "_".join(w[:8] for w in words[:3]) or "KPI"

def parse_val(v):
    if isinstance(v, (int, float)): return v
    try: return float(str(v).replace(" ", "").replace(",", "."))
    except Exception: return None

tot = 0; per = {}
for T in STATE["a_traiter"]:
    src = f"{ROOT}/.conv-state/web-kpi/{T}.json"
    dst = f"{ROOT}/.batches-drafts-safe/kpis-haut/{T}.json"
    if not (os.path.exists(src) and os.path.exists(dst)):
        per[T] = "SKIP (fichier manquant)"; continue
    try: web = json.load(open(src))
    except Exception as e:
        per[T] = f"SKIP (livrable invalide: {e})"; continue
    draft = json.load(open(dst))
    draft["kpis"] = [k for k in draft["kpis"] if not str(k.get("short","")).startswith("WEB_")]
    existing_names = {str(k.get("name_fr","")).lower() for k in draft["kpis"]}
    n = 0
    for i, k in enumerate(web.get("kpis", [])):
        if k.get("already_known"): continue
        label = k.get("label_fr") or ""
        val = parse_val(k.get("value"))
        if not label or val is None: continue
        if label.lower() in existing_names: continue
        short = "WEB_" + slug(label)
        base = short; j = 2
        while any(x.get("short") == short for x in draft["kpis"]):
            short = f"{base}_{j}"; j += 1
        periode = str(k.get("periode") or "2026")
        pourquoi = (k.get("pourquoi_distinctif") or "").strip().rstrip(".")
        story = {
            "short": short,
            "name_fr": label,
            "value": val,
            "unit": k.get("unit") or "",
            "is_short_history": True,
            "story_category": CATS[i % len(CATS)],
            "last_data_date": TODAY,
            "signal": (pourquoi + ". " if pourquoi else "") +
                      f"Chiffre publie sur le site de la societe (releve {periode}).",
            "_source": "site web societe: " + (k.get("url") or ""),
            "_source_month": "aout 2026",
            "history": [{"q": periode, "v": val}],
        }
        draft["kpis"].append(story); n += 1
    json.dump(draft, open(dst, "w"), ensure_ascii=False, indent=1)
    per[T] = n; tot += n

for t, n in per.items():
    if isinstance(n, str): print(t, n)
print("TOTAL stories WEB injectees:", tot, "sur", sum(1 for v in per.values() if isinstance(v, int)), "stes")
