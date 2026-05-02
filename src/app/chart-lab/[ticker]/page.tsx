import { notFound } from "next/navigation";
import { COMPANIES, TICKERS, getCompany } from "@/lib/data";
import { ChartLabContent } from "./content";

export function generateStaticParams() {
  return TICKERS.map((t) => ({ ticker: t.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const c = COMPANIES[ticker.toUpperCase()];
  return { title: `Chart Lab · ${c?.name ?? ticker}` };
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  if (!getCompany(ticker)) notFound();
  return (
    <div className="min-h-screen bg-[#050505]">
      <ChartLabContent ticker={ticker} showHeader showNavChrome />
    </div>
  );
}
