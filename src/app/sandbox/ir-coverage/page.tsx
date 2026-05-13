import COVERAGE from "@/data/ir-coverage-per-ticker.json";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";
export const metadata = {
  title: "Couverture IR · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

type CovEntry = {
  ticker: string;
  cat: string;
  sec_total: number;
  ir_total: number;
  grand_total: number;
  sec_us?: Record<string, Record<string, number>>;
  sec_fpi?: Record<string, Record<string, number>>;
  sec_eu?: Record<string, number>;
  ir_scrape?: Record<string, number>;
  desktop_legacy?: Record<string, number>;
};

type CovFile = {
  generated_at: string;
  total_tickers: number;
  by_cat: Record<string, { count: number; sec_avg: number; ir_avg: number; sec_sum: number; ir_sum: number }>;
  stats: { no_docs_at_all: number; only_sec: number; only_ir: number; both_sec_and_ir: number };
  coverage: Record<string, CovEntry>;
};

const DATA = COVERAGE as unknown as CovFile;

function catBadge(c: string) {
  const map: Record<string, string> = {
    cat1: "bg-violet-500/15 text-violet-200",
    cat2: "bg-cyan-500/15 text-cyan-200",
    cat3: "bg-amber-500/15 text-amber-200",
    cat4: "bg-rose-500/15 text-rose-200",
  };
  return map[c] ?? "bg-zinc-500/15 text-zinc-200";
}

function totalBadge(n: number) {
  if (n === 0) return "bg-rose-500/20 text-rose-200";
  if (n < 20) return "bg-amber-500/20 text-amber-200";
  if (n < 60) return "bg-zinc-500/15 text-zinc-200";
  return "bg-emerald-500/20 text-emerald-200";
}

export default function IrCoveragePage() {
  const entries = Object.values(DATA.coverage).sort((a, b) => b.grand_total - a.grand_total);

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour sandbox
        </Link>

        <h1 className="font-display text-3xl font-semibold">Couverture documentaire par société</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pour chaque société top 305 (V1.8) + 3 extras V1 demo : nombre de docs récupérés via
          SEC EDGAR (filings réglementaires) et via IR scraper (CFO Commentary, press releases,
          earning slides, transcripts, annual report PDFs, ESG, etc.).
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Sociétés analysées</div>
            <div className="mt-1 text-2xl font-bold">{DATA.total_tickers}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300">SEC + IR</div>
            <div className="mt-1 text-2xl font-bold text-emerald-200">{DATA.stats.both_sec_and_ir}</div>
          </div>
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-cyan-300">SEC seule</div>
            <div className="mt-1 text-2xl font-bold text-cyan-200">{DATA.stats.only_sec}</div>
          </div>
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-rose-300">Aucun doc</div>
            <div className="mt-1 text-2xl font-bold text-rose-200">{DATA.stats.no_docs_at_all}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(DATA.by_cat).map(([cat, s]) => (
            <div key={cat} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${catBadge(cat)}`}>
                  {cat}
                </span>
                <span className="text-[11.5px] text-zinc-400">{s.count} stés</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-zinc-500">Moyenne SEC</div>
                  <div className="font-mono text-base font-bold text-zinc-100">{s.sec_avg}</div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">Moyenne IR</div>
                  <div className="font-mono text-base font-bold text-zinc-100">{s.ir_avg}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Ticker</th>
                <th className="px-3 py-2 text-left">Cat</th>
                <th className="px-3 py-2 text-right">SEC</th>
                <th className="px-3 py-2 text-right">IR</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Détail SEC</th>
                <th className="px-3 py-2 text-left">Détail IR (doctypes)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {entries.map((e) => {
                const secDetail =
                  e.cat === "cat3"
                    ? Object.entries(e.sec_eu ?? {}).map(([k, v]) => `${k}=${v}`).join(" · ")
                    : e.cat === "cat2"
                    ? Object.entries(e.sec_fpi ?? {}).map(([k, sub]) => `${k}=${Object.values(sub).reduce((a, b) => a + b, 0)}`).join(" · ")
                    : Object.entries(e.sec_us ?? {}).map(([k, sub]) => `${k}=${Object.values(sub).reduce((a, b) => a + b, 0)}`).join(" · ");
                const irDetail = Object.entries(e.ir_scrape ?? {})
                  .concat(Object.entries(e.desktop_legacy ?? {}).map(([k, v]) => [`legacy:${k}`, v] as [string, number]))
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" · ");
                return (
                  <tr key={e.ticker} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono font-semibold text-zinc-100">{e.ticker}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${catBadge(e.cat)}`}>{e.cat}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{e.sec_total}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{e.ir_total}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${totalBadge(e.grand_total)}`}>
                        {e.grand_total}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-zinc-500">{secDetail || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-zinc-500">{irDetail || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[11.5px] text-zinc-500">
          Généré le {new Date(DATA.generated_at).toLocaleString("fr-FR")}. Source brute :
          <code className="ml-1 rounded bg-white/5 px-1 py-0.5">src/data/ir-coverage-per-ticker.json</code>.
        </p>
      </div>
    </div>
  );
}
