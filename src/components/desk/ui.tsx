"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Composants UI réutilisables pour le desk.
 *
 * <HelpTip> : petit (i) survolable qui explique un terme technique.
 *             À utiliser PARTOUT pour aider Yann sur le vocabulaire.
 *
 * <DeskCard> : carte sombre standard du desk.
 * <Empty>    : état vide d'une liste.
 */

export function HelpTip({ children, label }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        type="button"
        aria-label={label ?? "Aide"}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:border-violet-500/40 hover:text-violet-200"
      >
        <Info className="size-2.5" />
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-50 mt-1.5 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a0a0c] p-3 text-[11.5px] leading-relaxed text-zinc-300 shadow-2xl backdrop-blur-md">
          {children}
        </span>
      )}
    </span>
  );
}

export function DeskCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/8 bg-white/[0.02] p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ icon: Icon, title, description }: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center">
      {Icon && <Icon className="mb-3 size-8 text-zinc-600" />}
      <div className="text-[14px] font-medium text-zinc-300">{title}</div>
      {description && <div className="mt-1 max-w-md px-6 text-[12px] text-zinc-500">{description}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline gap-2">
      <h2 className="text-[15px] font-semibold text-zinc-100">{children}</h2>
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </div>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12.5px] font-medium text-violet-100 transition-colors hover:border-violet-500/60 hover:bg-violet-500/25 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/40 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/40 ${props.className ?? ""}`}
    />
  );
}

export function Pill({ children, color = "zinc" }: { children: ReactNode; color?: "zinc" | "violet" | "green" | "red" | "amber" | "cyan" }) {
  const palette: Record<string, string> = {
    zinc: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    violet: "border-violet-500/40 bg-violet-500/15 text-violet-200",
    green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    red: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    amber: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${palette[color]}`}>
      {children}
    </span>
  );
}
