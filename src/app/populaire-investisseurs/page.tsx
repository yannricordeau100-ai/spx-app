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
