#!/usr/bin/env python3
"""Apostrophes manquantes dans les textes francais (26 sept 2026).
« d affaires », « n est », « qu aucun », « c est », « l entreprise » ->
« d'affaires », « n'est »... Seulement dans les chaines francaises (memes
garde-fous que accents-restaurer.py : cles techniques et anglais exclus).
Usage : python3 scripts/elisions-restaurer.py [--ecrit] dossiers..."""
import json, re, sys, glob, importlib.util
spec = importlib.util.spec_from_file_location("a", __file__.replace("elisions-restaurer.py", "accents-restaurer.py"))
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)
# Minuscules partout ; majuscule seulement en debut de phrase (« L entreprise »),
# jamais une lettre isolee au milieu (« vitamine D aussi », « plan C ou D »).
RE = re.compile(r"(?:\b(jusqu|lorsqu|puisqu|presqu|quelqu|qu|[dlnscj])|(?:(?<=^)|(?<=[.!?:«(] ))(Qu|Jusqu|Lorsqu|Puisqu|[DLNSCJ]))\s+(?=[aeiouyhàâéèêëîïôûAEIOUYHÀÂÉÈÊÎÔÛ])")
def corrige_txt(t):
    return RE.sub(lambda m: (m.group(1) or m.group(2)) + "'", t)
total = 0
def corrige(o, cle=""):
    global total
    if isinstance(o, dict): return {k: corrige(v, k) for k, v in o.items()}
    if isinstance(o, list): return [corrige(v, cle) for v in o]
    if isinstance(o, str) and not a.CLES_EXCLUES.match(cle or "") and "_" not in o and "://" not in o:
        mots = [x.lower() for x in a.MOT.findall(o)]
        fr = sum(x in a.FR_STOP for x in mots); en = sum(x in a.EN_STOP for x in mots)
        if len(mots) >= 4 and (fr >= 1 and en == 0 or fr > 2 * en):
            n = corrige_txt(o)
            if n != o: total += len(RE.findall(o))
            return n
    return o
ecrit = "--ecrit" in sys.argv
nf = 0
for d in [x for x in sys.argv[1:] if not x.startswith("--")]:
    for f in glob.glob(d + "/*.json"):
        if f.endswith("companies/wkl.as.json"): continue
        try: raw = open(f, encoding="utf-8").read(); j = json.loads(raw)
        except Exception: continue
        avant = total; n = corrige(j)
        if total > avant:
            nf += 1
            if ecrit: json.dump(n, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{total} apostrophes dans {nf} fichiers ({'ecrit' if ecrit else 'essai'})")
