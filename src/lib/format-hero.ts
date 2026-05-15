/**
 * Hero KPI formatting helpers — pipeline partagé entre la page sté
 * (`company-view.tsx`) et la home preview (`home-view.tsx` →
 * renderCompanyCard / TickerPreviewCard) pour garantir un rendu cohérent.
 *
 * Avant l'extraction (15 mai 2026, Yann), `autoRescaleSmallUnit` était
 * inline dans company-view.tsx → la home affichait "0,4 M units" pour
 * TSLA alors que la page sté affichait "410 K unités". Idem unit
 * "B €" non normalisée en "Mds €" sur ASMLF. Idem magnitude % aberrante
 * sur ASML (32 milliards de %, data fake non guardée).
 *
 * Toute UI qui affiche un hero KPI value+unit doit passer par
 * `prepareHeroDisplay()`.
 */

import { formatHeroValue, formatUnit } from "@/lib/data";

/**
 * Yann 15 mai 2026 : si l'unit dit "M X" / "Mds X" mais TOUTES les valeurs
 * du KPI sont < 1, on descend d'un cran de magnitude pour ne jamais
 * afficher "0,4 M unités" alors qu'on a en fait 400 000 unités.
 *
 * Marche pour : "M unités", "Mds $", "Mds €", "M €", "Mds GWh", etc.
 * Retourne { unit: nouvelle unit, factor: multiplicateur des valeurs }.
 */
export function autoRescaleSmallUnit(
  unit: string,
  allBelowOne: boolean,
): { unit: string; factor: number } {
  if (!allBelowOne) return { unit, factor: 1 };
  const u = unit.trim();
  // "Mds X" → "M X" (×1000)
  let m = u.match(/^Mds(\s+.+)$/i);
  if (m) return { unit: `M${m[1]}`, factor: 1000 };
  m = u.match(/^M(\s+.+)$/i);
  if (m) {
    // "M unités" / "M GWh" → unit brute (×1 000 000)
    const tail = m[1].trim();
    return { unit: tail, factor: 1_000_000 };
  }
  // Cas "M $" / "M €" / "M £" standalone
  if (u === "M $") return { unit: "$", factor: 1_000_000 };
  if (u === "M €") return { unit: "€", factor: 1_000_000 };
  if (u === "M £") return { unit: "£", factor: 1_000_000 };
  return { unit, factor: 1 };
}

/**
 * Yann 16 mai 2026 : guard contre les magnitudes % aberrantes (ex ASML
 * R&D = 32 667 300 000 % dans le dataset = bug extraction LLM, pas un
 * vrai pourcentage). Si on détecte value > 100 et unit contient "%",
 * c'est une donnée incohérente. On retourne `null` pour que l'UI
 * affiche "—" + tooltip d'erreur, plutôt que d'afficher 32 milliards de %.
 *
 * Seuil : 1000 % (tolère les vrais cas exceptionnels jusqu'à 999 %, ex
 * hyperinflation, dividend yield rare, growth +500 %). Au-dessus = bug.
 */
export function isPercentMagnitudeAnomaly(
  value: number | string | null | undefined,
  unit: string,
): boolean {
  if (value == null) return false;
  const u = String(unit ?? "").trim();
  if (!/%/.test(u)) return false;
  // Ignore les unités "% YoY", "pts", etc. — uniquement % brut.
  if (!/^%(\s|$)/.test(u) && u !== "%") return false;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return false;
  return Math.abs(num) > 1000;
}

/**
 * Pipeline complet de préparation d'un hero KPI pour rendu UI.
 * Renvoie value formatée + unit normalisée + flag `anomaly` si data
 * incohérente détectée (à utiliser pour afficher "—" + tooltip).
 *
 * Utilisé par :
 *  - company-view.tsx (HERO section, page sté)
 *  - home-view.tsx (TickerPreviewCard, home preview)
 *  - tout autre composant qui affiche un hero value+unit
 */
export function prepareHeroDisplay(
  rawValue: number | string | null | undefined,
  rawUnit: string | null | undefined,
  history?: number[],
): {
  value: string;
  unit: string;
  anomaly: boolean;
  anomalyReason?: string;
} {
  // Nettoyage unit
  const cleanUnit = String(rawUnit ?? "")
    .replace(/\s+deployed$/i, "")
    .replace(/\s+units$/i, " unités");

  // Magnitude % guard (ASML & co)
  if (isPercentMagnitudeAnomaly(rawValue, cleanUnit)) {
    return {
      value: "—",
      unit: "",
      anomaly: true,
      anomalyReason: "Donnée incohérente détectée (magnitude aberrante)",
    };
  }

  // Auto-rescale magnitude (TSLA 0.4 M units → 400 K unités)
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const hist = Array.isArray(history)
    ? history.filter((x): x is number => typeof x === "number")
    : [];
  const allBelowOne =
    hist.length > 0 &&
    hist.every((v) => Math.abs(v) < 1) &&
    (!Number.isFinite(numericValue) || Math.abs(numericValue) < 1);
  const { unit: scaledUnit, factor } = autoRescaleSmallUnit(cleanUnit, allBelowOne);
  const scaledValue = Number.isFinite(numericValue) ? numericValue * factor : rawValue;

  const formatted = formatHeroValue(scaledValue, scaledUnit);
  return {
    value: formatted.value,
    unit: formatted.unit,
    anomaly: false,
  };
}

/**
 * Pour les composants qui veulent juste l'unit formatée + reconnaissent
 * les variantes "B €", "B £" non couvertes par formatUnit() de data.ts.
 * Centralisé ici pour pouvoir étendre sans toucher data.ts.
 *
 * Yann 16 mai 2026 : "B €" non normalisé sur ASMLF (bookings 26.2 B €
 * affiché "B €" au lieu de "Mds €"). data.ts switch ne couvrait que "$B".
 */
export function formatHeroUnit(unit: string | null | undefined): string {
  const u = String(unit ?? "").trim();
  if (!u) return "";
  // Variantes "B X" / "Mds X" non couvertes par formatUnit() de base
  const bMatch = u.match(/^B\s+([€£¥$])$/);
  if (bMatch) return `Mds ${bMatch[1]}`;
  const mMatch = u.match(/^M\s+([€£¥$])$/);
  if (mMatch) return `M ${mMatch[1]}`;
  // "B €" sans espace → "Mds €"
  if (u === "B€") return "Mds €";
  if (u === "B£") return "Mds £";
  if (u === "B$") return "Mds $";
  return formatUnit(u);
}
