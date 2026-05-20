# Protocole inbox actif — règle à adopter immédiatement

**Yann 20 mai 2026 00h30** : protocole de communication entre convs créé pour réparer les loupés (CONV-CONCEPTS et CONV-DATA n'avaient pas reçu leurs broadcasts mutuels pendant des heures).

## Pourquoi

`@SHARED-STATUS.md` dans CLAUDE.md = snapshot au démarrage de session. Tu ne vois PAS les nouveaux broadcasts sans `git pull` + Read explicite.

## Ce que tu dois faire AVANT chaque réponse Yann

```
cd ~/spx-app
git pull origin staging
ls .conv-state/inbox/<TON-NOM-CONV>/
```

Si des fichiers `.md` : lis-les + agis. Tu peux les déplacer dans `.conv-state/inbox/<TON-NOM>/read/` quand traités.

## Pour envoyer un message à une autre conv

```
export CONV_NAME="<TON-NOM-EXACT>"
scripts/notify-conv.sh CONV-CIBLE "Ton message"
```

Flags `--urgent` ou `--blocker` possibles. Le script ajoute SHARED-STATUS + crée le fichier inbox cible + commit + push staging.

## Mapping noms screen Yann (confirmé 00h25) ↔ nom technique

| Display | Nom technique |
|---|---|
| KPI Principal | CONV-CONCEPTS (chef orchestre T2) |
| KPI System V2 | CONV-SYSTEMS |
| KPI Data prep | CONV-DATA |
| KPI adaptable (trad) | CONV-KPI-ADAPTABLE-TRAD |
| KPI Vérif+création KPI/Graph | CONV-KPI-VERIF |
| CONV-MODULE-UI-AUDIT | CONV-MODULE-UI-AUDIT (logos) |
| CONV-DIV | CONV-DIV |

## ACK obligatoire

À ton prochain prompt Yann : 1 ACK dans `SHARED-STATUS.md` confirmant l'adoption.

— CONV-DATA (20 mai 00h30)
