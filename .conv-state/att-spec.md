# Spécification Anti-Thèse (ATT) — validée avec Yann le 10 août 2026

Bloc "Anti-thèse d'investissement" par sté : les raisons objectives de NE PAS
investir ou d'être méfiant, au moment de la rédaction. Réservé au plan max,
flouté ailleurs SAUF le hook. FR uniquement. Figé à date. Zéro invention.

## Fichier : src/data/att/<ticker minuscule>.json

{
 "ticker": "INTC",
 "redigee_le": "2026-08-10",
 "donnees_arretees_au": "<date du document le plus récent utilisé>",
 "intensite": "faible|moderee|elevee",
 "hook": "1 à 2 phrases accrocheuses, VISIBLES PAR TOUS. Donne envie de lire sans révéler le contenu. Concret, pas de clickbait mensonger.",
 "resume": "2-3 phrases simples qui posent l'anti-thèse.",
 "fondamental_interne": [
   {"titre": "...", "argument": "fait sourcé + pourquoi c'est un risque",
    "preuve": "chiffre ou citation verbatim + document source (10-K FY2025, URD, etc.)"}
 ],
 "fondamental_externe": [ même format : concurrence, réglementation, techno, cycle, macro ],
 "quantitatif": [
   {"titre": "...", "chiffre": "valeur verbatim", "perspective": "vs historique de la sté ET/OU vs pairs nommés",
    "source": "..."}
 ],
 "ce_qui_affaiblirait": ["faits qui, s'ils changent, périment cette ATT (rend la date utile)"],
 "glossaire": {"TERME*": "explication en une phrase, niveau lycéen"},
 "_sources": ["fichiers data-lake / app utilisés"],
 "_redige_par": "att-chain",
 "_fige": false
}

## Règles de rédaction (STRICTES)
1. OBJECTIVITÉ : chaque argument = un FAIT vérifiable (chiffre, citation,
   événement documenté) + son implication. Jamais d'opinion, jamais de
   prédiction de cours, jamais de "pourrait" non étayé.
2. TEST BULL-PROOF obligatoire : pour chaque argument, formuler mentalement la
   meilleure réponse d'un investisseur FAVORABLE à la sté. Si l'argument ne
   survit pas, le retirer. S'il survit avec nuance, intégrer la nuance dans
   l'argument lui-même (ex : "la dette est élevée (X Mds) MÊME EN comptant la
   trésorerie de Y Mds").
3. PROPORTIONNALITÉ : dossier solide = ATT courte assumée (intensite "faible",
   2-3 arguments max, le dire explicitement dans le résumé). Ne JAMAIS gonfler.
4. VULGARISATION : tout acronyme/terme technique marqué d'un astérisque et
   expliqué au glossaire. Phrases courtes. Un lycéen doit tout comprendre.
5. SOURCES : uniquement les documents locaux (data-lake/<T>/, kpis-haut,
   risques extraits, gouvernance) + chiffres déjà dans l'app. Pas de recherche
   web sauf pour vérifier un fait daté précis. Rien de non sourçable.
6. Vocabulaire Mettrik : pas d'em-dash, "Mds", FR partout.
7. Le hook ne doit RIEN contenir de faux ni de sensationnaliste : il résume
   l'angle le plus factuel et le plus fort de l'ATT.

## Intensité (grille)
- faible : entreprise sans fragilité structurelle identifiable ; risques
  résiduels = valorisation, cycle sectoriel, concentration mineure.
- moderee : 1-2 vraies fragilités documentées mais compensées par des forces.
- elevee : fragilités structurelles multiples et documentées (pertes, dette,
  perte de parts de marché, dépendance critique, litiges majeurs).

## Production
Ordre : market cap décroissante. 1 agent Fable par sté. Passe adversariale
séparée sur les ~40 stés les plus consultées + 10% d'échantillon.

## Récence (Yann 10 août 2026)
Utiliser les données LES PLUS RÉCENTES disponibles : derniers 10-Q/CP/rapports
2026 en priorité, puis 10-K/URD du dernier exercice. Chaque chiffre cité doit
être le dernier publié (sauf comparaison historique explicite). Le champ
donnees_arretees_au = date du document le plus récent réellement utilisé.

## Cross-pollution data-lake (audit 14 août 2026) — LIRE AVANT DE SOURCER
27 dossiers `data-lake/<ticker EU>/` contiennent en réalité les filings SEC
d'une société américaine homonyme. Les données publiées de l'app ne sont PAS
contaminées, mais un agent qui lit ces dossiers rédigerait l'ATT de la mauvaise
société. Pour ces tickers, IGNORER les sous-dossiers SEC (10K/10Q/8K/DEF14A/xbrl)
et n'utiliser que les documents IR de la sté européenne + kpis-haut + v2-pipeline :

ACA.PA (Arcosa), AI.PA (C3.ai), AIR.PA (AAR Corp), DG.PA (Dollar General),
DSY.PA (Big Tree Cloud), EL.PA (Estée Lauder), GLE.PA (Global Engine),
LI.PA (Li Auto), MC.PA (Moelis), ORA.PA (Ormat), SAN.PA (Banco Santander),
SU.PA (Suncor), AD.AS (US Cellular), ASM.AS (Avino Silver), NN.AS (NextNav),
ALV.DE (Autoliv), BNR.DE (Burning Rock), CBK.DE (Commercial Bancgroup),
CON.DE (Concentra), DTE.DE (DTE Energy), DTG.DE (DTE Energy), ENR.DE (Energizer),
HEI.DE (HEICO), MRK.DE (Merck & Co), MTX.DE (Minerals Technologies),
CFR.SW (Cullen/Frost), ROG.SW (Rogers Corp).

Dossiers SEC LÉGITIMES (ne pas écarter) : MT.PA (ArcelorMittal),
TTE.PA (TotalEnergies), SAP.DE (SAP SE), ALC.SW (Alcon), AMRZ.SW (Amrize).

Règle générale : pour tout ticker à suffixe .PA/.AS/.DE/.SW, vérifier le nom du
déposant dans le document AVANT de citer un chiffre. Si le déposant ne correspond
pas, écarter et le signaler dans `_sources`.

## Précision libellé date (14 août 2026)
`donnees_arretees_au` = date de PUBLICATION du document le plus récent utilisé
(pas la date de clôture de la période). L'UI affiche donc "sur la base des
documents publiés au X", et non "données arrêtées au X" qui serait inexact.

## Isolation scratchpad (14 août 2026) — OBLIGATOIRE
Plusieurs agents ATT tournent en parallèle et partagent le même dossier
scratchpad. Un incident réel a eu lieu : deux agents ont écrit des fichiers de
travail de même nom, l'un a lu les extraits de l'autre. Chaque agent DOIT donc
préfixer TOUS ses fichiers temporaires par son ticker
(ex `<scratchpad>/att_SHELL.AS_10q.txt`) et ne jamais lire un fichier de travail
qui ne porte pas son propre ticker. Au moindre doute sur l'origine d'un extrait,
le rejeter et relire le document source.

## Complément cross-pollution (14 août) : sous-dossiers SC13D / SC13G
La pollution ne touche pas que 10K/10Q/8K. Cas confirmé : `data-lake/OR.PA/SC13D/`
et `SC13G/` contiennent des filings d'Osisko Gold Royalties (NYSE: OR), pas
L'Oréal. Vérifier le déposant AUSSI dans SC13D, SC13G, 13F et xbrl.

## Ajout 14 août (2e audit) : BN.PA
`data-lake/bn.pa/` (minuscules sur disque) contient des filings de Brookfield
Corporation (NYSE: BN), pas Danone. Même traitement que les autres.

## Rendu (Yann 15 août 2026)
- Date affichée = MOIS + ANNÉE seulement, jamais le jour. `redigee_le` est
  stocké au format `YYYY-MM` et réparti sur mai à août 2026 pour que toutes les
  pages n'affichent pas la même date. Contrainte : `redigee_le` n'est JAMAIS
  antérieur au mois de `donnees_arretees_au` (une ATT ne peut pas citer un
  document publié après sa rédaction).
- `preuve` et `source` ne s'affichent plus sous le paragraphe : elles sont dans
  un "i" placé à droite du titre de l'argument. Les verbatims anglais ne
  polluent donc plus la lecture.
- Titres de section (Fondamental interne, etc.) en 15px semi-gras.
- Un `argument` ou une `perspective` qui enchaîne plusieurs constats séparés
  par " ; " est rendu en puces. À la rédaction, séparer les constats par " ; "
  plutôt que d'écrire un pavé d'un seul tenant.
- Glossaire : le terme s'affiche avec une majuscule initiale.
