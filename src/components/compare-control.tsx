"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GitCompare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KPI } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";
import { MESSAGE_OFFRE_PREMIUM } from "@/lib/freemium/visibles-gratuit-defaut";

// Yann 30 sept 2026 : verrou = palier gratuit ou anonyme et societe hors liste
// « 100 % visibles en gratuit » : bouton visible, clic = offre Premium.
type Item = { ticker: string; name: string; short: string; verrou?: boolean };

/** Suffixe ?audit_token=... repris de l adresse de la page (controle interne). */
export function suffixeJeton(prefixe: "?" | "&"): string {
  if (typeof window === "undefined") return "";
  const j = new URLSearchParams(window.location.search).get("audit_token");
  return j ? `${prefixe}audit_token=${encodeURIComponent(j)}` : "";
}

const cacheComparables = new Map<string, Promise<{ items: Item[]; refus: boolean }>>();

/** Charge la liste des societes comparables (mise en cache, delai maximal 15 s). */
function chargerComparables(ticker: string, kpiShort: string): Promise<{ items: Item[]; refus: boolean }> {
  const cle = `${ticker}|${kpiShort}`;
  const connu = cacheComparables.get(cle);
  if (connu) return connu;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 15000);
  const p = fetch(`/api/compare?t=${encodeURIComponent(ticker)}&k=${encodeURIComponent(kpiShort)}${suffixeJeton("&")}`, { signal: ctrl.signal })
    .then(async (r) => {
      if (r.status === 403) return { items: [] as Item[], refus: true };
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { items?: Item[] };
      return { items: j.items ?? [], refus: false };
    })
    .finally(() => clearTimeout(minuteur));
  cacheComparables.set(cle, p);
  p.catch(() => cacheComparables.delete(cle));
  return p;
}

/** Les identifiants techniques (total_tac...) ne s affichent jamais. */
function estIdentifiantTechnique(x: string): boolean {
  return /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(x) && !/\s/.test(x);
}

function sansAccents(x: string): string {
  return x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CompareControl({
  ticker,
  activeKpi,
  open,
  onToggle,
  onPick,
}: {
  ticker: string;
  activeKpi: KPI;
  open: boolean;
  onToggle: () => void;
  onPick: (t: string) => void;
}) {
  const { t, locale } = useT();
  // Yann 11 sept 2026 : liste servie par /api/compare sur les 666 fiches
  // (cle de comparabilite = libelle normalise + famille d unite).
  const [comparables, setComparables] = useState<Item[] | null>(null);
  const [refus, setRefus] = useState(false);
  const [verrouClique, setVerrouClique] = useState<string | null>(null);
  // Yann 3 oct 2026 : recherche par premieres lettres du ticker ou par nom, comme la barre de recherche.
  const [requete, setRequete] = useState("");
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let vivant = true;
    setComparables(null);
    setRequete("");
    setVerrouClique(null);
    setErreur(false);
    setRefus(false);
    chargerComparables(ticker, activeKpi.short)
      .then(({ items, refus: r }) => {
        if (!vivant) return;
        setRefus(r);
        setComparables(items);
      })
      .catch(() => {
        if (!vivant) return;
        setErreur(true);
        setComparables([]);
      });
    return () => { vivant = false; };
  }, [open, ticker, activeKpi.short, essai]);
  // Un seul panneau a la fois : clic en dehors ou Echap ferme Comparer.
  useEffect(() => {
    if (!open) return;
    const dehors = (e: Event) => {
      if (racine.current && !racine.current.contains(e.target as Node)) onToggle();
    };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onToggle(); };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [open, onToggle]);
  const q = sansAccents(requete.trim());
  const filtres = comparables && q
    ? comparables
        .filter((c) => sansAccents(c.ticker).startsWith(q) || sansAccents(c.name).includes(q))
        .sort((a, b) => Number(!sansAccents(a.ticker).startsWith(q)) - Number(!sansAccents(b.ticker).startsWith(q)))
    : comparables;
  const kpiName = locale === "en" && activeKpi.name_en ? activeKpi.name_en : activeKpi.name_fr;
  const triggerClass =
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#0a0a0a] size-9 justify-center p-0 sm:size-auto sm:px-3.5 sm:py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3a3a] hover:text-zinc-50 disabled:opacity-50";

  return (
    <div ref={racine} className="relative">
      <button
        onClick={onToggle}
        onPointerEnter={() => { void chargerComparables(ticker, activeKpi.short).catch(() => {}); }}
        onFocus={() => { void chargerComparables(ticker, activeKpi.short).catch(() => {}); }}
        aria-label={t("company.compare.button")}
        aria-expanded={open}
        className={triggerClass}
      >
        <GitCompare className="size-4" />
        {/* Mobile (1er sept 2026) : icone seule, le libelle depassait du 375px */}
        <span className="hidden sm:inline">{t("company.compare.button")}</span>
        <ChevronDown
          className={`hidden size-3.5 transition-transform sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed left-3 right-3 top-[4.5rem] z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-72 rounded-xl border border-[#262626] bg-[#0a0a0a] shadow-2xl"
          >
            <div className="border-b border-[#1a1a1a] px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {t("company.compare.on")}
              </div>
              <div className="mt-0.5 text-[12.5px] text-zinc-200">
                <span className="font-medium">{kpiName}</span>
                {!estIdentifiantTechnique(activeKpi.short) && activeKpi.short !== kpiName && (
                  <span className="text-zinc-400"> · {activeKpi.short}</span>
                )}
              </div>
            </div>
            {comparables && comparables.length > 0 && !refus && (
              <div className="border-b border-[#1a1a1a] px-3 py-2">
                <input
                  type="search"
                  value={requete}
                  onChange={(e) => setRequete(e.target.value)}
                  placeholder="Rechercher une société (nom ou ticker)"
                  aria-label="Rechercher une société à comparer"
                  className="w-full rounded-lg border border-[#262626] bg-[#050505] px-2.5 py-1.5 text-[16px] sm:text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/60 focus:outline-none"
                />
              </div>
            )}
            <div className="max-h-72 overflow-y-auto py-1">
              {comparables === null ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">Recherche des sociétés comparables…</div>
              ) : erreur ? (
                <div className="px-3 py-4 text-[12px] text-zinc-300">
                  Chargement impossible.{" "}
                  <button type="button" onClick={() => setEssai((n) => n + 1)} className="font-semibold text-violet-300 underline">Réessayer</button>
                </div>
              ) : refus ? (
                <div className="px-3 py-4 text-[12px] text-zinc-300">{MESSAGE_OFFRE_PREMIUM}</div>
              ) : comparables.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">
                  {t("company.compare.empty")}&nbsp;
                  <em>{kpiName}</em>.
                </div>
              ) : filtres && filtres.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-zinc-400">Aucune société comparable sur cet indicateur ne correspond à « {requete.trim()} ».</div>
              ) : (
                (filtres ?? []).map(({ ticker: tk, name, short, verrou }) => {
                  const accent = brand(tk).primary;
                  return (
                    <button
                      key={tk}
                      onClick={() => (verrou ? setVerrouClique(tk) : onPick(tk))}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#141414]"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: accent }} />
                        <div className="min-w-0">
                          <div className="break-words text-[13px] font-medium text-zinc-100">{name}</div>
                          {!estIdentifiantTechnique(short) && <div className="truncate text-[11px] text-zinc-400">{short}</div>}
                          {verrou && verrouClique === tk && (
                            <div role="status" className="mt-1 text-[11px] font-semibold text-violet-200">{MESSAGE_OFFRE_PREMIUM}</div>
                          )}
                        </div>
                      </div>
                      <span className="mt-0.5 shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-emerald-300">
                        {t("company.compare.direct")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
