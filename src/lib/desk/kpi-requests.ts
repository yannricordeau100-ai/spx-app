/**
 * kpi-requests.ts — helpers BDD pour la file `desk_kpi_requests`.
 *
 * Une demande KPI multi-sté est créée depuis le desk admin (UI Agent F1)
 * via /api/desk-mtk9x4kp/kpi-add-request. Le script Python
 * scripts/run-kpi-add-request.py la traite ensuite (LLM Cerebras / Haiku
 * sur sec-data local). Pas d'écriture directe v2-pipeline/ : Yann valide
 * manuellement les résultats stockés en JSONB.
 *
 * Voir migration supabase/migrations/20260518_desk_kpi_requests.sql.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type KpiRequestStatus =
  | "pending"
  | "processing"
  | "done"
  | "error"
  | "canceled";

/** Résultat d'extraction LLM pour 1 ticker dans une demande. */
export type KpiRequestResult = {
  ticker: string;
  value: number | string | null;
  unit: string | null;
  history?: number[];
  year?: number | string;
  source?: string;
  is_short_history?: boolean;
  /** Erreur LLM / parsing si la ligne a échoué. */
  error?: string;
  extracted_at?: string;
};

export type KpiRequest = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  description: string;
  kpi_short: string;
  kpi_name_en: string;
  kpi_name_fr: string | null;
  kpi_explanation: string;
  kpi_type: string;
  kpi_expected_unit: string;
  extraction_prompt: string;
  fallback_story: boolean;
  tickers: string[];
  status: KpiRequestStatus;
  progress_done: number;
  progress_total: number;
  results: KpiRequestResult[];
  error_message: string | null;
};

/** Payload pour créer une nouvelle demande. */
export type KpiRequestCreateInput = {
  description: string;
  kpi_short: string;
  kpi_name_en: string;
  kpi_name_fr?: string | null;
  kpi_explanation: string;
  kpi_type: string;
  kpi_expected_unit: string;
  extraction_prompt: string;
  fallback_story?: boolean;
  tickers: string[];
  created_by?: string | null;
};

/** Updates partiels acceptés (sans toucher aux champs identifiants). */
export type KpiRequestUpdate = Partial<
  Pick<
    KpiRequest,
    | "status"
    | "progress_done"
    | "progress_total"
    | "results"
    | "error_message"
  >
>;

/**
 * Charge la liste des demandes, du plus récent au plus ancien.
 * Limite par défaut à 200 entrées pour ne pas exploser la réponse.
 */
export async function loadKpiRequests(limit = 200): Promise<KpiRequest[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_kpi_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return (data as KpiRequest[]).map((r) => ({
    ...r,
    tickers: Array.isArray(r.tickers) ? r.tickers : [],
    results: Array.isArray(r.results) ? (r.results as KpiRequestResult[]) : [],
  }));
}

/** Charge 1 demande par id. */
export async function loadKpiRequest(id: string): Promise<KpiRequest | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_kpi_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as KpiRequest;
  return {
    ...row,
    tickers: Array.isArray(row.tickers) ? row.tickers : [],
    results: Array.isArray(row.results)
      ? (row.results as KpiRequestResult[])
      : [],
  };
}

/**
 * Crée une nouvelle demande en statut `pending`. progress_total =
 * tickers.length. Le script Python prendra le relais.
 */
export async function createKpiRequest(
  payload: KpiRequestCreateInput,
): Promise<KpiRequest> {
  const supabase = createSupabaseAdminClient();
  const tickers = (payload.tickers ?? []).map((t) => t.trim()).filter(Boolean);
  const insert = {
    description: payload.description,
    kpi_short: payload.kpi_short,
    kpi_name_en: payload.kpi_name_en,
    kpi_name_fr: payload.kpi_name_fr ?? null,
    kpi_explanation: payload.kpi_explanation,
    kpi_type: payload.kpi_type,
    kpi_expected_unit: payload.kpi_expected_unit,
    extraction_prompt: payload.extraction_prompt,
    fallback_story: payload.fallback_story ?? true,
    tickers,
    status: "pending" as KpiRequestStatus,
    progress_done: 0,
    progress_total: tickers.length,
    results: [],
    error_message: null,
    created_by: payload.created_by ?? null,
  };
  const { data, error } = await supabase
    .from("desk_kpi_requests")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "INSERT desk_kpi_requests failed");
  }
  return data as KpiRequest;
}

/**
 * Met à jour des champs partiels (status, progress, results, error). Pas
 * de réécriture des champs identifiants / payload original.
 */
export async function updateKpiRequest(
  id: string,
  updates: KpiRequestUpdate,
): Promise<KpiRequest | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_kpi_requests")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as KpiRequest;
}

/**
 * Supprime une demande. Restreint aux statuts terminaux : error, canceled,
 * ou done depuis > 7 jours (pour éviter les suppressions accidentelles de
 * runs en cours).
 */
export async function deleteKpiRequest(id: string): Promise<{
  deleted: boolean;
  reason?: string;
}> {
  const supabase = createSupabaseAdminClient();
  const row = await loadKpiRequest(id);
  if (!row) return { deleted: false, reason: "not_found" };
  const isTerminal =
    row.status === "error" || row.status === "canceled" || row.status === "done";
  if (!isTerminal) {
    return { deleted: false, reason: "status_not_terminal" };
  }
  if (row.status === "done") {
    const ageDays =
      (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      return { deleted: false, reason: "done_too_recent" };
    }
  }
  const { error } = await supabase.from("desk_kpi_requests").delete().eq("id", id);
  if (error) return { deleted: false, reason: error.message };
  return { deleted: true };
}
