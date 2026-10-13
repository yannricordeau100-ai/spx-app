/**
 * Normalisation des libellés géographiques affichés dans la répartition du CA
 * (Yann 25 août 2026).
 *
 * Les données brutes viennent des dépôts SEC et arrivent en majuscules avec
 * la dénomination ISO complète : "TAIWAN, PROVINCE OF CHINA",
 * "KOREA, REPUBLIC OF". Illisible sur une fiche grand public. Cette table
 * ramène les cas connus à un nom courant, et met le reste en capitale
 * initiale plutôt que de laisser du tout-majuscule.
 */

const MAP_FR: Record<string, string> = {
  "TAIWAN, PROVINCE OF CHINA": "Taïwan",
  "KOREA, REPUBLIC OF": "Corée du Sud",
  "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF": "Corée du Nord",
  "RUSSIAN FEDERATION": "Russie",
  "IRAN, ISLAMIC REPUBLIC OF": "Iran",
  "VIET NAM": "Viêt Nam",
  "HONG KONG": "Hong Kong",
  "UNITED STATES": "États-Unis",
  "UNITED STATES OF AMERICA": "États-Unis",
  "U.S.": "États-Unis",
  USA: "États-Unis",
  "UNITED KINGDOM": "Royaume-Uni",
  "U.K.": "Royaume-Uni",
  UK: "Royaume-Uni",
  GERMANY: "Allemagne",
  FRANCE: "France",
  SWITZERLAND: "Suisse",
  NETHERLANDS: "Pays-Bas",
  BELGIUM: "Belgique",
  SPAIN: "Espagne",
  ITALY: "Italie",
  IRELAND: "Irlande",
  SWEDEN: "Suède",
  NORWAY: "Norvège",
  DENMARK: "Danemark",
  FINLAND: "Finlande",
  POLAND: "Pologne",
  AUSTRIA: "Autriche",
  PORTUGAL: "Portugal",
  GREECE: "Grèce",
  CANADA: "Canada",
  MEXICO: "Mexique",
  BRAZIL: "Brésil",
  CHILE: "Chili",
  ARGENTINA: "Argentine",
  CHINA: "Chine",
  JAPAN: "Japon",
  INDIA: "Inde",
  SINGAPORE: "Singapour",
  AUSTRALIA: "Australie",
  "NEW ZEALAND": "Nouvelle-Zélande",
  PHILIPPINES: "Philippines",
  THAILAND: "Thaïlande",
  MALAYSIA: "Malaisie",
  INDONESIA: "Indonésie",
  ISRAEL: "Israël",
  "SAUDI ARABIA": "Arabie saoudite",
  "UNITED ARAB EMIRATES": "Émirats arabes unis",
  "SOUTH AFRICA": "Afrique du Sud",
  EGYPT: "Égypte",
  TURKEY: "Turquie",
  "TÜRKIYE": "Turquie",
  EMEA: "Europe, Moyen-Orient et Afrique",
  "E M E A": "Europe, Moyen-Orient et Afrique",
  APAC: "Asie-Pacifique",
  IMEA: "Inde, Moyen-Orient et Afrique",
  LATAM: "Amérique latine",
  // Libellés de segments géographiques FMP (dépôts SEC) : ils arrivent
  // suffixés "Segment" et en anglais (Yann 25 août 2026).
  AMERICAS: "Amériques",
  EUROPE: "Europe",
  "GREATER CHINA": "Grande Chine",
  "REST OF ASIA PACIFIC": "Reste Asie-Pacifique",
  "ASIA PACIFIC": "Asie-Pacifique",
  "NORTH AMERICA": "Amérique du Nord",
  "LATIN AMERICA": "Amérique latine",
  "MIDDLE EAST": "Moyen-Orient",
  "REST OF WORLD": "Reste du monde",
  INTERNATIONAL: "International",
  DOMESTIC: "Marché domestique",
  // 13 oct 2026 (verif n2, JPM « Europe/Middle East/Africa ») : libelles
  // geographiques anglais releves sur l univers (66 libelles, 116 fiches).
  ASIA: "Asie",
  "ASIA-PACIFIC": "Asie-Pacifique",
  "ASIA/PACIFIC": "Asie-Pacifique",
  PACIFIC: "Pacifique",
  AFRICA: "Afrique",
  CARIBBEAN: "Caraïbes",
  CIS: "CEI",
  "SOUTH AMERICA": "Amérique du Sud",
  "WESTERN EUROPE": "Europe de l'Ouest",
  "EASTERN EUROPE": "Europe de l'Est",
  "CENTRAL EUROPE": "Europe centrale",
  "REST OF THE WORLD": "Reste du monde",
  "REST OF ASIA-PACIFIC": "Reste Asie-Pacifique",
  "EUROPE MIDDLE EAST AFRICA": "Europe, Moyen-Orient et Afrique",
  "EUROPE, MIDDLE EAST AND AFRICA": "Europe, Moyen-Orient et Afrique",
  "MIDDLE EAST AND AFRICA": "Moyen-Orient et Afrique",
  OTHER: "Autres",
  OTHERS: "Autres",
  "OTHER REGIONS": "Autres régions",
  "OTHER REGION": "Autre région",
  "OTHER SEGMENTS": "Autres segments",
  "OTHER REVENUE": "Autres revenus",
  "OTHER COUNTRIES": "Autres pays",
  "ALL OTHER COUNTRIES": "Autres pays",
  "REMAINING COUNTRIES": "Autres pays",
  "OTHER GEOGRAPHICAL AREAS": "Autres zones géographiques",
  "OTHER GEOGRAPHICAL AREA": "Autres zones géographiques",
  "OTHER GEOGRAPHIC AREAS": "Autres zones géographiques",
  "OTHER GEOGRAPHICAL REGION": "Autres zones géographiques",
  "OTHER GEOGRAPHIC LOCATIONS": "Autres zones géographiques",
  "OTHER GEOGRAPHICAL": "Autres zones géographiques",
  "OTHER FOREIGN LOCATIONS": "Autres pays étrangers",
  "OTHER INTERNATIONAL OPERATIONS": "Autres activités internationales",
  "OTHER NORTH AMERICA": "Reste de l'Amérique du Nord",
  "NON-NORTH AMERICA": "Hors Amérique du Nord",
  "AMERICAS OTHER THAN U S": "Amériques hors États-Unis",
  "WESTERN HEMISPHERE, EXCLUDING U.S.": "Hémisphère occidental hors États-Unis",
  "EUROPE (EXCLUDING GERMANY)": "Europe (hors Allemagne)",
  "ASIA PACIFIC AND OTHER": "Asie-Pacifique et autres",
  "UNITED STATES (DOMESTIC OPERATIONS)": "États-Unis (activités domestiques)",
  "INTERNATIONAL MARKETS": "Marchés internationaux",
  "EMERGING MARKETS": "Marchés émergents",
  FOREIGN: "Étranger",
  NORTH: "Nord",
  "SOUTH CENTRAL": "Centre-Sud",
  "GREATER BOSTON": "Grand Boston",
  TAIWAN: "Taïwan",
  KOREA: "Corée du Sud",
  "SOUTH KOREA": "Corée du Sud",
};

/**
 * 13 oct 2026 : libelle compose (« Europe/Middle East/Africa », « Asia, Middle
 * East & Africa », « Latin America/Caribbean ») traduit morceau par morceau,
 * SEULEMENT si chaque morceau est un nom geographique connu ; sinon (nom de
 * marque ou de segment, « Walmart International ») le libelle reste tel quel.
 */
function geoComposeFr(s: string): string | null {
  const morceaux = s.split(/\s*(?:\/|,|&|\band\b)\s*/i).map((m) => m.trim()).filter(Boolean);
  if (morceaux.length < 2) return null;
  const fr: string[] = [];
  for (const m of morceaux) {
    const t = MAP_FR[m.toUpperCase()];
    if (!t) return null;
    fr.push(t);
  }
  return fr.length === 2 ? `${fr[0]} et ${fr[1]}` : `${fr.slice(0, -1).join(", ")} et ${fr[fr.length - 1]}`;
}

/** Traduction francaise d un libelle geographique, ou null si inconnu. */
export function geoLabelFr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+segments?$/i, "");
  return MAP_FR[s.toUpperCase()] ?? geoComposeFr(s);
}

const MAP_EN: Record<string, string> = {
  "TAIWAN, PROVINCE OF CHINA": "Taiwan",
  "KOREA, REPUBLIC OF": "South Korea",
  "RUSSIAN FEDERATION": "Russia",
  "IRAN, ISLAMIC REPUBLIC OF": "Iran",
  "VIET NAM": "Vietnam",
  "UNITED STATES": "United States",
  "UNITED STATES OF AMERICA": "United States",
  "U.S.": "United States",
  USA: "United States",
  "U.K.": "United Kingdom",
  UK: "United Kingdom",
  EMEA: "Europe, Middle East and Africa",
  "E M E A": "Europe, Middle East and Africa",
  APAC: "Asia-Pacific",
  IMEA: "India, Middle East and Africa",
  LATAM: "Latin America",
};

/** Capitale initiale par mot, en préservant les sigles de 2-4 lettres connus. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((w) => (w.length > 1 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join("");
}

export function geoLabel(raw: string | null | undefined, locale = "fr"): string {
  if (!raw) return "—";
  // Le suffixe "Segment" des libellés FMP n apporte rien et allonge la
  // légende : "Americas Segment" -> "Amériques".
  const s = String(raw).trim().replace(/\s+segments?$/i, "");
  const key = s.toUpperCase();
  const table = locale.startsWith("fr") ? MAP_FR : MAP_EN;
  if (table[key]) return table[key];
  if (locale.startsWith("fr")) {
    const compose = geoComposeFr(s);
    if (compose) return compose;
  }
  if (MAP_FR[key] && !locale.startsWith("fr")) return MAP_FR[key];
  // Tout-majuscule non répertorié : on évite le cri visuel.
  if (s === key && /[A-Z]{4,}/.test(s)) return titleCase(s);
  return s;
}
