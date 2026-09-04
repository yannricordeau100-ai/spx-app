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
