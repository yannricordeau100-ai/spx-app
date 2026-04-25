"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar } from "lucide-react";
import { eventsForCompany } from "@/lib/events";

export function EventTimeline({
  ticker,
  color = "#a78bfa",
}: {
  ticker: string;
  color?: string;
}) {
  const events = eventsForCompany(ticker);
  const [hover, setHover] = useState<number | null>(null);

  if (!events.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Calendar className="size-3.5" style={{ color }} />
        <span className="font-sans text-[11.5px] font-semibold uppercase tracking-[0.12em] text-zinc-200">
          Événements clés
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {events.map((e, i) => {
          const isHover = hover === i;
          return (
            <button
              key={e.year}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(isHover ? null : i)}
              className="relative rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-2.5 text-left transition-colors hover:border-[#2a2a2a]"
              style={isHover ? { borderColor: `${color}55`, boxShadow: `0 0 16px ${color}22` } : undefined}
            >
              <div className="font-mono text-[11px]" style={{ color }}>
                {e.year}
              </div>
              <div className="mt-0.5 line-clamp-1 text-[12px] font-medium text-zinc-100">
                {e.title}
              </div>
              <AnimatePresence>
                {isHover && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3 text-[12.5px] leading-relaxed text-zinc-200 shadow-2xl"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                        {e.year}
                      </span>
                      <span className="font-semibold text-zinc-100">{e.title}</span>
                    </div>
                    {e.body}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
}
