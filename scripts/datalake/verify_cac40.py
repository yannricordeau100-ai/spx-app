#!/usr/bin/env python3
"""
verify_cac40.py - Anti-cross-pollution CAC 40. Pour CHAQUE sté, vérifie que
chaque doc local (annual-text/*.txt) mentionne bien le nom de la sté (>=5 fois,
accents/casse normalisés). Les docs SUSPECTS (mauvaise sté) sont mis en
QUARANTAINE (jamais supprimés : déplacés dans _quarantine_cac40/<T>/).
Sortie : par sté, nb de docs VÉRIFIÉS vs suspects + ce qui manque.
0 token. Idempotent (re-lançable).
"""
import glob, os, re, sys, unicodedata, shutil, json

ROOT = os.getcwd()  # lancer depuis ~/spx-app
SEC = "sec-data/cat3-european"
QUAR = "sec-data/cat3-european/_quarantine_cac40"
MIN_HITS = 5            # mentions minimum du nom pour valider
MIN_DOCS = 5           # docs annuels vérifiés visés par sté

NAMES = {
  "AC.PA": ["accor"], "AI.PA": ["air liquide"], "AIR.PA": ["airbus"],
  "MT.PA": ["arcelormittal", "arcelor mittal"], "CS.PA": ["axa"],
  "BNP.PA": ["bnp paribas"], "EN.PA": ["bouygues"], "CAP.PA": ["capgemini"],
  "CA.PA": ["carrefour"], "ACA.PA": ["credit agricole"], "BN.PA": ["danone"],
  "DSY.PA": ["dassault systemes"], "EDEN.PA": ["edenred"], "ENGI.PA": ["engie"],
  "EL.PA": ["essilorluxottica", "essilor"], "ERF.PA": ["eurofins"],
  "RMS.PA": ["hermes international", "hermes"], "KER.PA": ["kering"], "LR.PA": ["legrand"],
  "OR.PA": ["l oreal", "loreal"], "MC.PA": ["lvmh", "louis vuitton", "moet hennessy"],
  "ML.PA": ["michelin"], "ORA.PA": ["orange sa", "orange group", "groupe orange"],
  "RI.PA": ["pernod ricard"], "PUB.PA": ["publicis"], "RNO.PA": ["renault"],
  "SAF.PA": ["safran"], "SGO.PA": ["saint gobain"], "SAN.PA": ["sanofi"],
  "SU.PA": ["schneider electric"], "GLE.PA": ["societe generale"],
  "STLAP.PA": ["stellantis"], "STMPA.PA": ["stmicroelectronics", "stmicro"],
  "TEP.PA": ["teleperformance"], "HO.PA": ["thales"],
  "TTE.PA": ["totalenergies", "total energies"], "URW.PA": ["unibail", "rodamco"],
  "VIE.PA": ["veolia"], "DG.PA": ["vinci"], "BVI.PA": ["bureau veritas"],
}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9 ]", " ", s)


def count_name(text_norm, tokens):
    return max((text_norm.count(tok) for tok in tokens), default=0)


def verify_ticker(t):
    tokens = [norm(x) for x in NAMES[t]]
    docs = glob.glob(f"{SEC}/{t}/annual-text/*.txt")
    verified, suspect = [], []
    for f in docs:
        try:
            txt = norm(open(f, errors="ignore").read())
        except Exception:
            suspect.append((f, -1)); continue
        h = count_name(txt, tokens)
        (verified if h >= MIN_HITS else suspect).append((f, h))
    # quarantaine des suspects
    for f, h in suspect:
        os.makedirs(f"{QUAR}/{t}", exist_ok=True)
        try:
            shutil.move(f, f"{QUAR}/{t}/{os.path.basename(f)}")
        except Exception:
            pass
    return {"ticker": t, "verified": len(verified), "suspect": len(suspect),
            "suspect_files": [os.path.basename(f) for f, _ in suspect],
            "missing": max(0, MIN_DOCS - len(verified))}


def main():
    res = [verify_ticker(t) for t in NAMES]
    ok = [r for r in res if r["missing"] == 0 and r["suspect"] == 0]
    todo = [r for r in res if r["missing"] > 0]
    polluted = [r for r in res if r["suspect"] > 0]
    print(f"=== VÉRIFIÉ COMPLET (>= {MIN_DOCS} docs, 0 suspect) : {len(ok)}/40 ===")
    print("  " + " ".join(r["ticker"] for r in ok))
    print(f"\n=== DOCS SUSPECTS MIS EN QUARANTAINE : {len(polluted)} stés ===")
    for r in polluted:
        print(f"  {r['ticker']:10s} {r['suspect']} suspect(s) -> {r['suspect_files'][:3]}")
    print(f"\n=== À (RE)TÉLÉCHARGER : {len(todo)} stés ===")
    for r in todo:
        print(f"  {r['ticker']:10s} vérifiés={r['verified']} manque={r['missing']}")
    json.dump(res, open("/tmp/cac40-verify.json", "w"), indent=1)
    open("/tmp/cac40-todo.txt", "w").write("\n".join(r["ticker"] for r in todo))


if __name__ == "__main__":
    main()
