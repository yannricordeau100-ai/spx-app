# Note session 25 juil 2026 ~05h40
- 166/503 done. Etat fiable dans kpi-v3-state.json.
- 5 agents Opus encore en vol au moment du stop: PSX, AEP, DASH, ECL, HOOD (leurs resultats arriveront; marquer done apres verif lint 0 rouge, sinon relancer selon regle handoff).
- WBD retire d'in_progress (non lance).
- Parallelisme valide: 6 agents OK sur ce Mac (free ~75%, swap ~4 Go, seuils: libre <12% ou swap >4,6 Go).
- Discipline qualite: relance corrective si point differe/hors scope/faible PV alors que la donnee est locale (methode: differences de cumuls YTD, controle somme segments = consolide).

- A signaler a Yann (validation requise, couche canonique): src/data/v2-pipeline/fix.json contient une story 'Record Annual EPS 4,09 $' erronee (reel FY2024 = 14,60 $ verbatim communique 19 fev 2026). Non corrige (regle 0nonies).
- A signaler a Yann: v2-pipeline/mco.json contient un 'Backlog MA 4,9 Mds $' sans source SEC verifiable (0 occurrence backlog dans 10-Q/ER 2026). Non modifie (regle 0nonies).

# Comble de contexte (26 juil 00:57, nouvelle conv)
- Parallelisme: HANDOFF dit 2 agents, Yann a releve a 5-6 apres tests RAM (seuils: libre <12% ou swap >4,6 Go).
- Episode TRV: ecart entre nb de KPI annonce (74 fichier / ~45 prod) et affiche (10 indicateurs + 23 stories). Cause = couches d'integration multiples non alignees avec le loader actuel. Verifier le RENDU REEL, pas le fichier, avant d'annoncer un chiffre.
- Regle categorisation confirmee par Yann: >=3 ans d'historique => indicateurs cles. <3 ans => stories. Ne pas basculer des indicateurs en stories.
- NFLX: serie semestrielle Engagement Hours publiee (test story multi-valeurs, doit rester lisible), story rachat WB supprimee, verifie en ligne sur mettrik-niveau2/sandbox/v1-9-5/nflx. Commit d0246c1f5e.
- Reprise auto planifiee 03:41 le 26 juil (nouvelle fenetre 5h), avec addendum tokens + relances correctives + jalon 250.
- Modele: Yann est passe en Opus puis Haiku pour economiser jusqu'a 03:41.
- Reste 297 stes, prochain = MET (203 done, in_progress PCAR/URI/OKE a verifier avant de marquer done).

# Directive Yann 27 juil 00:35 (nouvelle fenetre)
- Sub-agents desormais en modele PAR DEFAUT de la session (Fable, effort moyen), plus d'override Opus. But: plus de stes/heure, cout token/ste plus bas, qualite = memes regles (lint 0 rouge, check-list 15 points, zero invention).
- Historique plafonne a 12 ans (addendum point 7).
- Si la qualite Fable decroche (lint rouges, points manques), revenir a Opus et le signaler.
