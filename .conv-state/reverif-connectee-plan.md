# Re-vérification CONNECTÉE de tous les chantiers 24h — 12 juil 2026

Directive Yann : tout ce qui a été "validé" en vue anonyme doit être re-vérifié
en vue CONNECTÉE (tier max) car le rendu anon ≠ ce que Yann voit. Compte test :
audit.claude@mettrik-internal.test (session déjà posée dans le Browser pane).

## Inventaire des tâches des dernières 24h à re-vérifier en connecté

| # | Tâche | Statut vérif connectée |
|---|---|---|
| 1 | Synthèses Earning Call 503 stés (fool + 13 SEC + 32 phares en regen) | 32 phares en cours ; échantillon connecté à faire sur ~20 stés post-deploy |
| 2 | Risques : scores 1-5 variés + rationale (503) | NVR/NVDA/AAPL vus variés en connecté ; échantillon large à faire |
| 3 | Graphs KPI hero (ordre trimestres, 5 ans min, valeurs justes) | NVR vu OK connecté ; échantillon large à faire |
| 4 | KPI standard rebuild XBRL (499) | data OK ; rendu connecté à échantillonner |
| 5 | Stories ≥2 catégories (129 corrigées) | NVR 4 slides vu connecté ; échantillon à faire |
| 6 | Univers SP500 strict (recherche + home + bloc populaires) | Vérifié connecté partiellement ; re-vérifier home connectée post-deploy |
| 7 | Unités synthèses EC (4 corrigées) | NVR vérifié connecté ; FIX/KVUE/PGR à voir |
| 8 | BG publiée / DASH MAU 5 pts | Vérifié anon seulement → re-vérifier connecté |
| 9 | Bloc Super-KPI "n.d. / Calcul impossible" visible (NVR) | Problème UI vu en connecté, non traité → décision : signaler à Yann ou masquer |

## Méthode de re-vérification connectée à grande échelle
Le rendu connecté (tier max) = anon SANS floutage : le payload RSC est identique
(vérifié : le floutage est un blur CSS client, la data est la même). Les seules
différences visibles : blur retiré, gate absent, compteur free absent.
DONC : la vérification data (fingerprints loader = payload) reste valide.
Ce qui doit être vérifié en connecté = le RENDU des blocs (graphs visibles,
compteurs, textes) → échantillonnage browser connecté sur ~25 stés représentatives
+ chaque sté corrigée d'un bug spécifique.

## Échantillon browser connecté (25)
Top10 : NVDA AAPL MSFT GOOGL AMZN META TSLA V JPM BRK-B
Bugs spécifiques : NVR BG DASH FIX KVUE PGR EA DOV LITE MNST
Aléatoires secteurs : CAT WM DUK PLD COST
