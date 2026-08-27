# Session V195 du 27 aout 2026 (reprise autonome)

## Deux defauts majeurs trouves et corriges

### 1. Gate de visibilite desaligne
877 stes etaient online (desk_curated_companies) contre 656 dans
src/data/v1-9-5-clean-all-tickers.json, seule source de verite du rendu de
fiche. 235 stes etaient donc trouvables dans la recherche mais leur page
redirigeait silencieusement vers l overview.

Cause : publish-online.ts ecrit dans Supabase mais ne touche jamais
clean-all-tickers.json. TOUTE publication doit desormais faire les deux.

Traitement : les 235 passees au qualifieur (nouveau bypass
QUALIFY_SKIP_CLEAN_GATE=1 pour auditer une ste hors liste, et
QUALIFY_OUT_PASS / QUALIFY_OUT_FAIL pour paralleliser).
163 PASS ajoutees a clean-all, 72 FAIL traitees ensuite.

### 2. Noms de fichiers en majuscules, 404 en production
macOS ignore la casse, Linux non. 21 fiches etaient nommees IMB.L.json au
lieu de imb.l.json : introuvables sur Vercel. 13 stes en ligne renvoyaient
un 404 (WIZZ.L, LDO.MI, SGE.L, TKA.VI, BZU.MI, PHNX.L, HER.MI, DPW.DE,
P911.DE, WIE.VI, POLY.L, SRG.MI, IMB.L). Toutes renommees en minuscules.
CONTROLE A REFAIRE apres chaque ajout de fiche :
`ls src/data/v2-pipeline src/data/v2-pipeline-specific-kpis | grep -E "[A-Z]"`

## Bilan chiffre
- 163 fiches reparees par ajout a clean-all
- 34 heros refaits (extraction verbatim par agents) puis qualifies PASS
- 13 fiches sorties du 404
- 8 nouvelles stes publiees : HSBA.L, KEMIRA.HE, IMB.L, KGF.L, 7203.T
  (Toyota), INF.L, PUM.DE, RIO
- 38 fiches cassees depubliees, 7 deja republiees apres reparation

## A ARBITRER PAR YANN
31 stes restent depubliees (fiche cassee, pas encore reparable) :
AZN, EQNR, BBVA, MURGY, SIEGY, BNT, NDA-FI.HE, NDA-SE.ST, RELX, SAND.ST,
BNPQY, VWAPY, DNKEY, AMUN.PA, FORTUM.HE, EDP.LS, NBIX, UNM, BWA, SAP,
NDA-DK.CO, ADTTF, ITRK.L, BCLYF, BPAQF, BP.L, VCISY, BBVA.MC, DTEGY,
MAP.MC, MT.AS, TSCO.L, SU.
Les grandes restent accessibles par leur ticker principal : AZN.ST,
SAP.DE, REL.L, BP, BBVA.MC, EQNR.OL. Sans equivalent : NBIX, UNM, BWA, SU.

Motifs :
- 11 stes ont un hero valide mais moins de 4 KPIs specifiques (seuil du
  qualifieur). Il faudrait extraire 3 KPIs de plus par ste.
- UNM et SIEGY ont un hero correct en base (20 trimestres, _validation
  true) mais une couche posterieure le remplace au rendu (UNM bascule sur
  "Premium Income" 12 trim, SIEGY sur "ORDERS_Q" vide). Meme famille de
  defaut que kpis-haut, a diagnostiquer.
- SAP a un hero "CCB" a zero point : contamination franche (CCB est un
  segment de JPMorgan). SAP.DE n est pas affecte.
- AMUN.PA et MT.AS n ont pas de fiche du tout (REDIRECT/empty).
- TSCO.L a un hero egal au CA total.

## Candidats jamais publies
171 tickers ont des donnees KPI sans etre en ligne. Passes au qualifieur :
9 PASS seulement (dont BRK.B ecarte, doublon de BRK-B). Les 162 autres
echouent sur hero generique, hero egal au CA total, ou absence de fiche.
Le gisement restant demande de l extraction, pas de la publication.

## Outils ajoutes
- scripts/qualify-stes.ts : QUALIFY_SKIP_CLEAN_GATE, QUALIFY_OUT_PASS,
  QUALIFY_OUT_FAIL.
