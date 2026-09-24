"use client";

import {
  TrendingUp,
  LayoutGrid,
  Target,
  AlertTriangle,
  Building2,
  Brain,
  Sparkles,
  BookOpen,
  LineChart,
  Mic,
  Lightbulb,
  ShieldQuestion,
} from "lucide-react";
import { DockRailLeft, type DockSpySection } from "@/components/dock-spy";
import { BackToTop } from "@/components/back-to-top";
import { useT } from "@/lib/i18n/provider";

export function CompanyNavChrome() {
  const { t } = useT();
  const sections: DockSpySection[] = [
    // Yann 24 sept 2026 : toutes les parties de la fiche, dans l ordre de la page.
    { id: "sec-comprendre", label: t("nav.comprendre"), Icon: BookOpen },
    { id: "sec-hero", label: t("nav.kpi_principal"), Icon: TrendingUp },
    { id: "sec-kpis", label: t("nav.kpi_table"), Icon: LayoutGrid },
    { id: "sec-moyen-terme", label: t("nav.moyen_terme"), Icon: LineChart },
    { id: "sec-ca-moat-tam", label: t("nav.market_position"), Icon: Target },
    { id: "sec-risks", label: t("nav.risks"), Icon: AlertTriangle },
    { id: "sec-governance", label: t("nav.governance"), Icon: Building2 },
    { id: "sec-ai", label: t("nav.ai"), Icon: Brain },
    { id: "sec-resultats", label: t("nav.resultats"), Icon: Mic },
    { id: "sec-these", label: t("nav.these"), Icon: Lightbulb },
    { id: "sec-att", label: t("nav.att"), Icon: ShieldQuestion },
    // Yann 25 aout 2026 : bloc Super-KPI desactive, entree de nav retiree.

  ];
  return (
    <>
      <DockRailLeft sections={sections} showSocial />
      <BackToTop />
    </>
  );
}
