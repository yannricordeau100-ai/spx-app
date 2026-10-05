"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Yann 5 oct 2026 : sur mobile, la bascule jour/nuit quitte la barre du haut
 * et passe dans un menu « ... », ce qui libere la place pour la recherche.
 * Visible uniquement sous 640 px (la bascule reste directe au-dessus).
 */
export function NavPlusMenu({ paid }: { paid: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);
  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-label="Plus d'options"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0e]/80 text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[80] mt-2 flex w-56 items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 shadow-2xl"
        >
          <span className="text-[12.5px] font-medium text-zinc-200">Affichage</span>
          <ThemeToggle paid={paid} />
        </div>
      )}
    </div>
  );
}
