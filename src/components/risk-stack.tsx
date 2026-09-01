"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Gavel,
  Swords,
  ShieldAlert,
  Wrench,
  Banknote,
  Globe2,
  Cpu,
  AlertTriangle,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  X,
} from "lucide-react";
import type { CompanyRisk, ProfitWarning, RiskCategory, RiskTrend } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { AutoTooltipText } from "@/components/auto-tooltip-text";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";
import { BlurredFreeText } from "@/components/freemium/blurred-free-text";

function formatDate(iso: string, locale: string = "fr"): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function ProfitWarningCard({ pw }: { pw: ProfitWarning }) {
  const { t, locale } = useT();
  const scoreColor =
    pw.score <= 1 ? "#10b981" :
    pw.score <= 2 ? "#84cc16" :
    pw.score <= 3 ? "#f59e0b" :
    pw.score <= 4 ? "#f97316" : "#f43f5e";
  const scoreLabel =
    pw.score <= 1 ? t("risks.pw.score.very_unlikely") :
    pw.score <= 2 ? t("risks.pw.score.unlikely") :
    pw.score <= 3 ? t("risks.pw.score.moderate") :
    pw.score <= 4 ? t("risks.pw.score.high") : t("risks.pw.score.imminent");
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] transition-colors hover:border-[#2a2a2a]">
      <div className="flex items-start gap-3.5 p-4">
        <span
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `${scoreColor}1a`,
            color: scoreColor,
            border: `1px solid ${scoreColor}40`,
          }}
        >
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${scoreColor}1a`,
                color: scoreColor,
                border: `1px solid ${scoreColor}33`,
              }}
            >
              {t("risks.pw.label")}
            </span>
            <InfoTooltip color={scoreColor}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: scoreColor }}>
                {t("risks.pw.title_tooltip")}
              </div>
              <p className="text-[12px] leading-relaxed text-zinc-200">
                {t("risks.pw.explainer")}
              </p>
              <p className="mt-2 text-[11.5px] text-zinc-300">
                <span className="font-semibold">{t("risks.pw.note_label")}</span> {t("risks.pw.note_body")}
              </p>
            </InfoTooltip>
          </div>

          <div className="mt-2 text-[15px] font-semibold leading-snug text-zinc-50">
            {t("risks.pw.headline")}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <ScoreBar score={pw.score} color={scoreColor} />
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: scoreColor }}
            >
              {scoreLabel}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400">
              {pw.score}/5
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-zinc-300">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
              {t("risks.pw.last_date")}
            </span>
            <span className="font-mono text-[13px] font-semibold text-zinc-50">
              {pw.last_date ? formatDate(pw.last_date, locale) : t("risks.pw.never")}
            </span>
          </div>

          {/* Yann 15 juin 2026 : rationale + tendance marges RETIRÉS du bloc
              profit warning (texte sans PV type "sans donnée yoy exploitable").
              Le frame se referme sur la date du dernier signal. */}
        </div>
      </div>
    </div>
  );
}

const CATEGORY_META: Record<
  RiskCategory,
  { labelKey: string; color: string; Icon: typeof Gavel }
> = {
  regulatory: { labelKey: "risks.category.regulatory", color: "#f59e0b", Icon: Gavel },
  competitive: { labelKey: "risks.category.competitive", color: "#f43f5e", Icon: Swords },
  cyber: { labelKey: "risks.category.cyber", color: "#06b6d4", Icon: ShieldAlert },
  operational: { labelKey: "risks.category.operational", color: "#a78bfa", Icon: Wrench },
  financial: { labelKey: "risks.category.financial", color: "#10b981", Icon: Banknote },
  macro: { labelKey: "risks.category.macro", color: "#94a3b8", Icon: Globe2 },
  technology: { labelKey: "risks.category.technology", color: "#fb923c", Icon: Cpu },
};

/** Yann 9 août 2026 : ~3 500 stés portent des catégories en texte FR/EN
 *  ("Régulation", "Concurrence", "Cybersécurité", "Industriel", "Capital"…)
 *  qui tombaient toutes dans le fallback "Opérationnel". Normalisation par
 *  mots-clés vers les 7 familles visuelles, sans toucher aux données. */
function normalizeCategory(raw: string | undefined | null): RiskCategory {
  if (!raw) return "operational";
  const c = String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if ((CATEGORY_META as Record<string, unknown>)[c]) return c as RiskCategory;
  if (/regul|reglement|juridique|litige|legal|fiscal|antitrust|conformite|compliance/.test(c)) return "regulatory";
  if (/concurren|competi|strategi|marche interne|parts de marche/.test(c)) return "competitive";
  if (/cyber|donnees|data privacy|securite informatique/.test(c)) return "cyber";
  if (/capital|credit|financ|liquidit|taux|change|dette|actuari/.test(c)) return "financial";
  if (/techno|innovation|obsolescence|ia\b|ai\b/.test(c)) return "technology";
  if (/geopoli|macro|marche\b|market\b|climat|environnement|reputation|pandemi|sanitaire|esg/.test(c)) return "macro";
  return "operational";
}

const TREND_META: Record<
  RiskTrend,
  { labelKey: string; color: string; Icon: typeof ArrowUp | typeof Sparkles }
> = {
  new: { labelKey: "risks.trend.new", color: "#a78bfa", Icon: Sparkles },
  up: { labelKey: "risks.trend.up", color: "#f43f5e", Icon: ArrowUp },
  stable: { labelKey: "risks.trend.stable", color: "#a1a1aa", Icon: Minus },
  down: { labelKey: "risks.trend.down", color: "#10b981", Icon: ArrowDown },
  removed: { labelKey: "risks.trend.removed", color: "#71717a", Icon: X },
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="h-1.5 w-4 rounded-sm"
          style={{
            background: n <= score ? color : "#1f1f1f",
            boxShadow: n <= score ? `0 0 6px ${color}66` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function scoreLabelKey(score: number): string {
  return score >= 5
    ? "risks.score.critical"
    : score >= 4
      ? "risks.score.high"
      : score >= 3
        ? "risks.score.moderate"
        : score >= 2
          ? "risks.score.low"
          : "risks.score.marginal";
}

function RiskCard({ risk, index, freeBlocked = false, ticker }: { risk: CompanyRisk; index: number; freeBlocked?: boolean; ticker?: string }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const displayTitle = locale === "en" && risk.title_en ? risk.title_en : risk.title;
  // quote source = EN (10-K verbatim). En FR, on affiche la traduction si dispo.
  const displayQuote = locale === "fr" && risk.quote_fr ? risk.quote_fr : risk.quote;
  const quoteOpen = locale === "en" ? "“" : "« ";
  const quoteClose = locale === "en" ? "”" : " »";
  // Yann 27 mai 2026 : ne jamais permettre le déroulé si le quote est vide.
  // Sinon = box vide qui frustre. Pas de chevron, pas de click.
  const hasQuote = !!(displayQuote && displayQuote.trim());
  // Garde-fous : nouveaux datasets peuvent avoir des catégories/trends hors mapping
  const meta = CATEGORY_META[normalizeCategory(risk.category)] ?? CATEGORY_META.operational;
  const trend = TREND_META[risk.trend] ?? TREND_META.stable;
  const Icon = meta.Icon;
  const TrendIcon = trend.Icon;

  // Yann 29 mai 2026 : fallback `severity` quand `score` est null (data
  // historique pré-§0quinquies sur NVDA / AMZN / TSLA / V notamment). Toutes
  // les stés ont au moins l'un des deux. Default neutre 3 en cas absolu.
  const rawScore = (risk as unknown as { score?: number; severity?: number });
  const effectiveScore = (typeof rawScore.score === "number" && rawScore.score > 0)
    ? rawScore.score
    : (typeof rawScore.severity === "number" && rawScore.severity > 0)
      ? rawScore.severity
      : 3;
  // Score color scales from yellow (low) to red (critical)
  const scoreColor =
    effectiveScore >= 5
      ? "#ef4444"
      : effectiveScore >= 4
        ? "#f97316"
        : effectiveScore >= 3
          ? "#eab308"
          : effectiveScore >= 2
            ? "#84cc16"
            : "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-[#1a1a1a] bg-[#070707] transition-colors hover:border-[#2a2a2a]"
    >
      <div
        role={hasQuote ? "button" : undefined}
        tabIndex={hasQuote ? 0 : undefined}
        onClick={hasQuote ? () => setOpen((o) => !o) : undefined}
        onKeyDown={hasQuote ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        } : undefined}
        className={`flex w-full items-start gap-3.5 p-4 text-left ${hasQuote ? "cursor-pointer" : "cursor-default"}`}
      >
        <span
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `${meta.color}1a`,
            color: meta.color,
            border: `1px solid ${meta.color}40`,
          }}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${meta.color}1a`,
                color: meta.color,
                border: `1px solid ${meta.color}33`,
              }}
            >
              {t(meta.labelKey)}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${trend.color}1a`,
                color: trend.color,
                border: `1px solid ${trend.color}33`,
              }}
            >
              <TrendIcon className="size-3" />
              {t(trend.labelKey)}
            </span>
          </div>
          <div data-blur-part="titre" className="mt-2 text-[15px] font-semibold leading-snug text-zinc-50">
            {displayTitle}
          </div>

          {/* Yann 1er sept 2026 : la note de severite (jauge + libelle + X/5)
              reste VISIBLE meme au palier gratuit — seule la demande initiale
              (titres et "i") est floutee. La zone data-blur-part="note" la rend
              pilotable depuis l outil de floutage si besoin un jour. */}
          <div data-blur-part="note" className="mt-2.5 flex items-center gap-3">
            <ScoreBar score={effectiveScore} color={scoreColor} />
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: scoreColor }}
            >
              {t(scoreLabelKey(effectiveScore))}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400">
              {effectiveScore}/5
            </span>
            <span
              data-blur-part="titre"
              onClick={(e) => e.stopPropagation()}
              className="ml-1"
            >
              <InfoTooltip color={scoreColor}>
                <div
                  className="mb-1.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: scoreColor }}
                >
                  {t("risks.score_explainer_title")}
                </div>
                <BlurredFreeText blocked={freeBlocked} ticker={ticker} as="p" className="text-[12px] leading-relaxed text-zinc-200">
                  {risk.score_rationale ? (
                    <AutoTooltipText text={normalizeNarrative(risk.score_rationale)} locale="fr" />
                  ) : (
                    risk.score_rationale
                  )}
                </BlurredFreeText>
                <div className="mt-3 rounded-md border border-[#1f1f1f] bg-[#0c0c0c] p-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    {t("risks.score_scale_title")}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-zinc-300">
                    <li>• {t("risks.score_scale_1")}</li>
                    <li>• {t("risks.score_scale_2")}</li>
                    <li>• {t("risks.score_scale_3")}</li>
                    <li>• {t("risks.score_scale_4")}</li>
                  </ul>
                </div>
              </InfoTooltip>
            </span>
          </div>
        </div>
        {hasQuote && (
          <ChevronDown
            className={`mt-1 size-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      <AnimatePresence>
        {open && hasQuote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1a1a1a] px-4 py-3.5">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {t("risks.management_quote")}
              </div>
              <BlurredFreeText blocked={freeBlocked} ticker={ticker} as="p" className="border-l-2 border-[#2a2a2a] pl-3 text-[13px] italic leading-relaxed text-zinc-200">
                {quoteOpen}{displayQuote}{quoteClose}
              </BlurredFreeText>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function RiskStack({
  risks,
  accent = "#a78bfa",
  profitWarning,
  freeBlocked = false,
  ticker,
}: {
  risks: CompanyRisk[];
  accent?: string;
  profitWarning?: ProfitWarning;
  /** Yann (25 mai 2026) : floute score + rationale + quote en mode free. */
  freeBlocked?: boolean;
  ticker?: string;
}) {
  const { t } = useT();
  if (!risks || risks.length === 0) return null;

  // Sort by score desc, mixing the profit warning with regular risks so it
  // takes its rightful place among them based on its own score.
  type Item =
    | { kind: "risk"; key: string; score: number; data: CompanyRisk }
    | { kind: "pw"; key: string; score: number; data: ProfitWarning };
  const items: Item[] = [
    ...risks.map<Item>((r) => ({ kind: "risk", key: r.title, score: r.score, data: r })),
    ...(profitWarning
      ? [{ kind: "pw" as const, key: "profit-warning", score: profitWarning.score, data: profitWarning }]
      : []),
  ].sort((a, b) => b.score - a.score);

  // Count emerging risks (new to 2025)
  const newCount = risks.filter((r) => r.trend === "new").length;
  const upCount = risks.filter((r) => r.trend === "up").length;
  const totalCount = items.length;

  return (
    <section className="mt-9 animate-fade-up-d2">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <AlertTriangle className="size-5" style={{ color: accent }} />
            {t("risks.title")}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            {t("risks.subtitle")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          <span>{totalCount} {t("risks.count")}</span>
          {upCount > 0 && (
            <span className="text-rose-300">{upCount} {upCount > 1 ? t("risks.aggravated_many") : t("risks.aggravated_one")}</span>
          )}
          {newCount > 0 && (
            <span className="text-violet-300">
              {newCount} {newCount > 1 ? t("risks.new_many") : t("risks.new_one")}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {items.map((item, i) =>
          item.kind === "risk" ? (
            <RiskCard key={item.key} risk={item.data} index={i} freeBlocked={freeBlocked} ticker={ticker} />
          ) : (
            <ProfitWarningCard key={item.key} pw={item.data} />
          )
        )}
      </div>
    </section>
  );
}
