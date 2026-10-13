/**
 * Nettoyage des textes visibles d'une fiche (13 oct 2026, controle n0 visuel).
 *
 * Passe serveur unique, appliquee a TOUTES les societes juste apres
 * deepCleanCitations. Quatre familles de defauts relevees en ligne :
 *
 *  1. cuisine interne visible : « citees dans le Cahier », « derive OCF - capex »,
 *     « OCF » seul, noms de fichiers entre parentheses ;
 *  2. unites et mots anglais dans les KPI et les stories : « employees »,
 *     « customers », « 50k clients », « cross-sell » ;
 *  3. sigles sans explication : « ASO/PEO » ;
 *  4. libelles de periode fiscaux dans les commentaires (« T2 FY27 ») alors que
 *     la pastille de periode affiche le trimestre calendaire reel : on convertit
 *     avec la MEME fonction que la pastille (periodLabelFromRaw), donc la meme
 *     convention de fiche. Un trimestre non termine n'est jamais converti.
 *
 * Regles volontairement etroites : mots sans ambiguite uniquement. Les mots
 * « derive(s) » au sens financier (produits derives) ne sont jamais touches.
 * Idempotent.
 */
import { periodLabelFromRaw, render as rendreTrimestre } from "@/lib/period-label";
import { getFiscalAudit, getFiscalAuditTextes, fiscalQuarterToCalendar } from "@/lib/fiscal-calendar";

/** Cles dont la valeur n'est jamais un texte affiche. */
const CLES_IGNOREES =
  /(?:^|_)(?:url|href|src|link|logo|image|img|path|slug|domain|email|ticker|cik|isin|id|key|short|type|unit|period_type|last_data_date|date|filed|form|history_periods|evenement_periode|q|label_en|name_en|description_en|source|sources|source_url|file)$/i;

// ---------------------------------------------------------------- 1. cuisine

type Regle = { id: string; re: RegExp; to: string | ((...a: string[]) => string) };

const accorde = (mot: string, fem: string, plur: string) => {
  const f = fem === "e" || fem === "es";
  const p = plur === "s" || fem === "es";
  const base = mot[0] === "D" ? "Calcul" : "calcul";
  return `${base}é${f ? "e" : ""}${p ? "s" : ""}`;
};

/** Mot « derive » employe comme methode de calcul, jamais au sens financier. */
const REGLES_CUISINE: Regle[] = [
  { id: "cahier", re: /\b(sources? publiques?)\s+cit[ée]e?s?\s+dans\s+le\s+Cahier\b/g, to: "$1 de la société" },
  { id: "cahier-donnees", re: /\bCahier de donn[ée]es Mettrik\b/g, to: "Données Mettrik" },
  // « OCF - capex » / « OCF moins capex » : formule explicite, en clair.
  { id: "ocf-formule", re: /\bOCF\s*(?:-|–|moins)\s*capex\b/gi, to: "flux opérationnel moins investissements" },
  { id: "ocf-parenthese", re: /\s*\(\s*OCF\s*\)/g, to: "" },
  { id: "ocf-de-l", re: /\bde l['’]OCF\b/g, to: "du flux opérationnel" },
  { id: "ocf-l", re: /\bL['’]OCF\b/g, to: "Le flux opérationnel" },
  { id: "ocf-l2", re: /\bl['’]OCF\b/g, to: "le flux opérationnel" },
  { id: "ocf-d", re: /\bd['’]OCF\b/g, to: "de flux opérationnel" },
  { id: "ocf-debut", re: /(^|[.;:]\s+)OCF\b/g, to: "$1Flux opérationnel" },
  { id: "ocf-reste", re: /\bOCF\b/g, to: "flux opérationnel" },
  // « dérivé » (methode de calcul) -> « calculé ».
  {
    id: "derive-parentheses",
    re: /(\([^()]*?)\b([Dd])(?:[ée]riv[ée]|erive)(e?)(s?)(?![A-Za-zÀ-ÿ])/g,
    to: (_m, avant, d, f, p) => `${avant}${accorde(d, f, p)}`,
  },
  {
    id: "derive-trimestre",
    re: /\b((?:T|Q)[1-4](?:[-–]?\d{2,4})?|trimestres?(?: (?:T|Q)[1-4])?|marges?(?: [\w'’éèêàç-]+){0,3}|dette nette|free cash[- ]?flow|cash[- ]?flow|FCF|EBIT|NOI|BPA|ratio|série trimestrielle|rendement|capex|cumuls?)\s+([Dd])[ée]riv[ée](e?)(s?)(?![A-Za-zÀ-ÿ])(?=\s*(?:=|:|du\b|des\b|de la\b|par\b|d['’]|rapport|exercice|FY|moins|\(|[.,;)\]]|$))/gi,
    to: (_m, avant, d, f, p) => `${avant} ${accorde(d, f, p)}`,
  },
  {
    id: "derive-methode",
    re: /(^|[.;:,]\s+|\s)([Dd])[ée]riv[ée](e?)(s?)(?=\s*(?:=|:|du cumul|des cumuls|du total|des variations|de variations|par différence|des flux|des capitaux|exercice moins|FY moins|rapport (?:annuel|trimestriel)))/g,
    to: (_m, lead, d, f, p) => `${lead}${accorde(d, f, p)}`,
  },
  { id: "calcule-formule", re: /\b(calcul[ée]e?s?)\s+(flux op[ée]rationnel)/g, to: "$1 : $2" },
  // Noms de fichiers entre parentheses (« (.htm.gz) », « (MMM_2025-02-06.htm.gz) »).
  { id: "fichier-parentheses", re: /\s*\((?:[^()]*?[\w-]*)\.(?:htm|html|json|txt|csv)(?:\.gz)?\)?/g, to: "" },
];

export function nettoyerCuisineInterne(texte: string, appliquees?: Record<string, number>): string {
  if (typeof texte !== "string" || texte.length < 4) return texte;
  let out = texte;
  for (const r of REGLES_CUISINE) {
    const avant = out;
    out = out.replace(r.re, r.to as string);
    if (appliquees && out !== avant) appliquees[r.id] = (appliquees[r.id] ?? 0) + 1;
  }
  return out;
}

// ----------------------------------------------------------------- 2. anglais

/** Mots d'unites ou de decompte anglais, traduits (mots entiers uniquement). */
const MOTS_UNITE: Record<string, string> = {
  employees: "employés",
  employee: "employé",
  customers: "clients",
  customer: "client",
  users: "utilisateurs",
  user: "utilisateur",
  stores: "magasins",
  store: "magasin",
  units: "unités",
  unit: "unité",
  homes: "logements",
  home: "logement",
  subscribers: "abonnés",
  subscriber: "abonné",
  members: "membres",
  member: "membre",
  locations: "sites",
  location: "site",
  properties: "biens",
  rooms: "chambres",
  hotels: "hôtels",
  vehicles: "véhicules",
  vehicle: "véhicule",
  trucks: "camions",
  truck: "camion",
  trailers: "remorques",
  deals: "contrats",
  contracts: "contrats",
  shares: "actions",
  share: "action",
  days: "jours",
  years: "années",
  months: "mois",
  hours: "heures",
  weeks: "semaines",
  rigs: "appareils de forage",
  wells: "puits",
  trials: "essais",
  programs: "programmes",
  projects: "projets",
  products: "produits",
  brands: "marques",
  plants: "usines",
  downloads: "téléchargements",
  accounts: "comptes",
  tons: "tonnes",
  ton: "tonne",
  case: "caisse",
  cases: "caisses",
  sqft: "pi²",
  "sq ft": "pi²",
  "sq.ft": "pi²",
  hotelss: "hôtels",
};

const RE_MOTS_UNITE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${Object.keys(MOTS_UNITE)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

/** Vrai si le texte est une phrase anglaise (jamais traduite mot a mot). */
function phraseAnglaise(s: string): boolean {
  return /\b(the|and|of|to|by|with|for|from|is|are|was|will|plans?|aims?)\b/i.test(s);
}

function traduireMots(s: string): string {
  return s.replace(RE_MOTS_UNITE, (m) => {
    const t = MOTS_UNITE[m.toLowerCase()];
    return t ?? m;
  });
}

const UNITES_COMPLETES: Record<string, string> = {
  "% of members": "% des membres",
  "% headcount": "% des effectifs",
};

/** Unite stockee en anglais -> francais. Les unites deja francaises sont inchangees. */
export function uniteEnFrancais(unite: string): string {
  if (typeof unite !== "string" || !unite) return unite;
  if (UNITES_COMPLETES[unite]) return UNITES_COMPLETES[unite];
  if (phraseAnglaise(unite)) return unite;
  let out = unite.replace(/\bof\b/gi, "des").replace(/\bper\b/gi, "par");
  out = traduireMots(out);
  // pluriel/singulier derriere un « / » : « USD/share » -> « USD/action ».
  return out;
}

/** « 50k clients » -> « 50 000 clients » (milliers ecrits a l'anglaise, suivis d'un mot). */
const RE_K_MOT = /(?<![\w.,])(\d{1,3})\s?k(?=\s+[a-zàâéèêîôûç])/g;

const NOMBRE_DEVANT_MOT_ANGLAIS =
  /(\d[\d\s  .,]*\s?(?:k|K|M|Md|Mds|millions?|milliards?)?)\s(employees|customers|users|stores|subscribers|members|homes|vehicles|accounts)\b/g;

const RE_ASO_PEO_RETRAITE = /\bASO\s?\/\s?PEO\s?\/\s?retraite\b/gi;
const RE_ASO_PEO = /\bASO\s?\/\s?PEO\b(?!\s*[(/])/g;

function traduireTexteKpi(s: string, appliquees?: Record<string, number>): string {
  if (typeof s !== "string" || s.length < 3) return s;
  let out = s;
  const note = (id: string, avant: string) => {
    if (appliquees && out !== avant) appliquees[id] = (appliquees[id] ?? 0) + 1;
  };
  let avant = out;
  out = out
    .replace(/\b(pour|sur|de|par) le cross[- ]?sell(?:ing)?\b/gi, (_m, p) => `${p} la vente croisée`)
    .replace(/\bdu cross[- ]?sell(?:ing)?\b/gi, "de la vente croisée")
    .replace(/\bau cross[- ]?sell(?:ing)?\b/gi, "à la vente croisée")
    .replace(/\ble cross[- ]?sell(?:ing)?\b/gi, "la vente croisée")
    .replace(/\bcross[- ]?sell(?:ing)?\b/gi, "vente croisée");
  note("cross-sell", avant);
  avant = out;
  out = out.replace(/\bup[- ]?sell(ing)?\b/gi, "montée en gamme");
  note("upsell", avant);
  avant = out;
  out = out.replace(RE_K_MOT, (_m, n) => `${n} 000`);
  note("nk-clients", avant);
  if (!phraseAnglaise(out)) {
    avant = out;
    out = out.replace(NOMBRE_DEVANT_MOT_ANGLAIS, (_m, n, mot) => `${n} ${MOTS_UNITE[mot.toLowerCase()] ?? mot}`);
    note("nombre-mot-anglais", avant);
  }
  avant = out;
  out = out
    .replace(RE_ASO_PEO_RETRAITE, "ASO/PEO (externalisation RH) et retraite")
    .replace(RE_ASO_PEO, "ASO/PEO (externalisation RH)");
  note("aso-peo", avant);
  return out;
}

// ------------------------------------------------------------------ 4. periodes

const RE_TRIM_FY_A = /\b([TQ])([1-4])[\s-]*FY\s?'?(\d{4}|\d{2})\b/g; // T2 FY27, Q3-FY2026
const RE_TRIM_FY_B = /\bFY\s?'?(\d{4}|\d{2})[\s-]*([TQ])([1-4])\b/g; // FY27 Q2
const RE_EXERCICE_FY = /\bFY\s?'?(\d{4}|\d{2})\b/g; // FY27, FY2026 (exercice seul)

function trimestreCalendaire(ticker: string, q: string, fy: string): string | null {
  const fa = getFiscalAuditTextes(ticker);
  if (!fa) return null; // pas de calendrier decale connu : on ne touche pas
  const annee = fy.length === 2 ? `20${fy}` : fy;
  if (getFiscalAudit(ticker)) return periodLabelFromRaw(`Q${q} FY${annee}`, ticker, "fr");
  // 13 oct 2026 : series en trimestres calendaires (seriesEnCalendrier) : meme conversion, sans passer par
  // la pastille qui, pour ces fiches, lit les libelles comme calendaires.
  const cal = fiscalQuarterToCalendar(Number(q), Number(annee), fa.fiscalYearEndMonth, fa.fyLabelConvention ?? "end");
  return rendreTrimestre(cal.q, cal.year, "fr");
}

export function harmoniserPeriodes(texte: string, ticker: string, appliquees?: Record<string, number>): string {
  if (typeof texte !== "string" || !/FY/i.test(texte)) return texte;
  const avant = texte;
  let out = texte.replace(RE_TRIM_FY_A, (m, _l, q, fy) => trimestreCalendaire(ticker, q, fy) ?? m);
  out = out.replace(RE_TRIM_FY_B, (m, fy, _l, q) => trimestreCalendaire(ticker, q, fy) ?? m);
  // 13 oct 2026 : exercice seul, sans decalage de date (meme numero que la societe).
  if (getFiscalAuditTextes(ticker)?.convertirExerciceTextes) {
    out = out.replace(RE_EXERCICE_FY, (_m, fy: string) => `exercice ${fy.length === 2 ? `20${fy}` : fy}`);
  }
  if (appliquees && out !== avant) appliquees["periode-fy"] = (appliquees["periode-fy"] ?? 0) + 1;
  return out;
}

// -------------------------------------------------------------------- parcours

const CHAMPS_KPI_TRADUITS = new Set(["name_fr", "signal", "description", "explanation", "explanation_fr"]);

function parcourir(v: unknown, ticker: string, cle: string | undefined, dansKpi: boolean, ap?: Record<string, number>): unknown {
  if (typeof v === "string") {
    if (cle && CLES_IGNOREES.test(cle)) return v;
    if (/^(?:https?:)?\/\//i.test(v)) return v;
    let out = nettoyerCuisineInterne(v, ap);
    out = harmoniserPeriodes(out, ticker, ap);
    if (dansKpi && cle && CHAMPS_KPI_TRADUITS.has(cle)) out = traduireTexteKpi(out, ap);
    return out;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i += 1) v[i] = parcourir(v[i], ticker, cle, dansKpi, ap);
    return v;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const estKpi = typeof o.short === "string" && ("value" in o || "history" in o || "unit" in o);
    for (const k of Object.keys(o)) {
      if (k.startsWith("_")) continue;
      // Bloc Positionnement IA : traite par une autre passe, jamais touche ici.
      if (k === "ai_positioning" || k.startsWith("ai_positioning_") || k === "ai_positioning_fr") continue;
      if (estKpi && k === "unit" && typeof o[k] === "string") {
        const avant = o[k] as string;
        const apres = uniteEnFrancais(avant);
        if (apres !== avant) {
          o[k] = apres;
          if (ap) ap["unite-en"] = (ap["unite-en"] ?? 0) + 1;
        }
        continue;
      }
      o[k] = parcourir(o[k], ticker, k, dansKpi || estKpi, ap);
    }
    return v;
  }
  return v;
}

/** Nettoie en place les textes visibles d'une fiche. `appliquees` compte les regles declenchees. */
export function nettoyerTextesFiche(
  company: Record<string, unknown>,
  ticker: string,
  appliquees?: Record<string, number>,
): void {
  parcourir(company, ticker, undefined, false, appliquees);
}

/**
 * 13 oct 2026 : seconde passe, PERIODES SEULEMENT, en fin de chargeur : les blocs injectes apres
 * nettoyerTextesFiche (journees investisseurs : objectifs, TAM) gardaient leurs « FY25 ».
 * Memes cles sautees que la passe principale. Sans entree fiscal-audit : aucun effet.
 */
export function harmoniserPeriodesFiche(company: Record<string, unknown>, ticker: string): void {
  const marcher = (v: unknown, cle: string | undefined): unknown => {
    if (typeof v === "string") {
      if (cle && CLES_IGNOREES.test(cle)) return v;
      if (/^(?:https?:)?\/\//i.test(v)) return v;
      return harmoniserPeriodes(v, ticker);
    }
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) v[i] = marcher(v[i], cle);
      return v;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (k.startsWith("_") || k === "ai_positioning" || k.startsWith("ai_positioning_") || k === "hero_kpi") continue;
        o[k] = marcher(o[k], k);
      }
    }
    return v;
  };
  marcher(company, undefined);
}
