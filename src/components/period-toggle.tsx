"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { id: "5y", label: "5 ans", available: true },
  { id: "10y", label: "10 ans", available: false },
  { id: "20y", label: "20 ans", available: false },
] as const;

/**
 * Period selector — 5y is real, 10y/20y are V2 teasers (locked icon, click shows tooltip).
 */
export function PeriodToggle({ accent = "#a78bfa" }: { accent?: string }) {
  const [active, setActive] = useState<string>("5y");
  const [showLockMsg, setShowLockMsg] = useState<string | null>(null);

  return (
    <div className="relative inline-flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
      {PERIODS.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => {
              if (!p.available) {
                setShowLockMsg(p.id);
                setTimeout(() => setShowLockMsg(null), 1800);
                return;
              }
              setActive(p.id);
            }}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
              isActive ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-300",
              !p.available && "opacity-60"
            )}
          >
            {isActive && p.available && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                  border: `1px solid ${accent}55`,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{p.label}</span>
            {!p.available && <Lock className="relative size-2.5" />}
          </button>
        );
      })}
      {showLockMsg && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-9 left-0 right-0 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 text-center text-[10.5px] text-zinc-300 shadow-xl"
        >
          Disponible en V2
        </motion.span>
      )}
    </div>
  );
}
