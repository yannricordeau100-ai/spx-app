import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import { loadV17Company } from "@/lib/v1-7/load-company";
import { getServerLocale } from "@/lib/i18n/server";
import V19_UNIVERSE from "@/data/v1-9-universe.json";
import V19_PUBLISHABLE from "@/data/v1-9-publishable.json";

// Yann 20 mai 2026 13h30 : critère "publishable" (hero spec + 3 KPI spec + desc)
// remplace "strict 11/11" pour visibilité. UI masque automatiquement les blocs
// vides (seg/geo/ai) côté composants. Objectif : afficher max stés possible,
// seules les vraiment cassées (sources insuffisantes) restent en préparation.
const STRICTLY_COMPLETE = new Set(
  (V19_PUBLISHABLE as { tickers: string[] }).tickers.map((t) => t.toUpperCase()),
);

// Set des tickers V1.9 pour différencier "fiche en préparation" (sté
// connue de notre univers, scrape data CONV-DATA en cours) vs notFound()
// (URL random sans correspondance). Yann 19 mai 2026.
const V19_TICKERS = new Set(
  (V19_UNIVERSE as Array<{ ticker: string; name: string; country: string }>).map(
    (e) => e.ticker.toUpperCase(),
  ),
);
const V19_BY_TICKER = new Map(
  (V19_UNIVERSE as Array<{ ticker: string; name: string; country: string }>).map(
    (e) => [e.ticker.toUpperCase(), e],
  ),
);

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

/** Doublons multi-classes : redirect vers le canonique (cf V1.7 / V1.8). */
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
 * /sandbox/v1-9/<ticker> — variante V1.9 (Yann 18 mai 2026).
 *
 * Univers étendu : SP500 + Top 307 + CAC 40 + FTSE 100 + DAX 40 + SMI +
 * BEL 20 + FTSE MIB + AEX + ATX (924 stés).
 *
 * Comportement identique à V1.8 :
 *  - Filtre admission relaxé via `mode: "v18"` (placeholders rouges sur blocs missing).
 *  - Composant `CompanyView` réutilisé tel quel.
 *  - 78 tickers V1.9 ne sont pas dans `_merged.json` → loader renvoie `missing`
 *    → notFound() (= comportement V1.8). À terme CONV-DATA les amènera dans Pass 3.
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
    title: `${r.company.name} (${r.company.ticker}) · V1.9 · Mettrik AI`,
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

export default async function SandboxV19TickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const aliasTarget = URL_ALIASES[ticker.toUpperCase()];
  if (aliasTarget && aliasTarget !== ticker.toLowerCase()) {
    redirect(`/sandbox/v1-9/${aliasTarget}`);
  }
  const locale = await getServerLocale();
  const r = await loadV17Company(ticker, { mode: "v18", locale });
  if (r.kind === "missing") {
    // Yann 19 mai 2026 : si le ticker est dans l'univers V1.9 mais absent
    // de `_merged.json`, afficher "Fiche en préparation" au lieu de 404.
    // Cas typique : 78 stés EU indices (ATX intégral, FTSE 100 partiel, etc.)
    // pour lesquelles CONV-DATA n'a pas encore scrapé les sources.
    const v19Entry = V19_BY_TICKER.get(ticker.toUpperCase());
    if (v19Entry) {
      const isFr = locale === "fr";
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1 text-[11px] uppercase tracking-wider text-amber-200">
            <span className="size-1.5 rounded-full bg-amber-400" />
            {isFr ? "Fiche en préparation" : "Profile being prepared"}
          </div>
          <h1 className="font-display text-3xl font-bold text-zinc-50">
            {v19Entry.name}
          </h1>
          <div className="mt-1 font-mono text-[13px] uppercase tracking-wider text-zinc-500">
            {v19Entry.ticker} · {v19Entry.country}
          </div>
          <p className="mt-6 max-w-md mx-auto text-[14px] leading-relaxed text-zinc-400">
            {isFr
              ? "Cette société fait partie de l'univers V1.9 (SP500 + Top 307 + Indices européens). Notre pipeline d'extraction est en cours de collecte des données publiques (rapports annuels, semestriels, ad-hoc). Reviens dans quelques jours."
              : "This company is part of the V1.9 universe (SP500 + Top 307 + European indices). Our extraction pipeline is currently collecting public data (annual reports, half-year, ad-hoc filings). Check back in a few days."}
          </p>
        </div>
      );
    }
    notFound();
  }
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
  // Yann 19 mai 2026 ~22h : filtre admission strict 11/11 critères
  // (hero spécifique + 5+ KPIs spec history 5+ ans + 8 autres blocs).
  // Les stés non strictement complètes affichent "Fiche en préparation"
  // plutôt qu'une page mal remplie (ex MDT avec hero R&D history 3 mois).
  if (!STRICTLY_COMPLETE.has(ticker.toUpperCase())) {
    const isFr = locale === "fr";
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1 text-[11px] uppercase tracking-wider text-amber-200">
          <span className="size-1.5 rounded-full bg-amber-400" />
          {isFr ? "Fiche en préparation" : "Profile being prepared"}
        </div>
        <h1 className="font-display text-3xl font-bold text-zinc-50">
          {r.company.name}
        </h1>
        <div className="mt-1 font-mono text-[13px] uppercase tracking-wider text-zinc-500">
          {r.company.ticker}
        </div>
        <p className="mt-6 max-w-md mx-auto text-[14px] leading-relaxed text-zinc-400">
          {isFr
            ? "Cette société a une fiche partielle dans notre pipeline mais ne respecte pas encore tous les critères de qualité Mettrik AI (hero KPI spécifique avec 5+ ans d'historique, 5+ indicateurs métier, segments, géographie, gouvernance, risques, IA, événements, description). Notre pipeline complète activement les données manquantes. Reviens dans quelques heures."
            : "This company has a partial profile in our pipeline but does not yet meet all Mettrik AI quality criteria (specific hero KPI with 5+ years of history, 5+ business indicators, segments, geography, governance, risks, AI, events, description). Our pipeline is actively completing missing data. Check back in a few hours."}
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
