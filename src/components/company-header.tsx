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
import { displayTicker } from "@/lib/ticker-display";
import { isBlockDisabledForTicker } from "@/lib/disabled-blocks";

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

function CompanyName({
  name,
  ticker,
  accent,
  allTickers,
}: {
  name: string;
  ticker: string;
  accent: string;
  allTickers?: Set<string> | ReadonlySet<string>;
}) {
  // Liste les alias pointant vers ce ticker canonique (ex : GOOG → GOOGL)
  // pour les afficher en sous-classe à côté du ticker principal.
  const aliases = Object.entries(TICKER_ALIASES)
    .filter(([, target]) => target === ticker)
    .map(([alias]) => alias);
  // Yann 21 mai 2026 : masquage suffixe ticker (.PA, .SW, .L, etc) sauf
  // doublons connus (ASML/ASMLF, GOOG/GOOGL...). L'URL et le code utilisent
  // toujours le ticker complet (ex NESN.SW), seul l'affichage est masqué.
  const tickerShown = displayTicker(ticker, allTickers ?? new Set());
  // Inclut les aliases (techniques) à l'affichage en gardant leur forme
  // canonique. displayTicker ne s'applique qu'au ticker principal.
  // Yann 25 mai 2026 : seuils encore plus serrés pour éliminer tout
  // scroll horizontal sur le nom (bug observé sur sociétés à nom long).
  // Court ≤ 14 → 1.7rem/2rem, moyen ≤ 22 → 1.35rem/1.6rem,
  // long ≤ 30 → 1.1rem/1.3rem, très long > 30 → 0.9rem/1.1rem.
  const len = name.length;
  const fontSize = len <= 14
    ? "text-[1.7rem] sm:text-[2rem]"
    : len <= 22
      ? "text-[1.35rem] sm:text-[1.6rem]"
      : len <= 30
        ? "text-[1.1rem] sm:text-[1.3rem]"
        : "text-[0.9rem] sm:text-[1.1rem]";
  return (
    <div className="group/name flex flex-nowrap items-baseline gap-x-3 min-w-0 max-w-full">
      <h1
        className={`relative ${fontSize} font-bold tracking-tight text-zinc-50 truncate min-w-0`}
        style={{ lineHeight: 1.2 }}
        title={name}
      >
        <span className="relative inline-block max-w-full truncate align-bottom">
          {name}
          <span
            className="pointer-events-none absolute -bottom-1 left-0 h-[3px] w-0 rounded-full transition-[width] duration-500 ease-out group-hover/name:w-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${accent}88, transparent)`,
            }}
          />
        </span>
      </h1>
      <span className="font-mono text-base font-semibold sm:text-lg whitespace-nowrap shrink-0" style={{ color: accent }}>
        {tickerShown}
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
/**
 * Yann 19 mai 2026 : retire le suffixe " dans/in/i <sector_name>" du
 * rank value pour les chips où le label affiche DÉJÀ le secteur. Garde
 * uniquement le numéro de rang ("#3", "Top 5%", "≈ #150", etc.).
 *
 * Avant : "TECHNOLOGIE | #3 dans Technologies de l'information"
 * Après : "TECHNOLOGIE | #3"
 */
function stripRankSuffix(value: string): string {
  if (!value || typeof value !== "string") return value;
  // Coupe à la 1re occurrence de " dans ", " in ", ou " i " (locale-aware).
  for (const sep of [" dans ", " in ", " i "]) {
    const idx = value.indexOf(sep);
    if (idx > 0) return value.slice(0, idx).trim();
  }
  return value;
}

function translateRankPreposition(value: string, locale: string): string {
  if (!value || typeof value !== "string") return value;
  const rankPrepByLocale: Record<string, string> = {
    "fr": "dans",
    "en": "in",
    "en-GB": "in",
    "de": "in",
    "de-CH": "in",
    "nl": "in",
  };
  const target = rankPrepByLocale[locale] ?? rankPrepByLocale.fr;
  // 1. Translate prepostion FR → locale
  let out = target === "dans" ? value : value.replace(/\bdans\b/g, target);
  // 2. Yann 18 mai 2026 : also translate the sector NAME in "#7 dans/in X"
  // → translateSubsectorLocale applied to the trailing sector name.
  const sep = target === "in" ? " in " : " dans ";
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
  allTickers,
  freeBlocked = false,
}: {
  company: Company;
  hidePriceBar?: boolean;
  /**
   * Set des tickers de l'univers courant (V1, V1.7, V1.8, etc.). Permet
   * à `displayTicker` de détecter les doublons short (ex ROG.SW vs ROG)
   * et de garder le suffixe dans ce cas. Optionnel : si absent, seules
   * les exceptions explicites (ASML/ASMLF, GOOG/GOOGL...) gardent le
   * suffixe. Le ticker technique (URL, dataset) reste inchangé.
   */
  allTickers?: Set<string> | ReadonlySet<string>;
  /** Yann (25 mai 2026) : floute stock price + market cap en mode free. */
  freeBlocked?: boolean;
}) {
  const accent = brand(company.ticker).primary;
  const { t, locale } = useT();
  // Yann 29 mai 2026 : toggle global/per-sté pour masquer le bloc logo
  // (header). Quand désactivé : layout alternatif sans le carré 56-64px,
  // nom + catégorie + tagline alignés à gauche du conteneur.
  const logoDisabled = isBlockDisabledForTicker(company.ticker, "logo");

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        {!logoDisabled && <LogoTilt ticker={company.ticker} />}
        <div className="min-w-0 flex-1">
          <CompanyName name={company.name} ticker={company.ticker} accent={accent} allTickers={allTickers} />
          <div className="mt-1.5 text-[14px] text-zinc-400">
            {translateSubsectorLocale(company.sector, locale)} <span className="text-zinc-700">·</span> {translateSubsectorLocale(company.subsector, locale)}
          </div>
          {/* Yann 14 mai 2026 : tagline obligatoirement sur 1 ligne (truncate).
              Yann 28 mai 2026 : sur les pages non-EN, afficher la tagline
              localisée si disponible dans `tagline_i18n[locale]` (peuplée
              par enrich.tagline_fr + overlay i18n DE/NL). Fallback sur l'EN
              original. Un tooltip "i" affiche l'EN d'origine pour traçabilité
              quand la traduction est rendue. Normalisation locale fr-FR → fr,
              de-CH → de, en-GB → en pour matcher les clés tagline_i18n. */}
          {(() => {
            const normalizedLocale = (locale || "")
              .toLowerCase()
              .replace(/^fr-.*/, "fr")
              .replace(/^de-.*/, "de")
              .replace(/^en-.*/, "en");
            const taglineI18n = (company as Company & { tagline_i18n?: Record<string, string> }).tagline_i18n;
            const isPageEn = normalizedLocale === "en";
            const translation = !isPageEn && taglineI18n
              ? taglineI18n[normalizedLocale] || taglineI18n[locale]
              : undefined;
            const displayed = translation || company.tagline;
            const showOriginalTooltip = Boolean(translation) && translation !== company.tagline;
            return (
              <div className="mt-2 flex max-w-2xl items-center gap-1.5">
                <p
                  className="truncate text-[14.5px] italic leading-relaxed text-zinc-400"
                  title={displayed}
                >
                  “{displayed}”
                </p>
                {showOriginalTooltip && (
                  <InfoTooltip align="left" size="sm">
                    <div className="text-[13px] italic leading-relaxed text-zinc-200">
                      “{company.tagline}”
                    </div>
                  </InfoTooltip>
                )}
              </div>
            );
          })()}
        </div>
        {!hidePriceBar && <StockPriceBlock company={company} freeBlocked={freeBlocked} />}
      </div>

      {/* Yann (12 mai 2026) : tous les rangs sur UNE ligne horizontale.
          flex-nowrap + overflow-x-auto = scroll discret si overflow petit
          écran. Rang USA masqué pour les sés non-US (cat 3 EU). */}
      <div className="mt-5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StatChip label={t("company.rank_world")} value={company.ranks.global_world} />
        {isUsOrAdr(company.ticker) && company.ranks.global_us && company.ranks.global_us.trim() !== "" && company.ranks.global_us !== "-" && (
          <StatChip label={t("company.rank_us")} value={company.ranks.global_us} />
        )}
        {/* Yann 19 mai 2026 : strip le suffixe "dans <sector_name>" sur les
            chips sector + subsector car le label affiche DÉJÀ le nom du
            secteur. Évite la redondance "TECHNOLOGIE #3 dans Technologies
            de l'information" (= "Technology" répété 2 fois dans 1 chip). */}
        <StatChip label={translateSubsectorLocale(company.sector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.sector, locale))} />
        <StatChip label={translateSubsectorLocale(company.subsector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.subsector, locale))} />
        <StatChip label={t("company.founded")} value={company.founded != null ? String(company.founded) : null} />
        <StatChip label={t("company.ipo")} value={company.ipo != null ? String(company.ipo) : null} />
      </div>
      {/* Yann 26 mai 2026 : provenance déplacée TOUT EN BAS de la page société
          (voir CompanyView footer). Plus de mention "i" en haut près du nom. */}
    </div>
  );
}
