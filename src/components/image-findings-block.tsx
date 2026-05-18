"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
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
}: {
  findings: ImageFindingPublic[];
  accent?: string;
  locale?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (!findings || findings.length === 0) return null;
  const safe = idx % findings.length;
  const f = findings[safe];
  const displayTitle = pickI18n(f.title_i18n, locale, f.title);
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
        <div className="flex items-center gap-1.5">
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
        {displayTitle && (
          <h3 className="mb-3 text-center text-[15px] font-semibold leading-snug text-zinc-100">
            {displayTitle}
          </h3>
        )}
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Yann 18 mai 2026 : priorité au SVG local recréé. f.image_url
              pointe vers la source externe (PDF / article) qui n'est pas
              le visuel attendu. */}
          <img
            src={f.image_local_path || f.image_url}
            alt={displayTitle ?? tt("image_findings.image_alt_fallback")}
            className="size-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        {/* Lecture toujours visible (Yann 17 mai 2026 : remettre comme avant).
            Le toggle "masquer la lecture" est désormais dans la sandbox admin
            (per finding). Ici on respecte le flag f.show_summary !== false. */}
        {displaySummary && f.show_summary !== false && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-400">{displaySummary}</p>
        )}
      </div>

      {/* Dots indicators */}
      {findings.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
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
