"use client";

import { useEffect } from "react";
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

/**
 * Yann 5 oct 2026 : marque <html data-zone-graphique-visible> tant qu une zone
 * de graphique ([data-zone-graphique] : graph + barre Reglages) est a l ecran.
 * Le CSS (globals.css) en deduit le masquage des flottants sur mobile et en
 * paysage court : aucun bouton ne recouvre plus un graphique.
 */
function useZoneGraphiqueVisible() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const racine = document.documentElement;
    const visibles = new Set<Element>();
    const io = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (e.isIntersecting) visibles.add(e.target);
        else visibles.delete(e.target);
      }
      if (visibles.size > 0) racine.setAttribute("data-zone-graphique-visible", "1");
      else racine.removeAttribute("data-zone-graphique-visible");
    });
    const brancher = () => document.querySelectorAll("[data-zone-graphique]").forEach((el) => io.observe(el));
    brancher();
    // La fiche se monte par morceaux : on rebranche les zones apparues apres coup.
    const t = window.setTimeout(brancher, 1500);
    return () => {
      window.clearTimeout(t);
      io.disconnect();
      racine.removeAttribute("data-zone-graphique-visible");
    };
  }, []);
}

export function CompanyNavChrome() {
  useZoneGraphiqueVisible();
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
      {/* Yann 4 oct 2026 : plus de bouton X ni de points dans le rail, X en pied de fiche. */}
      <DockRailLeft sections={sections} />
      <BackToTop />
    </>
  );
}
