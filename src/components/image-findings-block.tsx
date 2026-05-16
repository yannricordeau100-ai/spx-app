"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { pickI18n, type LocalizedString } from "@/lib/desk/image-findings";
import { translate } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";

export type ImageFindingPublic = {
  id: string;
  image_url: string;
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4" style={{ color: accent }} />
          <h2 className="text-[15px] font-semibold uppercase tracking-wider text-zinc-200">
            {tt("image_findings.section_title")}
          </h2>
          <span className="text-[11px] text-zinc-500">
            ({safe + 1}/{findings.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
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
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.image_url}
            alt={displayTitle ?? tt("image_findings.image_alt_fallback")}
            className="size-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          {displayTitle && <div className="text-[14px] font-semibold text-zinc-100">{displayTitle}</div>}
          {displaySummary && (
            <p className="text-[12.5px] leading-relaxed text-zinc-400">{displaySummary}</p>
          )}
          {/* Source footer uniforme — masque les sources externes (X / Reddit / Substack / Bing / HF / etc).
              i18n FR/EN/DE via dictionary.ts. EN fallback auto pour autres locales. */}
          <div className="flex items-center gap-2 pt-2 text-[10.5px] italic text-zinc-500">
            <span>{tt("image_findings.source_footer")}</span>
          </div>
        </div>
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
