#!/usr/bin/env python3
"""
Génère les templates GICS sub-industry manquants via Cerebras.

Lit src/lib/kpi-templates-by-subindustry.json + gics-code-lookup.json,
identifie les codes 8-digit sans template, génère un template par code
via Cerebras, et merge dans le fichier templates.

Usage : python3 scripts/generate-missing-templates.py
"""
import json
import os
import sys
import time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "src/lib"

CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY", "")
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "qwen-3-235b-a22b-instruct-2507"

SYSTEM = """Tu es un analyste financier expert en KPIs sectoriels. Pour chaque sous-industrie GICS donnée, génère un template JSON avec les KPIs les plus pertinents que les investisseurs suivent dans ce secteur.

CONTRAINTES :
- 5 hero_candidates : KPIs distinctifs ("wow") spécifiques au secteur, pas génériques
- 3-5 standard_kpis : KPIs financiers classiques pertinents (revenue, marge, etc.)
- 2-3 story_short_history : KPIs narratifs (innovation, marché, adoption)
- name_fr SANS accent sur 'represente/representant/represente' (règle Mettrik)
- name_en : terminologie anglaise standard du secteur
- explanation : 1-2 phrases concrètes, pas de jargon vague

Format JSON strict (clés exactes) :
{
  "name": "...",
  "name_fr": "...",
  "parent_industry_group": "...",
  "hero_candidates": [
    {"short": "...", "name_fr": "...", "name_en": "...", "explanation": "...", "wow_or_generic": "wow"}
  ],
  "standard_kpis": [
    {"short": "...", "name_fr": "...", "name_en": "...", "explanation": "..."}
  ],
  "story_short_history": [
    {"short": "...", "name_fr": "...", "name_en": "...", "explanation": "...", "story_category": "Innovation|Marché|Adoption|Capacité"}
  ]
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire."""


def generate_template(code: str, name: str) -> dict | None:
    user = f'Code GICS : {code}\nSous-industrie : "{name}"\n\nGénère le template JSON.'
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
    }
    headers = {"Authorization": f"Bearer {CEREBRAS_API_KEY}", "Content-Type": "application/json"}
    try:
        r = requests.post(CEREBRAS_URL, headers=headers, json=body, timeout=120)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        return json.loads(text)
    except Exception as e:
        print(f"  [err] {code}: {e}", flush=True)
        return None


def main():
    if not CEREBRAS_API_KEY:
        print("[fatal] CEREBRAS_API_KEY missing", file=sys.stderr)
        sys.exit(1)

    templates_path = LIB / "kpi-templates-by-subindustry.json"
    tdata = json.loads(templates_path.read_text())
    templates = tdata.get("SUBINDUSTRY_TEMPLATES", {})

    g = json.loads((LIB / "gics-code-lookup.json").read_text())
    rev = {v: k for k, v in g.get("NAME_TO_CODE", {}).items()}
    all_subs = {code: name for name, code in g.get("NAME_TO_CODE", {}).items() if len(code) == 8}

    missing = sorted(set(all_subs.keys()) - set(templates.keys()))
    print(f"À générer : {len(missing)} templates manquants")

    for i, code in enumerate(missing, 1):
        name = all_subs[code]
        print(f"  [{i}/{len(missing)}] {code} : {name}", flush=True)
        tpl = generate_template(code, name)
        if tpl and tpl.get("hero_candidates"):
            templates[code] = tpl
            # Save incremental
            tdata["SUBINDUSTRY_TEMPLATES"] = templates
            tdata.setdefault("_meta", {})["last_generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            templates_path.write_text(json.dumps(tdata, indent=2, ensure_ascii=False))
        time.sleep(0.5)

    print(f"\nTotal templates final : {len(templates)}")


if __name__ == "__main__":
    main()
