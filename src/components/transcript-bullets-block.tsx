"use client";

import { MessageSquare, Sparkles, TrendingUp, AlertTriangle, Target, Compass, Quote, Activity, GitCompare, CheckCircle2, XCircle, ArrowUpDown, Plus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { brand } from "@/lib/brand";
import { periodLabelFromRaw } from "@/lib/period-label";
import { ACRONYM_GLOSSARY } from "@/lib/ui-fix-templates";
import { useT } from "@/lib/i18n/provider";

/**
 * TermSup — mini-tooltip inline pour un terme technique.
 * - Le terme reste à sa place dans la phrase (lecture fluide).
 * - Soulignement pointillé pour signaler qu'un tooltip est dispo.
 * - Petit "ⁱ" en exposant après le mot (n'écrase pas le rythme de lecture).
 * - Hover/clic ouvre une popup positionnée via portal (overflow safe).
 */
function TermSup({ term, explainer, accent }: { term: string; explainer: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);
  // Couleur = même que le ticker affiché dans CompanyHeader (brand(ticker).primary)
  // passée via `accent`. Yann 12 mai 2026 : cohérence visuelle stricte.
  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="cursor-help font-medium transition-opacity hover:opacity-80"
        style={{
          color: accent,
          textDecoration: "underline",
          textDecorationColor: accent,
          textDecorationThickness: "1.5px",
          textUnderlineOffset: "3px",
        }}
      >
        {term}
      </span>
      {mounted &&
        coords &&
        open &&
        createPortal(
          <div
            role="tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="pointer-events-auto fixed z-[1000] w-80 rounded-lg border bg-[#0a0a0a] p-3.5 text-[14px] leading-relaxed text-zinc-200 shadow-2xl"
            style={{ top: coords.top, left: coords.left, borderColor: `${accent}66` }}
          >
            <div className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {term}
            </div>
            <p className="text-[14px] text-zinc-200">{explainer}</p>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Tooltip "i" qui explique ce qu'est un earning call (pour non-bilingues). */
function EarningCallInfoTooltip({ accent }: { accent: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);
  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="ml-1 inline-flex size-5 cursor-help items-center justify-center rounded-full text-[12px] font-bold opacity-70 transition-opacity hover:opacity-100"
        style={{ color: accent, border: `1px solid ${accent}66` }}
        aria-label={t("transcript.bullets.earning_call_aria")}
      >
        i
      </span>
      {mounted && coords && open && createPortal(
        <div
          role="tooltip"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="pointer-events-auto fixed z-[1000] w-[360px] rounded-lg border bg-[#0a0a0a] p-4 text-[14px] leading-relaxed text-zinc-200 shadow-2xl"
          style={{ top: coords.top, left: coords.left, borderColor: `${accent}66` }}
        >
          <div className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
            {t("transcript.bullets.earning_call_label")}
          </div>
          <p className="text-[14px] text-zinc-200">
            {t("transcript.bullets.earning_call_explainer")}
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * TranscriptBulletsBlock — synthèse PV-driven du DERNIER earning call.
 *
 * Format unique pour TOUTES les sociétés (Yann 11 mai 2026) :
 *  - 6-10 bullets denses (chiffre + signal + action)
 *  - Chaque abréviation / terme technique a un tooltip "i" auto-injecté
 *    via ACRONYM_GLOSSARY (24+ entrées : YoY, ARR, FCF, G-SIB, CET1, ROTE…).
 *  - Sentiment management (bullish / neutral / cautious) affiché.
 *  - Pictogramme par type de bullet : synthesis / tonalite / driver /
 *    vigilance / guidance / strategy / citation.
 */

export type BulletItem = {
  text: string;
  type?: "synthesis" | "tonalite" | "driver" | "vigilance" | "guidance" | "strategy" | "citation";
  terms_used?: string[];
};

/** Bullet de la sous-section comparaison vs trimestre précédent. */
export type ComparisonBullet = {
  text: string;
  /**
   * - promise_kept : promesse trimestre N-1 tenue ce trimestre
   * - promise_broken : promesse trimestre N-1 non tenue
   * - guidance_up : guidance révisée à la hausse
   * - guidance_down : guidance révisée à la baisse
   * - new_topic : sujet nouveau apparu (pas mentionné Q-1)
   * - sentiment_shift : changement de ton management (plus ou moins confiant)
   */
  type: "promise_kept" | "promise_broken" | "guidance_up" | "guidance_down" | "new_topic" | "sentiment_shift";
  terms_used?: string[];
};

export type TranscriptBulletsSummary = {
  ticker: string;
  quarter?: string;
  fetched_at?: string;
  source?: string;
  model?: string;
  summary?: {
    tonalite_management?: string;
    sentiment?: "bullish" | "neutral" | "cautious";
    bullets?: BulletItem[];
    new_kpis_for_stories?: Array<{ short?: string; name_fr?: string }>;
  };
  /**
   * Sous-section "suivi" comparée au transcript trimestre précédent.
   * Optionnelle : seulement présente quand 2 transcripts dispo.
   */
  comparison?: {
    prev_quarter?: string;
    bullets?: ComparisonBullet[];
  };
};

const TYPE_META: Record<NonNullable<BulletItem["type"]>, { Icon: typeof TrendingUp; color: string }> = {
  synthesis: { Icon: TrendingUp, color: "#8b5cf6" },
  tonalite: { Icon: Activity, color: "#06b6d4" },
  driver: { Icon: Target, color: "#10b981" },
  vigilance: { Icon: AlertTriangle, color: "#f59e0b" },
  guidance: { Icon: Compass, color: "#a78bfa" },
  strategy: { Icon: Sparkles, color: "#22d3ee" },
  citation: { Icon: Quote, color: "#fbbf24" },
};

// Yann 15 mai 2026 : fallback défensif si le type sérialisé par le LLM
// n'est pas dans la table (ex GE = type "guidance" dans summary.comparison
// alors que COMPARISON_META n'a que guidance_up/guidance_down → crash 500).
// On évite tout undefined.Icon en mappant le type inconnu sur l'entrée
// "synthesis" (TYPE_META) ou "new_topic" (COMPARISON_META).
const TYPE_META_FALLBACK = TYPE_META.synthesis;

const COMPARISON_META: Record<ComparisonBullet["type"], { Icon: typeof TrendingUp; color: string; labelKey: string }> = {
  promise_kept: { Icon: CheckCircle2, color: "#10b981", labelKey: "transcript.bullets.compare.promise_kept" },
  promise_broken: { Icon: XCircle, color: "#f43f5e", labelKey: "transcript.bullets.compare.promise_broken" },
  guidance_up: { Icon: TrendingUp, color: "#22d3ee", labelKey: "transcript.bullets.compare.guidance_up" },
  guidance_down: { Icon: AlertTriangle, color: "#f59e0b", labelKey: "transcript.bullets.compare.guidance_down" },
  new_topic: { Icon: Plus, color: "#a78bfa", labelKey: "transcript.bullets.compare.new_topic" },
  sentiment_shift: { Icon: ArrowUpDown, color: "#fbbf24", labelKey: "transcript.bullets.compare.sentiment_shift" },
};

const COMPARISON_META_FALLBACK = COMPARISON_META.new_topic;

/** Construit un regex global qui matche les termes du glossaire dans un texte. */
function buildGlossaryRegex(): RegExp {
  const terms = Object.keys(ACRONYM_GLOSSARY)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length); // longs d'abord pour éviter G-SIB matché comme G
  return new RegExp(`\\b(${terms.join("|")})\\b`, "g");
}

const GLOSSARY_REGEX = buildGlossaryRegex();

/**
 * Wrappe les termes du glossaire dans un texte avec un InfoTooltip "i".
 * Préserve les guillemets « » et l'italique des citations.
 */
function annotateTerms(text: string, accent: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let i = 0;
  GLOSSARY_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GLOSSARY_REGEX.exec(text)) !== null) {
    const term = m[1];
    const start = m.index;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));
    const explainer = ACRONYM_GLOSSARY[term] ?? "";
    parts.push(<TermSup key={`t-${i++}`} term={term} explainer={explainer} accent={accent} />);
    lastIdx = start + term.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

function sentimentChip(sentiment: "bullish" | "neutral" | "cautious" | undefined, t: (k: string) => string) {
  if (!sentiment) return null;
  const c =
    sentiment === "bullish" ? "#10b981" :
    sentiment === "cautious" ? "#f59e0b" : "#a1a1aa";
  const label = t(`transcript.sentiment.${sentiment}`);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider"
      style={{ color: c, borderColor: `${c}55`, background: `${c}1a` }}
    >
      <Sparkles className="size-3" />
      {label}
    </span>
  );
}

/** Yann 9 août 2026 : les data portent des périodes au format anglais brut
 *  ("2026Q1", "Q1 2026", "Q1-2026") : affichage FR "T1 2026" partout. */
function frQuarterLabel(raw: string | undefined | null, ticker?: string): string | null {
  if (!raw) return null;
  // Yann 25 aout 2026 : normalisation calendaire commune (period-label.ts).
  // Les libelles fiscaux "Q3 FY2026" etaient rendus tels quels ici.
  const norm = periodLabelFromRaw(raw, ticker ?? "", "fr");
  if (norm) return norm;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[\s-]*Q([1-4])$/i);
  if (m) return `T${m[2]} ${m[1]}`;
  m = s.match(/^Q([1-4])[\s-]*(\d{4})$/i);
  if (m) return `T${m[1]} ${m[2]}`;
  return s;
}

export function TranscriptBulletsBlock({
  ticker,
  summary,
  quarterLabel,
}: {
  ticker: string;
  summary: TranscriptBulletsSummary | null;
  quarterLabel?: string;
}) {
  const { t } = useT();
  if (!summary?.summary?.bullets || summary.summary.bullets.length === 0) return null;
  const accent = brand(ticker).primary;
  const s = summary.summary;
  const sentiment = s.sentiment;

  return (
    <section
      id="sec-transcript-bullets"
      data-blur="transcripts"
      className="mt-9 scroll-mt-24 animate-fade-up-d2"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-3 text-[26px] font-semibold text-zinc-50">
            <MessageSquare className="size-6" style={{ color: accent }} />
            {t("transcript.bullets.section_title")}
            <EarningCallInfoTooltip accent={accent} />
          </h2>
          <p className="mt-1 max-w-2xl text-[15px] text-zinc-300">
            {t("transcript.bullets.section_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sentimentChip(sentiment, t)}
          {(quarterLabel || summary.quarter) && (
            <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-400">
              {frQuarterLabel(quarterLabel ?? summary.quarter, ticker)}
            </span>
          )}
        </div>
      </div>

      {/* Zone floutable palier gratuit : tout le contenu du bloc, le header
          (titre, puce sentiment + trimestre, sous-titre) restant lisible. */}
      <div data-blur-part="texte">
      {/* Tonalité management = 1 ligne hero au-dessus des bullets */}
      {s.tonalite_management && (
        <div
          className="mb-3.5 rounded-xl border bg-gradient-to-br from-[#0a0a0a] to-[#070707] px-5 py-3.5"
          style={{ borderColor: `${accent}33` }}
        >
          <p className="text-[15.5px] italic leading-relaxed text-zinc-100">
            {annotateTerms(s.tonalite_management, accent)}
          </p>
        </div>
      )}

      {/* Liste de bullets — 2 colonnes sur desktop, 1 sur mobile */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(s.bullets ?? []).map((b, i) => {
          const meta = TYPE_META[b.type ?? "synthesis"] ?? TYPE_META_FALLBACK;
          const Icon = meta.Icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border bg-gradient-to-br from-[#0a0a0a] to-[#070707] px-4 py-3"
              style={{ borderColor: `${meta.color}33` }}
            >
              <Icon className="mt-0.5 size-5 shrink-0" style={{ color: meta.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-zinc-100">
                  {annotateTerms(b.text, accent)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sous-section comparaison : suivi promesses & écarts vs trimestre précédent. */}
      {summary.comparison?.bullets && summary.comparison.bullets.length > 0 && (
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2.5 text-[20px] font-semibold text-zinc-100">
                <GitCompare className="size-5" style={{ color: accent }} />
                {t("transcript.bullets.comparison_title")}
              </h3>
              <p className="mt-1 max-w-2xl text-[14px] text-zinc-400">
                {t("transcript.bullets.comparison_subtitle")}
              </p>
            </div>
            {summary.comparison.prev_quarter && (
              <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-500">
                vs {frQuarterLabel(summary.comparison.prev_quarter)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {summary.comparison.bullets.map((b, i) => {
              const meta = COMPARISON_META[b.type] ?? COMPARISON_META_FALLBACK;
              const Icon = meta.Icon;
              return (
                <div
                  key={`c-${i}`}
                  className="flex items-start gap-3 rounded-lg border bg-gradient-to-br from-[#0a0a0a]/80 to-[#070707]/80 px-3.5 py-2.5"
                  style={{ borderColor: `${meta.color}33` }}
                >
                  <Icon className="mt-0.5 size-[18px] shrink-0" style={{ color: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                      {t(meta.labelKey)}
                    </div>
                    <p className="text-[14.5px] leading-relaxed text-zinc-200">
                      {annotateTerms(b.text, accent)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
