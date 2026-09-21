---
name: reference_mettrik_apply_hero_fix
description: "Pieges de scripts/apply-hero-fix.py et du qualifieur Mettrik (alias canoniques, format history, ordre d'application)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9244fc08-556d-467b-a9d2-f779f5e64d4f
  modified: 2026-07-31T14:23:27.508Z
---

Quatre pieges rencontres en boucle sur `~/spx-app` lors des vagues de publication N2.

**Alias canoniques.** `src/lib/company-core/load-company.ts` contient une table `ALIASES` : un fix applique sur le ticker alias ne sert a rien, le qualifieur charge le canonical. Cas vus : `MAERSK-B.CO` -> `AMKBY`, `HSBA.L` -> `HSBC`, `9988.HK` -> `BABA`, `BTI` -> `BTAFF`, `BNP.PA` -> `BNPQY`, `BBVXF` -> `BBVA`. Verifier cette table AVANT de lancer un agent d'extraction, sinon le travail est perdu. Consequence : une liste de candidats non-online contient des alias de stes deja publiees.

**Format history.** `apply-hero-fix.py` n'accepte que des tableaux de NOMBRES BRUTS. Un `history` en `[{"period_end":...,"value":...}]` est rejete avec le message trompeur `history 12<5`. Le dire explicitement dans le prompt de l'agent.

**Ordre d'application.** Le script pose `base.hero_kpi = hero["short"]` a chaque fichier, donc le DERNIER applique devient le hero. Pour ajouter des KPIs specifiques puis fixer le hero : passer les KPIs d'abord, le vrai hero en dernier. Le script accepte aussi un champ `extra` pour les KPIs additionnels, plus propre qu'un fichier par KPI.

**Sondage anti-hallucination.** Un agent qui ARRONDIT ses valeurs (292.8 pour "292,836" en milliers, 10.404 pour "10,403.5") echoue au sondage grep alors que la serie est bonne. Avant de rejeter, demander a l'agent le chemin exact du fichier et la chaine litterale telle qu'elle apparait. Voir [[feedback_verif_extractions_agents]].

Blocage recurrent de la tail : ce n'est plus le hero mais le compte de KPIs specifiques (4 minimum, le hero compte dedans). Voir [[project_mettrik_extraction_state]] et [[project_mettrik_v195_blocked_tail]].
