"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, RotateCw, Settings2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { TimeFraction } from "@/components/charts/time-fraction-toggle";
import type { BarsVariant, ChartMode, GraphPeriod } from "@/components/chart-cycle";

/**
 * Contrôles MOBILES du bloc graph (Yann 2 sept 2026, refonte ergonomie).
 *
 * Objectif : réglages sur 1 à 2 lignes maximum en 375px.
 *  - ChartSettingsMenu : menu déroulant COMMUN (fenêtre 5 ans/MAX,
 *    fréquence Trimestriel/Annuel, rendu 2D/3D).
 *  - TimeUnitSelect : menu déroulant pour le calcul par unité de temps
 *    (année, mois, semaine, jour, heure, minute, seconde).
 *  - ShareDownloadMenu : bouton unique télécharger OU partager sur X
 *    (utilisé aussi sur desktop, cf chart-cycle.tsx).
 *  - ChartFullscreen : le graph s'ouvre en plein écran (portrait), avec
 *    un bouton de bascule paysage.
 * Le desktop garde ses contrôles historiques : ces composants ne sont
 * rendus qu'en mobile (sm:hidden côté appelant), sauf ShareDownloadMenu.
 */

const FRACTION_LABELS: { id: TimeFraction; fr: string }[] = [
  { id: "year", fr: "Par an" },
  { id: "month", fr: "Par mois" },
  { id: "week", fr: "Par semaine" },
  { id: "day", fr: "Par jour" },
  { id: "hour", fr: "Par heure" },
  { id: "minute", fr: "Par minute" },
  { id: "second", fr: "Par seconde" },
];

export function TimeUnitSelect({
  value,
  onChange,
  accent = "#a78bfa",
}: {
  value: TimeFraction;
  onChange: (f: TimeFraction) => void;
  accent?: string;
}) {
  return (
    <label className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeFraction)}
        aria-label="Calcul par unité de temps"
        className="appearance-none rounded-full border border-white/10 bg-[#0a0a0a] py-1.5 pl-3 pr-7 text-[12px] font-medium text-zinc-200"
        style={{ borderColor: value !== "year" ? `${accent}66` : undefined }}
      >
        {FRACTION_LABELS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.fr}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-zinc-500" />
    </label>
  );
}

function GroupePills<T extends string>({
  titre,
  options,
  value,
  onPick,
  accent,
}: {
  titre: string;
  options: { id: T; label: string; disabled?: boolean }[];
  value: T;
  onPick: (v: T) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{titre}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            disabled={o.disabled}
            onClick={() => onPick(o.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              value === o.id
                ? "text-zinc-50"
                : "border-white/10 bg-white/[0.03] text-zinc-400",
              o.disabled && "opacity-40"
            )}
            style={value === o.id ? { borderColor: `${accent}66`, background: `${accent}22` } : undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChartSettingsMenu({
  accent = "#a78bfa",
  range,
  onRange,
  hasMaxPlan,
  graphPeriod,
  onGraphPeriod,
  periodAvailable,
  mode,
  barsVariant,
  onBarsVariant,
}: {
  accent?: string;
  range: "5y" | "max";
  onRange: (r: "5y" | "max") => void;
  hasMaxPlan: boolean;
  graphPeriod: GraphPeriod;
  onGraphPeriod: (p: GraphPeriod) => void;
  periodAvailable: { year: boolean; quarter: boolean; semester?: boolean };
  mode: ChartMode;
  barsVariant?: BarsVariant;
  onBarsVariant?: (v: BarsVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const nbActifs = (range === "max" ? 1 : 0) + (graphPeriod === "year" ? 1 : 0) + (barsVariant === "classic" ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0a] px-3 py-1.5 text-[12px] font-medium text-zinc-200"
        style={open || nbActifs > 0 ? { borderColor: `${accent}66` } : undefined}
      >
        <Settings2 className="size-3.5" />
        Réglages
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[240px] space-y-3 rounded-xl border border-[#26262b] bg-[#0b0b0e] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <GroupePills
            titre="Fenêtre"
            options={[
              { id: "5y" as const, label: "5 ans" },
              { id: "max" as const, label: "MAX", disabled: !hasMaxPlan },
            ]}
            value={range}
            onPick={onRange}
            accent={accent}
          />
          <GroupePills
            titre="Fréquence"
            options={[
              { id: "quarter" as const, label: "Trimestriel", disabled: !periodAvailable.quarter },
              { id: "year" as const, label: "Annuel", disabled: !periodAvailable.year },
              ...(periodAvailable.semester ? [{ id: "semester" as const, label: "Semestriel" }] : []),
            ]}
            value={graphPeriod}
            onPick={onGraphPeriod}
            accent={accent}
          />
          {mode === "bars" && barsVariant && onBarsVariant && (
            <GroupePills
              titre="Rendu"
              options={[
                { id: "classic" as const, label: "2D" },
                { id: "iso3d" as const, label: "3D" },
              ]}
              value={barsVariant}
              onPick={onBarsVariant}
              accent={accent}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ShareDownloadMenu({
  onDownload,
  shareText,
  shareUrl,
  accent = "#a78bfa",
  className,
}: {
  onDownload: () => void;
  shareText: string;
  shareUrl: string;
  accent?: string;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);
  const partagerSurX = () => {
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(u, "_blank", "noopener,noreferrer");
    setOpen(false);
  };
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("graph.download")}
        title={t("graph.download")}
        className="inline-flex size-8 items-center justify-center rounded-full border transition-colors"
        style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}
      >
        {/* Icône combinée : partage + petite flèche de téléchargement */}
        <span className="relative inline-flex">
          <Share2 className="size-3.5" />
          <Download className="absolute -bottom-1.5 -right-1.5 size-2.5 rounded-full bg-[#0b0b0e] p-[1px]" />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[210px] overflow-hidden rounded-xl border border-[#26262b] bg-[#0b0b0e] shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => {
              onDownload();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] text-zinc-200 hover:bg-white/[0.05]"
          >
            <Download className="size-4 text-zinc-400" />
            Télécharger en PNG
          </button>
          <button
            onClick={partagerSurX}
            className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-3.5 py-3 text-left text-[13px] text-zinc-200 hover:bg-white/[0.05]"
          >
            <span className="inline-flex size-4 items-center justify-center font-display text-[13px] font-bold text-zinc-400">𝕏</span>
            Partager sur X
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Plein écran mobile : rend `children` (le graph) dans un overlay.
 * Portrait par défaut ; le bouton pivote le graph en paysage (rotation CSS,
 * le graph occupe alors toute la hauteur de l'écran).
 */
export function ChartFullscreen({
  open,
  onClose,
  titre,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titre: string;
  children: React.ReactNode;
}) {
  const [paysage, setPaysage] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPaysage(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#050507]">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="truncate pr-2 text-[14px] font-semibold text-zinc-100">{titre}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaysage((p) => !p)}
            aria-label={paysage ? "Revenir en portrait" : "Passer en paysage"}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-200"
          >
            <RotateCw className={cn("size-3.5 transition-transform duration-300", paysage && "rotate-90")} />
            {paysage ? "Portrait" : "Paysage"}
          </button>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        {paysage ? (
          <div
            className="origin-center rotate-90"
            style={{ width: "calc(100vh - 96px)", height: "calc(100vw - 16px)" }}
          >
            <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full">{children}</div>
          </div>
        ) : (
          <div className="w-full [&_svg]:w-full">{children}</div>
        )}
      </div>
    </div>
  );
}
