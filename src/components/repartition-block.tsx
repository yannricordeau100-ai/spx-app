"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Globe2, LayoutGrid, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { Company, RevenueBreakdown } from "@/lib/data";
import { brand } from "@/lib/brand";
import { RepartitionBars } from "@/components/charts/repartition-bars";
// Yann 9 juin 2026 : modes ISO 3D + Radial supprimés. Treemap uniquement.
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { isBlockDisabledForTicker } from "@/lib/disabled-blocks";

/**
 * RepartitionBlock — vue répartition CA par dimension (géographique
 * ou segment opérationnel). Visualisation unique : Treemap.
 *
 * Position : entre Risks et Governance dans la page société.
 */
// Yann 9 juin 2026 : radial supprimé, treemap uniquement.
type Style = "treemap";
const STYLES: Style[] = ["treemap"];

type Tab = "geo" | "segment" | "ai_customer";

// Yann 9 juin 2026 : traduction FR des libellés géo/segment courants du bloc
// chiffre d'affaire. Les noms propres (iPhone, Azure, etc.) restent inchangés.
const FR_LABELS: Record<string, string> = {
  Americas: "Amériques", America: "Amériques", "North America": "Amérique du Nord",
  "South America": "Amérique du Sud", "Latin America": "Amérique latine",
  Europe: "Europe", "Europe, Middle East and Africa": "Europe, Moyen-Orient et Afrique",
  "Middle East and Africa": "Moyen-Orient et Afrique", "Middle East": "Moyen-Orient",
  Africa: "Afrique", "Greater China": "Grande Chine", China: "Chine", Japan: "Japon",
  "Asia-Pacific": "Asie-Pacifique", "Asia Pacific": "Asie-Pacifique", Asia: "Asie",
  "Rest of Asia Pacific": "Reste de l'Asie-Pacifique",
  "Rest of Asia-Pacific": "Reste de l'Asie-Pacifique",
  "Rest of World": "Reste du monde", "Rest of the World": "Reste du monde",
  International: "International", Domestic: "National",
  "United States": "États-Unis", "United Kingdom": "Royaume-Uni", Germany: "Allemagne",
  France: "France", Other: "Autres", Others: "Autres", "Other countries": "Autres pays",
  Products: "Produits", Services: "Services", Product: "Produit", Hardware: "Matériel",
  Software: "Logiciels", Subscriptions: "Abonnements", Subscription: "Abonnement",
  Advertising: "Publicité", Licensing: "Licences", Cloud: "Cloud", Retail: "Distribution",
  Wholesale: "Gros", "Consumer": "Grand public", Enterprise: "Entreprises",
};
function translateLabelFr(label: string): string {
  if (!label) return label;
  return FR_LABELS[label.trim()] ?? label;
}

function adaptForLocale(b: RevenueBreakdown | undefined | null, locale: Locale) {
  if (!b) return undefined;
  // Garde-fou : certaines stés ont `revenue_by_*` présent mais avec
  // `slices: null` (data partiellement extraite). On retourne undefined
  // pour que hasGeo/hasSegment soit false et que le bloc se masque.
  if (!Array.isArray(b.slices)) return undefined;
  return {
    ...b,
    slices: b.slices.map((s) => {
      // Yann 9 août 2026 : certaines stés (OR.PA) n'ont que `name`, pas
      // `label` → le treemap rendait des tranches sans nom de zone.
      const base = s.label || (s as { name?: string }).name || "";
      return {
        ...s,
        label:
          locale === "en" && s.label_en
            ? s.label_en
            : locale === "fr"
              ? translateLabelFr(base)
              : base,
      };
    }),
  };
}

export function RepartitionBlock({
  company,
  disabledBlocks,
}: {
  company: Company;
  /** Yann 9 juin 2026 : blocs désactivés résolus côté serveur (Supabase +
   *  fallback JSON). Si fourni, prime sur le fallback client
   *  `isBlockDisabledForTicker`. Fallback obligatoire pour ne pas casser
   *  les pages qui ne passent pas encore la prop (v1-8, v1-7-5). */
  disabledBlocks?: string[];
}) {
  const { t, locale } = useT();
  const accent = brand(company.ticker).primary;
  // Helper local : prop si fournie, sinon fallback isBlockDisabledForTicker.
  const isDisabled = (k: string): boolean =>
    disabledBlocks
      ? disabledBlocks.includes(k)
      : isBlockDisabledForTicker(company.ticker, k);

  const geo = adaptForLocale(company.revenue_by_geography, locale);
  const segment = adaptForLocale(company.revenue_by_segment, locale);
  // Yann 21 mai 2026 : onglet "IA Pro/Particulier" pour les stés qui vendent
  // de l'IA. Visible UNIQUEMENT si data présente (sourcée externe).
  const aiCustomer = adaptForLocale(company.revenue_by_ai_customer_type, locale);
  const aiConfidence = company.revenue_by_ai_customer_type?.confidence;
  const aiSources = company.revenue_by_ai_customer_type?.sources;

  // Treemap uniquement : on respecte quand même les toggles par dimension.
  const geoStyles: Style[] = STYLES.filter(
    (s) => !isDisabled(`repartition_geo_${s}`),
  );
  const segmentStyles: Style[] = STYLES.filter(
    (s) => !isDisabled(`repartition_segment_${s}`),
  );

  const hasGeo = !!(geo && geo.slices.length > 0) && geoStyles.length > 0;
  const hasSegment = !!(segment && segment.slices.length > 0) && segmentStyles.length > 0;
  // Yann 13 juil 2026 : bloc "Répartition CA IA part/pro" désactivé côté UI.
  // On garde le composant et la data, on ne rend juste plus l'onglet.
  const hasAiCustomer: boolean = false;
  void aiCustomer;
  if (!hasGeo && !hasSegment && !hasAiCustomer) return null;

  const [tab, setTab] = useState<Tab>(hasGeo ? "geo" : hasSegment ? "segment" : "ai_customer");
  const [styleIdx, setStyleIdx] = useState(0);
  const activeStyles: Style[] =
    tab === "geo" ? geoStyles : tab === "segment" ? segmentStyles : STYLES;
  const safeStyleIdx = activeStyles.length > 0 ? styleIdx % activeStyles.length : 0;

  const active = tab === "geo" ? geo : tab === "segment" ? segment : aiCustomer;
  // Cohérence des décimales : si toutes les valeurs sont entières, 0 décimale ;
  // sinon 1 décimale partout dans le bloc.
  const decimals = active && active.slices.every((s) => Number.isInteger(s.value)) ? 0 : 1;

  // Yann 9 juin 2026 : unité de repli quand la dimension n'a pas d'unité
  // (ex AAPL). On déduit % si les parts somment à ~100, sinon Mds $ (revenu).
  const unitFallback = (() => {
    if (active?.unit) return active.unit;
    if (!active) return "Mds $";
    const sum = active.slices.reduce((acc, s) => acc + (s.value || 0), 0);
    return sum >= 95 && sum <= 105 ? "%" : "Mds $";
  })();

  function cycleStyle(dir: 1 | -1) {
    const len = activeStyles.length;
    if (len === 0) return;
    setStyleIdx((i) => (i + dir + len) % len);
  }

  return (
    <section
      id="sec-repartition"
      className="mt-9 scroll-mt-24 animate-fade-up-d2 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <LayoutGrid className="size-5" style={{ color: accent }} />
            {t("repartition.title")}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {t("repartition.subtitle")}
          </p>
        </div>

        {/* Tabs Géo / Segment */}
        <div role="tablist" className="inline-flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
          {hasGeo && (
            <button
              role="tab"
              aria-selected={tab === "geo"}
              onClick={() => setTab("geo")}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === "geo" ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab === "geo" && (
                <motion.span
                  layoutId="repartition-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                    border: `1px solid ${accent}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Globe2 className="relative size-3.5" />
              <span className="relative">{t("repartition.tab.geo")}</span>
            </button>
          )}
          {hasSegment && (
            <button
              role="tab"
              aria-selected={tab === "segment"}
              onClick={() => setTab("segment")}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === "segment" ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab === "segment" && (
                <motion.span
                  layoutId="repartition-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                    border: `1px solid ${accent}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <LayoutGrid className="relative size-3.5" />
              <span className="relative">{t("repartition.tab.segment")}</span>
            </button>
          )}
          {hasAiCustomer && (
            <button
              role="tab"
              aria-selected={tab === "ai_customer"}
              onClick={() => setTab("ai_customer")}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === "ai_customer" ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
              title="Revenu IA : clients pros vs particuliers (sources externes)"
            >
              {tab === "ai_customer" && (
                <motion.span
                  layoutId="repartition-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                    border: `1px solid ${accent}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Sparkles className="relative size-3.5" />
              <span className="relative">IA Pro / Particulier</span>
            </button>
          )}
        </div>
      </div>

      {tab === "ai_customer" && (aiConfidence || (aiSources && aiSources.length > 0)) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <span className="font-mono uppercase tracking-wider text-zinc-500">Source externe</span>
          {aiConfidence && (
            <span
              className="rounded-full border px-2 py-0.5 font-mono uppercase tracking-wider"
              style={{
                borderColor:
                  aiConfidence === "high" ? "#10b98166" : aiConfidence === "mid" ? "#f59e0b66" : "#ef444466",
                color:
                  aiConfidence === "high" ? "#6ee7b7" : aiConfidence === "mid" ? "#fcd34d" : "#fca5a5",
              }}
            >
              Confiance {aiConfidence}
            </span>
          )}
          {aiSources && aiSources.length > 0 && (
            <span className="text-zinc-500">
              {aiSources.length} source{aiSources.length > 1 ? "s" : ""} : {aiSources.map((s) => s.publisher).join(" · ")}
            </span>
          )}
        </div>
      )}

      {/* Chart area. Treemap uniquement (radial + slide souris supprimés). */}
      <div className="relative">
        {activeStyles.length > 1 && (
          <button
            onClick={() => cycleStyle(-1)}
            aria-label={`${t("repartition.style." + activeStyles[(safeStyleIdx - 1 + activeStyles.length) % activeStyles.length])}`}
            className="absolute left-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-black/70 text-zinc-100 backdrop-blur-md transition-all hover:scale-110"
            style={{ borderColor: `${accent}66`, boxShadow: `0 0 14px ${accent}33` }}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Yann 9 août 2026 : AnimatePresence mode="wait" gelait le panneau
            (l'exit ne se terminait jamais → le nouvel onglet ne montait pas,
            la vue restait sur Géographique avec Segment sélectionné).
            Animation d'entrée seule, remount par key. */}
        <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 sm:p-5"
          >
            {!active || active.slices.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-400">
                {t("repartition.no_data")}
              </div>
            ) : (
              // Yann 25 aout 2026 : treemap remplace par un rendu en lignes
              // (RepartitionBars). Le texte n est plus pose a l interieur de
              // formes de taille variable, donc plus de libelle tronque ni de
              // montant fantome, quelles que soient les donnees.
              <RepartitionBars data={active.slices} unit={unitFallback} total={active.total} locale={locale} othersLabel={locale.startsWith("fr") ? "Autres" : "Others"} normalizeLabels={tab === "geo"} />
            )}
          </motion.div>

        {activeStyles.length > 1 && (
          <button
            onClick={() => cycleStyle(1)}
            aria-label={`${t("repartition.style." + activeStyles[(safeStyleIdx + 1) % activeStyles.length])}`}
            className="absolute right-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-black/70 text-zinc-100 backdrop-blur-md transition-all hover:scale-110"
            style={{ borderColor: `${accent}66`, boxShadow: `0 0 14px ${accent}33` }}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Légende incertitude par slice — onglet ai_customer uniquement. */}
      {tab === "ai_customer" && active && active.slices.some((s) => (s.uncertainty_pct ?? 0) > 0) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          {active.slices.map((s, i) => {
            const u = s.uncertainty_pct ?? 0;
            if (u <= 0) return null;
            const total = active.total ?? active.slices.reduce((acc, x) => acc + x.value, 0);
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <span key={`${s.label}-${i}`} className="inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: s.color || accent, boxShadow: `0 0 4px ${s.color || accent}` }}
                />
                <span className="text-zinc-300">{s.label}</span>
                <span className="font-mono text-zinc-400">
                  {pct.toFixed(0)} % <span className="text-zinc-500">(±{u} %)</span>
                </span>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
