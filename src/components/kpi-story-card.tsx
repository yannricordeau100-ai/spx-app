"use client";

import { Sparkles, TrendingUp, Building2 } from "lucide-react";
import type { KPI, MarketPosition } from "@/lib/data";
import { brand } from "@/lib/brand";
import type { StorySlide } from "@/lib/kpi-stories-ordering";
import { formatUnit } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { AcronymHover } from "@/components/acronym-hover";

/**
 * Une carte du bloc Stories : soit un KPI short-history, soit une
 * MarketPosition. Format vertical façon Instagram story.
 *
 * Refonte 6 mai 2026 (Yann) :
 *  - KPI name plus gros que la catégorie (catégorie = accessoire,
 *    nom du KPI = info principale après la valeur).
 *  - Espaces vides réduits (plus de vide = plus de présence des info).
 *  - Bottom blocs (Revenu segment / TAM) : valeurs et libellés agrandis.
 *  - Acronymes (TAM, CAGR, etc.) ont un tooltip "i" (un ado de 16 ans
 *    sait pas ce que c'est).
 *  - Sources externes longues (>4 mots) sont déplacées dans un tooltip
 *    "i" pour ne pas polluer l'écran story.
 */
export function KpiStoryCard({ slide, ticker }: { slide: StorySlide; ticker: string }) {
  const accent = brand(ticker).primary;
  const glow = brand(ticker).glow;

  if (slide.kind === "kpi") {
    return <KpiCard kpi={slide.data} accent={accent} glow={glow} />;
  }
  return <MarketPositionStoryCard mp={slide.data} accent={accent} glow={glow} />;
}

/* -------- KPI card (short-history) — format portrait mobile 9:16 -------- */
function KpiCard({ kpi, accent, glow }: { kpi: KPI; accent: string; glow: string }) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-4 pt-11"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Header row : nom KPI à gauche (gros), badge catégorie discret à
            droite. Plus compact que avant : 1 ligne au lieu de 2 niveaux. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <AcronymHover label={kpi.short} align="left">
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
                >
                  {kpi.short}
                </span>
              </AcronymHover>
              {kpi.explanation && (
                <InfoTooltip color={accent} size="sm">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    {kpi.short}
                  </div>
                  <div className="text-zinc-200">{kpi.explanation}</div>
                </InfoTooltip>
              )}
            </div>
            <div className="mt-1 text-[22px] font-bold leading-tight text-zinc-50">
              {kpi.name_fr}
            </div>
          </div>
          <div
            className="shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70"
            style={{ background: `${accent}10`, color: accent, borderColor: `${accent}33` }}
          >
            <Sparkles className="size-2.5" />
            {kpi.story_category || "Story"}
          </div>
        </div>

        {/* Chiffre principal : occupe le centre, beaucoup plus grand qu'avant
            (Yann 7 mai 2026 : "informations essentielles trop petites"). */}
        <div className="my-auto flex flex-col items-center text-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(64px, 22vw, 110px)" }}
          >
            {kpi.value}
          </div>
          {formatUnit(kpi.unit) && (
            <div className="mt-2 text-[20px] font-semibold text-zinc-100">
              {formatUnit(kpi.unit)}
            </div>
          )}
          {kpi.yoy && kpi.yoy.toLowerCase() !== "n/a" && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-[16px] font-bold text-emerald-200">
              <TrendingUp className="size-4" />
              <span className="font-mono tabular-nums">{kpi.yoy}</span>
              <span className="text-[12px] font-medium italic text-zinc-400">(YoY)</span>
            </div>
          )}
        </div>

        {/* Signal en bas (clé du business). Plus compact, taille augmentée
            quand même. La description longue est cachée derrière "i" pour
            ne pas écraser visuellement le chiffre principal. */}
        {kpi.signal && (
          <div className="rounded-xl border border-white/10 bg-black/55 p-3 backdrop-blur">
            <div className="flex items-start gap-1.5">
              <div className="flex-1 text-[15px] font-semibold leading-snug text-zinc-50">
                {kpi.signal}
              </div>
              {kpi.description && (
                <InfoTooltip color={accent} size="sm" align="right">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    Détail
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-zinc-200">
                    {kpi.description}
                  </div>
                </InfoTooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- MarketPosition story card -------- */

/** Compte le nombre de mots utiles d'une chaîne (split sur espaces / · / +). */
function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s
    .split(/[\s·+,]+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function MarketPositionStoryCard({
  mp,
  accent,
  glow,
}: {
  mp: MarketPosition;
  accent: string;
  glow: string;
}) {
  const sharePct = (mp.segment_revenue / mp.tam) * 100;
  // Source >4 mots = trop long pour l'écran story → on cache derrière un "i".
  // Sinon affichage direct en bas (cas court type "Rapport interne 2024").
  const sourceFull = `${mp.source}${mp.source_note ? " · " + mp.source_note : ""}`;
  const sourceIsLong = wordCount(sourceFull) > 4;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Header compact : nom segment à gauche (gros), badge à droite. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-[22px] font-bold leading-tight text-zinc-50">
            {mp.segment_name}
          </div>
          <div
            className="shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70"
            style={{ background: `${accent}10`, color: accent, borderColor: `${accent}33` }}
          >
            <Building2 className="size-2.5" />
            Marché
          </div>
        </div>

        {/* Part de marché : domine l'écran, taille augmentée. */}
        <div className="my-auto flex flex-col items-center text-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(72px, 25vw, 120px)" }}
          >
            {sharePct.toFixed(1)}&nbsp;%
          </div>
          <div className="mt-2 text-[18px] font-semibold text-zinc-100">part de marché</div>
        </div>

        {/* Mini-blocs Revenu segment / TAM : valeurs agrandies, libellés mieux
            mis en valeur. TAM porte un tooltip "i" parce que beaucoup
            d'investisseurs novices ne connaissent pas l'acronyme. */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-white/12 bg-black/45 p-3 backdrop-blur">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
              Revenu segment
            </div>
            <div className="mt-1.5 font-display text-[20px] font-bold leading-none tabular-nums text-zinc-50">
              {mp.segment_revenue}
              <span className="ml-1 text-[12px] font-medium text-zinc-300">
                {formatUnit(mp.segment_unit)}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-3 backdrop-blur">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                TAM
              </span>
              <InfoTooltip color={accent} size="sm">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                  TAM
                </div>
                <div className="text-zinc-200">
                  <span className="font-semibold">Total Addressable Market</span> : taille
                  totale du marché que la société peut viser au maximum, en chiffre
                  d&apos;affaires annuel. C&apos;est le « plafond » théorique. La part de
                  marché ci-dessus = revenu actuel de la société dans ce segment ÷ TAM.
                </div>
              </InfoTooltip>
            </div>
            <div className="mt-1.5 font-display text-[20px] font-bold leading-none tabular-nums text-zinc-50">
              {mp.tam}
              <span className="ml-1 text-[12px] font-medium text-zinc-300">
                {formatUnit(mp.tam_unit)}
              </span>
            </div>
          </div>
        </div>

        {mp.market_cagr != null && (
          <div className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-zinc-300">
            <span>CAGR marché attendu :</span>
            <span className="font-mono font-bold text-zinc-50">
              +{mp.market_cagr.toFixed(1)} % / an
            </span>
            <InfoTooltip color={accent} size="sm">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                CAGR
              </div>
              <div className="text-zinc-200">
                <span className="font-semibold">Compound Annual Growth Rate</span> : taux
                de croissance annuel moyen, calculé comme si la croissance était
                régulière chaque année. Permet de comparer la dynamique d&apos;un
                marché ou d&apos;un revenu sur plusieurs années.
              </div>
            </InfoTooltip>
          </div>
        )}

        {/* Source : si <=4 mots, affichée inline. Sinon mise dans tooltip "i"
            (règle template Yann 6 mai 2026 : aucune source externe longue ne
            doit polluer l'écran principal). */}
        <div className="mt-auto pt-3">
          {sourceIsLong ? (
            <div className="inline-flex items-center gap-1 text-[10.5px] italic text-zinc-400">
              <span>Source</span>
              <InfoTooltip color={accent} size="sm">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                  Source
                </div>
                <div className="not-italic text-zinc-200">{mp.source}</div>
                {mp.source_note && (
                  <div className="mt-1.5 border-t border-white/10 pt-1.5 text-[11.5px] leading-relaxed text-zinc-300">
                    {mp.source_note}
                  </div>
                )}
              </InfoTooltip>
            </div>
          ) : (
            <div className="text-[10.5px] italic leading-snug text-zinc-400">
              Source : {mp.source}
              {mp.source_note && <> · {mp.source_note}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
