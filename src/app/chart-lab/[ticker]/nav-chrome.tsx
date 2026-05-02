"use client";

import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  Sigma,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { BackToTop } from "@/components/back-to-top";
import { DockSpyLeft, DockSpyRight, type DockSpySection } from "@/components/dock-spy";

/**
 * Wrapper client : tient le tableau de sections (avec composants Icon),
 * que la page server-component ne peut pas passer en props.
 */
const SECTIONS: DockSpySection[] = [
  { id: "sec-stock", label: "Cours action", Icon: TrendingUp },
  { id: "sec-rep", label: "Répartition", Icon: PieIcon },
  { id: "sec-bars", label: "Bars", Icon: BarChart3 },
  { id: "sec-curve", label: "Courbe", Icon: Activity },
  { id: "sec-var", label: "Variation", Icon: Sigma },
  { id: "sec-dash", label: "Tableau de bord", Icon: LayoutDashboard },
  { id: "sec-nav", label: "Navigation", Icon: Zap },
];

export function NavChrome() {
  return (
    <>
      <DockSpyLeft sections={SECTIONS} />
      <DockSpyRight sections={SECTIONS} />
      <BackToTop />
    </>
  );
}
