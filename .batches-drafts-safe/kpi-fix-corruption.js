export const meta = {
  name: 'kpi-fix-corruption',
  description: 'Corrige les valeurs corrompues/placeholder detectees dans kpis-haut',
  phases: [{ title: 'Fix' }],
}

const TICKER_NAMES = ["ZBH", "XOM", "MO", "WDC", "WST", "MA", "XYL", "VST", "YUM", "TRV", "VZ", "WY", "VTRS", "TXT", "MMM", "MDT", "WTW"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu corriges des valeurs CORROMPUES (pas des trous) dans l'historique KPI du ticker ${t}.

FICHIER: /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json

PROBLEMES DETECTES: lis la liste avec Bash:
python3 -c "import json; d=json.load(open('/Users/yann/spx-app/.batches-drafts-safe/corruption_final.json')); print('\\n'.join(d['${t}']))"

Types de problemes:
- "valeurs identiques repetees" = plusieurs trimestres consecutifs ont EXACTEMENT la meme valeur, signe de placeholder/donnee non extraite correctement (souvent un nombre suspect comme une annee: 120.0, 2016.0, 2017.0, 9.0, 2.0)
- "FY != somme Q1-Q4" = incoherence arithmetique forte (>5%) entre le cumul annuel et la somme des 4 trimestres, signe d'un trimestre faux
- "pic isole" = une valeur trimestrielle demesuree par rapport a ses voisins (>5x), signe d'une erreur d'extraction (mauvaise colonne/unite)

FILINGS SOURCE:
- 10-Q: /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz
- 10-K: /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz

METHODE (prends ton temps, ne va pas vite):
1. Lire le JSON actuel.
2. Pour chaque probleme signale, identifier le(s) trimestre(s) suspect(s) et re-verifier leur valeur directement dans le filing source correspondant (zcat + grep).
3. Si la valeur du filing differe de celle du JSON: CORRIGER (remplacer par la vraie valeur) UNIQUEMENT apres avoir localise la phrase/tableau exact du filing qui la donne. Ne jamais deviner ou approximer une valeur de remplacement.
4. Si la valeur du filing confirme celle du JSON (donc pas d'erreur, faux positif du detecteur): laisser tel quel.
5. Si une valeur ne peut pas etre re-verifiee dans les filings locaux disponibles: la retirer du history plutot que de laisser une donnee non fiable (ne jamais laisser un placeholder connu comme 120.0/2016.0/2017.0/9.0/2.0 repete).
6. VERIFICATION CROISEE OBLIGATOIRE avant d'ecrire: pour toute valeur ajoutee/corrigee, relis une deuxieme fois le passage du filing cite et confirme que le chiffre, l'unite (M$/Mds$/%) et la periode (trimestre exact, pas un trimestre voisin) correspondent exactement. Une correction qui remplace une erreur par une autre erreur est pire que ne rien faire: en cas de doute reel sur la lecture du filing, NE PAS corriger, retirer la valeur douteuse et le signaler dans notes comme "incertain, a verifier manuellement" plutot que d'inventer une correction.
7. Ecrire le JSON corrige via python3 (json.dump indent=2 ensure_ascii=False).

REGLES STRICTES:
- NE PAS modifier short, name_fr, name_en, value (le champ top-level "value"), unit, yoy, pv_score, signal
- JAMAIS inventer une valeur non trouvee dans un filing
- Trier chronologiquement, pas de doublons apres correction
- Priorite a la justesse des donnees sur la completude (mieux vaut retirer une valeur fausse que la garder)

Retour: StructuredOutput avec ticker, ok (true si tous les problemes traites, corriges ou confirmes faux positifs), notes (resume des corrections faites, des faux positifs confirmes, et des valeurs retirees par prudence).`

phase('Fix')
const results = await pipeline(
  TICKER_NAMES,
  t => agent(prompt(t), { label: `fixcorrupt:${t}`, phase: 'Fix', schema: SCHEMA, effort: 'medium' })
)

return results.filter(Boolean)
