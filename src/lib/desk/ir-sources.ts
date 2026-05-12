/**
 * ir-sources.ts — wrappers Supabase pour le module sources IR.
 *
 * Yann remplit ici les URLs IR de chaque sté (home corp + page IR home +
 * page docs + pages additionnelles). Le scraper Python (CONV-DATA) lit
 * ces URLs et télécharge auto les PDFs (press releases, CFO commentary,
 * transcripts, earning slides) qui ne sont PAS sur SEC EDGAR.
 */
import { createClient } from "@supabase/supabase-js";

export type IrSourceStatus = "todo" | "partial" | "complete" | "verified";
export type IrMissingDocType =
  | "press_releases"
  | "transcripts"
  | "cfo_commentary"
  | "earning_slides"
  | "annual_report_pdf"
  | "esg_report"
  | "investor_day";

export type IrSource = {
  ticker: string;
  home_url: string | null;
  ir_home_url: string | null;
  ir_docs_main_url: string | null;
  ir_docs_additional_urls: string[];
  notes: string | null;
  status: IrSourceStatus;
  missing_docs: IrMissingDocType[];
  docs_count: number;
  last_scrape_at: string | null;
  last_scrape_status: string | null;
  created_at: string;
  updated_at: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function listIrSources(): Promise<IrSource[]> {
  const { data, error } = await adminClient()
    .from("desk_ir_sources")
    .select("*")
    .order("status")
    .order("ticker");
  if (error) throw error;
  return (data ?? []) as IrSource[];
}

export async function upsertIrSource(input: Partial<IrSource> & { ticker: string }): Promise<IrSource> {
  // Recalcule le status automatiquement selon les URLs remplies.
  const filled = [input.home_url, input.ir_home_url, input.ir_docs_main_url].filter(
    (u) => u && u.trim() !== "",
  ).length;
  const additionalCount = (input.ir_docs_additional_urls ?? []).filter((u) => u && u.trim() !== "").length;
  const totalFilled = filled + additionalCount;
  let status: IrSourceStatus = "todo";
  if (totalFilled === 0) status = "todo";
  else if (totalFilled < 2) status = "partial";
  else status = "complete";
  // Si Yann avait déjà mis "verified", on respecte (ne re-downgrade pas)
  if (input.status === "verified") status = "verified";

  const { data, error } = await adminClient()
    .from("desk_ir_sources")
    .upsert({
      ticker: input.ticker.toUpperCase(),
      home_url: input.home_url ?? null,
      ir_home_url: input.ir_home_url ?? null,
      ir_docs_main_url: input.ir_docs_main_url ?? null,
      ir_docs_additional_urls: input.ir_docs_additional_urls ?? [],
      notes: input.notes ?? null,
      status,
      missing_docs: input.missing_docs ?? [],
    }, { onConflict: "ticker" })
    .select()
    .single();
  if (error) throw error;
  return data as IrSource;
}

export async function deleteIrSource(ticker: string): Promise<void> {
  const { error } = await adminClient()
    .from("desk_ir_sources")
    .delete()
    .eq("ticker", ticker.toUpperCase());
  if (error) throw error;
}

/** Bulk seed : crée des entrées vides (status=todo) pour une liste de tickers
 *  qui ne sont pas encore dans la table. Permet de pré-remplir avec le top 305. */
export async function seedTickers(tickers: string[]): Promise<{ inserted: number; skipped: number }> {
  const supa = adminClient();
  const { data: existing } = await supa.from("desk_ir_sources").select("ticker");
  const existingSet = new Set((existing ?? []).map((r: { ticker: string }) => r.ticker.toUpperCase()));
  const toInsert = tickers
    .map((t) => t.toUpperCase())
    .filter((t) => !existingSet.has(t))
    .map((ticker) => ({ ticker, status: "todo" as const }));
  if (toInsert.length === 0) return { inserted: 0, skipped: tickers.length };
  const { error } = await supa.from("desk_ir_sources").insert(toInsert);
  if (error) throw error;
  return { inserted: toInsert.length, skipped: tickers.length - toInsert.length };
}
