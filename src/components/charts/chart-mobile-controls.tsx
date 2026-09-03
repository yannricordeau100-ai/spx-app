"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, Link2, RotateCw, Settings2, Share2, X } from "lucide-react";
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

/**
 * Positionne un panneau deroulant en position FIXED sous son bouton, au
 * 1er plan de l ecran (Yann 2 sept 2026) : en absolute, le panneau restait
 * pris dans la carte du graph (overflow-hidden + stacking context) et
 * passait sous les blocs suivants. Fixed + z-[130] = toujours au-dessus.
 * Ferme au scroll pour ne pas laisser un panneau orphelin decale.
 */
function usePanneauFixe(
  open: boolean,
  boutonRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  align: "left" | "right" = "left",
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const place = () => {
      const r = boutonRef.current?.getBoundingClientRect();
      if (!r) return;
      const suivant: React.CSSProperties =
        align === "left"
          ? { position: "fixed", top: r.bottom + 6, left: Math.max(8, r.left) }
          : { position: "fixed", top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) };
      // setState seulement si la position bouge : pas de re-render a 60 fps.
      setStyle((prev) =>
        prev && prev.top === suivant.top && prev.left === suivant.left && prev.right === suivant.right
          ? prev
          : suivant,
      );
    };
    // Suivi continu du bouton : rAF (reflows silencieux, chart qui s hydrate)
    // DOUBLE d ecouteurs scroll/resize (marchent meme quand rAF est suspendu,
    // ex. onglet en arriere-plan). Le panneau reste colle au bouton ; il ne
    // se ferme que si le bouton sort de l ecran.
    let raf = 0;
    const suit = () => {
      const r = boutonRef.current?.getBoundingClientRect();
      if (r && (r.bottom < 0 || r.top > window.innerHeight)) {
        onClose();
        return false;
      }
      place();
      return true;
    };
    const boucle = () => {
      if (suit()) raf = requestAnimationFrame(boucle);
    };
    boucle();
    const surEvenement = () => void suit();
    window.addEventListener("scroll", surEvenement, { passive: true, capture: true });
    window.addEventListener("resize", surEvenement);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", surEvenement, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", surEvenement);
    };
  }, [open, boutonRef, onClose, align]);
  return style;
}

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
  const panneauRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const cible = e.target as Node;
      // Le panneau vit dans un portal (body) : un clic dedans ne ferme pas.
      if (ref.current?.contains(cible) || panneauRef.current?.contains(cible)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const nbActifs = (range === "max" ? 1 : 0) + (graphPeriod === "year" ? 1 : 0) + (barsVariant === "classic" ? 1 : 0);
  const styleFixe = usePanneauFixe(open, ref, () => setOpen(false), "left");

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
      {open && styleFixe && createPortal(
        // Portal vers body : un ancetre du bouton porte un transform (motion),
        // qui detournerait position:fixed et decalerait le panneau.
        <div
          ref={panneauRef}
          style={styleFixe}
          className="z-[130] w-[240px] space-y-3 rounded-xl border border-[#26262b] bg-[#0b0b0e] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        >
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
        </div>,
        document.body,
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
  const [copie, setCopie] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Yann 3 sept 2026 : le panneau etait pris dans la carte du graph (overflow)
  // et ne s affichait pas. Meme mecanique que le menu Reglages : position
  // fixe au 1er plan de l ecran, alignee a droite du bouton.
  const styleFixe = usePanneauFixe(open, ref, () => setOpen(false), "right");
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const cible = e.target as Node;
      if (ref.current?.contains(cible)) return;
      if ((cible as HTMLElement).closest?.("[data-panneau-partage]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);
  const publierSurX = () => {
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(u, "_blank", "noopener,noreferrer,width=600,height=650");
    setOpen(false);
  };
  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopie(true);
      setTimeout(() => { setCopie(false); setOpen(false); }, 900);
    } catch { /* presse-papiers indisponible */ }
  };
  const ligne = "flex w-full items-center gap-3 px-3.5 py-3 text-left text-[13px] text-zinc-100 hover:bg-white/[0.05]";
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("graph.download")}
        aria-expanded={open}
        title="Télécharger ou partager"
        className="inline-flex size-8 items-center justify-center rounded-full border transition-colors"
        style={{ borderColor: `${accent}55`, background: open ? `${accent}26` : `${accent}14`, color: accent }}
      >
        <Download className="size-3.5" />
      </button>
      {open && styleFixe && createPortal(
        <div data-panneau-partage style={styleFixe} className="z-[130] w-[236px] overflow-hidden rounded-xl border border-[#26262b] bg-[#0b0b0e] shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <button onClick={() => { onDownload(); setOpen(false); }} className={ligne}>
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300"><Download className="size-3.5" /></span>
            <span className="flex flex-col leading-tight">
              {t("graph.download")}
              <span className="text-[11px] text-zinc-500">Image PNG du graph tel qu&apos;affiché</span>
            </span>
          </button>
          <button onClick={publierSurX} className={cn(ligne, "border-t border-white/[0.06]")}>
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-white/[0.06] font-display text-[13px] font-bold text-zinc-100">𝕏</span>
            <span className="flex flex-col leading-tight">
              Publier sur X
              <span className="text-[11px] text-zinc-500">Texte prêt, aperçu du graph, lien court</span>
            </span>
          </button>
          <button onClick={copierLien} className={cn(ligne, "border-t border-white/[0.06]")}>
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300"><Link2 className="size-3.5" /></span>
            <span className="flex flex-col leading-tight">
              {copie ? "Lien copié" : "Copier le lien du KPI"}
              <span className="max-w-[170px] truncate text-[11px] text-zinc-500">{shareUrl.replace(/^https?:\/\//, "")}</span>
            </span>
          </button>
        </div>,
        document.body,
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
