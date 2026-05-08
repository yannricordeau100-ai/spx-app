"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Hook réutilisable de swipe pour les blocs Stories.
 *
 * Intercepte les événements pointer (mouse + touch) sur un élément cible et
 * déclenche `onPrev` / `onNext` quand l'utilisateur drag horizontalement
 * d'une distance > seuil (par défaut 50px) sans drag vertical excessif.
 *
 * Comportement :
 *  - Mouse drag : maintient le bouton + déplace → swipe quand relâché
 *  - Touch swipe : touch + slide → swipe au touchend
 *  - Cancel automatique si drag vertical > horizontal × 2 (utilisateur scroll
 *    plutôt que swipe)
 *  - Cancel si délai > 600ms (drag trop lent = pas un swipe)
 *  - Curseur passe en `grab` au survol et `grabbing` pendant le drag
 *
 * Usage :
 *   const ref = useRef<HTMLDivElement>(null);
 *   useSwipeStories(ref, { onPrev: goPrev, onNext: goNext });
 *   return <div ref={ref}>...</div>
 */
export function useSwipeStories<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  opts: {
    onPrev: () => void;
    onNext: () => void;
    threshold?: number;
    maxDuration?: number;
  }
) {
  const { onPrev, onNext, threshold = 50, maxDuration = 600 } = opts;

  // State du drag courant. Utilisé via ref pour éviter de re-render à chaque
  // mouvement de souris.
  const stateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTime: number;
  }>({ active: false, startX: 0, startY: 0, startTime: 0 });

  const handleStart = useCallback((x: number, y: number) => {
    stateRef.current = {
      active: true,
      startX: x,
      startY: y,
      startTime: performance.now(),
    };
  }, []);

  const handleEnd = useCallback(
    (x: number, y: number) => {
      const s = stateRef.current;
      if (!s.active) return;
      stateRef.current.active = false;
      const dx = x - s.startX;
      const dy = y - s.startY;
      const dt = performance.now() - s.startTime;

      // Pas un swipe si trop lent
      if (dt > maxDuration) return;
      // Pas un swipe si drag vertical >> horizontal (utilisateur scrollait)
      if (Math.abs(dy) > Math.abs(dx) * 2) return;
      // Pas un swipe si distance horizontale trop courte
      if (Math.abs(dx) < threshold) return;

      if (dx > 0) onPrev();
      else onNext();
    },
    [onPrev, onNext, threshold, maxDuration]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set cursor
    el.style.cursor = "grab";

    const onMouseDown = (e: MouseEvent) => {
      // Ignorer si clic sur un input / button (préserver les interactions)
      const target = e.target as HTMLElement;
      if (
        target.closest("input, button, select, textarea, a, [role='slider'], [role='button']")
      ) {
        return;
      }
      handleStart(e.clientX, e.clientY);
      el.style.cursor = "grabbing";
    };
    const onMouseUp = (e: MouseEvent) => {
      handleEnd(e.clientX, e.clientY);
      el.style.cursor = "grab";
    };
    const onMouseLeave = () => {
      stateRef.current.active = false;
      el.style.cursor = "grab";
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input, button, select, textarea, a, [role='slider'], [role='button']")
      ) {
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      handleStart(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      handleEnd(t.clientX, t.clientY);
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.style.cursor = "";
    };
  }, [ref, handleStart, handleEnd]);
}
