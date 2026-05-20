import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EXTENDED from "@/data/v1-9-status-extended.json";

export const dynamic = "force-static";
export const revalidate = 3600;
export const metadata = {
  title: "Suivi enrichissement V1.9 (Top 307 + SP500 + Indices EU) · Mettrik AI",
  robots: { index: false, follow: false },
};

type ScopeStat = {
  total: number;
  publishable: number;
  difficile: string[];
  impossible: string[];
};
type ExtendedJson = {
  generated_at: string;
  top307: ScopeStat;
  sp500: ScopeStat;
  indices_eu: ScopeStat;
};

const data = EXTENDED as ExtendedJson;

function ScopeSection({
  title,
  icon,
  stat,
  difficileTooltip,
  impossibleTooltip,
}: {
  title: string;
  icon: string;
  stat: ScopeStat;
  difficileTooltip: string;
  impossibleTooltip: string;
}) {
  const pubPct = Math.round((100 * stat.publishable) / stat.total);
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold">
        {icon} {title} — {stat.publishable}/{stat.total} publiées ({pubPct}%)
      </h2>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            ✅ Publiées V1.9
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-300">
            {stat.publishable}
          </div>
        </div>
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
          title={difficileTooltip}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
            🟡 Difficiles (sources OK)
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-300">
            {stat.difficile.length}
          </div>
          <div className="mt-1 text-[10.5px] text-zinc-500">
            Docs disponibles, extraction KPI à reprendre
          </div>
        </div>
        <div
          className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4"
          title={impossibleTooltip}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-rose-400">
            🔴 Impossibles (sans source)
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-rose-300">
            {stat.impossible.length}
          </div>
          <div className="mt-1 text-[10.5px] text-zinc-500">
            Pas de 10-K/20-F local (delisted, racheté, ADR sans filing)
          </div>
        </div>
      </div>

      {stat.difficile.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-4">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-amber-400">
            Difficiles ({stat.difficile.length}) — docs locaux, extraction KPI manquante
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stat.difficile.map((t) => (
              <span
                key={t}
                className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-2 py-0.5 font-mono text-[11px] text-amber-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {stat.impossible.length > 0 && (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] p-4">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-rose-400">
            Impossibles ({stat.impossible.length}) — scrape externe via organismes pays nécessaire
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stat.impossible.map((t) => (
              <span
                key={t}
                className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] px-2 py-0.5 font-mono text-[11px] text-rose-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function V19StatusPage() {
  const totalT = data.top307.total + data.sp500.total + data.indices_eu.total;
  const totalPub = data.top307.publishable + data.sp500.publishable + data.indices_eu.publishable;
  const totalDiff = data.top307.difficile.length + data.sp500.difficile.length + data.indices_eu.difficile.length;
  const totalImp = data.top307.impossible.length + data.sp500.impossible.length + data.indices_eu.impossible.length;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour accueil
        </Link>

        <h1 className="font-display text-[28px] font-bold tracking-tight">
          Suivi enrichissement V1.9 — Top 307 + SP500 + Indices EU
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Statut pipeline Mettrik AI sur les <strong>{totalT}</strong> stés
          V1.9. Critères publishable :{" "}
          <strong>hero KPI spécifique + 3+ ans d&apos;historique + 3+ KPI
          spécifiques + description ≥ 100 chars</strong>.
        </p>
        <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-zinc-500">
          Dernière mise à jour : {new Date(data.generated_at).toLocaleString("fr-FR")}.
        </p>

        {/* Synthèse globale */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Univers total
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-zinc-100">
              {totalT}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Publiées
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-300">
              {totalPub}
            </div>
            <div className="mt-1 text-[10.5px] text-zinc-500">
              {Math.round((100 * totalPub) / totalT)}% du total
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
              Difficiles
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-300">
              {totalDiff}
            </div>
            <div className="mt-1 text-[10.5px] text-zinc-500">Sources OK, extraction à faire</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-rose-400">
              Impossibles
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-rose-300">
              {totalImp}
            </div>
            <div className="mt-1 text-[10.5px] text-zinc-500">Pas de docs locaux</div>
          </div>
        </div>

        <ScopeSection
          title="Top 307 V1.8"
          icon="🌍"
          stat={data.top307}
          difficileTooltip="307 plus grosses stés mondiales. Docs locaux disponibles, mais extraction KPI à reprendre (hero générique, KPIs purgés par reverify)."
          impossibleTooltip="Stés du top 307 sans documents 10-K/20-F/annual-text. Probablement delisted, fusionnées ou ADR sans filing SEC."
        />

        <ScopeSection
          title="S&P 500"
          icon="🇺🇸"
          stat={data.sp500}
          difficileTooltip="Index S&P 500 US. Toutes ont 10-K dans sec-data, extraction LLM à compléter (sub-agents Claude en cours)."
          impossibleTooltip="Stés SP500 sans 10-K local : très rare, généralement spin-off très récents ou multi-classes mal mappés."
        />

        <ScopeSection
          title="Indices européens"
          icon="🇪🇺"
          stat={data.indices_eu}
          difficileTooltip="CAC 40 + FTSE 100 + DAX 40 + SMI + BEL 20 + FTSE MIB + AEX + ATX (hors top 307 + SP500). Docs locaux partiels — scrape complément via organismes pays nécessaire (AMF.fr, BaFin, Companies House, SIX, CONSOB, AFM, FSMA, FMA)."
          impossibleTooltip="Stés européennes sans aucun document local. Scrape externe via IR pages officielles ou organismes pays."
        />

        <p className="mt-8 text-[11px] italic text-zinc-500">
          Mise à jour automatique au rebuild pipeline (script{" "}
          <span className="font-mono">scripts/audit-v1-9-publishable.js</span>).
          Les stés publishable apparaissent sur{" "}
          <span className="font-mono">/sandbox/v1-9/&lt;ticker&gt;</span>.
        </p>
      </div>
    </div>
  );
}
