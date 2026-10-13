/**
 * Libelles francais des fiches (Yann 13 oct 2026).
 *
 * 1. Sous-industrie : environ 190 fiches de l univers principal affichaient un
 *    libelle anglais brut (« Heavy Machinery & Equipment ») dans la pastille du
 *    haut de fiche. Quand le libelle servi est en anglais, on le remplace par le
 *    nom francais de la sous-industrie GICS de la societe (table
 *    docs/cahier/societes-gics.json + noms FR de src/lib/desk/gics.ts).
 * 2. Positionnement IA : gabarit de remplissage genere en mai 2026 pour les
 *    societes sans passage IA (« ... disponibles localement », « Mettrik AI
 *    reevaluera... »). On retire les phrases de remplissage et la cuisine
 *    interne ; la position (stance) n est jamais modifiee ici.
 */
import societesGics from "../../../docs/cahier/societes-gics.json";
import { GICS } from "@/lib/desk/gics";

const MOTS_ANGLAIS =
  /\b(and|of|the|for|Services?|Equipment|Technology|Technologies|Machinery|Management|Retail(ers?)?|Products?|Manufacturing|Components?|Distribution|Banking|Banks|Insurance|Real Estate|Health ?care|Health|Medical|Devices|Software|Hardware|Media|Entertainment|Beverages?|Foods?|Packaged|Chemicals|Specialty|Oil|Gas|Utilities|Water|Waste|Automotive|Industrial|Electrical|Electronic|Electric|Infrastructure|Payments?|Processing|Platforms?|Internet|Data|Center|Centers|Storage|Security|Solutions|Logistics|Supply Chain|Consulting|Brokerage|Brokers|Marketplaces|Mining|Steel|Railroads|Rail|Transportation|Cruise|Lines|Leisure|Facilities|Lodging|Resorts|Homebuilders?|Homebuilding|Household|Personal|Care|Commercial|Professional|Residential|Wealth|Asset|Exchange|Clearing|Midstream|Refining|Renewable|Energy|Power Generation|Pharmaceuticals?|Biopharmaceutical|Diagnostic|Life Sciences|Tools|Instruments?|Scientific|Laboratory|Luxury Goods|Discount|Grocery|General Merchandise|Home Improvement|Consumer|Holding Company|Association|Industry|Agricultural|Agricultur\w*|Advertising|Aerospace|Defense|Application|Applications|Building|Materials|Science|Cyber|Safety|Diversified|Computer|Systems|Precision|Motion|Control|Online|Auctions|Vehicle|Vehicles|Remarketing|Streaming|Social|Messaging|Sports|Self-Storage|Reinsurance|REITs?|Gaming|Multimedia|Fixtures|Concessions|Construction|Engineering|Drug Development|Foodservice|Wholesale|Supplies|Rental|Leasing|Utilities|Regulated|Hearing|Delivery|Drug|Sourcing|Transaction|Wineries|Distilleries|Alcoholic|Snacks|Tires|Related|Parts|Trucks|Climate|Refrigeration|Automation|Controls|Digital|Transformation|Identification|Coatings|Paints|Ingredients|Fertilizers|Seeds|Commodities|Nutrition|Chain|Integrated|Information|Critical|Colocation|Interconnection|Storage|Peripherals|Tobacco|Utilities|Mission|Eateries|Tissue|Hygiene|Outdoor|Infection|Prevention|Remarketing|Capital|Human|Resources|Employment|Risk|Broking|Applied|Markets|Science|Hardware|TBD)\b/i;

/** Mots qui n existent pas dans un libelle francais : anglais meme si le libelle melange. */
const MOTS_ANGLAIS_FORTS =
  /\b(and|of|the|for|with|Apparel|Footwear|Accessories|Biopharmaceuticals?|Exchanges?|Telecommunications|Restaurants|Cyber ?security|Cloud|Airlines|Distributors|Infrastructure(?! de| énergétique)|Software|Media|Analytics|Data|E-commerce|REITs|Midstream|Energy|Services? & Infrastructure)\b/;

const MOTS_FRANCAIS =
  /[éèêàùôîç]|\b(et|de|des|du|la|le|les|aux|pour|Conseil|autres|alimentaire|bricolage|maison|automobile|immobiliers?|environnementaux|installations|infrastructures|informatiques|financiers|d'application|forestiers|Produits|Logiciels?|agricoles|Distribution alimentaire)\b/i;

/** Un libelle est juge anglais s il porte un mot anglais et aucun signe de francais. */
export function libelleAnglais(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t === "TBD") return true;
  if (new Set(tableSousIndustries().values()).has(t)) return false;
  if (MOTS_ANGLAIS_FORTS.test(t)) return true;
  if (MOTS_FRANCAIS.test(t) || /& services|& infrastructure/.test(t) || tableSousIndustries().size === 0) return false;
  if (new Set(tableSousIndustries().values()).has(t)) return false;
  return MOTS_ANGLAIS.test(t);
}

let TABLE_SOUS_INDUSTRIES: Map<string, string> | null = null;
function tableSousIndustries(): Map<string, string> {
  if (TABLE_SOUS_INDUSTRIES) return TABLE_SOUS_INDUSTRIES;
  const m = new Map<string, string>();
  for (const sec of GICS) for (const g of sec.groups) for (const i of g.industries) for (const s of i.subs) m.set(s.code, s.name);
  TABLE_SOUS_INDUSTRIES = m;
  return m;
}

/** Nom francais de la sous-industrie GICS d une societe, ou null si inconnue. */
export function sousIndustrieGicsFr(ticker: string): string | null {
  const code = (societesGics as { societes: Record<string, string> }).societes[ticker.toUpperCase()];
  if (!code) return null;
  return tableSousIndustries().get(code) ?? null;
}

/** Remplace un libelle de sous-industrie anglais par le libelle GICS francais. */
export function sousIndustrieEnFrancais(ticker: string, libelle: unknown): string | null {
  if (typeof libelle !== "string" || !libelleAnglais(libelle)) return null;
  return sousIndustrieGicsFr(ticker);
}

const REMPLISSAGE_IA =
  /disponibles localement|r[ée]{1,2}valuera le positionnement|ne met pas le sujet en avant|commence [àa] int[ée]grer l'IA|Aucune mention significative d'IA/i;

/**
 * Retire du bloc Positionnement IA les phrases du gabarit de remplissage
 * (la stance et les elements factuels restent). Renvoie vrai si modifie.
 */
export function nettoyerPositionnementIa(ai: Record<string, unknown>): boolean | "supprimer" {
  let modifie = false;
  // Second gabarit (6 fiches, position « absent ») : tout le bloc est du remplissage
  // (« ... pas significativement transforme par l IA », « Mettrik AI tracera en V2.0 »). On le retire.
  if (typeof ai.summary === "string" && /n'est pas significativement transform[ée] par l'IA aujourd'hui/i.test(ai.summary) && /fondamentaux propres au secteur/i.test(ai.summary)) return "supprimer";
  if (Array.isArray(ai.evidence)) {
    const garde = ai.evidence.filter((e) => !(typeof e === "string" && REMPLISSAGE_IA.test(e)));
    if (garde.length !== ai.evidence.length) { ai.evidence = garde; modifie = true; }
  }
  if (typeof ai.summary === "string") {
    // « X mentionne peu l'IA dans ses communications officielles (Libelle anglais). »
    const s = ai.summary.replace(
      /(communications officielles)\s*\([^)]*\)\s*\./i,
      "$1.",
    );
    if (s !== ai.summary) { ai.summary = s; modifie = true; }
  }
  if (typeof ai.source_note === "string" && /sources? locales?/i.test(ai.source_note)) {
    delete ai.source_note; modifie = true;
  }
  if (modifie) { delete ai.evidence_fr; }
  return modifie;
}
