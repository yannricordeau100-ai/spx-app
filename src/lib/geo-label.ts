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
};

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
  if (MAP_FR[key] && !locale.startsWith("fr")) return MAP_FR[key];
  // Tout-majuscule non répertorié : on évite le cri visuel.
  if (s === key && /[A-Z]{4,}/.test(s)) return titleCase(s);
  return s;
}
