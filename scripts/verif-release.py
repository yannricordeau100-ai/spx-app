#!/usr/bin/env python3
"""
scripts/verif-release.py : controle avant ouverture / mise a jour du site public.

Reponse a la question de Yann (3 sept 2026) : « comment etre sur que 100 % du
code est transfere et que rien n est oublie ? ». Le code, lui, est transfere
par construction : go-n0.sh promeut le MEME deploiement (meme build) que celui
servi sur niveau2. Ce qui peut manquer n est donc jamais du code mais ce qui
vit AUTOUR du code : fichiers non commites, variables d environnement,
configuration Supabase / Stripe / DNS, fichiers de donnees exclus du bundle.
Ce script verifie chacun de ces points et allume un feu par controle.

Usage : python3 scripts/verif-release.py [--strict] [--json chemin]
  --strict : code de retour 1 si un feu est rouge (utilise par go-n0.sh)
"""
from __future__ import annotations
import json, re, subprocess, sys, glob, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
STRICT = "--strict" in sys.argv
JSON_OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None

def env_local(k):
    for l in (ROOT / ".env.local").read_text().splitlines():
        if l.startswith(k + "="):
            return l.split("=", 1)[1].strip().strip('"')
    return None

def sh(cmd, timeout=60):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout).stdout.strip()

def curl_json(url, headers=None):
    h = " ".join(f"-H '{x}'" for x in (headers or []))
    out = sh(f"curl -s {h} '{url}'", 60)
    try:
        return json.loads(out, strict=False)
    except Exception:
        return None

feux = []  # (couleur, domaine, controle, detail)
def feu(couleur, domaine, controle, detail=""):
    feux.append({"feu": couleur, "domaine": domaine, "controle": controle, "detail": detail})

# 1) GIT : tout ce qui n est pas commite et pousse n existe pas pour Vercel
statut = sh("git status --short -- src scripts supabase next.config.ts package.json public email-templates .batches-drafts-safe/kpis-haut")
modifs = [l for l in statut.splitlines() if l.strip()]
# 9 oct 2026 : les fichiers de la vague sp5001000 (Russell 1000) en cours d extraction ne sont pas servis
# hors N1 (gate src/lib/univers-actif.ts) : ils ne bloquent pas la mise en ligne de la production.
try:
    _vague = {x["ticker"].upper() for x in json.load(open("data-lake/_sp5001000/liste.json"))["societes"]}
    _univ = json.load(open("src/data/v1-9-5-clean-all-tickers.json")); _univ = {t.upper() for t in (_univ.get("tickers", _univ) if isinstance(_univ, dict) else _univ)}
    _vague -= _univ
    import re as _re
    def _hors_vague(l):
        # 10 oct 2026 : etendu a tout fichier PAR SOCIETE (src/data/<dossier>/<t>.*, public/logos/<T>.*, kpis-haut) :
        # transcripts, syntheses, kpi-annuel-fiche, logos de la vague ne sont servis que par le niveau 1.
        f = l.strip().split()[-1]
        m = _re.search(r"(?:\.batches-drafts-safe/kpis-haut|src/data/[^/]+|public/logos)/([^/]+)$", f)
        if not m: return True
        b = _re.sub(r"\.(json|png|svg|webp|jpg)$", "", m.group(1), flags=_re.I)
        b = _re.sub(r"\.(ranks|tam|mettrik-description|description|ai-pos|calls|suivi|quarterly-history)$", "", b)
        return not ({b.upper(), b.upper().replace("-", ".")} & _vague)
    modifs = [l for l in modifs if _hors_vague(l)]
except Exception:
    pass
feu("rouge" if modifs else "vert", "Code", "Aucune modification non commitee dans le code et les donnees servies",
    f"{len(modifs)} fichier(s) non commite(s)" + (" : " + ", ".join(m[3:] for m in modifs[:6]) if modifs else ""))
head = sh("git rev-parse HEAD"); remote = sh("git rev-parse origin/staging 2>/dev/null || git ls-remote origin staging | cut -f1")
feu("vert" if head[:10] == remote[:10] else "rouge", "Code", "Le commit local est pousse sur origin/staging",
    f"local {head[:8]} / distant {remote[:8]}")

# 2) FICHIERS DE DONNEES LUS AU RUNTIME : suivis par git ET non exclus du bundle
racines = set(re.findall(r"src/data/[a-zA-Z0-9_.-]+|\.batches-drafts-safe/[a-zA-Z0-9_-]+",
                         sh("grep -rhoE 'src/data/[a-zA-Z0-9_.-]+|\\.batches-drafts-safe/[a-zA-Z0-9_-]+' src/lib src/app 2>/dev/null")))
# Seuls les dossiers exclus EN ENTIER comptent ("./x/**/*"), pas les motifs de fichiers.
exclus = [m.rstrip("/") for m in re.findall(r'"\./([^"]+?)/\*\*/\*"', (ROOT / "next.config.ts").read_text())]
non_suivis, exclus_mais_lus = [], []
for r in sorted(racines):
    if not Path(r).exists():
        continue
    if not Path(r).is_dir() and not sh(f"git ls-files --error-unmatch '{r}' 2>/dev/null"):
        non_suivis.append(r)
    for e in exclus:
        if r == e or r.startswith(e + "/"):
            # Ou ce dossier est-il lu ? Seul un usage hors sandbox/admin/desk est critique.
            fichiers = sh(f"grep -rlE '{re.escape(r)}' src/lib src/app 2>/dev/null").splitlines()
            critiques = [f for f in fichiers if not re.search(r"/(sandbox|admin|desk-[a-z0-9]+|concepts|chart-lab|email-lab)/", f)]
            if critiques:
                exclus_mais_lus.append(f"{r} (lu par {', '.join(Path(f).name for f in critiques[:2])})")
feu("rouge" if non_suivis else "vert", "Donnees", "Fichiers de donnees lus par l app tous suivis par git",
    ", ".join(non_suivis) if non_suivis else f"{len(racines)} racines de donnees verifiees")
# Ces lectures sont des replis proteges (readJsonOrNull) : pas de plantage, mais la
# fonctionnalite correspondante (traductions EN/DE, KPI exhaustifs, fiche companies)
# est silencieusement absente en ligne. Orange : a trancher, pas bloquant.
feu("orange" if exclus_mais_lus else "vert", "Donnees", "Dossiers lus par l app mais exclus du bundle Vercel (replis proteges, fonction absente en ligne)",
    ", ".join(exclus_mais_lus) if exclus_mais_lus else "outputFileTracingExcludes coherent")

# 3) VARIABLES D ENVIRONNEMENT : celles utilisees par le code doivent exister en production ET preview
utilisees = set(re.findall(r"process\.env\.([A-Z_][A-Z0-9_]*)", sh("grep -rhoE 'process\\.env\\.[A-Z_][A-Z0-9_]*' src 2>/dev/null")))
OPTIONNELLES = {"NEXT_PUBLIC_NIVEAU", "NEXT_PUBLIC_DEPLOY_TARGET", "VERCEL_GIT_COMMIT_REF", "VERCEL", "NODE_ENV",
                "NEXT_PUBLIC_BUILD_VERSION", "NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "PLAUSIBLE_API_KEY", "EMAIL_DRY_RUN",
                "MAINTENANCE_MODE", "TELEMETRIE_SEL", "ANTHROPIC_API_KEY", "CEREBRAS_API_KEY", "CEREBRAS2_API_KEY",
                "CEREBRAS3_API_KEY", "GROQ_API_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "NEXT_PB_HCAPTCHA_SITE_KEY", "RESEND_WEBHOOK_SECRET",
                "ADMIN_EMAILS", "GITHUB_DISPATCH_TOKEN", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "FMP_API_KEY",
                "METTRIK_SEC_DIR", "PDFTOTEXT_BIN",
                # 6 sept 2026 : VERCEL_ENV est une variable systeme fournie par Vercel (jamais listee dans le projet) ;
                # IPS_PROPRIETAIRE est facultative (liste vide = aucune exemption d alerte).
                "VERCEL_ENV", "IPS_PROPRIETAIRE",
                # 9 oct 2026 : UNIVERS et UNIVERS_N1_CANDIDATS ne sont posees que sur le niveau 1 (vague sp5001000) ;
                # absentes = univers principal, comportement voulu en production et sur niveau2.
                "UNIVERS", "UNIVERS_N1_CANDIDATS"}
requises = sorted(utilisees - OPTIONNELLES)
tok = env_local("VERCEL_TOKEN")
envs = curl_json("https://api.vercel.com/v9/projects/prj_2fwjkuSPPesO8Xj8gsVfw6KSHiPA/env?teamId=team_3A8Ft1Kze0wYzGbuyHmsaEwC",
                 [f"Authorization: Bearer {tok}"]) or {}
par_cible = {"production": set(), "preview": set()}
for e in envs.get("envs", []):
    for t in e.get("target", []):
        if t in par_cible:
            par_cible[t].add(e["key"])
for cible in ("production", "preview"):
    manq = [k for k in requises if k not in par_cible[cible]]
    feu("rouge" if manq else "vert", "Variables", f"Variables requises par le code presentes en {cible}",
        "manquantes : " + ", ".join(manq) if manq else f"{len(requises)} requises, toutes presentes")
importantes = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "NEXT_PUBLIC_SITE_URL", "VISUAL_AUDIT_TOKEN", "DESK_OWNER_EMAIL"]
ecarts = [k for k in importantes if (k in par_cible["production"]) != (k in par_cible["preview"])]
feu("orange" if ecarts else "vert", "Variables", "niveau2 (preview) et mettrik.ai (production) ont les memes variables cles",
    "presentes d un cote seulement : " + ", ".join(ecarts) if ecarts else "alignees")
# La cle publique peut porter l un ou l autre nom (Vercel refuse de marquer
# "sensible" une variable prefixee NEXT_PUBLIC_ ; Yann a donc pose NEXT_PB_).
_cle_captcha = any(n in par_cible["production"] for n in ("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PB_HCAPTCHA_SITE_KEY", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY"))
feu("vert" if _cle_captcha else "orange", "Variables",
    "Cle captcha (Turnstile) d inscription posee en production", "" if _cle_captcha else "absente : inscription sans protection anti-robots")

# 4) NIVEAUX : mettrik.ai ne doit pas bouger tout seul ; niveau2 = preview du commit courant
alias = sh("npx vercel alias ls 2>/dev/null")
def cible(nom):
    for l in alias.splitlines():
        p = l.split()
        if len(p) >= 2 and p[1] == nom:
            return p[0]
    return ""
n0, n2, n1 = cible("mettrik.ai"), cible("mettrik-niveau2.vercel.app"), cible("mettrik-niveau1.vercel.app")
feu("vert" if n0 and n2 and n0 != n2 else "orange", "Niveaux", "mettrik.ai (n0) et niveau2 (n2) pointent vers des deploiements distincts",
    f"n0={n0[:30]} / n2={n2[:30]}" + (" (identiques : toute mise en ligne n2 est publique)" if n0 == n2 else ""))
deps = curl_json("https://api.vercel.com/v6/deployments?app=mettrik&limit=12&teamId=team_3A8Ft1Kze0wYzGbuyHmsaEwC", [f"Authorization: Bearer {tok}"]) or {}
sha_n2 = next((d.get("meta", {}).get("githubCommitSha", "") for d in deps.get("deployments", []) if d["url"] == n2), "")
feu("vert" if sha_n2 and sha_n2 == head else "orange", "Niveaux", "niveau2 sert bien le commit courant",
    f"niveau2 = {sha_n2[:8] or 'inconnu'} / local = {head[:8]}")

# 5) SUPABASE : configuration d authentification alignee sur le domaine public
pat = env_local("SUPABASE_PAT")  # jeton personnel Supabase, uniquement dans .env.local
auth = curl_json("https://api.supabase.com/v1/projects/idpsbtgvuyfwtvzelogw/config/auth", [f"Authorization: Bearer {pat}"]) or {}
if auth:
    feu("vert" if auth.get("site_url") == "https://mettrik.ai" else "rouge", "Supabase", "site_url = https://mettrik.ai", str(auth.get("site_url")))
    al = auth.get("uri_allow_list", "")
    feu("vert" if "mettrik.ai/**" in al and "www.mettrik.ai/**" in al else "rouge", "Supabase", "Redirections autorisees vers mettrik.ai et www", al[:120])
    feu("vert" if auth.get("smtp_host") else "rouge", "Supabase", "SMTP personnalise (emails de la marque)", f"{auth.get('smtp_host')} / {auth.get('smtp_sender_name')}")
    tpl_ok = all(auth.get(f"mailer_templates_{k}_content") for k in ("confirmation", "recovery", "magic_link", "email_change", "invite"))
    feu("vert" if tpl_ok else "orange", "Supabase", "5 modeles d emails d authentification en place", "")
    feu("orange" if not auth.get("security_captcha_enabled") else "vert", "Supabase", "Captcha d inscription active cote Supabase", "desactive" if not auth.get("security_captcha_enabled") else "")
else:
    feu("orange", "Supabase", "Configuration auth lisible (jeton Supabase)", "jeton absent ou invalide")

# 6) STRIPE : webhook sur le domaine public, portail client, prix de la grille actifs
sk = env_local("STRIPE_SECRET_KEY")
wh = curl_json("https://api.stripe.com/v1/webhook_endpoints?limit=10", [f"Authorization: Bearer {sk}"]) or {}
urls = [w["url"] for w in wh.get("data", []) if w.get("status") == "enabled"]
feu("vert" if any(u.startswith("https://mettrik.ai/") for u in urls) else "rouge", "Stripe", "Webhook actif sur https://mettrik.ai/api/billing/webhook", ", ".join(urls) or "aucun")
portal = curl_json("https://api.stripe.com/v1/billing_portal/configurations?limit=1", [f"Authorization: Bearer {sk}"]) or {}
feu("vert" if portal.get("data") else "rouge", "Stripe", "Portail client configure (annulation, factures)", f"{len(portal.get('data', []))} configuration(s)")
feu("vert" if (sk or "").startswith("sk_live") else "rouge", "Stripe", "Cle secrete en mode live", (sk or "")[:8])
try:
    sup_url = env_local("NEXT_PUBLIC_SUPABASE_URL"); srk = env_local("SUPABASE_SERVICE_ROLE_KEY")
    prix_db = curl_json(f"{sup_url}/rest/v1/pricing_prices?select=stripe_price_id,is_active&is_active=eq.true", [f"apikey: {srk}", f"Authorization: Bearer {srk}"]) or []
    ids_db = {p["stripe_price_id"] for p in prix_db if p.get("stripe_price_id")}
    prix_st = curl_json("https://api.stripe.com/v1/prices?active=true&limit=100", [f"Authorization: Bearer {sk}"]) or {}
    ids_st = {p["id"] for p in prix_st.get("data", [])}
    manq = sorted(ids_db - ids_st)
    feu("rouge" if manq else "vert", "Stripe", "Tous les prix de la grille existent et sont actifs chez Stripe", f"{len(ids_db)} prix en base, manquants : {manq}" if manq else f"{len(ids_db)} prix verifies")
except Exception as e:
    feu("orange", "Stripe", "Comparaison grille / Stripe", str(e)[:80])
# 6bis) 8 oct 2026 : le back-office fait foi. Chaque prix actif de la grille doit
#    avoir chez Stripe un prix ACTIF au meme montant, meme devise, meme periode,
#    porteur de la cle stable mettrik_<plan>_<periode>_<devise> et relie en base.
#    Rouge sinon (reparation : bouton « Synchroniser Stripe » du back-office).
try:
    sup_url = env_local("NEXT_PUBLIC_SUPABASE_URL"); srk = env_local("SUPABASE_SERVICE_ROLE_KEY")
    hs = [f"apikey: {srk}", f"Authorization: Bearer {srk}"]
    plans_db = {p["id"]: p["code"] for p in (curl_json(f"{sup_url}/rest/v1/pricing_plans?select=id,code,is_active,is_api_only&is_active=eq.true&is_api_only=eq.false", hs) or [])}
    grille = [p for p in (curl_json(f"{sup_url}/rest/v1/pricing_prices?select=plan_id,currency,frequency,amount_decimal,stripe_price_id&is_active=eq.true", hs) or [])
              if p["plan_id"] in plans_db and float(p.get("amount_decimal") or 0) > 0]
    ecarts = []
    for p in grille:
        cle = f"mettrik_{plans_db[p['plan_id']].lower()}_{p['frequency']}_{p['currency'].lower()}"
        lst = curl_json(f"https://api.stripe.com/v1/prices?active=true&limit=1&lookup_keys%5B%5D={cle}", [f"Authorization: Bearer {sk}"]) or {}
        st = (lst.get("data") or [None])[0]
        attendu = round(float(p["amount_decimal"]) * 100)
        if not st:
            ecarts.append(f"{cle} : aucun prix Stripe actif")
        elif st.get("unit_amount") != attendu or st.get("currency") != p["currency"].lower() \
                or (st.get("recurring") or {}).get("interval") != ("month" if p["frequency"] == "monthly" else "year"):
            ecarts.append(f"{cle} : back-office {p['amount_decimal']} / Stripe {(st.get('unit_amount') or 0) / 100}")
        elif st.get("id") != p.get("stripe_price_id"):
            ecarts.append(f"{cle} : base relie {p.get('stripe_price_id')} au lieu de {st.get('id')}")
    feu("rouge" if ecarts or not grille else "vert", "Stripe", "Prix du back-office = prix Stripe actifs (montant, devise, periode)",
        (" | ".join(ecarts[:5]) + (f" (+{len(ecarts) - 5})" if len(ecarts) > 5 else "")) if ecarts
        else (f"{len(grille)} prix identiques" if grille else "grille illisible"))
except Exception as e:
    feu("rouge", "Stripe", "Prix du back-office = prix Stripe actifs", str(e)[:80])

# 7) DNS et sante
dns = sh("dig +short mettrik.ai A | head -1"); cn = sh("dig +short www.mettrik.ai CNAME | head -1")
feu("vert" if dns == "76.76.21.21" and "vercel" in cn else "rouge", "Domaine", "mettrik.ai et www pointent vers Vercel", f"A={dns} CNAME={cn}")
for hote in ("mettrik-niveau2.vercel.app", "mettrik.ai"):
    code = sh(f"curl -s -o /dev/null -w '%{{http_code}}' https://{hote}/api/billing/health")
    feu("vert" if code == "200" else "rouge", "Domaine", f"{hote} repond (health)", f"HTTP {code}")

# 8) AUTOMATES
la = sh("launchctl print gui/$(id -u)/ai.mettrik.earnings-refresh 2>/dev/null | grep -c state")
# 6 sept 2026 : launchctl print affiche desormais plusieurs lignes contenant "state" ; charge = au moins une.
feu("vert" if la.strip().isdigit() and int(la.strip()) >= 1 else "rouge", "Automates", "Service de session 23h (extraction) charge sur le Mac", f"{la.strip()} ligne(s) d etat")
cr = sh("crontab -l 2>/dev/null | grep -c earnings-refresh.sh")
feu("vert" if cr.strip() == "0" else "orange", "Automates", "Ancien cron 23h (sans acces au trousseau) retire", "")

# 9) GRAPHIQUES MOYEN TERME : libelles de l axe X sans chevauchement (7 oct 2026)
try:
    import importlib.util
    _sp = importlib.util.spec_from_file_location("verif_axes_mt", ROOT / "scripts" / "verif-axes-mt.py")
    _va = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_va)
    _defauts, _total = [], 0
    for _f in sorted((ROOT / "public" / "findings").rglob("*.svg")):
        _t = _f.read_text()
        if not _va.est_graphique_mt(_t):
            continue
        _total += 1
        if _va.verifie_svg(_t) or _va.verifie_svg(_t, rendu=True):
            _defauts.append(str(_f.relative_to(ROOT)))
    feu("orange" if _defauts else "vert", "Graphiques", "Libelles de l axe X des graphiques moyen terme sans chevauchement (scripts/verif-axes-mt.py)",
        f"{len(_defauts)} en defaut sur {_total}" + (" : " + ", ".join(_defauts[:4]) if _defauts else ""))
except Exception as e:
    feu("orange", "Graphiques", "Controle des axes des graphiques moyen terme", str(e)[:80])

# 8b) EXPORTS PNG DES GRAPHIQUES : aucune bande, fond du theme bord a bord (7 oct 2026, export AMD)
# scripts/verif-export-png.mjs compile le code source d export, l injecte dans de vraies fiches (preversion),
# controle 2 societes x sombre/clair x ordinateur/mobile x barres/courbe/variation (suite complete : 5 societes).
try:
    _env = dict(os.environ, TICKERS="AMD,KO")
    _r = subprocess.run(["node", "scripts/verif-export-png.mjs", "--json"], capture_output=True, text=True, timeout=900, env=_env)
    if _r.returncode == 2 or not _r.stdout.strip():
        feu("orange", "Graphiques", "Exports PNG sans bande, fond plein (scripts/verif-export-png.mjs)", "controle non execute : " + (_r.stderr or "")[:80])
    else:
        _j = json.loads(_r.stdout)
        _ko = [x["id"] for x in _j["resultats"] if x["defauts"]]
        # bandes / bords / etirement = rouge ; simple chevauchement de libelles = orange (a corriger dans le graphique)
        _dur = [x["id"] for x in _j["resultats"] if any("chevauchent" not in d for d in x["defauts"])]
        feu("rouge" if _dur else ("orange" if _ko else "vert"), "Graphiques", "Exports PNG sans bande, fond plein du theme bord a bord (scripts/verif-export-png.mjs)",
            f"{len(_ko)} en defaut sur {_j['total']}" + (" : " + ", ".join(_ko[:4]) if _ko else ""))
except Exception as e:
    feu("orange", "Graphiques", "Exports PNG sans bande", str(e)[:80])

# 8b) ACCUEIL = FICHES : chaque KPI de la grille d accueil et de la carte des pays doit exister
# sur la fiche servie (meme nom, meme valeur) avec un dernier point de moins de 18 mois (8 oct 2026).
try:
    import datetime as _dt
    env_c = dict(os.environ)
    for l in (ROOT / ".env.local").read_text().splitlines():
        if "=" in l and not l.lstrip().startswith("#"):
            k_, v_ = l.split("=", 1)
            env_c[k_.strip()] = v_.strip().strip('"')
    _tk = set()
    _vitrines = []
    for _f, _g in (("src/data/home-wow-kpis.json", lambda d: d["societes"]),
                   ("src/data/carte-pays-kpis.json", lambda d: [s for l in d["zones"].values() for s in l])):
        for s_ in _g(json.loads(Path(_f).read_text())):
            _tk.add(s_["ticker"]); _vitrines.append((_f.split("/")[-1], s_))
    subprocess.run(["npx", "tsx", "scripts/export-kpis-servis.ts", "/tmp/verif-kpis-servis.json", *sorted(_tk)],
                   capture_output=True, text=True, timeout=900, env=env_c)
    _sv = json.loads(Path("/tmp/verif-kpis-servis.json").read_text())
    _num = lambda x: re.sub(r"[^0-9]", "", str(x))
    _ecarts = set()
    _auj = _dt.date.today()
    for src_, s_ in _vitrines:
        fiche = _sv.get(s_["ticker"])
        if not fiche:
            _ecarts.add(f"{s_['ticker']}:fiche absente"); continue
        for k_ in s_["kpis"]:
            m_ = [x for x in fiche["kpis"] if k_["nom"] in (x.get("name_fr"), x.get("name_en"))]
            if not m_:
                _ecarts.add(f"{s_['ticker']}:{k_['nom'][:30]} absent de la fiche"); continue
            if not any(_num(x.get("value")) == _num(k_["valeur"]) for x in m_):
                _ecarts.add(f"{s_['ticker']}:{k_['nom'][:30]} valeur differe")
            mp = re.match(r"T([1-4]) (\d{4})", k_.get("periode") or "")
            if not mp:
                _ecarts.add(f"{s_['ticker']}:{k_['nom'][:30]} sans periode")
            elif (_auj - _dt.date(int(mp.group(2)), int(mp.group(1)) * 3, 1)).days > 18 * 30 + 31:
                _ecarts.add(f"{s_['ticker']}:{k_['nom'][:30]} periode ancienne")
    _ecarts = sorted(_ecarts)
    feu("rouge" if _ecarts else "vert", "Accueil", "KPI de l accueil et de la carte des pays = KPI servis par la fiche, periode recente",
        f"{len(_ecarts)} ecart(s) : " + " | ".join(_ecarts[:6]) + " (relancer scripts/build-home-wow.py)" if _ecarts else f"{len(_tk)} societes verifiees")
except Exception as e:
    feu("rouge", "Accueil", "KPI de l accueil = KPI des fiches", str(e)[:80])

# 9) HERO DES FICHES : aucun hero generique/comptable quand un KPI specifique existe, aucun override orphelin
# (7 oct 2026). Charge le VRAI chargeur sur les societes de clean-all-tickers : scripts/verif-hero-generique.ts.
try:
    env_h = dict(os.environ)
    for l in (ROOT / ".env.local").read_text().splitlines():
        if "=" in l and not l.lstrip().startswith("#"):
            k_, v_ = l.split("=", 1)
            env_h[k_.strip()] = v_.strip().strip('"')
    subprocess.run(["npx", "tsx", "scripts/verif-hero-generique.ts", "/tmp/verif-hero-generique.json"],
                   capture_output=True, text=True, timeout=900, env=env_h)
    rh = json.loads(Path("/tmp/verif-hero-generique.json").read_text())
    orph = [f"{r['t']}:{r['orphelin']}" for r in rh["orphelins"]]
    bloq = [f"{r['t']}:{r['hero']}" for r in rh["bloquants"]]
    feu("orange" if orph else "vert", "Hero", "Aucun override de hero (desk_hero_kpi_overrides) orphelin",
        f"{len(orph)} orphelin(s) : " + ", ".join(orph[:8]) if orph else f"{rh['charges']} fiches chargees")
    feu("rouge" if bloq else "vert", "Hero", "Aucun hero generique ou comptable alors qu'un KPI specifique existe",
        f"{len(bloq)} fiche(s) : " + ", ".join(bloq[:8]) if bloq else "0")
    og = [r["t"] for r in rh["overrideGeneriques"]] + [r["t"] for r in rh["restants"]]
    feu("orange" if og else "vert", "Hero", "Heros generiques poses a la main ou sans KPI specifique (a arbitrer)",
        f"{len(og)} : " + ", ".join(og[:12]) if og else "0")
except Exception as e:
    feu("orange", "Hero", "Controle du hero des fiches (verif-hero-generique.ts)", str(e)[:80])

# 10) FUITES PUBLIQUES (8 oct 2026, audit visiteur anonyme, rapport audit-public/CORRECTIONS.md)
# a) Preversion niveau2 = exactement ce qui sera promu sur mettrik.ai : pages publiques, TOUS les chunks
#    atteignables, API sans connexion, robots, en-tetes, base Supabase lue avec la cle anonyme du JS,
#    outillage des preversions (doit repondre 404 sans session admin). Un rouge bloque go-n0.sh.
try:
    _r = subprocess.run(["node", "scripts/verif-fuites-publiques.mjs", "https://mettrik-niveau2.vercel.app", "--json", "--previews"],
                        capture_output=True, text=True, timeout=600)
    if _r.returncode == 2 or not _r.stdout.strip():
        feu("orange", "Fuites", "Aucune fuite publique sur niveau2 (scripts/verif-fuites-publiques.mjs)", "controle non execute : " + (_r.stderr or "")[:80])
    else:
        _j = json.loads(_r.stdout)
        # niveau1 = ancien deploiement fige (jamais promu) : signale en orange, ne bloque pas go-n0.
        _n1 = [c for c in _j["constats"] if c["gravite"] == "rouge" and "niveau1" in c["ou"]]
        _rg = [c for c in _j["constats"] if c["gravite"] == "rouge" and c not in _n1]
        _or = _n1 + [c for c in _j["constats"] if c["gravite"] == "orange" and c["id"] not in ("sitemap", "en-tete", "preversion-publique")]
        feu("rouge" if _rg else ("orange" if _or else "vert"), "Fuites",
            "Aucune fuite publique sur niveau2 : secrets, notes internes, prenom, noms d hote, comptes exacts, tables ouvertes (verif-fuites-publiques.mjs)",
            (f"{len(_rg)} rouge(s) : " + " | ".join(f"{c['id']} {c['ou'][:30]}" for c in _rg[:5])) if _rg
            else (f"{len(_or)} orange(s) : " + " | ".join(f"{c['id']} {c['ou'][:30]}" for c in _or[:5]) if _or else f"{_j['chunks']} chunks lus, 0 constat"))
except Exception as e:
    feu("orange", "Fuites", "Controle des fuites publiques sur niveau2", str(e)[:80])
# b0) Code client public regroupe par esbuild avec le meme chargeur que le build (rapide, sans next build) :
#     aucune liste de l univers, aucun compte, aucune note interne, aucun prenom/courriel/nom d hote.
try:
    _r = subprocess.run(["node", "scripts/verif-fuites-publiques.mjs", "--source", "--json"], capture_output=True, text=True, timeout=300)
    _j = json.loads(_r.stdout)
    _rg = [c for c in _j["constats"] if c["gravite"] == "rouge"]
    feu("rouge" if _rg or _j.get("erreurs") else "vert", "Fuites", "Code client public (esbuild, chargeur d assainissement) sans fuite",
        (f"{len(_rg)} rouge(s) : " + " | ".join(f"{c['id']} {c['ou'][:30]} {c['extrait'][:40]}" for c in _rg[:4])) if _rg
        else (f"{_j.get('erreurs')} erreur(s) esbuild" if _j.get("erreurs") else f"{_j['entrees']} composants client, 0 rouge"))
except Exception as e:
    feu("orange", "Fuites", "Code client public (esbuild)", str(e)[:80])
# b) Build local (statique) : tout le dossier static/ d un build local recent, s il existe
#    (NEXT_DIST_DIR=.next-audit npx next build, ou .next). Les fichiers atteignables depuis les
#    routes publiques sont en rouge, le reste (outillage admin) en orange.
try:
    _dirs = [d for d in (".next-audit", ".next") if (ROOT / d / "BUILD_ID").exists()]
    if not _dirs:
        feu("orange", "Fuites", "Analyse statique d un build local (.next-audit ou .next)", "aucun build local : lancer NEXT_DIST_DIR=.next-audit npx next build")
    else:
        _d = max(_dirs, key=lambda d: (ROOT / d / "BUILD_ID").stat().st_mtime)
        _age_h = (__import__("time").time() - (ROOT / _d / "BUILD_ID").stat().st_mtime) / 3600
        _r = subprocess.run(["node", "scripts/verif-fuites-publiques.mjs", "--static", _d, "--json"], capture_output=True, text=True, timeout=600)
        _j = json.loads(_r.stdout)
        _rg = [c for c in _j["constats"] if c["gravite"] == "rouge"]
        feu("rouge" if _rg else ("orange" if _age_h > 48 else "vert"), "Fuites",
            f"Analyse statique du build local {_d} (code public complet, pages prerendues)",
            (f"{len(_rg)} rouge(s) : " + " | ".join(f"{c['id']} {c['ou'][:30]}" for c in _rg[:5])) if _rg
            else f"{_j['fichiers']} fichiers, 0 rouge ; build vieux de {_age_h:.0f} h")
except Exception as e:
    feu("orange", "Fuites", "Analyse statique du build local", str(e)[:80])
# c) Supabase : aucune table du schema public sans RLS (une table sans RLS est lisible ET modifiable
#    avec la cle anonyme publiee dans le JS).
try:
    _q = "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"
    _o = subprocess.run(["curl", "-s", "-X", "POST", "https://api.supabase.com/v1/projects/idpsbtgvuyfwtvzelogw/database/query",
                         "-H", f"Authorization: Bearer {env_local('SUPABASE_PAT')}", "-H", "Content-Type: application/json",
                         "-d", json.dumps({"query": _q})], capture_output=True, text=True, timeout=60).stdout
    _sans = [x["relname"] for x in json.loads(_o)]
    feu("rouge" if _sans else "vert", "Fuites", "Toutes les tables Supabase ont la RLS activee", ", ".join(_sans) if _sans else "0 table sans RLS")
except Exception as e:
    feu("orange", "Fuites", "Tables Supabase sans RLS", str(e)[:80])

# 11) VAGUE sp5001000 (Russell 1000, decision de Yann du 9 oct 2026) : les nouvelles societes ne
#     sont servies QUE par le niveau 1 (deploiement avec UNIVERS=sp5001000, scripts/deploy-niveau1.sh)
#     tant que Yann n a pas dit « go ». Rouge si l une d elles apparait dans l univers du niveau 2 /
#     de la production. Liste d autorisation explicite, a tenir A LA MAIN apres le go :
#     `autorisees_univers_principal` de src/data/univers-sp5001000.json.
try:
    _n1 = json.loads((ROOT / "src/data/univers-sp5001000.json").read_text())
    _nz = lambda t: str(t).upper().replace("-", ".")
    _ok = {_nz(t) for t in _n1.get("autorisees_univers_principal") or []}
    _res = {_nz(t) for t in _n1.get("vague_complete") or []} - _ok
    # a) listes servies par le niveau 2 / la production (fichiers du depot)
    _fuites = []
    _listes = {
        "v1-9-5-clean-all-tickers.json": json.loads(Path("src/data/v1-9-5-clean-all-tickers.json").read_text())["tickers"],
        "market-cap-order.json": json.loads(Path("src/data/market-cap-order.json").read_text())["tickers"],
        "compare-index.json": list(json.loads(Path("src/data/compare-index.json").read_text()).get("names", {}).keys()),
        "home-wow-kpis.json": [s["ticker"] for s in json.loads(Path("src/data/home-wow-kpis.json").read_text())["societes"]],
        "carte-pays-kpis.json": [s["ticker"] for l in json.loads(Path("src/data/carte-pays-kpis.json").read_text())["zones"].values() for s in l],
        "kpi-comptes-industries.json (par_societe)": list((json.loads(Path("src/data/kpi-comptes-industries.json").read_text()).get("par_societe") or {}).keys()),
    }
    for _nom, _l in _listes.items():
        _x = sorted({_nz(t) for t in _l} & _res)
        if _x:
            _fuites.append(f"{_nom} : {', '.join(_x[:6])}" + (f" (+{len(_x) - 6})" if len(_x) > 6 else ""))
    feu("rouge" if _fuites else "vert", "Univers",
        "Aucune societe de la vague sp5001000 (Russell 1000) dans les listes du niveau 2 / production avant le go de Yann",
        " | ".join(_fuites) if _fuites else f"{len(_res)} societes reservees au niveau 1, {len(_ok)} autorisee(s)")
    # b) le code qui refuse ces societes est bien en place (chargeur + page de fiche + proxy)
    _code = {
        "src/lib/company-core/load-company.ts": "ficheServie(ticker)",
        "src/app/[ticker]/page.tsx": "ficheServie(upper)",
        "src/proxy.ts": "tickersUniversActif()",
    }
    _manq = [f for f, m in _code.items() if m not in (ROOT / f).read_text()]
    feu("rouge" if _manq else "vert", "Univers", "Garde-fou de l univers en place (src/lib/univers-actif.ts lu par le chargeur, la fiche et le proxy)",
        "absent de : " + ", ".join(_manq) if _manq else "")
    # c) la variable UNIVERS ne doit JAMAIS etre posee dans les variables du projet Vercel
    #    (sinon niveau 2 et production basculeraient sur le niveau 1) : seulement par deploiement.
    _univ = [",".join(e.get("target", [])) for e in envs.get("envs", []) if e.get("key") == "UNIVERS"]
    feu("rouge" if _univ else "vert", "Univers", "Variable UNIVERS absente des variables du projet Vercel (posee seulement sur le deploiement du niveau 1)",
        "presente en : " + " / ".join(_univ) if _univ else "")
    # d) controle reel : niveau 2 (ce que go-n0.sh promeut) ne sert aucune fiche de la vague.
    #    mettrik.ai : signale en orange (corrige par la promotion du niveau 2).
    _jeton = env_local("VISUAL_AUDIT_TOKEN") or ""
    _pretes = [t for t in (_n1.get("tickers") or []) if _nz(t) in _res][:3]
    _echantillon = list(dict.fromkeys(["SNOW", "TWLO"] + _pretes))
    def _servie(hote, t):
        _o = sh(f"curl -s -m 40 'https://{hote}/{t.lower()}?audit_token={_jeton}&cb=verif' | grep -o '<title>[^<]*</title>' | head -1", 60)
        return f"({t.upper()})" in _o or f"({t.upper().replace('-', '.')})" in _o
    # niveau 2 doit servir l univers principal : s il pointait par erreur sur un deploiement du
    # niveau 1 (UNIVERS=sp5001000), go-n0.sh mettrait la vague seule en production.
    feu("vert" if _servie("mettrik-niveau2.vercel.app", "NVDA") else "rouge", "Univers",
        "mettrik-niveau2.vercel.app sert l univers principal (fiche NVDA), pas un deploiement du niveau 1",
        "" if _servie("mettrik-niveau2.vercel.app", "NVDA") else "NVDA non servie : verifier vers quel deploiement pointe l alias niveau 2")
    for _hote, _grav in (("mettrik-niveau2.vercel.app", "rouge"), ("mettrik.ai", "orange")):
        _vus = [t for t in _echantillon if _servie(_hote, t)]
        feu(_grav if _vus else "vert", "Univers", f"{_hote} ne sert aucune fiche de la vague sp5001000 (echantillon {', '.join(_echantillon)})",
            ("servies : " + ", ".join(_vus) + (" (anciennes fiches V1.7 visibles des inscrits : deployer le garde-fou src/lib/univers-actif.ts)" if _hote == "mettrik-niveau2.vercel.app" else " (corrige a la prochaine promotion du niveau 2)")) if _vus else "")
except Exception as e:
    feu("rouge", "Univers", "Controle de la vague sp5001000 (src/data/univers-sp5001000.json)", str(e)[:100])

# SORTIE
ordre = {"rouge": 0, "orange": 1, "vert": 2}
feux.sort(key=lambda f: (ordre[f["feu"]], f["domaine"]))
sym = {"rouge": "🔴", "orange": "🟠", "vert": "🟢"}
for f in feux:
    print(f"{sym[f['feu']]} [{f['domaine']}] {f['controle']}" + (f" : {f['detail']}" if f["detail"] else ""))
n = {c: sum(1 for f in feux if f["feu"] == c) for c in ordre}
print(f"\nBILAN : {n['vert']} verts, {n['orange']} oranges, {n['rouge']} rouges")
if JSON_OUT:
    Path(JSON_OUT).write_text(json.dumps({"genere_le": sh("date -u +%Y-%m-%dT%H:%M:%SZ"), "feux": feux, "bilan": n}, ensure_ascii=False, indent=1))
sys.exit(1 if (STRICT and n["rouge"]) else 0)
