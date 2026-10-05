"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, Link2, RotateCw, Settings2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PleinEcranContext } from "@/components/charts/plein-ecran-context";
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
  range: "3y" | "max";
  onRange: (r: "3y" | "max") => void;
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
              { id: "3y" as const, label: "3 ans" },
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
    // x.com/intent/post est l adresse actuelle (twitter.com/intent/tweet ne
    // fait plus qu une redirection).
    const u = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
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
 * Portrait par défaut ; le bouton pivote tout le cadre (titre compris) de 90 degrés :
 * le cadre fait alors (hauteur écran x largeur écran), le graph le remplit.
 * Dimensions lues sur window.innerWidth/innerHeight (Safari iPhone : la
 * hauteur suit la barre d adresse, contrairement à 100vh) et recalculées au
 * redimensionnement / changement d orientation. Le contenu est mis à l échelle
 * (jamais agrandi au-delà de 1 en hauteur) pour que rien ne soit coupé.
 */
function useTailleEcran(actif: boolean) {
  const [t, setT] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    if (!actif) return;
    const lire = () => {
      const vv = window.visualViewport;
      setT({
        w: Math.round(window.innerWidth || vv?.width || 0),
        h: Math.round(window.innerHeight || vv?.height || 0),
      });
    };
    lire();
    window.addEventListener("resize", lire);
    window.addEventListener("orientationchange", lire);
    window.visualViewport?.addEventListener("resize", lire);
    return () => {
      window.removeEventListener("resize", lire);
      window.removeEventListener("orientationchange", lire);
      window.visualViewport?.removeEventListener("resize", lire);
    };
  }, [actif]);
  return t;
}

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
  const { w, h } = useTailleEcran(open);
  const zoneRef = useRef<HTMLDivElement>(null);
  const contenuRef = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [monte, setMonte] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Telephone deja tenu en paysage : le cadre n a plus besoin d etre pivote.
  const natifPaysage = w > h;
  const paysageEffectif = paysage && !natifPaysage;

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (!open) return;
    setPaysage(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Les flottants (aide, remonter, badge niveau) se masquent via ce marqueur.
    document.documentElement.setAttribute("data-chart-plein-ecran", "1");
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.removeAttribute("data-chart-plein-ecran");
    };
  }, [open]);

  // Touche retour du navigateur (Safari : geste de bord, bouton retour) : une
  // entree d historique est posee a l ouverture ; la retirer ferme la vue.
  useEffect(() => {
    if (!open) return;
    let ferme = false;
    let pose = false;
    const surRetour = () => {
      ferme = true;
      onCloseRef.current();
    };
    // Differe d un tick : le double montage du mode strict ne doit pas poser
    // puis retirer l entree dans le desordre.
    const minuteur = window.setTimeout(() => {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), mettrikChartFs: true }, "");
        pose = true;
      } catch {
        /* historique indisponible : la croix reste le moyen de sortie */
      }
      window.addEventListener("popstate", surRetour);
    }, 0);
    return () => {
      window.clearTimeout(minuteur);
      window.removeEventListener("popstate", surRetour);
      // Fermeture par la croix ou le glissement : on retire notre entree.
      if (pose && !ferme) {
        try {
          if (window.history.state?.mettrikChartFs) window.history.back();
        } catch {
          /* rien */
        }
      }
    };
  }, [open]);

  // Mise à l échelle : si le contenu (graph + en-têtes) dépasse la hauteur
  // disponible, on le réduit d un bloc ; sinon échelle 1 (centré).
  useEffect(() => {
    if (!open) return;
    const zone = zoneRef.current;
    const contenu = contenuRef.current;
    if (!zone || !contenu) return;
    const calc = () => {
      const dispo = zone.clientHeight;
      const natif = contenu.offsetHeight;
      if (!dispo || !natif) return;
      const e = Math.min(1, dispo / natif);
      setEchelle((prev) => (Math.abs(prev - e) < 0.005 ? prev : e));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(zone);
    ro.observe(contenu);
    return () => ro.disconnect();
  }, [open, paysageEffectif, w, h, monte]);

  // Glissement vers le bas (portrait) = fermeture.
  const depart = useRef<{ x: number; y: number } | null>(null);
  const surDebutToucher = (e: React.TouchEvent) => {
    const t = e.touches[0];
    depart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const surFinToucher = (e: React.TouchEvent) => {
    const d = depart.current;
    depart.current = null;
    const t = e.changedTouches[0];
    if (!d || !t || paysageEffectif) return;
    const dy = t.clientY - d.y;
    const dx = Math.abs(t.clientX - d.x);
    if (dy > 110 && dx < 60 && dy > dx * 2) onCloseRef.current();
  };

  // Portal sur body : un ancetre transforme (motion) detournait position:fixed
  // sur Safari et laissait la croix hors de l ecran.
  if (!open || !monte) return null;
  const cadreW = paysageEffectif ? h : w;
  const cadreH = paysageEffectif ? w : h;
  // Cadre tourné : son haut = côté droit de l écran, sa droite = bas, etc.
  const pad = paysageEffectif
    ? {
        paddingTop: "env(safe-area-inset-right)",
        paddingRight: "env(safe-area-inset-bottom)",
        paddingBottom: "env(safe-area-inset-left)",
        paddingLeft: "env(safe-area-inset-top)",
      }
    : {
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      };
  const styleCadre: React.CSSProperties = w
    ? {
        position: "fixed",
        top: 0,
        left: paysageEffectif ? w : 0,
        width: cadreW,
        height: cadreH,
        transformOrigin: "0 0",
        transform: paysageEffectif ? "rotate(90deg)" : undefined,
        ...pad,
      }
    : { position: "fixed", inset: 0, ...pad };
  // Place reservee a la croix fixe : a droite en portrait, a gauche du cadre
  // pivote en paysage (le haut de l ecran y est le debut du cadre).
  const reserveCroix = "calc(52px + env(safe-area-inset-right))";
  return createPortal(
    <PleinEcranContext.Provider value={true}>
      <div
        className="fixed inset-0 overflow-hidden bg-[#050507]"
        style={{ zIndex: 2147483647, touchAction: "pan-x pinch-zoom" }}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onTouchStart={surDebutToucher}
        onTouchEnd={surFinToucher}
      >
        <div style={styleCadre} className="flex flex-col bg-[#050507]">
          <div
            className="flex shrink-0 items-start justify-between gap-2 px-3 py-2"
            style={paysageEffectif ? { paddingLeft: "calc(56px + env(safe-area-inset-top))" } : { paddingRight: reserveCroix }}
          >
            <span className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-snug text-zinc-100">{titre}</span>
            {!natifPaysage && (
              <button
                onClick={() => setPaysage((p) => !p)}
                aria-label={paysageEffectif ? "Revenir en portrait" : "Passer en paysage"}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-200"
              >
                <RotateCw className={cn("size-3.5 transition-transform duration-300", paysageEffectif && "rotate-90")} />
                {paysageEffectif ? "Portrait" : "Paysage"}
              </button>
            )}
          </div>
          <div ref={zoneRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-2">
            <div
              ref={contenuRef}
              className="w-full [&_svg]:w-full"
              style={{ transform: echelle < 1 ? `scale(${echelle})` : undefined, transformOrigin: "center center" }}
            >
              {children}
            </div>
          </div>
        </div>
        {/* Croix FIXE, hors du cadre pivote : toujours visible et cliquable,
            en haut a droite de l ecran physique, dans la zone sure. */}
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          aria-label="Fermer"
          className="fixed inline-flex size-11 items-center justify-center rounded-full border border-white/25 bg-[#0b0b0e]/95 text-zinc-100 shadow-[0_6px_22px_rgba(0,0,0,0.7)]"
          style={{
            top: "max(10px, calc(env(safe-area-inset-top) + 6px))",
            right: "max(10px, calc(env(safe-area-inset-right) + 6px))",
            zIndex: 2147483647,
          }}
        >
          <X className="size-5" />
        </button>
      </div>
    </PleinEcranContext.Provider>,
    document.body,
  );
}
