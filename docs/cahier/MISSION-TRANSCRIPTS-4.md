# Mission : quatre dernieres conferences de resultats par societe, suivi des KPI

Demande de Yann, 24 septembre 2026. Aucune avancee partielle n est annoncee :
un tableau d etat toutes les deux heures environ, ETA en tete.

## 1. Objectif

Pour chacune des 664 societes de l univers :
1. disposer des transcripts des QUATRE dernieres conferences de resultats ;
2. en extraire TOUS les indicateurs chiffres utiles a un investisseur, transcript
   par transcript, avec la meme methode (coherence) ;
3. afficher sur la fiche, en haut du bloc « Derniers resultats » :
   - un sous bloc « Suivi des KPI » : indicateurs cites dans AU MOINS DEUX
     conferences (pas forcement consecutives), avec valeur, unite, periode ;
   - un sous bloc « Cites une fois » : indicateurs importants mentionnes une
     seule fois, presentes a part ;
   - des fleches gauche / droite pour lire une conference plus ancienne ou plus
     recente, reservees aux paliers Premium et Max (floutees pour les autres).

## 2. Sources et stockage

- Etat actuel : `src/data/transcripts/<t>.json` porte seulement `latest`
  (747 fichiers). Il n est pas necessaire de retelecharger la derniere.
- Etats-Unis : MarketBeat (`scripts/marketbeat-transcripts.py`, `liste_rapports`
  donne la liste des conferences), en tete de navigateur, cadence lente.
- Europe et autres : FMP `/stable/earning-call-transcript-dates` puis
  `/stable/earning-call-transcript` (cle `FMP_API_KEY`), repli StockAnalysis.
- Nouveau format, retrocompatible : `calls: [{quarter, year, date, source_url,
  content}]` tries du plus recent au plus ancien ; `latest` reste tel quel.
- Journal de collecte : `.conv-state/transcripts-4/collecte.jsonl`
  (ticker, source, nb conferences, echec et raison). Une societe sans quatre
  conferences garde ce qu elle a ; le manque est liste, jamais invente.

## 3. Extraction (tache cruciale : Fable uniquement, jamais un moteur gratuit)

- Un sous agent Fable par transcript, prompt fixe et identique pour tous :
  liste JSON `{nom_fr, nom_source, valeur, unite, periode, citation}`.
  `valeur` et `citation` sont recopiees MOT POUR MOT depuis le transcript.
- Controle automatique avant toute ecriture : la citation existe dans le
  texte (recherche exacte apres normalisation des espaces), la valeur figure
  dans la citation, la periode est explicite (T2 2026, exercice 2025, 12 mois
  glissants...) sinon rejet de la ligne.
- Perimetre : indicateurs operationnels et financiers utiles a un investisseur
  (croissance, marges, volumes, clients, prix, carnet, flux de tresorerie,
  guidance chiffree). Exclus : numeros de page, dates, montants anecdotiques.
- Sortie : `src/data/transcripts-kpi/<t>.json` : `{calls: [{date, kpis: [...]}]}`.
- Rapprochement entre conferences : cle normalisee par
  `scripts/catalogue_nomenclature.py` (meme vocabulaire que le catalogue de
  comparabilite), puis controle Fable des paires douteuses ; un KPI est
  « suivi » quand la meme cle apparait dans deux conferences ou plus.
- Rapprochement avec l existant (`kpis` de la fiche) : meme cle -> l indicateur
  de la fiche n est pas duplique, la valeur de conference est rattachee.
- Controle qualite : toutes les 100 societes, 10 tirees au sort, relecture
  transcript en main ; sous 8 sur 10, arret et diagnostic avant de reprendre.

## 4. Affichage

- Bloc transcript : fleches « conference precedente / suivante » ; l etat
  choisi ne change pas l URL. Hors Premium et Max : fleches floutees et
  inactives (partie de floutage `fleches`, zone par defaut).
- Sous blocs en tete : « Suivi des KPI » (tableau : indicateur, derniere
  valeur et unite, periode, mini historique des valeurs par conference) et
  « Cites une fois » (liste courte). Format le plus court possible.
- Nouvelles parties de floutage : `fleches`, `suivi`, `cites-une-fois`.

## 5. Risques et parades

| Risque | Parade |
|---|---|
| MarketBeat ou FMP sans historique pour une societe | garder ce qui existe, lister le manque, ne rien inventer |
| Blocage anti robot | cadence lente, reprise sur journal, seconde source |
| Memoire du Mac | un seul telechargeur, sous agents d extraction par lots de 3 |
| Derive de l extraction | prompt fige, controle tous les 100, arret sous 8/10 |
| Doublons avec la fiche | rapprochement par cle du catalogue avant ecriture |
| Changement de compte Claude | journal de reprise par ticker, aucune tache automatique sur Claude |

## 6. Etapes et estimation

1. Collecte des conferences manquantes (3 par societe, ~2 000 documents) : 6 a 10 h machine, en fond.
2. Extraction Fable (~2 650 transcripts) : par lots, 2 a 3 jours.
3. Rapprochement et ecriture : 2 h.
4. Interface (fleches, sous blocs, floutage) : 3 h, en parallele de 1.
5. Controle final et deploiement : 2 h.

ETA global annonce a Yann : 4 jours, tableau d etat toutes les deux heures.
