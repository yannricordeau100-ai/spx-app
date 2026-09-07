#!/usr/bin/env python3
"""Applique les decisions d arbitrage TAM des agents (07/09/2026).

Le proprietaire a delegue l arbitrage : les agents renvoient
{"decisions": {TICKER: [ids]}, "cas": {TICKER: raison}}. Ce script fusionne
les decisions dans la base (desk_page_content, page tam / arbitrages) SANS
ecraser les choix deja presents (ceux du proprietaire ont priorite), et
enregistre les cas particuliers dans _CAS-A-TRANCHER.json pour notification.

Usage : python3 docs/cahier/tam/_arbitre-apply.py fichier_decisions.json
Ensuite : python3 scripts/tam-pose.py puis commit des tam.json.
"""
import json, os, ssl, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
ROOT = os.path.abspath(ROOT)

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()

env = {}
for l in open(os.path.join(ROOT, ".env.local")):
    if "=" in l and not l.startswith("#"):
        k, v = l.rstrip("\n").split("=", 1)
        env[k] = v.strip().strip('"')
U, K = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
HDR = {"apikey": K, "Authorization": f"Bearer {K}", "Content-Type": "application/json"}


def lire_base():
    req = urllib.request.Request(
        f"{U}/rest/v1/desk_page_content?select=content_fr&page_key=eq.tam&section_key=eq.arbitrages",
        headers=HDR,
    )
    rows = json.load(urllib.request.urlopen(req, context=CTX))
    return json.loads(rows[0]["content_fr"]) if rows and rows[0].get("content_fr") else {}


def ecrire_base(choix):
    corps = json.dumps(
        {"page_key": "tam", "section_key": "arbitrages", "content_fr": json.dumps(choix, ensure_ascii=False)}
    ).encode()
    req = urllib.request.Request(
        f"{U}/rest/v1/desk_page_content?on_conflict=page_key,section_key",
        data=corps,
        headers={**HDR, "Prefer": "resolution=merge-duplicates"},
        method="POST",
    )
    urllib.request.urlopen(req, context=CTX)


def main():
    dec = json.load(open(sys.argv[1]))
    decisions = {t.upper(): ids for t, ids in (dec.get("decisions") or {}).items()}
    cas = {t.upper(): r for t, r in (dec.get("cas") or {}).items()}
    base = lire_base()
    ajoutes, gardes = 0, 0
    for t, ids in decisions.items():
        if t in base:
            gardes += 1  # choix deja present (proprietaire ou passe precedente)
            continue
        # controle : les ids existent dans le fichier Cahier
        p = os.path.join(ROOT, "docs/cahier/tam", f"{t}.json")
        if not os.path.exists(p):
            print(t, ": pas de fichier Cahier, ignore")
            continue
        valides = {c["id"] for c in json.load(open(p)).get("candidats", [])}
        if any(i not in valides for i in ids):
            print(t, ": id inconnu dans", ids, "-> mis en cas particulier")
            cas[t] = f"decision agent avec id inconnu {ids}"
            continue
        base[t] = ids[:2]
        ajoutes += 1
    ecrire_base(base)
    # journal des cas particuliers (cumulatif)
    pcas = os.path.join(ROOT, "docs/cahier/tam", "_CAS-A-TRANCHER.json")
    exist = json.load(open(pcas)) if os.path.exists(pcas) else {}
    exist.update(cas)
    json.dump(exist, open(pcas, "w"), ensure_ascii=False, indent=1)
    print(f"decisions ajoutees {ajoutes}, deja arbitrees {gardes}, cas particuliers cumules {len(exist)}")


if __name__ == "__main__":
    main()
