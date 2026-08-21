import { promises as fs } from "node:fs";
import path from "node:path";
import { loadV17Company } from "@/lib/company-core/load-company";
import { RefreshStatusView, type RefreshRow, type RunHistoryEntry } from "./refresh-status-view";
import historyRaw from "@/data/_quarterly-refresh-history.json";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata = {
  title: "Update SEC (USEC) · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Mapping des flags du cron 7h30 vers les blocs UI côté sté.
 * Seuls les blocs "sté" au sens Yann (risks, stories, profit_warning,
 * ai_positioning) sont exposés ici. Les autres flags (ec_synthesis,
 * segments_geo, events, governance, dilution, description, headcount,
 * governance_top_holders) restent traités par leurs pipelines dédiés.
 */
const UI_BLOCK_FLAGS = [
  { key: "risks", label: "risks" },
  { key: "stories_rotation", label: "stories" },
  { key: "profit_warning", label: "profit_warning" },
  { key: "ai_positioning", label: "ai_positioning" },
] as const;

type TodoEntry = {
  detected_at?: string;
  type?: string;
  forms?: string[];
  filing_paths?: string[];
  flags?: Record<string, boolean>;
  spec_stories?: string;
};

type TodoFile = {
  updated_at?: string;
  todo?: Record<string, TodoEntry>;
};

async function readTodo(): Promise<TodoFile | null> {
  const p = path.join(process.cwd(), ".conv-state/quarterly-refresh-todo-llm.json");
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as TodoFile;
  } catch {
    return null;
  }
}

function extractFilingLabel(p: string): string {
  // ex : "data-lake/NVDA/8K/NVDA_2026-06-12_0001045810-26-000123.htm.gz"
  const base = p.split("/").pop() ?? p;
  const m = base.match(/^([A-Z0-9.\-]+)_(\d{4}-\d{2}-\d{2})/);
  const form = p.includes("/10Q/")
    ? "10-Q"
    : p.includes("/10K/")
    ? "10-K"
    : p.includes("/8K/")
    ? "8-K"
    : p.includes("/20F/")
    ? "20-F"
    : "";
  if (m) {
    const date = m[2].split("-").reverse().slice(0, 2).join("/"); // DD/MM
    return form ? `${form} ${date}` : date;
  }
  return base;
}

async function buildRow(ticker: string, entry: TodoEntry): Promise<RefreshRow> {
  const outcome = await loadV17Company(ticker);
  let name = ticker;
  let generatedAt: string | null = null;
  if (outcome.kind === "ready") {
    name = outcome.company.name;
    // certains JSON exposent generated_at au niveau racine
    const anyC = outcome.company as unknown as { generated_at?: string };
    if (typeof anyC.generated_at === "string") generatedAt = anyC.generated_at;
  } else if (outcome.kind === "preparing") {
    name = outcome.company.name;
  }
  const flags = entry.flags ?? {};
  const blocks = UI_BLOCK_FLAGS.filter((b) => flags[b.key]).map((b) => b.label);
  const filings = (entry.filing_paths ?? []).map(extractFilingLabel);
  return {
    ticker,
    name,
    lastUpdate: generatedAt,
    filings,
    blocks,
    status: blocks.length > 0 ? "todo" : "ok",
  };
}

export default async function RefreshStatusPage() {
  const todo = await readTodo();
  if (!todo || !todo.todo || Object.keys(todo.todo).length === 0) {
    return (
      <RefreshStatusView
        rows={[]}
        updatedAt={null}
        history={((historyRaw as unknown as { runs?: RunHistoryEntry[] }).runs ?? []).slice(0, 30)}
      />
    );
  }

  const tickers = Object.keys(todo.todo);
  const rows: RefreshRow[] = [];
  // sérialisé pour ne pas saturer le FS sur ~500 stés
  for (const t of tickers) {
    rows.push(await buildRow(t, todo.todo[t]!));
  }

  // VERROU 4 (Yann 16 juil 2026) : historique des runs du cron avec le statut
  // des 4 verrous par sté (double extraction, complétude, audit rendu).
  const history: RunHistoryEntry[] =
    ((historyRaw as unknown as { runs?: RunHistoryEntry[] }).runs ?? []).slice(0, 30);

  return (
    <RefreshStatusView
      rows={rows}
      updatedAt={todo.updated_at ?? null}
      history={history}
    />
  );
}
