# Comparer (11 sept 2026)

Etat : remis en ligne sur niveau2 (v2026.09.11.3), branche sur les 666 fiches servies.
- Index : src/data/compare-index.json (scripts/build-compare-index.ts par tranches + build-compare-index-merge.ts). A regenerer apres changement de KPI.
- Cle : libelle anglais normalise (synonymes dans src/lib/compare-keys.ts) + famille d unite. Seules les cles partagees par >= 2 stes.
- Route : /api/compare (abonnes Premium/Max ou audit_token). Alignement par periode, trimestres additionnes si montants et periodicites differentes, echelle ramenee a l unite de A, devises differentes = dynamiques seules, garde-fou ecart > 1000.
- Couverture : 17 981 / 39 909 KPI servis (45 %), 1 620 cles.
- Defauts de donnees confirmes (unite mal annotee) : 5 KPI, 3 stes (QCOM R&D, CL net_income + operating_income, LMT CA total + Resultat net), facteur 1 000 000. Les autres alertes du premier controle venaient de l analyseur d unites (corrige). Page : /sandbox/unites-source (archivee), donnees src/data/unites-a-corriger.json, decisions desk_page_content unites_source/decisions, prompt de reprise en haut de page (dimanche 13 sept 11:00).
- Etape suivante possible (non lancee, cout ~2 M jetons) : annotation IA des ~16 000 libelles distincts vers un catalogue canonique, verification Sonnet.

# Mise a jour 14 sept 2026
- Catalogue canonique : src/data/compare-catalogue.json (29 848 libelles, 20 879 regroupes par Opus, groupes verifies par Sonnet, 2 000 remis a part), branche dans compare-keys.ts (libelleCanonique).
- Index regenere : 671 stes, 40 063 KPI, 20 203 comparables (50 %), 1 737 cles (contre 17 981 / 45 % / 1 620). Reconstruction : scripts/build-compare-index.ts par tranches de 100 vers /tmp/compare-tranches/part-*.json puis build-compare-index-merge.ts (les fichiers de tranche DOIVENT commencer par part-).
- Detecteur d unites : scripts/detecteur-unites.py -> .conv-state/unites-detecteur.json (ecarts d echelle entre societes d une meme cle, ruptures x500 dans une serie, unite incoherente). A verifier contre le 10-K par agent (points 3 et 4).
