"use client";

/**
 * Bloc "Actions les plus populaires" intégré sous le grid principal de la
 * home V175/V18 (Yann 16 mai 2026 04h45, refonte 17 mai + 18 mai 2026).
 *
 * Refonte Yann 18 mai 2026 (sans 2ème ligne déséquilibrée) :
 *   - tabs zones géo : grid 3×3 mobile / grid-cols-9 desktop, équilibré, jamais d'orphan
 *   - hover preview : popover sous le tab survolé, top 3 stés du pays
 *   - PV Mettrik réelle : pill YoY (vert/rouge) + chip tier qualité Mettrik
 *     (Excellent/Bon/Moyen/Faible) sur la barre violet/cyan
 *
 * Données : /api/popular-stocks (SSR enrichi : hero_yoy + hero_short + tier).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Crown } from "lucide-react";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

export type PopularRow = {
  ticker: string;
  displayTicker?: string;
  name: string;
  rank: number;
  country?: string;
  // Yann 18 mai 2026 — PV Mettrik (enrichies SSR via /api/popular-stocks)
  hero_yoy?: string;
  hero_short?: string;
  tier?: "excellent" | "bon" | "moyen" | "faible";
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
  { key: "de-CH", flag: "🇨🇭", country: "CH" },
];

const TAB_LABELS_FR: Record<string, string> = {
  world: "Monde",
  en: "USA",
  fr: "France",
  "en-GB": "UK",
  de: "Allemagne",
  nl: "Pays-Bas",
  "de-CH": "Suisse",
};

const TAB_LABELS_EN: Record<string, string> = {
  world: "World",
  en: "USA",
  fr: "France",
  "en-GB": "UK",
  de: "Germany",
  nl: "Netherlands",
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

// === PV components ============================================================

/** Pill YoY colorée — Hero KPI Mettrik (vert/rouge/neutre). */
function HeroYoyPill({ yoy, label, size = "sm" }: { yoy: string; label?: string; size?: "xs" | "sm" }) {
  const num = parseFloat(yoy.replace(/[+,\s%]/g, "").replace(/^-/, "-"));
  const tone =
    Number.isFinite(num) && num > 0
      ? { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/30" }
      : Number.isFinite(num) && num < 0
        ? { bg: "bg-rose-500/15", text: "text-rose-300", ring: "ring-rose-500/30" }
        : { bg: "bg-zinc-500/15", text: "text-zinc-300", ring: "ring-zinc-500/30" };
  const padding = size === "xs" ? "px-1.5 py-0" : "px-2 py-0.5";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md ${padding} font-mono ${text} font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
      title={label ? `Croissance YoY du KPI principal Mettrik : ${label}` : "Croissance YoY du KPI principal Mettrik"}
    >
      {yoy.startsWith("+") || yoy.startsWith("-") ? yoy : `+${yoy}`}
    </span>
  );
}

const TIER_STYLE = {
  excellent: { label: "Excellent", text: "text-emerald-300", dot: "bg-emerald-400" },
  bon:       { label: "Bon",       text: "text-lime-300",    dot: "bg-lime-400" },
  moyen:     { label: "Moyen",     text: "text-amber-300",   dot: "bg-amber-400" },
  faible:    { label: "Faible",    text: "text-rose-300",    dot: "bg-rose-400" },
} as const;

function TierBadge({ tier }: { tier: "excellent" | "bon" | "moyen" | "faible" }) {
  const s = TIER_STYLE[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${s.text}`}
      title="Qualité Mettrik du KPI principal"
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// === Cards ====================================================================

export function PodiumCard({
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
      {/* Yann 19 mai 2026 : KPI pill/tier/label retirés du bloc populaire
          (focus ranking pur). HeroYoyPill et TierBadge restent définis
          pour usage éventuel ailleurs (preview hover, etc.). */}
      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={`h-full rounded-full ${rank === 1 ? "bg-amber-400" : rank === 2 ? "bg-zinc-300" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </a>
  );
}

export function StockRow({
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
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {row.displayTicker ?? stripSuffix(row.ticker)}
          </span>
          {row.country && row.country !== "US" && (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
              {row.country}
            </span>
          )}
          {/* Yann 19 mai 2026 : tier + KPI label retirés (focus ranking). */}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* Yann 19 mai 2026 : HeroYoyPill retirée du StockRow populaire. */}
        <ArrowRight className="hidden size-3.5 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-violet-300 sm:block" />
      </div>
    </a>
  );
}

// === Hover preview popover (top 3 stés du pays survolé) ======================

function TabHoverPreview({
  rows,
  label,
  buildHref,
}: {
  rows: PopularRow[];
  label: string;
  buildHref: (t: string) => string;
}) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-60 -translate-x-1/2 rounded-xl border border-violet-500/25 bg-[#0a0a0e]/95 p-3 shadow-2xl backdrop-blur-md">
      {/* petite flèche pointant vers le tab */}
      <div className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-l border-t border-violet-500/25 bg-[#0a0a0e]/95" />
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
        Aperçu · Top 3 {label}
      </div>
      <div className="pointer-events-auto mt-2 space-y-1">
        {rows.slice(0, 3).map((r, i) => (
          <a
            key={r.ticker}
            href={buildHref(r.ticker)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded bg-violet-500/15 font-mono text-[10px] font-bold text-violet-200">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-zinc-100">
                {r.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {r.displayTicker ?? stripSuffix(r.ticker)}
                </span>
                {/* Yann 19 mai 2026 : HeroYoyPill retirée du hover preview. */}
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-1.5 text-center text-[9.5px] text-zinc-500">
        Cliquer le drapeau pour activer
      </div>
    </div>
  );
}

// === Main block ===============================================================

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
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);

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

  const handleEnter = useCallback((key: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoveredTab(key), 220);
  }, []);
  const handleLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoveredTab(null);
  }, []);

  if (!data || rows.length === 0) return null;

  const buildCompanyHref = (ticker: string): string => {
    return routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;
  };

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const totalShown = rows.length;

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

      {/* Yann 18 mai 2026 : refonte zones géo.
          - Grid 3×3 sur mobile (parfaitement équilibré, jamais d'orphan)
          - Grid 9 colonnes sur desktop (1 seule ligne, équidistant)
          - Hover preview popover (top 3 stés du pays survolé, 220 ms delay)
          - Layout vertical par cellule : drapeau + label en colonne pour
            une lecture rapide et un footprint compact. */}
      <div className="relative mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-9">
          {TABS.map((tb) => {
            const isActive = tb.key === activeTab;
            const tabRows = data[tb.key];
            const hasPreview = Array.isArray(tabRows) && tabRows.length > 0;
            const isHovered = hoveredTab === tb.key && hasPreview;
            return (
              <div key={tb.key} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveTab(tb.key)}
                  onMouseEnter={() => handleEnter(tb.key)}
                  onMouseLeave={handleLeave}
                  onFocus={() => handleEnter(tb.key)}
                  onBlur={handleLeave}
                  className={`group flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 transition-all ${
                    isActive
                      ? "bg-gradient-to-br from-violet-500/25 to-cyan-500/15 text-zinc-50 ring-1 ring-violet-500/30"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                  }`}
                  aria-label={labels[tb.key] || tb.key}
                  aria-pressed={isActive}
                >
                  <span className="text-[18px] leading-none transition-transform group-hover:scale-110">
                    {tb.flag}
                  </span>
                  <span className="text-[10.5px] font-medium leading-none">
                    {labels[tb.key] || tb.key}
                  </span>
                </button>
                {isHovered && (
                  <TabHoverPreview
                    rows={tabRows as PopularRow[]}
                    label={labels[tb.key] || tb.key}
                    buildHref={buildCompanyHref}
                  />
                )}
              </div>
            );
          })}
        </div>
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
