#!/usr/bin/env tsx
/**
 * enrich-peers.ts — calcule la liste des sociétés "comparables" (peers)
 * pour chaque sé V1.7 Pass 3 strict.
 *
 * Pas d'appel LLM ni réseau : algorithme local sur le dataset existant.
 *
 * Stratégie :
 *   1. Pour chaque sé, prendre le sub-sector. Trouver toutes les autres
 *      sés du même sub-sector dans le pipeline.
 *   2. Trier par similarité market_cap (si disponible via .ranks ou
 *      enrich.financial_snapshot.market_cap_usd) → top 5 plus proches.
 *   3. Si <3 peers même sub-sector, élargir au sector.
 *   4. Sortie : `v2-pipeline-enrich/<ticker>.json` champ `peers: [...]`
 *      avec format `{ ticker, name, sector, subsector, market_cap_usd? }`.
 *
 * Pourquoi : le composant Compare panel a besoin d'une liste de sés à
 * proposer en suggestion. Sans peers calculés, il dépend uniquement des
 * suggestions hardcodées dans `src/lib/compare.ts` (V1.0 only).
 *
 * Usage : npx tsx scripts/enrich-peers.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const V17 = path.join(ROOT, "src/data/v1-7-public.json");
const ENR = path.join(ROOT, "src/data/v2-pipeline-enrich");
const PIPELINE = path.join(ROOT, "src/data/v2-pipeline");

type AnyRec = Record<string, unknown>;
type SeInfo = {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  market_cap_usd: number | null;
};

function safeJson<T>(p: string): T | null {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function loadEnrichSnapshot(ticker: string): { market_cap_usd?: number } | null {
  const p = path.join(ENR, `${ticker.toLowerCase()}.json`);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, "utf-8")) as AnyRec;
    const snap = data.financial_snapshot as { market_cap_usd?: number } | undefined;
    return snap ?? null;
  } catch {
    return null;
  }
}

const v17 = safeJson<Record<string, AnyRec>>(V17);
if (!v17) {
  console.error(`❌ ${V17} introuvable`);
  process.exit(1);
}

// V1.0 stés handcrafted (pas dans v2-pipeline ni v1-7-public). On les
// charge depuis src/data/<file>.json pour qu'elles aient aussi leurs
// peers calculés (Yann 8 mai 2026 audit : V1.0 manquait peers).
const V1_FILES: Record<string, string> = {
  GOOGL: "google",
  META: "meta",
  MSCI: "msci",
  SPGI: "spgi",
  CAT: "cat",
};
for (const [ticker, file] of Object.entries(V1_FILES)) {
  if (v17[ticker]) continue; // déjà présent via V1.7 strict
  try {
    const d = JSON.parse(readFileSync(path.join(ROOT, "src/data", `${file}.json`), "utf-8")) as AnyRec;
    v17[ticker] = d;
  } catch {
    // skip si fichier absent
  }
}

// 1. Build full registry of (ticker, sector, subsector, market_cap)
const registry: SeInfo[] = [];
for (const [ticker, e] of Object.entries(v17)) {
  if (!e || typeof e !== "object") continue;
  const sector = String(e.sector ?? "").trim();
  const subsector = String(e.subsector ?? "").trim();
  if (!sector && !subsector) continue;

  const snap = loadEnrichSnapshot(ticker);
  registry.push({
    ticker,
    name: String(e.name ?? ticker),
    sector,
    subsector,
    market_cap_usd: typeof snap?.market_cap_usd === "number" ? snap.market_cap_usd : null,
  });
}

console.log(`📊 ${registry.length} sés en registry`);

// 2. Compute peers for each sé
let written = 0;
const PEERS_TARGET = 5;
const PEERS_MIN = 2; // n'écrit le bloc que si au moins 2 vrais pairs sub-sector

// Mapping de normalisation : noms de sub-sector quasi-équivalents → clé canonique.
// Yann (10 mai 2026) : Apple ne doit JAMAIS apparaître comme peer de Google.
// Le bug venait du fallback "même sector" qui mélangeait IT / Comm Services.
// Désormais : match STRICT par sub-sector normalisé, pas de fallback sector.
const SUBSECTOR_ALIASES: Record<string, string> = {
  // Internet & ad-tech (GOOGL, META, etc.) — forme canonique GICS sub-industry
  "internet services": "interactive media & services",
  "internet services & digital advertising": "interactive media & services",
  "internet & digital advertising": "interactive media & services",
  "internet & search": "interactive media & services",
  "social media & messaging": "interactive media & services",
  "social media": "interactive media & services",
  "interactive media": "interactive media & services",
  "interactive media & services": "interactive media & services",
  // Semis (NVDA, AVGO, AMD, etc.)
  "semiconductors": "semiconductors",
  "semiconductors & software": "semiconductors",
  "semiconductors & semiconductor equipment": "semiconductors",
  // Software (MSFT, ORCL, ADBE, etc.)
  "software & services": "systems software",
  "systems software": "systems software",
  "application software": "application software",
  // Tech hardware (AAPL, HPE, DELL)
  "technology hardware & equipment": "technology hardware, storage & peripherals",
  "technology hardware, storage & peripherals": "technology hardware, storage & peripherals",
};

function normalizeSubsector(s: string): string {
  const k = s.trim().toLowerCase();
  return SUBSECTOR_ALIASES[k] ?? k;
}

// Dédup par "famille" de ticker pour éviter GOOG/GOOGL, BRK.A/BRK.B,
// FOX/FOXA, NWS/NWSA, etc. comme pairs distincts.
function tickerFamily(t: string): string {
  const u = t.toUpperCase();
  // Alphabet
  if (u === "GOOG" || u === "GOOGL") return "ALPHABET";
  // Berkshire
  if (u === "BRK.A" || u === "BRK.B" || u === "BRK-A" || u === "BRK-B") return "BERKSHIRE";
  // Fox / News Corp
  if (u === "FOX" || u === "FOXA") return "FOX";
  if (u === "NWS" || u === "NWSA") return "NEWSCORP";
  // Under Armour
  if (u === "UA" || u === "UAA") return "UNDERARMOUR";
  // ADR / local share twins (Same company listed both as US ADR and on home exchange)
  if (u === "ASML" || u === "ASMLF") return "ASML";
  if (u === "RY" || u === "RY.TO") return "RY";
  if (u === "TD" || u === "TD.TO") return "TD";
  if (u === "SHOP" || u === "SHOP.TO") return "SHOP";
  if (u === "TM" || u === "7203.T") return "TOYOTA";
  if (u === "SONY" || u === "6758.T") return "SONY";
  return u;
}

for (const focal of registry) {
  const focalSub = normalizeSubsector(focal.subsector);
  if (!focalSub) continue;
  const focalFamily = tickerFamily(focal.ticker);

  // STRICT : même sub-sector normalisé seulement, jamais fallback sector.
  const seen = new Set<string>([focalFamily]);
  const candidates = registry.filter((r) => {
    if (r.ticker === focal.ticker) return false;
    if (!r.subsector) return false;
    if (normalizeSubsector(r.subsector) !== focalSub) return false;
    const fam = tickerFamily(r.ticker);
    if (seen.has(fam)) return false;
    seen.add(fam);
    return true;
  });
  if (candidates.length < PEERS_MIN) {
    // Pas assez de vrais pairs : on supprime tout peers pré-existant (legacy
    // bug : Apple peer de Google, etc.). Bloc UI se masque proprement.
    const outPath = path.join(ENR, `${focal.ticker.toLowerCase()}.json`);
    if (existsSync(outPath)) {
      try {
        const ex = JSON.parse(readFileSync(outPath, "utf-8")) as AnyRec;
        if (ex.peers) {
          delete ex.peers;
          delete ex._peers_computed_at;
          writeFileSync(outPath, JSON.stringify(ex, null, 2));
        }
      } catch {
        // ignore
      }
    }
    continue;
  }

  // Sort by market_cap proximity to focal (ratio close to 1 = best peer)
  const focalMc = focal.market_cap_usd ?? 0;
  candidates.sort((a, b) => {
    if (focalMc <= 0) {
      // Pas de focal MC : trier par MC desc (les plus connues d'abord)
      return (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0);
    }
    const aRatio = a.market_cap_usd ? Math.abs(Math.log(a.market_cap_usd / focalMc)) : 9;
    const bRatio = b.market_cap_usd ? Math.abs(Math.log(b.market_cap_usd / focalMc)) : 9;
    return aRatio - bRatio;
  });

  const peers = candidates.slice(0, PEERS_TARGET).map((p) => ({
    ticker: p.ticker,
    name: p.name,
    sector: p.sector,
    subsector: p.subsector,
    market_cap_usd: p.market_cap_usd,
  }));

  // Merge dans le fichier enrich
  const outPath = path.join(ENR, `${focal.ticker.toLowerCase()}.json`);
  let existing: AnyRec = {};
  if (existsSync(outPath)) {
    try {
      existing = JSON.parse(readFileSync(outPath, "utf-8")) as AnyRec;
    } catch {
      existing = {};
    }
  }
  existing.ticker = focal.ticker;
  existing.peers = peers;
  existing._peers_computed_at = new Date().toISOString();
  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  written++;
}

console.log(`✅ ${written} sés ont leur liste de peers (top ${PEERS_TARGET}) écrite`);
