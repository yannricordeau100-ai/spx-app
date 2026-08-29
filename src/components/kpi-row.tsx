"use client";

import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { type KPI, formatCAGR, formatUnit, formatHeroValue, yoySamePeriod } from "@/lib/data";
import { cn, yoyTone } from "@/lib/utils";
import { rate } from "@/lib/brand";
import { Sparkline } from "@/components/effects/sparkline";
import { QualityBadge } from "@/components/quality-badge";
import { InfoTooltip } from "@/components/info-tooltip";
import { StarButton } from "@/components/star-button";
import { AcronymHover } from "@/components/acronym-hover";
import { useT } from "@/lib/i18n/provider";
import { caviarde } from "@/lib/floutage-caviardage";
import { kpiPeriodLabel } from "@/lib/period-label";
import { normalizeNarrative, ACRONYM_GLOSSARY, TERM_GLOSSARY } from "@/lib/ui-fix-templates";
import { getFiscalAudit, fiscalQuarterToCalendar } from "@/lib/fiscal-calendar";
import { BlurredFreeText } from "@/components/freemium/blurred-free-text";

const TYPE_COLOR: Record<string, string> = {
  // EN canoniques (legacy)
  Revenue: "#a78bfa",
  Margin: "#06b6d4",
  Cash: "#10b981",
  Volume: "#f59e0b",
  Pricing: "#f43f5e",
  Cost: "#fb7185",
  Investment: "#a78bfa",
  User: "#06b6d4",
  Demand: "#10b981",
  // FR canoniques (Yann 30 mai 2026, mission catégories KPI)
  Revenus: "#a78bfa",
  Marges: "#06b6d4",
  Trésorerie: "#10b981",
  "Solidité financière": "#facc15",
  Capacité: "#fb923c",
  Clientèle: "#06b6d4",
  Investissement: "#a78bfa",
  Productivité: "#34d399",
  Engagement: "#c084fc",
  Pipeline: "#a3e635",
  Distribution: "#f472b6",
  Dividende: "#22d3ee",
  Coûts: "#fb7185",
  Demande: "#10b981",
  Prix: "#f43f5e",
};

export function KpiRow({
  kpi,
  active = false,
  onClick,
  subsector,
  ticker,
  freeBlocked = false,
  overrideValue = null,
}: {
  kpi: KPI;
  active?: boolean;
  onClick?: () => void;
  subsector: string;
  ticker: string;
  /** Yann (25 mai 2026) : floute valeur + YoY + CAGR + tooltip explanation. */
  freeBlocked?: boolean;
  /** Yann (8 juin 2026 - Point 3) : si non-null, remplace kpi.value pour
   *  l'affichage. Utilisé sur le KPI actif pour synchroniser la valeur
   *  affichée à gauche avec le dernier point visible du chart à droite
   *  (mise à jour live selon frequency / view quarterly vs annual). */
  overrideValue?: number | null;
}) {
  const { t, locale } = useT();
  // Yann FIX 4d : en FR on affiche name_fr en priorité ; si absent fallback name_en
  // (avec flag implicite "à traduire" via tooltip i qui montre toujours name_en).
  const primaryName = locale === "en"
    ? (kpi.name_en || kpi.name_fr)
    : (kpi.name_fr || kpi.name_en);
  // Yann FIX 4d : on retire la version EN sous le titre du tableau pour libérer la place,
  // la version EN reste accessible dans le tooltip "i" via InfoTooltip ci-dessous.
  const secondaryName: string | undefined = undefined;
  const tone = yoyTone(kpi.yoy, kpi.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
  const accent = TYPE_COLOR[kpi.type] ?? "#a78bfa";
  const r = rate(kpi);
  const cagrLabel = formatCAGR(kpi.history, kpi.unit, kpi.period_type ?? "year", locale);

  // Yann 8 juin 2026 (Point 3) : si overrideValue fourni (KPI actif uniquement),
  // on l'utilise à la place de kpi.value pour que la valeur à gauche corresponde
  // au dernier point visible du chart à droite.
  const valueAsNum = overrideValue != null && Number.isFinite(overrideValue)
    ? overrideValue
    : (typeof kpi.value === "number"
      ? kpi.value
      : (typeof kpi.value === "string" ? parseFloat(kpi.value.replace(/,/g, "")) : NaN));
  // Yann 9 juin 2026 : MEME remise a l'echelle de magnitude que le hero
  // (formatHeroValue). Les lignes du tableau ne doivent JAMAIS montrer un chiffre
  // brut hors [1, 999] (ex "1 067 000 000,0 $" devient "1,07 Mds $" ;
  // "5 848 M €" devient "5,85 Mds €"). Regle CLAUDE.md S6 : chiffres 1-999 + bonne
  // unite de magnitude. La valeur ET l'unite sont rescalees ensemble (coherent).
  const heroFmt = Number.isFinite(valueAsNum) ? formatHeroValue(valueAsNum, kpi.unit ?? "") : null;
  const formattedValue = heroFmt ? heroFmt.value : String(kpi.value ?? "—");
  const formattedUnit = heroFmt ? heroFmt.unit : formatUnit(kpi.unit);

  // Yann 15 mai 2026 : KPI "incomplet" (juste une value, sans history/yoy/signal)
  // → masque tier/percentile (= rating fallback bidon "Moyen Top 50 %").
  const isIncompleteKpi = (
    (!Array.isArray(kpi.history) || kpi.history.length === 0)
    && !(typeof kpi.yoy === "string" && kpi.yoy.trim())
    && !(typeof kpi.yoy === "number" && Number.isFinite(kpi.yoy))
    && !(typeof kpi.signal === "string" && kpi.signal.trim())
  );

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "group relative grid w-full cursor-pointer grid-cols-12 items-center gap-3 border-b border-[#1a1a1a] px-5 py-2 text-left transition-colors hover:bg-[#0c0c0c] focus:outline-none focus-visible:bg-[#0c0c0c] sm:px-6 sm:py-2.5",
        active && "bg-[#0d0d0d]"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 h-full w-[3px] origin-bottom transition-transform duration-300",
          active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
        )}
        style={{ background: accent }}
      />

      {active && (
        <span
          className="absolute right-12 top-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Check className="size-3" />
          {t("kpi.active")}
        </span>
      )}

      {/* Étoile favori : toujours top-right absolu du module */}
      <span className="absolute right-2 top-2 z-10">
        <StarButton
          mode="kpi"
          ticker={ticker}
          kpiShort={kpi.short}
          size="sm"
          stopPropagation
        />
      </span>

      {/* COL 1 — Indicateur (3 cols, Yann 24 aout 2026 : colonne retrecie,
          le nom peut passer sur 2 lignes). */}
      <div className="col-span-12 sm:col-span-3">
        {/* Zone floutable palier gratuit : nom du KPI + son "i". */}
        <div data-blur-part="indicateur" className="flex items-center gap-2.5">
          {/* Yann (1er juin 05:15) : badge violet kpi.short retiré.
              Cause : pour certains KPIs récents le `short` contient le nom EN
              long (ex "YOUTUBE ADS REVENUE") au lieu d'un code court. Et
              c'est redondant avec name_fr affiché ci-dessous. Le "i" tooltip
              de l'InfoTooltip suffit pour les détails. */}
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-medium leading-snug text-zinc-100">{primaryName}</div>
            {secondaryName && secondaryName !== primaryName && (
              <div className="text-[11.5px] text-zinc-400">{secondaryName}</div>
            )}
          </div>
          <InfoTooltip color={accent}>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
              {t("kpi.definition")}
            </div>
            <BlurredFreeText blocked={freeBlocked} ticker={ticker} as="div" className="text-zinc-200" mode="full">
              {kpi.explanation}
            </BlurredFreeText>
            {/* Yann FIX 4d (29 mai 2026) : nom EN du KPI dans tooltip "i" quand
                différent du nom FR principal affiché dans le tableau. */}
            {kpi.name_en && kpi.name_en !== kpi.name_fr && (
              <div className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-zinc-400">
                <span className="font-mono uppercase tracking-wider text-[9.5px] text-zinc-500">EN</span>{" "}
                <span className="italic text-zinc-300">{kpi.name_en}</span>
              </div>
            )}
          </InfoTooltip>
        </div>

        {/* Yann 24 aout 2026 : chip categorie/nature ("Structurel", "Volume"...)
            supprimee sous le nom du KPI. Elle allongeait la ligne sans apport
            de lecture. */}
      </div>

      {/* COL 2 — Valeur · variation (3 cols) */}
      <div className="col-span-6 sm:col-span-3">
        {/* Yann 24 aout 2026 : valeur et variation sur UNE ligne, la
            variation entre parentheses a droite de la valeur, nettement
            detachee (gap-x-4). */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="font-mono text-[20px] font-semibold tabular-nums leading-none text-zinc-50">
          {/* Spec floutage 29 aout 2026 : au palier gratuit les VALEURS
              restent visibles (seules les colonnes nom et Qualite-Signal
              sont floutees, par zones). L ancien BlurredFreeValue masquait
              toutes les lignes sauf la premiere. */}
          {formattedValue}
          {formattedUnit && (
            <span className="ml-1 text-sm font-normal text-zinc-400">{formattedUnit}</span>
          )}
        </div>
        {/* Yann 13 mai 2026 : tolère yoy nombre brut (ex GWW yoy=4.5, DINO yoy=-6
           sortis du pipeline LLM sans formatting) en plus de la string standard
           ("+4.5%"). Pour les nombres : ajoute le signe + et le %. */}
        {(() => {
          // Yann 14 mai 2026 : fallback calculé depuis history quand kpi.yoy
          // est vide (1 049 KPIs concernés dans le SP1500). Évite pill vide.
          let yoyStr: string | null = null;
          // Yann 17 juil 2026 (audit 100 stés : 31 KPI avec yoy stocké de signe
          // opposé à l'history, ex AAPL Chine -7,7 % vs +37,9 % réel, TSLA auto,
          // ORCL OCI, GS EQ_REV) : pour un KPI trimestriel avec ≥5 points, le
          // YoY affiché est TOUJOURS recalculé vs même trimestre N-1 depuis
          // l'history (même règle que le hero). Le yoy stocké ne sert que de
          // fallback. KPI en % exclus (delta en points, pas ratio).
          if (
            String(kpi.unit ?? "").trim() !== "%" &&
            kpi.period_type === "quarter" &&
            Array.isArray(kpi.history) &&
            kpi.history.length >= 5
          ) {
            // Yann 18 juil 2026 (MA Rebates) : match par LABEL de période en
            // priorité, le recul -4 positions ment sur les séries à trous.
            let pct = yoySamePeriod(
              kpi.history,
              (kpi as unknown as { history_periods?: string[] }).history_periods,
            );
            if (pct === null) {
              const last = kpi.history[kpi.history.length - 1];
              const prev = kpi.history[kpi.history.length - 5];
              if (typeof last === "number" && typeof prev === "number" && prev !== 0)
                pct = ((last - prev) / Math.abs(prev)) * 100;
            }
            if (pct !== null) {
              const sign = pct > 0 ? "+" : "";
              yoyStr = `${sign}${pct.toFixed(1).replace(".", ",")} %`;
            }
          }
          if (yoyStr) {
            // recalcul trimestriel prioritaire déjà posé
          } else if (typeof kpi.yoy === "number" && Number.isFinite(kpi.yoy)) {
            const sign = kpi.yoy > 0 ? "+" : "";
            yoyStr = `${sign}${String(kpi.yoy).replace(".", ",")} %`;
          } else if (typeof kpi.yoy === "string" && kpi.yoy.trim()) {
            if (kpi.yoy.toLowerCase() === "n/a") return null;
            // Yann 16 mai 2026 : normalise format point décimal US (data brut
            // "+0.8 pts" ou "-1.2%") vers virgule FR. Match floats avec point.
            // Yann 9 août 2026 : + espace insécable avant % ("+4%" → "+4 %").
            yoyStr = kpi.yoy.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %");
          } else if (Array.isArray(kpi.history) && kpi.history.length >= 2) {
            const last = kpi.history[kpi.history.length - 1];
            // Série trimestrielle : YoY = vs même trimestre N-1 (4 pas), pas QoQ.
            const back = kpi.period_type === "quarter" && kpi.history.length >= 5 ? 5 : 2;
            const prev = kpi.history[kpi.history.length - back];
            if (typeof last === "number" && typeof prev === "number" && prev !== 0) {
              const pct = ((last - prev) / Math.abs(prev)) * 100;
              const sign = pct > 0 ? "+" : "";
              yoyStr = `${sign}${pct.toFixed(1).replace(".", ",")} %`;
            }
          }
          if (!yoyStr) return null;
          return (
            <div
              className="inline-flex items-center font-mono text-[12.5px] tabular-nums"
              style={{ color: yoyColor }}
            >
              <span>(</span>
              {tone === "pos" && <ArrowUpRight className="mr-0.5 size-3" />}
              {tone === "neg" && <ArrowDownRight className="mr-0.5 size-3" />}
              {yoyStr}
              <span>)</span>
            </div>
          );
        })()}
        </div>
        {/* Ligne secondaire compacte : periode de reference + CAGR. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Yann 15 juil 2026 : pastille de période de référence (FY vs trimestre)
            pour lever l'ambiguïté annuel/trimestriel dans le tableau. */}
        {(() => {
          // Yann 25 aout 2026 : libelle unifie via kpiPeriodLabel (priorite au
          // libelle de periode reel, jamais de trimestre non termine).
          const periodLabel = kpiPeriodLabel(
            kpi as unknown as { last_data_date?: string | null; history_periods?: unknown; history?: unknown },
            ticker ?? "",
            locale,
          );
          if (!periodLabel) return null;
          return (
            <span
              className="inline-flex items-center rounded border border-[#262626] bg-[#101010] px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-wider text-zinc-500"
              title="Période de référence de la valeur affichée"
            >
              {periodLabel}
            </span>
          );
        })()}
        {cagrLabel && (
          <div className="font-mono text-[11px] tabular-nums text-zinc-400">
            {cagrLabel}
            <span className="ml-1 text-[10px] italic text-zinc-500">
              {"\u00a0"}
              {(() => {
                // Yann 9 août 2026 : même label dynamique que le hero.
                // "(CAGR 5 ans)" figé mentait quand l'history couvre 4 ans.
                const h = Array.isArray(kpi.history) ? kpi.history.filter((x) => typeof x === "number") : [];
                const spy = kpi.period_type === "quarter" ? 4 : kpi.period_type === "semester" ? 2 : 1;
                const years = h.length < 2 ? 0 : Math.round(((h.length - 1) / spy) * 10) / 10;
                if (years >= 4.5 && years <= 5.5) return t("hero.cagr_5y");
                const yr = Math.round(years);
                if (years > 5.5) return `(CAGR ${yr.toLocaleString("fr-FR")} ans)`;
                const yearWord = years <= 1 ? "an" : "ans";
                return `(CAGR ${years.toLocaleString("fr-FR")} ${yearWord})`;
              })()}
            </span>
          </div>
        )}
        </div>
      </div>

      {/* COL 3 — Tendance (2 cols) */}
      <div className="col-span-6 sm:col-span-2">
        <Sparkline data={kpi.history} height={30} color={accent} />
      </div>

      {/* COL 4 — Qualité (stacked) + Signal */}
      <div data-blur-part="qualite" className="col-span-12 sm:col-span-4">
        {isIncompleteKpi ? (
          // Yann (26 mai 2026) : retire le badge alarmant "Données partielles"
          // qui apparaissait sur 5-10 KPIs par sté ayant une valeur claire mais
          // pas encore d'historique/yoy/signal extraits (ex GOOGL Cloud Backlog
          // 460 Mds $, Google Search Revenue 60,4 Mds $, YouTube Ads 9,88 Mds $).
          // La présence de la valeur seule = info utile, pas une "data partielle".
          // On laisse juste un fragment vide → QUALITÉ column blank, propre.
          null
        ) : freeBlocked ? (
          /* Palier gratuit : l evaluation reelle (Excellent/Faible...) est une
             donnee Mettrik — remplacee par un chip factice sous le flou. */
          <span className="inline-flex items-center rounded-md border border-[#262626] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-zinc-400">
            {caviarde("Evaluation")}
          </span>
        ) : (
          <QualityBadge rating={r} size="sm" scope={subsector} layout="stack" />
        )}
        <div className="mt-2 line-clamp-2 text-[13px] leading-snug text-zinc-200">
          {(() => {
            // Yann 14 mai 2026 : fallback dynamique si signal vide
            // (1 068 KPIs concernés). Génère depuis trend history.
            if (kpi.signal && kpi.signal.trim()) return normalizeNarrative(kpi.signal);
            if (freeBlocked) return caviarde("Tendance generee depuis l historique de la serie.");
            const h = Array.isArray(kpi.history) ? kpi.history : [];
            if (h.length < 2) return "";
            const last = h[h.length - 1];
            const first = h[0];
            const prev = h[h.length - 2];
            if (typeof last !== "number" || typeof first !== "number" || typeof prev !== "number") return "";
            const totalPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
            const lastPct = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
            if (totalPct > 30 && lastPct > 0) return "Tendance haussière soutenue sur la période.";
            if (totalPct > 10 && lastPct > 0) return "Croissance modérée mais constante.";
            if (totalPct > 0 && lastPct < -5) return "Ralentissement récent malgré une tendance positive.";
            if (totalPct < -10 && lastPct < 0) return "Trajectoire baissière à surveiller.";
            if (Math.abs(totalPct) < 10) return "Stabilité sur la période, peu de mouvement.";
            return "Évolution mixte selon la période observée.";
          })()}
        </div>
      </div>
    </div>
  );
}
