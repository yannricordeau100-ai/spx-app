"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Card with mouse-following radial spotlight (Aceternity / Magic UI pattern).
 * Hover anywhere → soft glow follows the cursor.
 */
export function MagicCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] transition-colors hover:border-[#2a2a2a]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(450px circle at var(--mouse-x) var(--mouse-y), rgba(139, 92, 246, 0.12), transparent 40%)",
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
