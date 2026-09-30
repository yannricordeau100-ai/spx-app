export const meta = {
  name: 'verif-fiches-mettrik',
  description: 'Relecture exigeante des 662 fiches societes Mettrik par lots de 6, contre-expertise sceptique, synthese',
  phases: [
    { title: 'Relecture', detail: 'un agent par lot de 6 societes, lit les extraits et les fiches servies' },
    { title: 'Contre-expertise', detail: 'un sceptique par lot (exactitude et utilite)' },
    { title: 'Synthese', detail: 'classement des points confirmes' },
  ],
}
const S = '/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad'
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      ticker: { type: 'string' }, bloc: { type: 'string' }, champ: { type: 'string' },
      probleme: { type: 'string' }, preuve: { type: 'string' }, correction: { type: 'string' },
      auto: { type: 'boolean' }, gravite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
      confiance: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
    }, required: ['ticker', 'bloc', 'champ', 'probleme', 'preuve', 'correction', 'auto', 'gravite', 'confiance'] } },
    remarque_generale: { type: 'string' },
  },
  required: ['findings', 'remarque_generale'],
}
const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: { type: 'array', items: { type: 'object', properties: {
      index: { type: 'number' }, reel: { type: 'boolean' }, motif: { type: 'string' }, correction_validee: { type: 'string' },
    }, required: ['index', 'reel', 'motif', 'correction_validee'] } },
  },
  required: ['verdicts'],
}
const batches = args.batches
log(`${batches.length} lots`)

const relire = (lot) => agent(`Tu relis ${lot.length} fiches de societes du site Mettrik AI (donnees KPI pour investisseurs, en francais) : ${lot.join(', ')}.
Pour chaque societe, lis d abord le fichier ${S}/extraits/<TICKER>.txt (texte visible compact : en-tete, gouvernance, risques, repartition, positionnement IA, these, anti-these, moat, clients, positions de marche, chaque KPI avec ses 8 derniers points, son signal et sa description, la description Mettrik). Si tu as besoin de la donnee complete (serie entiere, autres champs), interroge ${S}/fiches/<TICKER>.json avec python3 ou jq en n extrayant que les champs utiles : ne charge jamais un fichier JSON entier dans ton contexte.
Cherche ce qu un investisseur exigeant remarquerait :
- valeurs invraisemblables (ordre de grandeur incompatible avec l unite, signe, saut d echelle x1000, pourcentage impossible) ;
- incoherence entre le signal ou la description d un KPI et sa serie (chiffre cite different, sens de variation faux, periode fausse) ;
- textes perimes : signal, description, moat, these, anti-these, positionnement IA, clients, positions de marche qui s arretent en 2022-2024 alors que des chiffres plus recents existent sur la fiche ;
- textes en anglais, textes de modele de langage, cuisine interne, mentions de documents ou de sources dans un bloc ;
- doublons : meme indicateur sous deux noms, ou en annuel et en trimestriel ;
- noms de KPI peu clairs ou faux pour ce que mesure la serie ; unite fausse ;
- moat, these, anti-these, positionnement IA generiques, contradictoires entre eux ou contredits par les chiffres ;
- description Mettrik inexacte ou trop vague ; repartition du chiffre d affaires incoherente ;
- indicateur d industrie evident pour le secteur qui manque (dis lequel) ;
- tout ce qui ferait perdre confiance a un investisseur qui connait deja les chiffres de base (CA, benefice) et vient chercher les KPI operationnels.
Ne repete pas les points deja detectes mecaniquement (listes a la fin de chaque extrait). Aucune recherche web, aucun navigateur, ne modifie aucun fichier.
Sois exigeant mais precis : 0 a 12 points par societe, uniquement ce qui est reellement problematique, chacun avec sa preuve (extrait exact, chiffres). Pour chaque point, auto=true si la correction est mecanique et sure (supprimer un doublon exact, corriger une unite evidente, retirer une phrase), auto=false si elle demande une decision du proprietaire ou une recherche. Pas de tiret long dans tes textes. Termine par une remarque generale sur la qualite de ces fiches (deux phrases).`, { label: `relecture:${lot[0]}`, phase: 'Relecture', schema: FINDINGS })

const verifier = async (res, lot) => {
  if (!res || !res.findings || res.findings.length === 0) return { lot, findings: [], remarque: res ? res.remarque_generale : 'sans reponse' }
  // Seuls les points a consequence (gravite haute ou correction automatique) passent en contre-expertise.
  const aVerifier = res.findings.map((f, i) => ({ f, i })).filter((x) => x.f.gravite === 'haute' || x.f.auto)
  if (aVerifier.length === 0) return { lot, findings: res.findings.map((f) => ({ ...f, votes: 0, confirmations: 0, motifs: [], correction_validee: f.correction })), remarque: res.remarque_generale }
  const liste = aVerifier.map(({ f, i }) => `#${i} [${f.ticker}] ${f.bloc} / ${f.champ} : ${f.probleme} | preuve : ${f.preuve} | correction : ${f.correction} | auto=${f.auto}`).join('\n')
  const votes = await parallel([() => agent(`Contre-expertise sceptique, deux angles a la fois : EXACTITUDE (le probleme existe-t-il tel que decrit dans les donnees, et la correction proposee est-elle juste ?) et UTILITE (un investisseur qui lit la fiche verrait-il ce point et serait-il gene ? un detail invisible, une preference de style ou un point deja couvert par les detections mecaniques est refute).
Societes : ${lot.join(', ')}. Donnees : ${S}/extraits/<TICKER>.txt et ${S}/fiches/<TICKER>.json (interroge avec python3 ou jq, n extrais que les champs utiles). Aucune recherche web, aucun navigateur, ne modifie aucun fichier.
Points a verifier :
${liste}
Pour chaque point (index), reponds reel=true seulement si tu es certain qu il est fonde sur les deux angles ; sinon reel=false avec le motif. Donne la correction validee (ou corrigee) en une phrase. Pas de tiret long.`, { label: `verif:${lot[0]}`, phase: 'Contre-expertise', schema: VERDICTS, effort: 'medium' })])
  const findings = res.findings.map((f, i) => {
    const v = votes.filter(Boolean).map((r) => (r.verdicts || []).find((x) => x.index === i)).filter(Boolean)
    const oui = v.filter((x) => x.reel).length
    return { ...f, votes: v.length, confirmations: oui, motifs: v.map((x) => x.motif), correction_validee: (v.find((x) => x.reel) || {}).correction_validee || f.correction }
  })
  return { lot, findings, remarque: res.remarque_generale }
}

const resultats = await pipeline(batches, relire, verifier)
const tous = resultats.filter(Boolean).flatMap((r) => r.findings)
const confirmes = tous.filter((f) => f.confirmations >= 1)
log(`${tous.length} points releves, ${confirmes.length} confirmes par le sceptique`)

phase('Synthese')
const synth = await agent(`Voici les points confirmes (au moins un sceptique) de la relecture des fiches Mettrik AI, au format JSON :
${JSON.stringify(confirmes.map((f) => ({ t: f.ticker, b: f.bloc, c: f.champ, p: f.probleme, corr: f.correction_validee, auto: f.auto, g: f.gravite, ok: f.confirmations })), null, 0).slice(0, 180000)}
Remarques generales des relecteurs : ${resultats.filter(Boolean).map((r) => r.remarque).join(' | ').slice(0, 12000)}
Produis en francais, sans tiret long, une synthese courte : 1) familles de problemes avec le nombre de fiches touchees et 3 exemples chacune ; 2) ce qui est corrigeable mecaniquement sans risque ; 3) ce qui demande une decision du proprietaire (avec une recommandation A/B) ; 4) les points notables pour l ouverture du site au public (des investisseurs qui connaissent deja CA et benefice et viennent chercher les KPI operationnels) ; 5) les 3 questions de fond que tu poserais au proprietaire. Ne modifie aucun fichier.`, { label: 'synthese', phase: 'Synthese' })
return { total: tous.length, confirmes: confirmes.length, deux_votes: tous.filter((f) => f.confirmations === 2).length, findings: tous, synthese: synth }