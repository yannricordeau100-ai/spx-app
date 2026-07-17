import report from "@/data/_kpi-lint-report.json";
import { KpiLintView } from "./kpi-lint-view";

export const metadata = {
  title: "KPI Lint · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Yann 18 juil 2026 : rapport du linter KPI (scripts/kpi-lint.ts).
 * Toutes les règles d'affichage et de fond, vérifiées programmatiquement sur
 * chaque KPI de chaque sté via le loader réel. Zéro LLM. Relançable :
 *   npx tsx scripts/kpi-lint.ts
 */
export default function KpiLintPage() {
  return <KpiLintView report={report as never} />;
}
