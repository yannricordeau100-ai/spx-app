# Journal des dossiers earnings-inbox

## 27 aout 2026 — 3 dossiers traites, 0 point ajoute

| Societe | Verdict | Motif |
|---|---|---|
| NVDA | rien a ajouter | 3 formulaires 8-K non financiers (partenariat SB Energy, dirigeant, emission obligataire) et un 10-Q du 20 mai portant sur un trimestre deja connu (Q1-FY2027) |
| MC.PA (LVMH) | rien a ajouter | aucune publication recente dans `ir/CP` ; les dossiers SEC du repertoire etaient ceux de Moelis and Company (voir defaut ci-dessous) |
| ADS.DE (adidas) | rien a ajouter | le communique du 26 aout 2026 est deja integre (KPI trimestriels a jour au Q2-2026). Une seule valeur nouvelle trouvee, la dette nette ajustee au 30 juin (5 193 M EUR), refusee car la serie est annuelle |

## Defauts corriges a cette occasion
1. **Depots SEC d une societe homonyme** (commit e0853cd6e0) : 17 societes hors US avaient des
   dossiers 10-Q/10-K/8-K remplis avec les depots d une societe americaine portant le ticker de
   base (MC vers Moelis, AI vers C3.ai, HEI vers HEICO, ALV vers Autoliv, CON vers Concentra,
   ENR vers Energizer, ACA vers Arcosa, AD vers Array Digital...). Le garde-fou du chiffre present
   litteralement ne protege pas de ce cas. `documents()` ignore desormais ces dossiers pour tout
   ticker hors US, sauf allowlist des deposants SEC legitimes (AMRZ.SW).
2. **Documents tronques a 14 000 caracteres** (meme commit) : les etats financiers d un 10-Q
   arrivent apres environ 100 000 caracteres de contexte XBRL, donc aucun chiffre n etait
   jamais atteint sur les societes americaines. Porte a 60 000.
3. **Meme document compte deux fois** (meme commit) : .pdf et .txt.gz occupaient deux des quatre
   emplacements. Deduplication par nom de document.
4. **Periode incompatible avec la frequence du KPI** (commit c7ee53538c) : un point trimestriel
   pouvait entrer dans une serie annuelle sans aucune alerte.

## A verifier au prochain passage
Les 17 societes hors US listees ci-dessus gardent des dossiers SEC pollues dans `data-lake/`.
Ils ne sont plus lus, mais ils restent sur le disque. A supprimer si l espace devient un sujet.
