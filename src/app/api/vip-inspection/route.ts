import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * API endpoint pour gérer la liste VIP inspection.
 *
 * GET  /api/vip-inspection         → retourne {list, status}
 * POST /api/vip-inspection         → body {action: "add", ticker, note?} | {action: "remove", ticker} | {action: "launch", ticker}
 *
 * Yann 17 mai 2026.
 */

const ROOT = process.cwd();
const LIST = path.join(ROOT, "src/data/vip-list.json");
const STATUS = path.join(ROOT, "src/data/vip-inspection-status.json");

type ListFile = {
  updated_at: string;
  tickers: Array<{ ticker: string; added_at: string; note?: string; scheduled_at?: string }>;
};

type StatusFile = {
  updated_at: string;
  results: Record<string, {
    ticker: string;
    last_run_at?: string;
    state: "idle" | "running" | "done" | "error";
    defects?: Array<{ id: string; severity: number; obs: string; corrected?: boolean; reverified?: boolean }>;
    mode_screenshots?: Record<string, string>;
    error?: string;
  }>;
};

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; }
  catch { return fallback; }
}

function writeJson(p: string, data: unknown) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

export async function GET() {
  const list = readJson<ListFile>(LIST, { updated_at: "", tickers: [] });
  const status = readJson<StatusFile>(STATUS, { updated_at: "", results: {} });
  return NextResponse.json({ list, status });
}

export async function POST(req: Request) {
  let body: { action?: string; ticker?: string; note?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.action || !body.ticker) {
    return NextResponse.json({ error: "action + ticker required" }, { status: 400 });
  }
  const tk = body.ticker.toUpperCase().trim();
  const list = readJson<ListFile>(LIST, { updated_at: "", tickers: [] });

  if (body.action === "add") {
    if (!list.tickers.find((t) => t.ticker.toUpperCase() === tk)) {
      list.tickers.push({ ticker: tk, added_at: new Date().toISOString(), note: body.note });
    }
    list.updated_at = new Date().toISOString();
    writeJson(LIST, list);
    return NextResponse.json({ ok: true, list });
  }

  if (body.action === "remove") {
    list.tickers = list.tickers.filter((t) => t.ticker.toUpperCase() !== tk);
    list.updated_at = new Date().toISOString();
    writeJson(LIST, list);
    return NextResponse.json({ ok: true, list });
  }

  if (body.action === "launch") {
    // Marque l'état "queued" ; le script Python qui tourne en background
    // (manuel ou via cron) reprend les "queued" pour les exécuter.
    const status = readJson<StatusFile>(STATUS, { updated_at: "", results: {} });
    status.results[tk] = {
      ticker: tk,
      state: "running",
      last_run_at: new Date().toISOString(),
    };
    status.updated_at = new Date().toISOString();
    writeJson(STATUS, status);
    return NextResponse.json({
      ok: true,
      hint: `Lance le script en CLI : python3 scripts/vip-deep-inspection.py --ticker ${tk} (ou attend qu'il tourne en cron). État mis à 'running' dans vip-inspection-status.json.`,
    });
  }

  return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 });
}
