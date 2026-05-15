"use client";

import { Quote, TrendingUp, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/provider";
import { brand } from "@/lib/brand";

/** Tooltip "i" mini qui explique earning call (non-bilingues). */
function EarningCallInfo({ accent }: { accent: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);
  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="ml-1 inline-flex size-4 cursor-help items-center justify-center rounded-full text-[10px] font-bold opacity-70 transition-opacity hover:opacity-100"
        style={{ color: accent, border: `1px solid ${accent}66` }}
        aria-label="Qu'est-ce qu'un earning call ?"
      >
        i
      </span>
      {mounted && coords && open && createPortal(
        <div
          role="tooltip"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="pointer-events-auto fixed z-[1000] w-[360px] rounded-lg border bg-[#0a0a0a] p-4 text-[14px] leading-relaxed text-zinc-200 shadow-2xl"
          style={{ top: coords.top, left: coords.left, borderColor: `${accent}66` }}
        >
          <div className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
            Earning Call
          </div>
          <p className="text-[14px] text-zinc-200">
            Conférence téléphonique trimestrielle où la direction d&apos;une
            société cotée commente ses résultats face aux analystes. On y
            trouve : chiffres-clés, contexte, perspectives (guidance), réponses
            aux questions. Une des sources les plus riches pour anticiper la
            trajectoire de la sté.
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * TranscriptStories — 2 blocs côte à côte (largeur page) qui exposent les
 * extraits "plus-value" du DERNIER earning call de la sté.
 *
 * Sources : `src/data/transcripts/<ticker>.json` créé par CONV-DATA.
 * Format : { ticker, fetched_at, latest: { quarter, year, date, content } }.
 *
 * Conformément à la spec Yann (5 mai 2026) :
 *  - 2 blocs côte à côte qui prennent la largeur de la page.
 *  - Distincts du bloc Stories KPI existant.
 *  - Présentés comme "informations exclusives entre top management et
 *    investisseurs" (= teaser plus-value).
 *  - Données du DERNIER transcript uniquement.
 *
 * MVP : 2 cards thématiques (citations management / chiffres-guidance).
 * Extraction "plus-value" via LLM = pipeline ultérieur (Cerebras free tier
 * via CONV-DATA, format à câbler quand transcripts/<ticker>.extracts.json
 * sera disponible).
 */
export type TranscriptLatest = {
  quarter?: number;
  year?: number;
  date?: string;
  content?: string;
};

export type TranscriptDoc = {
  ticker: string;
  fetched_at?: string;
  latest?: TranscriptLatest;
  /** Extracts pré-calculés par LLM (CONV-DATA, à venir). */
  extracts?: {
    quotes?: { speaker: string; text: string; theme?: string }[];
    figures?: { metric: string; value: string; comment?: string }[];
    sentiment?: "bullish" | "neutral" | "cautious";
    summary?: string;
  };
};

function formatDateFR(iso?: string, locale: string = "fr"): string {
  if (!iso) return "—";
  try {
    const tag = locale === "de" ? "de-DE" : locale === "en-GB" ? "en-GB" : locale === "en" ? "en-US" : "fr-FR";
    return new Date(iso).toLocaleDateString(tag, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function quarterLabel(q?: number, y?: number, ticker?: string): string {
  if (!q || !y) return "Dernier earning call";
  // Pour les stés à exercice fiscal décalé (NVDA jan, MSFT juin, AAPL sept…),
  // afficher "FYyy Qq" au lieu de "Tq AAAA" calendaire (Yann 14 mai 2026).
  if (ticker) {
    const fyShort = y % 100;
    // Import lazy pour éviter cycle. Le label fiscal n'est utile que pour les
    // stés détectées comme "shifted" via fiscal-audit.json.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isFiscalShifted } = require("@/lib/fiscal-calendar");
      if (isFiscalShifted(ticker)) {
        return `FY${fyShort < 10 ? "0" + fyShort : fyShort} Q${q}`;
      }
    } catch {
      /* fallback */
    }
  }
  return `T${q} ${y}`;
}

/** Carte 1 : citations top management (prêt LLM). MVP : preview text. */
function QuotesCard({ doc, accent, ticker }: { doc: TranscriptDoc; accent: string; ticker?: string }) {
  const { t, locale } = useT();
  const quotes = doc.extracts?.quotes ?? [];
  const fallbackPreview = doc.latest?.content
    ? doc.latest.content.slice(0, 320).trim() + "…"
    : null;
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0a0a0a] to-[#070707] p-5"
      style={{ borderColor: `${accent}33` }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Quote className="size-4" style={{ color: accent }} />
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {t("transcript.quotes_title")}
        </span>
        <span className="ml-auto rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          {quarterLabel(doc.latest?.quarter, doc.latest?.year, ticker)}
        </span>
      </div>
      {quotes.length > 0 ? (
        <ul className="space-y-3">
          {quotes.slice(0, 3).map((q, i) => (
            <li key={i} className="border-l-2 pl-3" style={{ borderColor: `${accent}66` }}>
              <p className="text-[13px] italic leading-relaxed text-zinc-200">« {q.text} »</p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                {q.speaker}{q.theme ? ` · ${q.theme}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col">
          {fallbackPreview ? (
            <p className="text-[12.5px] italic leading-relaxed text-zinc-400">
              « {fallbackPreview} »
            </p>
          ) : (
            <p className="text-[12.5px] italic text-zinc-500">{t("transcript.no_data")}</p>
          )}
          <p className="mt-auto pt-3 font-mono text-[10px] text-zinc-600">
            {t("transcript.extraction_pending")}
          </p>
        </div>
      )}
    </div>
  );
}

/** Carte 2 : chiffres clés + guidance + sentiment management. */
function FiguresCard({ doc, accent }: { doc: TranscriptDoc; accent: string }) {
  const { t, locale } = useT();
  const figures = doc.extracts?.figures ?? [];
  const sentiment = doc.extracts?.sentiment;
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0a0a0a] to-[#070707] p-5"
      style={{ borderColor: `${accent}33` }}
    >
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="size-4" style={{ color: accent }} />
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {t("transcript.figures_title")}
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500">
          {formatDateFR(doc.latest?.date, locale)}
        </span>
      </div>
      {figures.length > 0 ? (
        <ul className="space-y-2.5">
          {figures.slice(0, 5).map((f, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-zinc-300">{f.metric}</span>
              <span className="font-mono text-[14px] font-semibold tabular-nums text-zinc-50">
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col">
          <p className="text-[12.5px] italic text-zinc-500">{t("transcript.no_figures")}</p>
          <p className="mt-auto pt-3 font-mono text-[10px] text-zinc-600">
            {t("transcript.extraction_pending")}
          </p>
        </div>
      )}
      {sentiment && (
        <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider"
          style={{
            color: sentiment === "bullish" ? "#10b981" : sentiment === "cautious" ? "#f59e0b" : "#a1a1aa",
            borderColor: sentiment === "bullish" ? "#10b98155" : sentiment === "cautious" ? "#f59e0b55" : "#a1a1aa55",
            background: sentiment === "bullish" ? "#10b9811a" : sentiment === "cautious" ? "#f59e0b1a" : "#a1a1aa1a",
          }}
        >
          <Sparkles className="size-3" />
          {t(`transcript.sentiment.${sentiment}`)}
        </div>
      )}
    </div>
  );
}

export function TranscriptStories({
  ticker,
  doc,
}: {
  ticker: string;
  doc: TranscriptDoc | null;
}) {
  const { t, locale } = useT();
  if (!doc || !doc.latest?.content) return null;
  const accent = brand(ticker).primary;

  return (
    <section
      id="sec-transcript-stories"
      className="mt-9 scroll-mt-24 animate-fade-up-d2"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <MessageSquare className="size-5" style={{ color: accent }} />
            {t("transcript.section_title")}
            <EarningCallInfo accent={accent} />
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {t("transcript.section_subtitle")}
          </p>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
          {quarterLabel(doc.latest.quarter, doc.latest.year, ticker)} · {formatDateFR(doc.latest.date, locale)}
        </span>
      </div>
      {/* 2 blocs côte à côte qui prennent la largeur de la page (cohérent
          avec les blocs au-dessus / en-dessous). */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <QuotesCard doc={doc} accent={accent} ticker={ticker} />
        <FiguresCard doc={doc} accent={accent} />
      </div>
    </section>
  );
}
