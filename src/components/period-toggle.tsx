"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

/**
 * Yann 16 mai 2026 : toggle simplifié `5y / MAX`. L'option MAX affiche
 * toute l'history disponible (peut être < 5 ans selon la sté). MAX est
 * réservé au plan MAX (premium accède seulement à 5y avec cadenas).
 *
 * Prop `hasMaxPlan` : si true, MAX déverrouillé ; sinon cadenas + tooltip
 * upsell. Default false (UI sécurisée). À passer depuis le composant
 * parent via le contexte billing.
 */
const PERIODS = [
  { id: "5y", labelKey: "company.period.5y" },
  { id: "max", labelKey: "company.period.max" },
] as const;

export function PeriodToggle({
  accent = "#a78bfa",
  hasMaxPlan = false,
}: {
  accent?: string;
  hasMaxPlan?: boolean;
}) {
  const [active, setActive] = useState<string>("5y");
  const [showLockMsg, setShowLockMsg] = useState<string | null>(null);
  const { t } = useT();

  return (
    <div className="relative inline-flex items-center gap-0.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-0.5">
      {PERIODS.map((p) => {
        const isActive = active === p.id;
        const isLocked = p.id === "max" && !hasMaxPlan;
        return (
          <button
            key={p.id}
            onClick={() => {
              if (isLocked) {
                setShowLockMsg(p.id);
                setTimeout(() => setShowLockMsg(null), 2200);
                return;
              }
              setActive(p.id);
            }}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
              isActive ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-300",
              isLocked && "opacity-60"
            )}
          >
            {isActive && !isLocked && (
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
            <span className="relative whitespace-nowrap">{t(p.labelKey)}</span>
            {isLocked && <Lock className="relative size-2.5" />}
          </button>
        );
      })}
      {showLockMsg && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-9 left-0 right-0 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 text-center text-[10.5px] text-zinc-300 shadow-xl"
        >
          {t(showLockMsg === "max" ? "company.period.max_locked" : "company.period.locked")}
        </motion.span>
      )}
    </div>
  );
}
