import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { promises as fs } from "fs";
import path from "path";
import { CompanyLogo } from "@/components/logos";
import { brand } from "@/lib/brand";
import type { Company } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "V1.7 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * V1.7 hub : ne montre QUE les sociétés Pass 3 validées par CONV-DATA
 * (champ `_validation` ou `_validation_global` présent = vérification
 * Sonnet du dataset). Hors transcripts (workflow séparé).
 *
 * Décision Yann 3 mai 2026 : V1.7 = qualité top-top uniquement. Les stés
 * Pass 1/2 brutes (extraction LLM non validée) sont visibles via /sandbox/v1-6
 * qui affiche les 1606 stés du pipeline sans distinction.
 */
async function loadValidatedDatasets(): Promise<Record<string, Company>> {
  const dir = path.join(process.cwd(), "src/data/v2-pipeline");
  try {
    const merged = await fs.readFile(path.join(dir, "_merged.json"), "utf-8");
    const all = JSON.parse(merged) as Record<string, Company & { _validation?: unknown; _validation_global?: unknown }>;
    const out: Record<string, Company> = {};
    for (const [t, v] of Object.entries(all)) {
      if (v && typeof v === "object" && (v._validation || v._validation_global)) {
        out[t] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

const STR = {
  fr: {
    title: "Sociétés validées Pass 3",
    subtitle:
      "Fiches dont l'extraction KPI a été repassée par Sonnet (validation Pass 3). Hors transcripts.",
    available: "fiches validées",
    back: "Retour Sandbox",
    legend: "Méthodologie",
    legend1: "Pass 3 = vérification Sonnet du dataset extrait par les passes 1/2 (LLM brut). Erreurs corrigées, hallucinations filtrées.",
    legend2: "Pour voir TOUTES les stés du pipeline (Pass 1/2 brutes incluses), va sur /sandbox/v1-6.",
    sector: "Secteur",
    heroKpi: "KPI principal",
    noKpi: "Pas de hero KPI",
    seeAll: "Voir toutes les sociétés extraites (V1.6)",
  },
  en: {
    title: "Pass 3 validated companies",
    subtitle:
      "Files whose KPI extraction has been double-checked by Sonnet (Pass 3 validation). Excludes transcripts.",
    available: "validated files",
    back: "Back to Sandbox",
    legend: "Methodology",
    legend1: "Pass 3 = Sonnet review of the dataset extracted by passes 1/2 (raw LLM). Errors fixed, hallucinations filtered.",
    legend2: "To see ALL pipeline companies (raw Pass 1/2 included), go to /sandbox/v1-6.",
    sector: "Sector",
    heroKpi: "Hero KPI",
    noKpi: "No hero KPI",
    seeAll: "See all extracted companies (V1.6)",
  },
};

export default async function SandboxV17HubPage() {
  const datasets = await loadValidatedDatasets();
  const localeFull = await getServerLocale();
  const locale: "fr" | "en" = localeFull === "fr" ? "fr" : "en";
  const t = STR[locale];

  // Tri : par secteur puis par ticker, pour faciliter la lecture par cluster.
  const tickers = Object.keys(datasets).sort((a, b) => {
    const sa = datasets[a]?.sector ?? "";
    const sb = datasets[b]?.sector ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.localeCompare(b);
  });

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
          <Sparkles className="size-5 text-amber-300" />
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            V1.7 · {t.title}
          </h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
            {tickers.length} {t.available}
          </span>
        </div>
        <p className="mb-8 max-w-3xl text-[14px] text-zinc-400">{t.subtitle}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tickers.map((tk) => {
            const data = datasets[tk];
            const accent = brand(tk).primary;
            const heroKpi = (data as Company & { hero_kpi?: string }).hero_kpi;
            const sector = data?.sector;
            return (
              <Link
                key={tk}
                href={`/sandbox/v1-7/${tk.toLowerCase()}`}
                prefetch={false}
                className="group flex flex-col rounded-xl border border-amber-500/30 bg-white/[0.02] p-4 transition-colors hover:border-amber-500/60 hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="size-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
                    <CompanyLogo ticker={tk} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: accent }}
                      >
                        {tk}
                      </span>
                      <span className="truncate font-display text-[13.5px] font-bold text-zinc-50">{data.name}</span>
                      <span className="ml-auto rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200">
                        ✓ Pass 3
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-500">{sector ?? "-"}</div>
                  </div>
                </div>
                {heroKpi ? (
                  <div className="mt-1 border-t border-white/8 pt-2">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {t.heroKpi}
                    </div>
                    <div className="text-[12px] font-semibold text-amber-200">{heroKpi}</div>
                  </div>
                ) : (
                  <div className="mt-1 border-t border-white/8 pt-2 text-[10.5px] italic text-zinc-500">
                    {t.noKpi}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            {t.legend}
          </h3>
          <ul className="space-y-1 mb-3">
            <li>• {t.legend1}</li>
            <li>• {t.legend2}</li>
          </ul>
          <Link
            href="/sandbox/v1-6"
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[12px] text-cyan-200 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/15"
          >
            {t.seeAll} →
          </Link>
        </div>
      </div>
    </div>
  );
}
