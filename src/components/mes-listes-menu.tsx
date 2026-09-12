"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, Star } from "lucide-react";

/**
 * Yann 12 sept 2026 : « Mes sociétés » et « Mes favoris » reunis dans un seul
 * bouton, a cote de Comparer, sur les fiches societes (connecte seulement).
 */
export function MesListesMenu() {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    const ferme = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", ferme);
    return () => document.removeEventListener("mousedown", ferme);
  }, [ouvert]);
  const lien = "flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-200 transition-colors hover:bg-[#141414] hover:text-zinc-50";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#0a0a0a] px-2.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3a3a] hover:text-zinc-50 sm:px-3.5"
      >
        <Bookmark className="size-4" />
        <span className="hidden sm:inline">Mes listes</span>
        <ChevronDown className={`size-3.5 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-[#262626] bg-[#0a0a0a] py-1 shadow-2xl">
          <Link href="/mes-societes" className={lien} onClick={() => setOuvert(false)}>
            <Bookmark className="size-4 text-violet-300" /> Mes sociétés
          </Link>
          <Link href="/account/favorites" className={lien} onClick={() => setOuvert(false)}>
            <Star className="size-4 text-amber-300" /> Mes favoris
          </Link>
        </div>
      )}
    </div>
  );
}
