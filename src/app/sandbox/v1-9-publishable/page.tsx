import { Suspense } from "react";
import path from "node:path";
import fs from "node:fs/promises";
import V19PublishableClient, { type PublishableStock, type UniverseEntry } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const metadata = {
  title: "V1.9 Publishable Live · Mettrik AI",
  robots: { index: false, follow: false },
};

type AuditEntry = {
  ticker: string;
  market_cap_usd: number | null;
  is_clean_all: boolean;
  is_clean_af: boolean;
  failed_count: number;
};

type AuditFile = {
  generated_at: string;
  audits: AuditEntry[];
};

type CompleteCompany = {
  ticker?: string;
  name?: string;
  sector?: string;
  subsector?: string;
  country?: string;
  hero_kpi?: string;
  hero_kpi_rationale?: string;
};

async function loadAudit(): Promise<AuditFile> {
  const auditPath = path.join(process.cwd(), "src/data/v1-9-pre-publication-audit.json");
  const raw = await fs.readFile(auditPath, "utf8");
  return JSON.parse(raw) as AuditFile;
}

async function loadUniverse(): Promise<UniverseEntry[]> {
  const universePath = path.join(process.cwd(), "src/data/v1-9-universe.json");
  const raw = await fs.readFile(universePath, "utf8");
  return JSON.parse(raw) as UniverseEntry[];
}

async function loadCompanyMeta(ticker: string): Promise<CompleteCompany | null> {
  const filePath = path.join(process.cwd(), `src/data/v1-9-complete/${ticker}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CompleteCompany;
  } catch {
    return null;
  }
}

export default async function V19PublishablePage() {
  const audit = await loadAudit();
  const universe = await loadUniverse();

  const cleanAll = audit.audits.filter((a) => a.is_clean_all === true);

  const universeByTicker = new Map<string, UniverseEntry>();
  for (const u of universe) {
    universeByTicker.set(u.ticker, u);
  }

  const enriched: PublishableStock[] = await Promise.all(
    cleanAll.map(async (a): Promise<PublishableStock> => {
      const meta = await loadCompanyMeta(a.ticker);
      const u = universeByTicker.get(a.ticker);
      return {
        ticker: a.ticker,
        name: meta?.name ?? u?.name ?? a.ticker,
        sector: meta?.sector ?? "Unknown",
        subsector: meta?.subsector ?? "",
        country: meta?.country ?? u?.country ?? "—",
        hero_kpi: meta?.hero_kpi ?? "",
        market_cap_usd: a.market_cap_usd ?? null,
        sources: u?.sources ?? [],
      };
    }),
  );

  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <V19PublishableClient
        stocks={enriched}
        generatedAt={audit.generated_at}
        totalClean={cleanAll.length}
      />
    </Suspense>
  );
}
