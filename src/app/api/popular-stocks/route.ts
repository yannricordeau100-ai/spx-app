import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { rate } from "@/lib/brand";
import type { KPI } from "@/lib/data";

/**
 * GET /api/popular-stocks
 *
 * Renvoie le JSON `src/data/popular-stocks-by-language.json` enrichi :
 * - displayTicker (sans suffixe place boursière)
 * - name officiel depuis v2-pipeline merged (cohérence fiche société)
 * - hero_yoy + hero_short + tier (Yann 18 mai 2026, PV Mettrik)
 *
 * Utilisé par <HomePopularBlock /> sur la home V175/V18.
 */
export const dynamic = "force-static";
export const revalidate = 3600; // 1 h cache

const EXCHANGE_SUFFIXES = [
  ".SW", ".PA", ".L", ".DE", ".AS", ".ST", ".CO", ".MI", ".MC",
  ".HE", ".OL", ".T", ".HK", ".TO", ".AX", ".BR", ".LS", ".VI",
  ".IR", ".SS",
];

/** Tickers gardent leur suffixe pour éviter conflits homonymes
 *  cross-marché (CFR.SW Richemont vs CFR US Cullen/Frost Bankers,
 *  ROG.SW Roche vs ROG US Rogers Corp). */
const PRESERVE_SUFFIX = new Set(["CFR.SW", "ROG.SW"]);

function stripExchangeSuffix(ticker: string): string {
  const up = ticker.toUpperCase();
  if (PRESERVE_SUFFIX.has(up)) return up;
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) return up.slice(0, -suf.length);
  }
  return up;
}

const CROSS_POLLUTION_BLOCKLIST = new Set([
  "DG.PA", "SIE.DE", "VOD.L", "BCP.LS", "NG.L", "RMS.PA",
  "ATEYY", "ADTTF", "BP", "BPAQF", "BBVA.MC",
]);

type MergedEntry = { name?: string; hero_kpi?: string; kpis?: KPI[] };
type EnrichInfo = {
  name?: string;
  hero_short?: string;
  hero_yoy?: string;
  tier?: "excellent" | "bon" | "moyen" | "faible";
};
function loadEnrichments(): Record<string, EnrichInfo> {
  try {
    const p = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
    const m = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, MergedEntry>;
    const out: Record<string, EnrichInfo> = {};
    for (const [t, v] of Object.entries(m)) {
      if (!v || typeof v !== "object") continue;
      const info: EnrichInfo = {};
      if (typeof v.name === "string") info.name = v.name;
      const kpis = Array.isArray(v.kpis) ? v.kpis : [];
      const hero = v.hero_kpi
        ? kpis.find((k) => k && k.short === v.hero_kpi) ?? kpis[0]
        : kpis[0];
      if (hero) {
        info.hero_short = hero.short;
        if (typeof hero.yoy === "string" && hero.yoy.trim()) {
          info.hero_yoy = hero.yoy.trim();
        }
        try {
          info.tier = rate(hero).tier;
        } catch {
          // skip on KPI mal formé
        }
      }
      out[t.toUpperCase()] = info;
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "src/data/popular-stocks-by-language.json");
    const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as Record<string, unknown>;
    const enrich = loadEnrichments();

    for (const region of Object.keys(raw)) {
      if (region.startsWith("_")) continue;
      const rows = raw[region];
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Record<string, unknown>[]) {
        const t = String(row.ticker || "").toUpperCase();
        row.displayTicker = stripExchangeSuffix(String(row.ticker || ""));
        const info = enrich[t];
        if (info) {
          if (
            info.name &&
            !CROSS_POLLUTION_BLOCKLIST.has(t) &&
            info.name.trim().length > 0
          ) {
            row.name = info.name;
          }
          if (info.hero_short) row.hero_short = info.hero_short;
          if (info.hero_yoy) row.hero_yoy = info.hero_yoy;
          if (info.tier) row.tier = info.tier;
        }
      }
    }
    return NextResponse.json(raw);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
