import { notFound } from "next/navigation";
import { AuroraView } from "@/components/aurora-view";
import { COMPANIES, TICKERS, getCompany } from "@/lib/data";

export function generateStaticParams() {
  return TICKERS.map((t) => ({ ticker: t.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const c = COMPANIES[ticker.toUpperCase()];
  if (!c) return { title: "Aurora · Mettrik" };
  return { title: `${c.name} · Mettrik Aurora` };
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const company = getCompany(ticker);
  if (!company) notFound();
  return <AuroraView company={company} />;
}
