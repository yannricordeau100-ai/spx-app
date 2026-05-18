/**
 * /api/cron/kpi-worker-tick — worker serverless KPI extraction
 *
 * Remplace `scripts/run-kpi-add-request.py` par une route Vercel.
 * Process 1 ticker pending par appel (timeout Hobby ~10s).
 *
 * Déclenchement :
 *   - Cron Vercel (header `x-vercel-cron`)
 *   - Header `authorization: Bearer <CRON_SECRET>` ou query `?secret=<CRON_SECRET>`
 *   - Frontend authentifié (`requireDeskOwner`) — header `x-trigger: frontend`
 *
 * Pour chaque tick :
 *   1. Cherche 1 demande pending ou processing
 *   2. Trouve 1 ticker non encore dans `results`
 *   3. Détecte la catégorie (cat1 US / cat2 FPI ADR / cat3 EU)
 *   4. Charge les docs locaux récents (<3 mois prioritaires)
 *   5. Appelle Groq Llama 3.3 70B primary, fallback Cerebras / Haiku
 *   6. Parse + écrit le résultat
 *
 * Idempotent : skip tickers déjà traités. Cancel-aware : re-check status
 * avant écriture.
 */

import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  loadKpiRequest,
  updateKpiRequest,
  type KpiRequest,
  type KpiRequestResult,
} from "@/lib/desk/kpi-requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby = 10s par défaut, Pro = 60s. On vise un ticker / tick pour rester < 10s
// quand on a un fallback Groq rapide. Le LLM timeout interne est à 45s mais le
// runtime Vercel coupera avant si Hobby. Documenté dans le README route.
export const maxDuration = 60;

const gunzip = promisify(zlib.gunzip);

/* ─── Helpers : détection catégorie ──────────────────────────────── */

const EU_SUFFIXES = [
  ".SW", ".PA", ".L", ".DE", ".AS", ".ST", ".CO", ".MI", ".MC", ".HE",
  ".OL", ".T", ".HK", ".LS", ".BR", ".VI", ".IR", ".PR", ".KS",
] as const;

type CatKey = "cat1" | "cat2" | "cat3";

let fpiSetCache: Set<string> | null = null;
async function loadFpiSet(): Promise<Set<string>> {
  if (fpiSetCache) return fpiSetCache;
  const tryPaths = [
    path.join(process.cwd(), "src", "data", "fpi-tickers.json"),
    path.join(process.cwd(), "sec-data", "cat2-foreign-adr", "_meta", "fpi-tickers.json"),
  ];
  for (const p of tryPaths) {
    try {
      const raw = await fs.readFile(p, "utf-8");
      const json = JSON.parse(raw);
      const arr = Array.isArray(json) ? json : Array.isArray(json?.tickers) ? json.tickers : [];
      const set = new Set<string>(arr.map((t: string) => t.toUpperCase()));
      fpiSetCache = set;
      return set;
    } catch {
      // try next
    }
  }
  fpiSetCache = new Set<string>();
  return fpiSetCache;
}

async function detectCategory(ticker: string): Promise<CatKey> {
  const t = ticker.toUpperCase();
  if (EU_SUFFIXES.some((s) => t.endsWith(s)) || t.includes(".")) {
    return "cat3";
  }
  const fpi = await loadFpiSet();
  if (fpi.has(t)) return "cat2";
  return "cat1";
}

/* ─── Helpers : chargement docs sec-data ─────────────────────────── */

const MAX_DOC_CHARS = 40_000;
const MAX_FILES_PER_DOC_TYPE = 4;

/** Lit un fichier (gz ou plain). Strip HTML basique si .htm[l]. */
async function readDocFile(filePath: string): Promise<string> {
  try {
    if (filePath.endsWith(".gz")) {
      const buf = await fs.readFile(filePath);
      const decompressed = await gunzip(buf);
      let txt = decompressed.toString("utf-8");
      if (/\.htm[l]?\.gz$/i.test(filePath)) {
        txt = txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      }
      return txt;
    }
    const txt = await fs.readFile(filePath, "utf-8");
    if (/\.html?$/i.test(filePath)) {
      return txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    }
    return txt;
  } catch {
    return "";
  }
}

type DocCandidate = { path: string; mtimeMs: number };

async function listDocsInDir(dir: string, ticker: string): Promise<DocCandidate[]> {
  const out: DocCandidate[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (!name.startsWith(`${ticker}_`) && !name.startsWith(`${ticker}.`)) continue;
    const full = path.join(dir, name);
    try {
      const st = await fs.stat(full);
      if (st.isFile()) out.push({ path: full, mtimeMs: st.mtimeMs });
    } catch {
      // skip
    }
  }
  return out;
}

async function listDocsInTickerSubdir(
  base: string,
  subdirs: string[],
): Promise<DocCandidate[]> {
  const out: DocCandidate[] = [];
  for (const sub of subdirs) {
    const dir = path.join(base, sub);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      try {
        const st = await fs.stat(full);
        if (st.isFile()) out.push({ path: full, mtimeMs: st.mtimeMs });
      } catch {
        // skip
      }
    }
  }
  return out;
}

/**
 * Charge tous les docs récents pour un ticker.
 * - cat1 : 10-K + 10-Q + 8-K + DEF14A (sous-arbres par form/year)
 * - cat2 : 20-F + 6-K (sous-arbres par form/year)
 * - cat3 : annual-text + half-year + ad-hoc + ir-presentations + esg
 *
 * Privilégie les fichiers < 3 mois (tri par mtime desc).
 */
async function loadDocsForTicker(ticker: string, cat: CatKey): Promise<{
  text: string;
  sources: string[];
}> {
  const t = ticker.toUpperCase();
  const secDataRoot = path.join(process.cwd(), "sec-data");
  const candidates: DocCandidate[] = [];

  if (cat === "cat1") {
    const base = path.join(secDataRoot, "cat1-us");
    const forms = ["10K", "10Q", "8K", "DEF14A"];
    for (const form of forms) {
      const formDir = path.join(base, form);
      let years: string[] = [];
      try {
        years = await fs.readdir(formDir);
      } catch {
        continue;
      }
      const sortedYears = years
        .filter((y) => /^\d{4}$/.test(y))
        .sort((a, b) => Number(b) - Number(a))
        .slice(0, 3);
      for (const year of sortedYears) {
        const files = await listDocsInDir(path.join(formDir, year), t);
        candidates.push(...files);
      }
    }
  } else if (cat === "cat2") {
    const base = path.join(secDataRoot, "cat2-foreign-adr");
    const forms = ["20F", "6K", "40F-canadian"];
    for (const form of forms) {
      const formDir = path.join(base, form);
      let years: string[] = [];
      try {
        years = await fs.readdir(formDir);
      } catch {
        continue;
      }
      const sortedYears = years
        .filter((y) => /^\d{4}$/.test(y))
        .sort((a, b) => Number(b) - Number(a))
        .slice(0, 3);
      for (const year of sortedYears) {
        const files = await listDocsInDir(path.join(formDir, year), t);
        candidates.push(...files);
      }
    }
  } else {
    const tickerDir = path.join(secDataRoot, "cat3-european", t);
    const subdirs = [
      "annual-text",
      "half-year",
      "ad-hoc",
      "ir-presentations",
      "esg",
      "ir-page-snapshot",
      "home-page-snapshot",
    ];
    const files = await listDocsInTickerSubdir(tickerDir, subdirs);
    candidates.push(...files);
  }

  // Trier par mtime desc (plus récents en premier)
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

  // Limiter le nombre de fichiers et concaténer jusqu'à MAX_DOC_CHARS
  const sources: string[] = [];
  const chunks: string[] = [];
  let total = 0;

  for (const cand of candidates.slice(0, MAX_FILES_PER_DOC_TYPE * 4)) {
    if (total >= MAX_DOC_CHARS) break;
    const txt = await readDocFile(cand.path);
    if (!txt) continue;
    const remaining = MAX_DOC_CHARS - total;
    const slice = txt.slice(0, Math.min(remaining, 12_000));
    chunks.push(slice);
    sources.push(path.relative(secDataRoot, cand.path));
    total += slice.length;
  }

  return {
    text: chunks.join("\n\n---\n\n"),
    sources,
  };
}

/* ─── Helpers : appels LLM ───────────────────────────────────────── */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "llama-3.3-70b";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT =
  "Tu es un extracteur de KPIs financiers strict. Réponds uniquement en JSON pur, sans markdown.";

async function callGroq(prompt: string, signal: AbortSignal): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY manquante");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function callCerebras(prompt: string, signal: AbortSignal): Promise<string> {
  const key =
    process.env.CEREBRAS_API_KEY ||
    process.env.CEREBRAS2_API_KEY ||
    process.env.CEREBRAS3_API_KEY;
  if (!key) throw new Error("CEREBRAS_API_KEY manquante");
  const res = await fetch(CEREBRAS_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`Cerebras ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string, signal: AbortSignal): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquante");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    signal,
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.content?.[0]?.text ?? "";
}

function parseLlmJson(raw: string): Record<string, unknown> {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : raw;
  // Fallback : extraire le premier objet JSON
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  const jsonStr = braceMatch ? braceMatch[0] : candidate.trim();
  return JSON.parse(jsonStr);
}

/* ─── Helpers : prompt builder ───────────────────────────────────── */

function buildExtractionPrompt(req: KpiRequest, ticker: string, docs: string): string {
  return `Société : ${ticker}

Demande utilisateur : ${req.description}

KPI à extraire : ${req.kpi_short} (${req.kpi_name_en})
Unité attendue : ${req.kpi_expected_unit}
Type : ${req.kpi_type}

Consignes user :
${req.extraction_prompt}

Réponds en JSON pur (RIEN d'autre, pas de markdown) au format :
{
  "value": <number ou null si non trouvé>,
  "unit": "<unité réelle trouvée>",
  "year": "<année ou période>",
  "history": [<valeurs annuelles si disponibles, sinon []>],
  "source": "<doc + page/section où la valeur a été trouvée>",
  "confidence": <0.0 à 1.0>
}

RÈGLES STRICTES :
- Si la valeur n'est PAS trouvée explicitement dans les sources : renvoie value=null.
- NE JAMAIS inventer, NE JAMAIS extrapoler.
- Privilégier la donnée la plus récente disponible (last 3 months si possible).

Sources (extraits des docs locaux pour ${ticker}) :
${docs.slice(0, 30_000)}
`;
}

/* ─── Helpers : sélection du ticker à traiter ───────────────────── */

async function findNextPendingRequest(): Promise<KpiRequest | null> {
  const supabase = createSupabaseAdminClient();
  // Cherche pending d'abord, puis processing (reprise)
  for (const status of ["pending", "processing"] as const) {
    const { data } = await supabase
      .from("desk_kpi_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      const row = data as KpiRequest;
      return {
        ...row,
        tickers: Array.isArray(row.tickers) ? row.tickers : [],
        results: Array.isArray(row.results) ? (row.results as KpiRequestResult[]) : [],
      };
    }
  }
  return null;
}

function pickNextTicker(req: KpiRequest): string | null {
  const doneSet = new Set(
    (req.results ?? [])
      .map((r) => (r.ticker ?? "").toUpperCase())
      .filter(Boolean),
  );
  for (const t of req.tickers) {
    if (!doneSet.has(t.toUpperCase())) return t;
  }
  return null;
}

/* ─── Helpers : authentification ─────────────────────────────────── */

async function isAuthorized(req: NextRequest): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  const trigger = req.headers.get("x-trigger");

  if (secret && (auth === `Bearer ${secret}` || querySecret === secret)) {
    return { ok: true };
  }
  if (isVercelCron) {
    return { ok: true };
  }
  if (trigger === "frontend") {
    try {
      await requireDeskOwner();
      return { ok: true };
    } catch {
      return { ok: false, reason: "frontend trigger requires desk owner auth" };
    }
  }
  return { ok: false, reason: "missing CRON_SECRET or frontend auth" };
}

/* ─── Handler principal ──────────────────────────────────────────── */

async function handleTick(req: NextRequest): Promise<NextResponse> {
  const auth = await isAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? "unauthorized" }, { status: 401 });
  }

  const trigger = req.headers.get("x-trigger") ?? "cron";
  const startedAt = Date.now();

  // 1. Trouver une demande à traiter
  const request = await findNextPendingRequest();
  if (!request) {
    return NextResponse.json({
      ok: true,
      processed: null,
      message: "aucune demande pending ou processing",
      trigger,
    });
  }

  // 2. Re-check status pour cancel-aware (anti-race condition)
  if (request.status === "canceled") {
    return NextResponse.json({
      ok: true,
      processed: null,
      message: `request ${request.id} canceled`,
      trigger,
    });
  }

  // 3. Marquer en processing si pending
  if (request.status === "pending") {
    await updateKpiRequest(request.id, { status: "processing", error_message: null });
  }

  // 4. Choisir le ticker suivant
  const nextTicker = pickNextTicker(request);
  if (!nextTicker) {
    // Tout traité : marquer done
    await updateKpiRequest(request.id, { status: "done" });
    return NextResponse.json({
      ok: true,
      processed: null,
      request_id: request.id,
      message: `request ${request.id} → done`,
      remaining: 0,
      trigger,
    });
  }

  const tickerUpper = nextTicker.toUpperCase();

  // 5. Détection catégorie + chargement docs
  let cat: CatKey = "cat1";
  let docs = "";
  let sources: string[] = [];
  try {
    cat = await detectCategory(tickerUpper);
    const loaded = await loadDocsForTicker(tickerUpper, cat);
    docs = loaded.text;
    sources = loaded.sources;
  } catch (err) {
    console.error(`[kpi-worker-tick] load docs failed for ${tickerUpper}:`, err);
  }

  // 6. Construire le prompt + appeler LLM avec fallback
  const prompt = buildExtractionPrompt(request, tickerUpper, docs);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 45_000);

  let raw = "";
  let llmProvider = "";
  let llmError: string | null = null;

  const tryOrder: Array<{ name: string; fn: () => Promise<string> }> = [];
  if (process.env.GROQ_API_KEY) {
    tryOrder.push({
      name: "groq",
      fn: () => callGroq(prompt, abortController.signal),
    });
  }
  if (
    process.env.CEREBRAS_API_KEY ||
    process.env.CEREBRAS2_API_KEY ||
    process.env.CEREBRAS3_API_KEY
  ) {
    tryOrder.push({
      name: "cerebras",
      fn: () => callCerebras(prompt, abortController.signal),
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    tryOrder.push({
      name: "anthropic",
      fn: () => callAnthropic(prompt, abortController.signal),
    });
  }

  for (const { name, fn } of tryOrder) {
    try {
      raw = await fn();
      llmProvider = name;
      llmError = null;
      break;
    } catch (e) {
      llmError = `${name}: ${(e as Error).message}`;
      console.error(`[kpi-worker-tick] ${tickerUpper} ${llmError}`);
    }
  }

  clearTimeout(timeout);

  // 7. Re-check status (cancel-aware avant écriture)
  const fresh = await loadKpiRequest(request.id);
  if (!fresh || fresh.status === "canceled") {
    return NextResponse.json({
      ok: true,
      processed: tickerUpper,
      request_id: request.id,
      message: "request canceled mid-tick, skipped write",
      trigger,
    });
  }

  // 8. Parser le résultat
  const result: KpiRequestResult = {
    ticker: tickerUpper,
    value: null,
    unit: null,
    extracted_at: new Date().toISOString(),
  };

  if (!raw && llmError) {
    result.error = `llm: ${llmError}`;
  } else if (!docs) {
    result.error = "no local docs found";
  } else {
    try {
      const parsed = parseLlmJson(raw);
      result.value = (parsed.value as number | string | null) ?? null;
      result.unit = (parsed.unit as string | null) ?? null;
      result.year = parsed.year as number | string | undefined;
      result.history = Array.isArray(parsed.history)
        ? (parsed.history as number[])
        : undefined;
      result.source =
        (parsed.source as string | undefined) ??
        (sources.length > 0 ? sources.slice(0, 2).join(", ") : undefined);
      // Flag short history si fallback_story actif
      if (
        request.fallback_story &&
        Array.isArray(result.history) &&
        result.history.length > 0 &&
        result.history.length < 5
      ) {
        result.is_short_history = true;
      }
    } catch (e) {
      result.error = `parse: ${(e as Error).message} | raw: ${raw.slice(0, 200)}`;
    }
  }

  // 9. Append result + update progress
  const newResults = [...(fresh.results ?? []), result];
  const newProgress = newResults.length;
  const allDone = newProgress >= fresh.tickers.length;

  await updateKpiRequest(request.id, {
    results: newResults,
    progress_done: newProgress,
    status: allDone ? "done" : "processing",
  });

  return NextResponse.json({
    ok: true,
    processed: tickerUpper,
    request_id: request.id,
    cat,
    sources: sources.length,
    llm_provider: llmProvider || null,
    llm_error: llmError,
    value: result.value,
    unit: result.unit,
    progress_done: newProgress,
    progress_total: fresh.tickers.length,
    remaining: fresh.tickers.length - newProgress,
    status: allDone ? "done" : "processing",
    elapsed_ms: Date.now() - startedAt,
    trigger,
  });
}

export async function GET(req: NextRequest) {
  return handleTick(req);
}

export async function POST(req: NextRequest) {
  return handleTick(req);
}
