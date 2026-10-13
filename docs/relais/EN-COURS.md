# Travail en cours : registre unique (mis a jour par le compte actif a chaque lancement et a chaque fin)

Regle anti-doublon : un element n est refait par l autre compte QUE s il est marque « a faire » ou « interrompu ».
Pour un element « interrompu », la reprise part des fichiers de sortie deja ecrits (les workflows sautent les societes
dont le fichier existe et est verifie). Statuts : fait (commit) | en cours | interrompu | a faire.

| Element | Statut | Sortie / preuve | Reprise |
|---|---|---|---|
| Protocole relais (RELAIS-COMPTES.md, sauvegarde-relais.sh) | fait | commit du 13 oct | - |
| Hero : ancien affichage (gros chiffre + indications a gauche, texte explicatif dessous, graphique a droite) | fait (6df0b85b3e) | a verifier visuellement sur N2 | relancer un agent Opus avec la demande de Yann du 13 oct (CONTEXTE-2026-10-13.md, point 1) |
| KPI institutionnels en jaune et en tete des KPI IC, nom de fiche, explication, UX | fait (33c870c65d) | commit local | idem point 2 |
| Tableau des 68 societes a 1 seul KPI institutionnel, preuve a 100 % | fait | data-lake/_kpi-instit/preuves/<T>.json | relancer seulement les tickers sans fichier de preuve (liste : scratchpad instit-1.json, recalculable depuis src/data/kpi-industries-etat.json, stes_avec de taille 1) |
| Logo des emails (PNG actuel, affichage reel) | fait (7185c54aee) | public/email/mettrik-logo-email.png ; en ligne seulement apres go n0, puis Yann lance PUSH-VIA-API.sh | - |
| Page 404 wow | fait (cc9ad099b0) | src/app/not-found.tsx | - |
| Panneau admin KPI institutionnels (vert/rouge/orange/jaune, absent du code n0) | en cours | src/components/admin/kpi-instit-statuts.tsx | finir le cablage company-header/company-view |
| Barre d outils graphique mobile | en cours | chart-mobile-controls | - |
| Annees fondation/IPO, emetteurs etrangers, trimestre du moat | en cours | commit local | - |
| Russell 1000 blocs (workflow-blocs.js) | fait (24 derniers termines le 13 oct, verif.json ecrits ; reste la pose N1) | data-lake/_sp5001000/blocs/<T>/verif.json | relancer sur les tickers sans verif.json (WMS WPC WSC WSO WTFC WLK WTM WTS WTRG WU WING WWD XE XP XPO YETI WHR Z ZION ZM ZS WAL WFRD WEX : theses/verif manquantes) |
| Russell 1000 parite (workflow-parite.js) | interrompu (limite) | data-lake/_sp5001000/parite/<T>.json avec cle verif | relancer sur les tickers sans parite/<T>.json verifie (a partir de BFAM BIO BIRK BJ BLSH BMRN BOKF BPOP BRKR BHF BROS BILL puis la suite de la liste) |
| Pose N1 (merge-blocs, onboard, parite, dates, deploy-niveau1) | a faire | ordre dans REPRISE-2026-10-09.md | apres blocs et parite |
| Pairs Finnhub (US, N2 puis N1, validation Sonnet, design Opus) | en cours (donnees : src/data/pairs-us.json, data-lake/_pairs/brut) ; design a faire | cle FINNHUB_API_KEY presente dans .env.local depuis le 13 oct | - |
| Deploiement N2 puis go n0 | a faire | dernier essai deploy-niveau2 : TIMEOUT preview (13 oct 06h) | relancer scripts/deploy-niveau2.sh une fois les agents finis, verifier multi-cas, puis go n0 |
| SQL 20261013_telemetrie_compte.sql | a faire (Yann colle) | supabase/migrations | - |
| KPI principal absent des KPI IC apres changement de KPI (662/662 fiches) | fait (075ca47b61) | src/lib/groupes-kpis-fiche.ts | - |
| KPI institutionnels publies mais absents + incertains | fait (fa5db6d7f4, deploy N2 lance) | preuves/<T>.json statut publie_ajoute + verif_ajout ; puis pose kpis-haut et deploy N2 | relancer seulement les tickers sans verif_ajout |
