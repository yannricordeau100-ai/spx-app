"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search } from "lucide-react";
import { COMPANIES, TICKERS } from "@/lib/data";
import { brand } from "@/lib/brand";

/**
 * Quick search bar shown in the top-nav of company pages.
 * Filters the 5 companies by ticker / name / sector.
 */
export function PageSearch({ variant = "default" }: { variant?: "default" | "aurora" | "spatial" }) {
  const pathname = usePathname();
  const prefix =
    pathname.startsWith("/aurora") ? "/aurora" :
    pathname.startsWith("/spatial") ? "/spatial" : "";

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) return TICKERS;
    const s = q.toLowerCase();
    return TICKERS.filter(
      (t) =>
        t.toLowerCase().includes(s) ||
        COMPANIES[t].name.toLowerCase().includes(s) ||
        COMPANIES[t].sector.toLowerCase().includes(s)
    );
  }, [q]);

  const wrapClass =
    variant === "aurora"
      ? "glass-card flex items-center rounded-lg px-2.5 py-1.5"
      : variant === "spatial"
        ? "spatial-card flex items-center rounded-lg px-2.5 py-1.5"
        : "flex items-center rounded-lg border border-[#262626] bg-[#0a0a0a] px-2.5 py-1.5";

  return (
    <div ref={ref} className="relative">
      <div className={wrapClass}>
        <Search className="size-4 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher…"
          className="ml-2 w-32 bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none sm:w-44"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-11 z-50 max-h-72 overflow-y-auto overflow-hidden rounded-xl border border-[#262626] bg-[#0a0a0a] shadow-2xl"
          >
            {results.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-zinc-400">
                Aucune société.
              </div>
            ) : (
              results.map((t) => {
                const c = COMPANIES[t];
                const accent = brand(t).primary;
                return (
                  <Link
                    key={t}
                    href={`${prefix}/${t.toLowerCase()}`}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-[#141414]"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: accent }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-zinc-100">
                        {c.name}
                      </div>
                      <div className="truncate text-[11px] text-zinc-400">
                        {c.sector}
                      </div>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: accent }}>
                      {t}
                    </span>
                  </Link>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
