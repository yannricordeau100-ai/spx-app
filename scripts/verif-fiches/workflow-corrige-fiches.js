export const meta = {
  name: 'corrige-fiches',
  description: 'Correction societe par societe des points confirmes de la relecture, puis controle sceptique des modifications',
  phases: [{ title: 'Correction' }, { title: 'Controle' }],
}
const S = '/Users/yann/spx-app/docs/cahier/_lots/verif-30sept'
const LOG = { type: 'object', properties: { ticker: { type: 'string' }, actions: { type: 'array', items: { type: 'object', properties: {
  point: { type: 'string' }, action: { type: 'string', enum: ['corrige', 'retire', 'non_corrige', 'point_infonde'] }, fichier: { type: 'string' }, detail: { type: 'string' } }, required: ['point', 'action', 'fichier', 'detail'] } } }, required: ['ticker', 'actions'] }
const CTL = { type: 'object', properties: { ok: { type: 'boolean' }, fichiers_a_annuler: { type: 'array', items: { type: 'string' } }, motif: { type: 'string' } }, required: ['ok', 'fichiers_a_annuler', 'motif'] }
const tickers = JSON.parse(await agent(`Lis ${args.tickers_file} et renvoie son contenu JSON brut, rien d autre.`, { label: 'lecture', effort: 'low' }))
log(`${tickers.length} societes a corriger`)
const corrige = (t) => agent(`Societe ${t} du site Mettrik AI (depot ~/spx-app). Points a traiter : ${S}/points/${t}.json (releves par une relecture, la plupart confirmes par une contre-expertise ; ceux avec confirmations=0 ne sont PAS confirmes : verifie-les toi meme avant d agir).
Donnees servies de la fiche (copie du chargeur, lecture seule) : /tmp/fiches/${t}.json. Les FICHIERS SOURCES a modifier sont, selon le bloc : .batches-drafts-safe/kpis-haut/${t}.json (KPI prioritaires), src/data/v2-pipeline/<t minuscule>.json (base : KPI, repartitions, gouvernance, positions de marche), src/data/v2-pipeline-enrich/<t minuscule>*.json, src/data/v2-pipeline-specific-kpis/<t minuscule>.json, src/data/kpi-annuel-fiche/${t}.json, docs/cahier/clients/${t}.json, docs/cahier/tam/${t}.json, src/data/these/<t minuscule>.json, src/data/att/<t minuscule>.json. Retrouve le KPI par son champ short (grep). Documents officiels : ~/spx-app/data-lake/${t}/ (10K, 10Q, 8K, ir/...) en .gz : gunzip + retrait des balises avec python3, ne charge jamais un document entier dans ton contexte.
Regles :
1. Jamais de valeur inventee ou estimee : toute valeur ajoutee ou corrigee vient d un document et tu la cites dans le detail.
2. Une serie jugee invraisemblable ou fausse par la relecture ET confirmee par toi (deux constats) est RETIREE si tu ne peux pas la corriger avec certitude.
3. yoy : pourcentage pour une grandeur, points (suffixe pp) pour un pourcentage ; signal regenere depuis la serie si le chiffre cite ne correspond plus.
4. Modifie les fichiers avec python3 en conservant leur mise en forme (charge, modifie, reecris avec la meme indentation) et verifie qu ils restent du JSON valide. Ne touche jamais src/data/companies/wkl.as.json, ne fais aucun commit, ne modifie aucune autre societe.
5. Textes en francais, sans tiret long, sans nom de document ni de table dans les textes visibles.
Renvoie une action par point : corrige, retire, non_corrige (dis pourquoi : document absent, decision du proprietaire...) ou point_infonde.`, { label: `corrige:${t}`, phase: 'Correction', schema: LOG })
const controle = async (r, t) => {
  if (!r) return { ticker: t, actions: [], controle: null }
  const modifs = r.actions.filter((a) => a.action === 'corrige' || a.action === 'retire')
  if (!modifs.length) return { ...r, controle: { ok: true, fichiers_a_annuler: [], motif: 'rien de modifie' } }
  const c = await agent(`Controle sceptique des modifications faites sur la societe ${t} dans ~/spx-app. Lance \`git -C ~/spx-app diff -- <fichiers>\` sur les fichiers suivants : ${[...new Set(modifs.map((a) => a.fichier))].join(', ')}. Journal des actions : ${JSON.stringify(modifs).slice(0, 6000)}
Verifie pour chaque modification : valeur conforme au document cite (data-lake/${t}, gunzip + python3, passages utiles seulement), unite et periode justes, JSON valide, aucune autre societe touchee, aucune donnee utile supprimee a tort, aucun tiret long ni nom de document dans un texte visible. Renvoie ok=false et la liste des fichiers a annuler au moindre defaut. Ne modifie aucun fichier.`, { label: `controle:${t}`, phase: 'Controle', schema: CTL })
  return { ...r, controle: c }
}
const res = await pipeline(tickers, corrige, controle)
return res.filter(Boolean)