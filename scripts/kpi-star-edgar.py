#!/usr/bin/env python3
"""
Extraction deterministe d une serie trimestrielle depuis les communiques de
resultats 8-K (exhibit 99) d une societe americaine, via la recherche plein
texte EDGAR puis la lecture des tableaux HTML. Aucun modele de langage : ce
qui sort vient tel quel du tableau publie par la societe.

Chaque communique donne le trimestre courant et le meme trimestre de l annee
precedente : la serie est reconstituee et CHAQUE valeur est controlee par
recoupement (valeur courante du document N contre valeur "annee precedente"
du document N+4). Un ecart est signale.

Usage :
  python3 scripts/kpi-star-edgar.py --ticker KMI --cik 1506307 \
     --phrase "distributable cash flow" --ligne "^(DCF|Distributable cash flow)\b" \
     --depuis 2020-10-01 --libelle "Cash-flow distribuable (DCF)" --unite "M$" --sortie /tmp/kmi.json
Options : --colonnes 2 (valeurs a lire : courant, annee precedente), --diviseur 1
"""
import argparse, io, json, re, ssl, sys, time, urllib.parse, urllib.request, warnings
import pandas as pd
warnings.filterwarnings("ignore")
UA = {"User-Agent": "Mettrik research (contact@mettrik.ai)"}
# Le Python de cette machine n a pas la chaine de certificats systeme : meme
# contournement que les autres scripts du depot (lecture seule, sites publics).
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE

def get(url, binaire=False):
    r = urllib.request.Request(url, headers=UA)
    d = urllib.request.urlopen(r, timeout=60, context=CTX).read()
    return d if binaire else d.decode("utf-8", "ignore")

def exhibits(cik, phrase, depuis, forms="8-K"):
    q = urllib.parse.quote(f'"{phrase}"')
    url = f"https://efts.sec.gov/LATEST/search-index?q={q}&ciks={int(cik):010d}&forms={forms}&startdt={depuis}&enddt=2030-12-31"
    hits = json.loads(get(url)).get("hits", {}).get("hits", [])
    out = []
    for h in hits:
        adsh, fn = h["_id"].split(":", 1)
        if not re.search(r"ex[-_]?99|ex991|exhibit99|press", fn, re.I) and not fn.endswith(".htm"):
            continue
        out.append({"date": h["_source"]["file_date"], "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-', '')}/{fn}", "fn": fn})
    # tous les exhibits d une meme date sont gardes : le communique de resultats
    # n est pas toujours le premier (ex. Targa : ex99_1 = communique, ex991_6 = autre)
    return sorted(out, key=lambda x: (x["date"], x["fn"]))

def trimestre_du_depot(date):
    """Un 8-K de resultats depose en janvier porte sur T4 de l annee precedente, etc."""
    a, m = int(date[:4]), int(date[5:7])
    if m <= 2: return a - 1, 4
    if m <= 5: return a, 1
    if m <= 8: return a, 2
    if m <= 11: return a, 3
    return a, 4

def nombres(cellules):
    """Valeurs numeriques d une ligne ; les cellules fusionnees (colspan) sont
    dupliquees par pandas, on ignore donc une valeur identique a la precedente."""
    vals = []
    prec = None
    for c in cellules:
        if str(c) == prec:
            continue
        prec = str(c)
        s = str(c).replace(",", "").replace("$", "").replace("(", "-").replace(")", "").strip()
        if re.fullmatch(r"-?\d+(\.\d+)?", s):
            vals.append(float(s))
    return vals

def lire(url, motif, colonnes):
    html = get(url)
    try:
        tables = pd.read_html(io.StringIO(html))
    except ValueError:
        return None
    rx = re.compile(motif, re.I)
    for t in tables:
        s = t.astype(str)
        for _, row in s.iterrows():
            cells = list(row.values)
            if any(rx.search(c.strip()) for c in cells[:3]):
                v = nombres(cells)
                if len(v) >= colonnes:
                    return v[:colonnes]
    return None

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True); p.add_argument("--cik", required=True)
    p.add_argument("--phrase", required=True); p.add_argument("--ligne", required=True)
    p.add_argument("--depuis", default="2020-10-01"); p.add_argument("--libelle", required=True)
    p.add_argument("--unite", default=""); p.add_argument("--sortie", required=True)
    p.add_argument("--colonnes", type=int, default=2); p.add_argument("--diviseur", type=float, default=1.0)
    p.add_argument("--forms", default="8-K", help="type de depot EDGAR (8-K, 6-K)")
    p.add_argument("--controle", type=int, default=1, help="indice de la valeur du meme trimestre de l annee precedente (1 par defaut ; 2 quand le tableau donne trimestre courant, trimestre precedent, annee precedente)")
    a = p.parse_args()
    docs = exhibits(a.cik, a.phrase, a.depuis, a.forms)
    print(f"{a.ticker}: {len(docs)} communiques", file=sys.stderr)
    serie, controle, sources = {}, {}, []
    faits = set()
    for d in docs:
        an, tr = trimestre_du_depot(d["date"])
        cle = f"T{tr} {an}"
        if cle in faits:
            continue
        v = lire(d["url"], a.ligne, max(a.colonnes, a.controle + 1))
        if not v:
            print(f"  {d['date']} {cle}: ligne introuvable dans {d['fn']}", file=sys.stderr); continue
        faits.add(cle); serie[cle] = v[0] / a.diviseur
        if len(v) > a.controle: controle[f"T{tr} {an-1}"] = v[a.controle] / a.diviseur
        sources.append(d["url"]); time.sleep(0.6)
    ecarts = [(k, serie[k], controle[k]) for k in serie if k in controle and abs(serie[k] - controle[k]) > 0.005 * max(1, abs(serie[k]))]
    # completer avec les valeurs "annee precedente" quand le document courant manque
    for k, v in controle.items(): serie.setdefault(k, v)
    ordre = sorted(serie, key=lambda k: (int(k[3:]), int(k[1])))
    out = [{"ticker": a.ticker, "libelle": a.libelle, "unite": a.unite, "frequence": "trimestriel",
            "periodes": ordre, "valeurs": [serie[k] for k in ordre],
            "source": f"Communiques de resultats 8-K (exhibit 99) deposes a la SEC, {docs[0]['date'][:4]}-{docs[-1]['date'][:4]}, lus par script",
            "note": ("Ecarts de recoupement : " + "; ".join(f"{k} {x} vs {y}" for k, x, y in ecarts)) if ecarts else "Recoupement document N / document N+4 sans ecart",
            "urls": sources}]
    json.dump(out, open(a.sortie, "w"), ensure_ascii=False, indent=1)
    print(f"{a.ticker}: {len(ordre)} trimestres, {len(ecarts)} ecart(s) -> {a.sortie}", file=sys.stderr)
    print(json.dumps({k: serie[k] for k in ordre}, ensure_ascii=False))

if __name__ == "__main__":
    main()
