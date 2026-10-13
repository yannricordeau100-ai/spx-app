import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determine the sentiment of a YoY change.
 * For "Cost"-type KPIs, growth is BAD (loss/expense grew) → flip the sign.
 */
export function yoyTone(yoy: string | number | null | undefined, type?: string): "pos" | "neg" | "neutral" {
  // Yann 13 mai 2026 : tolère yoy en number brut (cas GWW=4.5, DINO=-6 sortis
  // du pipeline LLM sans formatting "+x%"). Évite crash sur fiches.
  let s: string;
  if (typeof yoy === "number") {
    s = (yoy > 0 ? "+" : "") + String(yoy);
  } else if (typeof yoy === "string") {
    s = yoy.trim();
  } else {
    return "neutral";
  }
  let raw: "pos" | "neg" | "neutral" = "neutral";
  // 13 oct 2026 : un zero (« -0,0 % », « +0 ») reste neutre, jamais rouge ni vert.
  const num = parseFloat(s.replace(/[+\-−\s ]/g, "").replace(",", "."));
  if (Number.isFinite(num) && num === 0 && !/[1-9]/.test(s)) return "neutral";
  if (s.startsWith("+")) raw = "pos";
  else if (s.startsWith("-")) raw = "neg";

  // Cost-type KPIs (loss, expense): growth is bad
  if (type === "Cost" && raw !== "neutral") {
    return raw === "pos" ? "neg" : "pos";
  }
  return raw;
}

export function yoyColor(yoy: string | number, type?: string): string {
  const t = yoyTone(yoy, type);
  if (t === "pos") return "#10b981";
  if (t === "neg") return "#f43f5e";
  return "#a1a1aa";
}
