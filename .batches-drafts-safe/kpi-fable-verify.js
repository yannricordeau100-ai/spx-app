export const meta = {
  name: 'kpi-fable-verify',
  description: 'Verification integrale + reconstruction des KPI kpis-haut contre les filings (methode NVDA)',
  phases: [{ title: 'Verify' }],
}

// BATCH: remplacer cette liste entre chaque lot.
const TICKER_NAMES = ["ABBV", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM", "ALGN", "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP", "AMT", "AMZN", "ANET", "AON", "AOS", "APA", "APD", "APH", "APO", "APP", "APTV", "ARE", "ARES", "ATO", "AVB", "AVGO", "AVY", "AWK", "AXON", "AXP", "AZO", "BA", "BAC", "BALL", "BAX", "BBY", "BDX", "BEN", "BF.B", "BG", "BIIB", "BK", "BKNG", "BKR", "BLDR", "BLK", "BMY", "BR", "BRK.B", "BRO", "BSX", "BWA", "BX", "BXP", "C", "CAG", "CAH", "CARR", "CASY", "CAT", "CB", "CBOE", "CBRE", "CCI", "CCL", "CDNS", "CDW", "CEG", "CF", "CFG", "CHD", "CHRW", "CHTR", "CI", "CIEN", "CINF", "CL", "CLX", "CMCSA", "CME", "CMG", "CMI", "CMS", "CNC", "CNP", "COF", "COHR", "COIN", "COO", "COP", "COR", "COST", "CPAY", "CPB", "CPRT", "CPT", "CRH", "CRL", "CRM", "CRWD", "CSCO", "CSGP", "CSX", "CTAS", "CTSH", "CTVA", "CVNA", "CVS", "CVX", "D", "DAL", "DASH", "DD"]

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'rebuilt_kpis', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    rebuilt_kpis: { type: 'integer' },
    notes: { type: 'string' },
  },
}

const prompt = (t) => `Tu verifies INTEGRALEMENT (pas par echantillon) l'historique KPI de ${t} contre les filings SEC locaux, et tu reconstruis tout KPI douteux. Contexte: sur NVDA, un audit par echantillon avait valide un fichier dont 75% des valeurs etaient fausses. Plus jamais ca.

FICHIER: /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/${t}.json
FILINGS: /Users/yann/Mettrik/docs/${t}/10-Q/*.htm.gz et /Users/yann/Mettrik/docs/${t}/10-K/*.htm.gz (lire via gunzip -c, certains zcat echouent sur macOS)

ETAPE 0 - LABELS FISCAUX (CRITIQUE, bug detecte par Yann sur l'affichage annuel):
- Verifie si ${t} a une annee fiscale decalee (fin != decembre) en regardant les dates de cloture dans un 10-K ("fiscal year ended <mois> ...").
- Si OUI: chaque label trimestriel DOIT etre au format explicite "Qn-FYxxxx" ou n et xxxx sont le trimestre et l'annee FISCAUX de la ste (ex: un trimestre clos en janvier 2024 chez une ste cloturant fin octobre = Q1-FY2024). Les labels ambigus "Qn-yyyy" sur une ste fiscale decalee sont MAL interpretes par l'UI (traites comme calendaires) -> relabellise-les correctement en verifiant la date de cloture de chaque trimestre dans son filing source.
- Si NON (cloture decembre): labels "Qn-yyyy" calendaires.
- Fichier d'issues UI deja detectees a traiter en priorite s'il contient ${t}: /Users/yann/spx-app/.batches-drafts-safe/ui_issues.json

ETAPE 1 - INVARIANTS ARITHMETIQUES (sur tout le fichier, en python, sans lire les filings):
- Pour chaque KPI de type flux (revenue/volume/earnings segment) avec des trimestres ET des FY de la meme annee: FY = Q1+Q2+Q3+Q4 a 2% pres.
- Series avec >=3 valeurs identiques consecutives, valeurs = annee (2016.0, 2021.0...), placeholders (120.0, 8217.0, 9.0, 2.0 repetes), pics isoles >5x voisins, sauts d'unite (valeurs melangees M$/Mds$).
- Croissance incoherente avec la realite connue de la ste.

ETAPE 2 - VERIFICATION FILINGS (obligatoire meme si etape 1 est propre):
- Pour CHAQUE KPI: verifier au moins 4 valeurs reparties (la plus ancienne, deux au milieu, la plus recente) directement dans le filing source correspondant. Chercher le tableau/la phrase exacte.
- Si UNE valeur est fausse -> considerer le KPI comme corrompu et RECONSTRUIRE TOUTE sa serie depuis les filings (chaque trimestre relu, Q4 derive par FY-somme(9M) pour les flux si non publie).

ETAPE 3 - RECONSTRUCTION (pour chaque KPI corrompu):
- Relire chronologiquement les filings, extraire la vraie valeur de chaque periode.
- Labels: "Qn-YYYY" calendaire ou "Qn-FYxxxx" si fiscal decale (garder la convention deja utilisee dans le fichier), "FYxxxx" pour les annuels.
- Re-verifier l'invariant FY = somme apres reconstruction.
- Si un KPI est impossible a reconstruire depuis les filings locaux (donnee jamais publiee, segment disparu): vider son history et le noter, plutot que laisser du faux.

ETAPE 4 - ECRITURE:
- Ne modifier QUE history et frequency (+ un champ notes par KPI si utile). Jamais short/name_fr/name_en/value/unit/yoy/pv_score/signal.
- History triee CHRONOLOGIQUEMENT par (annee, trimestre) numeriques, jamais alphabetiquement.
- json.dump indent=2 ensure_ascii=False.

REGLES: jamais inventer; justesse > completude > vitesse. Chaque valeur ecrite doit exister dans un filing ou etre une soustraction arithmetique de valeurs qui y existent.

Retour: StructuredOutput avec ticker, ok, rebuilt_kpis (nombre de KPIs reconstruits), notes (verdict par KPI: OK verifie / reconstruit (pourquoi) / vide (pourquoi)).`

phase('Verify')
const results = await pipeline(
  TICKER_NAMES,
  t => agent(prompt(t), { label: `fverify:${t}`, phase: 'Verify', schema: SCHEMA, effort: 'medium' })
)

return results.filter(Boolean)
