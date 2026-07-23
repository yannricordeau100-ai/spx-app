# Spec Synthèse Earning Call (chantier SP500, juillet 2026)

Objectif : pour un ticker donné, produire `src/data/transcript-summaries/<ticker minuscule>.json`
au MÊME format que les synthèses existantes (ex : `src/data/transcript-summaries/aal.json`).

## Entrée
- Le transcript du DERNIER earning call : chemin donné dans la mission
  (fichier texte brut Motley Fool, ~30-60k caractères).
- Ne JAMAIS utiliser une autre source ni des connaissances externes : uniquement ce document.

## Sortie : JSON exact
```json
{
  "ticker": "<TICKER MAJUSCULE>",
  "quarter": "<YYYYQN, ex 2026Q1 : trimestre FISCAL annoncé dans le call>",
  "fetched_at": "<ISO 8601 UTC maintenant>",
  "source": "fool_transcript_latest",
  "model": "claude-fable-5",
  "summary": {
    "tonalite_management": "1 phrase (max ~220c) sur le ton et la confiance du management, avec 1-2 chiffres clés",
    "sentiment": "bullish | neutral | cautious",
    "bullets": [
      {
        "text": "1 phrase dense : chiffre précis + signal + action (120-230c)",
        "type": "synthesis | tonalite | driver | vigilance | guidance | strategy | citation",
        "terms_used": ["2-3 termes techniques anglais utilisés dans le call"]
      }
    ]
  }
}
```

## Règles de contenu (NON NÉGOCIABLES)
1. 8 à 10 bullets. Le 1er est toujours type "synthesis" (résultat global du trimestre).
   Inclure au moins : 1 "guidance", 1 "driver", 1 "vigilance" (risque/frein cité par le management),
   1 "citation" (citation courte traduite ou en anglais entre « », avec le nom du dirigeant).
2. Français pour investisseurs particuliers. Vocabulaire simple, chiffres exacts du transcript.
3. JAMAIS de tiret cadratin (—). Utiliser " : " ou " ; " ou deux phrases.
4. "B"/"billion" s'écrit "Mds $" (ex : "$12,4 Mds" ou "12,4 Mds $"). Décimales à la française (virgule).
5. Zéro invention : chaque chiffre doit venir du transcript. En cas de doute sur un chiffre, l'omettre.
6. Pas de section "comparison" (un seul transcript disponible).
7. sentiment : bullish si ton confiant + guidance en hausse/résultats au-dessus des attentes ;
   cautious si prudence explicite, guidance abaissée ou vents contraires dominants ; neutral sinon.
8. quarter = trimestre fiscal du call (dit dans le titre/l'intro du transcript), format YYYYQN.
9. Écrire le fichier en UTF-8, JSON indent 1, ensure_ascii=False (accents réels).

## Validation
Après écriture, exécuter : `python3 scripts/ts-sp500-validate.py <ticker>` : doit afficher OK.
Si erreur, corriger le fichier et revalider (max 2 tentatives).
