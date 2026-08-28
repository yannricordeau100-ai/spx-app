"use client";

/**
 * Grille "societes populaires" de la page d accueil (Yann 28 aout 2026).
 *
 * Remplace l ancienne grille de cartes (hero + medailles + etoile + "i").
 * Regles posees par Yann :
 *   - 2 societes cote a cote, 20 affichees d un coup, 40 au maximum ;
 *   - classement = societes preferees des investisseurs particuliers
 *     francais (src/data/home-popular-fr.json), filtre sur l univers ;
 *   - pour chaque societe, les 3 KPI les plus "wow", de preference non
 *     financiers (unites physiques : magasins, abonnes, GW, passagers...),
 *     stories comprises ; le KPI principal n apparait que s il est wow ;
 *   - ni medaille, ni etoile de favori, ni indicateur "i".
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import POPULAR_FR from "@/data/home-popular-fr.json";
import type { Company, KPI } from "@/lib/data";
import { brand } from "@/lib/brand";
import { displayTicker } from "@/lib/ticker-display";
import { prepareHeroDisplay } from "@/lib/format-hero";
import { yoyTone } from "@/lib/utils";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

const VISIBLE_PAR_DEFAUT = 20;
const MAXIMUM = 40;

/** Unite monetaire ou de pourcentage = KPI financier. Le reste est physique. */
function estFinancier(unit?: string | null): boolean {
  const u = (unit ?? "").toLowerCase();
  if (!u) return true;
  if (u.includes("%")) return true;
  return /[$€¥£]|chf|sek|dkk|nok|mds|m\s?\$|m\s?€|bn|md/.test(u);
}

function magnitudeYoy(yoy?: string | null): number {
  if (!yoy) return 0;
  const m = String(yoy).match(/-?\d+(?:[.,]\d+)?/);
  return m ? Math.abs(parseFloat(m[0].replace(",", "."))) : 0;
}

/**
 * Note "wow" d un KPI. Priorite aux unites physiques, puis aux flags wow
 * poses par le pipeline, puis a l ampleur de la variation annuelle.
 */
function noteWow(k: KPI): number {
  let n = 0;
  if (!estFinancier(k.unit)) n += 5;
  if ((k as { is_wow?: boolean }).is_wow) n += 4;
  if ((k as { story_category?: string }).story_category) n += 1;
  const y = magnitudeYoy(k.yoy);
  if (y >= 30) n += 3;
  else if (y >= 15) n += 2;
  else if (y >= 8) n += 1;
  const h = Array.isArray(k.history) ? k.history.length : 0;
  if (h >= 5) n += 1;
  if ((k as { is_generic?: boolean }).is_generic) n -= 3;
  return n;
}

function troisWow(c: Company): KPI[] {
  const ks = (c.kpis ?? []).filter(
    (k) => k && k.value != null && (k.name_fr || k.name_en || k.short),
  );
  return [...ks]
    .map((k) => ({ k, n: noteWow(k) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((x) => x.k);
}

function LigneKpi({ k, locale }: { k: KPI; locale: string }) {
  const history = Array.isArray(k.history)
    ? (k.history.filter((x) => typeof x === "number") as number[])
    : [];
  const d = prepareHeroDisplay(String(k.value), String(k.unit ?? ""), history);
  const tone = yoyTone(k.yoy ?? "", String(k.type ?? ""));
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#71717a";
  const nom =
    locale === "fr"
      ? k.name_fr || k.name_en || k.short
      : k.name_en || k.name_fr || k.short;
  return (
    <div className="flex items-baseline justify-between gap-2 py-[5px]">
      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-400">
        {nom}
      </span>
      <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap">
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-zinc-100">
          {d.value}
        </span>
        {d.unit && (
          <span className="text-[11px] font-medium text-zinc-400">{d.unit}</span>
        )}
        {k.yoy && (
          <span
            className="ml-1 font-mono text-[11px] tabular-nums"
            style={{ color: yoyColor }}
          >
            {k.yoy}
          </span>
        )}
      </span>
    </div>
  );
}

export function HomeWowGrid({
  companies,
  universe,
  buildHref,
  locale,
  requireSignupGate = false,
  gatePath = "/",
  labelVoirPlus,
}: {
  companies: Record<string, Company>;
  universe: readonly string[];
  buildHref: (t: string) => string;
  locale: string;
  requireSignupGate?: boolean;
  gatePath?: string;
  labelVoirPlus: string;
}) {
  const [visible, setVisible] = useState(VISIBLE_PAR_DEFAUT);

  const rows = useMemo(() => {
    const dispo = new Set(universe.map((t) => t.toUpperCase()));
    const tickersSet = new Set(universe.map((t) => t.toUpperCase()));
    const out: { ticker: string; c: Company; kpis: KPI[] }[] = [];
    for (const t of (POPULAR_FR as { tickers: string[] }).tickers) {
      if (out.length >= MAXIMUM) break;
      const up = t.toUpperCase();
      if (!dispo.has(up)) continue;
      const c = companies[up];
      if (!c || !c.name) continue;
      const kpis = troisWow(c);
      if (kpis.length === 0) continue;
      out.push({ ticker: up, c, kpis });
    }
    return { out, tickersSet };
  }, [companies, universe]);

  const affiches = rows.out.slice(0, visible);
  const enPlus = rows.out.length > visible;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {affiches.map(({ ticker, c, kpis }) => {
          const accent = brand(ticker).primary;
          const card = (
            <Link
              href={buildHref(ticker)}
              className="conic-border group relative flex h-full flex-col rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `${accent}55` }}
              />
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs" style={{ color: accent }}>
                    {displayTicker(ticker, rows.tickersSet)}
                  </div>
                  <div className="mt-0.5 truncate text-[15px] font-medium leading-snug text-zinc-100">
                    {c.name}
                  </div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 -translate-x-1 text-zinc-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
              </div>
              <div className="mt-2.5 divide-y divide-white/[0.05] border-t border-white/[0.07]">
                {kpis.map((k, i) => (
                  <LigneKpi key={`${k.short}-${i}`} k={k} locale={locale} />
                ))}
              </div>
            </Link>
          );
          return (
            <SignupGateOverlay
              key={ticker}
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
