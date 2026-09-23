#!/usr/bin/env python3
"""Sonde des moteurs gratuits, appelee par les scripts shell.

Un script shell ne peut pas importer un module Python : cette passerelle
minimale existe pour que scripts/earnings-refresh.sh verifie qu un moteur
gratuit repond AVANT de lancer la passe, exactement comme l ancienne sonde
`claude -p` le faisait, mais sans jamais appeler Claude.

Sortie : une ligne "SONDE-OK <moteur>" si un moteur repond, sinon une ligne
"SONDE-ECHEC <cause>" et un code de retour 1.
"""
from __future__ import annotations

import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RACINE, "scripts"))

from moteur_gratuit import MoteurIndisponible, appelle, charge_env  # noqa: E402


def main() -> int:
    charge_env(os.path.join(RACINE, ".env.local"))
    try:
        texte, moteur = appelle("Reponds exactement : SONDE-OK")
    except MoteurIndisponible as e:
        print("SONDE-ECHEC %s" % str(e)[:160])
        return 1
    if "SONDE-OK" not in (texte or "").upper():
        print("SONDE-ECHEC reponse inattendue de %s : %s" % (moteur, (texte or "")[:80]))
        return 1
    print("SONDE-OK %s" % moteur)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
