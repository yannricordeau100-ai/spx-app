# 🟡 RÈGLES D'OR — à appliquer AVANT la lecture de chaque prompt Yann

> Ce fichier est auto-chargé par Claude (référencé dans `CLAUDE.md`).
> Il contient les règles non-négociables édictées par Yann le 6 mai 2026
> à 21h30 (CONV-CONCEPTS = "KPI principal"), à appliquer dans **toutes**
> les conversations Mettrik (CONCEPTS, SYSTEMS, DATA, BRAND).
>
> Yann paie pour ce travail. Si une règle n'est pas respectée, c'est une
> faute, pas un détail.

---

## 0undecies. UNE STÉ CITÉE = EXEMPLE D'UN BUG GÉNÉRAL, FIX À APPLIQUER PARTOUT (PERMANENT, Yann 2 juin 2026)

**RÈGLE D'OR ABSOLUE. À CHECKER EXPLICITEMENT À CHAQUE PROMPT.**

### Check obligatoire au début de chaque prompt

À chaque prompt Yann, dès la lecture, me poser la question :

> **Est-ce que ce prompt parle d'une modification sur une page sté (KPI, bloc, sous-bloc, hero, chart, super-KPI, signature, etc.) ?**

- **Si NON** → règle ne s'applique pas, on continue normalement.
- **Si OUI** → **par défaut, le fix doit être appliqué à TOUTES les stés de l'univers cible V1.9.5 = SP500 ∪ Top 307 V1.8 = 673 stés** (+ ajouts EU/Asia stratégiques). La liste actuelle `v1-9-5-clean-all-tickers.json` = 652 stés curatées. Si fix systémique, traiter aussi les 35 stés du 673 absentes de la liste curatée (ODFL, ROL, ROP, CB, CPAY, CASY, EXE, PPL, MRK.DE, REL.L, RI.PA, ABF.L, AMUN.PA, AV.L, BBVA.MC, BCP.LS, BVI.PA, CA.PA, CNA.L, DANSKE.CO, EIPAF, HEXA-B.ST, HLN.L, JDEP.AS, KESKOB.HE, etc.).

### Pourquoi

Yann cite UNE sté parce qu'il l'a sous les yeux. C'est un révélateur d'un bug systémique. Les clients voient les autres pages : les mêmes bugs y sont presque toujours présents. Une demande sur 1 sté = un fix systémique sur 652.

### Exception unique

Si Yann précise explicitement "uniquement sur cette sté", "juste pour X", "seulement Y", alors restreindre. **Pas d'exception implicite.** Si pas de précision = appliquer partout.

### Conséquence pratique

1. Audit programmatique systématique pour détecter les autres stés touchées.
2. Sub-agents en parallèle si volume > 50 stés à corriger (jusqu'à 24 agents par règle §11).
3. Rapport bilan : combien de stés touchées + corrigées, pas juste celle citée.
4. Si pas de bug équivalent sur les autres stés, le confirmer explicitement (audit fait, 0 autre sté affectée).

### Auto-check

Mots-clés déclencheurs dans un prompt Yann qui activent la règle :
"hero", "bloc", "sous-bloc", "graph", "chart", "KPI", "super KPI", "signature", "logo", "axe Y", "PNG", "hiérarchie", "fix", "corrige", "change" couplés à un ticker (GOOGL, CAT, NVDA, AAPL, etc.) ou à "page sté".

---

## 0quater. PRIORISATION SI >2 TÂCHES (PERMANENT)

Édictée par Yann le 27 mai 2026. **PERMANENT, jamais limité dans le temps.**

Si plus de 2 tâches sont en cours simultanément (sub-agents, scripts
background, deploys, runs Cerebras), je dois **TOUJOURS** demander à
Yann laquelle est prioritaire avant d'en lancer une nouvelle. Pas
d'enchaînement automatique sans validation.

Exemple : Yann dit "go" sur un deploy + j'ai déjà 2 sub-agents Opus
qui tournent → je demande "tu veux que je laisse les 2 finir d'abord
ou je lance quand même ?" avant d'ajouter une 3e tâche.

But : limiter saturation RAM Mac + éviter de me disperser sur 5 fronts
en parallèle qui finissent tous à moitié.

---

## 0sexies. SOLIDIFICATION PAR SUB-AGENTS AVANT DE CONFIRMER "OK" (PERMANENT)

Édictée par Yann le 27 mai 2026 (rappel d'une règle déjà demandée 26 mai
mais pas inscrite formellement). Le problème clef du décalage entre ce
que je rapporte et ce que Yann voit est aussi dû au fait que MES AUDITS
NE SONT QUE MES AUDITS — si mon grep regex rate (échappement Next.js,
faux positif, marker manqué), je rapporte un mensonge basé sur un seul
point de vue (le mien) avec une méthode imparfaite.

**Solution permanente** : avant de confirmer "OK" sur une réparation
critique, je DOIS dispatcher **N sub-agents Claude MAX en parallèle**
qui vérifient INDÉPENDAMMENT le rendu réel sur niveau2 :

1. **N ≥ 2 agents minimum** (3-5 pour fixes critiques), chacun
   inspecte une partie différente (blocs UI, fraîcheur data,
   cohérence i18n, cross-pollution sources, etc.).
2. Chaque agent retourne un rapport HONNÊTE (OK/problèmes/doutes).
3. Si TOUS convergent sur "OK" → je peux dire OK à Yann.
4. Si UN agent détecte un problème → je l'annonce, je le répare,
   et je relance la solidification.
5. **JAMAIS confirmer "OK" sans cette convergence multi-agents** pour
   les bugs structurels signalés explicitement par Yann.

Coût : 0 (forfait Max 20× via Task tool sub-agents). Justifie
"autant d'agents que nécessaire".

Cas d'usage : verif fix UI (chart, KPI table, badge), verif data
freshness (re-extraction risks/KPIs/translations), verif chaîne
deploy → alias niveau2 → rendu utilisateur final.

Cas hors scope : tâches purement administratives sans impact visuel
(ex création tâche, lecture règles).

---

## 0quinquies. AUDIT VISUEL COMPLET AVANT DE DIRE "OK" (PERMANENT)

Édictée par Yann le 27 mai 2026 après bug récurrent : je dis "OK" sur
un sous-bloc (ex risks) alors qu'un autre bloc visible (ex tableau
Indicateurs clés) est cassé/vide. **Décalage entre ce que je rapporte
et ce que Yann voit réellement = MENSONGE structurel à éliminer**.

Avant de dire qu'une page sté est "OK / live / vérifiée", je DOIS curl
la page sur niveau2 (avec audit_token) et vérifier la PRÉSENCE et le
COMPTAGE de chaque bloc principal :

1. **Hero KPI** : nom visible + value + chart
2. **Indicateurs clés (tableau KPI)** : **MINIMUM 5 KPIs rendus**
   (compter via marker rendu DOM : font-mono shorts, badges type, etc.)
3. **Stories KPIs** : si présent dans data, vérifier rendu carrousel
4. **Facteurs de risque** : MIN 3 risks rendus avec badge category
5. **Gouvernance & rémunération** : CEO + comp + top 3 (si applicable)
6. **AI positioning** : stance + 2+ evidence items
7. **Répartition CA** : segments + geography (si data dispo)
8. **Events timeline** : 3+ events (si data dispo)

**Pas d'audit partiel.** Si je vérifie risks et que tout est OK, je NE
peux PAS dire "page sté OK" — seulement "risks OK". Pour dire "page
OK" il faut TOUS les blocs ci-dessus vérifiés.

Si un bloc est vide quand il devrait être plein → flag explicite à
Yann avant de prétendre que c'est bon.

---

## 0bis. ZÉRO API ANTHROPIC PAYANT (PERMANENT) — RÈGLE D'OR ABSOLUE

Édictée par Yann le 26 mai 2026 18h45. Facturation Claude Console
**ARRÊTÉE**. Toute requête vers `api.anthropic.com` est INTERDITE
(Haiku / Sonnet / Opus via clé `ANTHROPIC_API_KEY`).

**Autorisé** :
- **Sub-agents Task tool dans cette conv** (= Claude Opus 4.7 forfait
  Max 20× gratuit, illimité). C'est le seul accès Claude autorisé.
- **Cerebras free tier** (3 clés rotation, quota TPD 24h reset).
- **Groq Llama 3.3 70B free** (100k tokens/jour).
- yfinance, SEC EDGAR, WebFetch (gratuits).
- Scripts Python locaux qui ne tapent QUE les API gratuites ci-dessus.

**Interdit** :
- `USE_ANTHROPIC=1` dans les scripts → désactivé.
- Pas de fallback Haiku/Sonnet/Opus payant même si Cerebras saturé.
- Si saturation Cerebras + Groq : ATTENDRE le reset OU lancer plus de
  sub-agents Task tool (forfait Max).

**Si je détecte qu'un script appelle `api.anthropic.com`** : je le
modifie pour skip cette branche. Si un sub-agent que je dispatch a
besoin de LLM en backend, il doit utiliser Cerebras/Groq, jamais
sa propre clé Anthropic.

---

## 0. DERNIÈRE VERSION UNIQUEMENT (RÈGLE D'OR PERMANENTE)

Édictée par Yann le 26 mai 2026 (remplace l'ancienne règle V1.8/V1.7
du 12 mai 2026, devenue obsolète).

**Règle ABSOLUE et NON-temporaire** : tout travail (code, data,
extraction, traduction, UI, fix, feature) se fait UNIQUEMENT sur la
**dernière version** de l'app. Aujourd'hui = **V1.9.5**. Demain V2.0,
V2.1, etc. Source de vérité unique : `LATEST_VERSION_SLUG` dans
`src/lib/version-routing.ts`.

**Conséquences** :
- Aucun nouveau chantier V1.7, V1.8, V1.9 (non-5). Ces routes restent
  accessibles mais en mode "snapshot figé" : pas de fix UI, pas
  d'enrichment data, pas de nouvelles features dessus.
- Tous les scripts, jobs, crons, sub-agents doivent cibler V1.9.5.
- Les fichiers nommés `v17` / `v18` / `v19` dans `scripts/` ou
  `src/data/` sont legacy : leur path peut rester (pour ne pas casser
  les crons existants) mais leur CONTENU itère sur l'univers
  V1.9.5 (= 660 stés clean_all du dernier audit).
- Côté UI : la recherche, les liens internes, les redirections
  pointent vers V1.9.5. Les anciennes routes redirigent vers leur
  équivalent V1.9.5 quand possible.
- Quand Yann demande "fix sur les stés" / "modif sur les pages sté"
  sans préciser la version → V1.9.5 par défaut. Toujours.

**Exception explicite** : Yann mentionne nominativement une version
ancienne ("juste sur V1.7", "snapshot V1.8") → suivre. Sinon,
toujours V1.9.5.

**Quand passage V2.0** : un seul fichier à modifier
(`src/lib/version-routing.ts:LATEST_VERSION_SLUG`) + créer le dossier
`src/app/sandbox/v2-0/` qui réutilise les composants partagés. Les
scripts continuent de fonctionner sur le nouveau univers car ils
lisent l'audit publié le plus récent, pas un version-slug hardcodé.

**Pourquoi** : Yann ne veut PAS de discordances UI/data entre versions,
ni d'oubli de fix sur la version qu'il regarde. Une version active
unique = zéro friction.

---

## 0octies. VÉRIFIER SES AFFIRMATIONS SUR SOURCES FIABLES (PERMANENT)

Édictée par Yann le 29 mai 2026. Avant d'affirmer une donnée numérique (capi, revenue, KPI, fait financier) à Yann, je DOIS la vérifier sur une source fiable externe (yfinance, SEC EDGAR, site IR officiel).

CAS HISTORIQUE : j'ai affirmé "MU Micron capi ~120 Mds$" alors que la vraie capi est ~1041 Mds$ (vérifiée yfinance après Yann m'a contredit). Affirmation fausse = perte de confiance grave.

Procédure : pour TOUTE donnée numérique affirmée à Yann (capi, revenue, prix action, P/E, %YoY, etc.) je vérifie en 1 commande :
- yfinance : python3 -c "import yfinance; print(yfinance.Ticker('TICKER').info.get('marketCap'))"
- SEC EDGAR : curl https://data.sec.gov/submissions/CIK<padded>.json
- Brand IR page si nécessaire

Si pas de vérif possible : dire "à vérifier" ou "estimation" au lieu d'affirmer.

Faute = mensonge silencieux. Yann se base sur mes chiffres pour décider.

---

## 0nonies. SUB-AGENTS Max20× OFF DEFAULT POUR DATA WRITES (Yann 29 mai 2026 Phase 3B)

Édictée par Yann le 29 mai 2026 (Phase 3B). **PERMANENT.**

Sub-agents Task tool autorisés UNIQUEMENT pour read-only / audit / extraction draft.
Toute écriture vers les fichiers data canoniques DOIT être validée par Yann avant push :
- `src/data/v2-pipeline/<t>.json`
- `src/data/v2-pipeline-enrich/<t>.<sub>.json`
- `src/data/companies/<t>.json`

Multi-agents Max20× parallèles INTERDITS sur data writes en autonomie.

**Exception** : audits / inspections / scripts de build idempotents
(ex `build-companies-unified.ts`) OK car re-générables sans risque de
corruption silencieuse des données canoniques.

**Pourquoi** : Phase 3B impose que toute donnée publiée passe par validation
visuelle Yann (workflow Top 10 stés témoin freeze, cf §0decies). Les
sub-agents parallèles ont historiquement produit des inventions, des
hallucinations, et des cross-pollutions ticker→source.

---

## 0decies. TOP 10 STÉS TÉMOIN FREEZE (Yann 29 mai 2026 Phase 3B)

Édictée par Yann le 29 mai 2026 (Phase 3B). **PERMANENT.**

10 stés témoin canoniques : **NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, V, JPM, BRK-B**.

Workflow freeze détaillé dans `docs/TOP10-TEMOIN-FREEZE.md`. Résumé :
1. Yann valide visuellement la sté témoin (page sté complète)
2. Promote snapshot `tests/golden/snapshots-proposed/<t>.proposed.json` →
   `tests/golden/snapshots/<t>.golden.json`
3. Toute régression future détectée par `npm run test:golden` bloque le merge
4. Après validation 10/10, scale-up vers SP500 puis Stoxx 600 par batch validés
5. Si une sté ne valide pas, fix data prioritaire avant scale

But : garantir zéro régression silencieuse sur les 10 stés les plus visibles
de la démo investisseurs.

---

## 1. LIRE ET FAIRE l'INTÉGRALITÉ du prompt

Chaque prompt Yann se traite dans son ENTIÈRETÉ. Si le prompt contient
3 demandes, je dois en faire 3. Pas 2, pas 1. Avant d'envoyer la
réponse je vérifie que **chaque** demande explicite a été couverte
(action faite OU réponse précise donnée).

Méthode : à la lecture du prompt, lister mentalement chaque demande
distincte (séparées par phrase, par "et", par "puis", par retour à la
ligne, par "+"). Cocher au moment de répondre.

Exemple à NE PAS faire (preuve d'échec passé) : Yann demande
"ajouter en petit la date et l'heure de chaque tâche du to-do dans le
desk" → réponse part sans le faire = faute.

---

## 2. MAJUSCULES = priorité absolue

Quand Yann écrit en MAJUSCULE, c'est un signal **plus fort** que
"important". Le reste du prompt est déjà important par défaut, donc les
majuscules signifient "même par rapport à mes autres demandes, ça c'est
ce qui doit absolument passer en premier / sans erreur".

Yann n'écrit pas ce qu'il fait lui-même. **Tout ce qu'il écrit est une
demande à exécuter.** Pas de "demande de courtoisie", pas de formalité.

---

## 3. Convention multi-conv abrogée

Convention multi-conv (CONCEPTS / SYSTEMS / DATA / BRAND / DIV / DEPAN)
abrogée par Yann le 29 mai 2026 (Phase 3B). Une seule conversation Mettrik.
`SHARED-STATUS.md` reste en lecture seule comme archive historique :
plus aucune écriture, plus aucun broadcast inter-conv.

### Acronymes / raccourcis de Yann à connaître

| Raccourci | Signifie |
|---|---|
| **PV** | Plus-value (jamais "value-add" ni anglicisme) |
| **stés** | Sociétés |
| **DOB** | Droit au but / Direct, Objectif, Bref |
| **dob** | Variante minuscule, même sens |
| **conv** | Conversation |
| **V1 / V1.7 / V2 / V3** | Versions de l'app (V1 = 5 stés démo, V1.7 = SP1500 sandbox, V2 = scale-up, V3 = release publique) |
| **wow / whaou** | KPI distinctif, propre à la sté ou sub-industry |
| **stés top X** | Les X premières sociétés en capi |

Toutes les autres convs connaissent ces raccourcis. Pas de demande de
clarification dessus.

---

## 4. Nouveaux prompts pendant exécution = à mettre EN FILE, PAS en bloqueur

Si Yann envoie un prompt B pendant que je traite le prompt A :
- Je termine d'abord A (sans interruption ni court-circuit)
- Puis j'enchaîne sur B sans attendre re-validation
- Si B contient une question, je n'attends PAS la réponse à ma question
  pour traiter B. Je fais B en parallèle ou juste après.

Concrètement : Yann ne doit jamais avoir à répondre 2 fois à la même
demande pour qu'elle soit faite.

---

## 5quater. ETA SYSTÉMATIQUE — RÈGLE ABSOLUE

Ajoutée par Yann le 8 mai 2026.

À chaque fois que je parle d'une tâche à effectuer (immédiatement, plus
tard, en autonomie, au prochain wakeup, etc.), je dois afficher l'ETA
en clair. Une fourchette est acceptée mais doit être aussi courte que
possible.

Format : "ETA : N min", ou "ETA : N-M min", ou "ETA : N-M h".

S'applique à : prompt direct Yann, log SHARED-STATUS, ScheduleWakeup,
todos internes, broadcasts entre convs.

Pas de "bientôt", "dans pas longtemps", "rapidement" tout seul. Toujours
un chiffre.

---

## 5quinquies. DÉPASSEMENT D'ETA → EXPLICATION AUTOMATIQUE

Ajoutée par Yann le 8 mai 2026.

Pour CHAQUE tâche dont l'exécution dépasse de **5 minutes ou plus** l'ETA
annoncé au début, j'écris automatiquement (sans qu'il faille me demander)
dans la conversation pourquoi c'est plus long. Pas de "ça prend plus de
temps que prévu" tout seul : toujours la cause concrète (rate limit,
attente d'un autre proc, fichier introuvable, retry qui boucle, etc.).

Format : "⏱ Dépassement ETA : prévu N min, en réalité M min. Cause : <X>."

Pas une excuse — un signal automatique pour que Yann garde la confiance
dans mes ETA.

---

## 5ter. TENIR MES PROMESSES — RÈGLE ABSOLUE

Ajoutée par Yann le 7 mai 2026 après faute documentée : j'ai promis
"je te donne les vrais chiffres dans ~30 min", 56 min plus tard rien.

Quand je donne un ETA / un délai à Yann, je dois :

1. **Mettre un timer mental** (= scheduler ou todo) pour ne pas oublier
2. **Au délai promis**, soit je livre, soit j'envoie un message court
   expliquant pourquoi c'est en retard + nouveau ETA précis (pas vague)
3. **Si pas livré dans 1.5× le délai promis**, je signale spontanément
   AVANT que Yann demande
4. **Pas de promesses floues** ("bientôt", "dans pas longtemps") : toujours
   un nombre concret (minutes/heures) ou pas de promesse du tout
5. **Si une promesse est rendue obsolète** (Yann change de sujet, autre
   prio bouscule), je le signale explicitement plutôt que de l'oublier

Règle stricte : Yann ne doit JAMAIS avoir à me rappeler une promesse
que je lui ai faite.

---

## 5sexies. AUTO-REBASCULE SUB-AGENT — STRICTE (Yann 21 mai 2026, renforcée)

⚠️ RÈGLE DURCIE après dérive observée : Yann m'a alerté que je disais
"auto-rebascule" mais en pratique je laissais le tour de table mou.

**MAINTENANT, ZERO TOLERANCE** :

1. **EN PERMANENCE 4+ sub-agents actifs minimum** tant que le backlog
   est non-vide. Pas 1, pas 2 : QUATRE minimum.
2. À chaque notification `status=completed`, **dans la même réponse**,
   je lance un (ou plusieurs) NOUVEAU sub-agent. Pas dans 2 messages :
   IMMÉDIATEMENT.
3. **JAMAIS** dire "veille" / "passive" / "j'attends notifications" :
   ces mots = aveu d'auto-rebascule cassé.
4. Le backlog 12h+ pour moi ET CONV-DATA est tenu à jour à chaque
   prompt user. Yann doit voir une liste qui se remplit, pas qui se vide.
5. Si toutes les tâches connues sont prises, je crée de nouvelles
   tâches utiles (audits, fixes proactifs, polish) avant de dire "fini".

**Procédure obligatoire** :
1. Quand notification `task-notification status=completed` arrive
2. Vérifier la todo list / backlog par priorité (P0 > P1 > P2)
3. Lancer un NOUVEAU sub-agent Task tool sur la P0 la plus haute pas
   encore prise (ou continuer la même tâche en plus de profondeur)
4. Ne JAMAIS attendre prompt user pour rebasculer

Idem pour CONV-DATA : son orchestrateur (CONV-CONCEPTS leader T2) doit
auto-dispatch la mission suivante dès qu'une mission précédente est
ackée terminée. Pas de silence.

---

## 6. RAM Mac : utiliser le MAXIMUM d'agents possibles (Yann 21 mai 2026)

Yann a explicitement remplacé la règle conservative par une règle
d'**utilisation maximale** : déployer si besoin ou si demandé tous les
agents IA possibles, en laissant juste la RAM nécessaire pour ne pas
faire apparaître la fenêtre macOS de fermeture forcée d'applications.

**Procédure obligatoire** :
1. Quand 4+ agents IA sont déployés en parallèle → **vérifier `vm_stat`
   toutes les 30 secondes** automatiquement
2. Si RAM free approche du seuil critique (< 100 MB free + compressor
   actif) → baisser la conso (kill 1 agent OU augmenter sleep entre
   calls OU pause temporaire d'un agent non critique)
3. Veille constante sur la RAM = utiliser le MAXIMUM d'agents pour les
   tâches nécessaires ou qui peuvent accélérer le travail directement
   ou indirectement (sub-agents Claude forfait Max gratuit prioritaires)
4. **PAS de cap arbitraire** (l'ancien "max 4 procs" ou "max 80% RAM" est
   ABROGÉ). Le cap est dynamique = jusqu'au seuil critique macOS.
5. Le seuil critique = juste avant que la fenêtre macOS "Quitter cette
   application pour libérer de la mémoire" apparaisse. En pratique :
   RAM free < 50 MB + compressor saturé + swap > 4 GB.

**Esprit** : Yann a payé 16 GB RAM + Mac upgradé. Pas de stand-by "par
précaution" sans raison. Mieux vaut throttle dynamique que sous-utiliser.

---

## 8bis. JAMAIS RIEN FAIRE — contournement systématique en 30 sec max

Ajoutée par Yann le 8 mai 2026.

Si je suis bloqué (autorisation, prompt, outil indispo, réseau, rate
limit, etc.) plus de **30 secondes**, je contourne :

1. Trouver une autre méthode pour la même tâche (autre outil, autre
   API, méthode dégradée)
2. Si vraiment impossible → passer à une **autre** tâche utile parmi
   tout ce qui reste à faire
3. Jamais rester à rien faire en attendant une validation

**Sources de tâches à faire en autonomie** :
- Conv partagée `SHARED-STATUS.md` : voir les pings `🤝 @CONV-X` et la
  section `## 🔄 EN COURS`
- Tableau back-office `/sandbox/data-status` : voir tous les blocs
  manquants par sté, par catégorie cat 1 / 2 / 3
- Codes cellule (B1S, B5D, etc.) : chaque cellule = un travail concret
- Liste "fond du tiroir" propre à moi : doublons fusion, warning IPO,
  bug tracker desk, email marketing onboarding

Yann ne doit JAMAIS retrouver 1 h plus tard une situation où "j'attendais
une autorisation" alors que des dizaines d'autres tâches productives
étaient visibles dans le SHARED-STATUS ou le data-status. C'est un
manquement professionnel grave.

---

## 8. Jamais bloqué par une demande d'autorisation > 30 secondes

Si malgré la règle 7 un prompt d'autorisation apparaît :
- Pendant que je l'attends : préparer la tâche que je ferais SI
  l'autorisation n'arrive pas
- Au bout de **30 secondes sans clic Yann**, je passe à une autre tâche
  (la tâche préparée ou autre chose dans la liste)
- Quand l'autorisation arrive enfin :
  - Si c'était urgent / bloquant beaucoup d'autres choses → je l'exécute
    immédiatement
  - Sinon → je l'exécute "un peu plus tard" en mode logique humaine
    (pas en panique, pas en interrompant ce que je fais)

---

## 9. Toujours avoir une tâche préparée — JAMAIS rien faire

Quand j'ai terminé un prompt OU que j'attends quoi que ce soit, je dois
avoir une tâche en cours / préparée. Choix dans cet ordre :

1. Vérifier si quelque chose dans `SHARED-STATUS.md` log m'attend (ack,
   ping `🤝 @CONV-CONCEPTS`)
2. Lire les listes "to-do" / "notes" du desk (si accessibles) : si je
   comprends une tâche **urgente / V2 / V3** → la développer en local
3. Préparer une mini-feature "next step" sur un point chaud déjà discuté
4. Demander régulièrement à Yann des "grosses tâches" pour le futur,
   tant que la V3.0 n'est pas en ligne il y a toujours du boulot

**Règle stricte** : tout ce que je développe seul (sans validation
explicite Yann) ne va **JAMAIS** en prod ni même en branche staging
publique avant validation Yann. Je peux :
- Coder en branche locale / preview privée
- Montrer à Yann avec une explication courte et concise quand il a du
  temps
- Si pas sûr d'une décision, faire **autre chose** dont je suis sûr,
  jamais inventer

---

## Application

Cette règle est édictée le **6 mai 2026 ~21h30** par Yann pour
CONV-CONCEPTS, à étendre par broadcast dans `SHARED-STATUS.md` aux
3 autres convs (SYSTEMS, DATA, BRAND).

Mise à jour de ces règles : uniquement par Yann, jamais en autonomie.

---

## 14. Communication inter-conv abrogée

Convention multi-conv abrogée par Yann le 29 mai 2026 (Phase 3B). Une seule
conversation Mettrik. Plus de protocole inbox, plus de `notify-conv.sh`,
plus de broadcast inter-conv.

## 11. Ack broadcasts inter-conv abrogé

Convention multi-conv abrogée par Yann le 29 mai 2026 (Phase 3B). Plus
d'ack obligatoire des broadcasts inter-conv.

