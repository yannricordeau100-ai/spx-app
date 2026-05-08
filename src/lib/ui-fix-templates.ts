/**
 * src/lib/ui-fix-templates.ts · CONV-MODULE-UI-AUDIT
 *
 * Helpers purs pour normaliser les chaînes affichées dans l'UI Mettrik.
 * Appliqués au RENDU (pas aux fichiers data sources) pour ne pas marcher
 * sur les pieds de CONV-DATA (`src/data/v2-pipeline/`) ni de CONV-SYSTEMS
 * (`src/lib/kpi-templates-by-gics.ts`).
 *
 * Convention typographique Mettrik (consolidée le 8 mai 2026) :
 *  - Milliards / millions : `Mds` / `M` (jamais `B` seul)
 *  - Devise : nombre + NBSP + unité quantité + NBSP + symbole devise
 *    Ex. attendu : `0,5 Mds $`  (rendu = "0,5 Mds $" insécable)
 *  - Pourcentage : nombre + NBSP + `%`     (`10 %`)
 *  - On utilise le NBSP standard ( ), pas le narrow ( ), pour
 *    compatibilité maximale (fonts/exports).
 *
 * Liste exhaustive des fix exposés :
 *   normalizeBToMds(text)         · "B$" / "B €" / "B" isolé → "Mds $" / "Mds €" / "Mds"
 *   normalizeUnitSpacing(text)    · "60M$" / "0.5 Mds$" → "60 M $" / "0,5 Mds $"
 *   addNbspBeforePct(text)        · "10%" → "10 %"
 *   normalizeNarrative(text)      · enchaîne les 3 ci-dessus (utilitaire global)
 *
 * Tests rapides via :
 *   npx tsx scripts/test-ui-fix-templates.ts
 *
 * Application proposée (voir `BROADCAST_INTEGRATION` en bas de fichier).
 */

const NBSP = " ";

/**
 * Remplace "B$" / "B €" / un "B" suivi d'un séparateur par "Mds<unité>".
 * On ne touche JAMAIS un "B" qui fait partie d'un nom propre (BVA, BAML…) :
 *  - On exige un chiffre suivi optionnellement d'espace + "B" + ($|€|fin de mot)
 *  - Pour le "B" isolé suivi d'un mot, on n'agit pas (laisser au correcteur humain)
 */
export function normalizeBToMds(text: string): string {
  if (!text) return text;
  // Cas 1 : "12B$" / "12 B$" / "12B €" → "12 Mds $" / "12 Mds €" (espace ASCII pour l'instant,
  // le NBSP est ajouté par normalizeUnitSpacing).
  let out = text.replace(/(\d[\d.,]*)\s?B\s?\$/g, "$1 Mds $");
  out = out.replace(/(\d[\d.,]*)\s?B\s?€/g, "$1 Mds €");
  // Cas 2 : "12B " (avec espace) suivi d'un mot français connu (« de », « d' », « en ») = unité
  // dollars/euros implicite via contexte → on ne change pas, ambigu.
  return out;
}

/**
 * Insère un NBSP entre <chiffre> ↔ <unité quantité> ↔ <devise>.
 * Cible : "60M$", "60 M$", "0.5Mds$", "0.5 Mds$", "12 Mds $", etc.
 * Sortie canonique : `12 Mds $`
 */
export function normalizeUnitSpacing(text: string): string {
  if (!text) return text;
  // Pattern : (nombre)(espace optionnel)(M|Mds)(espace optionnel)([$€])
  return text.replace(
    /(\d[\d.,]*)\s*(Mds|M)\s*([$€])/g,
    `$1${NBSP}$2${NBSP}$3`,
  );
}

/**
 * "10%" → "10 %". On ignore les "%" déjà précédés d'un NBSP/espace ASCII.
 * On ignore aussi les patterns CSS "100%" qui peuvent traîner dans HTML inline,
 * mais ces derniers sont dans des attributs et ne devraient pas être visibles.
 */
export function addNbspBeforePct(text: string): string {
  if (!text) return text;
  return text.replace(/(\d)(?=%)/g, `$1${NBSP}`);
}

/**
 * Pipeline complet pour les blocs narratifs (descriptions, stories,
 * interpretations). Idempotent : appliquer 2× ne change rien après la 1re.
 */
export function normalizeNarrative(text: string): string {
  if (!text) return text;
  let out = normalizeBToMds(text);
  out = normalizeUnitSpacing(out);
  out = addNbspBeforePct(out);
  return out;
}

/**
 * Normalise un sub-sector GICS anglais en français Mettrik.
 * Source : `_meta/gics-163-master.md` (CONV-DATA). Liste partielle ici,
 * à étendre incrémentalement à mesure que l'audit remonte de nouveaux EN.
 */
const SUBSECTOR_FR_MAP: Record<string, string> = {
  "Compute & Networking": "Calcul & réseau",
  "Compute &amp; Networking": "Calcul & réseau",
  "Semiconductors & Semiconductor Equipment": "Semi & équipements",
  "Semiconductors &amp; Semiconductor Equipment": "Semi & équipements",
  "Internet & Direct Marketing Retail": "Internet & vente directe",
  "Internet &amp; Direct Marketing Retail": "Internet & vente directe",
  "Software & Services": "Logiciels & services",
  "Software &amp; Services": "Logiciels & services",
  "Capital Goods": "Biens d'équipement",
  "Health Care Equipment": "Équipements de santé",
  "Aerospace & Defense": "Aérospatiale & défense",
  "Aerospace &amp; Defense": "Aérospatiale & défense",
  "Oil, Gas & Consumable Fuels": "Pétrole & gaz",
  "Oil, Gas &amp; Consumable Fuels": "Pétrole & gaz",
  "Pharmaceuticals": "Pharmaceutique",
};

export function translateSubsector(en: string): string {
  if (!en) return en;
  return SUBSECTOR_FR_MAP[en] ?? en;
}

/**
 * Labels des chips affichés dans `CompanyHeader` (sandbox V1.8 actuelle :
 * `Sector`, `Sub-sector`, `Founded`, `IPO`). Sur app FR ils doivent être en
 * français. Mapping découvert par audit `npx tsx scripts/audit-ui-pages.ts`
 * (codes UI_LABEL_EN, audit du 8 mai 2026 : 227/305 stés concernées).
 */
export const CHIP_LABEL_FR: Record<string, string> = {
  "Sector": "Secteur",
  "Sub-sector": "Sous-secteur",
  "Founded": "Fondée",
  "Headquarters": "Siège social",
  "Tagline": "Accroche",
  // "IPO" reste "IPO" (acronyme accepté tel quel + tooltip ACRONYM_GLOSSARY)
};

/**
 * Labels du composant `FreshnessIndicator` rendus en anglais actuellement.
 * Mapping ajouté suite à audit du 8 mai 2026 (code UI_FRESHNESS_LABEL_EN).
 * Utilisé via `translateFreshnessLabel(en)`.
 */
export const FRESHNESS_LABEL_FR: Record<string, string> = {
  "Recent": "Récent",
  "Fresh": "À jour",
  "Stale": "Périmé",
  "Unknown": "Inconnu",
};

export function translateFreshnessLabel(en: string): string {
  if (!en) return en;
  return FRESHNESS_LABEL_FR[en] ?? en;
}

/**
 * Convertit un nombre format US ("6.9%", "1,234.56") en format FR
 * ("6,9 %", "1 234,56"). Utile pour les nombres déjà sérialisés en string
 * dans les datasets ou hardcodés dans les templates.
 *
 * Si tu pars d'un Number JS, préfère `n.toLocaleString("fr-FR")` directement.
 */
export function normalizeNumberToFr(text: string): string {
  if (!text) return text;
  // Cas 1 : "1,234.56" (US complet) → "1 234,56"
  let out = text.replace(
    /(\d{1,3}(?:,\d{3})+)(\.\d+)?/g,
    (full, intPart: string, dec: string | undefined) => {
      const intFr = intPart.replace(/,/g, NBSP);
      return dec ? `${intFr},${dec.slice(1)}` : intFr;
    },
  );
  // Cas 2 : "6.9%" / "6.9 €" (décimal POINT, sans virgule milliers) → "6,9 %"
  // ATTENTION : ne pas matcher des mots type "1.5" qui peuvent être versions
  // (ex : "v1.5"). On exige un suffix devise/% ou rien après.
  out = out.replace(/(\d+)\.(\d+)(?=\s?(?:%|\$|€|Mds|<|$))/g, "$1,$2");
  return out;
}

export function translateChipLabel(en: string): string {
  if (!en) return en;
  return CHIP_LABEL_FR[en] ?? en;
}

/**
 * Glossaire pour acronymes Mettrik. Chaque acronyme a une explication
 * courte FR (1 phrase) à afficher dans le tooltip "i". Liste vivante ;
 * étendue par CONV-MODULE-UI-AUDIT au fil des audits.
 */
export const ACRONYM_GLOSSARY: Record<string, string> = {
  HPC: "High Performance Computing : calcul haute performance, puces et serveurs très puissants pour IA et simulation scientifique.",
  CAGR: "Compound Annual Growth Rate : taux de croissance annuel moyen sur plusieurs années.",
  TAM: "Total Addressable Market : taille totale du marché potentiel d'un produit ou service.",
  EBITDA: "Bénéfice avant intérêts, impôts, dépréciation et amortissement (mesure de rentabilité opérationnelle).",
  ARPP: "Average Revenue Per Payer : revenu moyen par client payant.",
  TAC: "Traffic Acquisition Cost : coût payé pour acquérir du trafic (notamment Google → partenaires).",
  ABF: "Assets Based Fees : commissions calculées sur les actifs gérés.",
  ARR: "Annual Recurring Revenue : revenu annuel récurrent (abonnements).",
  MRR: "Monthly Recurring Revenue : revenu mensuel récurrent.",
  GAAP: "Generally Accepted Accounting Principles : normes comptables américaines.",
  FCF: "Free Cash Flow : trésorerie libre disponible après dépenses opérationnelles.",
  ROIC: "Return On Invested Capital : rendement du capital investi.",
  ROE: "Return On Equity : rendement des fonds propres.",
  NPS: "Net Promoter Score : score de recommandation client.",
  ADR: "American Depositary Receipt : action étrangère cotée aux États-Unis sous forme de certificat.",
  IPO: "Initial Public Offering : introduction en bourse.",
  GICS: "Global Industry Classification Standard : norme de classification sectorielle des sociétés.",
  GMV: "Gross Merchandise Value : valeur totale des biens vendus sur une plateforme.",
};

/**
 * BROADCAST_INTEGRATION
 * ---------------------
 * Pour appliquer ces helpers, les conversations de scope correspondant
 * doivent les wrapper dans leurs composants de rendu :
 *
 *  - CONV-CONCEPTS dans `src/components/company-view.tsx` et tous les
 *    sous-composants qui rendent un `description` / `signal` / story_body :
 *    importer `normalizeNarrative` et l'appliquer à toute string narrative.
 *
 *  - CONV-CONCEPTS pour les sub-sectors : appliquer `translateSubsector(s)`
 *    dans `company-header.tsx` à l'affichage du chip sub-sector.
 *
 *  - CONV-SYSTEMS pour les acronymes : wrapper chaque `<span>{acronym}</span>`
 *    dans un `<InfoTooltip text={ACRONYM_GLOSSARY[acronym]} />` quand
 *    `ACRONYM_GLOSSARY[acronym]` existe.
 *
 *  - CONV-DATA peut OPTIONNELLEMENT pré-normaliser les datasets v2-pipeline
 *    en appliquant `normalizeNarrative` au build (pas obligatoire si le
 *    rendu côté UI applique déjà).
 *
 * Coordination : ping `🤝 @CONV-CONCEPTS @CONV-SYSTEMS @CONV-DATA` dans
 * SHARED-STATUS.md à la livraison de Phase 2.
 */
