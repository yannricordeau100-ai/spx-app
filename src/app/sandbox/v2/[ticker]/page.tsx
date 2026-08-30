import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompanyView } from "@/components/company-view";
import { V2_TICKERS, getV2Company } from "@/lib/v2-data";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return V2_TICKERS.map((ticker) => ({ ticker: ticker.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const c = getV2Company(ticker);
  if (!c) return { title: "Page introuvable · Sandbox V2 · Mettrik AI" };
  return {
    title: `${c.name} (${c.ticker}) · V2 Sandbox · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

export default async function SandboxV2TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const company = getV2Company(ticker);
  if (!company) notFound();

  return (
    <>
      {/* Bannière DRAFT V2 — fixée au-dessus de la CompanyView */}
      <div className="sticky top-0 z-40 border-b border-amber-500/30 bg-amber-500/[0.08] px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/sandbox/v2"
            className="group inline-flex items-center gap-2 text-[12px] text-amber-200 transition-colors hover:text-amber-100"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            V2 cat 2 hub
          </Link>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-100">
            DRAFT V2 · données seed à raffiner via pipeline
          </span>
          <span className="font-mono text-[10px] text-amber-200/70">{company.ticker} (FPI / ADR)</span>
        </div>
      </div>

      <CompanyView company={company} authSlot={null} />
    </>
  );
}
