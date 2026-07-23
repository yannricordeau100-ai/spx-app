# Spec Synthèse Earning Call — cas fallback press release SEC (13 stés)

Ces 13 stés n'ont pas de transcript Motley Fool exploitable pour le dernier trimestre.
La source utilisée est le press release earnings (exhibit 99.1 d'un 8-K SEC) le plus récent, ou l'earnings release Berkshire.

Utilise strictement la même structure que la spec `ts-summ-spec.md`.

Différences autorisées :
1. Champ `source` : mets `"sec_earnings_release"` (au lieu de `"fool_transcript_latest"`).
2. `quarter` : déduis le trimestre FISCAL depuis le contenu du release (souvent nommé "Q1 2026", "First quarter 2026", "FY26 Q4", etc.). Format `YYYYQN` toujours obligatoire.
3. Si le release ne contient AUCUNE citation attribuée à un dirigeant (rare), tu peux remplacer le bullet `type: "citation"` par un bullet supplémentaire de type `guidance`, `driver` ou `strategy`. La règle "≥8 bullets, ≥1 synthesis, ≥1 guidance" reste obligatoire.
4. `tonalite_management` doit refléter le ton du press release (souvent plus factuel qu'un call).

Tout le reste (nombre de bullets, formatage FR, pas d'em-dash, décimales à la virgule, ticker MAJUSCULE, `model: "claude-opus-4-7"`, chiffres uniquement issus du texte) reste identique.

Validation via `python3 scripts/ts-sp500-validate.py <TICKER>`.
