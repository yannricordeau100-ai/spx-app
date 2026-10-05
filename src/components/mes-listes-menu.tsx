"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, Star } from "lucide-react";

/**
 * Yann 12 sept 2026 : « Mes sociétés » et « Mes favoris » reunis dans un seul
 * bouton, a cote de Comparer, sur les fiches societes (connecte seulement).
 */
export function MesListesMenu({
  ouvert: ouvertProp,
  onOuvertChange,
}: {
  ouvert?: boolean;
  onOuvertChange?: (o: boolean) => void;
} = {}) {
  const [ouvertLocal, setOuvertLocal] = useState(false);
  const ouvert = ouvertProp ?? ouvertLocal;
  const setOuvert = (o: boolean) => {
    setOuvertLocal(o);
    onOuvertChange?.(o);
  };
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    const ferme = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("pointerdown", ferme);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", ferme);
      document.removeEventListener("keydown", echap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
  const lien = "flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-200 transition-colors hover:bg-[#141414] hover:text-zinc-50";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-label="Mes favoris"
        aria-expanded={ouvert}
        className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-[#262626] bg-[#0a0a0a] size-9 justify-center p-0 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3a3a] hover:text-zinc-50 sm:size-auto sm:px-3.5 sm:py-2"
      >
        <Star className="size-4 text-amber-300" />
        <span className="hidden sm:inline">Mes favoris</span>
        <ChevronDown className={`hidden size-3.5 transition-transform sm:block ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="fixed left-3 right-3 top-[4.5rem] z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-52 rounded-xl border border-[#262626] bg-[#0a0a0a] py-1 shadow-2xl">
          <Link href="/mes-societes" className={lien} onClick={() => setOuvert(false)}>
            <Bookmark className="size-4 text-violet-300" /> Mes sociétés
          </Link>
          <Link href="/account/favorites" className={lien} onClick={() => setOuvert(false)}>
            <Star className="size-4 text-amber-300" /> Mes KPI
          </Link>
        </div>
      )}
    </div>
  );
}
