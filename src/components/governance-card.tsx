"use client";

import { useState } from "react";
import {
  Briefcase,
  Vote,
  Users,
  Award,
  Building2,
  Scale,
  UserCheck,
  Info,
  Calendar,
  Landmark,
  PieChart,
} from "lucide-react";
import type { Company, Governance, PeerRank, Shareholder } from "@/lib/data";
import { brand } from "@/lib/brand";
import { InfoTooltip } from "@/components/info-tooltip";
import { HolographicPie } from "@/components/holographic-pie";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";
import { isBlockDisabledForTicker } from "@/lib/disabled-blocks";

function fmt(n: number | undefined | null, decimals = 0, locale: Locale = "fr") {
  // Guard ajouté 4 mai 2026 : datasets pipeline (NFLX et autres) peuvent
  // avoir des champs governance manquants (ceo_pay_ratio, avg_board_age,
  // etc.). Sans ce guard, fmt(undefined) crashait toLocaleString = 500
  // server-side sur la fiche société.
  if (n === undefined || n === null || Number.isNaN(n)) return "-";
  return n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const RANK_META: Record<PeerRank, { labelKey: string; color: string }> = {
  bas: { labelKey: "governance.peer.bas", color: "#10b981" },
  moyen: { labelKey: "governance.peer.moyen", color: "#a1a1aa" },
  haut: { labelKey: "governance.peer.haut", color: "#f59e0b" },
  "extrême": { labelKey: "governance.peer.extreme", color: "#f43f5e" },
};

function PeerChip({ rank, inverse = false }: { rank: PeerRank; inverse?: boolean }) {
  const { t } = useT();
  // inverse flag : lower is better. Flips color mapping for visual interpretation.
  const meta = RANK_META[rank];
  const displayColor =
    inverse && rank === "haut"
      ? RANK_META["haut"].color
      : inverse && rank === "bas"
        ? RANK_META["bas"].color
        : meta.color;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{
        background: `${displayColor}1a`,
        color: displayColor,
        border: `1px solid ${displayColor}40`,
      }}
    >
      {t(meta.labelKey)}
    </span>
  );
}

function MetricCell({
  Icon,
  label,
  value,
  color,
  tooltip,
  note,
  peerRank,
  inverse = false,
  freeBlocked = false,
  ticker,
}: {
  Icon: typeof Briefcase;
  label: string;
  value: string;
  color: string;
  tooltip?: React.ReactNode;
  /** Mention courte sous la valeur (ex succession CEO : "rémunération = ex-CEO X, FY2025"). */
  note?: string;
  peerRank?: PeerRank;
  inverse?: boolean;
  freeBlocked?: boolean;
  ticker?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3.5">
      <span
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-zinc-200">{label}</span>
          {tooltip && (
            <InfoTooltip color={color}>{tooltip}</InfoTooltip>
          )}
        </div>
        <div className="mt-1 font-mono text-xl font-semibold tabular-nums" style={{ color: freeBlocked ? "#52525b" : color }}>
          {freeBlocked ? (
            <BlurredFreeValue value={value} ticker={ticker} />
          ) : (
            value
          )}
        </div>
        {note && (
          <div className="mt-0.5 text-[11px] italic text-zinc-400">{note}</div>
        )}
        {peerRank && (
          <div className="mt-1.5">
            <PeerChip rank={peerRank} inverse={inverse} />
          </div>
        )}
      </div>
    </div>
  );
}

function HolderRow({ h, index, freeBlocked = false, ticker }: { h: Shareholder; index: number; freeBlocked?: boolean; ticker?: string }) {
  const { t, locale } = useT();
  const typeMeta: Record<Shareholder["type"], { labelKey: string; color: string }> = {
    institutionnel: { labelKey: "governance.holder.institutionnel", color: "#06b6d4" },
    particulier: { labelKey: "governance.holder.particulier", color: "#a78bfa" },
    insider: { labelKey: "governance.holder.insider", color: "#f59e0b" },
    fondateur: { labelKey: "governance.holder.fondateur", color: "#fbbf24" },
    "fonds souverain": { labelKey: "governance.holder.fonds_souverain", color: "#10b981" },
  };
  // Yann 27 mai 2026 (point 4) : fallback défensif si h.type est null ou
  // une valeur hors map (ex ATO / PYPL : overrides_governance.top_capital[]
  // contient des holders avec type=null → meta.color crashait SSR → erreur
  // 500 sur les fiches société).
  const TYPE_META_FALLBACK = typeMeta.institutionnel;
  const meta = typeMeta[h.type] ?? TYPE_META_FALLBACK;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3">
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500"
      >
        #{index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-zinc-100">
            {h.name}
            {h.role && (
              <span className="font-normal text-zinc-400"> ({h.role})</span>
            )}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: `${meta.color}1a`,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
            }}
          >
            {t(meta.labelKey)}
          </span>
        </div>
      </div>
      <div className="font-mono text-lg font-bold tabular-nums text-zinc-50">
        {freeBlocked ? (
          <BlurredFreeValue value="0,0" suffix=" %" ticker={ticker} />
        ) : (
          <>
            {fmt(h.stake_pct, 1, locale)}
            <span className="ml-0.5 text-xs text-zinc-400"> %</span>
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string | null | undefined, locale: Locale = "fr"): string {
  if (!iso || typeof iso !== "string") return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Détecte si la sté a une structure dual-class (Class A / Class B avec
 * droits de vote différenciés).
 *
 * Source 1 (prioritaire) : le texte `voting_structure` lui-même. Quand le
 * filing décrit explicitement des classes à droits de vote multiples
 * (ex META : « Class B = 10 votes, Class A = 1 vote »), c'est la vérité
 * la plus fiable. L'heuristique par chevauchement de noms (source 2)
 * échoue dans ce cas car le fondateur (Mark Zuckerberg) figure à la fois
 * dans top_voting ET top_capital → faux négatif « Mono-class ».
 *
 * Source 2 (repli) : si top_voting et top_capital partagent moins de la
 * moitié de leurs noms en commun, ce sont des sets de détenteurs
 * différents → super-vote en place (cas GOOGL avec Larry Page / Sergey
 * Brin via Class B et top_capital institutionnel distinct).
 */
function detectDualClass(
  voting?: { name: string }[],
  capital?: { name: string }[],
  votingStructure?: string | null
): boolean {
  // Source 1 : texte voting_structure explicite (FR + EN).
  if (votingStructure) {
    const v = votingStructure.toLowerCase();
    const dualSignals = [
      "dual_class",
      "dual-class",
      "dual class",
      "classe b",
      "class b",
      "10 vote",
      "ten vote",
      "droits de vote double",
      "droits de vote multiple",
      "actions à droits de vote",
      "super-vote",
      "super vote",
      "multiple vote",
    ];
    if (dualSignals.some((s) => v.includes(s))) return true;
    // Mono-class explicite = tout aussi fiable que le dual explicite. Sans ce
    // court-circuit, le repli heuristique (source 2) déclarait DUAL-CLASS des
    // stés mono-class (JPM, JNJ, WMT, PYPL) simplement parce que leurs listes
    // top_voting et top_capital différaient.
    const monoSignals = [
      "one share one vote",
      "one share, one vote",
      "one_share_one_vote",
      "one vote per share",
      "une action une voix",
      "une action, une voix",
      "une action un vote",
      "une action, un vote",
      "une seule classe",
      "single class",
      "1 vote par action",
      "un vote par action",
    ];
    if (monoSignals.some((s) => v.includes(s))) return false;
  }
  // Source 2 : repli heuristique par chevauchement de noms.
  if (!voting?.length || !capital?.length) return false;
  const votingNames = new Set(
    voting.filter((s) => typeof s.name === "string").map((s) => s.name.toLowerCase()),
  );
  const overlap = capital.filter(
    (s) => typeof s.name === "string" && votingNames.has(s.name.toLowerCase()),
  ).length;
  return overlap < Math.min(voting.length, capital.length) / 2;
}

/**
 * Extrait le symbole devise depuis un libellé d'unité KPI (ex "Mds $",
 * "Mds €", "M £", "Mds CHF"). Retourne le symbole canonique ou null si
 * indétectable. Ajouté 17 mai 2026 pour fixer le bug "M $" hardcodé sur
 * les stés cotées € / £ / CHF (1604 stés Mds €, 43 stés Mds £ dans le
 * dataset).
 */
function extractCurrencySymbol(unit?: string | null): string | null {
  if (!unit) return null;
  // Devises à symbole direct ($, €, £, ¥)
  const symMatch = unit.match(/[$€£¥]/);
  if (symMatch) return symMatch[0];
  // Codes ISO (CHF, JPY, EUR, USD, GBP, DKK, SEK, NOK, CAD, AUD, HKD, CNY, ...)
  const codeMatch = unit.match(/\b(CHF|JPY|EUR|USD|GBP|DKK|SEK|NOK|CAD|AUD|HKD|CNY|SGD|INR|BRL|MXN|ZAR|TRY|PLN|RUB|KRW)\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    // Mapping vers symbole d'affichage si pertinent (sinon retourne le code).
    if (code === "EUR") return "€";
    if (code === "USD") return "$";
    if (code === "GBP") return "£";
    if (code === "JPY") return "¥";
    return code;
  }
  return null;
}

/**
 * Détecte la devise principale d'affichage pour la rémunération CEO :
 *  - Plan A : company.financial_snapshot.currency (code ISO yfinance)
 *  - Plan B : extraction depuis l'unité du KPI hero (ou premier KPI
 *    avec une devise détectable dans unit)
 *  - Plan C fallback : "$" (US par défaut)
 */
function detectCompanyCurrencySymbol(company?: Company | null): string {
  if (!company) return "$";
  // Plan A : financial_snapshot.currency (code ISO 3 lettres)
  const fsCurrency = company.financial_snapshot?.currency;
  if (fsCurrency) {
    const sym = extractCurrencySymbol(fsCurrency);
    if (sym) return sym;
  }
  // Plan B : hero KPI unit, sinon premier KPI avec devise détectable
  const heroKpi = company.kpis?.find((k) => k.short === company.hero_kpi);
  const heroSym = extractCurrencySymbol(heroKpi?.unit);
  if (heroSym) return heroSym;
  for (const k of company.kpis ?? []) {
    const sym = extractCurrencySymbol(k.unit);
    if (sym) return sym;
  }
  // Plan C : fallback US
  return "$";
}

export function GovernanceCard({
  governance,
  ticker,
  company,
  freeBlocked = false,
  disabledBlocks,
}: {
  governance: Governance;
  ticker: string;
  company?: Company | null;
  /** Yann (25 mai 2026) : floute valeurs chiffrées governance en mode free. */
  freeBlocked?: boolean;
  /** Yann 9 juin 2026 : blocs désactivés résolus côté serveur (Supabase +
   *  fallback JSON). Déjà étendu legacy (gouvernance_top3 → votes + capital)
   *  côté serveur. Si fourni, prime sur le fallback client
   *  `isBlockDisabledForTicker`. Fallback obligatoire pour ne pas casser
   *  les pages qui ne passent pas encore la prop (v1-8, v1-7-5). */
  disabledBlocks?: string[];
}) {
  const { t, locale } = useT();
  const accent = brand(ticker).primary;
  // Helper local : prop si fournie, sinon fallback isBlockDisabledForTicker.
  const isDisabled = (k: string): boolean =>
    disabledBlocks
      ? disabledBlocks.includes(k)
      : isBlockDisabledForTicker(ticker, k);
  const g = governance;
  const [pieOpen, setPieOpen] = useState<"voting" | "capital" | null>(null);
  // Devise dynamique : ASML → €, AAPL → $, ARM → £, NESN.SW → CHF.
  const currencySymbol = detectCompanyCurrencySymbol(company);
  const currency = locale === "fr" ? `M ${currencySymbol}` : `M${currencySymbol}`;
  const yearsUnit = t("governance.metrics.tenure_unit");

  // Yann 29 mai 2026 (Bug 6) : ne JAMAIS rendre un sous-bloc vide.
  // Pour chaque metric, on n'inclut l'entrée que si la valeur sous-jacente
  // existe (number > 0). Sinon le sous-bloc est SUPPRIMÉ entièrement (pas de
  // "—" frustrant).
  const hasNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  // Color seeds for each metric (independent of peer rank — peer rank shown separately)
  const metrics = [
    ...(hasNum(g.ceo_total_comp_m) ? [{
      Icon: Briefcase,
      // Succession en cours d'exercice (Yann 15 juil 2026) : afficher le CEO
      // ACTUEL, la rémunération restant celle de l'ex-CEO couvert par le proxy.
      label: g.ceo_current && g.ceo_current !== g.ceo_name
        ? `${t("governance.metrics.ceo_comp_label")} (${g.ceo_current}${g.ceo_current_since ? `, depuis ${g.ceo_current_since}` : ""})`
        : g.ceo_name ? `${t("governance.metrics.ceo_comp_label")} (${g.ceo_name})` : t("governance.metrics.ceo_comp_label"),
      value: `${fmt(g.ceo_total_comp_m, 1, locale)} ${currency}`,
      note: g.ceo_current && g.ceo_current !== g.ceo_name
        ? (locale === "fr" ? `rémunération = ex-CEO ${g.ceo_name}, FY${g.fiscal_year}` : `compensation = former CEO ${g.ceo_name}, FY${g.fiscal_year}`)
        : undefined,
      color: "#a78bfa",
      tooltip: (
        <div className="text-[12px] leading-relaxed text-zinc-200">
          <p>
            {t("governance.metrics.ceo_comp_tooltip")} {g.fiscal_year}.
            {g.ceo_current && g.ceo_current !== g.ceo_name && (
              <> {locale === "fr"
                ? `${g.ceo_current} dirige la société${g.ceo_current_since ? ` depuis ${g.ceo_current_since}` : ""} ; la rémunération affichée est celle de l'ex-CEO ${g.ceo_name} (dernier proxy, FY${g.fiscal_year}).`
                : `${g.ceo_current} has led the company${g.ceo_current_since ? ` since ${g.ceo_current_since}` : ""}; the compensation shown is that of former CEO ${g.ceo_name} (latest proxy, FY${g.fiscal_year}).`}</>
            )}
          </p>
          {g.comp_detail && (
            <ul className="mt-2 space-y-0.5 text-[11.5px] text-zinc-300">
              {([
                [locale === "fr" ? "Salaire" : "Salary", g.comp_detail.ceo_salary_m],
                ["Bonus", g.comp_detail.ceo_bonus_m],
                [locale === "fr" ? "Actions" : "Stock awards", g.comp_detail.ceo_stock_awards_m],
                ["Options", g.comp_detail.ceo_option_awards_m],
                [locale === "fr" ? "Incitation annuelle" : "Non-equity incentive", g.comp_detail.ceo_non_equity_incentive_m],
                [locale === "fr" ? "Autres" : "Other", g.comp_detail.ceo_other_m],
              ] as Array<[string, number | undefined]>)
                .filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0)
                .map(([label, v]) => (
                  <li key={label} className="flex justify-between gap-4">
                    <span>{label}</span>
                    <span className="font-mono">{fmt(v as number, 2, locale)} {currency}</span>
                  </li>
                ))}
              {typeof g.comp_detail.median_employee_pay === "number" && g.comp_detail.median_employee_pay > 0 && (
                <li className="mt-1 flex justify-between gap-4 border-t border-white/10 pt-1">
                  <span>{locale === "fr" ? "Salaire médian employé" : "Median employee pay"}</span>
                  <span className="font-mono">
                    {Math.round(g.comp_detail.median_employee_pay).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} $
                  </span>
                </li>
              )}
              {g.comp_detail.neo2_name && typeof g.comp_detail.neo2_total_comp_m === "number" && (
                <li className="flex justify-between gap-4">
                  <span>{locale === "fr" ? "N°2" : "2nd highest paid"} ({g.comp_detail.neo2_name})</span>
                  <span className="font-mono">{fmt(g.comp_detail.neo2_total_comp_m, 1, locale)} {currency}</span>
                </li>
              )}
              {g.comp_detail.note_structure && (
                <li className="mt-1 italic text-zinc-400">{g.comp_detail.note_structure}</li>
              )}
            </ul>
          )}
        </div>
      ),
      peerRank: g.ceo_comp_rank,
      inverse: true,
    }] : []),
    ...(hasNum(g.ceo_pay_ratio) ? [{
      Icon: Award,
      label: t("governance.metrics.pay_ratio_label"),
      value: `${fmt(g.ceo_pay_ratio, 0, locale)}×`,
      color: "#f59e0b",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          {t("governance.metrics.pay_ratio_tooltip")}
        </p>
      ),
      peerRank: g.ceo_pay_ratio_rank,
      inverse: true,
    }] : []),
    ...(hasNum(g.exec_comp_approval_pct) ? [{
      Icon: Vote,
      label: t("governance.metrics.exec_approval_label"),
      value: `${fmt(g.exec_comp_approval_pct, 1, locale)} %`,
      color: "#06b6d4",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          {t("governance.metrics.exec_approval_tooltip")}
        </p>
      ),
      peerRank: g.exec_comp_approval_rank,
    }] : []),
    ...(hasNum(g.board_independence_pct) ? [{
      Icon: UserCheck,
      label: t("governance.metrics.board_independence_label"),
      value: `${fmt(g.board_independence_pct, 0, locale)} %`,
      color: "#10b981",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          {t("governance.metrics.board_independence_tooltip")}
        </p>
      ),
      peerRank: g.board_independence_rank,
    }] : []),
    ...(hasNum(g.board_size) ? [{
      Icon: Users,
      label: t("governance.metrics.board_size_label"),
      value: `${fmt(g.board_size, 0, locale)} ${t("governance.metrics.board_size_unit")}`,
      color: "#a78bfa",
      tooltip: g.directors && g.directors.length > 0 ? (
        <>
          <p className="mb-2 text-[12px] font-semibold text-zinc-100">
            {t("governance.metrics.board_size_tooltip_title")}
          </p>
          <ul className="space-y-1 text-[11.5px] text-zinc-300">
            {g.directors.map((d, i) => (
              <li key={i}>
                <span className="font-medium text-zinc-100">{d.name}</span>
                <span className="text-zinc-400"> ({d.role})</span>
              </li>
            ))}
          </ul>
        </>
      ) : undefined,
    }] : []),
    ...(hasNum(g.avg_tenure_years) ? [{
      Icon: Calendar,
      label: t("governance.metrics.tenure_label"),
      value: `${fmt(g.avg_tenure_years, 1, locale)} ${yearsUnit}`,
      color: "#06b6d4",
      tooltip: (
        <p className="text-[12px] leading-relaxed text-zinc-200">
          {t("governance.metrics.tenure_tooltip")}
        </p>
      ),
    }] : []),
    // Yann 9 août 2026 : null aussi exclu (affichait "— %" au lieu de
    // masquer la ligne quand la donnée n'est pas sourcée).
    ...(g.board_women_pct != null
      ? [
          {
            Icon: Users,
            label: t("governance.metrics.women_label"),
            value: `${fmt(g.board_women_pct, 0, locale)} %`,
            color: "#f43f5e",
            tooltip: (
              <p className="text-[12px] leading-relaxed text-zinc-200">
                {t("governance.metrics.women_tooltip")}
              </p>
            ),
          },
        ]
      : []),
    ...(g.avg_board_age !== undefined
      ? [
          {
            Icon: Calendar,
            label: t("governance.metrics.age_label"),
            value: `${fmt(g.avg_board_age, 0, locale)} ${yearsUnit}`,
            color: "#a1a1aa",
          },
        ]
      : []),
    ...(g.insider_ownership_pct !== undefined
      ? [
          {
            Icon: Scale,
            label: t("governance.metrics.insider_label"),
            value: `${fmt(g.insider_ownership_pct, 2, locale)} %`,
            color: "#fbbf24",
            tooltip: (
              <p className="text-[12px] leading-relaxed text-zinc-200">
                {t("governance.metrics.insider_tooltip")}
              </p>
            ),
          },
        ]
      : []),
  ];

  const metricsCount = metrics.length;
  // Centering logic: if we have an exact multiple of 3, grid fills naturally.
  // If metricsCount % 3 === 1 → center the last row (1 cell centered over 3 cols)
  // If metricsCount % 3 === 2 → center the last row (2 cells centered over 3 cols)
  const rem = metricsCount % 3;
  const fullRows = Math.floor(metricsCount / 3);
  const lastRowOffset = rem === 0 ? 0 : rem === 1 ? 1 : 0;
  const fullRowMetrics = metrics.slice(0, fullRows * 3);
  const lastRowMetrics = metrics.slice(fullRows * 3);

  return (
    <section className="mt-9 animate-fade-up-d2 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-5 sm:p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="flex flex-wrap items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Building2 className="size-5" style={{ color: accent }} />
            {t("governance.title")}
            {(() => {
              const isDual = detectDualClass(g.top_voting, g.top_capital, g.voting_structure);
              return (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider ${
                    isDual
                      ? "border-amber-400/45 bg-amber-500/10 text-amber-200"
                      : "border-[#2a2a2a] bg-[#101014] text-zinc-300"
                  }`}
                  title={
                    isDual
                      ? t("governance.dual_class_tooltip")
                      : t("governance.mono_class_tooltip")
                  }
                >
                  <span className={`size-1.5 rounded-full ${isDual ? "bg-amber-300" : "bg-zinc-400"}`} />
                  {isDual ? t("governance.dual_class") : t("governance.mono_class")}
                </span>
              );
            })()}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            {(() => {
              const dateStr = formatDate(g.agm_date, locale);
              if (dateStr) {
                return (
                  <>
                    {t("governance.subtitle_prefix")} {dateStr}. {t("governance.subtitle_suffix")} {g.fiscal_year}.
                  </>
                );
              }
              return (
                <>
                  {t("governance.subtitle_suffix")} {g.fiscal_year}.
                </>
              );
            })()}
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {fullRowMetrics.map((m, i) => (
          <MetricCell key={i} {...m} freeBlocked={freeBlocked} ticker={ticker} />
        ))}
      </div>
      {lastRowMetrics.length > 0 && (
        <div
          className={`mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${
            rem === 1 ? "lg:grid-cols-3" : rem === 2 ? "lg:grid-cols-2 lg:mx-auto lg:max-w-[66%]" : "lg:grid-cols-3"
          }`}
        >
          {rem === 1 && <div className="hidden lg:block" />}
          {lastRowMetrics.map((m, i) => (
            <MetricCell key={i} {...m} freeBlocked={freeBlocked} ticker={ticker} />
          ))}
          {rem === 1 && <div className="hidden lg:block" />}
        </div>
      )}
      {/* unused but silence lint */}
      {false && <span>{lastRowOffset}</span>}

      {/* Voting structure note */}
      {g.voting_structure && !isDisabled("gouvernance_voting_structure") && (
        <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#0c0c0c] p-3.5">
          <div className="flex items-start gap-2.5">
            <Scale className="mt-0.5 size-4 shrink-0 text-zinc-300" />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
                {t("governance.voting_structure")}
              </div>
              <div className="mt-0.5 text-[13px] text-zinc-200">{g.voting_structure}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top shareholders : voting rights + capital.
          Yann 29 mai 2026 : 2 toggles indépendants (gouvernance_top3_votes,
          gouvernance_top3_capital). Rétro-compat : si l'ancienne clé legacy
          `gouvernance_top3` est présente (global ou per-sté), elle désactive
          automatiquement les 2 sous-blocs via la logique de
          isBlockDisabledForTicker. */}
      {(() => {
        const votesDisabled = isDisabled("gouvernance_top3_votes");
        const capitalDisabled = isDisabled("gouvernance_top3_capital");
        const showVotes = !!(g.top_voting && g.top_voting.length > 0) && !votesDisabled;
        const showCapital = !!(g.top_capital && g.top_capital.length > 0) && !capitalDisabled;
        if (!showVotes && !showCapital) return null;
        return (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {showVotes && (
              <button
                onClick={() => setPieOpen("voting")}
                className="group relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 text-left transition-all hover:border-amber-400/40 hover:bg-[#0c0c0c]"
                style={{ boxShadow: "0 0 0 0 rgba(245,158,11,0.0)" }}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <Vote className="size-4 text-amber-300" />
                  <span className="font-sans text-[13px] font-semibold uppercase tracking-wider text-zinc-100">
                    Top {g.top_voting!.length} : {t("governance.top_voting")}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-amber-200 opacity-0 transition-opacity group-hover:opacity-100">
                    <PieChart className="size-3" />
                    {t("governance.view_3d")}
                  </span>
                </div>
                <div className="space-y-2">
                  {g.top_voting!.map((h, i) => (
                    <HolderRow key={h.name} h={h} index={i} freeBlocked={freeBlocked} ticker={ticker} />
                  ))}
                </div>
              </button>
            )}
            {showCapital && (
              <button
                onClick={() => setPieOpen("capital")}
                className="group relative overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-[#0c0c0c]"
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <Landmark className="size-4 text-cyan-300" />
                  <span className="font-sans text-[13px] font-semibold uppercase tracking-wider text-zinc-100">
                    Top {g.top_capital!.length} : {t("governance.top_capital")}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-cyan-200 opacity-0 transition-opacity group-hover:opacity-100">
                    <PieChart className="size-3" />
                    {t("governance.view_3d")}
                  </span>
                </div>
                <div className="space-y-2">
                  {g.top_capital!.map((h, i) => (
                    <HolderRow key={h.name} h={h} index={i} freeBlocked={freeBlocked} ticker={ticker} />
                  ))}
                </div>
              </button>
            )}
          </div>
        );
      })()}

      {/* Holographic 3D Pie modal */}
      {(() => {
        const sh = pieOpen === "voting" ? g.top_voting ?? [] : g.top_capital ?? [];
        return (
          <HolographicPie
            shareholders={sh}
            title={
              pieOpen === "voting"
                ? t("governance.pie_title.voting")
                : t("governance.pie_title.capital")
            }
            open={pieOpen !== null}
            onClose={() => setPieOpen(null)}
            accent={pieOpen === "voting" ? "#f59e0b" : "#06b6d4"}
            // Style callouts pour les 2 (la version chunky avait un défaut de
            // construction sur les parois latérales pour les parts back-facing).
            variant="callouts"
          />
        );
      })()}

      {g.notes && g.notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Info className="size-3.5 text-amber-200" />
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-amber-200">
              {t("governance.notes")}
            </span>
          </div>
          <ul className="space-y-1 text-[13px] text-amber-100/95">
            {g.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-400">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
