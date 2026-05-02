import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { promises as fs } from "fs";
import path from "path";
import { CompanyLogo } from "@/components/logos";
import { brand } from "@/lib/brand";
import type { Company } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "V1.6 — Pipeline LLM (35 stés) · Sandbox",
  robots: { index: false, follow: false },
};

async function loadPipelineDatasets(): Promise<Record<string, Company>> {
  const dir = path.join(process.cwd(), "src/data/v2-pipeline");
  try {
    const merged = await fs.readFile(path.join(dir, "_merged.json"), "utf-8");
    return JSON.parse(merged) as Record<string, Company>;
  } catch {
    return {};
  }
}

export default async function SandboxV16HubPage() {
  const datasets = await loadPipelineDatasets();
  const tickers = Object.keys(datasets).sort();

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/sandbox"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour Sandbox
        </Link>

        <div className="mb-3 flex items-baseline gap-3">
          <Sparkles className="size-5 text-cyan-300" />
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            V1.6 — Pipeline LLM
          </h1>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
            {tickers.length} stés extraites auto
          </span>
        </div>
        <p className="mb-2 max-w-3xl text-[14px] text-zinc-400">
          <strong className="text-cyan-200">Top 20 cat 1 (US)</strong> + <strong className="text-cyan-200">top 20 cat 2 (FPI)</strong> traitées via le pipeline
          LLM multi-provider (Groq, Cerebras, SambaNova, OpenRouter, Together).
          Pass 1 : Hero KPI + KPI segments + stories. Pass 2 : risks + gouvernance + IA positioning.
        </p>
        <p className="mb-8 max-w-3xl text-[12px] text-amber-200/80">
          ⚠ Données extraites automatiquement depuis 10-K / 20-F / 40-F. À valider visuellement avant scaling Phase B (1500 cat 1).
          Source : <code className="text-zinc-400">src/data/v2-pipeline/</code>
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tickers.map((t) => {
            const c = datasets[t];
            if (!c) return null;
            const accent = brand(t).primary;
            const kpis = (c.kpis as Array<{ is_short_history?: boolean }>) || [];
            const wow = kpis.filter((k) => !k.is_short_history).length;
            const stories = kpis.filter((k) => k.is_short_history).length;
            const risks = (c as Company & { risks?: unknown[] }).risks?.length ?? 0;
            const hasGov = !!(c as Company & { governance?: unknown }).governance;
            const hasAI = !!(c as Company & { ai_positioning?: unknown }).ai_positioning;

            return (
              <Link
                key={t}
                href={`/sandbox/v1-6/${t.toLowerCase()}`}
                className="group flex flex-col rounded-xl border border-cyan-500/15 bg-white/[0.02] p-4 transition-colors hover:border-cyan-500/40 hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="size-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
                    <CompanyLogo ticker={t} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                        {t}
                      </span>
                      <span className="font-display text-[13.5px] font-bold text-zinc-50 truncate">{c.name}</span>
                    </div>
                    <div className="text-[10.5px] text-zinc-500">
                      {c.sector}
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-baseline justify-between border-t border-white/8 pt-2">
                  <div className="text-[10.5px] text-zinc-400">
                    <span className="font-mono font-semibold text-cyan-200">{c.hero_kpi}</span>
                  </div>
                  <div className="text-[9.5px] text-zinc-500 inline-flex items-center gap-1">
                    <span>{wow} KPI</span>
                    <span className="text-zinc-700">·</span>
                    <span>{stories}st</span>
                    {risks > 0 && (<><span className="text-zinc-700">·</span><span title="risks">{risks}r</span></>)}
                    {hasGov && <span className="text-emerald-400" title="governance">G</span>}
                    {hasAI && <span className="text-violet-300" title="AI positioning">AI</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            Légende
          </h3>
          <ul className="space-y-1">
            <li>• <strong className="text-cyan-200">Hero KPI</strong> : segment driver choisi par le LLM</li>
            <li>• <strong>X KPI</strong> : KPI normaux (5+ ans d&apos;historique)</li>
            <li>• <strong>Yst</strong> : KPI stories (court historique, valeur dernier exercice)</li>
            <li>• <strong>Zr</strong> : nombre de risks scorés</li>
            <li>• <strong className="text-emerald-400">G</strong> : governance extraite (DEF14A) | <strong className="text-violet-300">AI</strong> : AI positioning</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
