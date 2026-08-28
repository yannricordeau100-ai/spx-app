# Session V195 du 28 aout 2026, reprise autonome (05h)

## Etat au demarrage
- clean-all-tickers : 871. online : 862. Les 9 non-online requalifies : 0 PASS,
  tous bloques structurellement (confirme, meme diagnostic que le 27 aout).
- Pipeline CA relance : 0 couple (ticker,bloc) a traiter, file vide.
- Aucune publication possible ce run.

## REGRESSION MAJEURE TROUVEE ET ARRETEE : scripts/earnings-refresh.py
Un superviseur (scripts/refresh-superviseur.py --max 3, PID 1202, lance vers
01h50) tournait depuis 3 h et corrompait les fiches au fil de l eau. 104 fiches
v2-pipeline et 123 kpis-haut touchees, 229 tickers restaient a passer.

Trois bugs de fond, tous corriges :

1. `periode_compatible` lisait `kpi["frequency"]`, champ qui n existe sur AUCUN
   KPI. Les fiches portent `period_type` (year / quarter / semester). La
   fonction rendait donc True pour tout et un chiffre trimestriel atterrissait
   au bout d une serie annuelle. Exemples : AJG brk_fees, serie annuelle
   [1296,9 ; 1476,9 ; 1885 ; 2193 ; 2646] a laquelle 1183 (un trimestre) est
   ajoute, soit une chute affichee de 55 % ; AMT rev_us_canada, serie annuelle
   en Mds $ [5,216 ; 5,248 ; 5,249] a laquelle 1329,2 (millions, trimestre) est
   ajoute. Correction : lecture de `period_type`, et frequence inconnue = refus
   au lieu de laisser passer.

2. Aucun controle d ordre de grandeur. Ajout de `echelle_compatible` : le
   nouveau point doit tenir dans [min/3 ; max*3] des quatre derniers points de
   sa propre serie. Seuil large a dessein, il ne juge pas la croissance, il
   ecarte les ruptures d unite et de periode.

3. Doublon du dernier point : `last_period` rend None des que l historique est
   une liste de nombres (le cas majoritaire), donc `period_key(None) = 0` et la
   garde anti-reecriture ne se declenchait jamais. 15 series allongees d un
   palier fictif (ACA.PA SFS_REV [... 3,52 ; 3,54] -> [... 3,54 ; 3,54]).
   Ajout de `deja_present`.

Les quatre cas temoins (AMT, AJG, ACA.PA, ADYEN.AS) sont desormais bloques,
chacun par au moins une garde.

## Travail corrompu rejete
`git checkout` sur src/data/v2-pipeline, .batches-drafts-safe/kpis-haut et
.conv-state/quarterly-refresh-backups. Rien n avait ete commite ni pousse : la
production n a jamais vu ces valeurs.

## Transcripts conserves
284 fiches src/data/transcripts portent de vrais nouveaux trimestres (source
Motley Fool, Q2 et Q3 2026), sans rapport avec le bug. Conservees, mais
reecrites avec l indentation d origine relevee dans HEAD (sinon le diff passait
de 1 400 a plus de 100 000 lignes) et `fetched_at`, que le rafraichissement
supprimait, remis a la date du rafraichissement.

## A SIGNALER A YANN
- Le superviseur est arrete. A relancer seulement apres validation du lot
  temoin, sinon il repart sur les 229 tickers restants.
- Defaut systemique deja signale le 27 aout et toujours ouvert : le
  rafraichissement met a jour `value`, `history` et `yoy` mais laisse
  `description` intacte. scan-stale-descriptions ne voit que 12 suspects parce
  qu il exige l unite exacte ; le cas NVDA (description a 120,1 Mds$ face a une
  value de 59 688 $M) lui echappe. Detecteur a elargir.
- MTB Shareholders Equity et Net Interest Income : history divisee par mille,
  seuls ecarts d echelle nette restants. Source verbatim necessaire.

## Verification de la correction, sur 17 societes
Aucune fiche modifiee, et les motifs de rejet sont desormais journalises.
AMT, la fiche la plus abimee du lot, rejette maintenant les cinq valeurs avec
le motif exact "periode Q1-2026 incompatible avec year". TXN rejette pour
"chiffre absent des documents", garde-fou anti-hallucination anterieur, donc
les nouvelles gardes ne sont pas responsables du zero retenu : les moteurs ne
proposaient rien de nouveau sur ces societes deja a jour.

## 16 KPI remis a l echelle, deployes
Seize KPI en ligne portaient des dollars bruts sous l unite "M $", soit des
milliers de milliards a l affichage : ADSK Capex, CW Capex, DXCM (R&D,
Operating Income, Cash), EVRG Net Income, JAZZ Capex, LIN (Operating Profit,
Capex), PSA NOI, PSX Benefice net, TAP Gross profit, WBD Operating Income,
WDAY Net Income. Valeurs et historiques divises par un million, unite
inchangee. Workday servait de temoin : sa fiche kpis-haut portait deja 222,0
$M la ou companies portait 222 000 000. L actif total de MUFG et de Nomura,
en millions de yens, est reetiquete "M ¥". Les 13 fiches requalifiees 13/13
PASS.

## Deux detecteurs ajoutes
- `scripts/scan-unit-magnitude.py` : compare l ordre de grandeur d une valeur
  a son unite, avec un facteur pour les devises faibles (yen, couronnes),
  sans quoi l actif de MUFG passerait pour une aberration. Etat : 0.
- `scripts/scan-stale-descriptions-large.py` : normalise en millions toutes les
  sommes citees dans une description avant de les comparer a la value, la ou la
  version d origine exigeait l unite exacte. 45 suspects contre 12. Attention,
  la majorite sont des descriptions annuelles sur des KPI trimestriels, categorie
  que Yann a deja arbitre le 28 aout au matin : chiffre exact, cadrage different,
  laisser intact.

## Etat des six detecteurs apres correction
    scan-value-div1000            0
    scan-unit-magnitude           0
    scan-scale-mismatch           2 echelles nettes (MTB, arbitrage ouvert)
    scan-stale-descriptions       12
    scan-stale-descriptions-large 45
    scan-yoy-mismatch             331 (arbitrage ouvert, inchange)

Sur les yoy : 1 715 KPI ont un yoy qui s ecarte de plus de 1,5 point du yoy
calcule sur leur propre serie, dont 102 ou la value elle-meme ne colle pas au
dernier point. Le fait que value et history concordent ne prouve pas que
l history soit juste, donc cette mesure ne leve pas l arbitrage de Yann, elle
en donne seulement la taille.

## Deploiement
Deux commits pousses sur staging, alias mettrik-niveau2 pose sur
mettrik-p4n8lrr1a. Verification en vue connectee (compte audit.claude, mot de
passe regenere) : les pages PSX et LIN rendent normalement et ne portent plus
aucune valeur d ordre de grandeur aberrant. Les treize fiches servies sont
confirmees sans aberration. 862 tickers en ligne, inchange.

## Decision : le superviseur n est PAS relance
Il restait 229 tickers a passer. Sur les dix-sept societes testees apres
correction, aucune valeur n a ete retenue : les moteurs ne proposent rien de
nouveau sur des fiches deja a jour, et tout ce qu ils proposaient sur les
fiches abimees etait faux. Trois heures de calcul pour un rendement nul, sur
une machine qui a deja crashe, ne se justifient pas sans un mot de Yann.
Relance quand il le decidera :
    python3 scripts/refresh-superviseur.py --max 3
