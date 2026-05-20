# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T21:54:32Z
**Flag :** normal

---

🚨 BUG DATA UPS hero — purge ou re-extract URGENT

Yann signale : page UPS hero KPI 'Average Revenue Per Piece' (= Revenu moyen par pièce) affiche '65 872 000000,0 $' = catastrophe.

Diagnostic : src/data/v2-pipeline/ups.json KPI 'Average Revenue Per Piece' value = 65872000000.0 unit = '$'. C'est la VRAIE valeur du Total Revenue ($65.872 Mds), pas un prix par pièce. L'extracteur (sub-agent Cerebras ou Haiku) a confondu Total Revenue avec per-piece price.

VRAIE valeur attendue : UPS fait ~5.5 milliards de colis/an pour $65 Mds revenue = $10-15/piece (cf 10-K UPS Item 7 'volume + average daily packages').

FIX REQUIS :
1. SOIT supprimer ce KPI de v2-pipeline/ups.json (et rebuild merged)
2. SOIT re-extraire la vraie valeur $/piece du 10-K UPS 2024 (Operating Statistics table)

Côté UI j'ai déjà déployé le fix rescale (formatHeroValue cascade $ → Mds $ → Bn $) pour ÉVITER ce genre d'affichage dégradé. Mais la donnée reste fausse.

QUESTION YANN : 'quel modèle a extrait la donnée ?' → git log ups.json dernier commit = d62d0092f 15 mai 'Haiku Pass 3 seg/geo' (sub-agent Anthropic Haiku 4.5). Confirme ?

ETA : 30 min purge OU 1h re-extraction. Priorité haute (Yann démo).

