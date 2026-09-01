"use client";

import { useEffect, useRef } from "react";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { StockPriceBlock } from "@/components/stock-price-block";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { translateSubsector, translateSubsectorLocale } from "@/lib/ui-fix-templates";
import { displayTicker } from "@/lib/ticker-display";
import { employeeCountLabel } from "@/lib/employee-count";
import { isBlockDisabledForTicker } from "@/lib/disabled-blocks";
import { isBlockEnabled } from "@/lib/v1-9-blocks-control";

/**
 * Yann 4 juin 2026 v3 : ITERATION 3 du logo.
 * v1 : carre arrondi 36-44px (trop petit, Apple invisible).
 * v2 : rond 88-96px (trop gros, depasse le nom Apple + sub-titre).
 * v3 (capture Yann avec traits bleus) : carre-arrondi 60-64px qui matche
 *     la hauteur "Apple" + "Technologie - Matériel..." exactement.
 *     Forme : rounded-xl pour eliminer le bord noir vu sur TotalEnergies
 *     (logo PNG non-carre coince dans cercle laisse coins vides).
 *     Plus petit = plus lisible pour les logos PNG avec fond blanc + apple
 *     noir (taille relative compatible avec la zone disponible).
 */

/**
 * Yann 2 sept 2026 (mobile) : la rangee des chips de rang defile toute seule,
 * lentement (aller-retour), et reste deplacable au doigt : tout contact met
 * l auto-defilement en pause 5 s. Ne fait rien en desktop ni si tout tient.
 */
function useDefilementChips() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || window.innerWidth >= 640) return;
    let raf = 0;
    let pauseJusqua = performance.now() + 1500;
    const pause = () => { pauseJusqua = performance.now() + 5000; };
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("pointerdown", pause, { passive: true });
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // le contenu est duplique (2 series identiques) : quand on a defile
      // d une serie complete, on recale d une serie en arriere -> boucle
      // infinie invisible, toujours de droite a gauche, drag conserve.
      const demi = el.scrollWidth / 2;
      if (demi <= el.clientWidth * 0.6) return;
      if (now >= pauseJusqua) el.scrollLeft += 0.4;
      if (el.scrollLeft >= demi) el.scrollLeft -= demi;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("pointerdown", pause);
    };
  }, []);
  return ref;
}

function LogoTile({ ticker }: { ticker: string }) {
  return (
    <div
      data-logo="true"
      aria-label={`${ticker} logo`}
      className={`logo-wrapper relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 shadow-[0_3px_14px_rgba(0,0,0,0.4)] transition-shadow duration-300 hover:shadow-[0_6px_22px_rgba(0,0,0,0.55)] sm:h-[64px] sm:w-[64px] ${
        logoNeedsLightBg(ticker)
          ? "bg-white ring-black/15"
          : "bg-[#0a0a0a] ring-white/10"
      }`}
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
  alsoKnownLabel,
}: {
  name: string;
  ticker: string;
  accent: string;
  allTickers?: Set<string> | ReadonlySet<string>;
  alsoKnownLabel: string;
}) {
  // Yann 31 mai 2026 : liste les alias pointant vers ce ticker canonique
  // (ex : GOOG → GOOGL ; BRK.A/BRK-A/BRK.B → BRK-B ; FOX → FOXA ; NWSA → NWS ;
  // UAA → UA). Affichés en mention discrète "Aussi connue sous : GOOG"
  // sous le ticker principal (et non plus inline avec un slash, trop voyant).
  const aliases = Object.entries(TICKER_ALIASES)
    .filter(([, target]) => target === ticker)
    .map(([alias]) => alias);
  // Yann 21 mai 2026 : masquage suffixe ticker (.PA, .SW, .L, etc) sauf
  // doublons connus (ASML/ASMLF, GOOG/GOOGL...). L'URL et le code utilisent
  // toujours le ticker complet (ex NESN.SW), seul l'affichage est masqué.
  const tickerShown = displayTicker(ticker, allTickers ?? new Set());
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
    <div className="min-w-0 max-w-full">
      <div className="group/name flex flex-wrap sm:flex-nowrap items-baseline gap-x-3 gap-y-0.5 min-w-0 max-w-full">
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
        <span
          className="font-mono text-base font-semibold sm:text-lg whitespace-nowrap shrink-0"
          style={{ color: accent }}
        >
          {tickerShown}
        </span>
        {aliases.length > 0 && (
          <span className="text-[11px] font-medium text-zinc-500 whitespace-nowrap self-end pb-0.5">
            {alsoKnownLabel}{" "}
            <span className="font-mono text-zinc-400">{aliases.join(" / ")}</span>
          </span>
        )}
      </div>
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
  // Yann 28 aout 2026 : certaines fiches portent litteralement "Pas disponible"
  // ou "Not applicable" dans la donnee. Affichees telles quelles, elles
  // donnaient cinq pastilles vides a la suite dans l en tete (cas VMRK). Une
  // information absente ne merite pas une pastille : on masque.
  const absent = new Set([
    "pas disponible",
    "non disponible",
    "not applicable",
    "not available",
    "n/a",
    "na",
    "-",
    "—",
    "?",
  ]);
  if (absent.has(v.toLowerCase())) return null;
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
  disabledBlocks,
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
  /** Yann 9 juin 2026 : blocs désactivés résolus côté serveur (Supabase +
   *  fallback JSON). Si fourni, prime sur le fallback client
   *  `isBlockDisabledForTicker`. Les pages qui ne passent pas encore la
   *  prop (v1-8, v1-7-5) gardent le fallback JSON sans régression. */
  disabledBlocks?: string[];
}) {
  const chipsRef = useDefilementChips();
  const accent = brand(company.ticker).primary;
  const { t, locale } = useT();
  // Helper local : prop si fournie, sinon fallback isBlockDisabledForTicker.
  const isDisabled = (k: string): boolean =>
    disabledBlocks
      ? disabledBlocks.includes(k)
      : isBlockDisabledForTicker(company.ticker, k);
  // Yann 29 mai 2026 : toggle global/per-sté pour masquer le bloc logo
  // (header). Quand désactivé : layout alternatif sans le carré 56-64px,
  // nom + catégorie + tagline alignés à gauche du conteneur.
  // Yann 2 juin 2026 : second système de toggle (blocks-control V1.9.5)
  // ajoute aussi un switch "Logo société" — on combine les deux.
  const logoDisabled =
    isDisabled("logo") ||
    !isBlockEnabled("company_logo", company.ticker);

  return (
    <div className="mb-8">
      <div
        data-header-row="true"
        className="flex flex-wrap items-start gap-x-5 gap-y-4"
      >
        {!logoDisabled && <LogoTile ticker={company.ticker} />}
        <div className="min-w-0 flex-1">
          <CompanyName
            name={company.name}
            ticker={company.ticker}
            accent={accent}
            allTickers={allTickers}
            alsoKnownLabel={t("company.also_known_as")}
          />
          <div className="mt-1.5 text-[14px] text-zinc-400">
            {translateSubsectorLocale(company.sector, locale)} <span className="text-zinc-700">·</span> {translateSubsectorLocale(company.subsector, locale)}
          </div>
          {/* Yann (1er juin 05:15) : tagline supprimée de V1.9.5
              (risque hallucination LLM + Yann préfère épure).
              Pour réactiver, voir git history avant ce commit. */}
        </div>
        {!hidePriceBar && <StockPriceBlock company={company} freeBlocked={freeBlocked} />}
      </div>

      {/* Yann (12 mai 2026) : tous les rangs sur UNE ligne horizontale.
          flex-nowrap + overflow-x-auto = scroll discret si overflow petit
          écran. Rang USA masqué pour les sés non-US (cat 3 EU). */}
      {(() => {
        const chips = (
          <>
        <StatChip label={t("company.rank_world")} value={company.ranks.global_world} />
        {isUsOrAdr(company.ticker) && company.ranks.global_us && company.ranks.global_us.trim() !== "" && company.ranks.global_us !== "-" && (
          <StatChip label={t("company.rank_us")} value={company.ranks.global_us} />
        )}
        {/* Yann 19 mai 2026 : strip le suffixe "dans <sector_name>" sur les
            chips sector + subsector car le label affiche DÉJÀ le nom du
            secteur. Évite la redondance "TECHNOLOGIE #3 dans Technologies
            de l'information" (= "Technology" répété 2 fois dans 1 chip). */}
        {/* Yann 9 août 2026 : même garde que global_us sur "-" (sinon chip
            "Industrie -" quand le rang n'est pas sourcé, ex DG.PA/AC.PA). */}
        {company.ranks.sector && company.ranks.sector.trim() !== "" && company.ranks.sector.trim() !== "-" && (
          <StatChip label={translateSubsectorLocale(company.sector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.sector, locale))} />
        )}
        {company.ranks.subsector && company.ranks.subsector.trim() !== "" && company.ranks.subsector.trim() !== "-" && (
          <StatChip label={translateSubsectorLocale(company.subsector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.subsector, locale))} />
        )}
        <StatChip label={t("company.founded")} value={company.founded != null ? String(company.founded) : null} />
        <StatChip label={t("company.ipo")} value={company.ipo != null ? String(company.ipo) : null} />
        {/* Yann 25 aout 2026 : effectif extrait de la section Human Capital du
            dernier 10-K (Item 1). Uniquement les valeurs qui ont passe le
            controle de coherence (voir scripts d extraction) : les sociétés
            sans 10-K ou au chiffre non fiable n affichent pas la chip. */}
        <StatChip label={t("company.employees")} value={employeeCountLabel(company.ticker, locale)} />
          </>
        );
        return (
          <div ref={chipsRef} className="mt-5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-1.5">{chips}</div>
            {/* Yann 2 sept 2026 : copie pour la boucle infinie du defilement
                mobile (le bandeau avance de droite a gauche sans demi-tour).
                Desktop : une seule serie, pas d animation. */}
            <div aria-hidden className="flex shrink-0 items-center gap-1.5 sm:hidden">{chips}</div>
          </div>
        );
      })()}
      {/* Yann 26 mai 2026 : provenance déplacée TOUT EN BAS de la page société
          (voir CompanyView footer). Plus de mention "i" en haut près du nom. */}
    </div>
  );
}
