import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import type { TranscriptDoc } from "@/components/transcript-stories";
import { loadV17Company } from "@/lib/v1-7/load-company";
import { getServerLocale } from "@/lib/i18n/server";

/**
 * Doublons multi-classes : redirect 308 (permanent) vers le canonique pour
 * que l'URL visible matche le ticker du dataset. Évite que GOOG, NWSA,
 * UAA, BRK.A apparaissent en barre d'adresse alors qu'on rend GOOGL/NWS/UA/BRK-B.
 */
const URL_ALIASES: Record<string, string> = {
  GOOG: "googl",
  NWSA: "nws",
  UAA: "ua",
  FOX: "foxa",
  "BRK.A": "brk-b",
  "BRK-A": "brk-b",
  "BRK.B": "brk-b",
};

export const dynamic = "force-dynamic";

/**
 * /sandbox/v1-7-5/<ticker> = même structure visuelle que la page sté V1
 * (`/[ticker]`). Aucun bandeau sandbox, aucun marqueur "V1.7.5" : Yann veut
 * un rendu identique à la prod, seul le dataset change.
 *
 * Le chargement délègue à `loadV17Company` qui :
 *  - lit `src/data/v2-pipeline/<ticker>.json`
 *  - merge market_positions / events / revenue_by_segment depuis
 *    `src/data/v2-pipeline-enrich/<ticker>(.tam).json`
 *  - applique le filtre admission Pass 3 strict (cf. `strict-pass3.ts`)
 *
 * Un seul chemin de rendu côté UI. Si la sté n'est pas Pass 3 →
 * écran "Fiche en préparation".
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const r = await loadV17Company(ticker);
  if (r.kind === "missing") return { title: "Page introuvable · Mettrik AI" };
  return {
    title: `${r.company.name} (${r.company.ticker}) · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

/** Charge le transcript du DERNIER earning call pour ce ticker, si dispo. */
async function loadTranscript(ticker: string): Promise<TranscriptDoc | null> {
  const filePath = path.join(process.cwd(), "src/data/transcripts", `${ticker.toUpperCase()}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TranscriptDoc;
  } catch {
    try {
      const alt = path.join(process.cwd(), "src/data/transcripts", `${ticker.toLowerCase()}.json`);
      const raw = await fs.readFile(alt, "utf-8");
      return JSON.parse(raw) as TranscriptDoc;
    } catch {
      return null;
    }
  }
}

export default async function SandboxV17TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  // Redirect alias → canonique (308 permanent) pour propreté URL
  const aliasTarget = URL_ALIASES[ticker.toUpperCase()];
  if (aliasTarget && aliasTarget !== ticker.toLowerCase()) {
    redirect(`/sandbox/v1-7-5/${aliasTarget}`);
  }
  const locale = await getServerLocale();
  const r = await loadV17Company(ticker, { locale });
  if (r.kind === "missing") notFound();
  if (r.kind === "preparing") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">{r.company.name}</h1>
        <p className="mt-3 text-zinc-400">
          Fiche en préparation. Les données ne sont pas encore complètes pour
          cette société. Reviens bientôt.
        </p>
      </div>
    );
  }
  const transcript = await loadTranscript(ticker);
  return <CompanyView company={r.company} authSlot={<AuthNav scope="company" />} transcript={transcript} />;
}
