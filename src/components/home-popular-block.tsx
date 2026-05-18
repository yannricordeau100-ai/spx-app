"use client";

/**
 * Bloc "Actions les plus populaires" intégré sous le grid principal de la
 * home V175/V18 (Yann 16 mai 2026 04h45, refonte 17 mai 2026).
 *
 * Reprend le même visuel que /populaire-investisseurs :
 *   - tabs pays (drapeau + label)
 *   - podium top 3 (or/argent/bronze, PodiumCard)
 *   - liste cards rang+barre violet→cyan (StockRow)
 *   - CTA "Voir tout le classement →"
 *
 * Chaque lien sté est wrappé dans SignupGateOverlay si requireSignupGate.
 * Données : /api/popular-stocks (JSON serveur, léger côté client).
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, Crown } from "lucide-react";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

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

const PRESERVE_SUFFIX = new Set(["CFR.SW", "ROG.SW"]);

function stripSuffix(ticker: string): string {
  const up = ticker.toUpperCase();
  if (PRESERVE_SUFFIX.has(up)) return up;
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) return up.slice(0, -suf.length);
  }
  return up;
}

function rankBarPct(rank: number, totalShown: number): number {
  if (totalShown <= 1) return 100;
  const pct = 100 - ((rank - 1) / Math.max(totalShown - 1, 1)) * 90;
  return Math.max(pct, 8);
}

function PodiumCard({
  row,
  rank,
  totalShown,
  buildHref,
}: {
  row: PopularRow;
  rank: number;
  totalShown: number;
  buildHref: (t: string) => string;
}) {
  const pct = rankBarPct(rank, totalShown);
  const accent =
    rank === 1
      ? { bg: "from-amber-500/20 via-amber-500/8 to-transparent", border: "border-amber-500/40", text: "text-amber-200", chip: "bg-amber-500/15 text-amber-200 ring-amber-500/30" }
      : rank === 2
        ? { bg: "from-zinc-300/15 via-zinc-300/5 to-transparent", border: "border-zinc-400/30", text: "text-zinc-200", chip: "bg-zinc-400/15 text-zinc-200 ring-zinc-400/30" }
        : { bg: "from-orange-700/20 via-orange-700/8 to-transparent", border: "border-orange-600/30", text: "text-orange-200", chip: "bg-orange-700/15 text-orange-200 ring-orange-600/30" };

  return (
    <a
      href={buildHref(row.ticker)}
      className={`group relative block h-full overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.bg} p-4 transition-all hover:scale-[1.02] hover:shadow-lg`}
    >
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-white/[0.03] blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          {rank === 1 && <Crown className="size-4 text-amber-300" />}
          <span className={`inline-flex items-center rounded-md ${accent.chip} px-2 py-0.5 font-mono text-[10.5px] font-bold ring-1`}>
            #{rank}
          </span>
        </div>
        <ArrowRight className="size-3.5 text-zinc-500 transition-all group-hover:translate-x-1 group-hover:text-zinc-200" />
      </div>
      <div className="relative mt-3">
        <div className="line-clamp-2 font-display text-[15px] font-bold leading-tight text-zinc-50">
          {row.name}
        </div>
        <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {row.displayTicker ?? stripSuffix(row.ticker)}
        </div>
      </div>
      <div className="relative mt-3">
        <div className={`font-display text-[18px] font-bold leading-none tracking-tight ${accent.text}`}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"} Top {rank}
        </div>
      </div>
      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={`h-full rounded-full ${rank === 1 ? "bg-amber-400" : rank === 2 ? "bg-zinc-300" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </a>
  );
}

function StockRow({
  row,
  rank,
  totalShown,
  buildHref,
}: {
  row: PopularRow;
  rank: number;
  totalShown: number;
  buildHref: (t: string) => string;
}) {
  const pct = rankBarPct(rank, totalShown);
  return (
    <a
      href={buildHref(row.ticker)}
      className="group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-2.5 transition-all hover:border-violet-500/30 hover:bg-violet-500/[0.04]"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] font-mono text-[12px] font-bold text-zinc-300">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 font-display text-[13.5px] font-bold text-zinc-50">
          {row.name}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {row.displayTicker ?? stripSuffix(row.ticker)}
          </span>
          {row.country && row.country !== "US" && (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
              {row.country}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
      <ArrowRight className="hidden size-3.5 shrink-0 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-violet-300 sm:block" />
    </a>
  );
}

export function HomePopularBlock({
  locale,
  routePrefix,
  t,
  requireSignupGate = false,
  gatePath = "/",
}: {
  locale: string;
  routePrefix?: string;
  t: (k: string) => string;
  requireSignupGate?: boolean;
  gatePath?: string;
}) {
  const [data, setData] = useState<PopularData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("world");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/api/popular-stocks", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as PopularData;
        if (!cancel) setData(j);
      } catch {
        // silencieux
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const visitorTab = TABS.find((tb) => tb.key === locale)?.key ?? "world";
    setActiveTab(visitorTab);
  }, [locale]);

  const labels = locale === "fr" ? TAB_LABELS_FR : TAB_LABELS_EN;

  const rows = useMemo<PopularRow[]>(() => {
    if (!data) return [];
    const list = data[activeTab];
    return Array.isArray(list) ? list.slice(0, 20) : [];
  }, [data, activeTab]);

  if (!data || rows.length === 0) return null;

  const buildCompanyHref = (ticker: string): string => {
    return routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;
  };

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalShown = rows.length;

  // En grid : le card `<a>` doit être grid-child direct (auto-stretch).
  // Pour ça : Fragment quand pas de gate. Quand gate actif, SignupGateOverlay
  // wrappe dans <div className="relative"> qui devient le grid-child et est
  // stretché par défaut ; le `<a>` interne porte `block h-full` (PodiumCard)
  // ou `flex` (StockRow) pour remplir.
  const wrapGate = (key: string, child: React.ReactNode) =>
    requireSignupGate ? (
      <SignupGateOverlay key={key} enabled={requireSignupGate} gatePath={gatePath} initialAuthed={!requireSignupGate}>
        {child}
      </SignupGateOverlay>
    ) : (
      <Fragment key={key}>{child}</Fragment>
    );

  return (
    <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <div className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
        {t("home.popular.title")}
      </div>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-zinc-400">
        {t("home.popular.subtitle")}
      </p>

      {/* Yann 18 mai 2026 : zones géo visibles sans scroll latéral.
          Avant : `overflow-x-auto` + `inline-flex min-w-full` → 9 tabs
          forçaient le scroll en max-w-3xl (768px).
          Après : `flex flex-wrap justify-center` → 1 ligne quand assez
          large, sinon wrap propre sur 2 lignes centrées. Padding et
          tailles resserrés pour maximiser la chance de tenir sur 1 ligne
          tout en gardant la cible cliquable confortable (>32px). */}
      <div className="mb-5 flex flex-wrap justify-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5">
        {TABS.map((tb) => {
          const isActive = tb.key === activeTab;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setActiveTab(tb.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11.5px] font-medium leading-none transition-all ${
                isActive
                  ? "bg-gradient-to-br from-violet-500/25 to-cyan-500/15 text-zinc-50 ring-1 ring-violet-500/30"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
              aria-label={labels[tb.key] || tb.key}
            >
              <span className="text-[13px]">{tb.flag}</span>
              <span>{labels[tb.key] || tb.key}</span>
            </button>
          );
        })}
      </div>

      {podium.length === 3 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podium.map((r, i) =>
            wrapGate(r.ticker, <PodiumCard row={r} rank={i + 1} totalShown={totalShown} buildHref={buildCompanyHref} />),
          )}
        </div>
      )}

      <div className="space-y-2">
        {rest.map((r, i) =>
          wrapGate(r.ticker, <StockRow row={r} rank={i + 4} totalShown={totalShown} buildHref={buildCompanyHref} />),
        )}
      </div>

      <div className="mt-6 flex justify-center">
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
