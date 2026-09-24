"use client";
import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

import { useEffect, useRef } from "react";
import { StarButton } from "@/components/star-button";
import { KpiInstitutionnelsButton } from "@/components/kpi-institutionnels-button";
import type { Company } from "@/lib/data";
import { TICKER_ALIASES } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { StockPriceBlock } from "@/components/stock-price-block";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { translateSubsector, translateSubsectorLocale } from "@/lib/ui-fix-templates";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { gicsNiveaux, LIBELLES_NIVEAUX_GICS } from "@/lib/desk/gics-path";
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
      className={`logo-wrapper masquer-en-jour relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 shadow-[0_3px_14px_rgba(0,0,0,0.4)] transition-shadow duration-300 hover:shadow-[0_6px_22px_rgba(0,0,0,0.55)] sm:h-[64px] sm:w-[64px] ${
        logoNeedsLightBg(ticker)
          ? "preserve-colors bg-white ring-black/15"
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
        {/* Yann 13 sept 2026 : mise en favori de la societe ici, a droite du ticker. */}
        <StarButton ticker={ticker} mode="company" size="sm" />
        {/* Yann 25 sept 2026 : KPI d industrie suivis par les institutionnels, vue admin seulement. */}
        <KpiInstitutionnelsButton ticker={ticker} accent={accent} />
        {aliases.length > 0 && (
          <span className="self-baseline text-[11px] font-medium text-zinc-500 whitespace-nowrap">
            {alsoKnownLabel}{" "}
            <span className="font-mono text-zinc-400">{aliases.join(" / ")}</span>
          </span>
        )}
      </div>
    </div>
  );
}

import { BandeauExclusif } from "@/components/bandeau-exclusif";

function StatChip({ label, value, survol }: { label: string; value: string | null | undefined; survol?: string }) {
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
  // Yann 22 sept 2026 : pas de petit « i » sur les pastilles de rang, mais un
  // texte au survol qui dit en clair sur quoi porte le classement.
  return (
    <span
      title={survol}
      className={`inline-flex shrink-0 items-baseline gap-1.5 rounded-lg border border-[#262626] bg-[#0c0c0c] px-2 py-1.5${survol ? " cursor-help" : ""}`}
    >
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="font-sans text-[12.5px] font-bold text-zinc-50">{v}</span>
    </span>
  );
}

/**
 * Rang national, Yann 22 sept 2026 (audit des rangs).
 *
 * L ancienne pastille « Rang USA » etait reservee aux tickers sans point, et
 * les sociétés européennes n avaient donc aucun rang national. Depuis le
 * recalcul du 22 septembre, `ranks.global_us` porte le rang du pays de la
 * société sous la forme « #3 in France », comme les rangs sectoriels portent
 * déjà leur secteur. On n affiche la pastille que lorsque le pays est présent
 * dans la valeur : cela écarte au passage les vieux rangs approximatifs
 * extraits par modèle de langage sur les tickers sans fichier de rangs
 * (« ≈ #184 » servi par exemple sur ASML.AS).
 */
function paysDuRang(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  for (const sep of [" in ", " dans "]) {
    const idx = value.indexOf(sep);
    if (idx > 0) {
      const pays = value.slice(idx + sep.length).trim();
      if (pays) return pays;
    }
  }
  return null;
}

/** Nom des pays classés, dans la langue de l interface. Liste courte : seuls
 *  les pays qui atteignent le seuil de 15 sociétés reçoivent un rang. */
const NOMS_PAYS: Record<string, Record<string, string>> = {
  "United States": { fr: "États-Unis", en: "United States", de: "USA", nl: "Verenigde Staten" },
  "Germany": { fr: "Allemagne", en: "Germany", de: "Deutschland", nl: "Duitsland" },
  "France": { fr: "France", en: "France", de: "Frankreich", nl: "Frankrijk" },
  "Netherlands": { fr: "Pays-Bas", en: "Netherlands", de: "Niederlande", nl: "Nederland" },
  "Switzerland": { fr: "Suisse", en: "Switzerland", de: "Schweiz", nl: "Zwitserland" },
};

/** Le meme pays, mais sous la forme qui se glisse dans une phrase : « aux
 *  États-Unis », « en Suisse ». Sans cela le texte au survol donnait « les
 *  sociétés Suisse suivies par Mettrik ». */
const PAYS_DANS_PHRASE: Record<string, Record<string, string>> = {
  "United States": { fr: "aux États-Unis", en: "in the United States", de: "in den USA", nl: "in de Verenigde Staten" },
  "Germany": { fr: "en Allemagne", en: "in Germany", de: "in Deutschland", nl: "in Duitsland" },
  "France": { fr: "en France", en: "in France", de: "in Frankreich", nl: "in Frankrijk" },
  "Netherlands": { fr: "aux Pays-Bas", en: "in the Netherlands", de: "in den Niederlanden", nl: "in Nederland" },
  "Switzerland": { fr: "en Suisse", en: "in Switzerland", de: "in der Schweiz", nl: "in Zwitserland" },
};

function nomPays(pays: string, locale: string): string {
  const langue = locale.split("-")[0];
  return NOMS_PAYS[pays]?.[langue] ?? NOMS_PAYS[pays]?.fr ?? pays;
}

function paysDansPhrase(pays: string, locale: string): string {
  const langue = locale.split("-")[0];
  const tourne = PAYS_DANS_PHRASE[pays]?.[langue] ?? PAYS_DANS_PHRASE[pays]?.fr;
  if (tourne) return tourne;
  return `${langue === "fr" ? "en" : "in"} ${nomPays(pays, locale)}`;
}

/**
 * Libellés et textes au survol des pastilles de rang, Yann 22 sept 2026.
 *
 * L audit du 22 septembre a montré que « Rang mondial » promettait bien plus
 * que ce que la valeur mesure : le classement porte sur les sociétés suivies
 * par Mettrik, qui ne comprennent ni Aramco, ni Tencent, ni Samsung, ni Novo
 * Nordisk, ni Toyota, ni Shell, ni HSBC. Roche affichée « #40 mondiale » était
 * donc fausse. Même remarque pour l ancien « Rang USA ». Les libellés disent
 * désormais sur quoi porte le rang, et le survol précise le périmètre.
 */
const MOTS_RANGS: Record<string, { capi: string; capiSurvol: string; paysSurvol: (p: string) => string; secteurSurvol: string; sousSecteurSurvol: string }> = {
  fr: {
    capi: "Rang par capitalisation",
    capiSurvol: "Classement par capitalisation boursière parmi les sociétés suivies par Mettrik, pas parmi toutes les sociétés du monde.",
    paysSurvol: (p) => `Classement par capitalisation boursière parmi les sociétés suivies par Mettrik ${p}.`,
    secteurSurvol: "Classement par capitalisation boursière dans ce secteur, parmi les sociétés suivies par Mettrik.",
    sousSecteurSurvol: "Classement par capitalisation boursière dans cette sous-industrie, parmi les sociétés suivies par Mettrik.",
  },
  en: {
    capi: "Market cap rank",
    capiSurvol: "Ranking by market capitalisation among the companies covered by Mettrik, not among all companies worldwide.",
    paysSurvol: (p) => `Ranking by market capitalisation among the companies covered by Mettrik ${p}.`,
    secteurSurvol: "Ranking by market capitalisation within this sector, among the companies covered by Mettrik.",
    sousSecteurSurvol: "Ranking by market capitalisation within this sub-industry, among the companies covered by Mettrik.",
  },
  de: {
    capi: "Rang nach Marktkapitalisierung",
    capiSurvol: "Rangfolge nach Marktkapitalisierung unter den von Mettrik abgedeckten Unternehmen, nicht unter allen Unternehmen weltweit.",
    paysSurvol: (p) => `Rangfolge nach Marktkapitalisierung unter den von Mettrik abgedeckten Unternehmen ${p}.`,
    secteurSurvol: "Rangfolge nach Marktkapitalisierung in diesem Sektor, unter den von Mettrik abgedeckten Unternehmen.",
    sousSecteurSurvol: "Rangfolge nach Marktkapitalisierung in dieser Teilbranche, unter den von Mettrik abgedeckten Unternehmen.",
  },
  nl: {
    capi: "Rang naar beurswaarde",
    capiSurvol: "Rangschikking naar beurswaarde onder de bedrijven die Mettrik volgt, niet onder alle bedrijven wereldwijd.",
    paysSurvol: (p) => `Rangschikking naar beurswaarde onder de bedrijven die Mettrik volgt ${p}.`,
    secteurSurvol: "Rangschikking naar beurswaarde binnen deze sector, onder de bedrijven die Mettrik volgt.",
    sousSecteurSurvol: "Rangschikking naar beurswaarde binnen deze subsector, onder de bedrijven die Mettrik volgt.",
  },
};

function motsRangs(locale: string) {
  return MOTS_RANGS[locale.split("-")[0]] ?? MOTS_RANGS.fr;
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

/** Yann 18 sept 2026 : ce qui suit le bandeau est la propriete de Mettrik AI ou des societes.
 *  Rendu avec InfoTooltip (portail, positionnement borne a l ecran) : l ancien
 *  panneau en absolute ne s ouvrait pas dans la rangee des rangs. */
function ProprieteInfo({ accent }: { accent: string }) {
  return (
    <InfoTooltip color={accent} size="md" align="right" icone={<ChevronDown className="size-4" strokeWidth={2.5} aria-hidden />}>
      En dessous, à l&apos;exception des blocs « Gouvernance et rémunération » et « Répartition du chiffre d&apos;affaires* », toutes les informations affichées sont la propriété de Mettrik AI, spécifiques à Mettrik AI, ou proviennent des sociétés concernées à travers leurs rapports réglementaires.
      <br />
      <span className="text-zinc-500">* à l&apos;exception de pages société spécifiques.</span>
    </InfoTooltip>
  );
}


/**
 * Yann 23 septembre 2026 : la ligne sous le nom de la societe ne porte plus que
 * le SECTEUR, suivi d un petit « i ». Le chemin complet de la classification
 * (secteur, groupe d industries, industrie, sous-industrie) s affiche dans un
 * panneau au survol ou au clic, presente en organigramme : un niveau par ligne,
 * decale et relie au precedent par un connecteur.
 *
 * Le panneau est rendu par portail en position fixe, sa largeur est bornee a la
 * largeur de l ecran et sa position est ramenee dans l ecran : jamais de sortie
 * d ecran, jamais de defilement horizontal, du telephone au grand ecran.
 * Fermeture par Echap, par clic a l exterieur, par sortie du survol.
 */
function ArbreClassification({
  niveaux,
  libelles = LIBELLES_NIVEAUX_GICS,
  accent,
}: {
  niveaux: string[];
  libelles?: readonly string[];
  accent: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [monte, setMonte] = useState(false);
  const [coords, setCoords] = useState<{ bas: number; haut: number; gauche: number } | null>(null);
  const [taille, setTaille] = useState({ largeur: 288, hauteur: 0 });
  const boutonRef = useRef<HTMLButtonElement>(null);
  const panneauRef = useRef<HTMLDivElement>(null);
  const idPanneau = `classification-${niveaux.join("-").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (!ouvert) return;
    const calculer = () => {
      const b = boutonRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      setCoords({ bas: r.bottom + 6, haut: r.top, gauche: r.left });
    };
    calculer();
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        boutonRef.current?.focus();
      }
    };
    const surClicDehors = (e: MouseEvent | TouchEvent) => {
      const cible = e.target as Node;
      if (boutonRef.current?.contains(cible) || panneauRef.current?.contains(cible)) return;
      setOuvert(false);
    };
    window.addEventListener("scroll", calculer, true);
    window.addEventListener("resize", calculer);
    document.addEventListener("keydown", surEchap);
    document.addEventListener("pointerdown", surClicDehors);
    return () => {
      window.removeEventListener("scroll", calculer, true);
      window.removeEventListener("resize", calculer);
      document.removeEventListener("keydown", surEchap);
      document.removeEventListener("pointerdown", surClicDehors);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const id = requestAnimationFrame(() => {
      const el = panneauRef.current;
      if (!el) return;
      const largeur = el.offsetWidth;
      const hauteur = el.offsetHeight;
      if (Math.abs(largeur - taille.largeur) > 1 || Math.abs(hauteur - taille.hauteur) > 1) {
        setTaille({ largeur, hauteur });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ouvert, coords, taille]);

  const stylePanneau: React.CSSProperties = (() => {
    if (!coords) return { display: "none" };
    const MARGE = 12;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const h = taille.hauteur || 180;
    const gauche = Math.max(MARGE, Math.min(coords.gauche, vw - taille.largeur - MARGE));
    const dessous = coords.bas;
    const dessus = coords.haut - 6 - h;
    const top =
      dessous + h + MARGE <= vh
        ? dessous
        : Math.max(MARGE, dessus >= MARGE ? dessus : vh - h - MARGE);
    return { top, left: gauche };
  })();

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={boutonRef}
        type="button"
        aria-label="Afficher la classification complète de la société"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idPanneau : undefined}
        onMouseEnter={() => setOuvert(true)}
        onMouseLeave={() => setOuvert(false)}
        onFocus={() => setOuvert(true)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOuvert((o) => !o);
        }}
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border bg-[#0a0a0a] transition-colors hover:bg-[#161616]"
        style={{ borderColor: `${accent}99`, color: accent }}
      >
        <Info className="size-[14px]" strokeWidth={2.5} aria-hidden />
      </button>
      {monte &&
        createPortal(
          <AnimatePresence>
            {ouvert && coords && (
              <motion.div
                id={idPanneau}
                role="tooltip"
                ref={panneauRef}
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onMouseEnter={() => setOuvert(true)}
                onMouseLeave={() => setOuvert(false)}
                className="pointer-events-auto fixed z-[1000] overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3.5 shadow-2xl"
                style={{ ...stylePanneau, width: "min(20rem, calc(100vw - 24px))" }}
              >
                <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                  Classification
                </p>
                <ol className="space-y-1.5">
                  {niveaux.map((niveau, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5"
                      style={{ paddingInlineStart: i * 14 }}
                    >
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="mt-[9px] h-[10px] w-[10px] shrink-0 rounded-bl-[3px] border-b border-l border-zinc-700"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                          {libelles[i] ?? ""}
                        </span>
                        <span
                          className={`block break-words text-[12.5px] leading-snug ${
                            i === niveaux.length - 1 ? "font-semibold text-zinc-100" : "text-zinc-300"
                          }`}
                        >
                          {niveau}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
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
  // Yann 29 mai 2026 : toggle global/per-société pour masquer le bloc logo
  // (header). Quand désactivé : layout alternatif sans le carré 56-64px,
  // nom + catégorie + tagline alignés à gauche du conteneur.
  // Yann 2 juin 2026 : second système de toggle (blocks-control V1.9.5)
  // ajoute aussi un switch "Logo société" — on combine les deux.
  const logoDisabled =
    isDisabled("logo") ||
    !isBlockEnabled("company_logo", company.ticker);

  return (
    <div className="mb-1">
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
          {/* Yann 22 septembre 2026 : les QUATRE niveaux de la classification
              (secteur, groupe d industries, industrie, sous-industrie), toujours
              en francais, resolus depuis le code GICS a 8 chiffres de l annuaire
              du Cahier. Chemin hierarchique qui passe a la ligne (flex-wrap) :
              aucune troncature, aucun defilement horizontal a 380 comme a 1024.
              Repli sur l ancien couple secteur / sous-secteur si le code manque. */}
          <div className="mt-1.5 text-[13px] leading-snug text-zinc-400 sm:text-[14px]">
            {(() => {
              const code = (company as { gics_code?: string }).gics_code;
              const niveaux = gicsNiveaux(code);
              if (niveaux.length === 4) {
                return (
                  <span className="inline-flex min-w-0 max-w-full items-center gap-x-1.5">
                    <span className="min-w-0 truncate">{niveaux[0]}</span>
                    <ArbreClassification niveaux={niveaux} accent={accent} />
                  </span>
                );
              }
              const secteur = translateSubsectorLocale(company.sector, locale);
              const sousSecteur = translateSubsectorLocale(company.subsector, locale);
              return (
                <span className="inline-flex min-w-0 max-w-full items-center gap-x-1.5">
                  <span className="min-w-0 truncate">{secteur}</span>
                  {sousSecteur && sousSecteur !== secteur && (
                    <ArbreClassification
                      niveaux={[secteur, sousSecteur]}
                      libelles={[LIBELLES_NIVEAUX_GICS[0], LIBELLES_NIVEAUX_GICS[3]]}
                      accent={accent}
                    />
                  )}
                </span>
              );
            })()}
          </div>
          {/* Yann (1er juin 05:15) : tagline supprimée de V1.9.5
              (risque hallucination LLM + Yann préfère épure).
              Pour réactiver, voir git history avant ce commit. */}
        </div>
        {!hidePriceBar && <StockPriceBlock company={company} freeBlocked={freeBlocked} />}
      </div>

      <BandeauExclusif ticker={company.ticker} accent={accent} />

      {/* Yann (12 mai 2026) : tous les rangs sur UNE ligne horizontale.
          flex-nowrap + overflow-x-auto = scroll discret si overflow petit
          écran. Rang USA masqué pour les sés non-US (cat 3 EU). */}
      {(() => {
        const chips = (
          <>
        <StatChip
          label={motsRangs(locale).capi}
          value={company.ranks.global_world}
          survol={motsRangs(locale).capiSurvol}
        />
        {(() => {
          const pays = paysDuRang(company.ranks.global_us);
          if (!pays) return null;
          const nom = nomPays(pays, locale);
          return (
            <StatChip
              label={nom}
              value={stripRankSuffix(company.ranks.global_us)}
              survol={motsRangs(locale).paysSurvol(paysDansPhrase(pays, locale))}
            />
          );
        })()}
        {/* Yann 19 mai 2026 : strip le suffixe "dans <sector_name>" sur les
            chips sector + subsector car le label affiche DÉJÀ le nom du
            secteur. Évite la redondance "TECHNOLOGIE #3 dans Technologies
            de l'information" (= "Technology" répété 2 fois dans 1 chip). */}
        {/* Yann 9 août 2026 : même garde que global_us sur "-" (sinon chip
            "Industrie -" quand le rang n'est pas sourcé, ex DG.PA/AC.PA). */}
        {company.ranks.sector && company.ranks.sector.trim() !== "" && company.ranks.sector.trim() !== "-" && (
          <StatChip label={translateSubsectorLocale(company.sector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.sector, locale))} survol={motsRangs(locale).secteurSurvol} />
        )}
        {company.ranks.subsector && company.ranks.subsector.trim() !== "" && company.ranks.subsector.trim() !== "-" && (
          <StatChip label={translateSubsectorLocale(company.subsector, locale)} value={stripRankSuffix(translateRankPreposition(company.ranks.subsector, locale))} survol={motsRangs(locale).sousSecteurSurvol} />
        )}
        <StatChip label={t("company.founded")} value={company.founded != null ? String(company.founded) : null} />
        <StatChip label={t("company.ipo")} value={company.ipo != null ? String(company.ipo) : null} />
        {/* Yann 25 aout 2026 : effectif extrait de la section Human Capital du
            dernier 10-K (Item 1). Uniquement les valeurs qui ont passe le
            controle de coherence (voir scripts d extraction) : les sociétés
            sans 10-K ou au chiffre non fiable n affichent pas la chip. */}
        <StatChip label={t("company.employees")} value={employeeCountLabel(company.ticker, locale)} />
        {/* Yann 18 sept 2026 : fleche d information tout a droite des rangs (meme role qu un i). */}
        <ProprieteInfo accent={accent} />
          </>
        );
        return (
          <div ref={chipsRef} className="mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
