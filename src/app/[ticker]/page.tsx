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
import {
  caviardeCompanyPourGratuit,
  caviardeTranscriptDocPourGratuit,
  caviardeTranscriptsPourGratuit,
} from "@/lib/floutage-caviardage";
import { chargeZonesFloutage } from "@/lib/desk/floutage-zones";
import { gateAttForTier } from "@/lib/att";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";

/** Visibilité V1.9.5 : la liste clean-all fait foi (mêmes variantes de
 *  séparateur que le loader V1.9.5 : BRK.B / BRK-B). */
async function estDansCleanAll(upper: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"),
      "utf-8",
    );
    const tickers = (JSON.parse(raw) as { tickers: string[] }).tickers;
    const set = new Set<string>();
    for (const t of tickers) {
      const u = t.toUpperCase();
      set.add(u);
      set.add(u.replace(/\./g, "-"));
      set.add(u.replace(/-/g, "."));
    }
    return set.has(upper);
  } catch {
    return false;
  }
}

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
    return user ? await tierDepuisAbonnement(user) : "anon";
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
    // Yann 2 sept 2026 (code rouge KO) : la vraie source de visibilité est la
    // liste V1.9.5 clean-all, pas la vieille liste V1.7 (95 stés en ligne dont
    // KO, JNJ, AMD, CSCO, GS y manquaient et tombaient en 404 sur /<ticker>).
    const v17 = V17_PUBLIC as unknown as Record<string, unknown>;
    if (v17[upper] || (await estDansCleanAll(upper))) {
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
    // Audit 2 sept 2026 : le repli legacy passe par le meme palier et le
    // meme fournisseur de floutage que le chemin principal.
    const tierRepli = await resolveFreemiumTier();
    return (
      <>
        <FreemiumBlurProvider tier={tierRepli}>
          <CompanyView
            company={legacyCompany}
            authSlot={<AuthNav scope="company" />}
            transcript={tierRepli === "free" || tierRepli === "anon" ? null : transcript}
            freemiumTier={tierRepli}
          />
        </FreemiumBlurProvider>
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

  // Yann 30 aout 2026 : palier gratuit et anonyme, le texte des zones
  // floutees est CAVIARDE ici, cote serveur, avant tout rendu. Le vrai texte
  // ne part jamais au navigateur (copier-coller, impression, code source :
  // seul le charabia est recuperable). Les societes exemptees (zones vides)
  // et les offres payantes recoivent la fiche entiere.
  const estGratuit = freemiumTier === "free" || freemiumTier === "anon";
  const zonesEffectives = estGratuit
    ? (await chargeZonesFloutage(r.company.ticker)).zones
    : [];
  const servedCompany = estGratuit
    ? caviardeCompanyPourGratuit(gatedCompany, zonesEffectives)
    : gatedCompany;
  const servedTranscriptSummary = estGratuit
    ? caviardeTranscriptsPourGratuit(transcriptSummary ?? null, zonesEffectives)
    : transcriptSummary;

  return (
    <>
      <FreemiumBlurProvider tier={freemiumTier}>
        <CompanyView
          company={servedCompany}
          authSlot={<AuthNav scope="company" />}
          transcript={estGratuit ? caviardeTranscriptDocPourGratuit(transcript, zonesEffectives) : transcript}
          transcriptSummary={servedTranscriptSummary}
          v18Mode
          freemiumTier={freemiumTier}
          disabledBlocks={disabledBlocks}
        />
      </FreemiumBlurProvider>
      <DisclaimerFooter />
    </>
  );
}
