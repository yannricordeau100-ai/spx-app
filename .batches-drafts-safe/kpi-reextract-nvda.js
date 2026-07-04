export const meta = {
  name: 'kpi-reextract-nvda',
  description: 'Re-extraction complete NVDA depuis tous les 10-Q/10-K (5+ ans)',
  phases: [{ title: 'Extract' }],
}

const SCHEMA = {
  type: 'object',
  required: ['ticker', 'ok', 'notes'],
  properties: {
    ticker: { type: 'string' },
    ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

const prompt = `Tu re-extrais INTEGRALEMENT l'historique KPI de NVDA depuis les filings SEC locaux. L'historique actuel est suspect (Yann signale des incoherences avec les chiffres publies par NVIDIA : CA x10 en quelques annees non reflete).

FICHIER CIBLE: /Users/yann/spx-app/.batches-drafts-safe/kpis-haut/NVDA.json
FILINGS: /Users/yann/Mettrik/docs/NVDA/10-Q/*.htm.gz et /Users/yann/Mettrik/docs/NVDA/10-K/*.htm.gz

CONTEXTE FISCAL NVDA: annee fiscale se termine fin janvier. FY2026 = fev 2025 - jan 2026. Convention labels: "Qn-FYxxxx" pour les trimestres fiscaux, "FYxxxx" pour les annuels.

TACHE:
1. Lire le JSON actuel (garde les memes KPIs/shorts/name_fr/name_en/value/unit/yoy/pv_score/signal, tu ne re-extrais QUE history et frequency).
2. Lister TOUS les 10-Q et 10-K disponibles.
3. Pour CHAQUE filing (du plus ancien au plus recent, minimum 5 ans de couverture, ideallement tout), lire le contenu (gunzip -c | python parsing, tables segment "Data Center", "Gaming", "Professional Visualization", "Automotive", "OEM", "Compute & Networking", "Graphics", gross margin, revenue by geography China).
4. Reconstruire l'history COMPLET de chaque KPI: chaque valeur relue directement dans le filing correspondant, en M$ coherent avec le champ unit existant. Trimestres: valeur du trimestre seul (three months ended). Q4 fiscal absent des 10-Q: deriver par FY(10-K) - somme(Q1+Q2+Q3) pour les flux.
5. VERIFICATION OBLIGATOIRE avant ecriture: pour chaque KPI, verifier que FY = somme des 4 trimestres fiscaux (flux) a 1% pres. Verifier que la croissance Data Center reflete la realite publique (de ~3 Mds$/trim en FY2023 a ~40+ Mds$/trim en FY2026). Si un chiffre parait aberrant, relire le filing une deuxieme fois.
6. Ecrire le JSON via python3 (json.dump indent=2 ensure_ascii=False). History triee chronologiquement (attention: Q1-FY2022 < Q2-FY2022 < ... ordre fiscal, pas alphabetique - utilise une cle de tri (fy, q) numerique).

REGLES:
- JAMAIS inventer une valeur. Non trouve = absent.
- Chaque valeur citee doit exister textuellement dans un filing (ou etre une soustraction arithmetique de valeurs citees).
- Prends ton temps, la justesse prime sur la vitesse.

Retour: StructuredOutput avec ticker, ok, notes (KPIs reconstruits, nb periodes chacun, verifications FY=somme faites, ecarts eventuels avec l'ancien fichier).`

phase('Extract')
const result = await agent(prompt, { label: 'reextract:NVDA', phase: 'Extract', schema: SCHEMA, effort: 'high' })
return result
