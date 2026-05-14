"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon } from "lucide-react";

export type ImageFindingPublic = {
  id: string;
  image_url: string;
  title: string | null;
  caption: string | null;
  summary: string | null;
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
}: {
  findings: ImageFindingPublic[];
  accent?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (!findings || findings.length === 0) return null;
  const safe = idx % findings.length;
  const f = findings[safe];

  return (
    <section className="my-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4" style={{ color: accent }} />
          <h2 className="text-[15px] font-semibold uppercase tracking-wider text-zinc-200">
            Graphiques et Schémas de sources diverses
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
            aria-label="précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % findings.length)}
            className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5"
            aria-label="suivant"
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
            alt={f.title ?? "graphique"}
            className="size-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          {f.title && <div className="text-[14px] font-semibold text-zinc-100">{f.title}</div>}
          {f.summary && (
            <p className="text-[12.5px] leading-relaxed text-zinc-400">{f.summary}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-500">
            {f.source_url ? (
              <a
                href={f.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
              >
                <ExternalLink className="size-3" />
                {f.source_handle ? `@${f.source_handle}` : "source"}
              </a>
            ) : null}
            {f.source_author && <span>{f.source_author}</span>}
            {f.source_date && (
              <span>
                {new Date(f.source_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {f.source_platform && (
              <span className="rounded-full bg-zinc-700/40 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide">
                {f.source_platform}
              </span>
            )}
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
