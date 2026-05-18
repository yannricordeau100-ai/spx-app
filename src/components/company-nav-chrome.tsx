"use client";

import {
  TrendingUp,
  LayoutGrid,
  Target,
  AlertTriangle,
  Building2,
  Brain,
  Sparkles,
} from "lucide-react";
import { DockSpyLeft, type DockSpySection } from "@/components/dock-spy";
import { BackToTop } from "@/components/back-to-top";
import { useT } from "@/lib/i18n/provider";

export function CompanyNavChrome() {
  const { t } = useT();
  const sections: DockSpySection[] = [
    { id: "sec-hero", label: t("nav.kpi_principal"), Icon: TrendingUp },
    { id: "sec-kpis", label: t("nav.kpi_table"), Icon: LayoutGrid },
    { id: "sec-market", label: t("nav.market_position"), Icon: Target },
    { id: "sec-risks", label: t("nav.risks"), Icon: AlertTriangle },
    { id: "sec-governance", label: t("nav.governance"), Icon: Building2 },
    { id: "sec-ai", label: t("nav.ai"), Icon: Brain },
    { id: "sec-super", label: t("nav.super_kpi"), Icon: Sparkles },
  ];
  return (
    <>
      <DockSpyLeft sections={sections} />
      <BackToTop />
    </>
  );
}
