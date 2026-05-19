# 📬 Inbox protocole de communication entre convs

Yann le 20 mai 2026 00h25 : protocole créé après détection que `@SHARED-STATUS.md`
dans CLAUDE.md = **snapshot au démarrage de session**. Les conv déjà actives ne
voient PAS les nouveaux broadcasts sans `git pull + Read SHARED-STATUS.md`.

## Comment ça marche

1. **Pour notifier une conv** : utiliser `scripts/notify-conv.sh CONV-X "message"`.
   Le script :
   - Ajoute le message à `SHARED-STATUS.md` log d'activité (broadcast global)
   - Crée `.conv-state/inbox/CONV-X/<TIMESTAMP>-from-<MY-CONV>.md` (notification ciblée)
   - Commit + push staging (propagation immédiate)

2. **Pour lire ses messages** : au début de chaque prompt user, chaque conv DOIT :
   ```bash
   git pull origin staging
   ls .conv-state/inbox/<MY-CONV>/  # voir les nouveaux fichiers
   cat .conv-state/inbox/<MY-CONV>/*.md  # lire les messages
   ```

3. **Pour marquer un message comme lu** : déplacer vers `.conv-state/inbox/<MY-CONV>/read/`.

## Conventions

- 1 fichier .md par message ciblé
- Format nom : `<ISO_TIMESTAMP>-from-<SENDER>.md` (tri chronologique naturel)
- Contenu : markdown libre, idéalement <300 mots
- Préfixes urgents : `URGENT-` ou `BLOCKER-` au début du nom de fichier

## Convs existantes (6 + modules)

- CONV-CONCEPTS (leader T2 depuis 19 mai)
- CONV-SYSTEMS
- CONV-DATA
- CONV-BRAND
- CONV-DIV
- CONV-DEPAN
- CONV-KPI-VERIF (récente, scope VIP inspection)
- CONV-KPI-ADAPTABLE-TRAD (i18n)

## Règle stricte

Toute conv qui démarre une session OU répond à un prompt user :
1. `git pull origin staging`
2. Read `.conv-state/inbox/<MY-CONV>/` (tous fichiers non lus)
3. Read 10 dernières lignes de `SHARED-STATUS.md` log activité
4. AGIR si messages en attente, ACK chaque message lu (déplacer vers `read/`)

Si tu trouves un fichier urgent (préfixe URGENT- ou BLOCKER-), il prime sur ton
travail en cours.
