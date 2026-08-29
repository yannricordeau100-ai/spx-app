"use client";

import { Brain, TrendingUp, Zap, ShieldAlert, MinusCircle } from "lucide-react";
import { isOfficialSource, type AIPositioning } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";
import { normalizeNarrative, humanizeFinJargon } from "@/lib/ui-fix-templates";
import { BlurredFreeText } from "@/components/freemium/blurred-free-text";
import { AutoTooltipText } from "@/components/auto-tooltip-text";

const STANCE_META: Record<
  AIPositioning["stance"],
  { labelKey: string; descKey: string; color: string; Icon: typeof Brain }
> = {
  leader: {
    labelKey: "ai.stance.leader.label",
    descKey: "ai.stance.leader.desc",
    color: "#a78bfa",
    Icon: Brain,
  },
  integrator: {
    labelKey: "ai.stance.integrator.label",
    descKey: "ai.stance.integrator.desc",
    color: "#06b6d4",
    Icon: Zap,
  },
  cautious: {
    labelKey: "ai.stance.cautious.label",
    descKey: "ai.stance.cautious.desc",
    color: "#f59e0b",
    Icon: ShieldAlert,
  },
  absent: {
    labelKey: "ai.stance.absent.label",
    descKey: "ai.stance.absent.desc",
    color: "#71717a",
    Icon: MinusCircle,
  },
};

export function AIPositioningCard({
  positioning,
  companyName,
  ticker,
  freeBlocked = false,
}: {
  positioning?: AIPositioning;
  companyName: string;
  ticker: string;
  /** Yann (25 mai 2026) : floute summary + evidence en mode free. */
  freeBlocked?: boolean;
}) {
  const { t } = useT();
  const accent = brand(ticker).primary;

  const effective: AIPositioning =
    positioning ?? {
      stance: "absent",
      summary: `${companyName} ${t("ai.absent_summary")}`,
      evidence: [],
      source: t("ai.absent_source"),
    };

  // Garde-fou : nouveaux datasets peuvent avoir des stances hors mapping
  const meta = STANCE_META[effective.stance] ?? STANCE_META.absent;
  const Icon = meta.Icon;

  return (
    <section className="mt-9 animate-fade-up-d1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
          <Brain className="size-5" style={{ color: accent }} />
          {t("ai.title_prefix")} {companyName} {t("ai.title_suffix")}
        </h2>
      </div>

      <div
        className="overflow-hidden rounded-2xl border p-5 sm:p-6"
        style={{
          borderColor: `${meta.color}33`,
          background: `linear-gradient(180deg, ${meta.color}0a 0%, #070707 60%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold uppercase tracking-wider"
            style={{
              background: `${meta.color}1f`,
              color: meta.color,
              border: `1px solid ${meta.color}55`,
            }}
          >
            <Icon className="size-3.5" />
            {t(meta.labelKey)}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {t(meta.descKey)}
          </span>
        </div>

        {/* Zone floutable palier gratuit : tout sauf la ligne de statut
            ci-dessus (acteur majeur / integrateur / absent...). */}
        <div data-blur-part="texte">
        {/* Yann 4 juin 2026 : summary agrandi (15px → 16.5px, leading-relaxed
            préservé) + jargon SEC/FR humanisé (MD&A → Analyse direction, etc.). */}
        <BlurredFreeText blocked={freeBlocked} ticker={ticker} as="p" className="mt-4 text-[16.5px] leading-relaxed text-zinc-100">
          {effective.summary ? (
            <AutoTooltipText text={humanizeFinJargon(normalizeNarrative(effective.summary))} locale="fr" />
          ) : (
            effective.summary
          )}
        </BlurredFreeText>

        {(() => {
          // Yann (26 mai 2026) : filtre anti-XBRL + cap 8 items max.
          // Cas MSCI : extraction LLM a renvoyé 57 items du type
          // "msci:RecurringSubscriptionsMember msci:IndexSegmentMember
          // 2025-01-01 2025-12-31" = tags XBRL bruts illisibles.
          // Filtre : retire tout item dont le contenu lisible (après
          // strip des tags `xxx:YyyMember`, `us-gaap:...`, dates ISO)
          // fait moins de 25 chars. Puis cap à 8.
          const rawEvidence = Array.isArray(effective.evidence) ? effective.evidence : [];
          const cleanEvidence = rawEvidence
            .filter((e) => {
              if (typeof e !== "string") return true;
              const stripped = e
                .replace(/\b[a-z][a-z0-9_-]*:[A-Za-z0-9_]+\b/g, "") // xbrl tags
                .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "") // ISO dates
                .replace(/\s+/g, " ")
                .trim();
              return stripped.length >= 25;
            })
            .slice(0, 8);
          if (cleanEvidence.length === 0) return null;
          // Yann 4 juin 2026 : sous-blocs evidence agrandis pour lisibilité
          // grand public (label 10.5→12px, item 13→15px, padding 2.5→3) +
          // jargon SEC humanisé via humanizeFinJargon.
          return (
          <div className="mt-5">
            <div className="mb-2.5 font-mono text-[12px] uppercase tracking-wider text-zinc-300">
              {t("ai.evidence_label")}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {cleanEvidence.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3 text-[15px] leading-snug text-zinc-200"
                >
                  <TrendingUp
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: meta.color }}
                  />
                  <BlurredFreeText blocked={freeBlocked} ticker={ticker} as="span">
                    {(() => {
                      // Garde-fou : certains datasets ont des evidence en objet
                      // citation {text, page_hint, year} au lieu de string.
                      // Rendre l'objet brut crashe React ("Objects are not valid
                      // as a React child"). On extrait .text (ex KER.PA, TTE.PA,
                      // BN.PA, BNPQY... 500 corrige). Vaut pour tout objet futur.
                      const raw = e as unknown;
                      const txt =
                        typeof raw === "string"
                          ? raw
                          : raw && typeof raw === "object" && "text" in raw
                            ? String((raw as { text?: unknown }).text ?? "")
                            : "";
                      return txt ? (
                        <AutoTooltipText text={humanizeFinJargon(normalizeNarrative(txt))} locale="fr" />
                      ) : null;
                    })()}
                  </BlurredFreeText>
                </li>
              ))}
            </ul>
          </div>
          );
        })()}

        {effective.source && !isOfficialSource(effective.source) && (
          <div className="mt-4 font-mono text-[12.5px] italic text-zinc-400">
            {t("ai.source")} : {humanizeFinJargon(effective.source)}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
