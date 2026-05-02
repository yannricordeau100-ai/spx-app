import Link from "next/link";
import { ArrowLeft, Sparkles, Clock } from "lucide-react";
import { promises as fs } from "fs";
import path from "path";
import { CompanyLogo } from "@/components/logos";
import { brand } from "@/lib/brand";
import type { Company } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n/server";
import { getTopCompaniesForLocale, type TopCompany } from "@/lib/v1-7/top-companies";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "V1.7 · Mettrik AI",
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

const STR = {
  fr: {
    title: "Sociétés du top 100 France",
    subtitle: "Cliquez sur une société pour voir sa fiche complète : KPI, gouvernance, IA, risques.",
    available: "fiches disponibles",
    coming: "à venir",
    back: "Retour Sandbox",
    legend: "Légende",
    legend1: "Carte colorée : fiche complète disponible (cliquable).",
    legend2: "Carte grise « à venir » : société listée mais données pas encore extraites par le pipeline.",
    sector: "Secteur",
    heroKpi: "KPI principal",
    noKpi: "Pas encore disponible",
    pending_msg: "Cette fiche sera disponible dès que l'autre conversation a fini d'extraire les données depuis ses rapports financiers.",
  },
  en: {
    title: "Top 100 USA companies",
    subtitle: "Click a company to see its full file: KPI, governance, AI, risks.",
    available: "files ready",
    coming: "coming soon",
    back: "Back to Sandbox",
    legend: "Legend",
    legend1: "Coloured card: full file ready (clickable).",
    legend2: "Grey \"coming soon\" card: company listed but pipeline hasn't extracted data yet.",
    sector: "Sector",
    heroKpi: "Hero KPI",
    noKpi: "Not yet available",
    pending_msg: "This file will appear as soon as the other conversation finishes extracting the data from its financial reports.",
  },
};

export default async function SandboxV17HubPage() {
  const datasets = await loadPipelineDatasets();
  const locale = await getServerLocale();
  const t = STR[locale];
  const top = getTopCompaniesForLocale(locale);

  // Split entre fiches dispo et fiches à venir
  const ready: TopCompany[] = [];
  const pending: TopCompany[] = [];
  for (const c of top) {
    if (datasets[c.ticker]) ready.push(c);
    else pending.push(c);
  }

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/sandbox"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {t.back}
        </Link>

        <div className="mb-3 flex items-baseline gap-3">
          <Sparkles className="size-5 text-cyan-300" />
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            V1.7 · {t.title}
          </h1>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
            {ready.length}/{top.length} {t.available}
          </span>
        </div>
        <p className="mb-8 max-w-3xl text-[14px] text-zinc-400">{t.subtitle}</p>

        {/* Cards : fiches disponibles d'abord */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ready.map((c) => {
            const data = datasets[c.ticker];
            const accent = brand(c.ticker).primary;
            const heroKpi = (data as Company & { hero_kpi?: string }).hero_kpi;
            const sector = data?.sector;
            return (
              <Link
                key={c.ticker}
                href={`/sandbox/v1-7/${c.ticker.toLowerCase()}`}
                prefetch={false}
                className="group flex flex-col rounded-xl border border-cyan-500/15 bg-white/[0.02] p-4 transition-colors hover:border-cyan-500/40 hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="size-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
                    <CompanyLogo ticker={c.ticker} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: accent }}
                      >
                        {c.ticker}
                      </span>
                      <span className="truncate font-display text-[13.5px] font-bold text-zinc-50">{c.name}</span>
                    </div>
                    <div className="text-[10.5px] text-zinc-500">{sector ?? "-"}</div>
                  </div>
                </div>
                {heroKpi ? (
                  <div className="mt-1 border-t border-white/8 pt-2">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {t.heroKpi}
                    </div>
                    <div className="text-[12px] font-semibold text-cyan-200">{heroKpi}</div>
                  </div>
                ) : (
                  <div className="mt-1 border-t border-white/8 pt-2 text-[10.5px] italic text-zinc-500">
                    {t.noKpi}
                  </div>
                )}
              </Link>
            );
          })}

          {/* Cards "à venir" : pas encore dans _merged.json */}
          {pending.map((c) => (
            <div
              key={c.ticker}
              title={t.pending_msg}
              className="flex flex-col rounded-xl border border-white/8 bg-white/[0.015] p-4 opacity-60"
            >
              <div className="mb-2 flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                  <span className="font-mono text-[10px] text-zinc-500">{c.ticker.replace(".PA", "").slice(0, 3)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {c.ticker}
                    </span>
                    <span className="truncate font-display text-[13.5px] font-medium text-zinc-300">{c.name}</span>
                  </div>
                </div>
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] text-zinc-500">
                <Clock className="size-3" />
                <span className="italic">{t.coming}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            {t.legend}
          </h3>
          <ul className="space-y-1">
            <li>• {t.legend1}</li>
            <li>• {t.legend2}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
