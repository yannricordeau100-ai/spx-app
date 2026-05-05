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
    let raf = 0;
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
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals, isNumeric, sign]);

  return <span className={className}>{display}</span>;
}
