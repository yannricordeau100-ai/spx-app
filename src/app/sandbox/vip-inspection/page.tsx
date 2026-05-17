import { createClient } from "@supabase/supabase-js";
import { VipInspectionClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VIP Inspection · Mettrik AI",
  robots: { index: false, follow: false },
};

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

export default async function VipInspectionPage() {
  // Yann 17 mai 2026 : migration de fs.writeFileSync (read-only sur Vercel)
  // vers Supabase pour permettre l'ajout/retrait de tickers via UI.
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [listRes, statusRes] = await Promise.all([
    supa.from("vip_inspection_list").select("ticker, note, added_at, scheduled_at").order("added_at", { ascending: true }),
    supa.from("vip_inspection_status").select("*"),
  ]);

  const list: ListFile = {
    updated_at: new Date().toISOString(),
    tickers: (listRes.data ?? []).map((r) => ({
      ticker: r.ticker,
      note: r.note ?? undefined,
      added_at: r.added_at,
      scheduled_at: r.scheduled_at ?? undefined,
    })),
  };

  const status: StatusFile = {
    updated_at: new Date().toISOString(),
    results: {},
  };
  for (const r of statusRes.data ?? []) {
    status.results[r.ticker] = {
      ticker: r.ticker,
      state: r.state,
      last_run_at: r.last_run_at ?? undefined,
      defects: r.defects ?? [],
      mode_screenshots: r.mode_screenshots ?? {},
      error: r.error ?? undefined,
    };
  }

  return <VipInspectionClient initialList={list} initialStatus={status} />;
}
