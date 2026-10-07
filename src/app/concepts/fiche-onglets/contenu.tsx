"use client";

import { useMemo, useState } from "react";
import { BookOpen, LayoutGrid, Layers, LineChart, Mic, Target, AlertTriangle, Building2, Brain, Scale, Link2, ShieldCheck, ChevronDown, type LucideIcon } from "lucide-react";
import { brand } from "@/lib/brand";
import { getHero, formatHeroValue, type Company, type KPI } from "@/lib/data";
import { hasStories, buildStories } from "@/lib/kpi-stories-ordering";
import { orderKpis } from "@/lib/kpi-ordering";
import { estKpiStandard } from "@/lib/kpi-standard";
import { CompanyProfileCard } from "@/components/company-profile-card";
import { KpiRow } from "@/components/kpi-row";
import { KpiStories } from "@/components/kpi-stories";
import { ImageFindingsBlock, type ImageFindingPublic } from "@/components/image-findings-block";
import { RepartitionBlock } from "@/components/repartition-block";
import { MoatClientsRow } from "@/components/moat-clients-row";
import { MarketPositionCard } from "@/components/market-position-card";
import { RiskStack } from "@/components/risk-stack";
import { GovernanceCard } from "@/components/governance-card";
import { RachatsBlock } from "@/components/rachats-block";
import { AIPositioningCard } from "@/components/ai-positioning-card";
import { TheseCard } from "@/components/these-card";
import { AntiTheseCard } from "@/components/anti-these-card";
import { TranscriptNavigation } from "@/components/transcript-navigation";
import { TranscriptStories } from "@/components/transcript-stories";
import { SourcesExternes } from "@/components/sources-externes";
import { UnitesMateriaux } from "@/components/unites-materiaux";
import type { FicheDemo } from "./data";

/**
 * Parties de la fiche, dans l'ordre de la page (company-view.tsx et rail
 * DockRailLeft de company-nav-chrome.tsx). Le bloc « KPI principal » (hero)
 * est fondu dans « Vue d'ensemble » : son graphique est code en dur dans
 * company-view et ne s'importe pas seul.
 */
export type Onglet = { id: string; label: string; Icon: LucideIcon; compteur: number | null; apercu: string };

const DEFS: { id: string; label: string; Icon: LucideIcon; apercu: string }[] = [
  { id: "apercu", label: "Vue d'ensemble", Icon: BookOpen, apercu: "Description, KPI principal, snapshot" },
  { id: "kpi", label: "Indicateurs clés", Icon: LayoutGrid, apercu: "Tableau des KPIs avec tendance" },
  { id: "stories", label: "KPI court terme", Icon: Layers, apercu: "Les stories de la fiche" },
  { id: "moyen", label: "Moyen terme", Icon: LineChart, apercu: "Graphiques de sources externes" },
  { id: "marche", label: "Marché et TAM", Icon: Target, apercu: "Répartition du CA, clients, moat, TAM" },
  { id: "risques", label: "Risques", Icon: AlertTriangle, apercu: "Facteurs de risque tracés" },
  { id: "gouv", label: "Gouvernance et rachats", Icon: Building2, apercu: "Dirigeants, votes, sociétés rachetées" },
  { id: "ia", label: "IA", Icon: Brain, apercu: "Positionnement intelligence artificielle" },
  { id: "resultats", label: "Résultats et transcripts", Icon: Mic, apercu: "Synthèse du dernier appel" },
  { id: "these", label: "Thèse et anti-thèse", Icon: Scale, apercu: "Cas favorable et cas défavorable" },
  { id: "sources", label: "Sources", Icon: Link2, apercu: "Documents et liens externes" },
  { id: "admin", label: "Admin", Icon: ShieldCheck, apercu: "Cours de bourse et KPI sur-mesure (admin)" },
];

type CoX = Company & { image_findings?: unknown[] };

export function kpisAffiches(c: Company): KPI[] {
  const hero = c.hero_kpi;
  const utilisable = (k: KPI) => {
    const v = Number(k.value);
    return Number.isFinite(v) && Math.abs(v) > 0;
  };
  const tous = (c.kpis ?? []).filter((k) => utilisable(k) && (k.short === hero || (!estKpiStandard(k) && (Array.isArray(k.history) ? k.history.length : 0) >= 3)));
  const h = tous.find((k) => k.short === hero);
  const autres = orderKpis(tous, hero);
  return h ? [h, ...autres.filter((k) => k.short !== hero)] : autres;
}

function nbStories(c: Company): number {
  return buildStories(c.kpis, []).reduce((n, cat) => n + cat.slides.filter((s) => s.kind === "kpi").length, 0);
}

function nbBullets(f: FicheDemo): number {
  return f.summary?.summary?.bullets?.length ?? 0;
}

function aResultats(f: FicheDemo): boolean {
  const t = f.transcript;
  return nbBullets(f) > 0 || Boolean(t && ((t.extracts?.quotes?.length ?? 0) > 0 || (t.extracts?.figures?.length ?? 0) > 0 || (t.latest?.content?.length ?? 0) > 200));
}

/** Onglets disponibles pour la societe : une partie sans donnee n'a pas d'onglet. */
export function ongletsDe(f: FicheDemo, avecAdmin = false): Onglet[] {
  const c = f.company as CoX;
  const dispo: Record<string, { ok: boolean; n: number | null; apercu?: string }> = {
    apercu: { ok: true, n: null },
    kpi: { ok: kpisAffiches(c).length > 0, n: kpisAffiches(c).length, apercu: `${kpisAffiches(c).length} indicateurs avec tendance` },
    stories: { ok: hasStories(c.kpis, []), n: nbStories(c), apercu: `${nbStories(c)} stories filtrables par famille` },
    moyen: { ok: (c.image_findings?.length ?? 0) > 0, n: c.image_findings?.length ?? 0, apercu: `${c.image_findings?.length ?? 0} graphiques de sources externes` },
    marche: { ok: true, n: null },
    risques: { ok: (c.risks?.length ?? 0) > 0, n: c.risks?.length ?? 0, apercu: `${c.risks?.length ?? 0} facteurs de risque tracés` },
    gouv: { ok: Boolean(c.governance) || Boolean(f.rachats?.societe), n: null },
    ia: { ok: Boolean(c.ai_positioning?.summary && String(c.ai_positioning.summary).trim()), n: null },
    resultats: { ok: aResultats(f), n: nbBullets(f) || null, apercu: nbBullets(f) ? `${nbBullets(f)} points clés du dernier appel` : undefined },
    these: { ok: Boolean(c.these) || Boolean(c.att), n: null },
    sources: { ok: true, n: null },
    admin: { ok: avecAdmin, n: null },
  };
  return DEFS.filter((d) => dispo[d.id].ok).map((d) => ({ id: d.id, label: d.label, Icon: d.Icon, compteur: dispo[d.id].n, apercu: dispo[d.id].apercu ?? d.apercu }));
}

function BlocKpiPrincipal({ c, accent }: { c: Company; accent: string }) {
  const h = getHero(c);
  if (!h) return null;
  const v = formatHeroValue(h.value ?? null, h.unit ?? "");
  return (
    <div className="mt-6 rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-5 sm:p-6">
      <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">KPI principal</div>
      <div className="mt-1 text-[16px] font-semibold text-zinc-200">{h.name_fr ?? h.short}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-[44px] font-bold leading-none tabular-nums" style={{ color: accent }}>{v.value}</span>
        <span className="text-[15px] text-zinc-400">{v.unit}</span>
        {h.yoy && String(h.yoy).toLowerCase() !== "n/a" && <span className="text-[13px] text-zinc-400">{String(h.yoy)} vs N-1</span>}
      </div>
    </div>
  );
}

function TableauKpi({ c }: { c: Company }) {
  const liste = useMemo(() => kpisAffiches(c), [c]);
  const [tout, setTout] = useState(false);
  const [actif, setActif] = useState(liste[0]?.short ?? "");
  const vus = tout ? liste : liste.slice(0, 8);
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-100">Indicateurs clés</h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-400">Valeur, variation sur un an, tendance et qualité de chaque indicateur.</p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{liste.length} indicateurs</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#080808]">
        {vus.map((k) => (
          <KpiRow key={k.short} kpi={k} active={k.short === actif} subsector={c.subsector} ticker={c.ticker} onClick={() => setActif(k.short)} />
        ))}
        {liste.length > 8 && (
          <button type="button" onClick={() => setTout((t) => !t)} className="flex w-full items-center justify-center gap-2 border-t border-[#1a1a1a] bg-[#0a0a0a] px-6 py-4 text-sm text-zinc-400 hover:text-zinc-100">
            <ChevronDown className={`size-4 transition-transform ${tout ? "rotate-180" : ""}`} />
            {tout ? "Réduire" : `Voir ${liste.length - 8} indicateurs de plus`}
          </button>
        )}
      </div>
      <div className="mt-4"><UnitesMateriaux gicsCode={c.gics_code} secteurLabel={c.sector} unites={c.kpis.map((k) => k.unit)} /></div>
    </section>
  );
}

export function Contenu({ f, id, admin = null }: { f: FicheDemo; id: string; admin?: React.ReactNode }) {
  const c = f.company as CoX;
  const accent = brand(c.ticker).primary;
  const pos = c.market_positions ?? [];
  switch (id) {
    case "apercu":
      return (
        <div>
          <CompanyProfileCard company={c} accent={accent} />
          <BlocKpiPrincipal c={c} accent={accent} />
        </div>
      );
    case "kpi":
      return <TableauKpi c={c} />;
    case "stories":
      return <KpiStories company={c} />;
    case "moyen":
      return (
        <ImageFindingsBlock
          findings={(c.image_findings ?? []) as ImageFindingPublic[]}
          accent={accent}
          locale="fr"
          ticker={c.ticker}
          nomSociete={c.name}
          adminNomsExport={null}
        />
      );
    case "marche":
      return (
        <div>
          <h2 className="mb-3 font-display text-[20px] font-bold tracking-tight text-zinc-100">Chiffre d’affaires, avantage concurrentiel et marché</h2>
          <div className="grid gap-4 [&>*]:mt-0 [&>*>*]:mt-0">
            <RepartitionBlock company={c} />
            <MoatClientsRow company={c} accent={accent} afficherMoat afficherClients />
            {pos.length > 0 && (
              <section>
                <h2 className="text-[22px] font-semibold text-zinc-50">Position marché · TAM</h2>
                <p className="mb-4 mt-0.5 text-[13.5px] text-zinc-300">Part de marché de la société sur ses segments clés, comparée à la taille totale du marché visé.</p>
                <div className={`grid gap-4 ${pos.length === 1 ? "grid-cols-1" : "lg:grid-cols-2"}`}>
                  {pos.slice(0, 2).map((p) => (
                    <MarketPositionCard key={p.segment_name} company={c} position={p} wide={pos.length === 1} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      );
    case "risques":
      return <RiskStack risks={c.risks ?? []} accent={accent} profitWarning={c.profit_warning} ticker={c.ticker} />;
    case "gouv":
      return (
        <div className="grid gap-4">
          {c.governance && <GovernanceCard governance={c.governance} ticker={c.ticker} company={c} />}
          {f.rachats && <RachatsBlock data={f.rachats} accent={accent} />}
        </div>
      );
    case "ia":
      return c.ai_positioning ? <AIPositioningCard positioning={c.ai_positioning} companyName={c.name} ticker={c.ticker} evenement={c.evenement} /> : null;
    case "resultats":
      return nbBullets(f) > 0 ? (
        <TranscriptNavigation ticker={c.ticker} summary={f.summary} />
      ) : f.transcript ? (
        <TranscriptStories ticker={c.ticker} doc={f.transcript} />
      ) : null;
    case "these":
      return (
        <div className="grid gap-4">
          {c.these && <TheseCard these={c.these} accent={accent} />}
          {c.att && <AntiTheseCard att={c.att} accent={accent} />}
        </div>
      );
    case "sources":
      return <SourcesExternes ticker={c.ticker} paid extra={c.evenement?.sources} />;
    case "admin":
      return admin ? <div className="grid gap-6">{admin}</div> : null;
    default:
      return null;
  }
}
