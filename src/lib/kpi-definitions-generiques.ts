/**
 * Définitions génériques des KPI récurrents (Yann 30 août 2026).
 *
 * Constat : 35 789 KPI rendus sur 35 949 n'avaient AUCUNE définition dans le
 * tooltip "i" (screen KO "Effet prix/mix" : panneau DÉFINITION vide). Le
 * public visé est un investisseur particulier : chaque indicateur doit être
 * compréhensible sans bagage comptable.
 *
 * Ce module fournit un repli SERVEUR : quand `kpi.explanation` est vide, le
 * loader pose une définition pédagogique déduite du nom. Les patterns sont
 * testés DANS L'ORDRE : mettre les plus spécifiques en premier. Les KPI trop
 * spécifiques (produits, marques) restent sans repli et seront complétés par
 * le batch nocturne dédié.
 *
 * Règles d'écriture : 1 à 2 phrases, pas de jargon non expliqué, pas de
 * tiret cadratin, vocabulaire FR (CLAUDE.md §6).
 */

const DEFS: Array<[RegExp, string]> = [
  // Ultra-specifiques testes en premier (sinon un pattern large les capte)
  [/marge nette d.int[ée]r[eê]t|\bnim\b/i, "Écart entre ce que la banque gagne sur ses prêts et ce qu'elle paie sur les dépôts. C'est le cœur de la rentabilité bancaire."],
  // --- Marges et rentabilité -------------------------------------------------
  [/marge (nette|net)/i, "Part du chiffre d'affaires qui reste en bénéfice une fois toutes les charges payées (impôts compris). Plus elle est haute, plus l'entreprise transforme ses ventes en profit."],
  [/marge brute/i, "Ce qui reste du chiffre d'affaires après le coût direct des produits ou services vendus. Mesure le pouvoir de fixation des prix et l'efficacité de production."],
  [/marge op[ée]rationnelle|marge d.exploitation/i, "Part du chiffre d'affaires restant après les coûts de production ET les frais de fonctionnement (salaires, marketing, R&D). Reflète la rentabilité du métier lui-même."],
  [/marge ebitda/i, "Rentabilité avant intérêts, impôts et amortissements, en pourcentage des ventes. Utile pour comparer des entreprises aux structures d'investissement différentes."],
  [/marge (de |du )?fcf|marge de flux/i, "Part du chiffre d'affaires convertie en trésorerie réellement disponible. Plus fiable que le bénéfice comptable pour juger la santé financière."],
  [/\broe\b|rentabilit[ée] des capitaux propres/i, "Bénéfice généré pour 100 de capitaux apportés par les actionnaires. Mesure phare de l'efficacité avec laquelle l'entreprise fait fructifier l'argent investi."],
  [/\broic\b|retour sur capital investi/i, "Rendement dégagé sur l'ensemble du capital investi (fonds propres et dette). Au-dessus du coût du capital, l'entreprise crée de la valeur."],
  [/r[ée]sultat net|b[ée]n[ée]fice net/i, "Bénéfice final de la période, une fois toutes les charges, intérêts et impôts déduits. C'est le chiffre à partir duquel se calculent le BPA et les dividendes."],
  [/r[ée]sultat op[ée]rationnel|b[ée]n[ée]fice d.exploitation|resultat d.exploitation/i, "Bénéfice tiré de l'activité principale, avant éléments financiers et impôts. Ignore les effets de la dette pour montrer la performance du métier."],
  [/ebitda/i, "Bénéfice avant intérêts, impôts, dépréciations et amortissements. Approxime la trésorerie générée par l'exploitation courante."],

  // --- Chiffre d'affaires et croissance -------------------------------------
  [/chiffre d.affaires organique|croissance organique/i, "Croissance des ventes hors acquisitions, cessions et effets de change. Montre la progression réelle du métier existant."],
  [/prises de commandes|commandes re[cç]ues|bookings/i, "Nouvelles commandes signées pendant la période. Indique la demande future avant qu'elle n'apparaisse dans le chiffre d'affaires."],
  [/carnet de commandes|backlog|\brpo\b|obligations? de (performance|prestation)/i, "Commandes fermes déjà signées mais pas encore livrées ni facturées. Donne de la visibilité sur les revenus des prochains trimestres."],
  [/\barr\b|revenu.* r[ée]current annualis[ée]/i, "Revenus d'abonnement annualisés. Mesure la base de revenus prévisibles qui se renouvelle chaque année sans nouvelle vente."],
  [/effet prix\/mix|price\/mix|impact price/i, "Contribution des hausses de prix et du mix de produits vendus à la croissance, séparée de l'effet volume. Un prix/mix positif signale un vrai pouvoir de fixation des prix."],

  // --- Trésorerie et bilan ----------------------------------------------------
  [/flux de tr[ée]sorerie disponible|free cash flow|\bfcf\b/i, "Trésorerie restant après les investissements nécessaires à l'activité. C'est l'argent réellement disponible pour dividendes, rachats d'actions ou désendettement."],
  [/flux de tr[ée]sorerie op[ée]rationnel|cash flow op[ée]rationnel|\bocf\b/i, "Trésorerie générée par l'activité courante avant investissements. Un bénéfice comptable sans flux de trésorerie correspondant est un signal d'alerte."],
  [/investissements? \(capex\)|capex|d[ée]penses d.investissement/i, "Dépenses d'équipement et d'infrastructure (usines, machines, data centers). Un capex élevé prépare la croissance future mais pèse sur la trésorerie immédiate."],
  [/dette nette/i, "Dette totale moins la trésorerie disponible. Mesure l'endettement réel : une dette nette négative signifie plus de cash que de dettes."],
  [/dette (long terme|lt)|dette financi[eè]re/i, "Emprunts remboursables à plus d'un an. À comparer à l'EBITDA ou aux flux de trésorerie pour juger si elle est soutenable."],
  [/capitaux propres/i, "Valeur comptable revenant aux actionnaires : ce qui resterait si l'entreprise vendait ses actifs et remboursait ses dettes."],
  [/total du bilan|actifs totaux|total des actifs/i, "Somme de tout ce que possède l'entreprise (usines, trésorerie, créances, marques). Donne l'échelle du groupe."],
  [/stocks?$|inventaires?/i, "Valeur des produits en attente de vente. Des stocks qui gonflent plus vite que les ventes annoncent souvent des rabais ou des dépréciations."],
  [/tr[ée]sorerie|liquidit[ée]s|cash et [ée]quivalents/i, "Argent immédiatement disponible. Un matelas de liquidités protège en cas de crise et permet de saisir des opportunités."],
  [/levier|dette nette\s*\/\s*ebitda|leverage/i, "Nombre d'années d'EBITDA nécessaires pour rembourser la dette nette. Au-delà de 3x, l'endettement devient un sujet de vigilance."],

  // --- Actionnaires -----------------------------------------------------------
  [/bpa dilu[ée]|b[ée]n[ée]fice par action|\beps\b/i, "Bénéfice ramené à une action, en comptant toutes les actions potentielles (stock-options comprises). C'est le moteur du cours en Bourse à long terme."],
  [/dividende par action|\bdps\b/i, "Montant versé en cash à l'actionnaire pour chaque action détenue. Sa régularité et sa progression comptent autant que son niveau."],
  [/rachats? d.actions|buyback/i, "Montant consacré à racheter ses propres actions. Réduit le nombre d'actions en circulation et augmente mécaniquement le bénéfice par action."],
  [/actions (en circulation|dilu[ée]es)|nombre (moyen )?d.actions/i, "Nombre d'actions qui se partagent le bénéfice. S'il baisse (rachats), chaque action vaut une part plus grande de l'entreprise."],
  [/taux de distribution|payout/i, "Part du bénéfice reversée en dividendes. Un taux très élevé laisse peu de marge si les profits baissent."],

  // --- Effectifs et productivité ---------------------------------------------
  [/effectifs?|employ[ée]s|headcount|workforce/i, "Nombre de salariés. Rapporté au chiffre d'affaires, il renseigne sur la productivité ; ses variations traduisent la confiance de la direction."],
  [/dotations? aux amortissements|d&a|amortissements/i, "Charge comptable qui étale le coût des équipements sur leur durée d'usage. Sans effet immédiat sur la trésorerie mais reflète l'usure de l'outil de production."],
  [/frais (de )?r&d|recherche et d[ée]veloppement/i, "Dépenses de recherche et développement. C'est l'investissement dans les produits de demain, à comparer aux ventes et aux concurrents."],
  [/frais (g[ée]n[ée]raux|commerciaux)|sg&a|opex/i, "Frais de structure : commercial, administratif, marketing. Leur poids en pourcentage des ventes mesure la discipline de coûts."],

  // --- Clients et abonnés -----------------------------------------------------
  [/utilisateurs actifs (quotidiens|mensuels)|\bdau\b|\bmau\b/i, "Nombre de personnes utilisant le service sur la période. C'est la base d'audience que l'entreprise peut monétiser."],
  [/abonn[ée]s|subscribers/i, "Nombre de clients payant un abonnement récurrent. Chaque abonné supplémentaire accroît les revenus prévisibles."],
  [/\barpu\b|revenu moyen par (utilisateur|abonn[ée])/i, "Revenu moyen généré par utilisateur. Sa progression montre que l'entreprise monétise mieux son audience existante."],
  [/taux de r[ée]tention|retention|churn|attrition/i, "Capacité à conserver ses clients (ou salariés) d'une période à l'autre. Une rétention élevée rend la croissance beaucoup moins coûteuse."],
  [/clients?$|nombre de clients/i, "Nombre de clients servis. Sa croissance est le premier moteur d'expansion du chiffre d'affaires."],

  // --- Immobilier et infrastructures ------------------------------------------
  [/taux d.occupation|occupancy/i, "Part des surfaces (ou chambres, logements) effectivement louées. Chaque point d'occupation supplémentaire tombe presque intégralement dans le résultat."],
  [/\bffo\b|funds from operations/i, "Résultat des foncières corrigé des amortissements immobiliers, la vraie mesure de leur capacité à générer du cash et payer les dividendes."],
  [/loyers?|revenus locatifs|rental/i, "Revenus tirés de la location des actifs. Leur croissance vient des hausses de loyers et du taux d'occupation."],
  [/same[- ]store|p[ée]rim[eè]tre comparable|comparable/i, "Croissance mesurée sur les seuls sites ouverts depuis plus d'un an. Élimine l'effet des ouvertures pour montrer la santé réelle du réseau existant."],
  [/magasins|restaurants|sites|implantations|points de vente|stores/i, "Taille du réseau physique. La croissance vient soit de nouvelles ouvertures, soit de faire mieux dans chaque site existant."],

  // --- Finance et assurance ---------------------------------------------------
  [/\baum\b|actifs sous gestion|encours/i, "Montant total que les clients confient à gérer. Les commissions étant en pourcentage des encours, c'est le moteur direct des revenus."],
  [/combined ratio|ratio combin[ée]/i, "Sinistres plus frais, en pourcentage des primes. Sous 100 %, l'assureur gagne de l'argent sur son métier avant même d'investir les primes."],
  [/ratio cet1|fonds propres durs/i, "Coussin de capital de la banque rapporté à ses risques. Plus il est élevé, plus la banque peut absorber des pertes sans danger."],
  [/primes (brutes|nettes|acquises)|premiums/i, "Montant des cotisations d'assurance de la période. C'est le chiffre d'affaires de l'assureur."],
  [/co[uû]t du risque|provisions pour pertes/i, "Montant mis de côté pour couvrir les crédits qui risquent de ne pas être remboursés. Sa hausse annonce une dégradation de la qualité des prêts."],

  // --- Industrie, énergie, santé ----------------------------------------------
  [/livraisons|exp[ée]ditions|deliveries|shipments/i, "Unités livrées aux clients sur la période. Pour les industriels, c'est la mesure la plus concrète de l'activité."],
  [/capacit[ée] (de production|install[ée]e)|\bgw\b|\bmw\b/i, "Capacité de production installée. Elle plafonne les ventes possibles : l'augmenter demande des années et de gros investissements."],
  [/pipeline|essais cliniques|phase (i{1,3}|[123])/i, "Produits en développement, pas encore commercialisés. C'est le réservoir de croissance future, avec un risque d'échec à chaque étape."],
  [/prix (r[ée]alis[ée]|moyen|de vente)/i, "Prix moyen effectivement obtenu par unité vendue. Sa progression au-delà de l'inflation signale un vrai pouvoir de marché."],
  [/part de march[ée]|market share/i, "Poids de l'entreprise dans son marché. Gagner des parts en croissance ET en récession est la marque des leaders."],
  [/taux d.utilisation|utilization/i, "Part de la capacité (usines, consultants, avions) réellement utilisée. Un taux élevé dope la rentabilité, un taux bas la détruit."],
  // Filets larges testes en DERNIER (ils matcheraient trop tot sinon)
  [/chiffre d.affaires|revenus|revenue|ventes nettes/i, "Total des ventes de la période. Point de départ de toute analyse : sans croissance des ventes, la croissance du bénéfice a des limites."],
  [/production|volumes? (de|d.)|tonnes|barils/i, "Quantités physiques produites ou vendues. Sépare la croissance réelle d'activité des simples effets de prix."],
];

/**
 * Retourne une définition générique pour un nom de KPI, ou null si le KPI est
 * trop spécifique (il sera traité par le batch de rédaction dédié).
 */
export function definitionGeneriqueKpi(nom: string | undefined | null): string | null {
  const n = String(nom ?? "").trim();
  if (!n) return null;
  for (const [re, def] of DEFS) {
    if (re.test(n)) return def;
  }
  return null;
}
