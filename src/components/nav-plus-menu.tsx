"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Yann 5 oct 2026 : sur mobile, la bascule jour/nuit quitte la barre du haut
 * et passe dans un menu « ... », ce qui libere la place pour la recherche.
 * Visible uniquement sous 640 px (la bascule reste directe au-dessus).
 */
export function NavPlusMenu({
  paid,
  anon = false,
  ouvert: ouvertProp,
  onOuvertChange,
}: {
  paid: boolean;
  /** Visiteur non connecte : « S'inscrire » vit ici sur mobile. */
  anon?: boolean;
  /** Pilotage par le parent (un seul panneau ouvert a la fois). */
  ouvert?: boolean;
  onOuvertChange?: (o: boolean) => void;
}) {
  const [ouvertLocal, setOuvertLocal] = useState(false);
  const ouvert = ouvertProp ?? ouvertLocal;
  const setOuvert = (o: boolean) => {
    setOuvertLocal(o);
    onOuvertChange?.(o);
  };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOuvertChange ? onOuvertChange(false) : setOuvertLocal(false);
    };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") { onOuvertChange ? onOuvertChange(false) : setOuvertLocal(false); } };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert, onOuvertChange]);
  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-label="Plus d'options"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0e]/80 text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {ouvert && (
        <div
          role="menu"
          className="fixed right-3 top-[4.5rem] z-[80] flex w-[min(14rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-xl border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-zinc-200">Affichage</span>
            <ThemeToggle paid={paid} />
          </div>
          {anon && (
            <Link
              href="/?auth=signup"
              onClick={() => setOuvert(false)}
              className="rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-2 text-center text-[13px] font-semibold text-violet-50"
            >
              S&apos;inscrire
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
