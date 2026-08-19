export const meta = {
  name: 'kpi-history-full',
  description: 'Extraction historique KPI complet 118 tickers restants',
  phases: [{ title: 'Extract' }],
}

const TICKERS = ["SO","STT","SWK","SYF","SYK","SYY","T","SRE","TAP","TECH","TER","TFC","TPR","SBUX","TSN","TT","TYL","UAL","UHS","STZ","URI","USB","V","TDY","VICI","VMC","VRTX","VRSK","VTR","WAT","UPS","WBD","WEC","WELL","WM","WRB","WST","WYNN","XOM","XEL","VST","ROL","STLD","SMCI"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'max_periods', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    max_periods: { type: 'integer' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu es un extracteur de KPIs depuis filings SEC. Ticker: ${t}.

TACHE: mettre a jour le fichier /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json en remplissant le champ 'history' de CHAQUE KPI avec TOUS les trimestres disponibles dans les filings locaux.

FICHIERS SOURCE:
- 10-Q: /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz
- 10-K: /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz

METHODE (autonome):
1. Lire le JSON actuel avec Read.
2. Lister tous les filings via Bash: ls -1 /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz && ls -1 /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz
3. Pour chaque filing (du plus ancien au plus recent), lire les 40000 premiers caracteres: zcat <fichier> 2>/dev/null | head -c 40000
   - Identifier le trimestre ("Three months ended March 31, 2022" -> Q1-2022, etc.). Fiscal decale = utiliser convention Qn-FYxxxx.
   - Pour chaque KPI du JSON, chercher sa valeur (par short/name_en/synonymes financiers evidents) et extraire la valeur numerique.
4. Construire history complet par KPI, trie chronologique, sans doublons.
5. Ecrire le JSON mis a jour via Python:
python3 <<'PY'
import json
p = '/Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json'
d = json.load(open(p))
# Modifier d['kpis'][i]['history'] et d['kpis'][i]['frequency']
json.dump(d, open(p,'w'), indent=2, ensure_ascii=False)
PY

REGLES STRICTES:
- NE PAS modifier short, name_fr, name_en, value, unit, yoy, pv_score, signal
- SEULS history et frequency sont mis a jour
- JAMAIS inventer une valeur non trouvee dans le filing
- Si un KPI n'apparait que dans les 10-K -> frequency="annual", format {"q":"FYxxxx","v":N}
- Si un KPI apparait dans les 10-Q -> frequency="quarterly", format {"q":"Qn-YYYY","v":N}
- Si aucune valeur trouvee pour un KPI dans aucun filing -> laisser history=[] et signaler dans notes
- Ne pas ecraser un history plus long par un plus court
- CONTINUITE: viser une couverture SANS trou. Si un KPI est quarterly, chaque trimestre entre le premier et le dernier filing dispo doit etre rempli si la donnee existe dans le filing correspondant. Si un trimestre est absent du filing source (ex: KPI introduit plus tard), c'est normal, ne pas inventer.

FILINGS trop nombreux? Priorise couverture large: lire au moins 15 10-Q + tous les 10-K. Si limite de contexte, sample 1 sur 2 mais couvre toute la periode dispo.

Retour: appeler StructuredOutput avec ticker, ok (true si au moins 1 KPI a un history >= 8), max_periods (max des len(history) sur tous les KPIs finaux), notes (breve description problemes rencontres).`

phase('Extract')
const results = await pipeline(
  TICKERS,
  t => agent(prompt(t), { label: `extract:${t}`, phase: 'Extract', schema: SCHEMA, effort: 'high' })
)

return results.filter(Boolean)
