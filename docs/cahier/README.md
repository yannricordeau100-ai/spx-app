# Le Cahier

Dossier de travail commun à toutes les sessions Claude (app Mac, Claude Code web, autre compte).
Une seule règle : ce qui doit survivre à une conversation s'écrit ICI, jamais dans une conversation.

| Fichier | Contenu |
|---|---|
| `PROMPTS.md` | Registre des prompts de recherche : un bloc par prompt, lisible d'un coup d'œil sur `/sandbox/gics` (onglet Prompts) |
| `kpi/<code-gics>.json` | KPI souhaités / nécessaires pour un investisseur, par sous-industrie GICS (8 chiffres). Affiché dans l'onglet « KPI par sous-industrie » |
| `sources.md` | Hiérarchie des sources de données sur internet (par type de donnée et par pays) |

Conventions :
- une session = `git pull` au début, `git push` à la fin ; jamais deux sessions sur le même fichier en même temps ;
- pas d'invention : un KPI sans définition sourcée reste en statut `a_verifier` ;
- les codes GICS et les noms viennent de `src/lib/desk/gics.ts`.

## Où demander quoi

| Besoin | Où | Pourquoi |
|---|---|---|
| Créer / compléter / corriger un KPI d une société | Claude Code (app Mac ou claude.ai/code), conversation Mettrik, format `kpi-societe` de PROMPTS.md | il écrit les données, déploie et vérifie en réel ; Claude chat ne peut ni écrire dans le dépôt ni déployer |
| KPI attendus d une sous-industrie | Claude Code, prompt `kpi-sous-industrie` | écrit `kpi/<code>.json`, visible dans /sandbox/gics |
| Recherches de sujets / données (lecture, synthèse) | Claude chat (n importe quel compte) OU Claude Code | résultat = texte ; il est ensuite déposé dans le Cahier par une session Claude Code (coller le résultat avec « mets ça dans le Cahier, fichier X ») |
| Hiérarchie des sources | Claude chat ou Claude Code, prompt `sources-internet` | même règle : dépôt final par Claude Code dans `sources.md` |

Une seule session écrit à la fois ; les deux comptes lisent et écrivent le même dépôt (branche staging).
