"use client";

/**
 * Bloc "Actions les plus populaires" intégré sous le grid principal de la
 * home V175/V18 (Yann 16 mai 2026 04h45).
 *
 * Version compacte de la page /populaire-investisseurs :
 *   - mini-tabs marchés (drapeaux uniquement, sticky horizontal scroll)
 *   - top 10 du marché actif en cards compactes 2 colonnes
 *   - CTA "Voir tout le classement →" → /populaire-investisseurs
 *
 * Données chargées côté client depuis /api/popular-stocks (plus léger
 * qu'embarquer le JSON entier). Si l'endpoint n'existe pas encore, on
 * fallback sur fetch direct du JSON public.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

type PopularRow = {
  ticker: string;
  displayTicker?: string;
  name: string;
  rank: number;
  country?: string;
};

type PopularData = Record<string, PopularRow[]> & {
  _meta?: { window?: string; source?: string };
};

const TABS: { key: string; flag: string; country: string }[] = [
  { key: "world", flag: "🌍", country: "" },
  { key: "en", flag: "🇺🇸", country: "US" },
  { key: "fr", flag: "🇫🇷", country: "FR" },
  { key: "en-GB", flag: "🇬🇧", country: "GB" },
  { key: "de", flag: "🇩🇪", country: "DE" },
  { key: "nl", flag: "🇳🇱", country: "NL" },
  { key: "sv", flag: "🇸🇪", country: "SE" },
  { key: "da", flag: "🇩🇰", country: "DK" },
  { key: "de-CH", flag: "🇨🇭", country: "CH" },
];

const TAB_LABELS_FR: Record<string, string> = {
  world: "Monde",
  en: "USA",
  fr: "France",
  "en-GB": "Royaume-Uni",
  de: "Allemagne",
  nl: "Pays-Bas",
  sv: "Suède",
  da: "Danemark",
  "de-CH": "Suisse",
};

const TAB_LABELS_EN: Record<string, string> = {
  world: "World",
  en: "USA",
  fr: "France",
  "en-GB": "UK",
  de: "Germany",
  nl: "Netherlands",
  sv: "Sweden",
  da: "Denmark",
  "de-CH": "Switzerland",
};

const EXCHANGE_SUFFIXES = [
  ".SW", ".PA", ".L", ".DE", ".AS", ".ST", ".CO", ".MI", ".MC",
  ".HE", ".OL", ".T", ".HK", ".TO", ".AX", ".BR", ".LS", ".VI",
  ".IR", ".SS",
];

/** Tickers gardent leur suffixe pour éviter conflits homonymes
 *  cross-marché : CFR.SW (Richemont) vs CFR US (Cullen/Frost Bankers),
 *  ROG.SW (Roche) vs ROG US (Rogers Corp). */
const PRESERVE_SUFFIX = new Set(["CFR.SW", "ROG.SW"]);

function stripSuffix(ticker: string): string {
  const up = ticker.toUpperCase();
  if (PRESERVE_SUFFIX.has(up)) return up;
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) return up.slice(0, -suf.length);
  }
  return up;
}

export function HomePopularBlock({
  locale,
  routePrefix,
  t,
}: {
  locale: string;
  routePrefix?: string;
  t: (k: string) => string;
}) {
  const [data, setData] = useState<PopularData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("world");

  // Fetch JSON public au mount.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Le JSON est dans src/data/ — pas dans /public. On passe par
        // l'API populaire-investisseurs page côté SSR habituellement,
        // mais ici on a besoin client-side. On expose donc le JSON
        // via un fetch sur /populaire-investisseurs.json (à créer)
        // ou via une copie dans /public/data/.
        // Quick path : utiliser l'API JSON simple créée pour ce besoin.
        const r = await fetch("/api/popular-stocks", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as PopularData;
        if (!cancel) setData(j);
      } catch {
        // silencieux : le bloc se masque si pas de data
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Auto-select onglet visiteur depuis la locale (FR → fr, EN → en, etc).
  useEffect(() => {
    const visitorTab = TABS.find((tb) => tb.key === locale)?.key ?? "world";
    setActiveTab(visitorTab);
  }, [locale]);

  const labels = locale === "fr" ? TAB_LABELS_FR : TAB_LABELS_EN;

  const rows = useMemo<PopularRow[]>(() => {
    if (!data) return [];
    const list = data[activeTab];
    // Yann 16 mai 2026 : top 20 (au lieu de top 10) sur la home.
    return Array.isArray(list) ? list.slice(0, 20) : [];
  }, [data, activeTab]);

  if (!data || rows.length === 0) return null;

  const buildCompanyHref = (ticker: string): string => {
    return routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;
  };

  return (
    <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <div className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
        {t("home.popular.title")}
      </div>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-zinc-400">
        {t("home.popular.subtitle")}
      </p>

      {/* Tabs marchés (compact, scroll horizontal mobile) */}
      <div className="mb-5 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full justify-center gap-1.5">
          {TABS.map((tb) => {
            const isActive = tb.key === activeTab;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setActiveTab(tb.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-violet-500/20 to-cyan-500/10 text-zinc-50 ring-1 ring-violet-500/30"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                <span className="mr-1.5 text-[12.5px]">{tb.flag}</span>
                {labels[tb.key] || tb.key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 10 cards compactes 2 colonnes */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <a
            key={r.ticker}
            href={buildCompanyHref(r.ticker)}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-2.5 transition-all hover:border-violet-500/30 hover:bg-violet-500/[0.04]"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.04] font-mono text-[11px] font-bold text-zinc-300">
              {r.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 font-display text-[13px] font-semibold text-zinc-50">
                {r.name}
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {r.displayTicker ?? stripSuffix(r.ticker)}
              </div>
            </div>
            <ArrowRight className="hidden size-3.5 shrink-0 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-violet-300 sm:block" />
          </a>
        ))}
      </div>

      {/* CTA voir tout le classement */}
      <div className="mt-5 flex justify-center">
        <a
          href="/populaire-investisseurs"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] px-3.5 py-2 text-[12.5px] font-medium text-violet-100 transition-all hover:bg-violet-500/15"
        >
          {t("home.popular.see_all")}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  );
}
