"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric portion of a string from 0 → target on mount.
 * Preserves any non-numeric characters (commas, signs).
 */
export function NumberTicker({
  value,
  duration = 1400,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  // Détecte le format FR (virgule = décimale, espace = milliers) vs en-US
  // (virgule = milliers, point = décimale). Évite "325,27" → "32527" (bug).
  const isFR = /,\d{1,2}(?!\d)/.test(value) || /\s\d{3}\b/.test(value);
  const cleaned = isFR
    ? value.replace(/[\s  ]/g, "").replace(",", ".")
    : value.replace(/,/g, "");
  const sign = cleaned.startsWith("+") ? "+" : cleaned.startsWith("-") ? "-" : "";
  const target = parseFloat(cleaned);
  const decimals = (cleaned.split(".")[1] ?? "").length;
  const isNumeric = !Number.isNaN(target);
  const [display, setDisplay] = useState(isNumeric ? `${sign}0` : value);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric) return;
    // Nouvelle cible (ex promotion d'un KPI) → repartir de zéro, sinon le
    // timestamp de l'ancienne animation fausse le progress.
    startedAt.current = null;
    let raf = 0;
    let done = false;
    const finalFormatted = `${sign}${Math.abs(target).toLocaleString(isFR ? "fr-FR" : "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
    // Yann 18 août 2026 (audit AVGO) : un onglet ouvert en arrière-plan
    // (⌘-clic sur plusieurs stés) throttle requestAnimationFrame ET les
    // timers : le chiffre hero restait figé sur une valeur intermédiaire
    // FAUSSE (ex "4" au lieu de "15"). Onglet non visible = pas d'animation,
    // valeur finale affichée directement.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      setDisplay(finalFormatted);
      return;
    }
    const step = (t: number) => {
      if (startedAt.current === null) startedAt.current = t;
      const elapsed = t - startedAt.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.abs(target) * eased;
      const formatted = current.toLocaleString(isFR ? "fr-FR" : "en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplay(`${sign}${formatted}`);
      if (progress < 1) raf = requestAnimationFrame(step);
      else done = true;
    };
    raf = requestAnimationFrame(step);
    // Filet de sécurité : si requestAnimationFrame est throttlé (onglet en
    // arrière-plan), la valeur restait figée à mi-course. On force la valeur
    // finale une fois la durée écoulée.
    const snap = setTimeout(() => {
      if (!done) setDisplay(finalFormatted);
    }, duration + 250);
    // Si l'onglet passe en arrière-plan pendant l'animation, on fige
    // immédiatement sur la valeur finale plutôt que sur un palier faux.
    const onVisibility = () => {
      if (document.visibilityState !== "visible" && !done) {
        cancelAnimationFrame(raf);
        done = true;
        setDisplay(finalFormatted);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(snap);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target, duration, decimals, isNumeric, sign, isFR]);

  return <span className={className}>{display}</span>;
}
