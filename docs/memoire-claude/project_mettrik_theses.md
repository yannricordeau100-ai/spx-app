---
name: project-mettrik-theses
description: "Theses d investissement Mettrik (cas favorable, miroir de l anti-these) : regles de Yann, fichiers, chaine de production par agents et verification, etat d avancement"
metadata:
  node_type: memory
  type: project
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-19T12:47:34.820Z
---

Chantier ouvert le 19 sept 2026 apres les anti-theses. Regles de Yann :
- une these par societe, redigee SELON LES CRITERES d un investisseur celebre, d une grande banque ou d une methode reconnue (referentiel /tmp/methodes_investissement.json, 46 styles : 23 investisseurs, 14 banques, 9 methodes ; a reconstruire si /tmp est vide) ; le style est nomme en preambule ; avec 570 societes les repetitions sont inevitables, on les equilibre en IMPOSANT un style par ticker dans le prompt de l agent (sinon les agents choisissent tous les memes : Tom Russo, Barclays, Bernstein) ;
- valorisation volontairement ignoree (dit en preambule) ; donnees de 18 mois au plus ; integrer le plus possible de KPI de la fiche sans forcer ;
- un graphique fiable venant d ailleurs (spec finding-svg, citations verbatim, jamais une image copiee), en variant les series entre societes proches (ne pas resservir Census e-commerce, Synergy cloud, WSTS, EIA Guyana) ;
- un element additionnel personnel, separe et retirable, liste dans /sandbox/theses ;
- antidatee (mois seul), mois different de l anti-these, jamais avant le document le plus recent ;
- ordre : francaises (44, faites), americaines (527, en cours par capitalisation : /tmp/these_us_ordre.json), puis le reste ; ETA totale environ 30 h a 2-3 agents.
- Yann 19 sept : these et anti-these TOUT EN BAS de la fiche (apres synthese du communique et sources).

Infrastructure : `src/lib/these.ts`, `src/lib/these-server.ts`, `src/data/these/<t>.json`, `TheseCard`, bloc floutable `these`, page `/sandbox/theses`. Graphiques dans `public/findings/theses/<t>/`.

Production : gabarit `/tmp/prompt_these.txt` (europeennes, dossier ir/) et `/tmp/prompt_these_us.txt` (americaines, dossiers 10K/10Q/8K/ER/EP/ES) instancies par `/tmp/gen_prompt_us.py <T...>` ; KPI servis via `npx tsx scripts/dump-hero-context.ts <T...>` puis `/tmp/conv_these_kpis.py` ; agents Opus, 2 a 3 en parallele (swap a surveiller, un `next build` local fait exploser la RAM : ne jamais en lancer par agent) ; verification `/tmp/verifie_these.py <T>` + `/tmp/sonde_preuves.py <T>` (dossiers europeens et americains) + confirmation web des citations si « illisible » ; pose `/tmp/applique_these.py <T>`. Les 8-K locaux n ont pas l exhibit 99 : verifier les communiques via data-lake/<T>/ER ou sec.gov.

Deploiement : go-n0 exige local == pousse == niveau2 ; si des theses ont ete commitees apres le push, faire `git stash push && git reset --hard <sha niveau2>`, go-n0, puis `git reset --hard <sha local> && git stash pop`.

Liens : [[project-mettrik-lancement]] [[feedback-verif-extractions-agents]]

Ajouts 19-20 sept 2026 :
- Etat : 320 theses posees (44 FR + 276 US) au 20 sept 00h30 ; prod v17 (mettrik.ai) ; reste ~135 US puis « le reste » (europeennes hors France + ADR : ARM, SHOP, MELI, PDD, NBIS, NXPI, CRH, CCEP, FER).
- Regle Yann : jamais « ste »/« stes » dans les pages du site, toujours « societe(s) ».
- Moyen terme (chantier point 1) : gabarit /tmp/prompt_mt.txt instancie par societe (/tmp/prompt_mt_<T>.txt, demandes /tmp/mt_demandes_<T>.json), agents 3 en parallele, sortie /tmp/mt_specs_<T>.json, verification + insertion par `python3 scripts/kpi-mt-publie-specs.py <T> --publie` (max 9 par societe), statut pending_review pour Yann. Interdits : donnees de la societe (rapports, ratios recalcules par StockAnalysis...), sources de plus de 18 mois (regle en dur dans le script depuis le 20 sept), apostrophes manquantes a corriger (l annee -> l'annee), nom de societe exact (AXA pas Axa).
- go-n0 avec commits locaux en avance : la promotion Vercel reconstruit la prod (10 a 20 min) ; le script commit « monitor refresh auto » sur la branche, ne rien ecrire dans le depot avant REPO-RESTAURE ; un agent qui ecrit dans le depot pendant ce laps perd ses modifs (sauver dans /tmp).
