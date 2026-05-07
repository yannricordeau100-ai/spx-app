/**
 * data-status.ts — agrège les stats live de l'app Mettrik AI :
 *   - téléchargements sec-data par catégorie (cat 1 US, cat 2 ADR, cat 3 EU)
 *   - couverture pipeline LLM (Pass 1 / Pass 2 / Pass 3)
 *   - répartition Pass 3 par modèle (Sonnet vs Haiku)
 *   - audit V1.7 par bloc UI (logos, ranks, événements, etc.)
 *   - solde crédits LLM (Cerebras / Gemini / Anthropic)
 *
 * Lu en SSR via `/sandbox/data-status` (page bloc dashboard). Pas de cache
 * côté code : Next.js cache la route via `revalidate = 300` (5 min) côté
 * page.tsx. Tout vient du filesystem local sans appel réseau.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const SEC = path.join(ROOT, "sec-data");
const META = path.join(SEC, "_meta");
const PIPELINE_MERGED = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const V17_PUBLIC = path.join(ROOT, "src/data/v1-7-public.json");
const AUDIT = path.join(ROOT, "src/data/v1-7-blocks-audit.json");
const LOGOS = path.join(ROOT, "public/logos");

type AnyRec = Record<string, unknown>;

function safeJson<T>(p: string): T | null {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function countFilesIn(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/** Somme récursive des fichiers .htm.gz dans un dossier (par année). */
function countFilesByYearTotal(base: string): number {
  if (!existsSync(base)) return 0;
  let total = 0;
  try {
    for (const yearDir of readdirSync(base)) {
      const p = path.join(base, yearDir);
      try {
        if (statSync(p).isDirectory()) {
          total += readdirSync(p).filter((f) => f.endsWith(".htm.gz")).length;
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return total;
}

/** Tickers uniques téléchargés sur les 3 dernières années (proxy "à jour"). */
function uniqueTickersDownloaded(base: string, recentYears: number = 3): Set<string> {
  const set = new Set<string>();
  if (!existsSync(base)) return set;
  try {
    const years = readdirSync(base)
      .filter((d) => /^\d{4}$/.test(d))
      .sort()
      .reverse()
      .slice(0, recentYears);
    for (const y of years) {
      try {
        for (const f of readdirSync(path.join(base, y))) {
          // Files are <TICKER>_<date>.htm.gz
          const m = f.match(/^([A-Z0-9.\-]+)_\d{4}-\d{2}-\d{2}\.htm\.gz$/);
          if (m) set.add(m[1]);
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return set;
}

export type DataStatusSnapshot = {
  generated_at: string;
  /** Compteur sec-data par catégorie. */
  sec_data: {
    cat1_us: { target: number; downloaded: number; coverage_pct: number };
    cat2_adr: { target: number; downloaded: number; coverage_pct: number };
    cat3_eu: { target: number; downloaded: number; coverage_pct: number };
  };
  /** Couverture pipeline LLM v2-pipeline. */
  pipeline: {
    total: number;
    pass1: number;
    pass2: number;
    pass3: number;
    pass3_sonnet: number;
    pass3_haiku: number;
    pass3_other: number;
  };
  /** Audit V1.7 par bloc UI. */
  v17_audit: {
    total_searchable: number;
    missing: Record<string, number>;
  };
  /** Solde crédits LLM. */
  llm_credits: {
    cerebras: { remaining_usd: number | null; note: string };
    gemini: { remaining_usd: number | null; note: string };
    anthropic: { remaining_usd: number | null; note: string };
  };
  /** Tickers V1.7 publics (= recherchables sur le hub). */
  searchable_count: number;
  /** Logos PNG locaux (pour audit). */
  logos_count: number;
};

export function computeDataStatus(): DataStatusSnapshot {
  // ─── sec-data download counts ─────────────────────────────────────
  const cat1Tickers = uniqueTickersDownloaded(path.join(SEC, "cat1-us/10K"));
  const cat2Tickers = uniqueTickersDownloaded(path.join(SEC, "cat2-foreign-adr/20F"));
  // Pour cat 1 incluse aussi 10-Q et 8-K, mais le 10-K est le marqueur "à jour"
  const cat3Tickers = new Set<string>();
  if (existsSync(path.join(SEC, "cat3-european"))) {
    try {
      for (const d of readdirSync(path.join(SEC, "cat3-european"))) {
        if (statSync(path.join(SEC, "cat3-european", d)).isDirectory()) cat3Tickers.add(d);
      }
    } catch {
      // skip
    }
  }

  // Targets : cat1-us-coverage.json (univers SP1500+), cat3-european-index.json
  const cat1Coverage = safeJson<Record<string, unknown>>(path.join(META, "cat1-us-coverage.json"));
  const cat3Index = safeJson<Record<string, unknown>>(path.join(META, "cat3-european-index.json"));
  // Cat 2 ADR n'a pas d'index dédié, on prend le nb de tickers téléchargés
  // comme target "réel" connu.
  const cat1Target = cat1Coverage ? Object.keys(cat1Coverage).length : cat1Tickers.size;
  const cat3Target = cat3Index ? Object.keys(cat3Index).length : cat3Tickers.size;
  const cat2Target = cat2Tickers.size; // pas de target externe documenté

  // ─── pipeline v2-pipeline coverage ────────────────────────────────
  const merged = safeJson<Record<string, AnyRec>>(PIPELINE_MERGED);
  let total = 0, p1 = 0, p2 = 0, p3 = 0, p3sonnet = 0, p3haiku = 0;
  if (merged) {
    for (const e of Object.values(merged)) {
      total++;
      if (Array.isArray(e.kpis) && (e.kpis as unknown[]).length > 0) p1++;
      if (e.risks || e.governance || e.ai_positioning) p2++;
      if (e._validation || e._validation_global) {
        p3++;
        // _validation_global ou _iterative_refinement = Sonnet (top-tier
        // validation ou affinage). _validation seul = Haiku Pass 3 standard.
        if (e._validation_global || e._iterative_refinement) {
          p3sonnet++;
        } else {
          p3haiku++;
        }
      }
    }
  }
  const p3other = p3 - p3sonnet - p3haiku;

  // ─── audit V1.7 par bloc ──────────────────────────────────────────
  const auditRaw = safeJson<Record<string, string[]>>(AUDIT) || {};
  const v17Public = safeJson<Record<string, AnyRec>>(V17_PUBLIC) || {};
  const v17Total = Object.keys(v17Public).length;
  const missing: Record<string, number> = {
    MISSING_LOGO: 0,
    MISSING_RANKS: 0,
    MISSING_RISKS: 0,
    MISSING_GOVERNANCE: 0,
    MISSING_AI_POSITIONING: 0,
    MISSING_MARKET_POSITIONS: 0,
    MISSING_EVENTS: 0,
    MISSING_SEGMENTS: 0,
    MISSING_GEOGRAPHY: 0,
  };
  for (const flags of Object.values(auditRaw)) {
    for (const f of flags) {
      if (f in missing) missing[f]++;
    }
  }

  // ─── crédits LLM ──────────────────────────────────────────────────
  // Note: les APIs Anthropic / Cerebras / Gemini n'exposent pas le solde
  // de crédit via clé API directement (uniquement billing UI). On lit un
  // fichier local `sec-data/_meta/llm-spend.json` si présent, où les
  // scripts d'enrichissement peuvent annoter leur consommation cumulée.
  const spendFile = path.join(META, "llm-spend.json");
  const spend = safeJson<{
    cerebras?: { remaining_usd?: number; updated_at?: string };
    gemini?: { remaining_usd?: number; updated_at?: string };
    anthropic?: { remaining_usd?: number; updated_at?: string };
  }>(spendFile);

  const llm_credits = {
    cerebras: {
      remaining_usd: spend?.cerebras?.remaining_usd ?? null,
      note: spend?.cerebras?.updated_at
        ? `MAJ ${spend.cerebras.updated_at}`
        : "Pas de tracking local. Vérifier sur cerebras.ai/billing.",
    },
    gemini: {
      remaining_usd: spend?.gemini?.remaining_usd ?? null,
      note: spend?.gemini?.updated_at
        ? `MAJ ${spend.gemini.updated_at}`
        : "Pas de tracking local. Vérifier sur ai.google.dev.",
    },
    anthropic: {
      remaining_usd: spend?.anthropic?.remaining_usd ?? null,
      note: spend?.anthropic?.updated_at
        ? `MAJ ${spend.anthropic.updated_at}`
        : "Pas de tracking local. Vérifier sur console.anthropic.com.",
    },
  };

  // ─── logos count ──────────────────────────────────────────────────
  const logosCount = existsSync(LOGOS) ? readdirSync(LOGOS).filter((f) => f.endsWith(".png")).length : 0;

  return {
    generated_at: new Date().toISOString(),
    sec_data: {
      cat1_us: {
        target: cat1Target,
        downloaded: cat1Tickers.size,
        coverage_pct: cat1Target > 0 ? Math.round((cat1Tickers.size * 100) / cat1Target) : 0,
      },
      cat2_adr: {
        target: cat2Target,
        downloaded: cat2Tickers.size,
        coverage_pct: cat2Target > 0 ? Math.round((cat2Tickers.size * 100) / cat2Target) : 0,
      },
      cat3_eu: {
        target: cat3Target,
        downloaded: cat3Tickers.size,
        coverage_pct: cat3Target > 0 ? Math.round((cat3Tickers.size * 100) / cat3Target) : 0,
      },
    },
    pipeline: {
      total,
      pass1: p1,
      pass2: p2,
      pass3: p3,
      pass3_sonnet: p3sonnet,
      pass3_haiku: p3haiku,
      pass3_other: p3other,
    },
    v17_audit: {
      total_searchable: v17Total,
      missing,
    },
    llm_credits,
    searchable_count: v17Total,
    logos_count: logosCount,
  };
}

export const BLOCK_LABELS: Record<string, string> = {
  MISSING_LOGO: "Logo société",
  MISSING_RANKS: "Rangs (mondial / USA / secteur)",
  MISSING_RISKS: "Facteurs de risque",
  MISSING_GOVERNANCE: "Gouvernance & rémunération",
  MISSING_AI_POSITIONING: "Positionnement IA",
  MISSING_MARKET_POSITIONS: "Taille de marché (TAM)",
  MISSING_EVENTS: "Faits saillants récents",
  MISSING_SEGMENTS: "Répartition par segment",
  MISSING_GEOGRAPHY: "Répartition géographique",
};
