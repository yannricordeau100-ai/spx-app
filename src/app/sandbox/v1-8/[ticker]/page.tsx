import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import type { TranscriptDoc } from "@/components/transcript-stories";
import { loadV17Company } from "@/lib/v1-7/load-company";

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
  const r = await loadV17Company(ticker, { mode: "v18" });
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
  return (
    <CompanyView
      company={r.company}
      authSlot={<AuthNav scope="company" />}
      transcript={transcript}
      v18Mode
    />
  );
}
