#!/usr/bin/env python3
"""Passe de mise a jour en parallele, sous surveillance de la memoire.

Le Mac a 16 Go et a deja crashe. Chaque extraction lance un processus Claude
qui pese plusieurs centaines de Mo. Ce superviseur lance N extractions en
parallele et regarde la memoire libre AVANT chaque nouveau lancement :
  - au dessus du seuil confortable, il monte jusqu a --max travailleurs
  - en dessous, il redescend a 1 et attend
  - il n interrompt JAMAIS un travail en cours, il ralentit seulement

Usage :
  python3 scripts/refresh-superviseur.py --max 3
  python3 scripts/refresh-superviseur.py --max 3 --tickers A,B,C
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
UNIVERS = RACINE / "src" / "data" / "v1-9-5-clean-all-tickers.json"
ETAT_BASE = RACINE / ".conv-state"
JOURNAL = Path("/tmp/refresh-superviseur.log")

# Seuils exprimes en pourcentage de memoire libre, tel que macOS le voit.
# On lit `memory_pressure`, qui tient compte de la compression : c est la seule
# mesure fiable ici. vm_stat sert de secours, avec la vraie taille de page
# (16 Ko sur ce Mac, pas 4 Ko : l ancienne version sous estimait par quatre).
SEUIL_CONFORTABLE = 25.0  # au dessus : on monte jusqu au maximum demande
SEUIL_PRUDENT = 15.0      # entre les deux : deux travailleurs
SEUIL_UN_SEUL = 8.0       # en dessous : un seul
SEUIL_PAUSE = 4.0         # en dessous : on ne lance plus rien, on attend


def note(msg: str) -> None:
    ligne = f"[superviseur] {datetime.now(timezone.utc).isoformat()} {msg}"
    print(ligne, flush=True)
    with JOURNAL.open("a", encoding="utf8") as f:
        f.write(ligne + "\n")


def memoire_libre_pct() -> float:
    """Pourcentage de memoire libre vu par le systeme."""
    try:
        sortie = subprocess.run(
            ["memory_pressure"], capture_output=True, text=True, timeout=15
        ).stdout
        for ligne in sortie.splitlines():
            if "free percentage" in ligne:
                return float("".join(c for c in ligne.split(":")[-1] if c.isdigit() or c == "."))
    except Exception:  # noqa: BLE001
        pass
    try:
        sortie = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=10).stdout
        taille = 16384
        if "page size of" in sortie:
            taille = int("".join(c for c in sortie.split("page size of")[1].split("bytes")[0] if c.isdigit()))
        vals: dict[str, int] = {}
        for ligne in sortie.splitlines():
            if ":" not in ligne:
                continue
            cle, _, val = ligne.partition(":")
            chiffres = "".join(c for c in val if c.isdigit())
            if chiffres:
                vals[cle.strip()] = int(chiffres)
        total = sum(vals.get(k, 0) for k in (
            "Pages free", "Pages active", "Pages inactive",
            "Pages speculative", "Pages wired down",
        ))
        libre = vals.get("Pages free", 0) + vals.get("Pages inactive", 0)
        return 100.0 * libre / max(total, 1)
    except Exception:  # noqa: BLE001
        return 100.0


def univers() -> list[str]:
    d = json.loads(UNIVERS.read_text(encoding="utf8"))
    t = d.get("tickers") if isinstance(d, dict) else d
    return [str(x).upper() for x in t]


ETAT = ETAT_BASE / "refresh-superviseur-etat.json"


def fixe_etat(script: str) -> None:
    global ETAT, JOURNAL
    # Chaque script a son propre etat de reprise : deux missions differentes
    # partageaient le meme fichier quand leurs noms se ressemblaient.
    nom = Path(script).stem.replace("-refresh", "") or "refresh"
    ETAT = ETAT_BASE / f"{nom}-superviseur-etat.json"
    JOURNAL = Path(f"/tmp/{nom}-superviseur.log")


def deja_faits() -> set[str]:
    if not ETAT.exists():
        return set()
    try:
        return set(json.loads(ETAT.read_text(encoding="utf8")).get("faits", []))
    except Exception:  # noqa: BLE001
        return set()


def enregistre(faits: set[str]) -> None:
    ETAT.parent.mkdir(parents=True, exist_ok=True)
    ETAT.write_text(
        json.dumps({"faits": sorted(faits)}, ensure_ascii=False, indent=1),
        encoding="utf8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=3)
    ap.add_argument("--tickers")
    ap.add_argument(
        "--script",
        default="earnings-refresh.py",
        help="script a lancer par societe (earnings-refresh.py ou summaries-refresh.py)",
    )
    args = ap.parse_args()

    fixe_etat(args.script)
    cibles = (
        [t.strip().upper() for t in args.tickers.split(",")]
        if args.tickers
        else univers()
    )
    faits = deja_faits()
    file = [t for t in cibles if t not in faits]
    note(f"{len(file)} societes a traiter, {len(faits)} deja faites, max {args.max}")

    en_cours: dict[str, subprocess.Popen] = {}
    debut = time.time()
    while file or en_cours:
        # Recolte des travaux termines
        for t, p in list(en_cours.items()):
            if p.poll() is not None:
                del en_cours[t]
                faits.add(t)
                enregistre(faits)
                fini = len(faits)
                ecoule = time.time() - debut
                reste = len(file) + len(en_cours)
                vitesse = ecoule / max(fini - (len(cibles) - len(file) - len(en_cours) - fini + fini), 1)
                note(f"{t} termine (code {p.returncode}) | restant {reste}")

        libre = memoire_libre_pct()
        if libre < SEUIL_PAUSE:
            plafond = 0
        elif libre < SEUIL_UN_SEUL:
            plafond = 1
        elif libre < SEUIL_PRUDENT:
            plafond = min(2, args.max)
        elif libre < SEUIL_CONFORTABLE:
            plafond = min(2, args.max)
        else:
            plafond = args.max

        while file and len(en_cours) < plafond:
            t = file.pop(0)
            p = subprocess.Popen(
                ["nice", "-n", "10", "python3",
                 str(RACINE / "scripts" / args.script),
                 "--tickers", t]
                + (["--apply"] if args.script == "earnings-refresh.py" else []),
                cwd=str(RACINE),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            en_cours[t] = p
            note(f"lance {t} | en cours {len(en_cours)}/{plafond} | libre {libre:.0f} %")

        if not en_cours and not file:
            break
        time.sleep(4)

    note(f"FINI {len(faits)} societes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
