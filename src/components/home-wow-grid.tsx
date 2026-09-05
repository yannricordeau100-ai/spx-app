"use client";

/**
 * Grille "societes populaires" de la page d accueil (Yann 28 aout 2026).
 *
 * Remplace l ancienne grille de cartes (hero + medailles + etoile + "i").
 * Regles posees par Yann :
 *   - 2 societes cote a cote ; 10 pour l instant, 20 visibles et 40 au
 *     maximum apres la fournee programmee ;
 *   - classement = societes preferees des investisseurs particuliers
 *     francais ; les 3 KPI les plus "wow" de chacune, de preference non
 *     financiers, sont choisis a la generation (scripts/build-home-wow.py)
 *     et livres via src/data/home-wow-kpis.json : la page ne depend plus
 *     du contenu partiel du dataset runtime ;
 *   - ni medaille, ni etoile de favori, ni indicateur "i".
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import WOW from "@/data/home-wow-kpis.json";
import { brand } from "@/lib/brand";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { displayTicker } from "@/lib/ticker-display";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

// Yann 29 aout 2026 : fournee programmee livree, 20 societes visibles et
// 40 au maximum.
const VISIBLE_PAR_DEFAUT = 20;
const MAXIMUM = 40;

type KpiWow = { nom: string; valeur: string; unite?: string | null; yoy?: string | null };
type SteWow = { ticker: string; nom: string; kpis: KpiWow[] };

function couleurYoy(yoy?: string | null): string {
  if (!yoy) return "#71717a";
  const v = parseFloat(yoy.replace(",", ".").replace(/[+%\s]/g, ""));
  if (!Number.isFinite(v) || v === 0) return "#71717a";
  return v > 0 ? "#10b981" : "#f43f5e";
}

export function HomeWowGrid({
  universe,
  buildHref,
  requireSignupGate = false,
  gatePath = "/",
  labelVoirPlus,
}: {
  universe: readonly string[];
  buildHref: (t: string) => string;
  requireSignupGate?: boolean;
  gatePath?: string;
  labelVoirPlus: string;
}) {
  const [visible, setVisible] = useState(VISIBLE_PAR_DEFAUT);

  const { rows, tickersSet } = useMemo(() => {
    const dispo = new Set(universe.map((t) => t.toUpperCase()));
    const societes = (WOW as { societes: SteWow[] }).societes
      .filter((s) => dispo.has(s.ticker) && s.kpis.length > 0)
      .slice(0, MAXIMUM);
    return { rows: societes, tickersSet: dispo };
  }, [universe]);

  const affiches = rows.slice(0, visible);
  const enPlus = rows.length > visible;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {affiches.map((s) => {
          const accent = brand(s.ticker).primary;
          const card = (
            <Link
              href={buildHref(s.ticker)}
              className="conic-border group relative flex h-full flex-col rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `${accent}55` }}
              />
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* Yann 29 aout 2026 : logo de la societe sur chaque carte. */}
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ${
                      logoNeedsLightBg(s.ticker)
                        ? "preserve-colors bg-white ring-black/15"
                        : "bg-[#111] ring-white/10"
                    }`}
                  >
                    <CompanyLogo ticker={s.ticker} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs" style={{ color: accent }}>
                      {displayTicker(s.ticker, tickersSet)}
                    </div>
                    <div className="mt-0.5 truncate text-[15px] font-medium leading-snug text-zinc-100">
                      {s.nom}
                    </div>
                  </div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 -translate-x-1 text-zinc-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
              </div>
              <div className="mt-2.5 divide-y divide-white/[0.05] border-t border-white/[0.07]">
                {s.kpis.map((k, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2 py-[5px]">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300" title={k.nom}>
                      {k.nom}
                      {/* Yann 30 aout 2026 : chaque chiffre de la vitrine est
                          date — sans periode, un visiteur (ou une IA externe)
                          prend un chiffre de mars pour un chiffre du jour. */}
                      {(k as { periode?: string | null }).periode && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                          {(k as { periode?: string | null }).periode}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap">
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-zinc-100">
                        {k.valeur}
                      </span>
                      {k.unite && (
                        <span className="text-[12px] font-medium text-zinc-400">{k.unite}</span>
                      )}
                      {k.yoy && (
                        <span
                          className="ml-1 font-mono text-[12px] tabular-nums"
                          style={{ color: couleurYoy(k.yoy) }}
                        >
                          {k.yoy}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          );
          return (
            <SignupGateOverlay
              key={s.ticker}
              enabled={requireSignupGate}
              gatePath={gatePath}
              initialAuthed={!requireSignupGate}
            >
              {card}
            </SignupGateOverlay>
          );
        })}
      </div>
      {enPlus && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible(MAXIMUM)}
            className="group inline-flex items-center gap-2.5 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] px-6 py-3 text-[14px] font-medium tracking-wide text-violet-100 transition-all hover:scale-[1.02] hover:border-violet-500/50 hover:bg-violet-500/[0.12]"
          >
            <span>{labelVoirPlus}</span>
            <span aria-hidden className="inline-block text-[16px] transition-transform group-hover:translate-y-0.5">↓</span>
          </button>
        </div>
      )}
    </div>
  );
}
