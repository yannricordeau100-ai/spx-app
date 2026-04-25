import { notFound } from "next/navigation";
import { SpatialView } from "@/components/spatial-view";
import { COMPANIES, TICKERS, getCompany } from "@/lib/data";

export function generateStaticParams() {
  return TICKERS.map((t) => ({ ticker: t.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const c = COMPANIES[ticker.toUpperCase()];
  if (!c) return { title: "Spatial · Mettrik" };
  return { title: `${c.name} · Mettrik Spatial` };
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const company = getCompany(ticker);
  if (!company) notFound();
  return <SpatialView company={company} />;
}
