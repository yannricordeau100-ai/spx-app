import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determine the sentiment of a YoY change.
 * For "Cost"-type KPIs, growth is BAD (loss/expense grew) → flip the sign.
 */
export function yoyTone(yoy: string, type?: string): "pos" | "neg" | "neutral" {
  const s = yoy.trim();
  let raw: "pos" | "neg" | "neutral" = "neutral";
  if (s.startsWith("+")) raw = "pos";
  else if (s.startsWith("-")) raw = "neg";

  // Cost-type KPIs (loss, expense): growth is bad
  if (type === "Cost" && raw !== "neutral") {
    return raw === "pos" ? "neg" : "pos";
  }
  return raw;
}

export function yoyColor(yoy: string, type?: string): string {
  const t = yoyTone(yoy, type);
  if (t === "pos") return "#10b981";
  if (t === "neg") return "#f43f5e";
  return "#a1a1aa";
}
