import { notFound } from "next/navigation";
import { CompanyView } from "@/components/company-view";
import { COMPANIES, TICKERS, getCompany } from "@/lib/data";

export function generateStaticParams() {
  return TICKERS.map((ticker) => ({ ticker: ticker.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const c = COMPANIES[ticker.toUpperCase()];
  if (!c) return { title: "Not found · SPX" };
  return {
    title: `${c.name} (${c.ticker}) · SPX KPI`,
    description: `Live KPI intelligence for ${c.name}. ${c.sector}.`,
  };
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const company = getCompany(ticker);
  if (!company) notFound();
  return <CompanyView company={company} />;
}
