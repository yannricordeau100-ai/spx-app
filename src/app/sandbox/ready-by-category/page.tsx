import path from "node:path";
import fs from "node:fs";
import { ReadyByCategoryClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ready by Category · Mettrik AI",
  robots: { index: false, follow: false },
};

type AnyCo = Record<string, unknown>;

/** Une sté est "complètement prête" si :
 *  - _fit_for_site != false
 *  - _validation OR _validation_global (Pass 3 LLM passé)
 *  - hero_kpi non vide + au moins 5 KPIs avec value non null
 *  - governance.ceo_name présent OU bloc gov non requis (cat 3 EU pures ok)
 *  - risks length >= 3
 *  - ai_positioning.stance présent
 *
 * Cf. quality-tree.ts pour la liste complète des critères.
 */
function isReady(d: AnyCo): boolean {
  if (d._fit_for_site === false) return false;
  if (!d._validation && !d._validation_global) return false;
  const kpis = Array.isArray(d.kpis) ? (d.kpis as AnyCo[]) : [];
  const validKpis = kpis.filter((k) => k.value !== null && k.value !== "" && k.value !== undefined);
  if (validKpis.length < 5) return false;
  if (!d.hero_kpi) return false;
  const risks = Array.isArray(d.risks) ? d.risks : [];
  if (risks.length < 3) return false;
  const gov = (d.governance as AnyCo | null | undefined) ?? null;
  if (!gov || !gov.ceo_name) {
    // Tolérance cat 3 EU pures (pas de DEF14A) — gov absent acceptable
    // si l'enrichissement a marqué _governance_unavailable.
    if (!d._governance_unavailable) return false;
  }
  const ai = (d.ai_positioning as AnyCo | null | undefined) ?? null;
  if (!ai || !ai.stance) return false;
  return true;
}

type Row = {
  ticker: string;
  name: string;
  country: string;
  sector: string;
  isReady: boolean;
  isAdrDuplicate: boolean;
};

function loadAll(): Row[] {
  const root = process.cwd();
  const merged = JSON.parse(fs.readFileSync(path.join(root, "src/data/v2-pipeline/_merged.json"), "utf-8")) as Record<string, AnyCo>;

  // Optional breakdown for country / market cap (top 307 only)
  let breakdownByTicker: Record<string, AnyCo> = {};
  try {
    const bd = JSON.parse(fs.readFileSync(path.join(root, "src/data/top307-breakdown.json"), "utf-8"));
    if (Array.isArray(bd)) {
      for (const b of bd) {
        if (b && b.ticker) breakdownByTicker[String(b.ticker).toUpperCase()] = b;
      }
    }
  } catch {}

  const rows: Row[] = [];
  for (const [tk, d] of Object.entries(merged)) {
    if (!d || typeof d !== "object") continue;
    const bd = breakdownByTicker[tk.toUpperCase()] ?? {};
    rows.push({
      ticker: tk.toUpperCase(),
      name: String(d.name ?? tk),
      country: String(d.country ?? bd.country ?? ""),
      sector: String(d.sector ?? bd.sector ?? ""),
      isReady: isReady(d),
      isAdrDuplicate: typeof (d as AnyCo)._adr_duplicate_of === "string",
    });
  }
  return rows;
}

function loadSp500(): Set<string> {
  try {
    const sp = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/sp500-tickers.json"), "utf-8"));
    return new Set((sp as string[]).map((t) => t.toUpperCase()));
  } catch {
    return new Set();
  }
}

function loadTop307(): Set<string> {
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/v1-8-tickers-sorted.json"), "utf-8")) as string[];
    return new Set(arr.slice(0, 307).map((t) => t.toUpperCase()));
  } catch {
    return new Set();
  }
}

// Stoxx 600 EU pure approximation : ticker contient un point ET la sté
// a un dossier sec-data/cat3-european. Approximation OK pour l'aperçu.
function loadStoxx600(rows: Row[]): Set<string> {
  return new Set(
    rows
      .filter((r) => r.ticker.includes(".") && !["BRK.B", "BRK.A", "BF.B"].includes(r.ticker))
      .map((r) => r.ticker),
  );
}

// SMI Suisse = ticker se termine en .SW (Six Swiss Exchange).
function loadSmi(rows: Row[]): Set<string> {
  return new Set(rows.filter((r) => r.ticker.endsWith(".SW")).map((r) => r.ticker));
}

// Cat 2 ADR top 50 = stés FPI ADR US (ticker sans dot, country != US).
// Approximation : on ne dispose pas d'une liste canonique pour le moment.
function loadCat2Adr(rows: Row[]): Set<string> {
  return new Set(
    rows
      .filter((r) => !r.ticker.includes(".") && r.country && r.country !== "United States" && r.country !== "")
      .map((r) => r.ticker),
  );
}

export default async function ReadyByCategoryPage() {
  const rows = loadAll();
  const sp500 = loadSp500();
  const top307 = loadTop307();
  const stoxx600 = loadStoxx600(rows);
  const smi = loadSmi(rows);
  const cat2Adr = loadCat2Adr(rows);

  type CatStat = { name: string; total: number; ready: number; pct: number };
  const catRows: { id: string; pred: (r: Row) => boolean }[] = [
    { id: "Top 307 V1.8", pred: (r) => top307.has(r.ticker) },
    { id: "SP500", pred: (r) => sp500.has(r.ticker) },
    { id: "SP1500", pred: (r) => sp500.has(r.ticker) || (!r.ticker.includes(".") && r.country === "United States") },
    { id: "Stoxx 600 (EU pures)", pred: (r) => stoxx600.has(r.ticker) },
    { id: "SMI Suisse (.SW)", pred: (r) => smi.has(r.ticker) },
    { id: "Cat 2 ADR (FPI US)", pred: (r) => cat2Adr.has(r.ticker) },
    { id: "TOTAL Mettrik", pred: () => true },
  ];

  const catStats: CatStat[] = catRows.map(({ id, pred }) => {
    const subset = rows.filter((r) => pred(r) && !r.isAdrDuplicate);
    const ready = subset.filter((r) => r.isReady).length;
    return {
      name: id,
      total: subset.length,
      ready,
      pct: subset.length > 0 ? Math.round((100 * ready) / subset.length) : 0,
    };
  });

  // By country (descending by ready count)
  const byCountry = new Map<string, { ready: number; total: number }>();
  for (const r of rows) {
    if (r.isAdrDuplicate) continue;
    const c = r.country || "(non renseigné)";
    const cur = byCountry.get(c) ?? { ready: 0, total: 0 };
    cur.total += 1;
    if (r.isReady) cur.ready += 1;
    byCountry.set(c, cur);
  }
  const countryRows = [...byCountry.entries()]
    .map(([country, s]) => ({ country, ready: s.ready, total: s.total, pct: s.total > 0 ? Math.round((100 * s.ready) / s.total) : 0 }))
    .sort((a, b) => b.ready - a.ready || b.total - a.total);

  const adrDuplicates = rows.filter((r) => r.isAdrDuplicate).map((r) => r.ticker);

  return (
    <ReadyByCategoryClient
      categories={catStats}
      countries={countryRows}
      adrDuplicates={adrDuplicates}
    />
  );
}
