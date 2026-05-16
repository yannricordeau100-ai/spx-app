import fs from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { getServerLocale } from "@/lib/i18n/server";
import { PopulaireClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Actions populaires · Mettrik AI",
  description:
    "Top des actions les plus échangées et tradées par les investisseurs particuliers, par marché. Classement combiné Yahoo Finance, Investing.com, Boursorama.",
};

export type PopularRow = {
  ticker: string;
  /** Ticker affiché (sans suffixe place boursière .SW/.PA/.L/etc). */
  displayTicker?: string;
  name: string;
  rank: number;
  country?: string;
  // legacy fields (kept optional for backward compat)
  dollar_volume_usd?: number;
  avg_volume?: number;
  avg_price?: number;
  currency?: string;
  market_cap_usd?: number;
  views?: number;
  total_views?: number;
};

/** Suffixes de place boursière à retirer pour le ticker affiché. */
const EXCHANGE_SUFFIXES = [
  ".SW", ".PA", ".L", ".DE", ".AS", ".ST", ".CO", ".MI", ".MC",
  ".HE", ".OL", ".T", ".HK", ".TO", ".AX", ".BR", ".LS", ".VI",
  ".IR", ".SS",
];

/** Exceptions : tickers Suisses qui entrent en conflit avec un ticker
 *  identique sur un autre marché. On garde le suffixe pour éviter
 *  l'ambiguïté avec la sté homonyme.
 *  - CFR.SW (Richemont) vs CFR (Cullen/Frost Bankers, US)
 *  - ROG.SW (Roche) vs ROG (Rogers Corporation, US) */
const PRESERVE_SUFFIX = new Set(["CFR.SW", "ROG.SW"]);

function stripExchangeSuffix(ticker: string): string {
  const up = ticker.toUpperCase();
  if (PRESERVE_SUFFIX.has(up)) return up;
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) return up.slice(0, -suf.length);
  }
  return up;
}

/** Charge les noms officiels de la fiche société (v2-pipeline merged). */
function loadOfficialNames(): Record<string, string> {
  try {
    const p = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
    const m = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, { name?: string }>;
    const out: Record<string, string> = {};
    for (const [t, v] of Object.entries(m)) {
      if (v && typeof v === "object" && typeof v.name === "string") {
        out[t.toUpperCase()] = v.name;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export type PopularData = Record<string, PopularRow[]> & {
  _meta?: {
    window?: string;
    source?: string;
    method?: string;
    updated?: string;
    explanation?: string;
    universe_size?: number;
    enriched_size?: number;
  };
};

// Pays → liste de langues du site qui doivent voir ce pays en prio
const COUNTRY_TO_LANGS: Record<string, string[]> = {
  FR: ["fr"],
  US: ["en"],
  GB: ["en-GB"],
  DE: ["de"],
  NL: ["nl"],
  SE: ["sv"],
  DK: ["da"],
  CH: ["de-CH", "fr"],
  BE: ["fr", "nl"],
  AT: ["de"],
  LU: ["fr", "de"],
};

// Onglets affichés (ordre fixe)
const TABS: { key: string; label_fr: string; label_en: string; flag: string; country: string }[] = [
  { key: "world", label_fr: "Monde", label_en: "World", flag: "🌍", country: "" },
  { key: "en", label_fr: "USA", label_en: "USA", flag: "🇺🇸", country: "US" },
  { key: "fr", label_fr: "France", label_en: "France", flag: "🇫🇷", country: "FR" },
  { key: "en-GB", label_fr: "Royaume-Uni", label_en: "UK", flag: "🇬🇧", country: "GB" },
  { key: "de", label_fr: "Allemagne", label_en: "Germany", flag: "🇩🇪", country: "DE" },
  { key: "nl", label_fr: "Pays-Bas", label_en: "Netherlands", flag: "🇳🇱", country: "NL" },
  { key: "sv", label_fr: "Suède", label_en: "Sweden", flag: "🇸🇪", country: "SE" },
  { key: "da", label_fr: "Danemark", label_en: "Denmark", flag: "🇩🇰", country: "DK" },
  { key: "de-CH", label_fr: "Suisse", label_en: "Switzerland", flag: "🇨🇭", country: "CH" },
];

export default async function PopulairePage() {
  const dataPath = path.join(process.cwd(), "src/data/popular-stocks-by-language.json");
  let data: PopularData = {};
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as PopularData;
  } catch {
    data = {};
  }

  // Enrichissement : (1) nom officiel depuis la fiche société (v2-pipeline)
  // pour cohérence avec ce qui est rendu en cliquant ; (2) ticker affiché
  // sans le suffixe place boursière (.SW/.PA/etc).
  // Garde-fou : si v2-pipeline est manifestement faux (cross-pollution
  // documentée dans SHARED-STATUS — ex DG.PA=Virbac, SIE.DE=Siemens Limited
  // India, VOD.L=Vodacom), on garde le nom curaté du JSON.
  const CROSS_POLLUTION_BLOCKLIST = new Set([
    "DG.PA", "SIE.DE", "VOD.L", "BCP.LS", "NG.L", "RMS.PA",
    "ATEYY", "ADTTF", "BP", "BPAQF", "BBVA.MC",
  ]);
  const officialNames = loadOfficialNames();
  for (const region of Object.keys(data)) {
    if (region.startsWith("_")) continue;
    const rows = data[region];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const t = (row.ticker || "").toUpperCase();
      row.displayTicker = stripExchangeSuffix(row.ticker);
      if (!CROSS_POLLUTION_BLOCKLIST.has(t)) {
        const off = officialNames[t];
        if (off && typeof off === "string" && off.trim().length > 0) {
          row.name = off;
        }
      }
    }
  }

  const h = await headers();
  const countryHeader =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country-code") ||
    "";
  const country = countryHeader.toUpperCase() || "FR";
  const visitorLangs = COUNTRY_TO_LANGS[country] ?? [];

  // Choisir le tab par défaut en fonction du pays détecté
  let defaultTab = "world";
  const primaryLang = visitorLangs[0];
  if (primaryLang) {
    const match = TABS.find((t) => t.key === primaryLang);
    if (match) defaultTab = match.key;
  }

  const locale = await getServerLocale();
  const isFr = locale === "fr";

  return (
    <PopulaireClient
      data={data}
      tabs={TABS.map((t) => ({
        key: t.key,
        label: isFr ? t.label_fr : t.label_en,
        flag: t.flag,
        country: t.country,
      }))}
      defaultTab={defaultTab}
      country={country}
      labels={{
        title: isFr ? "Actions les plus populaires" : "Most popular stocks",
        subtitle: isFr
          ? "Top des actions les plus échangées et tradées par les investisseurs particuliers, par marché. Cliquer sur un ticker pour ouvrir la fiche Mettrik."
          : "Top stocks most actively traded by retail investors, by market. Click a ticker to open the Mettrik page.",
        for_you: isFr ? "Pour vous" : "For you",
        world: isFr ? "Monde" : "World",
        country_label: country,
        source_label: isFr ? "Source" : "Source",
        window_label: isFr ? "Période" : "Window",
        universe_label: isFr ? "Univers" : "Universe",
        country_detected: isFr ? "Pays détecté" : "Detected country",
        download_csv: isFr ? "Télécharger CSV" : "Download CSV",
        view_company: isFr ? "Voir la fiche" : "View company",
        dollar_volume: isFr ? "Volume échangé" : "Trading volume",
        rank: isFr ? "Tous" : "All",
        rank_label: isFr ? "Classement" : "Rank",
        popularity_score: isFr ? "Popularité" : "Popularity",
        no_data: isFr
          ? "Données en cours de collecte, reviens dans quelques minutes."
          : "Data being collected, check back in a few minutes.",
        methodology_title: isFr ? "Méthodologie" : "Methodology",
        methodology_body: isFr
          ? "Classement combiné depuis Yahoo Finance (most-active), Investing.com (most-active US) et Boursorama (palmarès volume échangé France/Europe). Mesure le volume échangé + la popularité chez les investisseurs particuliers, pas les pageviews Wikipedia. Univers Mettrik : top 300 sociétés mondiales + extensions par marché."
          : "Combined ranking from Yahoo Finance (most-active), Investing.com (most-active US) and Boursorama (most-traded France/Europe rankings). Measures trading volume + retail investor popularity, not Wikipedia pageviews. Mettrik universe: top 300 global + per-market extensions.",
      }}
    />
  );
}
