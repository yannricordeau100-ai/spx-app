"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatHeroValue } from "@/lib/data";
import { brand } from "@/lib/brand";
import { yoyTone } from "@/lib/utils";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { AcronymHover } from "@/components/acronym-hover";
import { useT } from "@/lib/i18n/provider";
import { useFreemiumTier } from "@/lib/freemium/context";
import { useVisiblesGratuit } from "@/lib/freemium/use-visibles-gratuit";
import type { ResultatRecherche } from "@/lib/recherche-societes";

/**
 * 8 oct 2026 (audit des fuites publiques, lignes 6, 8, 9, 10) : la recherche
 * se fait desormais COTE SERVEUR (/api/recherche-societes, 10 resultats au
 * plus). Ce composant n importe plus aucune liste de societes, aucun
 * classement, aucun index de heros : rien dans le JS servi ne permet de
 * compter l univers. Ne JAMAIS reimporter ici un fichier de src/data.
 */

// Yann 4 sept 2026 : les liens pointent sur l adresse PUBLIQUE /<ticker>.
const buildLatestHref = (ticker: string) => `/${ticker.toLowerCase()}`;
// Yann 15 sept 2026 : en anonyme, chaque lien vers une fiche mene a l inscription gratuite.
// Yann 30 sept 2026 : les societes de la liste « 100 % visibles en gratuit » gardent un lien direct.
const lienInscription = (ticker: string, visibles: ReadonlySet<string>) =>
  visibles.has(ticker.toUpperCase()) ? buildLatestHref(ticker) : `/?auth=signup&next=${encodeURIComponent(buildLatestHref(ticker))}`;

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
}: {
  variant?: Variant;
  placeholder?: string;
  // 8 oct 2026 : searchableTickers et totalLabel retires (le perimetre est
  // decide par le serveur, aucun compte ni liste n est transmis au navigateur).
}) {
  const anonLiens = useFreemiumTier() === "anon";
  const visiblesGratuit = useVisiblesGratuit();
  const { t, locale } = useT();
  const ph =
    placeholder ??
    (variant === "hero"
      ? t("search.placeholder_hero")
      : t("search.placeholder_compact"));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const declencheurRef = useRef<HTMLButtonElement>(null);
  const leurreRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /**
   * Yann 21 sept 2026 : pilotage clavier de la liste de resultats.
   * `indexActif` = -1 signifie "aucune selection", etat volontaire a
   * l ouverture pour qu une frappe d Entree involontaire n ouvre jamais
   * une societe. Fleche bas / fleche haut deplacent la selection, Entree
   * ouvre la societe selectionnee (ou la premiere de la liste).
   */
  const [indexActif, setIndexActif] = useState(-1);
  const listeRef = useRef<HTMLUListElement>(null);
  /** Vrai quand la selection vient des fleches : seul ce cas fait defiler la liste. */
  const gesteClavierRef = useRef(false);
  const optionsRef = useRef<(HTMLLIElement | null)[]>([]);
  const idBase = useId().replace(/:/g, "");
  const idListe = `recherche-societes-${idBase}`;
  const idOption = (i: number) => `${idListe}-option-${i}`;

  /**
   * Resultats calcules par le serveur (8 oct 2026). Petite temporisation pour
   * ne pas interroger a chaque frappe ; la derniere reponse gagne.
   */
  const [results, setResults] = useState<ResultatRecherche[]>([]);
  const demandeRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const numero = ++demandeRef.current;
    const minuteur = setTimeout(() => {
      fetch(`/api/recherche-societes?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : { resultats: [] }))
        .then((d: { resultats?: ResultatRecherche[] }) => {
          if (numero === demandeRef.current) setResults(Array.isArray(d?.resultats) ? d.resultats : []);
        })
        .catch(() => {
          if (numero === demandeRef.current) setResults([]);
        });
    }, query ? 120 : 0);
    return () => clearTimeout(minuteur);
  }, [query, open]);

  /** Ferme la liste sans rien reprendre (cas d une navigation vers une fiche). */
  const fermer = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndexActif(-1);
  }, []);

  /** Ferme la liste et rend le champ : le focus revient sur la barre de recherche. */
  const fermerEtRendreLeChamp = useCallback(() => {
    fermer();
    // Le pill remplace le champ une fois la liste fermee : c est lui qui
    // doit reprendre le focus, sinon le lecteur d ecran repart du debut.
    setTimeout(() => declencheurRef.current?.focus(), 0);
  }, [fermer]);

  // ⌘K / Ctrl+K pour ouvrir, ESC pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        fermerEtRendreLeChamp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fermerEtRendreLeChamp, open]);

  // Focus input à l'ouverture + lock du scroll
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = fermer;

  /**
   * Aucune selection au premier affichage, et remise a zero des que la liste
   * change (nouvelle frappe, filtre online charge, ouverture/fermeture).
   */
  useEffect(() => {
    setIndexActif(-1);
  }, [query, open, results.length]);

  // Defilement automatique : l element selectionne reste visible.
  useEffect(() => {
    if (indexActif < 0 || !gesteClavierRef.current) return;
    optionsRef.current[indexActif]?.scrollIntoView({ block: "nearest" });
  }, [indexActif]);

  /** Ouvre la societe d un resultat (meme regle de lien que les cartes). */
  const ouvrirResultat = useCallback(
    (ticker: string) => {
      fermer();
      router.push(anonLiens ? lienInscription(ticker, visiblesGratuit) : buildLatestHref(ticker));
    },
    [anonLiens, fermer, router, visiblesGratuit],
  );

  /** Clavier du champ : fleches, Entree, Echap. */
  const clavierChamp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        fermerEtRendreLeChamp();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      gesteClavierRef.current = true;
      setIndexActif((i) => (i + 1 >= results.length ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      gesteClavierRef.current = true;
      setIndexActif((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      // Yann 14 mai 2026 : Entree ouvre la societe.
      // Yann 21 sept 2026 : la societe selectionnee au clavier, ou a defaut
      // la premiere de la liste.
      e.preventDefault();
      const cible = results[indexActif >= 0 ? indexActif : 0];
      if (cible) ouvrirResultat(cible.ticker);
    } else if (e.key === "Escape") {
      e.preventDefault();
      fermerEtRendreLeChamp();
    }
  };

  return (
    <>
      <input
        ref={leurreRef}
        type="text"
        aria-hidden
        tabIndex={-1}
        inputMode="search"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
      />
      {/* PILL FERMÉ — bords ultra-arrondis, halo subtil violet/cyan au hover */}
      <button
        ref={declencheurRef}
        type="button"
        onClick={() => {
          // Yann 5 oct 2026 : iOS ne sort le clavier que si le focus est pris
          // dans le geste du clic. On le donne a un champ leurre toujours monte,
          // puis le vrai champ le reprend des son montage (sans delai).
          leurreRef.current?.focus();
          setOpen(true);
        }}
        aria-label={t("search.placeholder_compact")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          variant === "hero"
            ? "group relative inline-flex w-full max-w-2xl items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 px-5 py-3.5 text-left text-zinc-400 backdrop-blur-md transition-all hover:border-white/25 hover:text-zinc-200 hover:shadow-[0_0_40px_-10px_rgba(167,139,250,0.45)]"
            : "group relative inline-flex size-9 shrink-0 sm:shrink sm:min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 p-0 sm:h-auto sm:w-full sm:justify-start sm:px-3.5 sm:py-2 sm:max-w-[17rem] sm:px-3.5 text-left text-zinc-400 backdrop-blur transition-all hover:border-white/25 hover:text-zinc-200"
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
              : "relative hidden flex-1 truncate text-[12.5px] sm:block"
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
                  autoFocus
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
                  // Yann 26 mai 2026 : toute recherche route vers la DERNIÈRE
                  // version (LATEST_VERSION_PATH), peu importe la source.
                  onKeyDown={clavierChamp}
                  role="combobox"
                  aria-controls={results.length > 0 ? idListe : undefined}
                  aria-expanded={results.length > 0}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    indexActif >= 0 && indexActif < results.length ? idOption(indexActif) : undefined
                  }
                  aria-label={ph}
                  className="flex-1 bg-transparent text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                    aria-label="Effacer le texte"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:bg-white/10 sm:px-2 sm:py-1 sm:text-[10.5px] sm:text-zinc-400"
                  aria-label="Fermer la recherche"
                >
                  <span className="sm:hidden">Fermer</span>
                  <span className="hidden sm:inline">ESC</span>
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
                      <span className="hidden-tactile">{locale === "fr" ? "Tapez pour filtrer" : "Type to filter"}</span>
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
                  <ul
                    ref={listeRef}
                    id={idListe}
                    role="listbox"
                    aria-label={ph}
                    className="grid grid-cols-1 gap-2"
                  >
                    {results.map((r, i) => (
                      <li
                        key={`${r.source}-${r.ticker}`}
                        ref={(el) => {
                          optionsRef.current[i] = el;
                        }}
                        id={idOption(i)}
                        role="option"
                        aria-selected={i === indexActif}
                        // Souris et clavier restent coherents : survoler un
                        // resultat en fait la selection courante.
                        onMouseEnter={() => {
                          gesteClavierRef.current = false;
                          setIndexActif(i);
                        }}
                        data-selectionne={i === indexActif ? "oui" : undefined}
                        className={`rounded-2xl ${i === indexActif ? "ring-2 ring-violet-400/70" : ""}`}
                      >
                        <CarteResultat r={r} onSelect={close} />
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

/* ─── Carte résultat (une seule forme, donnees preparees par le serveur) ─── */
function CarteResultat({ r, onSelect }: { r: ResultatRecherche; onSelect: () => void }) {
  const anonLiens = useFreemiumTier() === "anon";
  const visiblesGratuit = useVisiblesGratuit();
  const accent = brand(r.ticker).primary;
  // Yann 4 sept 2026 : mise en avant des fiches entierement lisibles sans abonnement.
  const estVitrine = visiblesGratuit.has(r.ticker.toUpperCase());
  return (
    <Link
      href={anonLiens ? lienInscription(r.ticker, visiblesGratuit) : buildLatestHref(r.ticker)}
      prefetch
      onClick={onSelect}
      // Motif liste de suggestions : la navigation se fait aux fleches, les
      // cartes ne prennent pas le focus au Tab.
      tabIndex={-1}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-3 transition-all ${
        estVitrine
          ? "border-violet-400/50 bg-violet-500/[0.07] ring-1 ring-violet-400/25 hover:border-violet-300/70 hover:bg-violet-500/[0.12]"
          : "border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-bottom scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: accent }}
      />
      <div
        className={`size-12 shrink-0 overflow-hidden rounded-xl border transition-transform duration-300 group-hover:scale-105 ${
          logoNeedsLightBg(r.ticker)
            ? "preserve-colors border-[#e5e5e5] bg-[#fafafa]"
            : "border-[#1f1f1f] bg-[#0a0a0a]"
        }`}
      >
        <CompanyLogo ticker={r.ticker} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="min-w-0 max-w-full truncate text-[14.5px] font-semibold text-zinc-50">{r.nom}</span>
          <span className="font-mono text-[11px] font-bold tracking-wider" style={{ color: accent }}>
            {r.affiche}
          </span>
          {estVitrine && (
            <span className="shrink-0 rounded-full border border-violet-300/70 bg-violet-600/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Complètement gratuit</span>
          )}
          {r.source === "v19" && (
            <span className="rounded-md border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300">
              V1.9
            </span>
          )}
        </div>
        {r.source === "v19" ? (
          <div className="mt-0.5 truncate text-[11.5px] text-zinc-500">
            Fiche en préparation
            {r.pays ? <span className="ml-1 text-zinc-600">· {r.pays}</span> : null}
          </div>
        ) : (
          <div className="mt-0.5 truncate text-[11.5px] text-zinc-400">
            {r.secteur}
            {r.sousSecteur ? (
              <>
                {" "}<span className="text-zinc-600">·</span> {r.sousSecteur}
              </>
            ) : null}
          </div>
        )}
      </div>
      <HeroResultat hero={r.hero} />
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-zinc-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
    </Link>
  );
}

/* ─── Hero KPI à droite des résultats ─── */
function HeroResultat({ hero }: { hero: ResultatRecherche["hero"] }) {
  if (!hero) return null;
  const tone = yoyTone(hero.yoy, (hero.type ?? undefined) as Parameters<typeof yoyTone>[1]);
  const yoyColor = tone === "pos" ? "#22c55e" : tone === "neg" ? "#ef4444" : "#a1a1aa";
  // Yann 11 juil 2026 : rescale valeur+unite ensemble (formatHeroValue), regle 1-999.
  const heroFmt = formatHeroValue(hero.valeur, hero.unite ?? "");
  if (heroFmt.value === "—") return null;
  const court = (
    <div className={`${hero.libelle ? "cursor-help " : ""}font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500`}>
      {hero.court}
    </div>
  );
  return (
    <div className="hidden text-right sm:block">
      {hero.libelle ? (
        <AcronymHover align="right" label={hero.libelle}>
          {court}
        </AcronymHover>
      ) : (
        court
      )}
      <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-zinc-50">
        {heroFmt.value}
        {heroFmt.unit && <span className="ml-1 text-[10.5px] font-normal text-zinc-400">{heroFmt.unit}</span>}
      </div>
      {hero.yoy && (
        <div
          className="mt-0.5 inline-flex items-center justify-end gap-0.5 font-mono text-[11px] tabular-nums"
          style={{ color: yoyColor }}
        >
          {tone === "pos" && <ArrowUpRight className="size-3" />}
          {tone === "neg" && <ArrowDownRight className="size-3" />}
          {hero.yoy}
        </div>
      )}
    </div>
  );
}
