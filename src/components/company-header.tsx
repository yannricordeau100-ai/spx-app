"use client";

import { useState, useRef } from "react";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { StockPriceBlock } from "@/components/stock-price-block";
import { useT } from "@/lib/i18n/provider";

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
      className={`h-16 w-24 shrink-0 rounded-2xl border p-2 transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:h-20 sm:w-28 ${
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
  return (
    <div className="group/name inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1
        className="relative text-[2.1rem] font-bold tracking-tight text-zinc-50 sm:text-[2.6rem]"
        style={{ lineHeight: 1.05 }}
      >
        <span className="relative inline-block">
          {name}
          <span
            className="pointer-events-none absolute -bottom-1 left-0 h-[3px] w-0 rounded-full transition-[width] duration-500 ease-out group-hover/name:w-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)`,
            }}
          />
        </span>
      </h1>
      <span className="font-mono text-lg font-semibold sm:text-xl" style={{ color: accent }}>
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2">
      <span className="text-[12px] font-medium text-zinc-300">
        {label}
      </span>
      <span className="font-sans text-[14px] font-bold text-zinc-50">{value}</span>
    </span>
  );
}

export function CompanyHeader({
  company,
  hidePriceBar = false,
}: {
  company: Company;
  hidePriceBar?: boolean;
}) {
  const accent = brand(company.ticker).primary;
  const { t } = useT();

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <LogoTilt ticker={company.ticker} />
        <div className="min-w-0 flex-1">
          <CompanyName name={company.name} ticker={company.ticker} accent={accent} />
          <div className="mt-1.5 text-[14px] text-zinc-400">
            {company.sector} <span className="text-zinc-700">·</span> {company.subsector}
          </div>
          <p className="mt-2 max-w-2xl text-[14.5px] italic leading-relaxed text-zinc-400">
            “{company.tagline}”
          </p>
        </div>
        {!hidePriceBar && <StockPriceBlock company={company} />}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <StatChip label={t("company.rank_world")} value={company.ranks.global_world} />
        <StatChip label={t("company.rank_us")} value={company.ranks.global_us} />
        <StatChip label={`${t("company.sector")} (${company.sector})`} value={company.ranks.sector} />
        <StatChip label={`${t("company.subsector")} (${company.subsector})`} value={company.ranks.subsector} />
        <StatChip label={t("company.founded")} value={String(company.founded)} />
        <StatChip label={t("company.ipo")} value={String(company.ipo)} />
      </div>

      <p className="mt-3 max-w-3xl text-[11.5px] italic leading-relaxed text-zinc-500">
        {t("company.provenance")}
      </p>
    </div>
  );
}
