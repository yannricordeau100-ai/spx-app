import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import type { Company } from "@/lib/data";
import type { TranscriptDoc } from "@/components/transcript-stories";
import { enhanceFreshness } from "@/lib/v1-7/enhance-freshness";

export const dynamic = "force-dynamic";

/**
 * /sandbox/v1-7/<ticker> = même structure visuelle que la page sté V1
 * (`/[ticker]`). Aucun bandeau sandbox, aucun marqueur "V1.7" : Yann veut
 * un rendu identique à la prod, seul le dataset change (lit dans
 * `src/data/v2-pipeline/` au lieu de `src/data/<ticker>.json`).
 */
/**
 * Normalise history : certaines fiches stockent history sous forme
 * d'objets { date, value, unit }[] au lieu de number[]. On extrait .value.
 */
function normalizeHistory(h: unknown): number[] {
  if (!Array.isArray(h)) return [];
  return h
    .map((item) => {
      if (typeof item === "number") return item;
      if (item && typeof item === "object" && "value" in item) {
        const v = (item as { value: unknown }).value;
        return typeof v === "number" ? v : Number(v);
      }
      return Number(item);
    })
    .filter((v) => Number.isFinite(v));
}

async function loadDataset(ticker: string): Promise<Company | null> {
  const filePath = path.join(process.cwd(), "src/data/v2-pipeline", `${ticker.toLowerCase()}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as Company & { stories_kpis?: Company["kpis"] };
    if (Array.isArray(data.stories_kpis)) {
      const stories = data.stories_kpis.map((s) => ({ ...s, is_short_history: true }));
      data.kpis = [...(data.kpis || []), ...stories];
      delete data.stories_kpis;
    }
    // Normalise history sur tous les KPIs (gère format objet ou nombre)
    if (Array.isArray(data.kpis)) {
      data.kpis = data.kpis.map((k) => ({
        ...k,
        history: normalizeHistory((k as unknown as { history: unknown }).history),
      }));
    }
    if (!data.logo_treatment) (data as Company).logo_treatment = "orbit";
    if (!data.ranks) data.ranks = { global_world: "-", global_us: "-", sector: "-", subsector: "-" };
    if (!data.tagline) data.tagline = "";
    return enhanceFreshness(data as Company & Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const c = await loadDataset(ticker);
  if (!c) return { title: "Page introuvable · Mettrik AI" };
  return {
    title: `${c.name} (${c.ticker}) · Mettrik AI`,
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
    // Tentative en lower case (CONV-DATA n'a pas tranché la convention).
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
  const company = await loadDataset(ticker);
  if (!company) notFound();
  // Filtre admission : si la fiche ne passe pas les critères de qualité minimums
  // (history hero <3 pts, value null, <5 KPIs, description trop courte),
  // on affiche un message "en préparation" au lieu d'une fiche moche.
  // Les datasets ont _fit_for_site=false sur les fiches non publiables.
  const c = company as Company & { _fit_for_site?: boolean; _fit_reasons?: string[] };
  if (c._fit_for_site === false) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">{c.name}</h1>
        <p className="mt-3 text-zinc-400">
          Fiche en préparation. Les données ne sont pas encore complètes pour
          cette société. Reviens bientôt.
        </p>
      </div>
    );
  }
  const transcript = await loadTranscript(ticker);
  return <CompanyView company={company} authSlot={<AuthNav scope="company" />} hideSenate transcript={transcript} />;
}
