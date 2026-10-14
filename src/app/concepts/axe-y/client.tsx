"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company } from "@/lib/data";
import { buildChartSpec } from "@/lib/chart-template";
import { ChartCycle, type ChartMode, type GraphPeriod } from "@/components/chart-cycle";
import { STYLES_AXE_Y, StyleAxeYContext, STYLE_AXE_Y_ACTIF, type IdStyleAxeY } from "@/lib/style-axe-y";
import { downloadSvgAsPng } from "@/lib/chart-export";
import { ImageFindingsBlock } from "@/components/image-findings-block";

// 14 oct 2026 : A, B, C refusees par Yann, visibles seulement avec ?seul=A (B, C) ou ?refusees=1.
const ORDRE: IdStyleAxeY[] = ["actuel", "sobre", "D", "E", "F", "G"];
const REFUSEES: IdStyleAxeY[] = ["A", "B", "C"];
const MODES: { id: ChartMode; nom: string }[] = [
  { id: "bars", nom: "Barres" },
  { id: "curve", nom: "Courbe" },
  { id: "delta", nom: "Variation" },
];

function lireParam(nom: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(nom);
}

export function AxeYClient({ company, mt }: { company: Company | null; mt: Record<string, string | null> }) {
  // Parametres d URL lus apres montage (captures : ?mode=curve, ?seul=A).
  const [mode, setMode] = useState<ChartMode>("bars");
  const [seul, setSeul] = useState<string | null>(null);
  const [refusees, setRefusees] = useState(false);
  const [blocFiche, setBlocFiche] = useState(false);
  useEffect(() => {
    const m = lireParam("mode");
    if (m === "curve" || m === "delta") setMode(m);
    setSeul(lireParam("seul"));
    setRefusees(lireParam("refusees") === "1");
    setBlocFiche(lireParam("bloc") === "1");
  }, []);
  const k = company?.kpis.find((x) => x.short === company.hero_kpi) ?? company?.kpis[0];
  const periode: GraphPeriod = k?.period_type === "quarter" && (k.history?.length ?? 0) >= 4 ? "quarter" : "year";
  const spec = useMemo(() => (k && company ? buildChartSpec(k, company.ticker, periode) : null), [k, company, periode]);
  const labels = useMemo(() => {
    if (!k || !spec) return undefined;
    const hp = (k as { history_periods?: unknown[] }).history_periods;
    const n = spec.values.length;
    if (k.period_type !== "quarter" && k.period_type !== "semester" && Array.isArray(hp) && hp.length === n && n > 0
      && hp.every((x) => typeof x === "string" && /^(?:FY)?\s*\d{4}$/i.test(x.trim()))) {
      return (hp as string[]).map((x) => x.trim().replace(/^FY\s*/i, ""));
    }
    return spec.labels.length === n ? spec.labels : undefined;
  }, [k, spec]);

  const styles = [...ORDRE, ...REFUSEES].filter((id) => (seul ? seul === id : ORDRE.includes(id) || refusees));

  return (
    <div className="min-h-screen bg-[#050507] px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold">Écriture de l&apos;axe vertical : 4 nouvelles propositions</h1>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
            Même graphique réel pour chaque style : le KPI principal de Caterpillar
            ({k ? (k.name_fr || k.short) : "indisponible"}) et un indicateur moyen terme
            (production d&apos;engins de chantier aux États-Unis). Seule l&apos;écriture de l&apos;axe
            vertical change. Rien n&apos;est en ligne : style actif aujourd&apos;hui = « {STYLES_AXE_Y[STYLE_AXE_Y_ACTIF].nom} ».
            Les propositions A, B et C (refusées le 13 octobre) restent visibles avec <code>?refusees=1</code>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${mode === m.id ? "border-violet-400/60 bg-violet-500/15 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
                {m.nom}
              </button>
            ))}
          </div>
        </header>

        {/* 14 oct 2026 : le VRAI bloc des fiches (style en ligne), pour verifier la
            version mobile des KPI moyen terme (?bloc=1). */}
        {blocFiche ? (
          <section data-bloc-fiche-mt className="mb-6 max-w-[880px]">
            <ImageFindingsBlock
              ticker="CAT"
              nomSociete="Caterpillar"
              findings={[{
                id: "concept-axe-y",
                image_url: "",
                image_local_path: "/findings/societes/cat/cat-production-engins-chantier-us-dark.svg",
                title: "Caterpillar : production d'engins de chantier aux États-Unis",
                caption: null,
                summary: null,
                source_url: null,
                source_author: null,
                source_handle: null,
                source_date: null,
                source_platform: null,
              }]}
            />
          </section>
        ) : null}
        <div className="grid gap-6">
          {styles.map((id) => {
            const s = STYLES_AXE_Y[id];
            return (
              <section key={id} data-style-axe-y={id} className="rounded-2xl border border-[#1f1f1f] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-4 sm:p-6">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-violet-300">{id === "actuel" ? "Référence" : REFUSEES.includes(id) ? `Proposition ${id} (refusée)` : `Proposition ${id}`}</div>
                  <h2 className="mt-1 text-[18px] font-semibold">{s.nom}</h2>
                  <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-zinc-400">{s.parti}</p>
                </div>
                <div className="grid max-w-[880px] gap-8">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] text-zinc-500">
                      <span>Graphique principal (fiche CAT)</span>
                      {/* 14 oct 2026 : PNG telecharge dans le style de la section (meme export que les fiches). */}
                      <button
                        type="button"
                        data-export-axe-y={id}
                        onClick={() => {
                          const svg = document.querySelector<SVGSVGElement>(`section[data-style-axe-y="${id}"] svg[data-chart-export="true"]`);
                          if (svg) void downloadSvgAsPng(svg, `mettrik-axe-y-${id}.png`, { title: `${k?.name_fr || k?.short || ""} · Caterpillar`, ticker: "CAT", locale: "fr" });
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-zinc-300 hover:text-zinc-100"
                      >
                        Télécharger le PNG
                      </button>
                    </div>
                    {spec && k && company ? (
                      <StyleAxeYContext.Provider value={id}>
                        <ChartCycle
                          mode={mode}
                          data={spec.values.map((v) => v * spec.scaleFactor)}
                          labels={labels}
                          unit={spec.unit}
                          color="#f59e0b"
                          company={company}
                          activeShort={k.short}
                          ttm={spec.ttm == null ? null : spec.ttm * spec.scaleFactor}
                          periodType={periode}
                          exportTitle={k.name_fr || k.short}
                        />
                      </StyleAxeYContext.Provider>
                    ) : (
                      <div className="text-[13px] text-zinc-500">Fiche CAT indisponible.</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 text-[12.5px] text-zinc-500">Indicateur moyen terme (image générée)</div>
                    {mt[id] ? (
                      // 14 oct 2026 : sous 640 px, version mobile (chiffres de 11 px reels au moins).
                      <picture>
                        {mt[`${id}-mobile`] ? <source media="(max-width: 639px)" srcSet={mt[`${id}-mobile`] as string} /> : null}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mt[id] as string} alt={`Production d'engins de chantier, style ${id}`} className="w-full rounded-xl" />
                      </picture>
                    ) : (
                      <div className="text-[13px] text-zinc-500">Image non générée.</div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
