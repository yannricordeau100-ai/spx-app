"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImageIcon } from "lucide-react";
import { downloadSvgAsPng } from "@/lib/chart-export";
import { pickI18n, type LocalizedString } from "@/lib/desk/image-findings";
import { translate } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";

export type ImageFindingPublic = {
  id: string;
  image_url: string;
  /** Chemin local du SVG recréé. Yann 18 mai 2026 : prioritaire sur
   *  image_url pour l'affichage (image_url = source externe). */
  image_local_path: string | null;
  title: string | null;
  caption: string | null;
  summary: string | null;
  title_i18n?: LocalizedString;
  summary_i18n?: LocalizedString;
  source_url: string | null;
  source_author: string | null;
  source_handle: string | null;
  source_date: string | null;
  source_platform: string | null;
  /** Toggle sandbox admin : si false, masque la lecture (summary) sur la
   *  fiche société publique (Yann 17 mai 2026). Default true. */
  show_summary?: boolean;
};

/**
 * Bloc "Graphiques et Schémas de sources diverses".
 * Carrousel mobile (style Stories) qui affiche les images approuvées
 * pour la sté courante, filtrées par locale active.
 */
export function ImageFindingsBlock({
  findings,
  accent = "#06b6d4",
  locale = "fr",
  ticker,
}: {
  findings: ImageFindingPublic[];
  accent?: string;
  locale?: string;
  /** Yann 18 sept 2026 : ticker pour le nom du fichier exporte et la signature. */
  ticker?: string;
}) {
  const [idx, setIdx] = useState(0);
  // Yann 18 sept 2026 : export PNG comme les graphiques long terme (signature Mettrik,
  // pseudo). Le SVG local est charge en texte et rendu inline pour etre exportable.
  const [svgText, setSvgText] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const displayTitleRef = useRef<string | null>(null);
  const n = findings?.length ?? 0;
  const safeIdx = n > 0 ? idx % n : 0;
  const local = n > 0 ? findings[safeIdx].image_local_path : null;
  useEffect(() => {
    if (!local || !local.endsWith(".svg") || svgText[local] !== undefined) return;
    let vivant = true;
    fetch(local).then((r) => (r.ok ? r.text() : "")).then((t) => { if (vivant) setSvgText((m) => ({ ...m, [local]: t })); }).catch(() => { if (vivant) setSvgText((m) => ({ ...m, [local]: "" })); });
    return () => { vivant = false; };
  }, [local, svgText]);
  if (!findings || findings.length === 0) return null;
  const safe = safeIdx;
  const f = findings[safe];
  const inlineSvg = f.image_local_path ? svgText[f.image_local_path] : undefined;
  const exporter = async () => {
    const svg = boxRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    const nom = `mettrik-${(ticker ?? "graphique").toLowerCase()}-moyen-terme-${safe + 1}.png`;
    await downloadSvgAsPng(svg, nom, { title: displayTitleRef.current ?? undefined, ticker, locale: (locale as "fr" | "en" | "de") });
  };
  const displayTitle = pickI18n(f.title_i18n, locale, f.title);
  displayTitleRef.current = displayTitle;
  const displaySummary = pickI18n(f.summary_i18n, locale, f.summary);
  // i18n FR/EN/DE pour chrome du composant. EN fallback auto pour autres
  // locales (en-GB, sv, da, nl, de-CH) via translate() qui descend sur EN
  // si la clé n'a pas d'entrée explicite pour la locale demandée.
  const tt = (k: string) => translate(k, locale as Locale);

  return (
    <section className="my-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5" style={{ color: accent }} />
            <h2 className="text-[22px] font-semibold leading-tight text-zinc-50">
              {tt("image_findings.section_title")}
            </h2>
          </div>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {tt("image_findings.section_subtitle")}
          </p>
        </div>
        <div data-blur="mt_fleches" className="flex items-center gap-1.5">
          <span className="mr-1 text-[12px] text-zinc-500">
            ({safe + 1}/{findings.length})
          </span>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + findings.length) % findings.length)}
            className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5"
            aria-label={tt("image_findings.aria_prev")}
          >
            <ChevronLeft className="size-4" />
          </button>
          {inlineSvg ? (
            <button
              type="button"
              onClick={exporter}
              className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5"
              aria-label="Exporter le graphique"
              title="Exporter le graphique (PNG)"
            >
              <Download className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % findings.length)}
            className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5"
            aria-label={tt("image_findings.aria_next")}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
        {/* Titre du graph AU-DESSUS (Yann 17 mai 2026 : remettre comme avant).
            Le SVG n'a plus son titre rasterisé (strip), donc on l'affiche en
            HTML i18n FR/EN/DE pour avoir des titres traduits propres. */}
        {/* Yann 17 sept 2026 : plus de petit titre au-dessus du graphique. Les
            graphiques reconstruits portent leur titre en gros dans l image ;
            pour les anciens (image de source exterieure), le titre en gros est
            rendu ici, dans le meme style. */}
        {/* Yann 18 sept 2026 : titre en HTML pour TOUS les graphiques, centre, a la ligne si long. */}
        {displayTitle && (
          <h3 data-blur="mt_titre" className="mx-auto mb-3 mt-0 max-w-[92%] text-center text-[16px] font-bold leading-snug text-zinc-50 sm:text-[17px]">
            {displayTitle}
          </h3>
        )}
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Yann 18 mai 2026 : priorité au SVG local recréé. f.image_url
              pointe vers la source externe (PDF / article) qui n'est pas
              le visuel attendu. */}
          {inlineSvg ? (
            <div ref={boxRef} className="size-full [&>svg]:size-full [&>svg]:object-contain" dangerouslySetInnerHTML={{ __html: inlineSvg }} />
          ) : (
            <img
              src={f.image_local_path || f.image_url}
              alt={displayTitle ?? tt("image_findings.image_alt_fallback")}
              className="size-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        {/* Yann 18 sept 2026 : sous-titre (unite, source, precisions) sous le graphique, centre, a la ligne. */}
        {f.caption && f.caption.trim().length > 0 && (
          <p data-blur="mt_sources" className="mx-auto mt-2 max-w-[92%] text-center text-[11.5px] leading-snug text-zinc-400">
            {f.caption}
          </p>
        )}
        {/* Lecture toujours visible (Yann 17 mai 2026 : remettre comme avant).
            Le toggle "masquer la lecture" est désormais dans la sandbox admin
            (per finding). Ici on respecte le flag f.show_summary !== false. */}
        {displaySummary && f.show_summary !== false && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{displaySummary}</p>
        )}
        {/* Yann 16 sept 2026 : date de la source, signalee au dela de deux ans. */}
        {(() => {
          const d = f.source_date ?? null;
          if (!d) return null;
          const an = Number(String(d).slice(0, 4));
          const vieux = Number.isFinite(an) && an <= new Date().getFullYear() - 2;
          return (
            <div className={`mt-1.5 font-mono text-[10.5px] ${vieux ? "text-amber-300/90" : "text-zinc-500"}`}>
              {f.source_author ? `${f.source_author} · ` : ""}
              {String(d).slice(0, 10).split("-").reverse().join("/")}
              {vieux ? " · source de plus de deux ans" : ""}
            </div>
          );
        })()}
      </div>

      {/* Dots indicators */}
      {findings.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {findings.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className="size-1.5 rounded-full transition-all"
              style={{
                background: i === safe ? accent : "#3f3f46",
                transform: i === safe ? "scaleX(2)" : "scaleX(1)",
              }}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
