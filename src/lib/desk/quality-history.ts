/**
 * quality-history.ts — snapshot + lecture de l'historique de qualité.
 *
 * Table desk_quality_history : 1 ligne par (snapshot_at, section, column_key)
 * avec les 6 compteurs (total, ok, stale, partial, ko, na).
 *
 * Snapshot toutes les 3 h via cron Vercel /api/cron/quality-snapshot.
 * Idempotent : la unique constraint empêche les doublons exacts.
 */
import { createClient } from "@supabase/supabase-js";
import { buildMatrix } from "./data-quality-matrix";
import { COLUMN_KEYS, finalStatus, type ColumnKey } from "./data-quality-matrix-types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Counts = { total: number; ok: number; stale: number; partial: number; ko: number; na: number };

function emptyCounts(): Counts {
  return { total: 0, ok: 0, stale: 0, partial: 0, ko: 0, na: 0 };
}

/**
 * Calcule le snapshot complet : pour chaque section (v18_top, extra, all)
 * et chaque colonne, retourne les compteurs.
 */
export async function computeSnapshot(): Promise<{
  snapshot_at: string;
  rows: Array<{ section: "v18_top" | "extra" | "all"; column_key: ColumnKey } & Counts>;
}> {
  // Charge la matrice entière (limit haute pour couvrir top + extras).
  const sections = await buildMatrix({ limit: 2000 });
  const snapshot_at = new Date().toISOString();
  const rows: Array<{ section: "v18_top" | "extra" | "all"; column_key: ColumnKey } & Counts> = [];

  // Stats par section + agrégat "all"
  const allCounts: Record<ColumnKey, Counts> = Object.fromEntries(
    COLUMN_KEYS.map((c) => [c, emptyCounts()])
  ) as Record<ColumnKey, Counts>;

  for (const sec of sections) {
    const secCounts: Record<ColumnKey, Counts> = Object.fromEntries(
      COLUMN_KEYS.map((c) => [c, emptyCounts()])
    ) as Record<ColumnKey, Counts>;
    for (const row of sec.rows) {
      for (const col of COLUMN_KEYS) {
        const fs = finalStatus(row.cells[col]);
        secCounts[col].total++;
        allCounts[col].total++;
        const bucket =
          fs === "verified_ok" || fs === "auto_ok" ? "ok"
            : fs === "auto_stale" ? "stale"
            : fs === "auto_partial" ? "partial"
            : fs === "verified_ko" || fs === "auto_ko" ? "ko"
            : "na";
        secCounts[col][bucket]++;
        allCounts[col][bucket]++;
      }
    }
    for (const col of COLUMN_KEYS) {
      rows.push({ section: sec.key, column_key: col, ...secCounts[col] });
    }
  }
  for (const col of COLUMN_KEYS) {
    rows.push({ section: "all", column_key: col, ...allCounts[col] });
  }
  return { snapshot_at, rows };
}

/** Insère le snapshot dans la BDD. Tronque snapshot_at à l'heure pour
 *  rester idempotent même si le cron retry dans la même heure. */
export async function persistSnapshot(): Promise<{ inserted: number }> {
  const supa = adminClient();
  const snap = await computeSnapshot();
  // Tronque à l'heure pleine pour éviter les doublons en cas de retry.
  const at = new Date(snap.snapshot_at);
  at.setMinutes(0, 0, 0);
  const snapshot_at = at.toISOString();
  const { error, count } = await supa
    .from("desk_quality_history")
    .upsert(
      snap.rows.map((r) => ({ ...r, snapshot_at })),
      { onConflict: "snapshot_at,section,column_key", count: "exact" },
    );
  if (error) throw error;
  return { inserted: count ?? snap.rows.length };
}

/** Récupère les N derniers snapshots agrégat "all" pour affichage sparkline. */
export async function loadHistory(opts?: { hoursBack?: number; section?: "v18_top" | "extra" | "all" }): Promise<{
  byColumn: Record<string, Array<{ at: string; ok: number; total: number; pctOk: number }>>;
}> {
  const supa = adminClient();
  const since = new Date(Date.now() - (opts?.hoursBack ?? 24 * 7) * 3600_000).toISOString();
  const section = opts?.section ?? "all";
  const { data, error } = await supa
    .from("desk_quality_history")
    .select("snapshot_at, column_key, ok, total")
    .eq("section", section)
    .gte("snapshot_at", since)
    .order("snapshot_at", { ascending: true });
  if (error) throw error;
  const byColumn: Record<string, Array<{ at: string; ok: number; total: number; pctOk: number }>> = {};
  for (const r of (data ?? []) as Array<{ snapshot_at: string; column_key: string; ok: number; total: number }>) {
    if (!byColumn[r.column_key]) byColumn[r.column_key] = [];
    const pctOk = r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0;
    byColumn[r.column_key].push({ at: r.snapshot_at, ok: r.ok, total: r.total, pctOk });
  }
  return { byColumn };
}
