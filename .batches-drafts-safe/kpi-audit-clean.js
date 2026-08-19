export const meta = {
  name: 'kpi-audit-clean',
  description: 'Audite les tickers non flagges par le scan automatique (verif filing par filing)',
  phases: [{ title: 'Audit' }],
}

const TICKER_NAMES = ["AAPL", "ABBV", "AIG", "AIZ", "AKAM", "ALGN", "ALL", "AMAT", "AMCR", "AMGN", "AMZN", "AOS", "APA", "APD", "APP", "ATO", "AVGO", "AZO", "BA", "BDX", "BIIB", "BKR", "BWA", "BXP", "C", "CAH", "CASY", "CB", "CBOE", "CBRE", "CDW", "CFG", "CHD", "CHRW", "CHTR", "CI", "CIEN", "CINF", "CME", "CMI", "COF", "COHR", "COIN", "COO", "COR", "CPAY", "CPB", "CPRT", "CRL", "CRM", "CSX", "CTAS", "CTSH", "CVS", "CVX", "DAL", "DE", "DG", "DHR", "DIS", "DLTR", "DOC", "DOV", "DOW", "DPZ", "DVA", "DVN", "DXCM", "EA", "EFX", "EL", "ELV", "EME", "EMR", "EOG", "EPAM", "ETN", "EW", "EXE", "FDS", "FDX", "FFIV", "FI", "FICO", "FMC", "FOX", "FOXA", "FRT", "FTNT", "GD", "GE", "GEHC", "GILD", "GIS", "GL", "GNRC", "GOOG", "GOOGL", "GPN", "HAS", "HBAN", "HES", "HIG", "HOLX", "HON", "HPQ", "HRL", "HSY", "HUBB", "HUM", "IBM", "ICE", "IDXX", "IEX", "IFF", "IPG", "IR", "IRM", "ITW", "J", "JBL", "JCI", "JPM", "K", "KEY", "KEYS", "KIM", "KKR", "KMB", "KMI", "KMX", "KO", "L", "LH", "LKQ", "LMT", "LNT", "LOW", "LRCX", "LUV", "LVS", "LW", "LYV", "MAR", "MAS", "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC", "MNST", "MOH", "MPC", "MRK", "MRO", "MSCI", "MSI", "MTCH", "MU", "NCLH", "NEM", "NFLX", "NKE", "NOC", "NSC", "NTRS", "NUE", "NVDA", "NVR", "NWS", "NWSA", "OKE", "ON", "ORLY", "OTIS", "OXY", "PANW", "PAYC", "PEP", "PFG", "PGR", "PH", "PHM", "PLD", "PM", "PNW", "POOL", "PPG", "PRU", "REGN", "RF", "RHI", "RJF", "RMD", "ROK", "ROP", "SHW", "SJM", "SMCI", "SNPS", "SO", "SPG", "SPGI", "SRE", "STE", "STLD", "STT", "STZ", "SWK", "SYF", "SYK", "SYY", "T", "TAP", "TDY", "TECH", "TER", "TFC", "TFX", "TGT", "TMUS", "TPR", "TRGP", "TROW", "TSLA", "TT", "TTWO", "TXN", "UHS", "UNH", "UPS", "URI", "USB", "V", "VFC", "VLO", "VRTX", "VTR", "WAB", "WAT", "WBA", "WBD", "WEC", "WELL", "WFC", "WHR", "WM", "WMB", "WMT", "WRK", "WYNN", "XEL", "ZBRA", "ZTS"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu audites la fiabilite des donnees KPI du ticker ${t}. Ce fichier n'a PAS ete flagge par un scan automatique de corruption (pas de repetition suspecte, pas d'ecart FY/somme, pas de pic isole), mais n'a jamais ete verifie manuellement contre les filings sources.

FICHIER: /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json

FILINGS SOURCE:
- 10-Q: /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz
- 10-K: /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz

TACHE (audit rapide, pas une re-extraction complete):
1. Lire le JSON.
2. Choisir 2 KPIs au hasard dans la liste (des KPIs differents, pas forcement le hero).
3. Pour chacun, choisir 2 periodes au hasard dans son history (une ancienne, une recente).
4. Verifier chaque valeur choisie directement dans le filing source correspondant (zcat + grep).
5. Si une valeur ne correspond pas au filing (erreur reelle detectee): CORRIGER avec la vraie valeur, en citant la phrase exacte du filing. Si la correction touche une seule valeur isolee, verifier aussi 2-3 autres periodes du meme KPI pour voir si la corruption est plus large (meme pattern que les autres tickers deja traites: placeholders repetes, valeurs = annee, pics isoles).
6. Si tout est correct: ne rien modifier.

REGLES STRICTES:
- NE PAS modifier short, name_fr, name_en, value (top-level), unit, yoy, pv_score, signal
- JAMAIS inventer une valeur
- Si tu detectes une valeur suspecte non verifiable dans les filings locaux: la retirer plutot que la laisser fausse
- Ecrire le JSON corrige via python3 (json.dump indent=2 ensure_ascii=False) UNIQUEMENT si une correction a ete faite

Retour: StructuredOutput avec ticker, ok (true si audit fait, que corrige ou confirme propre), notes (quels KPIs/periodes verifies, resultat, corrections faites le cas echeant).`

phase('Audit')
const results = await pipeline(
  TICKER_NAMES,
  t => agent(prompt(t), { label: `audit:${t}`, phase: 'Audit', schema: SCHEMA, effort: 'medium' })
)

return results.filter(Boolean)
