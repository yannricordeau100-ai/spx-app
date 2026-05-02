"use client";

import { useRef, useState } from "react";

/**
 * AcronymHover — wrap un acronyme (ex : "DAP") pour révéler son nom
 * complet au survol après un délai court (~ 180 ms). Beaucoup plus
 * réactif que l'attribut natif `title=""` (qui s'affiche après ~1 s).
 *
 * Le tooltip est positionné en absolute, ne pousse pas le layout, et
 * disparaît immédiatement quand la souris sort.
 */
export function AcronymHover({
  label,
  children,
  align = "center",
}: {
  /** Texte complet à révéler (ex : "Daily Active People") */
  label: string;
  /** L'acronyme cliquable / hoverable, déjà stylé par le parent */
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(true), 180);
  };
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  };

  const alignCls =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute top-full z-50 mt-1.5 whitespace-nowrap rounded-md border border-zinc-700 bg-[#0a0a0e]/95 px-2 py-1 text-[11px] font-medium leading-tight text-zinc-100 shadow-lg backdrop-blur ${alignCls}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
