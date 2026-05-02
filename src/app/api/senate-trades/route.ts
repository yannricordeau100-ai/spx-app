import { NextResponse } from "next/server";

/**
 * GET /api/senate-trades?ticker=META
 *
 * Source LIVE : Financial Modeling Prep `/stable/senate-trades?symbol=X`.
 * Free tier 250 calls/jour, ce qui couvre largement V1 (5 sociétés × 1
 * appel/jour, cache 12h server-side).
 *
 * Délai légal STOCK Act : 30-45 jours entre transaction et disclosure.
 * Le `filing_lag_days` est calculé à partir des 2 dates retournées par
 * FMP (transactionDate vs disclosureDate).
 */

const FMP_BASE = "https://financialmodelingprep.com/stable";

type FmpTx = {
  symbol: string;
  disclosureDate: string; // "2026-04-20"
  transactionDate: string; // "2026-04-15"
  firstName: string;
  lastName: string;
  office: string;
  district: string;
  owner: string;
  assetDescription: string;
  assetType: string;
  type: string; // "Purchase" | "Sale" | "Exchange" | etc.
  amount: string; // "$1,001 - $15,000"
  comment: string;
  link: string; // PTR PDF
};

type SenateTrade = {
  senator: string;
  party: "R" | "D" | "I";
  state: string;
  ticker: string;
  type: "Purchase" | "Sale" | "Exchange";
  amount_low: number;
  amount_high: number;
  date: string; // ISO transaction date
  disclosure_date: string; // ISO disclosure date
  filing_lag_days: number;
  ptr_link: string;
  asset_description: string;
};

function parseAmount(raw: string): [number, number] {
  const nums = (raw.match(/\$?[\d,]+/g) ?? []).map((s) =>
    parseInt(s.replace(/[^\d]/g, ""), 10)
  );
  if (nums.length >= 2) return [nums[0], nums[1]];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [0, 0];
}

function lagDays(txDate: string, discDate: string): number {
  try {
    const t = new Date(txDate).getTime();
    const d = new Date(discDate).getTime();
    if (isNaN(t) || isNaN(d)) return 0;
    return Math.max(0, Math.round((d - t) / 86_400_000));
  } catch {
    return 0;
  }
}

const PARTY: Record<string, "R" | "D" | "I"> = {
  // Sénateurs / représentants connus, à compléter au fil des données.
  // (FMP ne renvoie pas le parti, on infère depuis un dico statique.)
  "Mitch McConnell": "R", "John Cornyn": "R", "Lindsey Graham": "R",
  "Marco Rubio": "R", "Ted Cruz": "R", "Tommy Tuberville": "R",
  "Steve Daines": "R", "Bill Hagerty": "R", "Susan Collins": "R",
  "Roger Wicker": "R", "John Boozman": "R", "Shelley Moore Capito": "R",
  "Mike Crapo": "R", "Jerry Moran": "R", "Pat Toomey": "R",
  "Cynthia Lummis": "R", "Cynthia M Lummis": "R", "Markwayne Mullin": "R",
  "Sheldon Whitehouse": "D", "Tom Carper": "D", "Mark Warner": "D",
  "Mark R. Warner": "D", "Ron Wyden": "D", "Ron L Wyden": "D",
  "Jeanne Shaheen": "D", "Maria Cantwell": "D", "Patty Murray": "D",
  "Ed Markey": "D", "Tina Smith": "D", "Gary Peters": "D",
  "Tammy Duckworth": "D", "Catherine Cortez Masto": "D", "James E Hon Banks": "R",
  "Bernard Sanders": "I", "Angus King": "I", "Joseph Manchin": "I",
  "Joe Manchin": "I",
};

function inferParty(first: string, last: string): "R" | "D" | "I" {
  const full = `${first} ${last}`.trim();
  if (PARTY[full]) return PARTY[full];
  if (PARTY[last]) return PARTY[last];
  return "R"; // défaut, à fixer dans la table au fur et à mesure
}

// Cache 12h en mémoire (route handler stateful sur le runtime serveur).
const CACHE = new Map<string, { fetchedAt: number; data: SenateTrade[] }>();
const TTL_MS = 12 * 60 * 60 * 1000;

async function fetchFromFmp(ticker: string): Promise<SenateTrade[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) throw new Error("FMP_API_KEY missing");
  const url = `${FMP_BASE}/senate-trades?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`FMP ${r.status}`);
  const raw = (await r.json()) as FmpTx[];
  return raw
    .map((t): SenateTrade => {
      const [lo, hi] = parseAmount(t.amount);
      const tType: "Purchase" | "Sale" | "Exchange" = /sale/i.test(t.type)
        ? "Sale"
        : /exchange/i.test(t.type)
          ? "Exchange"
          : "Purchase";
      return {
        senator: `${t.firstName} ${t.lastName}`.trim(),
        party: inferParty(t.firstName, t.lastName),
        state: t.district || "—",
        ticker: t.symbol.toUpperCase(),
        type: tType,
        amount_low: lo,
        amount_high: hi,
        date: t.transactionDate,
        disclosure_date: t.disclosureDate,
        filing_lag_days: lagDays(t.transactionDate, t.disclosureDate),
        ptr_link: t.link,
        asset_description: t.assetDescription,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "missing ticker param" }, { status: 400 });
  }

  // Hit cache si frais
  const cached = CACHE.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return NextResponse.json(
      { trades: cached.data, source: "FMP /stable/senate-trades", cached: true },
      { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } }
    );
  }

  try {
    const trades = await fetchFromFmp(ticker);
    CACHE.set(ticker, { fetchedAt: Date.now(), data: trades });
    return NextResponse.json(
      {
        trades,
        source: "FMP /stable/senate-trades",
        legal_delay_note:
          "Délai légal STOCK Act 2012 : les sénateurs et représentants ont 30 à 45 jours après une transaction pour la déclarer. Les transactions affichées sont par construction antérieures d'au moins ~30 jours.",
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } }
    );
  } catch (e) {
    if (cached) {
      // fallback stale cache
      return NextResponse.json(
        { trades: cached.data, source: "FMP /stable/senate-trades", cached: true, stale: true },
        { headers: { "Cache-Control": "public, s-maxage=300" } }
      );
    }
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
