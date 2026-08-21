import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiQualityStrategyClient } from "./client";
import KPI_GENERIC_LIBRARY from "@/data/kpi-generic-library.json";
import CLEAN_ALL from "@/data/v1-9-5-clean-all-tickers.json";
import V19_UNIVERSE from "@/data/v1-9-universe.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KPI Quality Strategy · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/kpi-quality-strategy — REWORK Yann 21 août 2026.
 *
 * 1. LISTE DES STÉS : uniquement les stés présentes sur l'app
 *    (`src/data/v1-9-5-clean-all-tickers.json`, liste canonique V1.9.5)
 *    ET appartenant à au moins un des 5 univers SP500 / CAC 40 / DAX 40 /
 *    SMI / SOXX. Les stés de l'app hors de ces univers (ex AEX seules,
 *    FTSE, TSX) sont EXCLUES de la page.
 *
 *    Sources des listes d'appartenance :
 *    - SP500, CAC 40, DAX 40, SMI : `src/data/v1-9-universe.json`
 *      (champ `sources` par ticker : "sp500" 503, "cac40" 40, "dax40" 40,
 *      "smi" 20 — fichier univers construit par scripts/build-v1-9-universe.ts).
 *    - SOXX : constante SOXX_TICKERS ci-dessous, copie de
 *      `.conv-state/sox30-state.json` champ `univers_30` (chaîne sox30,
 *      composition sept-2024 + ARM − WOLF, vérifiée le 6 août 2026).
 *      Inlinée car `.conv-state/` n'est pas déployé.
 *
 * 2. TRI : par défaut capitalisation boursière décroissante. Aucun fichier
 *    local fiable de market caps dans src/data/ → fallback documenté :
 *    ordre du tableau `ordre` de `.conv-state/att-state.json` (déjà trié
 *    par capi décroissante, 656 tickers), lu via fs sans appel réseau.
 *    Si le fichier est absent (prod Vercel), fallback ordre alphabétique.
 *    Toggle capi/alpha côté client.
 *
 * 3. FILTRES : Toutes | SP500 | CAC | DAX | SMI | SOXX (une sté peut
 *    appartenir à plusieurs univers).
 *
 * 4. HERO KPI : colonne <select> par sté. Valeur initiale = snapshot
 *    `companies/<t>.json` (fallback `v2-pipeline/<t>.json`), corrigée au
 *    mount par les overrides Supabase (couche gagnante) via
 *    GET /api/desk/hero. Options chargées à la demande (KPI réels via
 *    loadV17Company). Changement → POST /api/desk/hero.
 */

// SOXX (iShares Semiconductor ETF) — copie de .conv-state/sox30-state.json
// `univers_30` (chaîne sox30, 6 août 2026) : liste sept-2024 + ARM − WOLF.
const SOXX_TICKERS = [
  "AMD", "ALGM", "AMKR", "ADI", "AMAT", "ASML", "ACLS", "AVGO", "COHR",
  "ENTG", "GFS", "INTC", "KLAC", "LRCX", "LSCC", "MRVL", "MCHP", "MU",
  "MPWR", "NVDA", "NXPI", "ON", "QRVO", "QCOM", "RMBS", "SWKS", "TSM",
  "TER", "TXN", "ARM",
];

// Alias univers → ticker canonique app (piège connu : alias canoniques).
const UNIVERSE_ALIASES: Record<string, string> = {
  "BRK.B": "BRK-B",
};

export type UniverseKey = "sp500" | "cac40" | "dax40" | "smi" | "soxx";

export type SteRow = {
  ticker: string;
  name: string;
  sector: string;
  universes: UniverseKey[];
  hero: string;
  /** Rang capi (0 = plus grosse capi). Number.MAX_SAFE_INTEGER si inconnu. */
  capRank: number;
};

export type GenericKpiEntry = {
  short: string;
  name_fr: string;
  name_en: string;
  family: string;
  rationale_fr: string;
  rationale_en: string;
};

type UniverseEntry = { ticker: string; name?: string; sources?: string[] };

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildRows(): Promise<{ rows: SteRow[]; capsSource: "att-state" | "alpha" }> {
  const ROOT = process.cwd();
  const clean = new Set(
    ((CLEAN_ALL as { tickers?: string[] }).tickers ?? []).map((t) => t.toUpperCase()),
  );

  // Appartenance aux 4 univers indexés (v1-9-universe.json) + SOXX.
  const membership = new Map<string, Set<UniverseKey>>();
  const universeNames = new Map<string, string>();
  const addMember = (ticker: string, u: UniverseKey) => {
    const t = UNIVERSE_ALIASES[ticker] ?? ticker;
    if (!membership.has(t)) membership.set(t, new Set());
    membership.get(t)!.add(u);
  };
  for (const e of V19_UNIVERSE as UniverseEntry[]) {
    const t = (UNIVERSE_ALIASES[e.ticker.toUpperCase()] ?? e.ticker.toUpperCase());
    if (e.name) universeNames.set(t, e.name);
    for (const s of e.sources ?? []) {
      if (s === "sp500" || s === "cac40" || s === "dax40" || s === "smi") {
        addMember(e.ticker.toUpperCase(), s);
      }
    }
  }
  for (const t of SOXX_TICKERS) addMember(t, "soxx");

  // Univers page = app ∩ (SP500 ∪ CAC40 ∪ DAX40 ∪ SMI ∪ SOXX).
  const kept = [...membership.keys()].filter((t) => clean.has(t)).sort();

  // Rang capi : ordre de .conv-state/att-state.json (trié capi décroissante).
  let capsSource: "att-state" | "alpha" = "alpha";
  const capRank = new Map<string, number>();
  const attState = await readJson(path.join(ROOT, ".conv-state/att-state.json"));
  const ordre = Array.isArray(attState?.ordre) ? (attState.ordre as string[]) : null;
  if (ordre && ordre.length > 0) {
    capsSource = "att-state";
    ordre.forEach((t, i) => capRank.set(String(t).toUpperCase(), i));
  }

  const rows: SteRow[] = [];
  for (const t of kept) {
    const slug = t.toLowerCase();
    const snap =
      (await readJson(path.join(ROOT, "src/data/companies", `${slug}.json`))) ??
      (await readJson(path.join(ROOT, "src/data/v2-pipeline", `${slug}.json`)));
    rows.push({
      ticker: t,
      name:
        (typeof snap?.name === "string" && snap.name) ||
        universeNames.get(t) ||
        t,
      sector: typeof snap?.sector === "string" ? snap.sector : "",
      universes: [...(membership.get(t) ?? [])].sort() as UniverseKey[],
      hero: typeof snap?.hero_kpi === "string" ? snap.hero_kpi : "",
      capRank: capRank.get(t) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  return { rows, capsSource };
}

export default async function KpiQualityStrategyPage() {
  const { rows, capsSource } = await buildRows();
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour sandbox
        </Link>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          KPI Quality Strategy
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Pilotage du hero KPI des stés de l&apos;app appartenant aux univers{" "}
          <strong className="text-zinc-200">SP500, CAC 40, DAX 40, SMI, SOXX</strong>.
          Tri par capi décroissante (toggle alphabétique), filtres par univers,
          changement du hero KPI directement depuis la liste. Library des KPI
          génériques conservée en second onglet.
        </p>

        <KpiQualityStrategyClient
          rows={rows}
          capsSource={capsSource}
          generic={KPI_GENERIC_LIBRARY as unknown as GenericKpiEntry[]}
        />
      </div>
    </div>
  );
}
