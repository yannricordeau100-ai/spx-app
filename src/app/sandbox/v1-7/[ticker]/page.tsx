import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import type { Company } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * /sandbox/v1-7/<ticker> = même structure visuelle que la page sté V1
 * (`/[ticker]`). Aucun bandeau sandbox, aucun marqueur "V1.7" : Yann veut
 * un rendu identique à la prod, seul le dataset change (lit dans
 * `src/data/v2-pipeline/` au lieu de `src/data/<ticker>.json`).
 */
/**
 * Normalise history : certaines fiches stockent history sous forme
 * d'objets { date, value, unit }[] au lieu de number[]. On extrait .value.
 */
function normalizeHistory(h: unknown): number[] {
  if (!Array.isArray(h)) return [];
  return h
    .map((item) => {
      if (typeof item === "number") return item;
      if (item && typeof item === "object" && "value" in item) {
        const v = (item as { value: unknown }).value;
        return typeof v === "number" ? v : Number(v);
      }
      return Number(item);
    })
    .filter((v) => Number.isFinite(v));
}

async function loadDataset(ticker: string): Promise<Company | null> {
  const filePath = path.join(process.cwd(), "src/data/v2-pipeline", `${ticker.toLowerCase()}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as Company & { stories_kpis?: Company["kpis"] };
    if (Array.isArray(data.stories_kpis)) {
      const stories = data.stories_kpis.map((s) => ({ ...s, is_short_history: true }));
      data.kpis = [...(data.kpis || []), ...stories];
      delete data.stories_kpis;
    }
    // Normalise history sur tous les KPIs (gère format objet ou nombre)
    if (Array.isArray(data.kpis)) {
      data.kpis = data.kpis.map((k) => ({
        ...k,
        history: normalizeHistory((k as unknown as { history: unknown }).history),
      }));
    }
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
  if (!c) return { title: "Page introuvable · Mettrik AI" };
  return {
    title: `${c.name} (${c.ticker}) · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

export default async function SandboxV17TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const company = await loadDataset(ticker);
  if (!company) notFound();
  // hidePriceBar : StockPriceBlock V1 dépend de tickers V1 hardcodés et
  // plante sur datasets pipeline (500 server-side). À réactiver ticker
  // par ticker quand un fetch FMP générique sera câblé.
  // hideSenate : senate trades = scope V1 uniquement.
  return <CompanyView company={company} authSlot={null} hideSenate hidePriceBar />;
}
