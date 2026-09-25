#!/usr/bin/env python3
"""Nombres a trois decimales dans les textes francais (26 sept 2026).
« 45,183 milliards » -> « 45,2 milliards » ; « 6 707,981 M$ » -> « 6 708 M$ » ;
« 10,594 M€ » -> « 10,6 M€ ». Les citations entre « » ou "" restent intactes.
Seulement les chaines francaises (garde-fous de accents-restaurer.py).
Usage : python3 scripts/nombres-fr.py [--ecrit] dossiers..."""
import json, re, sys, glob, importlib.util
spec = importlib.util.spec_from_file_location("a", __file__.replace("nombres-fr.py", "accents-restaurer.py"))
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)
NB = re.compile(r"(?<![\d,.])(\d{1,3}(?:[   ]\d{3})*),(\d{3})(?![\d,])(\s?)(milliards|milliard|Mds|Md|millions|million|M\s?\$|M\s?€|M\s?£|M\s?CHF)")
CITE = re.compile(r"«[^»]*»|\"[^\"]*\"|“[^”]*”")
def fmt(x, dec):
    s = f"{x:,.{dec}f}".replace(",", " ").replace(".", ",")
    if dec and s.endswith(",0"): s = s[:-2]
    return s
def repl(m):
    ent = int(re.sub(r"\D", "", m.group(1))); dec = m.group(2); u = m.group(4)
    v = float(f"{ent}.{dec}")
    if u.startswith(("milliard", "Md")): out = fmt(v, 1)
    else: out = fmt(v, 0) if v >= 100 else fmt(v, 2)
    # accord : « million » et « milliard » au pluriel a partir de 2
    if u in ("million", "milliard") and v >= 2: u = u + "s"
    return out + m.group(3) + u
def corrige_txt(t):
    parts, last = [], 0
    for c in CITE.finditer(t):
        parts.append(NB.sub(repl, t[last:c.start()])); parts.append(c.group(0)); last = c.end()
    parts.append(NB.sub(repl, t[last:]))
    return "".join(parts)
total = 0
def corrige(o, cle=""):
    global total
    if isinstance(o, dict): return {k: corrige(v, k) for k, v in o.items()}
    if isinstance(o, list): return [corrige(v, cle) for v in o]
    if isinstance(o, str) and not a.CLES_EXCLUES.match(cle or "") and not re.search(r"(?i)citation|verbatim|quote", cle or ""):
        mots = [x.lower() for x in a.MOT.findall(o)]
        fr = sum(x in a.FR_STOP for x in mots); en = sum(x in a.EN_STOP for x in mots)
        if fr >= 1 and fr > en:
            n = corrige_txt(o)
            if n != o: total += 1
            return n
    return o
if __name__ == "__main__":
    ecrit = "--ecrit" in sys.argv; nf = 0
    for d in [x for x in sys.argv[1:] if not x.startswith("--")]:
        for f in glob.glob(d + "/*.json"):
            if f.endswith("companies/wkl.as.json"): continue
            try: j = json.load(open(f, encoding="utf-8"))
            except Exception: continue
            av = total; n = corrige(j)
            if total > av:
                nf += 1
                if ecrit: json.dump(n, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{total} textes corriges dans {nf} fichiers ({'ecrit' if ecrit else 'essai'})")
