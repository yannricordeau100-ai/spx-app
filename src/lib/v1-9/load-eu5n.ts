import path from "node:path";
import fs from "node:fs/promises";

/**
 * Loader cohort EU5+N pour l'onglet admin universe-toggle V1.9.5.
 *
 * Source : `sec-data/_meta/eu5n-pipeline-manifest.json` (généré par les
 * scripts data CONV-DATA, structure officielle Yann 31 mai 2026).
 *
 * Cohort EU5+N = 9 pays européens :
 * France, Allemagne, Italie, Suisse, Pays-Bas, Suède, Danemark, Finlande, Norvège.
 *
 * Étanchéité : ne touche PAS à V1.9.5 univers existant (cohort SP500 + Top307
 * + EU dans Top307). EU5+N est un cohort SÉPARÉ.
 */

export type Eu5nSte = {
  ticker: string;
  country: string;
  official_name: string;
  gics_sector?: string;
  gics_industry?: string;
  has_20f?: boolean;
  years_present: string[];
  count_5_5?: boolean;
  total_bytes: number;
  market_cap?: number | null;
  extraction_state?: string;
  ready_for_pipeline?: boolean;
};

export type Eu5nCountryGroup = {
  country: string;
  flag: string;
  stes: Eu5nSte[];
};

export type Eu5nData = {
  byCountry: Eu5nCountryGroup[];
  countryCounts: { country: string; flag: string; count: number }[];
  totalStes: number;
};

// 9 pays EU5+N dans l'ordre Yann (FR strict)
const COUNTRY_ORDER: { name: string; flag: string }[] = [
  { name: "France", flag: "🇫🇷" },
  { name: "Allemagne", flag: "🇩🇪" },
  { name: "Italie", flag: "🇮🇹" },
  { name: "Suisse", flag: "🇨🇭" },
  { name: "Pays-Bas", flag: "🇳🇱" },
  { name: "Suède", flag: "🇸🇪" },
  { name: "Danemark", flag: "🇩🇰" },
  { name: "Finlande", flag: "🇫🇮" },
  { name: "Norvège", flag: "🇳🇴" },
];

const EU5N_COUNTRIES = new Set(COUNTRY_ORDER.map((c) => c.name));

type ManifestSte = {
  ticker: string;
  country: string;
  official_name?: string;
  gics_sector?: string;
  gics_industry?: string;
  has_20f?: boolean;
  years_2020_2024?: string[];
  years_present?: string[];
  count_5_5?: boolean;
  total_text_bytes?: number;
  total_bytes?: number;
  market_cap?: number | null;
  extraction_state?: string;
  ready_for_pipeline?: boolean;
};

type Manifest = {
  generated_at?: string;
  total_stes?: number;
  stes?: ManifestSte[];
};

/**
 * Charge le cohort EU5+N depuis le manifest pipeline. Filtre sur les 9 pays
 * EU5+N. Retourne data structurée par pays avec drapeau + tri alphabétique
 * intra-pays par ticker.
 *
 * Si le manifest n'existe pas (cas tôt dans la génération côté CONV-DATA),
 * retourne une structure vide avec compteurs à 0 (pas de crash).
 */
export async function loadEu5n(): Promise<Eu5nData> {
  const manifestPath = path.join(
    process.cwd(),
    "sec-data/_meta/eu5n-pipeline-manifest.json",
  );

  let manifest: Manifest;
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw) as Manifest;
  } catch {
    // Manifest absent : fallback structure vide, onglet affichera 0 sté.
    return emptyEu5nData();
  }

  const all = manifest.stes ?? [];
  const filtered = all.filter((s) => EU5N_COUNTRIES.has(s.country));

  // Group par pays
  const map = new Map<string, Eu5nSte[]>();
  for (const raw of filtered) {
    const ste: Eu5nSte = {
      ticker: raw.ticker,
      country: raw.country,
      official_name: raw.official_name ?? raw.ticker,
      gics_sector: raw.gics_sector,
      gics_industry: raw.gics_industry,
      has_20f: raw.has_20f,
      years_present: raw.years_present ?? raw.years_2020_2024 ?? [],
      count_5_5: raw.count_5_5,
      total_bytes: raw.total_bytes ?? raw.total_text_bytes ?? 0,
      market_cap: raw.market_cap,
      extraction_state: raw.extraction_state,
      ready_for_pipeline: raw.ready_for_pipeline,
    };
    if (!map.has(ste.country)) {
      map.set(ste.country, []);
    }
    map.get(ste.country)!.push(ste);
  }

  // Build par pays dans l'ordre Yann + tri alphabétique intra-pays
  const byCountry: Eu5nCountryGroup[] = [];
  const countryCounts: Eu5nData["countryCounts"] = [];
  let total = 0;

  for (const { name, flag } of COUNTRY_ORDER) {
    const stes = (map.get(name) ?? [])
      .slice()
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
    byCountry.push({ country: name, flag, stes });
    countryCounts.push({ country: name, flag, count: stes.length });
    total += stes.length;
  }

  return {
    byCountry,
    countryCounts,
    totalStes: total,
  };
}

function emptyEu5nData(): Eu5nData {
  const byCountry: Eu5nCountryGroup[] = [];
  const countryCounts: Eu5nData["countryCounts"] = [];
  for (const { name, flag } of COUNTRY_ORDER) {
    byCountry.push({ country: name, flag, stes: [] });
    countryCounts.push({ country: name, flag, count: 0 });
  }
  return { byCountry, countryCounts, totalStes: 0 };
}
