"use client";

import { motion } from "motion/react";
import { Clock } from "lucide-react";
import type { BlockId } from "@/lib/v1-9-blocks-control";
import { BLOCK_LABELS, BLOCK_PLACEHOLDER_HINTS } from "@/lib/v1-9-blocks-control";

/**
 * Placeholder gracieux affiché à la place d'un bloc désactivé (admin V1.9.5).
 * Style cohérent V1.9.5 : carte zinc/emerald, icône horloge animée,
 * message contextuel par bloc, "Disponible dans les 7 prochains jours".
 */
export function BlockComingSoon({
  blockId,
  id,
  className = "",
}: {
  blockId: BlockId;
  id?: string;
  className?: string;
}) {
  const label = BLOCK_LABELS[blockId] ?? "Section";
  const hint = BLOCK_PLACEHOLDER_HINTS[blockId] ?? "Cette section arrive bientôt.";

  return (
    <section
      id={id}
      className={`mt-9 scroll-mt-24 ${className}`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-zinc-900/40 via-zinc-950/60 to-emerald-950/20 p-6 backdrop-blur-sm">
        {/* Halo discret */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-emerald-500/[0.06] blur-3xl" />

        <div className="relative flex items-start gap-4">
          <motion.div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08]"
            animate={{
              rotate: [0, 4, -4, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Clock className="size-5 text-emerald-300/90" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">
                {label}
              </h3>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                Bientôt
              </span>
            </div>

            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              {hint}
            </p>

            <div className="mt-4 flex items-center gap-2 text-[11.5px] text-zinc-500">
              <motion.span
                className="inline-block size-1.5 rounded-full bg-emerald-400/80"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="italic">
                Disponible dans les sept prochains jours
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
