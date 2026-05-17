/**
 * Image findings — bloc "Graphiques et Schémas de sources diverses".
 *
 * Workflow Yann (15 mai 2026) :
 *   1. crée demande dans /sandbox/image-findings (query libre)
 *   2. clique "Lancer (Claude conv)" → status='claude_pending'
 *   3. dans cette conv MAX 20×, tape "lance la demande N" → Claude
 *      exécute WebSearch site:x.com, extrait images + métadonnées,
 *      écrit dans desk_image_findings
 *   4. status='pending_review' → Yann approuve images dans sandbox
 *   5. images approuvées s'affichent sur les pages sté correspondantes
 *      via merge SSR dans load-company.
 */
import { createClient } from "@supabase/supabase-js";

export type ImageFindingRequestStatus =
  | "todo"
  | "claude_pending"
  | "in_progress"
  | "pending_review"
  | "done"
  | "error";

export type ImageFindingRequest = {
  id: string;
  display_number: number | null;
  title: string | null;
  query: string;
  target_tickers: string[];
  languages: string[];
  status: ImageFindingRequestStatus;
  error_msg: string | null;
  findings_count: number;
  approved_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LocalizedString = Partial<Record<string, string>>;

export type ImageFinding = {
  id: string;
  request_id: string;
  target_tickers: string[];
  languages: string[];
  source_url: string | null;
  source_author: string | null;
  source_handle: string | null;
  source_date: string | null;
  source_platform: string | null;
  image_url: string;
  image_local_path: string | null;
  title: string | null;
  caption: string | null;
  summary: string | null;
  /** i18n title : { fr: "...", en: "...", de: "..." } — fallback sur title si vide. */
  title_i18n?: LocalizedString;
  /** i18n summary (= bloc "Lecture") : { fr, en, de } — fallback sur summary si vide. */
  summary_i18n?: LocalizedString;
  detected_kpi_topics: string[];
  approved: boolean;
  rejected: boolean;
  /** Yann 17 mai 2026 : toggle sandbox admin "afficher la lecture sur la
   *  fiche société publique". Default true. Si false → ImageFindingsBlock
   *  masque le summary sous le graph. */
  show_summary?: boolean;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

/**
 * Sélectionne la version localisée d'un champ i18n, avec fallback intelligent :
 * locale exacte → fr → en → premier dispo → fallback final.
 */
export function pickI18n(
  i18n: LocalizedString | null | undefined,
  locale: string,
  fallback: string | null,
): string | null {
  if (!i18n || typeof i18n !== "object") return fallback;
  // Locale exacte
  if (i18n[locale]) return i18n[locale]!;
  // Variantes (en-GB → en, de-CH → de)
  const base = locale.split("-")[0];
  if (i18n[base]) return i18n[base]!;
  // Fallback FR puis EN
  if (i18n.fr) return i18n.fr;
  if (i18n.en) return i18n.en;
  // Premier dispo
  const keys = Object.keys(i18n).filter((k) => !!i18n[k]);
  if (keys.length > 0) return i18n[keys[0]]!;
  return fallback;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function listRequests(): Promise<ImageFindingRequest[]> {
  const supa = admin();
  const { data, error } = await supa
    .from("desk_image_findings_requests")
    .select("*")
    .order("display_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImageFindingRequest[];
}

export async function getRequest(id: string): Promise<ImageFindingRequest | null> {
  const supa = admin();
  const { data } = await supa
    .from("desk_image_findings_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as ImageFindingRequest | null;
}

export async function listFindings(requestId: string): Promise<ImageFinding[]> {
  const supa = admin();
  const { data } = await supa
    .from("desk_image_findings")
    .select("*")
    .eq("request_id", requestId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as ImageFinding[];
}

export async function upsertRequest(p: Partial<ImageFindingRequest>): Promise<ImageFindingRequest> {
  const supa = admin();
  if (!p.id) {
    // Nouveau : assigner display_number = max+1
    const { data: maxRow } = await supa
      .from("desk_image_findings_requests")
      .select("display_number")
      .order("display_number", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    p.display_number = (maxRow?.display_number ?? 0) + 1;
  }
  const payload = {
    ...p,
    target_tickers: p.target_tickers?.map((t) => t.toUpperCase()) ?? [],
  };
  const q = p.id
    ? supa.from("desk_image_findings_requests").update(payload).eq("id", p.id).select().single()
    : supa.from("desk_image_findings_requests").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data as ImageFindingRequest;
}

export async function deleteRequest(id: string): Promise<void> {
  const supa = admin();
  await supa.from("desk_image_findings_requests").delete().eq("id", id);
}

export async function upsertFinding(p: Partial<ImageFinding>): Promise<ImageFinding> {
  const supa = admin();
  const payload = {
    ...p,
    target_tickers: p.target_tickers?.map((t) => t.toUpperCase()),
  };
  const q = p.id
    ? supa.from("desk_image_findings").update(payload).eq("id", p.id).select().single()
    : supa.from("desk_image_findings").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data as ImageFinding;
}

export async function deleteFinding(id: string): Promise<void> {
  const supa = admin();
  await supa.from("desk_image_findings").delete().eq("id", id);
}

/** Insert plusieurs findings d'un coup (utilisé par Claude conv en bulk). */
export async function insertFindings(rows: Partial<ImageFinding>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const supa = admin();
  const payload = rows.map((r) => ({
    ...r,
    target_tickers: r.target_tickers?.map((t) => t.toUpperCase()) ?? [],
  }));
  const { data, error } = await supa
    .from("desk_image_findings")
    .insert(payload)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Liste findings approuvés pour un ticker (utilisé par merge SSR). */
export async function listApprovedForTicker(ticker: string): Promise<ImageFinding[]> {
  const supa = admin();
  const T = ticker.toUpperCase();
  const { data } = await supa
    .from("desk_image_findings")
    .select("*")
    .contains("target_tickers", [T])
    .eq("approved", true)
    .eq("rejected", false)
    .order("display_order", { ascending: true });
  return (data ?? []) as ImageFinding[];
}

/** Met à jour les compteurs findings/approved sur une demande. */
export async function refreshRequestCounters(requestId: string): Promise<void> {
  const supa = admin();
  const { data: all } = await supa
    .from("desk_image_findings")
    .select("approved,rejected")
    .eq("request_id", requestId);
  const total = all?.length ?? 0;
  const approved = all?.filter((r) => r.approved && !r.rejected).length ?? 0;
  await supa
    .from("desk_image_findings_requests")
    .update({ findings_count: total, approved_count: approved })
    .eq("id", requestId);
}

/** Marque la demande comme à exécuter par Claude conv. */
export async function markClaudePending(id: string): Promise<void> {
  const supa = admin();
  await supa
    .from("desk_image_findings_requests")
    .update({ status: "claude_pending" })
    .eq("id", id);
}
