#!/usr/bin/env python3
"""
scripts/verif-coherence-tam.py : controle de coherence des positions de marche (Yann, 13 oct 2026).

Signale, sur les VRAIES donnees, toute position marche ou :
  - le revenu du segment depasse la taille du marche (unites converties : M, Mds, K) ;
  - la part captee (revenu / marche) depasse 100 % (meme test, exprime en part) ;
  - le marche ou le revenu est nul, negatif ou absent ;
  - les devises du revenu et du marche different (comparaison non garantie).

Sources lues, comme le chargeur des fiches (src/lib/company-core/load-company.ts) :
  - src/data/v2-pipeline-enrich/<t>.tam.json (demande) ;
  - src/data/v2-pipeline-enrich/<t>.json quand il porte ses propres market_positions
    et que le tam.json n est pas un arbitrage du proprietaire (c est alors lui qui est servi).

Ne corrige RIEN : liste seulement. Univers principal = src/data/v1-9-5-clean-all-tickers.json.

Usage : python3 scripts/verif-coherence-tam.py [--tout] [--json chemin] [--strict]
  --tout   : inclut les fichiers hors univers principal
  --strict : code de retour 1 si au moins une incoherence bloquante
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
TOUT = "--tout" in sys.argv
STRICT = "--strict" in sys.argv
JSON_OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None


def facteur(unite: str | None) -> float:
    """Meme regle que enMilliards (src/lib/desk/tam-apercu.ts)."""
    u = re.sub(r"[\s$€£]", "", unite or "")
    if re.fullmatch(r"M|m|Mn|Mio", u):
        return 1e-3
    if re.fullmatch(r"K|k", u):
        return 1e-6
    return 1.0


def devise(unite: str | None) -> str:
    u = unite or ""
    for d in ("CHF", "€", "£", "$"):
        if d in u:
            return d
    return "?"


def lit(p: Path):
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def univers() -> set[str]:
    d = lit(ROOT / "src/data/v1-9-5-clean-all-tickers.json") or {}
    return {t.upper() for t in d.get("tickers", [])}


def positions_servies(stem: str):
    """(source, positions) effectivement servies, meme priorite que le chargeur."""
    tam = lit(ENRICH / f"{stem}.tam.json")
    principal = lit(ENRICH / f"{stem}.json")
    if isinstance(tam, dict) and tam.get("_arbitrage_proprietaire") is True and isinstance(tam.get("market_positions"), list):
        return f"{stem}.tam.json", tam["market_positions"]
    if isinstance(principal, dict) and isinstance(principal.get("market_positions"), list):
        return f"{stem}.json", principal["market_positions"]
    if isinstance(tam, dict) and isinstance(tam.get("market_positions"), list):
        return f"{stem}.tam.json", tam["market_positions"]
    return None, []


def controle(p: dict) -> list[str]:
    defauts = []
    rev, tam = p.get("segment_revenue"), p.get("tam")
    if not isinstance(tam, (int, float)) or tam <= 0:
        defauts.append("taille du marche absente, nulle ou negative")
    if not isinstance(rev, (int, float)) or rev <= 0:
        defauts.append("revenu du segment absent, nul ou negatif")
    if defauts:
        return defauts
    rev_mds = rev * facteur(p.get("segment_unit"))
    tam_mds = tam * facteur(p.get("tam_unit"))
    part = rev_mds / tam_mds * 100
    if rev_mds > tam_mds:
        defauts.append(f"revenu du segment > taille du marche, part captee {part:.1f} % > 100 %")
    if devise(p.get("segment_unit")) != devise(p.get("tam_unit")):
        defauts.append(f"devises differentes ({p.get('segment_unit')} / {p.get('tam_unit')})")
    return defauts


def main():
    u = univers()
    stems = sorted({f.name[: -len(".tam.json")] for f in ENRICH.glob("*.tam.json")})
    lignes = []
    vus = 0
    for stem in stems:
        t = stem.upper()
        if not TOUT and t not in u:
            continue
        source, pos = positions_servies(stem)
        # La demande vise les tam.json : on controle aussi le tam.json lui meme s il differe de la source servie.
        a_controler = [(source, pos)]
        if source and not source.endswith(".tam.json"):
            tam = lit(ENRICH / f"{stem}.tam.json")
            if isinstance(tam, dict) and isinstance(tam.get("market_positions"), list):
                a_controler.append((f"{stem}.tam.json (non servi)", tam["market_positions"]))
        for src, liste in a_controler:
            for p in liste or []:
                if not isinstance(p, dict):
                    continue
                vus += 1
                for d in controle(p):
                    rev, tam = p.get("segment_revenue"), p.get("tam")
                    lignes.append({
                        "ticker": t, "source": src, "segment": p.get("segment_name"),
                        "revenu": f"{rev} {p.get('segment_unit')}", "marche": f"{tam} {p.get('tam_unit')}", "defaut": d,
                    })
    bloquants = [l for l in lignes if not l["defaut"].startswith("devises")]
    print(f"Positions controlees : {vus} ({'tous fichiers' if TOUT else 'univers principal'})")
    print(f"Incoherences : {len(bloquants)} bloquantes, {len(lignes) - len(bloquants)} a verifier (devises)")
    for l in lignes:
        print(f"- {l['ticker']:<9} {l['source']:<32} {l['segment'][:70]!s:<70} | {l['revenu']} / {l['marche']} | {l['defaut']}")
    societes = sorted({l["ticker"] for l in bloquants})
    print(f"Societes touchees (bloquant) : {len(societes)} {' '.join(societes)}")
    if JSON_OUT:
        Path(JSON_OUT).write_text(json.dumps({"positions": vus, "incoherences": lignes, "societes": societes}, ensure_ascii=False, indent=1))
    if STRICT and bloquants:
        sys.exit(1)


if __name__ == "__main__":
    main()
