#!/usr/bin/env python3
"""Mission sp5001000, etape 4 : prepare (sans rien rendre visible) la liste de ce qu il faudra
faire par bloc et hors bloc pour chaque societe, d apres docs/CONSIGNES-NOUVELLES-SOCIETES.md.
Lecture seule hors data-lake ; ecrit data-lake/_sp5001000/plan-integration.json."""
import json, os, glob, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE = f"{ROOT}/data-lake"; M = f"{LAKE}/_sp5001000"
def lit(p, d=None):
    try: return json.load(open(p))
    except Exception: return d
L = lit(f"{M}/liste.json"); S = lit(f"{M}/etat.json", {}).get("societes", {}); T = lit(f"{M}/etat-transcripts.json", {}).get("societes", {})
gics = lit(f"{ROOT}/docs/cahier/societes-gics.json", {}).get("societes", {})
quar = set(lit(f"{ROOT}/src/data/quarantaine-pollution.json", {}).get("tickers", []) or [])
retir = set((lit(f"{ROOT}/src/data/societes-retirees.json", {}) or {}).get("tickers", {}))
logos = set(lit(f"{ROOT}/src/data/logo-tickers.json", []) or [])
def n(t, d):
    p = f"{LAKE}/{t}/{d}"
    return len([f for f in os.listdir(p) if not f.startswith(".")]) if os.path.isdir(p) else 0

COMMUN = {
 "regle_a_trancher": "CONFLIT DE REGLES : les consignes (etape 0) et la memoire project_mettrik_univers_indices_only interdisent tout ajout hors des indices couverts (S&P 500, Nasdaq 100, SOX, CAC 40, DAX 40, AEX 25, SMI 20). Le Russell 1000 n en fait pas partie : la mise en ligne de ces societes demande une decision explicite de Yann (nouvel indice couvert). Rien n est rendu visible tant que ce n est pas tranche.",
 "hors_bloc": [
  "Etat de vague : .conv-state/sp5001000-state.json (univers, docs_done, p2_done, p3_done, integres, in_progress, blocs_desactives), seul point de reprise",
  "Indice : ajouter le Russell 1000 a scripts/indices-wikipedia.py (PAGES) ou une source officielle, puis src/data/indices-composition.json ; veille des indices (sp500-tickers.json, nasdaq100-members.json) : liste russell a creer",
  "Creation de fiche : adapter scripts/aexdax-onboard.py (PL avec hero_kpi, kpis:[hero], blocs Phase 3, _validation ; v1-7-public.json ; v1-9-5-clean-all-tickers.json avec count et cle _ajout_<date> ; disabled-blocks-per-ste.json)",
  "EN minimal src/data/v2-pipeline-enrich/<t>.json avec les dates _maj_<bloc> (sans lui : pas de KPI supplementaires ni desk_special_kpis)",
  "Supabase desk_disabled_blocks (scope = T) via /admin/blocks : recopier les blocs masques",
  "Supabase desk_curated_companies : npx tsx scripts/publish-online.ts <T> (sinon introuvable dans la recherche) ; seulement apres decision de mise en ligne",
  "Supabase desk_hero_kpi_overrides si le hero choisi par src/lib/hero-select.ts n est pas distinctif (scripts/set-hero-override.py)",
  "Listes : market-cap-order.json (scripts/ranks-univers.py), compare-index.json (build-compare-index.ts), kpi-classification.json (classify-kpis.js), _tickers-index.json et _hero-kpi-index.json (build-public-files.ts, build-hero-kpi-index.py), ir-directory.json (ir-directory-probe.py), earnings-calendar.json (marketbeat-calendar.py puis build-earnings-calendar.py --sans-fmp), derniers-depots.json, logo-tickers.json (deux formes), sources-externes.json, shares-outstanding.json, employees.json, docs/cahier/bourses/US.json (champ mettrik)",
  "Veilles : daily-doc-watcher lit v1-9-pre-publication-audit.json (liste figee) : y ajouter les societes ; post-earnings-pipeline, derniers-depots, evenements-veille, earnings-refresh, quarterly-refresh lisent clean-all",
  "Back-office : /sandbox/v1-9-5/admin/universe-toggle, /admin/blocks, /admin/kpis-toggle, /sandbox/curated-companies, /sandbox/mises-a-jour (dates _maj_*)",
  "Casse : PL et EN en minuscules, KH, kpi-annuel-fiche, docs/cahier et data-lake en MAJUSCULES, logo public/logos/<T avec tirets>.png",
  "Mise en ligne : bash scripts/version-bump.sh + src/lib/version.ts dans le meme commit, tsc, git add de chemins precis (KH hors src), deploy-niveau2.sh, controle reel, go n0 de Yann",
 ],
 "blocs": {
  "en_tete_identite": "PL name/sector/subsector/tagline/founded/ipo ; code GICS 8 chiffres dans docs/cahier/societes-gics.json ; <title> « Nom (TICKER) »",
  "rangs": "python3 scripts/ranks-univers.py (exige le GICS) -> <t>.ranks.json",
  "logo": "python3 scripts/fetch-logo-wikipedia.py <T> \"<Titre Wikipedia>\" + logo-tickers.json",
  "cours_capitalisation": "rien si Yahoo connait le symbole (classes a tiret : BF-B, HEI-A...) ; cours-fmp/<t>.json par cours-yfinance-collecte.py --only=<T> (admin)",
  "comprendre_la_societe": "scripts/gen-mettrik-descriptions.py -> <t>.mettrik-description.json",
  "hero": "KPI distinctif de 5 ans au moins, hero_kpi_rationale ; verif node scripts/verif-hero-affiche.mjs",
  "tableau_kpi_long_terme": "Phase 2 (gabarit .conv-state/sox30-template-p2.txt) -> KH .batches-drafts-safe/kpis-haut/<T>.json ; 3 sondes par societe ; kpi-lint 0 rouge ; au moins 5 KPI rendus",
  "kpi_industrie": "docs/cahier/kpi/<code8>.json puis build-kpi-industrie-par-societe.py ; kpi-comptables-xbrl.py pour les KPI comptables comparables",
  "kpi_ic": "criteres feedback_mettrik_criteres_kpi_ic (serie publiee, definition identique, 4 points, 36 valeurs sondees)",
  "moyen_terme": "demande de Yann dans /sandbox/reglages-kpi puis lance-demande.py ; jamais une serie deja sur la fiche",
  "stories": "KH avec _source stories-filings, story_category, is_short_history ; KPI des sites web (process-ajout-kpi-sites-stes.md, frequency annual)",
  "repartition_ca": "Phase 3 segments_fr.json, geo_fr.json, unit au niveau du bloc, somme = CA consolide",
  "moat": "scripts/moat-designation.py -> src/data/moat-univers.json",
  "clients": "docs/cahier/clients/<T>.json (10-K Major customers)",
  "tam": "docs/cahier/tam/<T>.json, arbitrage Yann /sandbox/tam, tam-pose.py",
  "facteurs_de_risque": "Phase 3 risks/extracted.json depuis le dernier 10-K Item 1A (20-F Item 3.D), _risks_src_30k.txt via prep-risks-gov.py",
  "gouvernance_remuneration": "Phase 3 gouvernance_fr.json depuis le dernier DEF 14A (20-F Items 6-7 pour un emetteur etranger), notes en tableau",
  "societes_rachetees": "python3 scripts/rachats-collecte.py <T>",
  "positionnement_ia": "Phase 3 ia_positionnement_fr.json, 2 preuves sourcees au moins",
  "synthese_resultats": "transcripts de data-lake/<T>/transcripts -> src/data/transcripts/<t>.json (marketbeat/stockanalysis) puis summaries-refresh.py ; sans conference : summaries-from-er.py + sans-appel-resultats.json",
  "these_anti_these": "docs/ATT-PROCEDURE.md puis src/data/these/<t>.json, dans cet ordre",
  "evenements_investisseurs": "scripts/evenements-veille.py puis validation docs/EVENEMENTS-INVESTISSEURS.md",
  "effectifs_kpi_annuels": "kpi-annuel-10ans.py (XBRL) puis kpi-effectifs-extraits.py, kpi-effectifs-lecture.py, kpi-annuel-integre.py",
  "sources_unites": "src/data/sources-externes.json ; unites selon GICS",
 },
}
out = []
for r in L["societes"]:
    t = r["ticker"]; s = S.get(t, {}); tr = T.get(t, {})
    if r.get("radiee"):
        out.append({"ticker": t, "nom": r["nom"], "statut": "radiee : rien a faire (societes-retirees.json si elle avait ete en ligne)"}); continue
    etr = bool(s.get("etranger")) or n(t, "20F") > 0
    docs = {d: n(t, d) for d in ["10K", "10Q", "8K", "DEF14A", "ER", "ES", "EP", "20F", "6K", "40F", "S1", "S4", "transcripts"]}
    docs["xbrl"] = os.path.exists(f"{LAKE}/{t}/xbrl/companyfacts.json")
    alertes = []
    if t in quar: alertes.append("dans quarantaine-pollution.json")
    if t in retir: alertes.append("dans societes-retirees.json")
    pl = os.path.exists(f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json")
    if pl: alertes.append("un PL ancien existe deja (src/data/v2-pipeline/%s.json) : verifier identite et fraicheur avant toute reprise" % t.lower())
    old = [d for d in ("governance", "kpis", "kpis_q", "KPI normaux") if os.path.isdir(f"{LAKE}/{t}/{d}")]
    if old: alertes.append("extractions anciennes dans data-lake/%s (%s) : verifier qu elles concernent bien cette societe (homonymes)" % (t, ", ".join(old)))
    if "-" in t: alertes.append("classe d actions a tiret : alias a poser (ticker-aliases.ts) pour les autres classes " + ", ".join(c for c in r.get("classes", []) if c != t))
    elif len(r.get("classes", [])) > 1: alertes.append("plusieurs classes cotees : " + ", ".join(r["classes"]) + " ; alias a poser")
    a_faire = {
     "gics": "present" if t in gics else ("a poser : " + (r.get("sous_industrie_gics") or "sous-industrie inconnue (SIC SEC %s %s)" % (s.get("sic"), s.get("sic_libelle")))),
     "phase2_gabarit": ".conv-state/sox30-template-p2.txt" + (" (emetteur etranger : 20-F/6-K, adapter)" if etr else ""),
     "gouvernance_source": "20-F Items 6 et 7" if etr and not docs["DEF14A"] else ("DEF 14A le plus recent" if docs["DEF14A"] else "aucun DEF 14A : a trouver"),
     "risques_source": "20-F Item 3.D" if etr and not docs["10K"] else ("10-K Item 1A" if docs["10K"] else "aucun 10-K : a trouver"),
     "synthese_source": "transcripts (%d) puis summaries-refresh.py" % docs["transcripts"] if docs["transcripts"] else ("summaries-from-er.py (ER %d) + sans-appel-resultats.json" % docs["ER"] if docs["ER"] else "aucun transcript ni communique : a trouver"),
     "kpi_annuels_10ans": "kpi-annuel-10ans.py (companyfacts present)" if docs["xbrl"] else "XBRL absent",
     "logo": "present" if t in logos else "fetch-logo-wikipedia.py",
     "prep_textes": "scripts/prep-risks-gov.py pour _risks_src_30k.txt et _gov_src.txt",
    }
    out.append({"ticker": t, "nom": r["nom"], "cik": r["cik"], "etranger_sec": etr, "docs": docs, "edgar_fini": bool(s.get("fini")), "a_faire": a_faire, "alertes": alertes})
res = {"_note": "Preparation seulement (etape 4) : rien n est ecrit hors de data-lake, rien n est visible sur le site. Suivre docs/CONSIGNES-NOUVELLES-SOCIETES.md, onglets 1 a 7.",
       "commun": COMMUN, "n": len(out),
       "comptes": {"gics_a_poser": sum(1 for x in out if x.get("a_faire", {}).get("gics", "").startswith("a poser")),
                   "etrangers_sec": sum(1 for x in out if x.get("etranger_sec")),
                   "sans_transcript": sum(1 for x in out if "a_faire" in x and not x["docs"]["transcripts"]),
                   "pl_ancien_existant": sum(1 for x in out if any("PL ancien" in a for a in x.get("alertes", []))),
                   "logo_a_faire": sum(1 for x in out if x.get("a_faire", {}).get("logo") != "present" and "a_faire" in x)},
       "societes": out}
json.dump(res, open(f"{M}/plan-integration.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps(res["comptes"]))
