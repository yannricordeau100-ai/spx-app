import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { LogosCompareClient, type LogoEntry } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Logos compare avant/apres Logo.dev · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

/**
 * Page comparaison logos avant/apres Logo.dev pour validation visuelle Yann
 * (Yann 3 juin 2026). Affiche cote-a-cote : (a) ancien logo backup (Logo.dev
 * pre-fetch sinon Parqet), (b) nouveau logo Logo.dev post-fetch.
 *
 * Univers : 652 tickers V1.9.5 curated + 35 manquants SP500 union Top 307 V1.8
 * (cf RULES-GOLDEN §0undecies = 673 stes systemiques).
 *
 * Calcul cote serveur : presence + taille fichier pour tagger OK/small/missing.
 * Cote client : <img> avec onError fallback.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");
const LOGOS_DIR = path.join(PUBLIC_DIR, "logos");
const BACKUP_LOGODEV = path.join(LOGOS_DIR, ".backup-logodev");
const BACKUP_PARQET = path.join(LOGOS_DIR, ".backup-parqet");

const SMALL_THRESHOLD = 5 * 1024; // 5 KB

// 35 tickers du 673 SP500 union Top 307 V1.8 absents de v1-9-5-clean-all-tickers.json
// (cf RULES-GOLDEN.md §0undecies, liste explicite Yann 2 juin 2026).
const EXTRA_35: string[] = [
  "ODFL",
  "ROL",
  "ROP",
  "CB",
  "CPAY",
  "CASY",
  "EXE",
  "PPL",
  "MRK.DE",
  "REL.L",
  "RI.PA",
  "ABF.L",
  "AMUN.PA",
  "AV.L",
  "BBVA.MC",
  "BCP.LS",
  "BVI.PA",
  "CA.PA",
  "CNA.L",
  "DANSKE.CO",
  "EIPAF",
  "HEXA-B.ST",
  "HLN.L",
  "JDEP.AS",
  "KESKOB.HE",
  "MAERSK-B.CO",
  "MELI",
  "NDA-FI.HE",
  "NESTE.HE",
  "ORSTED.CO",
  "PRY.MI",
  "RACE",
  "SAMPO.HE",
  "SHEL.L",
  "ULVR.L",
];

function safeName(ticker: string): string {
  // Convention public/logos : tickers avec . ou / sont gardes tels quels.
  // Ex: NESN.SW.png, BRK.B.png, 005930-KS.png.
  return ticker;
}

function readEntry(ticker: string): LogoEntry {
  const name = safeName(ticker);
  const current = path.join(LOGOS_DIR, `${name}.png`);
  const backupLogodev = path.join(BACKUP_LOGODEV, `${name}.png`);
  const backupParqet = path.join(BACKUP_PARQET, `${name}.png`);

  let currentSize = 0;
  let currentExists = false;
  try {
    if (existsSync(current)) {
      currentSize = statSync(current).size;
      currentExists = true;
    }
  } catch {
    /* ignore */
  }

  let backupKind: "logodev" | "parqet" | "none" = "none";
  try {
    if (existsSync(backupLogodev)) backupKind = "logodev";
    else if (existsSync(backupParqet)) backupKind = "parqet";
  } catch {
    /* ignore */
  }

  let status: "ok" | "small" | "missing" = "missing";
  if (currentExists) {
    status = currentSize >= SMALL_THRESHOLD ? "ok" : "small";
  }

  return {
    ticker,
    nameSafe: name,
    currentExists,
    currentSize,
    backupKind,
    status,
  };
}

export default function LogosComparePage() {
  // Univers : 652 + 35 = 687 stes uniques.
  let baseTickers: string[] = [];
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as { tickers: string[] };
    baseTickers = parsed.tickers ?? [];
  } catch {
    baseTickers = [];
  }

  const set = new Set<string>(baseTickers);
  for (const t of EXTRA_35) set.add(t);
  const allTickers = Array.from(set);

  const entries: LogoEntry[] = allTickers
    .map((t) => readEntry(t))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  const okCount = entries.filter((e) => e.status === "ok").length;
  const smallCount = entries.filter((e) => e.status === "small").length;
  const missingCount = entries.filter((e) => e.status === "missing").length;

  return (
    <LogosCompareClient
      entries={entries}
      okCount={okCount}
      smallCount={smallCount}
      missingCount={missingCount}
    />
  );
}
