import path from "node:path";
import fs from "node:fs/promises";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import { isDeskOwner } from "@/lib/desk/auth";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";
import { DailyDocWatcherRunButton } from "./run-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Daily Doc Watcher · V1.9.5 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/daily-doc-watcher
 *
 * Page admin-only (gate isDeskOwner) qui pilote la veille documentaire
 * quotidienne sur les 660 stés clean_all V1.9.5.
 *
 * Yann (27 mai 2026) : permet de visualiser le dernier run du cron 04h00,
 * voir les stés flaggées (earning attendu mais publié / docs périmés > 90j),
 * et déclencher un run manuel via API.
 */

type WatcherStatus = {
  last_run_at: string | null;
  app_version: string;
  docs_downloaded_last_run: number;
  stes_flagged_earning_pending_resolved: string[];
  stes_flagged_docs_stale: string[];
  tickers_processed_last_run: number;
  last_run_status: string;
  last_run_log_path: string | null;
};

async function loadStatus(): Promise<WatcherStatus> {
  const p = path.join(process.cwd(), "src/data/_daily-doc-watcher-status.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as WatcherStatus;
  } catch {
    return {
      last_run_at: null,
      app_version: LATEST_VERSION_SLUG,
      docs_downloaded_last_run: 0,
      stes_flagged_earning_pending_resolved: [],
      stes_flagged_docs_stale: [],
      tickers_processed_last_run: 0,
      last_run_status: "never_ran",
      last_run_log_path: null,
    };
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "jamais";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "jamais";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export default async function DailyDocWatcherPage() {
  const owner = await isDeskOwner();
  if (!owner) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <p className="text-sm text-slate-400">Accès restreint. Connecte-toi avec le compte admin.</p>
      </main>
    );
  }

  const status = await loadStatus();
  const totalFlagged =
    status.stes_flagged_earning_pending_resolved.length + status.stes_flagged_docs_stale.length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="space-y-3">
          <Link
            href="/sandbox"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour sandbox
          </Link>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            Daily Doc Watcher
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Veille documentaire quotidienne des stés clean_all V1.9.5. Tourne automatiquement à 04h00
            via crontab. Cette page affiche le dernier run et permet d&apos;en déclencher un manuellement.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Version app courante"
            value={status.app_version.toUpperCase()}
            sub={`source : src/lib/version-routing.ts`}
            tone="violet"
          />
          <StatCard
            icon={<RefreshCw className="h-4 w-4" />}
            label="Dernier run"
            value={formatRelative(status.last_run_at)}
            sub={status.last_run_at ?? "—"}
            tone="cyan"
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Docs téléchargés (dernier run)"
            value={String(status.docs_downloaded_last_run)}
            sub={`${status.tickers_processed_last_run} tickers traités`}
            tone="emerald"
          />
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                Déclencher un run maintenant
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                POST /api/sandbox/daily-doc-watcher/run · admin-gated. Lance le script Python en arrière-plan.
              </p>
            </div>
            <DailyDocWatcherRunButton />
          </div>
          <div className="text-xs text-slate-500">
            Statut dernier run :{" "}
            <span className="font-mono text-slate-300">{status.last_run_status}</span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
              Stés flaggées &quot;earning attendu mais publié&quot;
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              {status.stes_flagged_earning_pending_resolved.length} sté
              {status.stes_flagged_earning_pending_resolved.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            next_earnings_date passé sans nouveau filing détecté. Cas NVDA notamment : un earning call a
            eu lieu mais le 10-Q n&apos;est pas encore disponible côté SEC EDGAR.
          </p>
          <TickerGrid tickers={status.stes_flagged_earning_pending_resolved} tone="amber" />
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
              Stés avec docs périmés (&gt; 90 jours)
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              {status.stes_flagged_docs_stale.length} sté
              {status.stes_flagged_docs_stale.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Aucun filing IR récent disponible : nécessite scrape complémentaire.
          </p>
          <TickerGrid tickers={status.stes_flagged_docs_stale} tone="rose" />
        </section>

        {totalFlagged === 0 && status.last_run_status === "never_ran" ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Aucun run effectué pour l&apos;instant. Le cron 04h00 prendra le relais cette nuit, ou
              clique sur &quot;Run now&quot; ci-dessus.
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "violet" | "cyan" | "emerald";
}) {
  const accent = {
    violet: "from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-200",
    cyan: "from-cyan-500/20 to-sky-500/10 border-cyan-500/30 text-cyan-200",
    emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-200",
  }[tone];

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${accent}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-display font-semibold text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-slate-400 font-mono truncate">{sub}</div>
    </div>
  );
}

function TickerGrid({ tickers, tone }: { tickers: string[]; tone: "amber" | "rose" }) {
  if (tickers.length === 0) {
    return <p className="text-xs text-slate-500 italic">Aucune sté flaggée.</p>;
  }
  const chipClass =
    tone === "amber"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-rose-500/40 bg-rose-500/10 text-rose-200";

  return (
    <div className="flex flex-wrap gap-1.5">
      {tickers.map((t) => (
        <span
          key={t}
          className={`inline-block rounded px-2 py-0.5 text-[11px] font-mono border ${chipClass}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
