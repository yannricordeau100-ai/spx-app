/**
 * load-company.ts — chargement et enrichissement d'une fiche société V1.7.
 *
 * Lit `src/data/v2-pipeline/<ticker>.json` (extraction CONV-DATA) puis
 * enrichit avec les fichiers latéraux produits par CONV-SYSTEMS qui ne
 * doivent pas écraser le dataset principal :
 *
 *   - `src/data/v2-pipeline-enrich/<ticker>.tam.json` → market_positions
 *     (TAM honesty rule, batch nuit du 5→6 mai 2026)
 *   - `src/data/v2-pipeline-enrich/<ticker>.json` (futur) → events,
 *     revenue_by_segment, revenue_by_geography (scope CONV-SYSTEMS)
 *   - `src/data/transcripts/<TICKER>.json` → transcript story bloc
 *
 * Auto-applique le filtre admission Pass 3 strict via `isStrictPass3`. Si
 * la sté n'est pas Pass 3 → renvoie `null` (la route appelle alors notFound
 * ou un "Fiche en préparation").
 *
 * Intentionnellement pur lecture FS : pas de cache mémoire (Yann ne veut
 * pas de stale data après un rebuild de pipeline). Next.js cache la route
 * via `revalidate` quand pertinent.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Company, CompanyRisk } from "@/lib/data";
import { enhanceFreshness } from "@/lib/v1-7/enhance-freshness";
import { isStrictPass3 } from "@/lib/v1-7/strict-pass3";

type AnyKPI = Record<string, unknown>;
type AnyCo = Record<string, unknown>;

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

async function readJsonOrNull<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type LoadOutcome =
  | { kind: "ready"; company: Company }
  | { kind: "preparing"; company: Pick<Company, "ticker" | "name"> }
  | { kind: "missing" };

/**
 * Charge la fiche pour un ticker donné. Trois résultats possibles :
 *  - `ready`     : fiche Pass 3 strict, prête à être rendue dans CompanyView.
 *  - `preparing` : ticker connu mais pas encore Pass 3 → "Fiche en préparation".
 *  - `missing`   : ticker inconnu → notFound.
 */
export async function loadV17Company(ticker: string): Promise<LoadOutcome> {
  const ROOT = process.cwd();
  const filePath = path.join(ROOT, "src/data/v2-pipeline", `${ticker.toLowerCase()}.json`);
  const raw = await readJsonOrNull<AnyCo>(filePath);
  if (!raw) return { kind: "missing" };

  // Normalise stories_kpis → kpis avec is_short_history flag
  const data = { ...raw } as AnyCo & { stories_kpis?: AnyKPI[]; kpis?: AnyKPI[] };
  if (Array.isArray(data.stories_kpis)) {
    const stories = data.stories_kpis.map((s) => ({ ...s, is_short_history: true }));
    data.kpis = [...(data.kpis || []), ...stories];
    delete data.stories_kpis;
  }

  // Normalise history (objet | nombre)
  if (Array.isArray(data.kpis)) {
    data.kpis = data.kpis.map((k) => ({
      ...k,
      history: normalizeHistory((k as AnyKPI).history),
    }));
  }

  // Defaults UI
  if (!data.logo_treatment) data.logo_treatment = "orbit";
  if (!data.ranks) data.ranks = { global_world: "-", global_us: "-", sector: "-", subsector: "-" };
  if (!data.tagline) data.tagline = "";

  // Filtre admission strict Pass 3
  if (!isStrictPass3(data)) {
    return {
      kind: "preparing",
      company: {
        ticker: String(data.ticker ?? ticker.toUpperCase()),
        name: String(data.name ?? ticker.toUpperCase()),
      },
    };
  }

  // Enrichissement TAM (batch nuit 5→6 mai 2026 produit
  // src/data/v2-pipeline-enrich/<ticker>.tam.json séparément pour ne pas
  // écraser le pipeline. Merge ici si présent ET la fiche n'a pas déjà
  // ses propres market_positions). TAM honesty rule respectée par le batch.
  if (!Array.isArray((data as Record<string, unknown>).market_positions)) {
    const tamPath = path.join(
      ROOT,
      "src/data/v2-pipeline-enrich",
      `${ticker.toLowerCase()}.tam.json`,
    );
    const tam = await readJsonOrNull<{ market_positions?: unknown }>(tamPath);
    if (tam && Array.isArray(tam.market_positions) && tam.market_positions.length > 0) {
      (data as Record<string, unknown>).market_positions = tam.market_positions;
    }
  }

  // Enrichissement générique (events, revenue_by_segment, revenue_by_geography,
  // stories_kpis additionnels…) depuis v2-pipeline-enrich/<ticker>.json si
  // présent (sans écraser).
  const enrichPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.json`,
  );
  const enrich = await readJsonOrNull<Record<string, unknown>>(enrichPath);
  if (enrich) {
    for (const key of [
      "events",
      "revenue_by_segment",
      "revenue_by_geography",
      "profit_warning",
    ] as const) {
      if (
        enrich[key] !== undefined &&
        (data as Record<string, unknown>)[key] === undefined
      ) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Risks / governance / AI positioning : merge SEULEMENT si la fiche
    // CONV-DATA ne les a pas déjà fournis. Évite de doubler des données.
    for (const key of ["risks", "governance", "ai_positioning"] as const) {
      const existing = (data as Record<string, unknown>)[key];
      const empty =
        existing === undefined ||
        existing === null ||
        (Array.isArray(existing) && existing.length === 0);
      if (empty && enrich[key] !== undefined) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Stories KPIs : ajout APPEND. CONV-SYSTEMS produit des KPIs short-history
    // additionnels (ex : Netflix ad-tier MAU, Live hours) qui complètent ceux
    // de CONV-DATA. Tag is_short_history forcé à true côté carrousel Stories.
    if (Array.isArray(enrich.stories_kpis) && Array.isArray(data.kpis)) {
      const extraStories = enrich.stories_kpis.map((s) => ({
        ...(s as AnyKPI),
        is_short_history: true,
        history: normalizeHistory((s as AnyKPI).history),
      }));
      data.kpis = [...data.kpis, ...extraStories];
    }
  }

  // Fresh / stale backfill via existing helper
  const company = enhanceFreshness(data as Company & Record<string, unknown>);

  // Sanity : si risks n'a pas score_rationale (V1.0 le requiert), on
  // laisse RiskStack rendre quand même mais sans le tooltip.
  if (Array.isArray(company.risks)) {
    company.risks = company.risks.map((r: CompanyRisk) => ({ ...r }));
  }

  return { kind: "ready", company };
}
