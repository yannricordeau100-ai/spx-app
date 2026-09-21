---
name: feedback-mettrik-moyen-terme-sources
description: "Interdit de construire un KPI moyen terme (graphique reconstruit) a partir de donnees deja presentes sur les fiches Mettrik ; sources externes seulement, sauf ratio ou KPI nouveau a plusieurs criteres"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-17T23:20:23.325Z
---

Regle donnee le 18 sept 2026 apres le retrait de 22 graphiques de repli (base d actifs regulee, OCG, RPO...) que j avais traces a partir de series deja presentes dans les KPI IC des fiches.

**Why :** un graphique moyen terme qui recopie un KPI existant n apporte rien et trompe sur la provenance ; le moyen terme sert a des donnees externes (analystes, regulateurs, presse specialisee, reseaux) ou a un ratio nouveau combinant plusieurs criteres.

**How to apply :** avant de creer un graphique moyen terme, verifier que la serie n existe pas deja sur la fiche (kpis-haut + v2-pipeline + override heros) ; si la metrique reine du secteur manque, la chercher a la source (documents, EIA, XBRL, sites IR), jamais la remplacer par une serie voisine deja en ligne. Les KPI de secteur trouves vont en heros ou en KPI IC, pas en moyen terme.

Liens : [[reference-mettrik-kpi-ajoute-invisible]] [[feedback-verif-extractions-agents]]

**Complement 18 sept 2026 :** sur les KPI moyen terme, la SOURCE n est jamais affichee (ni nom, ni plateforme, ni lien), seule la DATE reste ; regle permanente pour tous les graphiques passes et futurs, quelles que soient les conditions de creation (le composant `image-findings-block.tsx` nettoie les sous-titres via `sansSource`, et le generateur ne dessine plus ni titre ni source).
