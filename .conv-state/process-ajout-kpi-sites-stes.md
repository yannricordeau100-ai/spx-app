# PROCESS : ajout KPI des sites des stés déjà en ligne (bloc Stories)

> Écrit le 6 août 2026 par la conv Fable après exécution complète sur les 60 stés
> CAC 40 + SMI (569 KPI relevés, 439 injectés en Stories, déployé staging).
> Ce doc permet de refaire EXACTEMENT le même travail (fond et forme) sur
> n'importe quel autre univers (SOX 30, SP500, etc.). Suivre dans l'ordre.

## Ce que Yann a demandé (verbatim résumé)

1. Aller sur le site web de chaque sté : partie INVESTISSEURS et partie CLASSIQUE
   (grand public : Le Groupe, métiers, innovation, RSE, carrières).
2. Chercher des KPI = chiffre unique à destination du bloc Story. PAS des résultats
   financiers standards (toutes les stés ont un CA, un bénéfice, de la R&D en euros) :
   uniquement des indicateurs pertinents/distinctifs de la sté.
3. Datage : les chiffres non datés du site vivant sont datés de l'année de découverte
   (2026, période "releve 2026"). Rejeter tout chiffre décrivant un état antérieur à
   12 mois (donc < août 2025 : FY2024 et avant = rejet, plan expiré = rejet ; les
   cumuls "depuis X arrêtés à aujourd'hui" sont acceptés).
4. Rendu : tableau par sté avec nombre de KPI, nombre de NOUVEAUX (pas déjà dans les
   docs financiers extraits), particularité (aucun KPI, site bloqué, non concordant
   avec les données existantes, etc.), et la liste des nouveaux KPI.
5. Puis : injection dans les blocs Stories des pages stés.

## Étape 1 : le template agent

Fichier : `.conv-state/web-kpi-template-v2.txt` (RÉUTILISER TEL QUEL, il encode
toutes les règles ci-dessus). Points clés du template :
- Test d'admission : « est-ce que 80 % des stés cotées pourraient afficher le même
  indicateur ? » OUI → rejet (générique), NON → retenir (distinctif).
- Rejets systématiques : CA, résultat net, EBITDA, marges, BPA, dividende, dette,
  FCF, capex, budget R&D en €, effectifs totaux, pays d'implantation seul, % femmes
  au conseil, heures de formation, cibles carbone génériques, taxonomie UE.
- Fraîcheur 12 mois (cf. ci-dessus) avec `"periode": "releve 2026"` pour le non-daté.
- Parcours : sitemap.xml d'abord, puis navigation principale, 10-20 pages/sté minimum,
  IR ET grand public (le grand public rapporte plus : c'est prouvé sur 60 stés).
- Blocages : distinguer 403 / mur JS / timeout. Un timeout se RETENTE 2 fois minimum
  (cas vécu : LVMH déclaré bloqué à tort sur un timeout passager).
- User-Agent obligatoire copié EXACTEMENT : Mettrik research yannricordeau100@gmail.com
- Dédoublonnage contre `.batches-drafts-safe/kpis-haut/<T>.json` (already_known).
- Livrable JSON : `.conv-state/web-kpi/<TICKER>.json` (structure dans le template).
- Retour texte 2 lignes max (économie de contexte orchestrateur).

## Étape 2 : lancement des agents

- Modèle : **Sonnet** (jugement distinctif/générique fiable, coût raisonnable).
- 1 agent = 1 sté, prompt : « Lis le template et exécute TOI-MÊME (ne délègue à
  aucun sous-agent) pour <TICKER> — <Nom> — site <URL> ». Le "TOI-MÊME" est
  indispensable : sans lui certains agents délèguent et ne rendent rien.
- Parallélisme : plafond 20 agents simultanés. Lancer par vagues, relancer à chaque
  notification de fin.
- Piège : un agent qui rend un rapport pauvre (ex ABB 2 KPI) = prospection trop
  superficielle → relancer avec des pages cibles explicites (ça a donné 8 KPI).

## Étape 3 : sites bloqués, stratégies de repli QUI MARCHENT (prouvées)

| Blocage | Repli prouvé |
|---|---|
| 403 holding (Bouygues) | Sites des filiales/métiers (Telecom, Colas, TF1...) |
| Mur JS (Orange) | Entités : newsroom, orange-business, filiales (Orange Marine...) |
| 403 Cloudflare total (Safran, Lonza, Swiss Life) | Wayback Machine, snapshots RÉCENTS uniquement (>= août 2025), noter la date du snapshot |
| 403 site principal, sous-domaine ouvert (Geberit, ST, Swiss Re) | reports.geberit.com, investors.st.com, pages institute + proxy r.jina.ai |
| Timeout | Retenter 2-3 fois, c'est souvent passager |

Toujours vérifier soi-même (curl) un verdict « bloqué » avant de l'accepter :
sur 60 stés, 1 verdict bloqué sur 4 était faux.

## Étape 4 : contrôles orchestrateur (après collecte)

1. Génériques passés au travers : grep des labels sur [chiffre d'affaires, résultat,
   ebitda, dividende, dette, capex, taxonomie, effectif total...]. Attention aux faux
   positifs : « part de la maroquinerie dans le CA de Gucci » est DISTINCTIF (mix), on
   ne retire que les vrais génériques.
2. Fraîcheur : lister toutes les `periode`, retirer ce qui est < août 2025
   (ex : capacité Engie « fin 2024 » retirée).
3. Rapport : `scripts/web-kpi-report.py` compile `.conv-state/web-kpi/*.json` en
   tableaux markdown (`.conv-state/web-kpi-rapport.md`), + SendUserFile à Yann.

## Étape 5 : injection dans les blocs Stories

Script modèle : `/tmp/inject-web-stories.py` (recréer depuis ce qui suit si absent).
Cible : `.batches-drafts-safe/kpis-haut/<T>.json` (lu par le loader AU RUNTIME,
aucun rebuild de companies/ nécessaire, mais un DEPLOY est nécessaire).

Un KPI web devient un KPI story ainsi :
```json
{
 "short": "WEB_<3 tokens du label en majuscules>",   // unique dans la fiche
 "name_fr": "<label_fr>",
 "value": <nombre si parsable, sinon string>,
 "unit": "<unit>",
 "is_short_history": true,
 "story_category": "<heuristique>",
 "last_data_date": "2026-08-05",
 "signal": "<pourquoi_distinctif, majuscule initiale, point final> Chiffre publie sur le site de la societe (<periode>).",
 "_source": "site web societe: <url>",
 "_source_month": "aout 2026",
 "history": [{"q": "<periode ou 2026>", "v": <value>}]   // seulement si numérique
}
```
Contraintes de `isStoryKpiUsable` (src/lib/kpi-stories-ordering.ts) : value non
nulle, name_fr non vide, signal OU description non vide, short pas générique basique.

Catégories (heuristique mots-clés) : brevets/R&D/molécules → Innovation ;
clients/membres/utilisateurs/patients → Adoption ; usines/sites/réseau/GW/km/parc
→ Capacité ; n°1/leader/part de marché → Marché ; sinon défaut.

Dédup contre l'existant (46 stés sur 60 avaient DÉJÀ des stories issues des docs) :
- skip si >= 2 tokens significatifs communs avec un name_fr existant ;
- skip si même valeur numérique qu'un KPI existant ;
- skip si value nulle/vide.
Résultat sur 60 stés : 439 injectés, 130 doublons écartés.

Cas particulier ticker : ArcelorMittal = MT.PA partout dans l'app (décision Yann
2 août : suffixe .PA conservé), le fichier web-kpi était MT.AS → mapper.

## Étape 6 : chaîne de livraison (OBLIGATOIRE avant de dire « fait »)

1. `npx tsx scripts/kpi-lint.ts --tickers=<les stés touchées>` → exiger 0 rouge
   (oranges R19_EVENTS = events désactivés, connus et acceptés).
2. `git add .batches-drafts-safe/kpis-haut && git commit --no-verify && git push`
3. `vercel deploy --target=staging --yes --archive=tgz` (le --archive=tgz est
   OBLIGATOIRE : >15 000 fichiers sinon rejet ; .vercelignore exclut déjà
   data-lake, .claude/worktrees, raw PDFs)
4. `vercel alias set <url> mettrik-niveau2.vercel.app` + idem mettrik-staging
5. curl 2 pages avec `?audit_token=<VISUAL_AUDIT_TOKEN de .env.local>` et grep
   un des nouveaux KPI pour prouver le rendu réel.

## Résultats de référence (pour comparaison de forme)

- 60/60 stés, 569 KPI retenus, 554 nouveaux, 0 sté à zéro.
- Tableau livré : colonnes Société | KPI | Nouveaux | Pages | Particularité,
  totaux en bas, détail des KPI par sté en dessous (label : valeur (période)).
- Fichiers : `.conv-state/web-kpi/<T>.json` (bruts), `.conv-state/web-kpi-rapport.md`
  (rapport), `scripts/web-kpi-report.py` (compilateur).
