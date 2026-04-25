"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Layers, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = [
  { id: "default", label: "Mettrik", icon: Square, prefix: "" },
  { id: "aurora", label: "Aurora", icon: Sparkles, prefix: "/aurora" },
  { id: "spatial", label: "Spatial", icon: Layers, prefix: "/spatial" },
] as const;

export function VariantSwitcher({ ticker }: { ticker: string }) {
  const pathname = usePathname();
  const current =
    VARIANTS.find((v) => v.prefix && pathname.startsWith(v.prefix))?.id ?? "default";

  return (
    <div className="relative inline-flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
      {VARIANTS.map((v) => {
        const Icon = v.icon;
        const active = current === v.id;
        const href = `${v.prefix}/${ticker.toLowerCase()}`;
        return (
          <Link
            key={v.id}
            href={href}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              active ? "text-zinc-50" : "text-zinc-300 hover:text-zinc-100"
            )}
          >
            {active && (
              <motion.span
                layoutId="variant-pill"
                className="absolute inset-0 rounded-full border border-violet-400/40"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(167,139,250,0.28), rgba(6,182,212,0.18))",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative size-3" />
            <span className="relative">{v.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
