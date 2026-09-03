#!/usr/bin/env python3
"""
Inventaire de la structure du site pour /sandbox/structure (Yann 3 sept 2026).
Lit le code reel (routes, API, tables, crons) et ecrit src/data/_structure-map.json.
Les descriptions en francais simple sont ecrites ici pour les elements connus ;
les elements non decrits recoivent une description generique.
"""
import json, re, glob, os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; os.chdir(ROOT)

pages = sorted(p.replace("src/app","").replace("/page.tsx","") or "/" for p in glob.glob("src/app/**/page.tsx", recursive=True))
apis = sorted(p.replace("src/app","").replace("/route.ts","").replace("/route.tsx","") for p in glob.glob("src/app/api/**/route.ts*", recursive=True))
tables = sorted(set(re.findall(r"create table (?:if not exists )?(?:public\.)?([a-z_]+)", "\n".join(open(f).read().lower() for f in glob.glob("supabase/migrations/*.sql")))))
vercel = json.load(open("vercel.json")).get("crons", [])
workflows = sorted(os.path.basename(f) for f in glob.glob(".github/workflows/*.yml"))
n_fiches = len(json.load(open("src/data/v1-9-5-clean-all-tickers.json"))["tickers"])
n_pipeline = len(glob.glob("src/data/v2-pipeline/*.json")); n_enrich = len(glob.glob("src/data/v2-pipeline-enrich/*.json"))
n_haut = len(glob.glob(".batches-drafts-safe/kpis-haut/*.json")); n_transcripts = len(glob.glob("src/data/transcripts/*.json"))
n_lake = len([d for d in glob.glob("data-lake/*") if os.path.isdir(d)])

def N(id, nom, desc, couche, **k):
    d = {"id": id, "nom": nom, "desc": desc, "couche": couche}; d.update(k); return d

publics = [p for p in pages if not re.match(r"^/(sandbox|desk-|admin|concepts|chart-lab|email-lab|logo-lab|whoami|k/)", p)]
internes = [p for p in pages if p not in publics]

noeuds = [
 # ── FRONT : parcours visiteur ──
 N("home","Page d'accueil","Ce que voit un visiteur en arrivant : recherche, vitrine des indicateurs, accès aux fiches.","front",critique=True,chemins=["/", "src/app/page.tsx", "src/app/sandbox/v1-9-5/page.tsx"],checks=["site_niveau2","home_index"]),
 N("recherche","Recherche de société","Barre de recherche (nom, ticker, accents tolérés) sur les 666 sociétés en ligne.","front",critique=True,chemins=["src/components/company-search.tsx"],checks=["fichier_univers"]),
 N("fiche","Fiche société","La page d'une société : indicateur principal et graphique, tableau des indicateurs, faits marquants, risques, gouvernance, IA, répartition du chiffre d'affaires, synthèse des résultats.","front",critique=True,chemins=["/<ticker>","/sandbox/v1-9-5/<ticker>","src/components/company-view.tsx"],checks=["fiche_aapl","fichier_univers","donnees_pipeline"],sous=["Indicateur principal + graphique","Tableau des indicateurs","Faits marquants (stories)","Facteurs de risque","Gouvernance et rémunération","Positionnement IA","Répartition du chiffre d'affaires","Synthèse des résultats"]),
 N("floutage","Floutage et paliers","Ce que voit un visiteur sans compte (flouté), un inscrit gratuit (Google, Meta, Booking en clair), un abonné Premium ou Max (tout).","front",critique=True,chemins=["src/lib/freemium/tier-serveur.ts","src/lib/floutage-caviardage.ts"],checks=["supabase","fiche_aapl"]),
 N("tarifs","Tarifs et paiement","Page des offres, paiement par carte via Stripe, portail client (factures, annulation).","front",critique=True,chemins=["/pricing","src/app/api/billing/checkout","src/app/api/billing/webhook","src/app/api/billing/portal"],checks=["stripe","stripe_webhook_secret","tarifs_page"]),
 N("compte","Inscription, connexion, compte","Créer un compte, se connecter, mot de passe oublié, page Mon compte (plan, favoris, suppression).","front",critique=True,chemins=["/account","src/components/auth-modal.tsx","src/app/auth/actions.ts"],checks=["supabase","hcaptcha"]),
 N("emails","Emails aux clients","Emails d'activation et de mot de passe (Supabase via Resend), série de bienvenue J+1 à J+25, alertes.","front",critique=True,chemins=["src/lib/email/*","email-templates/*"],checks=["resend"]),
 N("contact","Contact","Formulaire public, protégé par le captcha Turnstile quand la clé est posée.","front",critique=False,chemins=["/contact","src/app/api/contact"],checks=["turnstile"]),
 N("faq","FAQ","Questions fréquentes publiques (25), indexables, modifiables depuis le back-office.","front",critique=False,chemins=["/faq","/sandbox/faq"],checks=["faq_page"]),
 N("legal","Pages légales","Mentions, conditions générales, confidentialité.","front",critique=False,chemins=["/legal/mentions","/legal/conditions","/legal/confidentialite"],checks=["legal_page"]),
 N("partage","Partage d'un indicateur","Bouton Partager : texte prêt pour X, micro-lien /k/... vers le bon indicateur, carte image, PNG téléchargeable.","front",critique=False,chemins=["/k/<ticker>/<code>","src/app/api/og/kpi"],checks=["og_kpi"]),
 N("parrainage","Parrainage","Désactivé le 3 sept 2026 (récompense non câblée) : la page renvoie 404.","front",critique=False,chemins=["/parrainage"],checks=[]),
 # ── BACK-OFFICE ──
 N("desk","Desk propriétaire","Tableau de bord privé de Yann (URL secrète) : notes, tarifs, parrainage, bugs, contenus des pages.","back",critique=False,chemins=["/desk-mtk9x4kp"],checks=["desk_owner"]),
 N("admin","Admin","Réglages avancés : choix des indicateurs principaux, blocs activés par société.","back",critique=False,chemins=["/admin/kpis-toggle","/admin/blocks"],checks=[]),
 N("sb_floutage","Floutage (réglage)","Quelles zones sont floutées, par société.","back",critique=True,chemins=["/sandbox/admin/floutage-selector"],checks=["supabase"]),
 N("sb_logotheque","Logothèque","Images de marque et logo affiché par emplacement.","back",critique=False,chemins=["/sandbox/logotheque"],checks=[]),
 N("sb_faq","FAQ (édition)","Modifier, ajouter, réordonner les questions.","back",critique=False,chemins=["/sandbox/faq"],checks=[]),
 N("sb_telemetrie","Télémétrie","Visites et actions des visiteurs (tes visites exclues).","back",critique=False,chemins=["/sandbox/telemetrie"],checks=["supabase"]),
 N("sb_lancement","Lancement","Interrupteur de maintenance de mettrik.ai, sans redéploiement.","back",critique=True,chemins=["/sandbox/lancement"],checks=["supabase"]),
 N("sb_structure","Structure (cette page)","Carte de l'application et feux de santé.","back",critique=False,chemins=["/sandbox/structure"],checks=[]),
 N("sb_autres",f"Autres outils internes ({len(internes)} pages)","Audits, tests, prototypes : réservés aux comptes connectés.","back",critique=False,chemins=internes[:12],checks=[]),
 # ── DONNÉES ──
 N("univers","Univers en ligne",f"Liste des {n_fiches} sociétés visibles (S&P 500, CAC 40, DAX 40, AEX 25, SMI, SOX).","donnees",critique=True,chemins=["src/data/v1-9-5-clean-all-tickers.json"],checks=["fichier_univers"]),
 N("pipeline","Fiches de données",f"{n_pipeline} fichiers : indicateurs, historiques, risques, gouvernance, IA de chaque société.","donnees",critique=True,chemins=["src/data/v2-pipeline/"],checks=["donnees_pipeline"]),
 N("enrich","Enrichissements",f"{n_enrich} fichiers : séries trimestrielles, événements, descriptions, traductions.","donnees",critique=False,chemins=["src/data/v2-pipeline-enrich/"],checks=["donnees_enrich"]),
 N("haut","Indicateurs en tête",f"{n_haut} fichiers : indicateurs principaux vérifiés, lus en priorité par la fiche.","donnees",critique=True,chemins=[".batches-drafts-safe/kpis-haut/"],checks=["donnees_haut"]),
 N("transcripts","Synthèses de résultats",f"{n_transcripts} transcriptions de conférences de résultats et leurs synthèses.","donnees",critique=False,chemins=["src/data/transcripts/","src/data/transcript-summaries/"],checks=[]),
 N("lake","Data-lake (sources brutes)",f"{n_lake} dossiers de rapports officiels (10-K, 10-Q, communiqués) : la matière première, jamais servie au public.","donnees",critique=False,chemins=["data-lake/"],checks=[]),
 N("supabase_db","Base de données",f"{len(tables)} tables : comptes, abonnements, tarifs, promos, réglages, télémétrie...","donnees",critique=True,chemins=tables,checks=["supabase"]),
 # ── AUTOMATES ──
 N("cron_23h","Mise à jour des sociétés (23h)","Chaque soir sur ton Mac : veille des nouveaux rapports, extraction des nouveaux points, synthèses. Alerte email si rien n'est extrait.","automates",critique=True,chemins=["scripts/earnings-refresh.sh","scripts/ai.mettrik.earnings-refresh.plist"],checks=["cron_23h"]),
 N("cron_watchers","Veilles documentaires (4h, 4h30)","Détection des nouveaux dépôts SEC (US) et pages investisseurs (Europe).","automates",critique=False,chemins=["scripts/daily-doc-watcher.sh","scripts/fr-doc-watcher.sh"],checks=["watcher_us","watcher_eu"]),
 N("cron_vercel","Robots Vercel",f"{len(vercel)} tâches côté serveur : " + ", ".join(f"{c['path'].split('/')[-1]} ({c['schedule']})" for c in vercel) + ".","automates",critique=False,chemins=["vercel.json"],checks=["cron_secret"]),
 N("workflows","Robots GitHub",f"{len(workflows)} workflows : " + ", ".join(w.replace('.yml','') for w in workflows) + ".","automates",critique=False,chemins=workflows,checks=["github_dispatch"]),
 N("release","Contrôle avant ouverture","24 vérifications (code, variables, niveaux, Supabase, Stripe, DNS) avant toute promotion vers mettrik.ai.","automates",critique=True,chemins=["scripts/verif-release.py","scripts/go-n0.sh"],checks=["release_check"]),
 # ── EXTERNES ──
 N("vercel","Hébergement Vercel (3 niveaux)","n0 = mettrik.ai (public), n1 = mettrik-niveau1, n2 = mettrik-niveau2 (travail). n2 ne touche jamais n0.","externes",critique=True,chemins=["scripts/deploy-niveau2.sh","scripts/go-n0.sh"],checks=["site_niveau2","site_n0"]),
 N("supabase","Supabase (comptes et base)","Authentification, base de données, emails d'authentification.","externes",critique=True,chemins=[],checks=["supabase","supabase_env"]),
 N("stripe","Stripe (paiement)","Encaissement, abonnements, factures, portail client.","externes",critique=True,chemins=[],checks=["stripe","stripe_webhook_secret"]),
 N("resend","Resend (emails)","Envoi de tous les emails de la marque.","externes",critique=True,chemins=[],checks=["resend"]),
 N("captcha","Turnstile et hCaptcha","Anti-robots : contact (Turnstile) et inscription (hCaptcha).","externes",critique=False,chemins=[],checks=["turnstile","hcaptcha"]),
 N("yfinance","Yahoo Finance","Cours de bourse et capitalisations affichés sur les fiches.","externes",critique=False,chemins=["src/app/api/stock-prices"],checks=["prix"]),
 N("sec","SEC EDGAR","Source des rapports officiels américains (10-K, 10-Q, 8-K).","externes",critique=False,chemins=[],checks=[]),
 N("fool","Motley Fool","Source des transcriptions de conférences de résultats.","externes",critique=False,chemins=[],checks=[]),
]
out = {"genere_le": __import__("datetime").datetime.utcnow().isoformat()+"Z",
       "compteurs": {"pages_publiques": len(publics), "pages_internes": len(internes), "api": len(apis), "tables": len(tables), "fiches": n_fiches},
       "pages_publiques": publics, "api": apis, "tables": tables, "noeuds": noeuds}
Path("src/data/_structure-map.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print("noeuds:", len(noeuds), "| pages publiques:", len(publics), "| internes:", len(internes), "| api:", len(apis), "| tables:", len(tables))
