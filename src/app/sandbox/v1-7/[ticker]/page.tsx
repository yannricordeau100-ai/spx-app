import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import type { Company } from "@/lib/data";

export const dynamic = "force-dynamic";

async function loadDataset(ticker: string): Promise<Company | null> {
  const filePath = path.join(process.cwd(), "src/data/v2-pipeline", `${ticker.toLowerCase()}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as Company & { stories_kpis?: Company["kpis"] };
    // Merge stories_kpis into kpis with is_short_history flag (au cas où)
    if (Array.isArray(data.stories_kpis)) {
      const stories = data.stories_kpis.map((s) => ({ ...s, is_short_history: true }));
      data.kpis = [...(data.kpis || []), ...stories];
      delete data.stories_kpis;
    }
    // Defaults pour champs manquants
    if (!data.logo_treatment) (data as Company).logo_treatment = "orbit";
    if (!data.ranks) data.ranks = { global_world: "-", global_us: "-", sector: "-", subsector: "-" };
    if (!data.tagline) data.tagline = "";
    return data as Company;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const c = await loadDataset(ticker);
  if (!c) return { title: "Page introuvable · V1.7" };
  return {
    title: `${c.name} (${c.ticker}) · V1.7 Pipeline · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

export default async function SandboxV16TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const company = await loadDataset(ticker);
  if (!company) notFound();

  const hasRisks = !!company.risks && company.risks.length > 0;
  const hasGov = !!company.governance;
  const hasAI = !!company.ai_positioning;

  return (
    <>
      {/* Bannière sticky V1.7 — discrète, focus sur le contenu KPI */}
      <div className="sticky top-0 z-40 border-b border-cyan-500/30 bg-cyan-500/[0.06] px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/sandbox/v1-7"
            className="group inline-flex items-center gap-2 text-[12px] text-cyan-200 transition-colors hover:text-cyan-100"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            V1.7 hub
          </Link>
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
            V1.7 · pipeline LLM auto-extrait
          </span>
          <span className="font-mono text-[10px] text-cyan-200/70">
            {company.ticker} · {company.kpis?.length ?? 0} KPI
            {hasRisks && ` · ${company.risks!.length}r`}
            {hasGov && " · G"}
            {hasAI && " · AI"}
          </span>
        </div>
      </div>

      {/* CompanyView complet : graph hero + KPI normaux + stories + risks + gov + AI.
          hidePriceBar pour rester aligné avec V1.6 (StockPriceBlock V1 dépend
          de tickers V1 hardcodés et plante sur datasets pipeline = 500
          server-side). On le réactivera ticker par ticker une fois le fetch
          FMP générique câblé. Senate trades cachés (V1 only). Données
          manquantes (events, TAM, gov, AI) gérées gracieusement par
          CompanyView via flags conditionnels. */}
      <CompanyView company={company} authSlot={null} hideSenate hidePriceBar />
    </>
  );
}
