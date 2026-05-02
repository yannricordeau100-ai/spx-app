import Link from "next/link";
import { ArrowLeft, Globe2 } from "lucide-react";
import { V2_COMPANIES, V2_TICKERS } from "@/lib/v2-data";
import { CompanyLogo } from "@/components/logos";
import { brand } from "@/lib/brand";

export const metadata = {
  title: "V1.5 (FPI) · Sandbox · Mettrik AI",
  robots: { index: false, follow: false },
};

export default function SandboxV2HubPage() {
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
          <Globe2 className="size-5 text-amber-300" />
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            V1.5 cat 2 — FPI étrangères
          </h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
            DRAFT
          </span>
        </div>
        <p className="mb-2 max-w-3xl text-[14px] text-zinc-400">
          Clone de l&apos;app V1 (Hero KPI / Indicateurs / Stories) appliqué aux <strong className="text-amber-200">50 plus grosses
          sociétés étrangères cotées US</strong> (ADR). Niveaux de raffinage variables : 3 stés depuis 20-F SEC officiels (TSM, ASML, NVO), 7 stés
          depuis seed publique enrichie, 40 stés en datasets minimaux à enrichir round 2.
        </p>
        <p className="mb-8 max-w-3xl text-[12px] text-amber-200/80">
          ⚠ Données DRAFT — chiffres approximatifs basés sur 20-F, ER et IR pages publiques 2023-2025.
          La V1 live (5 sociétés US) reste la source de vérité production.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {V2_TICKERS.map((t) => {
            const c = V2_COMPANIES[t];
            if (!c) return null;
            const accent = brand(t).primary;
            const wowKpis = c.kpis.filter((k) => k.is_wow).length;
            const stories = c.kpis.filter((k) => k.is_short_history).length;
            return (
              <Link
                key={t}
                href={`/sandbox/v2/${t.toLowerCase()}`}
                className="group flex flex-col rounded-xl border border-amber-500/15 bg-white/[0.02] p-5 transition-colors hover:border-amber-500/40 hover:bg-white/[0.04]"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="size-12 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                    <CompanyLogo ticker={t} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                        {t}
                      </span>
                      <span className="font-display text-[15px] font-bold text-zinc-50">{c.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {c.sector} · {c.subsector}
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-[12px] italic leading-snug text-zinc-400">
                  &ldquo;{c.tagline}&rdquo;
                </p>
                <div className="mt-auto flex items-baseline justify-between border-t border-white/8 pt-3">
                  <div className="text-[11px] text-zinc-400">
                    <span className="font-mono font-semibold text-amber-200">Hero :</span>{" "}
                    <span className="text-zinc-200">{c.hero_kpi}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {c.kpis.length} KPI · {wowKpis} wow · {stories} stories
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            Logique appliquée
          </h3>
          <ul className="space-y-1.5">
            <li>• Hero KPI choisi = segment qui change la trajectoire (HPC pour TSM, GLP-1 pour NVO, etc.)</li>
            <li>• Indicateurs clés = mix wow + generic (5-7 par sté)</li>
            <li>• Bloc Stories = KPI short-history (lancement segment IA, capex shift, pipelines pharma...)</li>
            <li>• Devises locales conservées (€, DKK, JPY, CNY) — pas de conversion forcée USD</li>
            <li>• Pas de risks / governance / AI-positioning (V2 minimal pour l&apos;instant)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
