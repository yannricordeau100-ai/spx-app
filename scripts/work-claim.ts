#!/usr/bin/env tsx
/**
 * work-claim.ts — coordination entre les 4 convs Mettrik (CONV-CONCEPTS,
 * SYSTEMS, DATA, BRAND) pour éviter qu'elles touchent la MÊME sté en même
 * temps sur la MÊME action.
 *
 * Yann le 7 mai 2026 : "ajoute un script qui poste auto dans SHARED-STATUS
 * quand une conv commence à toucher une sté et la libère après. Pas oubli
 * humain."
 *
 * Stockage : section `## 🔒 ACTIVE CLAIMS` dans `SHARED-STATUS.md` à la
 * racine du projet. Les claims y sont écrits sous forme de tableau
 * markdown. Lock fichier `.work-claims.lock` pour éviter les écritures
 * concurrentes (les 4 convs peuvent appeler ce script simultanément).
 *
 * Commandes :
 *
 *   claim <conv> <action> <tickers...>
 *     Réserve 1+ tickers pour une conv et une action donnée. Retourne 1
 *     (et output JSON) si conflit avec un autre claim actif. Sinon ajoute
 *     l'entrée dans la section ACTIVE CLAIMS de SHARED-STATUS.
 *
 *   release <conv> <tickers...>
 *     Libère 1+ tickers de cette conv. Si la conv n'a pas le claim
 *     (timeout, crash), no-op.
 *
 *   list [--conv X] [--ticker T]
 *     Liste les claims actifs (filtres optionnels).
 *
 *   prune [--max-age-min N]
 *     Supprime les claims plus vieux que N min (default 60). Utile si
 *     une conv a crashé sans release.
 *
 * Format claim line :
 *   | <conv> | <ticker> | <action> | <started_at_iso> | <pid_hint?> |
 *
 * Conv accepted : CONCEPTS | SYSTEMS | DATA | BRAND (case-insensitive).
 * Action examples : "risks", "governance", "ai_positioning", "segments",
 * "geography", "tam", "logo", "ranks", "events", "kpi-extract", etc.
 *
 * Usage typique côté script enricher Python :
 *
 *   ticker=AAPL
 *   pid=$$
 *   if ! npx tsx scripts/work-claim.ts claim SYSTEMS risks $ticker --pid=$pid; then
 *     echo "AAPL/risks déjà claim ailleurs, skip"
 *     exit 0
 *   fi
 *   trap "npx tsx scripts/work-claim.ts release SYSTEMS $ticker" EXIT
 *   ...travail...
 */
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const STATUS_PATH = path.join(ROOT, "SHARED-STATUS.md");
const LOCK_PATH = path.join(ROOT, ".work-claims.lock");
const SECTION_HEADER = "## 🔒 ACTIVE CLAIMS";
const TABLE_HEADER = "| Conv | Ticker | Action | Started (ISO) | PID hint |";
const TABLE_SEP = "|---|---|---|---|---|";
const VALID_CONVS = new Set(["CONCEPTS", "SYSTEMS", "DATA", "BRAND"]);

type Claim = {
  conv: string;
  ticker: string;
  action: string;
  startedAt: string; // ISO
  pid?: string;
};

/* ─── Lock fichier-based (sysadmin-safe pour 4 convs) ─────────────── */
async function withLock<T>(fn: () => Promise<T> | T, maxWaitMs = 8000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const fd = openSync(LOCK_PATH, "wx"); // exclusive create
      try {
        return await fn();
      } finally {
        closeSync(fd);
        try { unlinkSync(LOCK_PATH); } catch { /* ignore */ }
      }
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("work-claim: lock timeout (8s)");
}

/* ─── Parse / serialize SHARED-STATUS ACTIVE CLAIMS section ──────── */
function readClaims(): { claims: Claim[]; sectionStart: number; sectionEnd: number; src: string } {
  if (!existsSync(STATUS_PATH)) {
    return { claims: [], sectionStart: -1, sectionEnd: -1, src: "" };
  }
  const src = readFileSync(STATUS_PATH, "utf-8");
  const lines = src.split("\n");
  const start = lines.findIndex((l) => l.trim() === SECTION_HEADER);
  if (start === -1) return { claims: [], sectionStart: -1, sectionEnd: -1, src };

  // Section ends at next "## " or EOF
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ") && lines[i].trim() !== SECTION_HEADER) {
      end = i;
      break;
    }
  }

  const claims: Claim[] = [];
  for (let i = start + 1; i < end; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || line.startsWith("|---") || line === TABLE_HEADER) continue;
    const cells = line.split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < 4) continue;
    const [conv, ticker, action, startedAt, pid] = cells;
    if (!VALID_CONVS.has(conv.toUpperCase())) continue;
    claims.push({
      conv: conv.toUpperCase(),
      ticker: ticker.toUpperCase(),
      action: action.toLowerCase(),
      startedAt,
      pid: pid || undefined,
    });
  }
  return { claims, sectionStart: start, sectionEnd: end, src };
}

function writeClaims(claims: Claim[]): void {
  const { sectionStart, sectionEnd, src } = readClaims();
  const lines = src ? src.split("\n") : [""];

  const newSection = [
    SECTION_HEADER,
    "",
    "> Auto-géré par `scripts/work-claim.ts`. **Ne PAS éditer à la main.**",
    "> Une ligne = une conv qui travaille en ce moment sur un ticker. Format `claim → travaille → release`.",
    "",
    TABLE_HEADER,
    TABLE_SEP,
    ...claims.map(
      (c) =>
        `| ${c.conv} | ${c.ticker} | ${c.action} | ${c.startedAt} | ${c.pid ?? ""} |`
    ),
    "",
  ];

  if (sectionStart === -1) {
    // Pas de section → l'insérer juste avant "## Log d'activité" ou à la fin
    const logIdx = lines.findIndex((l) => l.trim().startsWith("## Log d'activité"));
    const insertAt = logIdx === -1 ? lines.length : logIdx;
    const before = lines.slice(0, insertAt);
    const after = lines.slice(insertAt);
    writeFileSync(STATUS_PATH, [...before, ...newSection, "", ...after].join("\n"));
  } else {
    const before = lines.slice(0, sectionStart);
    const after = lines.slice(sectionEnd);
    writeFileSync(STATUS_PATH, [...before, ...newSection, ...after].join("\n"));
  }
}

/* ─── Commands ────────────────────────────────────────────────────── */

function parseConv(s: string): string {
  const u = s.toUpperCase();
  if (!VALID_CONVS.has(u)) {
    throw new Error(`Conv invalide "${s}". Attendu : CONCEPTS, SYSTEMS, DATA ou BRAND.`);
  }
  return u;
}

function parsePid(args: string[]): { pid?: string; rest: string[] } {
  const rest: string[] = [];
  let pid: string | undefined;
  for (const a of args) {
    const m = a.match(/^--pid=(.+)$/);
    if (m) pid = m[1];
    else rest.push(a);
  }
  return { pid, rest };
}

async function cmdClaim(args: string[]): Promise<number> {
  if (args.length < 3) {
    console.error("Usage : work-claim.ts claim <conv> <action> <ticker...> [--pid=N]");
    return 2;
  }
  const conv = parseConv(args[0]);
  const action = args[1].toLowerCase();
  const { pid, rest } = parsePid(args.slice(2));
  const tickers = rest.map((t) => t.toUpperCase());
  const startedAt = new Date().toISOString();

  return withLock(() => {
    const { claims } = readClaims();
    const conflicts: { conv: string; ticker: string; action: string }[] = [];
    for (const t of tickers) {
      const conflict = claims.find(
        (c) => c.ticker === t && c.action === action && c.conv !== conv
      );
      if (conflict) conflicts.push({ conv: conflict.conv, ticker: t, action });
    }
    if (conflicts.length > 0) {
      console.log(JSON.stringify({ ok: false, conflicts }, null, 2));
      return 1;
    }

    // Add new claims (skip if déjà claimed by same conv+action)
    const next = [...claims];
    for (const t of tickers) {
      const existing = next.find(
        (c) => c.ticker === t && c.action === action && c.conv === conv
      );
      if (!existing) next.push({ conv, ticker: t, action, startedAt, pid });
    }
    writeClaims(next);
    console.log(JSON.stringify({ ok: true, claimed: tickers, conv, action, startedAt, pid }, null, 2));
    return 0;
  });
}

async function cmdRelease(args: string[]): Promise<number> {
  if (args.length < 2) {
    console.error("Usage : work-claim.ts release <conv> <ticker...> [--action=X]");
    return 2;
  }
  const conv = parseConv(args[0]);
  let actionFilter: string | undefined;
  const tickers: string[] = [];
  for (const a of args.slice(1)) {
    const m = a.match(/^--action=(.+)$/);
    if (m) actionFilter = m[1].toLowerCase();
    else tickers.push(a.toUpperCase());
  }
  return withLock(() => {
    const { claims } = readClaims();
    const before = claims.length;
    const next = claims.filter(
      (c) =>
        !(
          c.conv === conv &&
          tickers.includes(c.ticker) &&
          (!actionFilter || c.action === actionFilter)
        )
    );
    writeClaims(next);
    console.log(JSON.stringify({ ok: true, released: before - next.length, conv, tickers, action: actionFilter ?? null }, null, 2));
    return 0;
  });
}

async function cmdList(args: string[]): Promise<number> {
  let convFilter: string | undefined;
  let tickerFilter: string | undefined;
  for (const a of args) {
    const mc = a.match(/^--conv=(.+)$/);
    const mt = a.match(/^--ticker=(.+)$/);
    if (mc) convFilter = mc[1].toUpperCase();
    if (mt) tickerFilter = mt[1].toUpperCase();
  }
  const { claims } = readClaims();
  const filtered = claims.filter(
    (c) => (!convFilter || c.conv === convFilter) && (!tickerFilter || c.ticker === tickerFilter)
  );
  console.log(JSON.stringify({ ok: true, count: filtered.length, claims: filtered }, null, 2));
  return 0;
}

async function cmdPrune(args: string[]): Promise<number> {
  let maxAgeMin = 60;
  for (const a of args) {
    const m = a.match(/^--max-age-min=(\d+)$/);
    if (m) maxAgeMin = parseInt(m[1], 10);
  }
  const cutoff = Date.now() - maxAgeMin * 60_000;
  return withLock(() => {
    const { claims } = readClaims();
    const before = claims.length;
    const next = claims.filter((c) => {
      const t = Date.parse(c.startedAt);
      return Number.isFinite(t) && t >= cutoff;
    });
    writeClaims(next);
    console.log(JSON.stringify({ ok: true, removed: before - next.length, kept: next.length }, null, 2));
    return 0;
  });
}

/* ─── Entry ──────────────────────────────────────────────────────── */
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    console.error("Usage : work-claim.ts <claim|release|list|prune> [args...]");
    process.exit(2);
  }
  try {
    switch (cmd) {
      case "claim":   process.exit(await cmdClaim(rest)); break;
      case "release": process.exit(await cmdRelease(rest)); break;
      case "list":    process.exit(await cmdList(rest)); break;
      case "prune":   process.exit(await cmdPrune(rest)); break;
      default:
        console.error(`Commande inconnue : ${cmd}`);
        process.exit(2);
    }
  } catch (e) {
    console.error(`work-claim error : ${(e as Error).message}`);
    process.exit(3);
  }
}

main();
