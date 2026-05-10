"use client";

import { useFormStatus } from "react-dom";
import { LogOut, Loader2 } from "lucide-react";

/**
 * Bouton "Se déconnecter" du compte avec état pending visible.
 * Yann (11 mai 2026) : la déconnexion semblait ne rien faire car le
 * bouton n'avait aucun feedback. useFormStatus ajoute un spinner +
 * désactive pendant le submit.
 */
export function SignOutButton({ label, sub }: { label: string; sub: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 text-left transition-colors hover:border-rose-400/40 disabled:opacity-70 disabled:cursor-wait"
    >
      <span className="inline-flex size-10 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      </span>
      <div>
        <div className="text-[14px] font-semibold text-zinc-50">
          {pending ? "Déconnexion en cours…" : label}
        </div>
        <div className="text-[11.5px] text-zinc-400">{sub}</div>
      </div>
    </button>
  );
}
