# Procédure ATT : anti-thèses d'investissement (651 stés)

> Document de travail opérationnel. Écrit le 15 août 2026 après la production
> et la vérification des 202 premières ATT. Tout ce qui suit vient de cas réels
> rencontrés sur ces 202. À lire EN ENTIER avant d'écrire la première ligne.
>
> État d'avancement : `.conv-state/att-state.json`
> Spec de référence : `.conv-state/att-spec.md`
> Composant d'affichage : `src/components/anti-these-card.tsx`

---

## 1. Ce qu'on produit et pourquoi

Chaque page société de Mettrik affiche une thèse implicitement positive : des
KPI qui montent, des graphes, une interprétation. L'**anti-thèse** est le bloc
qui donne l'autre côté du dossier : les raisons objectives de ne pas investir
ou d'être méfiant, à la date de rédaction.

C'est un produit payant, réservé au plan Max. Un abonné le lit pour prendre une
décision d'investissement. Il paiera pour de la matière qu'il ne trouve pas
ailleurs, pas pour une liste de généralités.

**Le test de valeur** : si un investisseur qui suit la société depuis trois ans
apprend au moins deux choses en lisant l'ATT, c'est réussi. S'il se dit "je
savais déjà tout ça", c'est raté même si tout est exact.

### Ce que l'ATT n'est PAS

| Pas ça | Pourquoi |
|---|---|
| Une prédiction de cours | On ne dit jamais où va l'action |
| Une recommandation de vente | On documente des faiblesses, le lecteur décide |
| Un réquisitoire | Une société solide a droit à une ATT courte |
| Un résumé des "Risk Factors" du 10-K | Ces risques sont génériques et déjà dans le bloc Facteurs de risque |
| De l'opinion | Chaque phrase s'appuie sur un fait publié |

Le dernier point est le plus important. La différence entre une ATT et un
article d'opinion, c'est que chaque affirmation est traçable jusqu'à un
document officiel.

---

## 2. Le fichier à produire

Un fichier par société : `src/data/att/<ticker en minuscules>.json`.
Le ticker garde son suffixe de place : `mc.pa.json`, `rog.sw.json`, `alv.de.json`.

```json
{
  "ticker": "PM",
  "redigee_le": "2026-07",
  "donnees_arretees_au": "2026-07-24",
  "intensite": "moderee",
  "hook": "…",
  "resume": "…",
  "fondamental_interne": [
    { "titre": "…", "argument": "…", "preuve": "…" }
  ],
  "fondamental_externe": [
    { "titre": "…", "argument": "…", "preuve": "…" }
  ],
  "quantitatif": [
    { "titre": "…", "chiffre": "…", "perspective": "…", "source": "…" }
  ],
  "ce_qui_affaiblirait": ["…", "…"],
  "glossaire": { "CAPITAUX PROPRES*": "…" },
  "_sources": ["10-Q T2 2026", "10-K FY2025", "…"],
  "_redige_par": "att-chain",
  "_fige": false
}
```

### Champ par champ

**`redigee_le`** : format `YYYY-MM`, mois et année seulement.
Règle absolue : jamais antérieur au mois de `donnees_arretees_au`. Une analyse
ne peut pas citer un document publié après sa rédaction. En pratique, mettre le
mois de la dernière publication utilisée, ou le mois suivant.

**`donnees_arretees_au`** : date ISO complète du document le PLUS RÉCENT
réellement utilisé, date de publication et non de clôture de période. Un 10-Q
déposé le 24 juillet pour un trimestre clos le 30 juin donne `2026-07-24`.

**`intensite`** : `faible` | `moderee` | `elevee`. Grille au § 4.

**`hook`** : 1 à 2 phrases. **C'est le seul champ visible par les non-abonnés.**
Il doit donner envie de payer sans mentir ni tout révéler. Le meilleur hook
oppose deux faits vrais qui ne devraient pas coexister.

**`resume`** : 2 à 4 phrases qui posent l'anti-thèse et, si la société est
solide, le disent franchement. Commencer par reconnaître la force du dossier
quand elle existe : ça crédibilise tout le reste.

**`fondamental_interne`** : ce qui vient de la société (bilan, marges,
dépendances, gouvernance, allocation du capital, qualité du résultat).

**`fondamental_externe`** : ce qui vient du dehors (concurrence, régulation,
cycle, technologie, clients, géopolitique).

**`quantitatif`** : chiffres bruts avec mise en perspective. `chiffre` est la
valeur verbatim, `perspective` la compare à l'historique de la société ET/OU à
des pairs nommés.

**`ce_qui_affaiblirait`** : 5 à 9 faits qui, s'ils changent, périment l'ATT.
C'est ce qui rend la date utile et prouve l'honnêteté de l'exercice.

**`glossaire`** : tout terme technique marqué d'un astérisque dans les textes.
Un lycéen doit comprendre la définition.

**`_sources`** : liste des documents utilisés. Y signaler tout document écarté
et pourquoi (voir § 6 sur la cross-pollution).

---

## 3. Comment on rédige

### La règle qui compte le plus : le test bull-proof

Pour chaque argument, formuler mentalement la meilleure réponse d'un
investisseur favorable à la société. Trois issues :

- l'argument ne survit pas → **le retirer**
- il survit avec une nuance → **intégrer la nuance dans l'argument lui-même**
- il survit tel quel → le garder

Exemple réel (TJX) : un agent voulait citer la valorisation comme argument.
Test bull-proof : TJX se paie moins cher que ses pairs. Argument retiré.

Exemple réel (Amazon) : "la dette a doublé". Réponse bull : la trésorerie
couvre largement. Nuance intégrée : "la dette a doublé **même en tenant compte
des 88 Mds $ de trésorerie**".

Un argument qui n'a pas passé ce test se voit immédiatement : il est
contournable en une phrase par n'importe quel lecteur informé, et il décrédibilise
les bons arguments qui l'entourent.

### Proportionnalité

Une société solide a droit à une ATT courte. C'est un signal de qualité, pas
un aveu de paresse. Sur les 202 premières, 5 sont en intensité faible avec 7
arguments, et c'est correct.

**Ne jamais gonfler.** Un argument faible ajouté à cinq bons arguments affaiblit
l'ensemble.

Volume constaté sur les 202 : 11,5 arguments en moyenne, de 4 à 18.

### Objectivité

Chaque argument = un fait vérifiable (chiffre, citation, événement documenté)
suivi de son implication. Jamais d'opinion, jamais de "pourrait" non étayé.

**Piège juridique, rencontré en vrai sur CrowdStrike.** Un agent avait écrit
"le DOJ et la SEC enquêtent". Le filing disait exactement : *"The Company has
received requests for information from the U.S. Department of Justice"*. Une
demande d'information n'est pas une enquête. La formulation a été corrigée en
"ont demandé des informations".

À l'inverse, sur ServiceNow, le 10-Q disait littéralement *"the Department of
Justice, which has commenced its own investigation"*. Là, "enquête" est le mot
juste.

**Règle** : sur tout ce qui touche au judiciaire ou au réglementaire, coller au
mot exact du document. Ne jamais monter d'un cran dans la gravité.

### Vulgarisation

Phrases courtes. Tout sigle ou terme technique marqué d'un astérisque et défini
au glossaire. Un lycéen doit tout comprendre.

### Vocabulaire Mettrik (non négociable)

- **Zéro tiret cadratin ou demi-cadratin** (— et –) dans tout texte rédigé en
  français. C'est le tic d'IA le plus détesté du projet. Utiliser deux-points ou
  couper la phrase. C'est par les verbatims recopiés depuis les filings que 2
  em-dash sont passés sur les 202 premières, dans du texte français : les
  traquer.
  **Seule exception** : un tiret situé À L'INTÉRIEUR d'une citation anglaise
  entre guillemets, dans le champ `preuve` ou `source`. Altérer une citation
  serait pire que le tiret. 5 ATT sont dans ce cas (XOM, PEP, NEE, PH, ALV.DE),
  toutes sur des libellés SEC du type «Price – Increased earnings by...». Ces
  verbatims ne sont visibles que dans l'infobulle.
- **"Mds"** et pas "B" ni "milliards" : "49,1 Mds $", "80,8 Mds €".
- Français partout, accents compris. Six ATT ont dû être reprises parce qu'elles
  avaient été écrites en ASCII sans accents ("benefice", "declin").
- Devise réelle de publication : € pour la plupart des européennes, CHF pour
  Roche et Nestlé, $ pour Novartis, UBS, ABB, Alcon, TotalEnergies, Prosus.

---

## 4. Grille d'intensité

| Intensité | Critère | Fréquence observée |
|---|---|---|
| `faible` | Aucune fragilité structurelle. Risques résiduels : valorisation, cycle sectoriel, concentration mineure. ATT courte assumée, à dire dans le résumé. | 5 / 202 |
| `moderee` | 1 à 3 vraies fragilités documentées mais compensées par des forces réelles. | 126 / 202 |
| `elevee` | Fragilités structurelles multiples et simultanées : pertes, dette lourde, perte de parts de marché, dépendance critique, litige majeur, falaise de brevets. | 61 / 202 |

**Le mot "simultanées" est le discriminant.** Une seule grosse fragilité dans un
dossier par ailleurs sain reste `moderee`. Trois fragilités indépendantes qui
peuvent se renforcer donnent `elevee`.

Ne pas confondre "l'action a baissé" et "la société est fragile". L'intensité
juge l'entreprise, pas le titre.

---

## 5. Le rendu visuel : pourquoi il dicte la rédaction

Le composant `anti-these-card.tsx` affiche l'ATT ainsi :

1. Titre + badge d'intensité + "Rédigée en <mois année>, sur la base des
   documents publiés jusqu'en <mois année>"
2. Le **hook** dans un encadré dégradé violet/cyan : visible par tous
3. Le **résumé** en paragraphe
4. Quatre sections à titres en 15px semi-gras : Fondamental interne,
   Fondamental externe, Quantitatif, Ce qui affaiblirait cette anti-thèse
5. Le **glossaire** en bas, termes avec majuscule initiale

Trois conséquences directes sur la façon d'écrire :

**a) La preuve n'est plus affichée sous le paragraphe.** Elle est dans une
infobulle "i" à droite du titre de l'argument. Le lecteur voit d'abord le
raisonnement en français, et va chercher le verbatim anglais s'il veut vérifier.
Donc : `argument` doit se suffire à lui-même, sans le verbatim. Ne jamais
écrire "voir citation ci-dessous".

**b) Les paragraphes massifs sont illisibles.** Un `argument` qui enchaîne
plusieurs constats doit les séparer par " ; " (espace point-virgule espace) :
le composant les transforme automatiquement en puces.

Mauvais :
> "Au 30 juin 2026 les capitaux propres sont négatifs de 6 657 M$ et la dette
> atteint 49,1 Mds $ pour seulement 6,0 Mds $ de trésorerie et le dividende
> déclaré au S1 représente 87% du BPA dilué ce qui laisse peu de marge."

Bon :
> "Au 30 juin 2026, les capitaux propres sont négatifs de 6 657 M$ ; la dette
> atteint 49,1 Mds $ pour seulement 6,0 Mds $ de trésorerie ; le dividende du
> S1 représente 87% du BPA dilué, ce qui laisse peu de marge pour se désendetter."

Viser 2 à 4 constats par argument, chacun d'une à deux lignes.

**c) Le hook est le seul texte vu par les non-abonnés.** Il est en gros, en
premier, sur fond dégradé. Il porte à lui seul la conversion.

Bon hook (Sandisk) :
> "Le chiffre d'affaires de Sandisk a été multiplié par 3,5 en un an, mais le
> nombre d'exaoctets vendus n'a pas bougé : toute la hausse vient du prix."

Bon hook (Prosus) :
> "Prosus a publié un bénéfice de base ajusté de 8 340 M$ en 2026. En retirant
> la seule participation dans Tencent, il en reste 223 M$."

Mauvais hook :
> "La société fait face à plusieurs défis dans un environnement concurrentiel
> difficile." (aucun fait, aucun chiffre, vrai de n'importe quelle société)

---

## 6. Les pièges, tous rencontrés en vrai

### a) Cross-pollution des sources

Un bug de résolution de ticker a fait télécharger les filings SEC de sociétés
américaines homonymes dans les dossiers de sociétés européennes. Le bug est
corrigé, mais **les fichiers pollués sont toujours sur le disque**.

29 tickers sont concernés, listés dans `src/data/_data-lake-cross-pollution.json`.
Chaque dossier atteint porte un fichier `_WRONG_COMPANY.txt` qui nomme la
société réelle.

Exemples : `MC.PA` contient Moelis, `ROG.SW` contient Rogers Corp, `SAN.PA`
contient Banco Santander, `AIR.PA` contient AAR Corp, `MRK.DE` contient
Merck & Co (américain, à ne pas confondre avec Merck KGaA), `BN.PA` contient
Brookfield.

**Réflexe obligatoire pour tout ticker à suffixe (.PA .AS .DE .SW)** : avant de
citer un chiffre, vérifier le nom du déposant dans le document. S'il ne
correspond pas, écarter le document et le signaler dans `_sources`.

Attention, la pollution touche aussi les sous-dossiers SC13D, SC13G, 424B, S1,
S4, pas seulement 10K/10Q/8K.

Cas légitimes à ne PAS écarter : ALC.SW, MT.PA, AMRZ.SW déposent réellement
auprès de la SEC. SAP.DE et TTE.PA aussi, mais leurs SC13D visent des
participations (Castlight, Maxeon) : le déposant est bon, l'émetteur est un
tiers, ne pas prendre les chiffres du tiers pour ceux du groupe.

### b) Collision de fichiers temporaires

Deux agents ont écrit des fichiers de travail du même nom dans le scratchpad
partagé, et l'un a lu les extraits de l'autre. Incident détecté par l'agent
lui-même, mais il aurait pu passer inaperçu.

**Préfixer tous les fichiers temporaires par le ticker** (`SHELL_10q.txt`) et ne
jamais lire un fichier de travail qui ne porte pas son propre préfixe.

### c) Données de la mauvaise entité

Sur Continental et Daimler Truck, les KPI publiés venaient des **comptes
sociaux de la holding** et non du consolidé : Continental affichait 396,1 M€ de
chiffre d'affaires au lieu de 19 676 M€. Vérifier qu'on lit bien les comptes du
groupe.

### d) Étiquette de devise fausse

`data-lake/<T>/kpis/extracted.json` estampille `"M USD"` en dur pour toutes les
sociétés, y compris Volkswagen et Siemens. Les valeurs sont bonnes, l'étiquette
ment. Ne jamais recopier l'unité de ce fichier : la déduire de la devise de
publication réelle.

### e) Documents manquants

Il arrive qu'un communiqué soit dans le data-lake sans son annexe chiffrée
(page de garde seule), ou qu'un fichier daté du mois courant soit en réalité un
doublon md5 d'un fichier plus ancien. Vérifier que le document contient bien des
chiffres avant de le déclarer "le plus récent", et signaler le manque dans
`_sources` plutôt que d'inventer.

### f) Coupures serveur

Les erreurs API 529 coupent les agents en cours. Sur une série, 8 agents ont été
interrompus ; 6 avaient déjà écrit leur fichier, 2 ont tout perdu.

**Écrire le fichier dès qu'on a la matière suffisante**, quitte à l'enrichir
ensuite. Ne jamais tout garder en mémoire jusqu'à la fin.

---

## 7. Procédure d'exécution

### Sources à lire, dans l'ordre

1. `data-lake/<TICKER>/` : filings les plus récents d'abord (10-Q, puis 8-K,
   puis 10-K). Pour les européennes : documents IR, rapports semestriels, URD.
2. `.batches-drafts-safe/kpis-haut/<TICKER>.json` : KPI vérifiés, fiables,
   utiles pour les séries historiques et les comparaisons.
3. `src/data/v2-pipeline/<ticker>.json` : segments, gouvernance, risques.

Règle de récence : chaque chiffre cité doit être le dernier publié, sauf
comparaison historique explicite. Priorité aux documents 2026.

### Ordre de traitement

Par capitalisation décroissante, liste `ordre` dans `.conv-state/att-state.json`.
Reprendre au premier ticker qui n'est ni dans `done` ni dans `en_vol`.

### Cadence

4 à 6 agents en parallèle, un ticker par agent. Au-delà, deux limites :
la RAM du Mac (surveiller `vm_stat`, ne pas descendre sous 50 Mo libres) et les
erreurs 529 côté serveur.

Après chaque agent terminé, mettre `.conv-state/att-state.json` à jour et en
relancer un immédiatement. Le fichier d'état est la seule source de vérité pour
reprendre après une interruption.

### Prompt type pour un agent

```
Lis /Users/yann/spx-app/.conv-state/att-spec.md et
/Users/yann/spx-app/docs/ATT-PROCEDURE.md, puis rédige l'anti-thèse
d'investissement de <NOM> (<TICKER>).
Repo /Users/yann/spx-app.
Sources : data-lake/<TICKER>/ (documents 2026 les plus récents d'abord),
.batches-drafts-safe/kpis-haut/<TICKER>.json, src/data/v2-pipeline/<ticker>.json.
[si ticker EU pollué] ATTENTION : data-lake/<TICKER>/ sous-dossiers SEC
contiennent <SOCIÉTÉ AMÉRICAINE>, à écarter totalement.
Préfixe tous tes fichiers temporaires par <TICKER>_.
Écris src/data/att/<ticker>.json dès que tu as la matière suffisante.
Détermine l'intensité toi-même via la grille.
INTERDIT : rm avec glob, téléchargement navigateur.
RETOUR STRICT (5 lignes max) : intensité, hook, donnees_arretees_au,
nb arguments, fichier écrit.
```

Le retour court est important : un agent qui rend 40 lignes sature le contexte
de l'orchestrateur et la rotation s'arrête au bout de quelques dizaines de stés.

---

## 8. Contrôles avant de déclarer un lot terminé

À lancer tous les 20 fichiers :

```bash
cd ~/spx-app && python3 - <<'EOF'
import json,glob,statistics
from collections import Counter
rows=[]
for p in sorted(glob.glob('src/data/att/*.json')):
    if '.bak' in p: continue
    d=json.load(open(p))
    n=(len(d.get('fondamental_interne',[]))+len(d.get('fondamental_externe',[]))
       +len(d.get('quantitatif',[])))
    txt=json.dumps(d,ensure_ascii=False)
    rows.append((d.get('ticker'),d.get('intensite'),str(d.get('donnees_arretees_au')),
                 n,len(d.get('glossaire') or {}),'—' in txt or '–' in txt,
                 str(d.get('redigee_le'))<str(d.get('donnees_arretees_au'))[:7]))
print('fichiers:',len(rows),'| intensites:',dict(Counter(r[1] for r in rows)))
print('args moyens:',round(statistics.mean(r[3] for r in rows),1))
print('tirets longs :',[r[0] for r in rows if r[5]] or 0)
print('sans glossaire:',[r[0] for r in rows if r[4]==0] or 0)
print('donnees < 2026:',[r[0] for r in rows if r[2]<'2026-01-01'] or 0)
print('date incoherente:',[r[0] for r in rows if r[6]] or 0)
print('intensite invalide:',[r[0] for r in rows
      if r[1] not in ('faible','moderee','elevee')] or 0)
EOF
```

Les six dernières lignes doivent afficher `0`. Sinon corriger avant de continuer.

Contrôle supplémentaire, sur un échantillon de 3 fichiers par lot : ouvrir le
document source et vérifier qu'un verbatim cité s'y trouve mot pour mot. C'est
ce contrôle qui a permis de détecter le cas CrowdStrike.

### Vérification du rendu

```bash
TOK=$(grep -h "VISUAL_AUDIT_TOKEN" .env.local | cut -d= -f2- | tr -d '"')
curl -sL -o /tmp/att.html -H 'Cookie: mettrik:simulate-as=max' \
  "http://localhost:3000/sandbox/v1-9-5/<TICKER>?audit_token=$TOK"
grep -oE "Rédigée en <!-- -->[a-zé]+ 2026|Fondamental interne" /tmp/att.html
```

Sans le cookie `mettrik:simulate-as=max`, la page rend le placeholder flouté et
on ne voit rien du contenu : c'est le gating qui fonctionne, pas un bug.

---

## 9. Interdits

- Inventer un chiffre, même plausible, même "pour illustrer"
- Monter d'un cran dans la gravité juridique (demande d'information ≠ enquête)
- Utiliser un document dont le déposant ne correspond pas à la société
- Écrire un tiret cadratin ou demi-cadratin
- `rm` avec glob, téléchargement navigateur, commande déclenchant un prompt macOS
- Modifier un fichier ATT d'une autre société que la sienne
- Dater une ATT avant les documents qu'elle cite

---

## 10. État actuel et reprise

Au 15 août 2026 : **202 ATT écrites**, 449 restantes.

Répartition : 126 modérée, 61 élevée, 5 faible. 11,5 arguments en moyenne.
Dates de rédaction : 9 mai, 9 juin, 71 juillet, 113 août.

Anomalies de données repérées pendant la rédaction et non encore traitées :
`.conv-state/att-kpi-anomalies.json`. Ce sont des défauts des pages société, pas
des ATT : KPI incohérent avec le filing chez Schwab, séries par action non
ajustées d'un split chez Booking, dirigeant périmé chez CSX. À traiter
séparément.

Pour reprendre : lire `.conv-state/att-state.json`, prendre le premier ticker de
`ordre` absent de `done`, et appliquer le § 7.

---

## 11. Points à trancher avec Yann

Ces questions restent ouvertes et méritent une décision avant la fin de la
production :

1. **Passe adversariale.** Faut-il faire relire les ATT d'intensité élevée par
   un second agent chargé de les réfuter ? Recommandation : oui, sur les ~190
   ATT élevées et sur toute ATT mentionnant un litige ou un régulateur. C'est là
   que le risque se concentre.
2. **Table Supabase `desk_att`.** Le back-office d'édition manuelle existe
   (`/desk-mtk9x4kp/att`) mais la table n'est pas créée : le SQL est dans
   `supabase/migrations/20260814_desk_att.sql`. Tant qu'elle n'existe pas,
   l'app lit les fichiers locaux et l'édition manuelle n'est pas persistée.
3. **Champ `_fige`.** Prévu pour geler une ATT validée à la main et empêcher
   qu'un futur passage automatique l'écrase. Le mécanisme n'est pas encore
   branché côté écriture.
