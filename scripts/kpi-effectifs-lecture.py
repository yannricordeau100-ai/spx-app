#!/usr/bin/env python3
"""
Lit l effectif dans les passages preparees (Yann 3 sept 2026).

Un seul appel au moteur par societe : tous ses exercices sont soumis
ensemble, avec les extraits deja isoles par kpi-effectifs-extraits.py. Le
modele ne voit jamais un rapport entier, seulement quelques lignes.

Regles imposees au moteur :
  - repondre le nombre TOTAL d employes du groupe, tel qu ecrit ;
  - ne jamais estimer ni deduire : si le passage ne le dit pas, repondre null ;
  - ignorer les effectifs partiels (un segment, un pays, les interimaires).

Un garde-fou mecanique rejette ensuite toute valeur qui n apparait pas
litteralement dans les extraits de l annee : le moteur ne peut pas inventer.

Sortie : src/data/kpi-effectifs/<TICKER>.json
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTREE = ROOT / ".conv-state/effectifs-extraits"
SORTIE = ROOT / "src/data/kpi-effectifs"

CONSIGNE = """Tu lis des extraits de rapports annuels 10-K deposes a la SEC.
Pour CHAQUE depot liste, donne l effectif TOTAL du groupe tel qu il est ecrit.

Regles strictes :
- Le nombre doit apparaitre TEL QUEL dans l extrait. N estime jamais, ne deduis
  jamais, n arrondis pas, ne reporte pas la valeur d une autre annee.
- Si l extrait donne "approximately 166,000 employees", reponds 166000.
- Si l extrait exprime en milliers ("2.1 million"), convertis en unites (2100000).
- Ignore les effectifs partiels : un segment, un pays, une filiale, les
  interimaires seuls, les actionnaires, les porteurs de titres.
- Si l effectif total ne figure pas dans l extrait, reponds null pour ce depot.

Reponds UNIQUEMENT par un objet JSON, sans phrase autour :
{"2025-10-31": 166000, "2024-11-01": null}
Les cles sont exactement les dates de depot fournies."""


def appelle_moteur(prompt: str, essais: int = 2) -> str | None:
    env = dict(os.environ)
    # Le profil dedie ~/.claude-20x n est plus connecte (constat 3 sept 2026) :
    # on utilise la session par defaut.
    env.pop("CLAUDE_CONFIG_DIR", None)
    for _ in range(essais):
        try:
            out = subprocess.run(
                ["claude", "-p", "--model", "sonnet", "--output-format", "text"],
                input=prompt, capture_output=True, text=True, timeout=300, env=env,
            )
            if out.returncode == 0 and "Not logged in" not in out.stdout[:200]:
                return out.stdout
        except Exception:
            pass
    return None


def nombres_du_texte(txt: str) -> set[int]:
    """Tous les entiers plausibles ecrits dans l extrait, pour le garde-fou."""
    vals = set()
    for m in re.finditer(r"\b(\d{1,3}(?:,\d{3})+|\d{3,})\b", txt):
        try:
            vals.add(int(m.group(1).replace(",", "")))
        except ValueError:
            pass
    for m in re.finditer(r"\b(\d{1,3}(?:\.\d+)?)\s*(million|thousand)\b", txt, re.I):
        base = float(m.group(1))
        vals.add(int(base * (1_000_000 if m.group(2).lower() == "million" else 1_000)))
    return vals


def traite(ticker: str) -> dict | None:
    src = ENTREE / f"{ticker}.json"
    if not src.exists():
        return None
    d = json.loads(src.read_text())
    annees = d.get("annees") or []
    if not annees:
        return None
    blocs = []
    for a in annees:
        extraits = " […] ".join(a["extraits"])[:4000]
        blocs.append(f'--- depot {a["depot"]} ---\n{extraits}')
    prompt = f"{CONSIGNE}\n\nSociete : {ticker}\n\n" + "\n\n".join(blocs)
    rep = appelle_moteur(prompt)
    if not rep:
        return None
    m = re.search(r"\{.*\}", rep, re.S)
    if not m:
        return None
    try:
        brut = json.loads(m.group(0))
    except Exception:
        return None
    points, rejets = [], []
    for a in annees:
        v = brut.get(a["depot"])
        if not isinstance(v, (int, float)) or v <= 0:
            continue
        v = int(v)
        # Garde-fou : la valeur doit exister litteralement dans les extraits de
        # CE depot. Un agent a deja invente des trimestres par le passe.
        presents = nombres_du_texte(" ".join(a["extraits"]))
        if v not in presents:
            rejets.append({"depot": a["depot"], "valeur": v, "motif": "absent des extraits"})
            continue
        points.append({"depot": a["depot"], "valeur": v, "fichier": a["fichier"]})
    if len(points) < 3:
        return {"ticker": ticker, "points": points, "rejets": rejets, "insuffisant": True}
    return {"ticker": ticker, "method": "10k-human-capital", "points": points, "rejets": rejets}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    # Trois tranches en parallele au maximum : au-dela, le Mac souffre et le
    # moteur se met a repondre plus lentement qu il n accelere le travail.
    ap.add_argument("--tranche", help="i/n, ex 1/3")
    a = ap.parse_args()
    SORTIE.mkdir(parents=True, exist_ok=True)
    if a.tickers:
        liste = [t.strip().upper() for t in a.tickers.split(",") if t.strip()]
    else:
        liste = sorted(p.stem for p in ENTREE.glob("*.json"))
    if a.tranche:
        i, n = (int(x) for x in a.tranche.split("/"))
        liste = [t for j, t in enumerate(liste) if j % n == (i - 1)]
    if a.limit:
        liste = liste[: a.limit]
    faits = rates = 0
    for i, t in enumerate(liste, 1):
        dest = SORTIE / f"{t}.json"
        if dest.exists() and not a.force:
            faits += 1
            continue
        r = traite(t)
        if r and not r.get("insuffisant"):
            dest.write_text(json.dumps(r, ensure_ascii=False, indent=1))
            faits += 1
            print(f"[{i}/{len(liste)}] {t} : {len(r['points'])} annees"
                  f"{', ' + str(len(r['rejets'])) + ' rejetees' if r['rejets'] else ''}", flush=True)
        else:
            rates += 1
            n = len(r["points"]) if r else 0
            print(f"[{i}/{len(liste)}] {t} : insuffisant ({n} annees retenues)", flush=True)
    print(f"FINI faits={faits} rates={rates}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
