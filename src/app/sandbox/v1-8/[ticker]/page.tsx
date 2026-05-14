import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import { loadV17Company } from "@/lib/v1-7/load-company";
import { getServerLocale } from "@/lib/i18n/server";

async function loadTranscriptSummary(
  ticker: string,
): Promise<TranscriptBulletsSummary | null> {
  const filePath = path.join(
    process.cwd(),
    "src/data/transcript-summaries",
    `${ticker.toLowerCase()}.json`,
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TranscriptBulletsSummary;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

/** Doublons multi-classes : redirect vers le canonique (cf V1.7). */
const URL_ALIASES: Record<string, string> = {
  GOOG: "googl",
  NWSA: "nws",
  UAA: "ua",
  FOX: "foxa",
  "BRK.A": "brk-b",
  "BRK-A": "brk-b",
  "BRK.B": "brk-b",
};

/**
 * /sandbox/v1-8/<ticker> — variante V1.8 (Yann 7 mai 2026).
 *  - Filtre admission relaxé : Pass 3 Sonnet + hero KPI usable suffisent.
 *  - Les blocs manquants (risks, governance, AI, segments, geo, TAM,
 *    events) sont rendus en placeholder rouge dans la UI via `v18Mode`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const r = await loadV17Company(ticker, { mode: "v18" });
  if (r.kind === "missing") return { title: "Page introuvable · Mettrik AI" };
  return {
    title: `${r.company.name} (${r.company.ticker}) · V1.8 · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

async function loadTranscript(ticker: string): Promise<TranscriptDoc | null> {
  const filePath = path.join(process.cwd(), "src/data/transcripts", `${ticker.toUpperCase()}.json`);
  let doc: TranscriptDoc | null = null;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    doc = JSON.parse(raw) as TranscriptDoc;
  } catch {
    try {
      const alt = path.join(process.cwd(), "src/data/transcripts", `${ticker.toLowerCase()}.json`);
      const raw = await fs.readFile(alt, "utf-8");
      doc = JSON.parse(raw) as TranscriptDoc;
    } catch {
      return null;
    }
  }
  if (!doc) return null;

  // Merge le résumé PV-driven Groq Llama 3.3 si dispo (Yann 11 mai 2026).
  // Mappe les champs du résumé vers le format `extracts` consommé par
  // <TranscriptStories /> (quotes / figures / sentiment).
  const summaryPath = path.join(
    process.cwd(),
    "src/data/transcript-summaries",
    `${ticker.toLowerCase()}.json`,
  );
  try {
    const raw = await fs.readFile(summaryPath, "utf-8");
    const wrapper = JSON.parse(raw) as { summary?: Record<string, unknown> };
    const s = wrapper.summary ?? {};
    type CitationPick = { citation?: string; speaker?: string; tag?: string };
    const cps = (s.citations_picks as CitationPick[] | undefined) ?? [];
    const quotes = cps.map((c) => ({
      speaker: c.speaker ?? "",
      text: c.citation ?? "",
      theme: c.tag ?? "",
    }));
    type Kpi = { nom?: string; valeur?: string; delta?: string; signal?: string };
    const kpis3 = (s.synthese_3_kpi_cles as Kpi[] | undefined) ?? [];
    const figures: { metric: string; value: string; comment?: string }[] = [];
    for (const k of kpis3) {
      if (!k.nom || !k.valeur) continue;
      figures.push({
        metric: k.nom,
        value: k.valeur,
        comment: k.delta || k.signal,
      });
    }
    const guidance = s.guidance_q_plus_1 as string | undefined;
    if (guidance) {
      figures.push({ metric: "Guidance Q+1", value: guidance.slice(0, 100) });
    }
    type Driver = { kpi?: string; interpretation_pv?: string };
    const drv = s.driver_croissance_1 as Driver | undefined;
    if (drv?.kpi && drv.interpretation_pv) {
      figures.push({
        metric: `Driver : ${drv.kpi}`,
        value: drv.interpretation_pv.slice(0, 80),
      });
    }
    const vig = s.vigilance_1 as Driver | undefined;
    if (vig?.kpi && vig.interpretation_pv) {
      figures.push({
        metric: `Vigilance : ${vig.kpi}`,
        value: vig.interpretation_pv.slice(0, 80),
      });
    }
    const tonal = String(s.tonalite_management ?? "").toLowerCase();
    let sentiment: "bullish" | "neutral" | "cautious" = "neutral";
    if (tonal.includes("confiance") || tonal.includes("optim")) sentiment = "bullish";
    else if (
      tonal.includes("prud") ||
      tonal.includes("inquiet") ||
      tonal.includes("vigil")
    )
      sentiment = "cautious";
    doc.extracts = {
      quotes,
      figures,
      sentiment,
      summary: String(s.tonalite_management ?? ""),
    };
  } catch {
    // No summary file, return doc as-is
  }
  return doc;
}

export default async function SandboxV18TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const aliasTarget = URL_ALIASES[ticker.toUpperCase()];
  if (aliasTarget && aliasTarget !== ticker.toLowerCase()) {
    redirect(`/sandbox/v1-8/${aliasTarget}`);
  }
  const locale = await getServerLocale();
  const r = await loadV17Company(ticker, { mode: "v18", locale });
  if (r.kind === "missing") notFound();
  if (r.kind === "preparing") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">{r.company.name}</h1>
        <p className="mt-3 text-zinc-400">
          Pass 3 Sonnet pas encore validé pour cette société. Reviens bientôt.
        </p>
      </div>
    );
  }
  const transcript = await loadTranscript(ticker);
  const transcriptSummary = await loadTranscriptSummary(ticker);
  return (
    <CompanyView
      company={r.company}
      authSlot={<AuthNav scope="company" />}
      transcript={transcript}
      transcriptSummary={transcriptSummary}
      v18Mode
    />
  );
}
