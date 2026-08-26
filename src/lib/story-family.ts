/**
 * Rangement des KPI "story" en familles (Yann 26 août 2026).
 *
 * Motif : certaines sociétés cumulent 40 à 70 stories (AXON 69, AVB 68,
 * AES 68). Sans regroupement, le carrousel devient un fourre-tout où la
 * décomposition du chiffre d'affaires noie les vrais faits marquants.
 *
 * Le classement est DÉTERMINISTE (libellé + unité), sans appel à un modèle :
 * même entrée, même famille, à chaque rendu, sur les 18 000 stories de la
 * base. L'ordre de la liste FAMILIES est aussi l'ordre d'affichage des
 * onglets : le concret d'abord, la décomposition comptable en dernier.
 */

import type { KPI } from "./data";

export type StoryFamilyKey =
  | "usage"
  | "clients"
  | "capacite"
  | "innovation"
  | "marche"
  | "operations"
  | "revenus"
  | "geographie"
  | "bilan"
  | "risques"
  | "jalons";

export type StoryFamily = {
  key: StoryFamilyKey;
  label_fr: string;
  label_en: string;
};

export const STORY_FAMILIES: StoryFamily[] = [
  { key: "usage", label_fr: "Usage & audience", label_en: "Usage & audience" },
  { key: "clients", label_fr: "Clients & abonnés", label_en: "Customers & subscribers" },
  { key: "capacite", label_fr: "Capacité & production", label_en: "Capacity & output" },
  { key: "innovation", label_fr: "Innovation", label_en: "Innovation" },
  { key: "marche", label_fr: "Position de marché", label_en: "Market position" },
  { key: "operations", label_fr: "Opérations & efficacité", label_en: "Operations & efficiency" },
  { key: "revenus", label_fr: "Revenus par activité", label_en: "Revenue breakdown" },
  { key: "geographie", label_fr: "Revenus par zone", label_en: "Revenue by region" },
  { key: "bilan", label_fr: "Investissements & bilan", label_en: "Investments & balance sheet" },
  { key: "risques", label_fr: "Risques & litiges", label_en: "Risks & litigation" },
  { key: "jalons", label_fr: "Autres jalons", label_en: "Other milestones" },
];

/** Zones et pays : une story intitulee "Africa" ou "Other Americas" est une
 *  repartition geographique du chiffre d affaires, pas un jalon isole. */
const GEO_RE =
  /^(?:revenus?|chiffre d'affaires|ca|sales?|revenue)?\s*[-–:]?\s*(united states|[eé]tats-unis|usa|canada|mexique|mexico|br[eé]sil|brazil|chili|chile|argentine|other americas|am[eé]riques?|latin america|am[eé]rique latine|europe|emea|eurozone|france|allemagne|germany|royaume-uni|united kingdom|\buk\b|espagne|spain|italie|italy|suisse|switzerland|pays-bas|netherlands|belgique|belgium|irlande|ireland|nordics|scandinavi|pologne|poland|afrique|africa|moyen-orient|middle east|asie|asia|apac|asia pacific|chine|china|greater china|japon|japan|cor[eé]e|korea|inde|india|singapour|singapore|taiwan|ta[iï]wan|australie|australia|nouvelle-z[eé]lande|new zealand|international|reste du monde|rest of world|domestic|march[eé] domestique)\b/i;

const RULES: Array<{ key: StoryFamilyKey; re: RegExp }> = [
  { key: "geographie", re: GEO_RE },
  {
    key: "bilan",
    re: /capex|investissements?|capital expenditure|amortissement|d[eé]pr[eé]ciation|depreciation|\bd&a\b|actifs|assets|dette|debt|capitaux propres|equity|tr[eé]sorerie|cash flow|flux de tr[eé]sorerie|dividende|dividend|rachat d'?actions|buyback|goodwill|\bbfr\b|working capital/i,
  },
  {
    key: "risques",
    re: /litige|amende|antitrust|penalit|sanction|proc[eè]s|settlement|provision|rappel produit|recall|cyber|fraude|enqu[eê]te|investigation/i,
  },
  {
    key: "usage",
    re: /utilisateur|user|\bmau\b|\bdau\b|audience|vues|views|visite|visit|trafic|traffic|t[eé]l[eé]chargement|download|engagement|watch time|temps pass|requ[eê]tes|queries|jetons|tokens|streams|[eé]coutes/i,
  },
  {
    key: "clients",
    re: /abonn|subscriber|subscription|client|customer|adh[eé]rent|member|compte|account|assur[eé]s|policyholder|patients trait|si[eè]ges|seats|licence|licens/i,
  },
  {
    key: "capacite",
    re: /capacit|production|produits? livr|livraison|deliver|volume|unit[eé]s|units|tonnes|barils|barrel|\bmw\b|\bgw\b|gwh|kwh|m[eè]tres|surface|magasin|store|restaurant|h[oô]tel|chambres|rooms|flotte|fleet|v[eé]hicule|vehicle|avion|aircraft|si[eè]ges-km|trajets|rides|colis|parcel|expedition|shipment|wafer|puces|chips/i,
  },
  {
    key: "innovation",
    re: /lancement|launch|nouveau mod[eè]le|brevet|patent|\br&d\b|recherche et d[eé]velopp|pipeline|essai clinique|clinical|approbation|approval|autorisation|innovation|prototype/i,
  },
  {
    key: "marche",
    re: /part de march|market share|classement|rang|leader|position|\btam\b|adressable|p[eé]n[eé]tration|penetration|couverture|coverage/i,
  },
  {
    key: "operations",
    re: /co[uû]t unitaire|efficacit|productivit|taux d[e']?occupation|occupancy|churn|r[eé]tention|retention|marge|margin|ratio combin|combined ratio|d[eé]lai|lead time|rendement|yield|panne|uptime|disponibilit|s[eé]curit|accident|[eé]mission|carbone|carbon|eau|d[eé]chets|waste|effectif|employ/i,
  },
  {
    key: "revenus",
    re: /chiffre d'affaires|revenu|revenue|ventes|sales|primes [eé]mises|premiums|honoraires|fees|redevance|royalt|segment|activit[eé]|division|r[eé]sultat op[eé]rationnel|operating income|ebitda|b[eé]n[eé]fice|profit|net income|income tax|interest (expense|income)|amortization|d[eé]preciation/i,
  },
];

/**
 * Famille d'un KPI story. `jalons` est le repli : un chiffre marquant qui
 * n'entre dans aucune catégorie reste visible, il n'est jamais écarté.
 */
export function storyFamily(kpi: Pick<KPI, "name_fr" | "name_en" | "short" | "unit">): StoryFamilyKey {
  let label = `${kpi.name_fr ?? ""} ${kpi.name_en ?? ""} ${kpi.short ?? ""}`;
  // "Same Store" est un terme comptable (périmètre constant), pas un magasin :
  // sans cette neutralisation, les revenus à périmètre constant d AvalonBay
  // tombaient dans "Capacité".
  label = label.replace(/same[- ]store/gi, "perimetre-constant");
  const unit = String(kpi.unit ?? "");
  for (const r of RULES) {
    if (r.re.test(label)) return r.key;
  }
  // Une unité physique sans mot-clé reconnu reste un volume : mieux vaut la
  // ranger dans "Capacité" que dans le fourre-tout.
  if (unit && !/[$€£%]|\bMds\b|\bM\b|\bK\b/.test(unit)) return "capacite";
  // Une unité monétaire sans mot-clé est presque toujours une ligne de la
  // décomposition du chiffre d'affaires (ex Disney "Services", "Products").
  if (/[$€£]|\bMds\b|\bM\b|\bK\b/.test(unit)) return "revenus";
  return "jalons";
}

/** Ordre d'affichage des onglets, familles vides exclues. */
export function orderedFamilies(keys: Set<StoryFamilyKey>): StoryFamily[] {
  return STORY_FAMILIES.filter((f) => keys.has(f.key));
}
