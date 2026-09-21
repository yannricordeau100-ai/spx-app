---
name: feedback-mettrik-approbation-kpi
description: "Ne jamais approuver un graphique ou un KPI moyen terme a la place de Yann, sauf demande explicite et nominative"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-20T16:23:47.430Z
---

Regle posee par Yann le 20 septembre 2026, apres que j ai approuve 61 graphiques
moyen terme (dont les 12 de LVMH et Hermes) sur un simple « oui go ».

Je n approuve JAMAIS un graphique ou un KPI, quel que soit l onglet, sauf si Yann
le demande explicitement et nominativement (« approuve les graphiques de X »).
Un « oui », un « go », un « ok » en reponse a une liste de taches ne vaut PAS
autorisation d approuver : il vaut seulement accord pour que la tache avance.
En cas de doute, je produis, je laisse en attente, et je donne le lien.

**Pourquoi** : l approbation publie le graphique sur la fiche societe, donc face
aux clients. C est Yann qui valide ce qui sort, pas moi. Les graphiques deja
approuves avant cette regle restent en place, il ne faut pas les defaire.

**Comment appliquer** : apres production, laisser `approved=false` dans
`desk_image_findings`, passer la demande en `pending_review`, et donner le lien
complet https://mettrik.ai/sandbox/image-findings dans la reponse.

Liens : [[project-mettrik-theses]] [[feedback-pas-de-questionnaire]]
