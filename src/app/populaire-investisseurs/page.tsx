import fs from "node:fs";
import path from "node:path";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { getServerLocale } from "@/lib/i18n/server";
import { AuthNav } from "@/components/auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequiredBanner } from "@/components/auth-required-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerFreemiumTier } from "@/lib/freemium/server";
import { rate } from "@/lib/brand";
import type { KPI } from "@/lib/data";
import { displayTicker, buildTickerSet } from "@/lib/ticker-display";
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
  // Yann 18 mai 2026 — PV ajoutée depuis _merged.json côté SSR
  /** YoY brut du Hero KPI Mettrik (ex "+18%", "-4.2%"). */
  hero_yoy?: string;
  /** Label court du Hero KPI (ex "Data Center", "Mobility"). */
  hero_short?: string;
  /** Tier qualité Mettrik (excellent/bon/moyen/faible). */
  tier?: "excellent" | "bon" | "moyen" | "faible";
};

/**
 * Suffixes de place boursière + exceptions multi-classes : centralisés
 * dans `src/lib/ticker-display.ts` (Yann 21 mai 2026). Le helper
 * `displayTicker(ticker, allTickers)` calcule dynamiquement les doublons
 * (ex ROG.SW vs ROG) en plus de la liste statique des doublons connus
 * (ASML/ASMLF, GOOG/GOOGL, BRK.A/BRK.B, etc.).
 */

/**
 * Charge les noms officiels + données enrichies depuis la fiche société
 * (v2-pipeline merged) : nom canonique + Hero KPI (short + yoy + tier).
 * Yann 18 mai 2026 — pour afficher la PV Mettrik à côté du rang popularité.
 */
type MergedEntry = {
  name?: string;
  hero_kpi?: string;
  kpis?: KPI[];
};
type EnrichInfo = {
  name?: string;
  hero_short?: string;
  hero_yoy?: string;
  tier?: "excellent" | "bon" | "moyen" | "faible";
};
function loadMergedEnrichments(): Record<string, EnrichInfo> {
  try {
    const p = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
    const m = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, MergedEntry>;
    const out: Record<string, EnrichInfo> = {};
    for (const [t, v] of Object.entries(m)) {
      if (!v || typeof v !== "object") continue;
      const info: EnrichInfo = {};
      if (typeof v.name === "string") info.name = v.name;
      const heroShort = v.hero_kpi;
      const kpis = Array.isArray(v.kpis) ? v.kpis : [];
      const hero = heroShort
        ? kpis.find((k) => k && k.short === heroShort) ?? kpis[0]
        : kpis[0];
      if (hero) {
        info.hero_short = hero.short;
        if (typeof hero.yoy === "string" && hero.yoy.trim()) {
          info.hero_yoy = hero.yoy.trim();
        }
        try {
          const r = rate(hero);
          info.tier = r.tier;
        } catch {
          // skip tier if rate() crashes (KPI mal formé)
        }
      }
      out[t.toUpperCase()] = info;
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
  const enrichments = loadMergedEnrichments();
  // Construit l'univers de tous les tickers présents (toutes régions
  // confondues + enrichments _merged.json) pour que `displayTicker`
  // détecte dynamiquement les doublons (ex ROG.SW gardé si ROG existe
  // ailleurs).
  const allTickersList: string[] = [];
  for (const region of Object.keys(data)) {
    if (region.startsWith("_")) continue;
    const rows = data[region];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.ticker) allTickersList.push(row.ticker);
    }
  }
  for (const k of Object.keys(enrichments)) allTickersList.push(k);
  const allTickers = buildTickerSet(allTickersList);
  for (const region of Object.keys(data)) {
    if (region.startsWith("_")) continue;
    const rows = data[region];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const t = (row.ticker || "").toUpperCase();
      row.displayTicker = displayTicker(row.ticker, allTickers);
      const enrich = enrichments[t];
      if (enrich) {
        if (
          enrich.name &&
          !CROSS_POLLUTION_BLOCKLIST.has(t) &&
          enrich.name.trim().length > 0
        ) {
          row.name = enrich.name;
        }
        if (enrich.hero_short) row.hero_short = enrich.hero_short;
        if (enrich.hero_yoy) row.hero_yoy = enrich.hero_yoy;
        if (enrich.tier) row.tier = enrich.tier;
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

  // Top-bar globale (back + theme + auth/lang) + auth-gate, comme la home.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Yann (8 juin 2026) : thème clair réservé aux offres payantes (premium + max).
  const freemiumTier = await getServerFreemiumTier();
  const themePaid = freemiumTier === "premium" || freemiumTier === "max";

  return (
    <>
      <div className="fixed left-4 top-4 z-50 sm:left-6 sm:top-6">
        <Link
          href="/"
          aria-label={isFr ? "Retour" : "Back"}
          className="group inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0a0a0e]/85 px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 transition-all hover:border-white/30 hover:bg-[#0a0a0e]"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {isFr ? "Retour" : "Back"}
        </Link>
      </div>
      <div className="absolute sm:fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle paid={themePaid} />
        <AuthNav />
      </div>
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
      {!user && (
        <Suspense fallback={null}>
          <AuthRequiredBanner />
          <AuthModal />
        </Suspense>
      )}
    </>
  );
}
