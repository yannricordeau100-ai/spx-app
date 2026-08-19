export const meta = {
  name: 'convert-to-v2pipeline',
  description: 'Convertit kpis-haut vers le format quarterly-history.json du vrai pipeline v2',
  phases: [{ title: 'Convert' }],
}

const TICKERS = ["BA", "COF", "AAPL"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'matched_count', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    matched_count: { type: 'integer' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu convertis des donnees KPI historiques vers le format reellement consomme par le site Mettrik.

CONTEXTE: le site lit /Users/yann/spx-app/src/data/v2-pipeline/${t}.json (KPIs avec short codes style "rev_bca", history=tableau de nombres annuel) + un fichier optionnel d'extension /Users/yann/spx-app/src/data/v2-pipeline-enrich/${t.toLowerCase()}.quarterly-history.json qui AJOUTE de l'historique trimestriel.

Nous avons deja extrait un historique trimestriel complet et verifie dans /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json (format {short, name_fr, name_en, history:[{q:"Qn-YYYY" ou "FYYYYY", v:number}], frequency}).

TACHE:
1. Lire les deux fichiers: v2-pipeline/${t}.json (pour recuperer les short codes REELS et la liste des KPIs du site) et kpis-haut/${t}.json (source de donnees).
2. Pour chaque KPI de v2-pipeline/${t}.json, essayer de trouver le KPI correspondant dans kpis-haut/${t}.json par similarite de sens (nom_fr, nom_en, ou segment/produit). Exemple: "rev_bca" (Revenu segment Commercial Airplanes) correspond a un KPI kpis-haut du genre "BCA_REV" ou "Boeing Commercial Airplanes Revenue".
3. Si un match fiable est trouve ET que le kpis-haut a un historique QUARTERLY plus riche/plus long que ce qui existe deja: construire une entree pour le fichier de sortie.
4. Format de sortie (fichier /Users/yann/spx-app/src/data/v2-pipeline-enrich/${t.toLowerCase()}.quarterly-history.json):
{
  "ticker": "${t}",
  "extracted_at": "2026-07-02T00:00:00Z",
  "method": "llm-filing-crosschecked",
  "n_kpis": N,
  "kpis": [
    {
      "short": "<short code EXACT du v2-pipeline>",
      "period_type": "quarter",
      "history": [nombre, nombre, ...],
      "history_periods": ["Q1 2020", "Q2 2020", ...],
      "last_data_date": "YYYY-MM-DD",
      "unit": "<unit du v2-pipeline si connue>"
    }
  ]
}
5. IMPORTANT: "short" DOIT etre EXACTEMENT le short code du fichier v2-pipeline (ex "rev_bca"), PAS le short code de kpis-haut. history_periods au format "Qn YYYY" (avec espace, pas tiret) pour matcher la convention du fichier existant si tu en vois un exemple (regarde s'il existe deja un ${t.toLowerCase()}.quarterly-history.json, imite son format exact).
6. history doit etre trie chronologiquement du plus ancien au plus recent, et l'unite (M$/Mds$) doit etre coherente avec celle du KPI v2-pipeline cible (convertir si necessaire, ex Mds$ vs M$).
7. NE PAS inclure de KPI sans match fiable. Ne jamais inventer de valeur.
8. Si un fichier ${t.toLowerCase()}.quarterly-history.json existe deja avec method="xbrl-companyfacts", NE PAS l'ecraser bêtement: fusionne en gardant les entrees xbrl-companyfacts existantes ET en ajoutant nos nouvelles entrees llm-filing-crosschecked pour les short codes QUI NE SONT PAS DEJA COUVERTS par le fichier existant (le loader n'accepte qu'un seul "method" par fichier donc il faut choisir: si le fichier existant a peu de KPIs, tu peux tout de meme faire un fichier unique avec method="llm-filing-crosschecked" incluant TOUS les KPIs bien matches, y compris ceux dejas dans le fichier xbrl si nos donnees sont au moins aussi bonnes - lire le fichier existant pour comparer la couverture et ne jamais perdre de donnees qui y sont).

Ecris le fichier avec Python (json.dump indent=2 ensure_ascii=False).

Retour: StructuredOutput avec ticker, ok, matched_count (nombre de KPIs matches et inclus dans le fichier de sortie), notes (quels KPIs matches, quels non-matches et pourquoi).`

phase('Convert')
const results = await pipeline(
  TICKERS,
  t => agent(prompt(t), { label: `convert:${t}`, phase: 'Convert', schema: SCHEMA, effort: 'high' })
)

return results.filter(Boolean)
