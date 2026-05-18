"use client";

import { useState, useRef } from "react";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { StockPriceBlock } from "@/components/stock-price-block";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { translateSubsector, translateSubsectorLocale } from "@/lib/ui-fix-templates";

/**
 * 2 different hover effects, applied ONLY on logo + name:
 *  - Logo: subtle 3D tilt + spring scale on hover
 *  - Name: animated underline (gradient sweep, brand color) on hover
 */
function LogoTilt({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, scale: 1 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -y * 18, y: x * 18, scale: 1.06 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0, scale: 1 });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-logo="true"
      aria-label={`${ticker} logo`}
      className={`logo-wrapper h-9 w-12 shrink-0 rounded-lg border p-1 transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:h-11 sm:w-14 ${
        logoNeedsLightBg(ticker)
          ? "border-[#e5e5e5] bg-[#fafafa]"
          : "border-[#1f1f1f] bg-[#0a0a0a]"
      }`}
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.scale})`,
        transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms",
        transformStyle: "preserve-3d",
      }}
    >
      <CompanyLogo ticker={ticker} />
    </div>
  );
}

function CompanyName({ name, ticker, accent }: { name: string; ticker: string; accent: string }) {
  // Liste les alias pointant vers ce ticker canonique (ex : GOOG → GOOGL)
  // pour les afficher en sous-classe à côté du ticker principal.
  const aliases = Object.entries(TICKER_ALIASES)
    .filter(([, target]) => target === ticker)
    .map(([alias]) => alias);
  // Yann 16 mai 2026 (v2, post-BABA overflow) : seuils plus serrés pour
  // que les noms longs (~29 char comme "Alibaba Group Holding Limited")
  // tiennent en 1 ligne sans dépasser. Court ≤ 18 → 1.9rem/2.3rem,
  // moyen ≤ 26 → 1.5rem/1.8rem, long ≤ 34 → 1.2rem/1.45rem (BABA ici),
  // très long > 34 → 1.0rem/1.25rem.
  const len = name.length;
  const fontSize = len <= 18
    ? "text-[1.9rem] sm:text-[2.3rem]"
    : len <= 26
      ? "text-[1.5rem] sm:text-[1.8rem]"
      : len <= 34
        ? "text-[1.2rem] sm:text-[1.45rem]"
        : "text-[1rem] sm:text-[1.25rem]";
  return (
    <div className="group/name flex flex-nowrap items-baseline gap-x-3 min-w-0">
      <h1
        className={`relative ${fontSize} font-bold tracking-tight text-zinc-50 whitespace-nowrap overflow-x-hidden overflow-y-visible text-ellipsis min-w-0`}
        style={{ lineHeight: 1.2 }}
        title={name}
      >
        <span className="relative inline-block max-w-full overflow-x-hidden overflow-y-visible text-ellipsis whitespace-nowrap align-bottom">
          {name}
          <span
            className="pointer-events-none absolute -bottom-1 left-0 h-[3px] w-0 rounded-full transition-[width] duration-500 ease-out group-hover/name:w-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)`,
            }}
          />
        </span>
      </h1>
      <span className="font-mono text-lg font-semibold sm:text-xl whitespace-nowrap shrink-0" style={{ color: accent }}>
        {ticker}
        {aliases.length > 0 && (
          <span className="ml-1 text-[0.75em] font-medium text-zinc-400">
            {" / "}{aliases.join(" / ")}
          </span>
        )}
      </span>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string | null | undefined }) {
  // Yann (12 mai 2026) : chips compactes pour tenir tous les rangs sur
  // 1 ligne horizontale. Labels plus petits, padding réduit.
  // Yann (15 mai 2026) : guard anti-"null" en plein texte. Si value est
  // null / undefined / chaîne "null" / "undefined" / "None", on masque la
  // chip plutôt que d'afficher "null" visuellement.
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "null" || v.toLowerCase() === "undefined" || v === "None") {
    return null;
  }
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5 rounded-lg border border-[#262626] bg-[#0c0c0c] px-2 py-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="font-sans text-[12.5px] font-bold text-zinc-50">{v}</span>
    </span>
  );
}

/**
 * Yann (12 mai 2026) : "Rang USA" doit être masqué pour les sés non-US
 * (= FPI EU pures avec un `.` dans le ticker : .PA, .L, .DE, .SW, .MI,
 * .ST, .OL, .HE, .AS, .MC, .CO, .T, etc.). Cat 1 (US sans suffixe) +
 * cat 2 (FPI ADR sans suffixe, listée US) = on garde la chip.
 */
function isUsOrAdr(ticker: string): boolean {
  return !ticker.includes(".") && !ticker.includes("-");
}

/**
 * Yann (15 mai 2026) : les fichiers ranks.json contiennent des strings
 * type "#37 dans Information Technology" générées côté pipeline FR.
 * On traduit la préposition au rendu selon la locale active (pas de
 * re-extraction massive). Tout le reste (rang + secteur) reste inchangé.
 */
function translateRankPreposition(value: string, locale: string): string {
  if (!value || typeof value !== "string") return value;
  const rankPrepByLocale: Record<string, string> = {
    "fr": "dans",
    "en": "in",
    "en-GB": "in",
    "de": "in",
    "de-CH": "in",
    "nl": "in",
    "sv": "i",
    "da": "i",
  };
  const target = rankPrepByLocale[locale] ?? rankPrepByLocale.fr;
  // 1. Translate prepostion FR → locale
  let out = target === "dans" ? value : value.replace(/\bdans\b/g, target);
  // 2. Yann 18 mai 2026 : also translate the sector NAME in "#7 dans/in X"
  // → translateSubsectorLocale applied to the trailing sector name.
  const sep = target === "i" ? " i " : target === "in" ? " in " : " dans ";
  const idx = out.indexOf(sep);
  if (idx > -1) {
    const prefix = out.slice(0, idx + sep.length);
    const sector = out.slice(idx + sep.length).trim();
    const translated = translateSubsectorLocale(sector, locale);
    out = prefix + translated;
  }
  return out;
}

export function CompanyHeader({
  company,
  hidePriceBar = false,
}: {
  company: Company;
  hidePriceBar?: boolean;
}) {
  const accent = brand(company.ticker).primary;
  const { t, locale } = useT();

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <LogoTilt ticker={company.ticker} />
        <div className="min-w-0 flex-1">
          <CompanyName name={company.name} ticker={company.ticker} accent={accent} />
          <div className="mt-1.5 text-[14px] text-zinc-400">
            {translateSubsectorLocale(company.sector, locale)} <span className="text-zinc-700">·</span> {translateSubsectorLocale(company.subsector, locale)}
          </div>
          {/* Yann 14 mai 2026 : tagline obligatoirement sur 1 ligne (truncate).
              Yann 16 mai 2026 (v2) : tagline garde la langue d'origine (EN
              per CLAUDE.md §6). Si la langue de la page diffère ET qu'une
              traduction existe dans `tagline_i18n[locale]`, afficher un "i"
              à côté avec la traduction. Sinon pas de "i". */}
          {(() => {
            const isPageEn = locale === "en" || locale === "en-GB";
            const translation = !isPageEn
              ? (company as Company & { tagline_i18n?: Record<string, string> }).tagline_i18n?.[locale]
              : undefined;
            return (
              <div className="mt-2 flex max-w-2xl items-center gap-1.5">
                <p
                  className="truncate text-[14.5px] italic leading-relaxed text-zinc-400"
                  title={company.tagline}
                >
                  “{company.tagline}”
                </p>
                {translation && (
                  <InfoTooltip align="left" size="sm">
                    <div className="text-[13px] italic leading-relaxed text-zinc-200">
                      “{translation}”
                    </div>
                  </InfoTooltip>
                )}
              </div>
            );
          })()}
        </div>
        {!hidePriceBar && <StockPriceBlock company={company} />}
      </div>

      {/* Yann (12 mai 2026) : tous les rangs sur UNE ligne horizontale.
          flex-nowrap + overflow-x-auto = scroll discret si overflow petit
          écran. Rang USA masqué pour les sés non-US (cat 3 EU). */}
      <div className="mt-5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StatChip label={t("company.rank_world")} value={company.ranks.global_world} />
        {isUsOrAdr(company.ticker) && (
          <StatChip label={t("company.rank_us")} value={company.ranks.global_us} />
        )}
        <StatChip label={translateSubsectorLocale(company.sector, locale)} value={translateRankPreposition(company.ranks.sector, locale)} />
        <StatChip label={translateSubsectorLocale(company.subsector, locale)} value={translateRankPreposition(company.ranks.subsector, locale)} />
        <StatChip label={t("company.founded")} value={company.founded != null ? String(company.founded) : null} />
        <StatChip label={t("company.ipo")} value={company.ipo != null ? String(company.ipo) : null} />
      </div>

      <p className="mt-3 max-w-3xl text-[11.5px] italic leading-relaxed text-zinc-500">
        {t("company.provenance")}
      </p>
    </div>
  );
}
