import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { COMPANIES, TICKERS, TICKER_ALIASES, getCompany } from "@/lib/data";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import V17_PUBLIC from "@/data/v1-7-public.json";
import { loadV17Company } from "@/lib/company-core/load-company";
import { resolveDisabledForTicker } from "@/lib/disabled-blocks-server";
import { getServerLocale } from "@/lib/i18n/server";
import { FreemiumBlurProvider, type UserTier } from "@/lib/freemium/context";
import { gateAttForTier } from "@/lib/att";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

async function loadTranscriptSummary(
  ticker: string,
): Promise<TranscriptBulletsSummary | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/transcript-summaries", `${ticker.toLowerCase()}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as TranscriptBulletsSummary;
  } catch {
    return null;
  }
}

/**
 * Yann 28 juillet 2026 : les 5 stés du dataset V1 legacy (GOOGL, META, MSCI,
 * SPGI, CAT) étaient les SEULES de tout l'univers à ne pas passer par le
 * loader V1.9.5. Résultat sur /googl : 5 indicateurs annuels (dataset figé
 * `src/data/google.json`) au lieu des 60 KPI trimestriels de la chaîne KPI v3,
 * et bouton "Trimestriel" grisé sur le hero faute de `period_type: "quarter"`.
 * Les 498 autres stés étaient déjà correctes via /sandbox/v1-9-5/<ticker>.
 * On aligne donc la route publique sur le même pipeline (règle d'or §0 :
 * dernière version uniquement), en gardant l'URL canonique /<ticker> pour
 * le SEO et le floutage freemium géré par FreemiumBlurProvider.
 */
async function resolveFreemiumTier(): Promise<UserTier> {
  const simulated = await readSimulateTier();
  if (simulated === "anonymous") return "anon";
  if (simulated === "free") return "free";
  if (simulated === "premium") return "premium";
  if (simulated === "max") return "max";
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return user ? "max" : "anon";
  } catch {
    return "anon";
  }
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
  const legacyCompany = getCompany(ticker);
  if (!legacyCompany) {
    // Yann 21 mai 2026 : V1.9.5 = défaut. Si le ticker existe en V1.7-public,
    // on redirige vers /sandbox/v1-9-5/<ticker> (UX : tape /AAPL → ouvre AAPL).
    const v17 = V17_PUBLIC as unknown as Record<string, unknown>;
    if (v17[upper]) {
      redirect(`/sandbox/v1-9-5/${ticker.toLowerCase()}`);
    }
    notFound();
  }

  // Pipeline V1.9.5 (identique aux 498 autres stés). Fallback sur le dataset
  // legacy uniquement si le loader ne rend pas la sté, pour ne jamais servir
  // une page vide sur une URL publique indexée.
  const locale = await getServerLocale();
  const r = await loadV17Company(ticker, { mode: "v18", locale });
  const transcript = await loadTranscript(ticker);

  if (r.kind !== "ready") {
    return (
      <>
        <CompanyView
          company={legacyCompany}
          authSlot={<AuthNav scope="company" />}
          transcript={transcript}
        />
        <DisclaimerFooter />
      </>
    );
  }

  const transcriptSummary = await loadTranscriptSummary(ticker);
  const disabledBlocks = await resolveDisabledForTicker(ticker);
  const freemiumTier = await resolveFreemiumTier();

  // ATT (anti-thèse) : même gating serveur que /sandbox/v1-9-5/<ticker>.
  // Le contenu complet n'est sérialisé que pour le plan Max.
  const gatedCompany = r.company.att
    ? { ...r.company, att: gateAttForTier(r.company.att, freemiumTier) }
    : r.company;

  return (
    <>
      <FreemiumBlurProvider tier={freemiumTier}>
        <CompanyView
          company={gatedCompany}
          authSlot={<AuthNav scope="company" />}
          transcript={transcript}
          transcriptSummary={transcriptSummary}
          v18Mode
          freemiumTier={freemiumTier}
          disabledBlocks={disabledBlocks}
        />
      </FreemiumBlurProvider>
      <DisclaimerFooter />
    </>
  );
}
