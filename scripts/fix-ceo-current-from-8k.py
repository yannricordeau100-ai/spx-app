#!/usr/bin/env python3
"""
fix-ceo-current-from-8k.py — pose `ceo_current` / `ceo_current_since` sur les
fiches dont le PDG stocké a quitté ses fonctions selon un 8-K Item 5.02.

Sémantique du schéma (src/lib/data.ts, type Governance) :
  - `ceo_name`    = PDG couvert par le dernier proxy → porte la rémunération
  - `ceo_current` = PDG réellement en poste aujourd'hui (succession en cours
                    d'exercice). La carte gouvernance affiche alors
                    « X dirige la société depuis … ; la rémunération affichée
                    est celle de l'ex-PDG Y (dernier proxy, FYnnnn) ».

Chaque ligne du tableau ci-dessous a été lue et vérifiée à la main dans le
8-K cité (Item 5.02), audit du 15 août 2026 déclenché par le cas CSX.
Seules les transitions DÉJÀ EFFECTIVES au 2026-08-15 sont appliquées ; les
transitions annoncées pour plus tard (AAPL, COP, DG, DHR, DPZ, HRL, WST)
sont volontairement laissées telles quelles.
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT_DATE = "2026-08-15"

# ticker : (ex-PDG attendu, nouveau PDG, depuis, date effet ISO, 8-K source)
FIXES: dict[str, tuple[str, str, str, str, str]] = {
    "AIG":  ("Zaffino",   "Eric Andersen",         "juin 2026",     "2026-06-01", "8-K 2026-04-27"),
    "CAG":  ("Connolly",  "John Brase",            "juin 2026",     "2026-06-01", "8-K 2026-04-13"),
    "CI":   ("Cordani",   "Brian C. Evanko",       "juillet 2026",  "2026-07-01", "8-K 2026-03-03"),
    "CPRT": ("Liaw",      "A. Jayson Adair",       "juillet 2026",  "2026-07-31", "8-K 2026-06-29"),
    "DOW":  ("Fitterling", "Karen S. Carter",      "juillet 2026",  "2026-07-01", "8-K 2026-04-14"),
    "FAST": ("Florness",  "Jeffery M. Watts",      "juillet 2026",  "2026-07-16", "8-K 2025-12-22"),
    "FISV": ("Lyons",     "Takis Georgakopoulos",  "juin 2026",     "2026-06-14", "8-K 2026-06-15"),
    "HPQ":  ("Lores",     "Bruce Broussard (par intérim)", "février 2026", "2026-02-03", "8-K 2026-02-03"),
    "KR":   ("Sargent",   "Gregory S. Foran",      "février 2026",  "2026-02-10", "8-K 2026-02-09"),
    "MO":   ("Gifford",   "Salvatore Mancuso",     "mai 2026",      "2026-05-14", "8-K 2026-05-18"),
    "NRG":  ("Coben",     "Robert Gaudette",       "avril 2026",    "2026-04-30", "8-K 2026-01-07"),
    "POOL": ("Arvan",     "John B. Watwood",       "mai 2026",      "2026-05-04", "8-K 2026-05-04"),
    "STZ":  ("Newlands",  "Nicholas I. Fink",      "avril 2026",    "2026-04-13", "8-K 2026-02-12"),
    "TDG":  ("Stein",     "Michael J. Lisman",     "octobre 2025",  "2025-09-30", "8-K 2025-10-03"),
    "TGT":  ("Cornell",   "Michael J. Fiddelke",   "février 2026",  "2026-02-01", "8-K 2026-02-05"),
    "TXT":  ("Donnelly",  "Lisa M. Atherton",      "janvier 2026",  "2026-01-04", "8-K 2025-10-22"),
    "VMC":  ("Hill",      "Ronnie A. Pruitt",      "janvier 2026",  "2026-01-01", "8-K 2025-10-14"),
    "WDAY": ("Eschenbach", "Aneel Bhusri",         "février 2026",  "2026-02-06", "8-K 2026-03-06"),
}


def sniff_indent(path: str, default: int = 1) -> int:
    """Indentation d'origine du JSON, pour ne pas reformater tout le fichier."""
    try:
        with open(path, encoding="utf-8") as fh:
            fh.readline()
            line = fh.readline()
    except OSError:
        return default
    n = len(line) - len(line.lstrip(" "))
    return n if n > 0 else default


def patch(path: str, ticker: str, spec: tuple[str, str, str, str, str]) -> str:
    ex, new, since, eff, src = spec
    if not os.path.exists(path):
        return "absent"
    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)
    gov = d.get("governance")
    if not isinstance(gov, dict):
        return "pas de bloc governance"
    stored = str(gov.get("ceo_name") or "")
    if ex.lower() not in stored.lower():
        return f"SKIP ceo_name inattendu ({stored!r}, attendu ~{ex})"
    if gov.get("ceo_current") == new:
        return "déjà à jour"
    gov["ceo_current"] = new
    gov["ceo_current_since"] = since
    gov["_ceo_current_source"] = f"{src} Item 5.02 (effet {eff})"
    gov["_ceo_current_audited_at"] = AUDIT_DATE
    indent = sniff_indent(path)  # AVANT l'ouverture en "w" qui tronque le fichier
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=indent)
    return f"OK {stored} → {new}"


def main() -> int:
    changed = 0
    for ticker, spec in sorted(FIXES.items()):
        targets = [
            os.path.join(ROOT, "src/data/v2-pipeline", f"{ticker.lower()}.json"),
            os.path.join(ROOT, "data-lake", ticker, "gouvernance_fr.json"),
        ]
        # v2-pipeline
        r = patch(targets[0], ticker, spec)
        print(f"{ticker:6s} v2-pipeline      : {r}")
        if r.startswith("OK"):
            changed += 1
        # data-lake (même payload, clé "data")
        p = targets[1]
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                dl = json.load(fh)
            gov = dl.get("data")
            if isinstance(gov, dict) and spec[0].lower() in str(gov.get("ceo_name") or "").lower():
                gov["ceo_current"] = spec[1]
                gov["ceo_current_since"] = spec[2]
                gov["_ceo_current_source"] = f"{spec[4]} Item 5.02 (effet {spec[3]})"
                dl_indent = sniff_indent(p, 2)
                with open(p, "w", encoding="utf-8") as fh:
                    json.dump(dl, fh, ensure_ascii=False, indent=dl_indent)
                print(f"{ticker:6s} data-lake        : OK")
    print(f"\n{changed} fiches v2-pipeline modifiées")
    return 0


if __name__ == "__main__":
    sys.exit(main())
