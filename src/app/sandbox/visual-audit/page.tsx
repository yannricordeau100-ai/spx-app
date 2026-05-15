import path from "node:path";
import fs from "node:fs";
import { VisualAuditClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Visual Audit · Mettrik AI",
  robots: { index: false, follow: false },
};

type Fail = { id: string; severity: number; obs: string };
type Row = {
  ticker: string;
  url: string;
  ts?: string;
  n_fails?: number;
  blocker?: boolean;
  fails?: Fail[];
  error?: string;
};

export default async function VisualAuditPage() {
  const root = process.cwd();
  const fp = path.join(root, "src/data/visual-audit.json");
  let updated = "";
  let rows: Row[] = [];
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
    updated = raw.updated_at || "";
    rows = Object.values(raw.results || {}) as Row[];
  } catch {}

  return <VisualAuditClient rows={rows} updatedAt={updated} />;
}
