import type { Metadata } from "next";
import { loadV17Company } from "@/lib/company-core/load-company";
import { codeKpi } from "@/lib/kpi-link";
import { formatHeroValue } from "@/lib/data";

/**
 * /k/<ticker>/<code> : micro-lien de partage d un KPI (Yann 3 sept 2026).
 * Les robots (X, LinkedIn, WhatsApp) lisent ici le titre, la description et
 * l image du KPI ; les humains sont renvoyes en 0 seconde sur la fiche, KPI
 * promu en principal (?kpi=). Page publique, aucune donnee au-dela de la carte.
 */
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";

async function trouve(ticker: string, code: string) {
  const r = await loadV17Company(ticker, { mode: "v18", locale: "fr" });
  if (r.kind !== "ready") return null;
  const kpi = (r.company.kpis ?? []).find((k) => codeKpi(String(k.short)) === code);
  return kpi ? { company: r.company, kpi } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string; code: string }> }): Promise<Metadata> {
  const { ticker, code } = await params;
  const t = await trouve(ticker, code);
  if (!t) return { title: "Mettrik AI · KPI Intelligence", robots: { index: false, follow: true } };
  const { company, kpi } = t;
  const nom = kpi.name_fr || kpi.name_en || String(kpi.short);
  const v = typeof kpi.value === "number" ? formatHeroValue(kpi.value, kpi.unit ?? "") : null;
  const valeur = v ? `${v.value} ${v.unit}`.trim() : String(kpi.value ?? "");
  const title = `${nom} · ${company.name} (${company.ticker}) · Mettrik AI`;
  const description = `${valeur}${kpi.yoy ? `, ${kpi.yoy} vs N-1` : ""}. Indicateur extrait des rapports officiels de ${company.name}.`;
  const image = `${BASE}/api/og/kpi/${ticker.toLowerCase()}/${code}`;
  const url = `${BASE}/k/${ticker.toLowerCase()}/${code}`;
  return {
    title, description,
    alternates: { canonical: `${BASE}/${ticker.toLowerCase()}` },
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Mettrik AI", type: "website", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }: { params: Promise<{ ticker: string; code: string }> }) {
  const { ticker, code } = await params;
  const t = await trouve(ticker, code);
  const cible = t
    ? `/sandbox/v1-9-5/${ticker.toLowerCase()}?kpi=${encodeURIComponent(String(t.kpi.short))}`
    : `/${ticker.toLowerCase()}`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-center text-zinc-300">
      <meta httpEquiv="refresh" content={`0;url=${cible}`} />
      <p className="text-[14px]">
        Ouverture de la fiche… <a href={cible} className="text-violet-300 underline">Cliquer ici si rien ne se passe</a>
      </p>
    </main>
  );
}
