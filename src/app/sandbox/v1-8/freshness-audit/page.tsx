import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import path from "path";
import { promises as fs } from "fs";

/**
 * /sandbox/v1-8/freshness-audit — vue admin de l'état "à jour" du top 307.
 *
 * Lit `src/data/v2-freshness-audit.json` (généré par
 * `scripts/fetch-filing-dates.py`) + complète avec les latest_filing
 * trouvés dans `v2-pipeline-enrich/<t>.json` côté yfinance fallback.
 *
 * Yann (12 mai 2026) : 91 stés FPI EU enrichies via yfinance. Cette
 * page affiche pour chaque sté :
 *   - statut (à jour / en retard / sans source)
 *   - date du dernier earning intégré
 *   - date du dernier earning publié (SEC ou yfinance)
 *   - écart en jours
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Freshness audit · sandbox",
  robots: { index: false, follow: false },
};

type FreshRow = {
  ticker: string;
  status: "fresh" | "stale" | "no_source";
  local_period_end: string | null;
  source_period_end: string | null;
  source_filing_date: string | null;
  source_form: string | null;
  gap_days: number | null;
};

async function loadAudit(): Promise<FreshRow[]> {
  const ROOT = process.cwd();
  const tickersList = JSON.parse(
    await fs.readFile(path.join(ROOT, "src/data/v1-8-tickers-sorted.json"), "utf-8"),
  ) as string[];
  const top = tickersList.slice(0, 307);

  // Lit l'audit SEC déjà généré (90 stés en retard, etc.)
  let secAudit: { stale: Array<{ ticker: string; local_last_data_date: string; sec_period_end: string; sec_filing_date: string; sec_form: string }> } = { stale: [] };
  try {
    secAudit = JSON.parse(
      await fs.readFile(path.join(ROOT, "src/data/v2-freshness-audit.json"), "utf-8"),
    );
  } catch {
    // pas de fichier audit → on construit depuis les enrichs
  }
  const staleMap = new Map<string, typeof secAudit.stale[number]>();
  for (const row of secAudit.stale ?? []) {
    staleMap.set(row.ticker.toUpperCase(), row);
  }

  const rows: FreshRow[] = [];
  for (const t of top) {
    let filingDate: string | null = null;
    let filingForm: string | null = null;
    let filingPeriodEnd: string | null = null;
    let localPeriodEnd: string | null = null;

    // 1) Lit latest_filing depuis enrich (SEC ou yfinance)
    try {
      const enr = JSON.parse(
        await fs.readFile(path.join(ROOT, `src/data/v2-pipeline-enrich/${t.toLowerCase()}.json`), "utf-8"),
      ) as { latest_filing?: { date?: string; form?: string; period_end?: string } };
      filingDate = enr.latest_filing?.date ?? null;
      filingForm = enr.latest_filing?.form ?? null;
      filingPeriodEnd = enr.latest_filing?.period_end ?? null;
    } catch {
      // pas d'enrich pour ce ticker
    }

    // 2) Lit last_data_date du hero KPI dans v2-pipeline
    try {
      const pip = JSON.parse(
        await fs.readFile(path.join(ROOT, `src/data/v2-pipeline/${t.toLowerCase()}.json`), "utf-8"),
      ) as { hero_kpi?: string; kpis?: Array<{ short?: string; last_data_date?: string }> };
      const hero = pip.kpis?.find((k) => k.short === pip.hero_kpi) ?? pip.kpis?.[0];
      localPeriodEnd = hero?.last_data_date ?? null;
    } catch {
      // pas de pipeline pour ce ticker
    }

    // 3) Calcule gap_days + status
    let gap: number | null = null;
    let status: FreshRow["status"] = "no_source";
    if (filingPeriodEnd && localPeriodEnd) {
      const a = new Date(localPeriodEnd).getTime();
      const b = new Date(filingPeriodEnd).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        gap = Math.round((b - a) / 86_400_000);
        status = gap > 30 ? "stale" : "fresh";
      }
    } else if (filingDate || filingPeriodEnd) {
      status = "fresh";
    } else {
      status = "no_source";
    }
    rows.push({
      ticker: t,
      status,
      local_period_end: localPeriodEnd,
      source_period_end: filingPeriodEnd,
      source_filing_date: filingDate,
      source_form: filingForm,
      gap_days: gap,
    });
  }
  return rows;
}

export default async function FreshnessAuditPage() {
  const rows = await loadAudit();
  const total = rows.length;
  const fresh = rows.filter((r) => r.status === "fresh").length;
  const stale = rows.filter((r) => r.status === "stale").length;
  const noSource = rows.filter((r) => r.status === "no_source").length;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/sandbox/v1-8"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour sandbox V1.8
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          Audit freshness · top 307 V1.8
        </h1>
        <p className="mb-6 max-w-2xl text-[13px] text-zinc-400">
          État de la fraîcheur des données par sté : compare la dernière
          période fiscale intégrée localement (<code className="font-mono text-zinc-500">v2-pipeline</code>)
          avec la dernière période publiée selon SEC EDGAR ou yfinance.
        </p>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Total" value={total} color="#a1a1aa" Icon={null} />
          <StatBox label="À jour" value={fresh} color="#10b981" Icon={CheckCircle2} />
          <StatBox label="En retard (>30j)" value={stale} color="#f59e0b" Icon={AlertTriangle} />
          <StatBox label="Sans source" value={noSource} color="#6b7280" Icon={HelpCircle} />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Ticker</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-left">Local (pipeline)</th>
                <th className="px-3 py-2 text-left">Source publiée</th>
                <th className="px-3 py-2 text-center">Form</th>
                <th className="px-3 py-2 text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const color =
                  r.status === "fresh"
                    ? "#10b981"
                    : r.status === "stale"
                      ? "#f59e0b"
                      : "#6b7280";
                return (
                  <tr key={r.ticker} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-zinc-100">
                      <Link href={`/sandbox/v1-8/${r.ticker.toLowerCase()}`} className="hover:underline">
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                        style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
                      >
                        {r.status === "fresh" ? "à jour" : r.status === "stale" ? "en retard" : "sans source"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{r.local_period_end ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{r.source_period_end ?? "—"}</td>
                    <td className="px-3 py-2 text-center font-mono text-[10.5px] text-zinc-400">{r.source_form ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.gap_days !== null ? (
                        <span style={{ color: r.gap_days > 30 ? "#f59e0b" : "#10b981" }}>
                          {r.gap_days > 0 ? `+${r.gap_days}` : r.gap_days}j
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[11.5px] text-zinc-500">
          Pour ré-extraire les stés en retard : <code className="font-mono text-zinc-400">python3 scripts/fetch-filing-dates.py --top 307</code> + ré-extraction KPIs.
        </p>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  Icon,
}: {
  label: string;
  value: number;
  color: string;
  Icon: typeof CheckCircle2 | null;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        {Icon && <Icon className="size-3.5" style={{ color }} />}
        {label}
      </div>
      <div className="mt-1 font-display text-[28px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
