import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import type { Company } from "@/lib/data";
import { enhanceFreshness } from "@/lib/v1-7/enhance-freshness";

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
    if (!data.ranks) data.ranks = { global_world: "—", global_us: "—", sector: "—", subsector: "—" };
    if (!data.tagline) data.tagline = "";
    return enhanceFreshness(data as Company & Record<string, unknown>);
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
  if (!c) return { title: "Page introuvable · V1.6" };
  return {
    title: `${c.name} (${c.ticker}) · V1.6 Pipeline · Mettrik AI`,
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

  // Décision Yann 4 mai 2026 : V1.6 ticker = même rendu que /<ticker> V1,
  // sans bandeau sandbox. Seul le dataset change (lit dans v2-pipeline/).
  return <CompanyView company={company} authSlot={null} hidePriceBar />;
}
