"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { KPI } from "@/lib/data";
import { formatUnit } from "@/lib/data";
import type { StorySlide } from "@/lib/kpi-stories-ordering";
import { storyFamily, STORY_FAMILIES, orderedFamilies, type StoryFamilyKey } from "@/lib/story-family";
import { storyFmt } from "@/components/kpi-story-card";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { kpiPeriodLabel } from "@/lib/period-label";
import { InfoTooltip } from "@/components/info-tooltip";

const RechartLineChart = dynamic(() => import("./recharts-story-chart"), { ssr: false });

/**
 * Style « Mur de cartes » du bloc stories (ordinateur uniquement).
 * Porte en production le concept /concepts/kpi-court-terme/mur : memes
 * stories que le carrousel, a plat, en grille compacte a hauteur plafonnee
 * (defilement interne), clic = detail en surimpression avec fleches.
 * Floutage : memes zones nommees que les cartes story (titre, texte, carte).
 */

type Carte = {
  id: string;
  famille: StoryFamilyKey;
  titre: string;
  periode: string | null;
  valeur: string;
  unite: string;
  yoy: string | null;
  signal: string;
  description: string;
  explication: string;
  date: number;
  serie: Array<{ q: string; v: number }>;
  evenement: boolean;
  etiquette: string;
  anglais: string;
};

function enCarte(sl: StorySlide, i: number, ticker: string, locale: string): Carte {
  if (sl.kind !== "kpi") {
    const m = sl.data as { segment_name?: string; segment_revenue?: number | string; segment_unit?: string };
    return {
      id: `mp-${i}`, famille: "marche", titre: m.segment_name ?? "", periode: null,
      valeur: String(m.segment_revenue ?? "").replace(".", ","), unite: formatUnit(m.segment_unit ?? ""),
      yoy: null, signal: "", description: "", explication: "", date: 0, serie: [], evenement: false, etiquette: "", anglais: "",
    };
  }
  const k = sl.data as KPI;
  const ev = !!k.evenement_groupe;
  const f = ev ? { value: k.value_display ?? String(k.value ?? ""), unit: k.unit ?? "" } : storyFmt(k.value, k.unit);
  const a = (k as { approx?: string }).approx;
  const hist = Array.isArray(k.history) ? (k.history as unknown[]) : [];
  const serie: Carte["serie"] = [];
  for (const h of hist) {
    if (h && typeof h === "object") {
      const o = h as { q?: unknown; v?: unknown };
      const v = typeof o.v === "number" ? o.v : parseFloat(String(o.v));
      if (Number.isFinite(v) && o.q) serie.push({ q: String(o.q), v });
    }
  }
  const d = k.last_data_date ? Date.parse(String(k.last_data_date)) : NaN;
  const yoy = typeof k.yoy === "string" && k.yoy.trim() && k.yoy.toLowerCase() !== "n/a"
    ? k.yoy.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %")
    : null;
  return {
    id: `kpi-${k.short ?? i}-${i}`,
    famille: storyFamily(k),
    titre: normalizeNarrative(k.name_fr ?? ""),
    periode: ev ? (k.evenement_periode || null) : kpiPeriodLabel(k as unknown as { last_data_date?: string | null; history_periods?: unknown; history?: unknown }, ticker, locale),
    valeur: a === "min" ? `${f.value}+` : a === "env" ? `≈${f.value}` : f.value,
    unite: f.unit,
    yoy,
    signal: normalizeNarrative(k.signal ?? ""),
    description: ev ? "" : normalizeNarrative(k.description ?? ""),
    explication: k.explanation ?? "",
    date: Number.isFinite(d) ? d : 0,
    serie,
    evenement: ev,
    etiquette: ev ? (k.evenement_label ?? "") : "",
    anglais: ev ? (k.description ?? "") : "",
  };
}

function PuceYoy({ yoy }: { yoy: string }) {
  const neg = /^\s*[-−–]/.test(yoy);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums ${neg ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
      {yoy}
    </span>
  );
}

function Mini({ serie, accent }: { serie: Carte["serie"]; accent: string }) {
  if (serie.length < 2) return null;
  const W = 120, H = 28;
  const vs = serie.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const d = serie.map((p, i) => `${i ? "L" : "M"}${((i / (serie.length - 1)) * W).toFixed(1)} ${(H - 3 - ((p.v - lo) / span) * (H - 6)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiStoriesMur({
  slides, ticker, accent, freeBlocked, locale,
}: { slides: StorySlide[]; ticker: string; accent: string; freeBlocked: boolean; locale: string }) {
  const fr = locale.startsWith("fr");
  const cartes = useMemo(() => slides.map((s, i) => enCarte(s, i, ticker, locale)), [slides, ticker, locale]);
  const [famille, setFamille] = useState<StoryFamilyKey | "toutes">("toutes");
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const tabs = useMemo(() => orderedFamilies(new Set(cartes.map((c) => c.famille))), [cartes]);
  const liste = useMemo(() => {
    const l = famille === "toutes" ? [...cartes] : cartes.filter((c) => c.famille === famille);
    return l.sort((a, b) => Number(b.evenement) - Number(a.evenement) || b.date - a.date);
  }, [cartes, famille]);
  const n = liste.length;
  const label = (k: StoryFamilyKey) => {
    const f = STORY_FAMILIES.find((x) => x.key === k);
    return f ? (fr ? f.label_fr : f.label_en) : k;
  };

  const prec = () => setOuvert((o) => (o === null ? o : (o - 1 + n) % n));
  const suiv = () => setOuvert((o) => (o === null ? o : (o + 1) % n));
  useEffect(() => {
    if (ouvert === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(null);
      else if (e.key === "ArrowLeft") { e.preventDefault(); prec(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); suiv(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, n]);

  const cur = ouvert !== null ? liste[ouvert] : null;
  const puce = (actif: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${actif ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-1">
        <button type="button" onClick={() => setFamille("toutes")} className={puce(famille === "toutes")}>
          {fr ? "Toutes" : "All"}<span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{cartes.length}</span>
        </button>
        {tabs.map((f) => (
          <button key={f.key} type="button" onClick={() => setFamille(f.key)} className={puce(famille === f.key)}>
            {fr ? f.label_fr : f.label_en}
            <span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{cartes.filter((c) => c.famille === f.key).length}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[560px] overflow-y-auto rounded-2xl pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin]">
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
          {liste.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOuvert(i)}
              {...(c.evenement ? { "data-evenement": "1" } : {})}
              className="flex min-h-[150px] flex-col rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#101015] to-[#07070a] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20"
              style={{ boxShadow: `inset 0 0 50px ${accent}12` }}
            >
              <div data-blur-part="titre">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{label(c.famille)}</div>
                <div className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-100">{c.titre}</div>
                {c.periode && <div className="text-[11px] text-zinc-500">{c.periode}</div>}
                {c.etiquette && <div className="text-[10.5px] italic text-zinc-500">{c.etiquette.charAt(0).toUpperCase() + c.etiquette.slice(1)}</div>}
              </div>
              <div className="mt-auto pt-2">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  <span className="font-display text-[26px] font-bold leading-none tabular-nums text-zinc-50">{c.valeur}</span>
                  {c.unite && <span className="text-[12px] font-medium text-zinc-400">{c.unite}</span>}
                  {!freeBlocked && c.yoy && <PuceYoy yoy={c.yoy} />}
                </div>
                {!freeBlocked && <div className="mt-1.5"><Mini serie={c.serie} accent={accent} /></div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {monte && cur && createPortal(
        <div data-blur="stories">
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-8 backdrop-blur-sm" onClick={() => setOuvert(null)}>
            <div {...(cur.evenement ? { "data-evenement": "1" } : {})} className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0a0e] p-8" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setOuvert(null)} aria-label={fr ? "Fermer" : "Close"} className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="size-4" /></button>
              <div data-blur-part="titre">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accent }}>{label(cur.famille)}</div>
                <h3 className="mt-1 font-display text-[26px] font-bold leading-tight text-zinc-50">{cur.titre}</h3>
                {cur.periode && <div className="mt-1 text-[13px] text-zinc-400">{cur.periode}</div>}
                {cur.etiquette && <div className="text-[12px] italic text-zinc-500">{cur.etiquette.charAt(0).toUpperCase() + cur.etiquette.slice(1)}</div>}
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-[64px] font-bold leading-none tabular-nums text-zinc-50">{cur.valeur}</span>
                {cur.unite && <span className="text-[20px] font-medium text-zinc-400">{cur.unite}</span>}
                {!freeBlocked && cur.yoy && <PuceYoy yoy={cur.yoy} />}
              </div>
              {!freeBlocked && cur.serie.length > 1 && (
                <div className="mt-4 h-[190px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <RechartLineChart data={cur.serie} accent={accent} />
                </div>
              )}
              <div data-blur-part="texte">
                {cur.signal && (
                  <p className="mt-4 text-[16px] leading-relaxed text-zinc-200">
                    {cur.signal}
                    {cur.anglais && (
                      <InfoTooltip color={accent} size="sm">
                        <div className="text-[12.5px] leading-relaxed text-zinc-200">{cur.anglais}</div>
                      </InfoTooltip>
                    )}
                  </p>
                )}
                {(cur.description || cur.explication) && (
                  <div className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-zinc-400">
                    {cur.description && <p>{cur.description}</p>}
                    {cur.explication && <p className="text-zinc-500">{cur.explication}</p>}
                  </div>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[12px] text-zinc-500">
                <button type="button" onClick={prec} className="inline-flex items-center gap-1 hover:text-white"><ChevronLeft className="size-4" />{fr ? "Précédente" : "Previous"}</button>
                <span className="font-mono">{(ouvert ?? 0) + 1} / {n}</span>
                <button type="button" onClick={suiv} className="inline-flex items-center gap-1 hover:text-white">{fr ? "Suivante" : "Next"}<ChevronRight className="size-4" /></button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
