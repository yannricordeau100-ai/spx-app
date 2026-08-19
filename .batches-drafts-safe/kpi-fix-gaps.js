export const meta = {
  name: 'kpi-fix-gaps',
  description: 'Corrige les trous de continuite detectes sur les KPIs',
  phases: [{ title: 'Fix' }],
}

const TICKER_NAMES = ["AES", "AFL", "AIG", "AJG", "ALGN", "ALLE", "AMAT", "AMD", "AME", "AMT", "ANET", "AON", "APTV", "AVB", "AVGO", "AVY", "AWK", "AXP", "AZO", "BA", "BAX", "BBY", "BG", "BKR", "BLDR", "BLK", "BRO", "BWA", "BX", "CASY", "CB", "CBRE", "CCI", "CCL", "CDNS", "CHRW", "CIEN", "CL", "CLX", "CMCSA", "CMG", "CMI", "CMS", "CNC", "CNP", "COIN", "COP", "COST", "CRH", "CRWD", "CSCO", "CSGP", "CSX", "CTAS", "CTSH", "CVNA", "CVS", "CVX", "D", "DAL", "DASH", "DDOG", "DECK", "DELL", "DG", "DGX", "DHI", "DHR", "DIS", "DLR", "DOC", "DOW", "DPZ", "DRI", "DVA", "DVN", "DXCM", "ECL", "ED", "EFX", "EG", "EIX", "EL", "EOG", "EQIX", "ES", "ESS", "ETR", "EW", "EXPD", "EXPE", "EXR", "F", "FANG", "FAST", "FCX", "FDS", "FDX", "FI", "FICO", "FITB", "FMC", "FOX", "FOXA", "FTV", "GE", "GEN", "GIS", "GLW", "GOOGL", "GPC", "GS", "GWW", "HAL", "HBAN", "HCA", "HD", "HES", "HIG", "HII", "HLT", "HON", "HPE", "HPQ", "HSIC", "HST", "IBM", "ICE", "IEX", "IFF", "INTC", "INVH", "IPG", "IR", "IRM", "ISRG", "ITW", "IVZ", "JBHT", "JCI", "JKHY", "JNJ", "JPM", "KDP", "KEY", "KEYS", "KHC", "KKR", "KMB", "KMI", "KMX", "KO", "KR", "L", "LDOS", "LEN", "LH", "LIN", "LKQ", "LLY", "LMT", "LNT", "LRCX", "LULU", "LVS", "LW", "MA", "MAA", "MAR", "MCD", "MCHP", "MCK", "MCO", "MDLZ", "MDT", "MGM", "MKC", "MLM", "MMC", "MMM", "MNST", "MO", "MOH", "MPC", "MPWR", "MRK", "MRNA", "MS", "MTB", "MTCH", "MTD", "NCLH", "NEM", "NFLX", "NI", "NKE", "NOC", "NRG", "NTAP", "NTRS", "NUE", "NWS", "NWSA", "O", "ODFL", "OKE", "OMC", "ORLY", "OTIS", "PAYC", "PAYX", "PCAR", "PEP", "PFG", "PG", "PGR", "PHM", "PKG", "PM", "PNC", "PNR", "PPG", "PSA", "PSX", "PWR", "PYPL", "QCOM", "REG", "RF", "RHI", "RMD", "ROL", "ROP", "ROST", "RSG", "RTX", "RVTY", "SBUX", "SHW", "SJM", "SLB", "SMCI", "SNA", "SNPS", "SO", "STLD", "STZ", "SWKS", "SYK", "SYY", "T", "TDG", "TDY", "TEL", "TER", "TFC", "TGT", "TJX", "TMO", "TMUS", "TRGP", "TRMB", "TROW", "TRV", "TSCO", "TSLA", "TSN", "TXT", "TYL", "UAL", "UDR", "ULTA", "UNH", "UNP", "URI", "USB", "V", "VFC", "VLO", "VMC", "VRSN", "VST", "VTR", "VTRS", "VZ", "WBD", "WDC", "WEC", "WELL", "WFC", "WHR", "WM", "WMT", "WRB", "WST", "WTW", "WY", "XOM", "XYL", "YUM", "ZBH", "ZBRA"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu corriges des trous de continuite dans l'historique KPI du ticker ${t}.

FICHIER: /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json

TROUS DETECTES: lis la liste avec Bash:
python3 -c "import json; d=json.load(open('/Users/yann/spx-app/.batches-drafts-safe/gaps_final.json')); print('\\n'.join(d['${t}']))"

La majorite des trous sont du type "entre Q3-YYYY et Q1-YYYY+1": cela signifie que Q4-YYYY manque. Pour ce cas precis, Q4 se calcule generalement par: valeur FY (10-K) moins somme(Q1+Q2+Q3) si le KPI est un flux (revenue, volume) - sinon si c'est un ratio/stock (marge %, NIM, AUM period-end) chercher directement la valeur Q4/FY dans le 10-K ou 10-Q suivant.

FILINGS SOURCE:
- 10-Q: /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz
- 10-K: /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz

METHODE:
1. Lire le JSON actuel.
2. Pour chaque trou signale, identifier le(s) filing(s) correspondant au(x) trimestre(s)/annee(s) manquant(s) (ex: trou entre Q3-2020 et Q1-2021 = chercher Q4-2020 ou FY2020 dans les 10-Q/10-K).
3. zcat le filing concerne, chercher la valeur du KPI (par short/name_en).
4. Si trouve: ajouter l'entree manquante dans history, trie chronologiquement.
5. Si la donnee n'existe genuinement pas dans les filings (segment pas encore cree, metrique introduite plus tard, filing non deplose cette periode) : NE PAS inventer, laisser le trou tel quel et le signaler dans notes comme "trou reel, non comblable".
6. Ecrire le JSON mis a jour via python3 (json.load/json.dump, indent=2, ensure_ascii=False).

REGLES STRICTES:
- NE PAS modifier short, name_fr, name_en, value, unit, yoy, pv_score, signal
- JAMAIS inventer de valeur
- Ne pas casser les entrees deja correctes
- Trier chronologiquement, pas de doublons

Retour: StructuredOutput avec ticker, ok (true si tous les trous combles ou confirmes reels), notes (quels trous combles, lesquels restent reels et pourquoi).`

phase('Fix')
const results = await pipeline(
  TICKER_NAMES,
  t => agent(prompt(t), { label: `fix:${t}`, phase: 'Fix', schema: SCHEMA, effort: 'medium' })
)

return results.filter(Boolean)
