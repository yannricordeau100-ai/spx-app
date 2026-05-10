/**
 * Mapping ISO 3166-1 alpha-2 country code → région géo macro Mettrik.
 *
 * Régions Mettrik (selon les règles Yann 10 mai 2026) :
 *   - "EU"      : Europe (incl. UK, CH, Norvège, Islande, Russie européenne)
 *   - "AM"      : Amérique du Nord + Amérique du Sud
 *   - "AS"      : Asie (incl. Russie au sens politique, Caucase ambigu)
 *   - "OC"      : Océanie (Australie, NZ, îles du Pacifique)
 *   - "AF"      : Afrique (incl. Maghreb)
 *   - "ME"      : Moyen-Orient (Israël, Turquie, péninsule arabique, Iran)
 *   - "UNKNOWN" : pays non reconnu / TOR / Antarctique
 *
 * Règle devise (cf currency.ts) :
 *   EU → EUR (sauf pays avec devise propre dans nos 10 supportées)
 *   AM → USD (sauf CA → CAD)
 *   AS → USD (sauf JP → JPY)
 *   OC → USD (sauf AU → AUD)
 *   AF → EUR
 *   ME → USD
 *
 * Règle langue (cf i18n/types.ts COUNTRY_TO_LOCALE) :
 *   pays officiellement francophone → fr
 *   pays officiellement germanophone → de (CH → de-CH)
 *   pays officiellement néerlandophone → nl
 *   pays officiellement suédophone → sv
 *   pays officiellement danois → da
 *   pays officiellement anglophone (UK) → en-GB
 *   tout le reste → en (par défaut, anglais US)
 */

export type Region = "EU" | "AM" | "AS" | "OC" | "AF" | "ME" | "UNKNOWN";

/**
 * Table exhaustive ISO 3166-1 alpha-2 → région.
 * Couvre tous les pays/territoires avec un code ISO officiel.
 */
export const COUNTRY_REGION: Record<string, Region> = {
  // ─────────────────────────── EUROPE ───────────────────────────
  AD: "EU", AL: "EU", AT: "EU", BA: "EU", BE: "EU", BG: "EU", BY: "EU",
  CH: "EU", CY: "EU", CZ: "EU", DE: "EU", DK: "EU", EE: "EU", ES: "EU",
  FI: "EU", FO: "EU", FR: "EU", GB: "EU", GG: "EU", GI: "EU", GR: "EU",
  HR: "EU", HU: "EU", IE: "EU", IM: "EU", IS: "EU", IT: "EU", JE: "EU",
  LI: "EU", LT: "EU", LU: "EU", LV: "EU", MC: "EU", MD: "EU", ME: "EU",
  MK: "EU", MT: "EU", NL: "EU", NO: "EU", PL: "EU", PT: "EU", RO: "EU",
  RS: "EU", SE: "EU", SI: "EU", SK: "EU", SM: "EU", UA: "EU", VA: "EU",
  XK: "EU", AX: "EU", SJ: "EU",

  // ───────────────────── AMÉRIQUE DU NORD + SUD ─────────────────
  US: "AM", CA: "AM", MX: "AM",
  // Amérique centrale + Caraïbes
  GT: "AM", BZ: "AM", SV: "AM", HN: "AM", NI: "AM", CR: "AM", PA: "AM",
  CU: "AM", JM: "AM", HT: "AM", DO: "AM", PR: "AM", BS: "AM", BB: "AM",
  AG: "AM", DM: "AM", LC: "AM", VC: "AM", GD: "AM", KN: "AM", TT: "AM",
  AI: "AM", AW: "AM", BM: "AM", BQ: "AM", VG: "AM", KY: "AM", CW: "AM",
  GP: "AM", MQ: "AM", MS: "AM", PM: "AM", SX: "AM", TC: "AM", VI: "AM",
  // Amérique du Sud
  AR: "AM", BO: "AM", BR: "AM", CL: "AM", CO: "AM", EC: "AM", FK: "AM",
  GF: "AM", GY: "AM", PE: "AM", PY: "AM", SR: "AM", UY: "AM", VE: "AM",

  // ────────────────────────── MOYEN-ORIENT ──────────────────────
  AE: "ME", BH: "ME", IL: "ME", IQ: "ME", IR: "ME", JO: "ME", KW: "ME",
  LB: "ME", OM: "ME", PS: "ME", QA: "ME", SA: "ME", SY: "ME", TR: "ME",
  YE: "ME",

  // ────────────────────────── ASIE ──────────────────────────────
  // Asie centrale, du Sud, du Sud-Est, de l'Est, Caucase
  AF: "AS", AM: "AS", AZ: "AS", BD: "AS", BN: "AS", BT: "AS", CN: "AS",
  GE: "AS", HK: "AS", ID: "AS", IN: "AS", JP: "AS", KG: "AS", KH: "AS",
  KP: "AS", KR: "AS", KZ: "AS", LA: "AS", LK: "AS", MM: "AS", MN: "AS",
  MO: "AS", MV: "AS", MY: "AS", NP: "AS", PH: "AS", PK: "AS", RU: "AS",
  SG: "AS", TH: "AS", TJ: "AS", TL: "AS", TM: "AS", TW: "AS", UZ: "AS",
  VN: "AS",

  // ────────────────────────── OCÉANIE ───────────────────────────
  AU: "OC", NZ: "OC", FJ: "OC", PG: "OC", SB: "OC", VU: "OC", WS: "OC",
  TO: "OC", KI: "OC", FM: "OC", MH: "OC", PW: "OC", NR: "OC", TV: "OC",
  CK: "OC", NU: "OC", AS_: "OC", GU: "OC", MP: "OC", NF: "OC", NC: "OC",
  PF: "OC", PN: "OC", TK: "OC", WF: "OC",

  // ────────────────────────── AFRIQUE ───────────────────────────
  // Afrique du Nord (Maghreb)
  DZ: "AF", EG: "AF", LY: "AF", MA: "AF", SD: "AF", TN: "AF", EH: "AF",
  // Afrique de l'Ouest
  BF: "AF", BJ: "AF", CI: "AF", CV: "AF", GH: "AF", GM: "AF", GN: "AF",
  GW: "AF", LR: "AF", ML: "AF", MR: "AF", NE: "AF", NG: "AF", SH: "AF",
  SL: "AF", SN: "AF", TG: "AF",
  // Afrique centrale
  AO: "AF", CD: "AF", CF: "AF", CG: "AF", CM: "AF", GA: "AF", GQ: "AF",
  ST: "AF", TD: "AF",
  // Afrique de l'Est
  BI: "AF", DJ: "AF", ER: "AF", ET: "AF", KE: "AF", KM: "AF", MG: "AF",
  MU: "AF", MW: "AF", MZ: "AF", RE: "AF", RW: "AF", SC: "AF", SO: "AF",
  SS: "AF", TZ: "AF", UG: "AF", YT: "AF", ZM: "AF", ZW: "AF",
  // Afrique australe
  BW: "AF", LS: "AF", NA: "AF", SZ: "AF", ZA: "AF",
};

/** Retourne la région d'un code pays (UNKNOWN si inconnu). */
export function getCountryRegion(country: string | null | undefined): Region {
  if (!country) return "UNKNOWN";
  return COUNTRY_REGION[country.toUpperCase()] ?? "UNKNOWN";
}
