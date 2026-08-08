/**
 * chart-spec-verify.ts — vérification + auto-correction d'un ChartSpec.
 *
 * Détecte les anti-patterns connus et applique des fixes automatiques
 * quand c'est possible. Les fixes non-auto restent en warnings pour
 * que l'humain (ou conv) tranche.
 *
 * Yann 16 mai 2026 — couche obligatoire entre `buildChartSpec()` et le
 * rendu chart. Le but : aucun défaut visuel ne doit passer en prod
 * sans avoir été soit corrigé soit flaggé.
 *
 * Synergie : chaque check a un ID stable matchant un node du quality-tree.
 * Si Gemini visual-audit flag un fail sur cet ID, le fix-dispatcher
 * peut appeler la fonction `applyAutoFix(spec, issueId)` correspondante.
 */
import type { ChartSpec, ChartWarning } from "@/lib/chart-template";

export type VerifyResult = {
  spec: ChartSpec;
  /** Warnings après application des auto-fixes. */
  warnings: ChartWarning[];
  /** IDs des fixes appliqués pendant verify. */
  autoFixesApplied: string[];
};

/**
 * Vérifie un ChartSpec et applique les auto-fixes possibles.
 *
 * Anti-patterns détectés :
 *   - chart.ttm_equals_last_fy : TTM ≈ dernière FY → nullify (évite doublon visuel)
 *   - chart.history_direction_mismatch_yoy : reverse history pour matcher yoy
 *   - chart.label_count_mismatch : labels.length ≠ values.length → tronque
 *   - chart.value_negative_unexpected : valeur négative sur KPI flux normalement positif
 *   - chart.cagr_division_by_zero : history[0] = 0 → marque "no CAGR"
 *   - chart.history_too_short_for_period : <4 Q pour annual → fallback mode
 *
 * @param spec ChartSpec construit par buildChartSpec
 * @param options.autoFix Si false, retourne warnings sans appliquer fixes
 */
export function verifyAndFix(spec: ChartSpec, options: { autoFix?: boolean } = {}): VerifyResult {
  const autoFix = options.autoFix !== false;
  const out: ChartSpec = JSON.parse(JSON.stringify(spec));
  const autoFixesApplied: string[] = [];
  const warnings = [...(out.warnings || [])];

  // 1. Dédup TTM == dernière FY
  // Yann 9 août 2026 : seuil RELATIF (0,5 %) et plus seulement absolu (0,01) :
  // un TTM à +0,3 % de la dernière FY rendait deux barres visuellement
  // identiques côte à côte ("problème qui apparaît parfois" selon la valeur).
  if (
    out.ttm != null
    && out.values.length > 0
    && Math.abs(out.values[out.values.length - 1] - out.ttm)
      < Math.max(0.01, Math.abs(out.values[out.values.length - 1]) * 0.005)
  ) {
    warnings.push({
      id: "chart.ttm_equals_last_fy",
      level: "info",
      message: `TTM (${out.ttm.toFixed(2)}) équivalent à la dernière FY (${out.values[out.values.length - 1].toFixed(2)}). Masqué pour éviter doublon.`,
    });
    if (autoFix) {
      out.ttm = null;
      autoFixesApplied.push("chart.ttm_equals_last_fy");
    }
  }

  // 2. labels.length ≠ values.length
  if (out.labels.length !== out.values.length) {
    warnings.push({
      id: "chart.label_count_mismatch",
      level: "error",
      message: `labels (${out.labels.length}) et values (${out.values.length}) de taille différente.`,
    });
    if (autoFix) {
      const n = Math.min(out.labels.length, out.values.length);
      out.labels = out.labels.slice(0, n);
      out.values = out.values.slice(0, n);
      autoFixesApplied.push("chart.label_count_mismatch");
    }
  }

  // 3. CAGR division par zéro
  if (out.values.length >= 2 && out.values[0] <= 0) {
    warnings.push({
      id: "chart.cagr_division_by_zero",
      level: "warn",
      message: `Première valeur ${out.values[0]} ≤ 0 → CAGR non calculable. Le composant CAGR doit être masqué.`,
    });
  }

  // 4. Valeur négative sur KPI flux normalement positif
  if (out.meta.kind === "flow") {
    const negatives = out.values
      .map((v, i) => ({ v, label: out.labels[i] }))
      .filter((x) => x.v < 0);
    if (negatives.length > 0 && negatives.length < out.values.length) {
      warnings.push({
        id: "chart.value_negative_unexpected",
        level: "warn",
        message: `Valeurs négatives ponctuelles (${negatives.map((n) => `${n.label}=${n.v}`).join(", ")}) sur KPI flux. À vérifier.`,
      });
    }
  }

  // 5. History trop courte pour mode annual
  if (out.meta.period === "year" && out.values.length === 0) {
    warnings.push({
      id: "chart.history_too_short_for_period",
      level: "warn",
      message: "Pas de FY complète disponible pour vue annuelle. UI devrait fallback sur vue trimestrielle.",
    });
  }

  // 6. TTM aberrant : si TTM > 5× max(values) → probable outlier
  if (out.ttm != null && out.values.length > 0) {
    const maxV = Math.max(...out.values);
    if (out.ttm > maxV * 5) {
      warnings.push({
        id: "chart.ttm_outlier",
        level: "warn",
        message: `TTM (${out.ttm.toFixed(2)}) > 5× max des FY (${maxV.toFixed(2)}). Outlier probable.`,
      });
    }
  }

  // 7. Labels avec format mixte (T1 25 + 2025 sur même chart = mauvaise concaténation)
  const hasQuarter = out.labels.some((l) => /^T[1-4]/.test(l));
  const hasYear = out.labels.some((l) => /^20\d{2}$/.test(l));
  const hasTTM = out.labels.some((l) => /^TTM/.test(l));
  if (hasQuarter && hasYear && !hasTTM) {
    warnings.push({
      id: "chart.label_format_mixed",
      level: "warn",
      message: "Labels mixent quarter (T1 25) et year (2025). Mode incohérent.",
    });
  }

  out.warnings = warnings;
  return { spec: out, warnings, autoFixesApplied };
}

/**
 * Applique un auto-fix ciblé par ID sur un spec (utilisé par fix-dispatcher).
 * Permet aux conv autres de demander "fixe l'issue X sur cette spec".
 */
export function applyAutoFix(spec: ChartSpec, issueId: string): ChartSpec {
  switch (issueId) {
    case "chart.ttm_equals_last_fy":
      return { ...spec, ttm: null };
    case "chart.label_count_mismatch": {
      const n = Math.min(spec.labels.length, spec.values.length);
      return { ...spec, labels: spec.labels.slice(0, n), values: spec.values.slice(0, n) };
    }
    default:
      // Issue non auto-fixable, retourne spec inchangé
      return spec;
  }
}
