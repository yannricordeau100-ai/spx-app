import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { COMPANIES, TICKERS, TICKER_ALIASES, getCompany } from "@/lib/data";
import type { TranscriptDoc } from "@/components/transcript-stories";
import V17_PUBLIC from "@/data/v1-7-public.json";

async function loadTranscript(ticker: string): Promise<TranscriptDoc | null> {
  const root = process.cwd();
  for (const f of [`${ticker.toUpperCase()}.json`, `${ticker.toLowerCase()}.json`]) {
    try {
      const raw = await fs.readFile(path.join(root, "src/data/transcripts", f), "utf-8");
      return JSON.parse(raw) as TranscriptDoc;
    } catch {
      // try next
    }
  }
  return null;
}

// Force dynamic rendering pour que la session auth (cookies) soit lue
// par AuthNav à chaque requête.
export const dynamic = "force-dynamic";

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
  if (!c) return { title: "Page introuvable · Mettrik AI" };
  const slug = ticker.toLowerCase();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const title = `${c.name} (${c.ticker}) · Mettrik AI`;
  const description = `Analyse KPI sur ${c.name}. Indicateurs scorés, risques tracés, gouvernance, positionnement IA. ${c.sector}.`;
  const ogImage = `${base}/api/og/${slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${slug}`,
      languages: {
        en: `${base}/${slug}`,
        fr: `${base}/fr/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${base}/${slug}`,
      siteName: "Mettrik AI",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${c.name} · Mettrik AI` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  // Redirect alias tickers (e.g. GOOG → GOOGL) toward canonical URL.
  if (TICKER_ALIASES[upper]) {
    redirect(`/${TICKER_ALIASES[upper].toLowerCase()}`);
  }
  const company = getCompany(ticker);
  if (!company) {
    // Yann 21 mai 2026 : V1.9.5 = défaut. Si le ticker existe en V1.7-public,
    // on redirige vers /sandbox/v1-9-5/<ticker> (UX : tape /AAPL → ouvre AAPL).
    const v17 = V17_PUBLIC as unknown as Record<string, unknown>;
    if (v17[upper]) {
      redirect(`/sandbox/v1-9-5/${ticker.toLowerCase()}`);
    }
    notFound();
  }
  const transcript = await loadTranscript(ticker);
  return (
    <>
      <CompanyView company={company} authSlot={<AuthNav scope="company" />} transcript={transcript} />
      <DisclaimerFooter />
    </>
  );
}
