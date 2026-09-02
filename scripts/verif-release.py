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
                "CEREBRAS3_API_KEY", "GROQ_API_KEY", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "RESEND_WEBHOOK_SECRET",
                "ADMIN_EMAILS", "GITHUB_DISPATCH_TOKEN", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "FMP_API_KEY",
                "METTRIK_SEC_DIR", "PDFTOTEXT_BIN"}
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
feu("orange" if "NEXT_PUBLIC_HCAPTCHA_SITE_KEY" not in par_cible["production"] else "vert", "Variables",
    "Cle hCaptcha d inscription posee en production", "absente : inscription sans protection anti-robots" if "NEXT_PUBLIC_HCAPTCHA_SITE_KEY" not in par_cible["production"] else "")

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

# 7) DNS et sante
dns = sh("dig +short mettrik.ai A | head -1"); cn = sh("dig +short www.mettrik.ai CNAME | head -1")
feu("vert" if dns == "76.76.21.21" and "vercel" in cn else "rouge", "Domaine", "mettrik.ai et www pointent vers Vercel", f"A={dns} CNAME={cn}")
for hote in ("mettrik-niveau2.vercel.app", "mettrik.ai"):
    code = sh(f"curl -s -o /dev/null -w '%{{http_code}}' https://{hote}/api/billing/health")
    feu("vert" if code == "200" else "rouge", "Domaine", f"{hote} repond (health)", f"HTTP {code}")

# 8) AUTOMATES
la = sh("launchctl print gui/$(id -u)/ai.mettrik.earnings-refresh 2>/dev/null | grep -c state")
feu("vert" if la.strip() == "1" else "rouge", "Automates", "Service de session 23h (extraction) charge sur le Mac", "")
cr = sh("crontab -l 2>/dev/null | grep -c earnings-refresh.sh")
feu("vert" if cr.strip() == "0" else "orange", "Automates", "Ancien cron 23h (sans acces au trousseau) retire", "")

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
