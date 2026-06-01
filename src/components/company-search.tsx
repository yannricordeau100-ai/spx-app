"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Yann (26 mai 2026) : URL canonique de la DERNIÈRE version app pour
 * toute recherche. Centralisé ici → quand on passera à V2.0, V2.5, etc.
 * un seul endroit à modifier (cette ligne) et toutes les recherches
 * routent automatiquement vers la dernière version.
 */
const LATEST_VERSION_PATH = "/sandbox/v1-9-5";
const buildLatestHref = (ticker: string) => `${LATEST_VERSION_PATH}/${ticker.toLowerCase()}`;
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  COMPANIES,
  TICKERS,
  TICKER_ALIASES,
  getHero,
  formatUnit,
  formatKpiValue,
} from "@/lib/data";
import { brand } from "@/lib/brand";
import { yoyTone } from "@/lib/utils";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { AcronymHover } from "@/components/acronym-hover";
import { useT } from "@/lib/i18n/provider";
import { displayTicker } from "@/lib/ticker-display";
import {
  V17_SEARCH_INDEX,
  V17_SEARCH_BY_TICKER,
  V19_SEARCH_INDEX,
  V19_SEARCH_BY_TICKER,
  type V17SearchEntry,
  type V19SearchEntry,
} from "@/lib/v1-7/tickers-search-index";
import v19UniverseJson from "@/data/v1-9-universe.json";
import v195CleanAllJson from "@/data/v1-9-5-clean-all-tickers.json";

/**
 * Yann (30 mai 2026) : V1.9.5 strict = univers clean_all uniquement (652 stés
 * audit a-f + g-m). Les autres tickers du pipeline _merged.json (Pass 3
 * validés mais pas clean_all) sont volontairement masqués de la recherche
 * sinon `/sandbox/v1-9-5/<ticker>` redirige silencieusement vers l'overview
 * (cf. logique `loadCleanAllSet` côté page sté). Set figé au build.
 */
const V195_CLEAN_ALL_SET: ReadonlySet<string> = new Set(
  (v195CleanAllJson as { tickers: string[] }).tickers.map((t) => t.toUpperCase()),
);

/**
 * Yann 31 mai 2026 : déduplication des doublons class-shares (GOOG/GOOGL,
 * BRK.A/BRK.B, FOX/FOXA, NWS/NWSA, UA/UAA) dans la search.
 *
 * - ALIAS_KEYS_UPPER : tickers qui sont des ALIAS (= keys de TICKER_ALIASES).
 *   On les masque de la search pour ne montrer que le canonical.
 * - REVERSE_ALIASES : pour chaque canonical, la liste des alias qui pointent
 *   dessus. Utilisé pour étendre le matching (taper "GOOG" trouve GOOGL).
 */
const ALIAS_KEYS_UPPER: ReadonlySet<string> = new Set(
  Object.keys(TICKER_ALIASES).map((k) => k.toUpperCase()),
);

const REVERSE_ALIASES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [alias, target] of Object.entries(TICKER_ALIASES)) {
    const u = target.toUpperCase();
    if (!map[u]) map[u] = [];
    map[u].push(alias);
  }
  return map;
})();

/**
 * CompanySearch — barre de recherche unifiée, utilisée :
 *   - Sur la home (var. "hero", grande, hint ⌘K)
 *   - Dans le top-nav des pages société (var. "compact", icône + placeholder court)
 *
 * Fermée : pill arrondie (rounded-full).
 * Ouverte : overlay plein écran, modal centrée qui zoom depuis la pill via
 * `layoutId` (motion). Les résultats s'affichent en cartes riches : logo,
 * nom, ticker, secteur, valeur hero KPI + variation YoY colorée.
 *
 * Raccourcis : ⌘K / Ctrl+K pour ouvrir, ESC pour fermer.
 */

type Variant = "hero" | "compact";

export function CompanySearch({
  variant = "hero",
  placeholder,
  searchableTickers,
  totalLabel,
}: {
  variant?: Variant;
  placeholder?: string;
  /**
   * Restreint le scope de recherche à un sous-ensemble de tickers V1.7
   * (ex: 306 sur V1.8 = top 308 hors Chine). Si non fourni, recherche
   * dans toute la base V1.7 Pass 3 strict. Yann 8 mai 2026 : "la barre
   * de recherche doit être propre à chaque version".
   */
  searchableTickers?: string[];
  /** Override du compteur affiché (sinon = TICKERS V1 + V1.7 valid). */
  totalLabel?: number;
}) {
  const { t, locale } = useT();
  const ph =
    placeholder ??
    (variant === "hero"
      ? t("search.placeholder_hero")
      : t("search.placeholder_compact"));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl+K pour ouvrir, ESC pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input à l'ouverture + lock du scroll
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /**
   * Résultats unifiés V1 + V1.7 + V1.9. On filtre les entrées de chaque
   * source puis on priorise les 5 V1 en tête (plus riches : hero KPI,
   * secteur, etc.). Chaque résultat porte son origine ("v1" | "v17" | "v19")
   * pour que ResultCard route correctement :
   *   - v1    → `/<ticker>` (5 stés démo V1)
   *   - v17   → `/sandbox/v1-7-5/<ticker>` si Pass 3 validé, sinon
   *             `/sandbox/v1-8/<ticker>` (V1.8 relâché)
   *   - v19   → `/sandbox/v1-9/<ticker>` (fiche "en préparation" pour
   *             les 78 tickers EU absents de `_merged.json`)
   *
   * Sans query : on affiche 5 V1 + premier slice V1.7 (top alphabétique).
   *              Évite de charger 1607 cards à l'ouverture.
   * Avec query : on filtre toutes les sources, cap visuel 60 résultats.
   */
  // Set des 924 tickers V1.9 (union pour permettre de cherche les non-Pass3
  // qui sont dans V1.9 et router vers V1.8). Mémoïsé hors useMemo (constant).
  const v19UniverseSet = useMemo(() => {
    const u = v19UniverseJson as { ticker: string }[];
    return new Set(u.map((x) => x.ticker.toUpperCase()));
  }, []);

  // Set complet de tous les tickers de l'univers Mettrik (V1 + V1.7 +
  // V1.9). Utilisé par `displayTicker` pour détecter les doublons short
  // et garder le suffixe (.SW/.PA/.L/etc) quand ambigu (Yann 21 mai 2026).
  const allTickersSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of TICKERS) s.add(t.toUpperCase());
    for (const e of V17_SEARCH_INDEX) s.add(e.ticker.toUpperCase());
    for (const e of V19_SEARCH_INDEX) s.add(e.ticker.toUpperCase());
    return s;
  }, []);

  const results = useMemo<
    { ticker: string; source: "v1" | "v17" | "v19" }[]
  >(() => {
    const q = query.trim().toLowerCase();
    const v1Out: { ticker: string; source: "v1" }[] = [];
    const v17Out: { ticker: string; source: "v17" }[] = [];
    const v19Out: { ticker: string; source: "v19" }[] = [];

    // V1 (5 stés, riches)
    for (const t of TICKERS) {
      const aliases = Object.entries(TICKER_ALIASES)
        .filter(([, target]) => target === t)
        .map(([alias]) => alias.toLowerCase());
      const matches =
        !q ||
        t.toLowerCase().includes(q) ||
        aliases.some((a) => a.includes(q)) ||
        COMPANIES[t].name.toLowerCase().includes(q) ||
        COMPANIES[t].sector.toLowerCase().includes(q) ||
        COMPANIES[t].subsector.toLowerCase().includes(q);
      if (matches) v1Out.push({ ticker: t, source: "v1" });
    }

    // V1.7 : Pass 3 validées (route /sandbox/v1-7-5/<ticker>) + non-validées
    // PRÉSENTES DANS V1.9 (route /sandbox/v1-8/<ticker>). Décision Yann
    // 19 mai 2026 : la search V1.9 doit pouvoir trouver TOUS les tickers
    // de l'univers V1.9, y compris ceux dont l'extraction n'a pas été
    // validée Pass 3 (ils tomberont sur la fiche V1.8 relâchée).
    // Skip ceux déjà présents en V1 (évite doublon).
    // Si `searchableTickers` est fourni, on restreint le scope (ex V1.8
    // = top 308 hors Chine = 306 stés).
    const v1Set = new Set(TICKERS.map((t) => t.toUpperCase()));
    const scopeSet = searchableTickers
      ? new Set(searchableTickers.map((t) => t.toUpperCase()))
      : null;
    for (const e of V17_SEARCH_INDEX) {
      const upper = e.ticker.toUpperCase();
      if (v1Set.has(upper)) continue;
      // Yann 31 mai 2026 : dédup class-shares. On masque les tickers qui
      // sont des ALIAS (ex GOOG → GOOGL) pour ne montrer que le canonical
      // dans la search. La recherche par alias reste fonctionnelle via
      // REVERSE_ALIASES ci-dessous.
      if (ALIAS_KEYS_UPPER.has(upper)) continue;
      if (scopeSet && !scopeSet.has(upper)) continue;
      // Yann 30 mai 2026 : V1.9.5 strict = clean_all uniquement. Tout ticker
      // hors clean_all serait redirigé silencieusement vers l'overview au clic
      // (= bug "la recherche ne marche pas"). On filtre en amont pour ne
      // proposer que les fiches réellement accessibles.
      if (!V195_CLEAN_ALL_SET.has(upper)) continue;
      // Si pas Pass 3 validé : on l'inclut seulement s'il est dans l'univers
      // V1.9 (extension recherche EU). Comportement historique préservé pour
      // les non-V1.9 (non searchables).
      if (!e.validated && !v19UniverseSet.has(upper)) continue;
      const reverseAliases = REVERSE_ALIASES[upper] ?? [];
      const matches =
        !q ||
        e.ticker.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q) ||
        reverseAliases.some((a) => a.toLowerCase().includes(q));
      if (matches) v17Out.push({ ticker: e.ticker, source: "v17" });
    }

    // V1.9 missing : 78 tickers EU dans `v1-9-universe.json` MAIS absents
    // de `_merged.json`. Route /sandbox/v1-9/<ticker> ("Fiche en préparation").
    // Pas de filtrage scopeSet ici : V1.9 missing = scope dédié.
    for (const e of V19_SEARCH_INDEX) {
      const upper = e.ticker.toUpperCase();
      if (v1Set.has(upper)) continue;
      // Yann 31 mai 2026 : dédup class-shares (idem V17).
      if (ALIAS_KEYS_UPPER.has(upper)) continue;
      // Yann 30 mai 2026 : idem, V1.9.5 strict = clean_all uniquement.
      if (!V195_CLEAN_ALL_SET.has(upper)) continue;
      const reverseAliases = REVERSE_ALIASES[upper] ?? [];
      const matches =
        !q ||
        e.ticker.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.country?.toLowerCase().includes(q) ?? false) ||
        reverseAliases.some((a) => a.toLowerCase().includes(q));
      if (matches) v19Out.push({ ticker: e.ticker, source: "v19" });
    }

    return [...v1Out, ...v17Out, ...v19Out];
  }, [query, searchableTickers, v19UniverseSet]);

  // Compteur "X stés au total" : override fourni en prop, sinon V1 (5) +
  // V1.7 Pass 3 validées (le défaut historique).
  const totalCatalog =
    totalLabel ??
    (TICKERS.length + V17_SEARCH_INDEX.filter((e) => e.validated).length);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* PILL FERMÉ — bords ultra-arrondis, halo subtil violet/cyan au hover */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("search.placeholder_compact")}
        className={
          variant === "hero"
            ? "group relative inline-flex w-full max-w-2xl items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 px-5 py-3.5 text-left text-zinc-400 backdrop-blur-md transition-all hover:border-white/25 hover:text-zinc-200 hover:shadow-[0_0_40px_-10px_rgba(167,139,250,0.45)]"
            : "group relative inline-flex w-full max-w-xs items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 px-3.5 py-2 text-left text-zinc-400 backdrop-blur transition-all hover:border-white/25 hover:text-zinc-200"
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, rgba(167,139,250,0.18), rgba(34,211,238,0.18))",
            filter: "blur(14px)",
          }}
        />
        <Search
          className={
            variant === "hero"
              ? "relative size-5 text-zinc-500 transition-colors group-hover:text-violet-300"
              : "relative size-4 text-zinc-500 transition-colors group-hover:text-violet-300"
          }
        />
        <span
          className={
            variant === "hero"
              ? "relative flex-1 text-[15px]"
              : "relative flex-1 truncate text-[12.5px]"
          }
        >
          {ph}
        </span>
        <kbd
          className={
            variant === "hero"
              ? "relative inline-flex items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-zinc-400"
              : "relative hidden items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400 sm:inline-flex"
          }
        >
          ⌘K
        </kbd>
      </button>

      {/* OVERLAY OUVERT — full-screen, modal centrée qui zoom depuis la pill */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[150] flex items-start justify-center px-4 pt-[6vh] sm:pt-[10vh]"
          >
            {/* Backdrop */}
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={close}
              className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.92, y: -16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: -8, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0e]/95 shadow-[0_40px_120px_-20px_rgba(139,92,246,0.45)] backdrop-blur-xl"
            >
              {/* Halo violet/cyan en arrière-plan */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
              />

              {/* Champ de recherche */}
              <div className="relative flex items-center gap-3 border-b border-white/8 px-5 py-4">
                <Search className="size-5 text-violet-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ph}
                  // Coupe le correcteur auto sur tous les navigateurs (Safari,
                  // Chrome, Firefox, mobile + desktop). C'est une recherche
                  // de tickers / noms de société, pas de la rédaction libre :
                  // le correcteur transforme "MSCI" en "MISC" etc.
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="search"
                  enterKeyHint="search"
                  data-1p-ignore
                  data-lpignore="true"
                  onKeyDown={(e) => {
                    // Yann 14 mai 2026 : Entrée ouvre la sté quand 1 seul résultat.
                    // Yann 26 mai 2026 : toute recherche route vers la DERNIÈRE
                    // version (LATEST_VERSION_PATH), peu importe la source.
                    if (e.key === "Enter" && results.length === 1) {
                      e.preventDefault();
                      close();
                      router.push(buildLatestHref(results[0].ticker));
                    }
                  }}
                  className="flex-1 bg-transparent text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                    aria-label={t("common.close")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-white/10 sm:inline-flex"
                  aria-label={t("common.close")}
                >
                  ESC
                </button>
              </div>

              {/* Compteur résultats : visible vs catalogue total */}
              <div className="relative flex items-center justify-between px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <span>
                  {query ? (
                    <>
                      {results.length}{" "}
                      {results.length > 1
                        ? t("search.results_count_many")
                        : t("search.results_count_one")}
                      {` ${t("search.results_for")}${query}${t("search.results_for_end")}`}
                    </>
                  ) : (
                    <>
                      {locale === "fr" ? "Tape pour filtrer" : "Type to filter"}
                    </>
                  )}
                </span>
                <span className="text-zinc-600">{t("search.enter_to_open")}</span>
              </div>

              {/* Résultats */}
              <div className="relative max-h-[60vh] overflow-y-auto px-3 pb-4 pt-1">
                {results.length === 0 ? (
                  <div className="px-5 py-12 text-center text-[13.5px] text-zinc-500">
                    {t("search.no_results")}
                    {query}
                    {t("search.results_for_end")}
                    <div className="mt-2 text-[12px] text-zinc-600">
                      {t("search.no_results_hint")}
                    </div>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2">
                    {results.map((r) => (
                      <li key={`${r.source}-${r.ticker}`}>
                        {r.source === "v1" ? (
                          <ResultCard ticker={r.ticker} onSelect={close} allTickers={allTickersSet} />
                        ) : r.source === "v19" ? (
                          <ResultCardV19 ticker={r.ticker} onSelect={close} allTickers={allTickersSet} />
                        ) : (
                          <ResultCardV17 ticker={r.ticker} onSelect={close} allTickers={allTickersSet} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Carte résultat ───────────────────────────────────────────────── */
function ResultCard({
  ticker,
  onSelect,
  allTickers,
}: {
  ticker: string;
  onSelect: () => void;
  allTickers: Set<string> | ReadonlySet<string>;
}) {
  const c = COMPANIES[ticker];
  const hero = getHero(c);
  const tone = yoyTone(hero.yoy, hero.type);
  const yoyColor =
    tone === "pos" ? "#22c55e" : tone === "neg" ? "#ef4444" : "#a1a1aa";
  const accent = brand(ticker).primary;
  const heroUnit = formatUnit(hero.unit);
  const tickerShown = displayTicker(ticker, allTickers);

  return (
    <Link
      href={buildLatestHref(ticker)}
      onClick={onSelect}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      {/* Accent bar à gauche, pulsée au hover */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-bottom scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: accent }}
      />

      {/* Logo */}
      <div
        className={`size-12 shrink-0 rounded-xl border p-1.5 transition-transform duration-300 group-hover:scale-105 ${
          logoNeedsLightBg(ticker)
            ? "border-[#e5e5e5] bg-[#fafafa]"
            : "border-[#1f1f1f] bg-[#0a0a0a]"
        }`}
      >
        <CompanyLogo ticker={ticker} />
      </div>

      {/* Identité */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-zinc-50">
            {c.name}
          </span>
          <span
            className="font-mono text-[11px] font-bold tracking-wider"
            style={{ color: accent }}
          >
            {tickerShown}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-zinc-400">
          {c.sector} <span className="text-zinc-600">·</span> {c.subsector}
        </div>
      </div>

      {/* Hero KPI + delta */}
      <div className="hidden text-right sm:block">
        <AcronymHover
          align="right"
          label={`${hero.name_fr}${
            hero.name_en && hero.name_en !== hero.name_fr ? ` (${hero.name_en})` : ""
          }`}
        >
          <div className="cursor-help font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {hero.short}
          </div>
        </AcronymHover>
        <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-zinc-50">
          {formatKpiValue(hero.value, hero.unit)}
          {heroUnit && (
            <span className="ml-1 text-[10.5px] font-normal text-zinc-400">
              {heroUnit}
            </span>
          )}
        </div>
        <div
          className="mt-0.5 inline-flex items-center justify-end gap-0.5 font-mono text-[11px] tabular-nums"
          style={{ color: yoyColor }}
        >
          {tone === "pos" && <ArrowUpRight className="size-3" />}
          {tone === "neg" && <ArrowDownRight className="size-3" />}
          {hero.yoy}
        </div>
      </div>

      {/* Chevron */}
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-zinc-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
    </Link>
  );
}

/* ─── Carte résultat V1.7 (sté pipeline, format léger) ──────────────── */
/**
 * Variante de ResultCard pour les 1602 stés V1.7 (pipeline LLM).
 * On a moins d'info qu'en V1 : pas de hero KPI calculé, pas de yoy.
 * On affiche logo (placeholder ticker), nom, ticker, secteur, et un
 * petit chip "V1.7" pour signaler que c'est une fiche pipeline.
 * Route vers `/sandbox/v1-7/<ticker>` (la fiche V1.7).
 */
function ResultCardV17({
  ticker,
  onSelect,
  allTickers,
}: {
  ticker: string;
  onSelect: () => void;
  allTickers: Set<string> | ReadonlySet<string>;
}) {
  const e = V17_SEARCH_BY_TICKER[ticker.toUpperCase()];
  const accent = brand(ticker).primary;
  if (!e) return null;
  const tickerShown = displayTicker(ticker, allTickers);
  // Yann 26 mai 2026 : toutes les recherches routent vers la dernière version.
  const href = buildLatestHref(ticker);
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-bottom scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: accent }}
      />

      {/* Logo : tente CompanyLogo (Clearbit / SVG si dispo), sinon placeholder lettre */}
      <div
        className={`size-12 shrink-0 rounded-xl border p-1.5 transition-transform duration-300 group-hover:scale-105 ${
          logoNeedsLightBg(ticker)
            ? "border-[#e5e5e5] bg-[#fafafa]"
            : "border-[#1f1f1f] bg-[#0a0a0a]"
        }`}
      >
        <CompanyLogo ticker={ticker} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-zinc-50">
            {e.name}
          </span>
          <span
            className="font-mono text-[11px] font-bold tracking-wider"
            style={{ color: accent }}
          >
            {tickerShown}
          </span>
          {e.validated ? (
            <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200">
              ✓ Pass 3
            </span>
          ) : (
            <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-200">
              V1.6
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-zinc-400">
          {e.sector || "-"}
        </div>
      </div>

      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-zinc-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
    </Link>
  );
}

/* ─── Carte résultat V1.9 (sté EU non encore extraite) ──────────────── */
/**
 * Variante de ResultCard pour les 78 stés V1.9 absentes de `_merged.json`.
 * On n'a aucune donnée pipeline encore (pas de sector, pas de hero), juste
 * un nom (Wikipedia) + un pays. Route vers `/sandbox/v1-9/<ticker>` (page
 * "Fiche en préparation" gérée par Agent B).
 */
function ResultCardV19({
  ticker,
  onSelect,
  allTickers,
}: {
  ticker: string;
  onSelect: () => void;
  allTickers: Set<string> | ReadonlySet<string>;
}) {
  const e = V19_SEARCH_BY_TICKER[ticker.toUpperCase()];
  const accent = brand(ticker).primary;
  if (!e) return null;
  const href = buildLatestHref(ticker);
  const tickerShown = displayTicker(ticker, allTickers);
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-bottom scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: accent }}
      />

      <div
        className={`size-12 shrink-0 rounded-xl border p-1.5 transition-transform duration-300 group-hover:scale-105 ${
          logoNeedsLightBg(ticker)
            ? "border-[#e5e5e5] bg-[#fafafa]"
            : "border-[#1f1f1f] bg-[#0a0a0a]"
        }`}
      >
        <CompanyLogo ticker={ticker} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-zinc-50">
            {e.name}
          </span>
          <span
            className="font-mono text-[11px] font-bold tracking-wider"
            style={{ color: accent }}
          >
            {tickerShown}
          </span>
          <span className="rounded-md border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300">
            V1.9
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-zinc-500">
          Fiche en préparation
          {e.country ? <span className="ml-1 text-zinc-600">· {e.country}</span> : null}
        </div>
      </div>

      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-zinc-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
    </Link>
  );
}
