import path from "node:path";
import fs from "node:fs";
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
  const root = process.cwd();
  const list = JSON.parse(fs.readFileSync(path.join(root, "src/data/vip-list.json"), "utf-8")) as ListFile;
  let status: StatusFile = { updated_at: "", results: {} };
  try {
    status = JSON.parse(fs.readFileSync(path.join(root, "src/data/vip-inspection-status.json"), "utf-8"));
  } catch {}
  return <VipInspectionClient initialList={list} initialStatus={status} />;
}
