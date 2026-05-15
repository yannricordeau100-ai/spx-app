"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check } from "lucide-react";
import { type Currency, CURRENCY_SYMBOL } from "@/lib/currency";

/**
 * CurrencyPicker — dropdown moderne pour choisir une devise.
 * Style cohérent avec le reste de l'app (bordure violet/cyan, fond translucide,
 * animation scale + fade au open). Remplace le `<select>` natif "look 2002".
 *
 * Utilisable centralisée pour les blocs Stories Dividendes (la devise
 * sélectionnée s'applique à toutes les cards filles via prop drilling).
 */
export function CurrencyPicker({
  value,
  onChange,
  options,
  accent = "#a855f7",
}: {
  value: Currency;
  onChange: (c: Currency) => void;
  options: readonly Currency[];
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border bg-black/45 px-3 py-1.5 font-mono text-[11.5px] tabular-nums text-zinc-100 backdrop-blur-md transition-all hover:bg-black/65 focus:outline-none"
        style={{
          borderColor: open ? accent : "rgba(255,255,255,0.15)",
          boxShadow: open ? `0 0 12px ${accent}45` : "none",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choisir la devise d'affichage"
        title="Devise : taux de change actualisé via Banque Centrale Européenne"
      >
        <span className="font-semibold">{value}</span>
        <span className="text-zinc-400">{CURRENCY_SYMBOL[value]}</span>
        <ChevronDown
          className="size-3 text-zinc-400 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[110%] z-50 max-h-[260px] w-44 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a0e]/95 p-1 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md"
            role="listbox"
          >
            {options.map((c, i) => {
              const isActive = c === value;
              const isFirst = i === 0;
              return (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-white/[0.06]"
                    style={
                      isActive
                        ? { background: `${accent}20`, color: "#fff" }
                        : { color: "#d4d4d8" }
                    }
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{c}</span>
                      <span className="text-zinc-400">{CURRENCY_SYMBOL[c]}</span>
                      {isFirst && (
                        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8.5px] font-mono uppercase tracking-wider text-zinc-400">
                          Native
                        </span>
                      )}
                    </span>
                    {isActive && <Check className="size-3" style={{ color: accent }} />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
