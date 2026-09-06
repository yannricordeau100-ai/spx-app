# Brief : TAM (marché adressable) par société, 7 sept 2026

Mission : pour chaque société de l univers, proposer JUSQU A 3 candidats de TAM (taille totale du marché) pour son activité principale (ou ses deux activités principales), afin que le propriétaire en retienne 2 (ou 1) dans l atelier `/sandbox/tam`. Le bloc « Position marché » affiche : nom du segment, revenu du segment (société), taille du marché, part captée, croissance du marché, source.

## Règles
- Le revenu du segment vient TOUJOURS de la société (10-K, rapport annuel, document d enregistrement universel, communiqué de résultats) : dernier exercice publié, avec la source.
- La taille de marché vient de préférence de la société elle-même (journée investisseurs, présentation, appel de résultats, rapport annuel) ; sinon d une étude reconnue (Gartner, IDC, eMarketer, Statista, McKinsey, BCG, IEA, association professionnelle, régulateur...). Toujours l URL précise, l année de l estimation et, si publié, la croissance annuelle attendue.
- Le périmètre du TAM doit correspondre à l activité : pas besoin d une identité parfaite, mais le TAM doit couvrir le marché où la société vend réellement (pas un marché voisin ou un total mondial sans rapport). En cas de doute entre deux périmètres, proposer les deux candidats et l expliquer dans `hesitation`.
- Jamais de valeur inventée, jamais de TAM « estimé » par toi. Si aucune source fiable n existe pour aucune activité : `candidats: []` et `commentaire` (cas rare).
- Unités : revenu et TAM dans la même unité, `Mds $` ou `Mds €` (ou `M $`). Convertir explicitement si l étude est dans une autre devise (indiquer le taux et la date).
- `fiabilite` : `haute` (chiffre de la société ou d un cabinet de référence, périmètre clair), `moyenne` (étude sérieuse mais périmètre un peu plus large ou plus étroit que l activité), `faible` (source secondaire, périmètre douteux). Ne rien proposer en `faible` sauf si c est le seul candidat, et le dire.
- Pas de nom de personne, pas de tiret long, texte en français.

## Format `docs/cahier/tam/<TICKER>.json`
```json
{
  "ticker": "GOOGL",
  "date": "2026-09-07",
  "activites_principales": ["Publicité en ligne (Search et YouTube)", "Cloud (Google Cloud)"],
  "candidats": [
    {
      "id": "c1",
      "segment": "Google Cloud (IaaS, PaaS, SaaS professionnel)",
      "segment_revenu": 58.71, "segment_unite": "Mds $", "segment_exercice": "2025",
      "segment_source": {"url": "https://...", "titre": "Alphabet 10-K 2025, note segments"},
      "tam_intitule": "Marché mondial des services de cloud public",
      "tam": 750, "tam_unite": "Mds $", "tam_annee": "2025", "tam_fourchette": [700, 800],
      "tam_source": {"url": "https://...", "titre": "Gartner, Public Cloud Services Forecast, 2025"},
      "croissance_marche_pct": 18,
      "fiabilite": "haute",
      "commentaire": "Périmètre Gartner IaaS + PaaS + SaaS ; Alphabet capte environ 8 %."
    }
  ],
  "hesitation": "Pourquoi le propriétaire doit trancher entre c1 et c2, ou vide.",
  "commentaire": ""
}
```
Le contrôle est `python3 docs/cahier/tam/_valide.py <TICKER>`.
