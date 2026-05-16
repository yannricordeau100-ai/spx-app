import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * GET /api/popular-stocks
 *
 * Renvoie le JSON `src/data/popular-stocks-by-language.json` enrichi :
 * - displayTicker (sans suffixe place boursière)
 * - name officiel depuis v2-pipeline merged (cohérence fiche société)
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

function stripExchangeSuffix(ticker: string): string {
  const up = ticker.toUpperCase();
  for (const suf of EXCHANGE_SUFFIXES) {
    if (up.endsWith(suf)) return up.slice(0, -suf.length);
  }
  return up;
}

const CROSS_POLLUTION_BLOCKLIST = new Set([
  "DG.PA", "SIE.DE", "VOD.L", "BCP.LS", "NG.L", "RMS.PA",
  "ATEYY", "ADTTF", "BP", "BPAQF", "BBVA.MC",
]);

function loadOfficialNames(): Record<string, string> {
  try {
    const p = path.join(process.cwd(), "src/data/v2-pipeline/_merged.json");
    const m = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, { name?: string }>;
    const out: Record<string, string> = {};
    for (const [t, v] of Object.entries(m)) {
      if (v && typeof v === "object" && typeof v.name === "string") {
        out[t.toUpperCase()] = v.name;
      }
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
    const officialNames = loadOfficialNames();

    for (const region of Object.keys(raw)) {
      if (region.startsWith("_")) continue;
      const rows = raw[region];
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Record<string, unknown>[]) {
        const t = String(row.ticker || "").toUpperCase();
        row.displayTicker = stripExchangeSuffix(String(row.ticker || ""));
        if (!CROSS_POLLUTION_BLOCKLIST.has(t)) {
          const off = officialNames[t];
          if (off && typeof off === "string" && off.trim().length > 0) {
            row.name = off;
          }
        }
      }
    }
    return NextResponse.json(raw);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
