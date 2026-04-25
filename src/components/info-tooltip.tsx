"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info } from "lucide-react";

/**
 * Generic "i" hover/tap tooltip with rich content.
 */
export function InfoTooltip({
  children,
  color = "#a78bfa",
  align = "left",
  size = "sm",
}: {
  children: React.ReactNode;
  color?: string;
  align?: "left" | "right" | "center";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const isSm = size === "sm";

  const alignClass =
    align === "right"
      ? "right-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setOpen((o) => !o);
      }}
    >
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full border bg-[#0a0a0a] transition-colors hover:bg-[#161616] ${
          isSm ? "size-4" : "size-5"
        }`}
        style={{ borderColor: `${color}66`, color }}
        aria-label="Plus d'info"
      >
        <Info className={isSm ? "size-2.5" : "size-3"} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={`absolute top-6 z-50 w-72 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3.5 text-[12.5px] leading-relaxed text-zinc-200 shadow-2xl ${alignClass}`}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
