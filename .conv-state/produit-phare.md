# Chantier « produit phare » (Yann, 9 sept 2026)

Objectif : un KPI hero « produit phare » (série annuelle 2016-2025) pour les 234 stés Industrie (20), Conso discrétionnaire (25), Conso de base (30) de l univers 666.
Dossier de travail : scratchpad phare (univers.json, p1-lotNN.json → p1-outNN.json (Opus), v1-outNN.json (Sonnet vérificateur), p2-in/<T>.json → p2-out/<T>.json (Opus, données), _valide.py).
Phases : P1 identification (24 lots de 10) → V1 vérification Sonnet → arbitrage (accord = validé ; désaccord/hésitation = page toggle) → P2 données 10 ans pour chaque candidat → validation → pose kpis-haut + hero (Supabase desk_hero_kpi_overrides) → page /sandbox/produit-phare (exceptions seulement : A / B / pas de KPI).
Etat : P1 lots 01-08 lancés le 9 sept ~15h.

## Quota 429 le 9 sept ~17h : relances 19h25 (P1 11,13,14,15 ; V1 12 ; P2 AALB.AS ABBN.SW ABNB AC.PA). Reste a relancer : P1 16,17,18-24 ; P2 tout le reste (scratchpad phare/p2-in moins p2-lances.txt).
## TAM (Yann 9 sept 19h20) : 253 stes avec 2 candidats coches -> arbitrage Sonnet (scratchpad tam/lotNN.json -> outNN.json), decides = 1 seul id dans Supabase desk_page_content tam/arbitrages ; indecis = laisses a 2 ; raisonnement ecrit dans docs/cahier/tam/<T>.json (arbitrage_ia).

## Etat 09/09 19:37 : P1 lots 01-15 faits (16,17,18 en cours ; 19-24 a lancer), V1 01-15 faits, P2 valides : 32 (echecs : AD.AS ; a allonger : ALLE, BBY, BG). Page /sandbox/produit-phare + API + lib src/lib/produit-phare.ts ecrits (registre src/data/produit-phare.json, rempli par pose.py --apply --hero). TAM termine (253/253).
