import "server-only";
import type { ReactNode } from "react";
import { estAdminOutilsFiche, chargeCoursFmp } from "@/lib/admin/outils-admin-fiche";
import { CoursKpiBlock } from "@/components/admin/cours-kpi-block";
import { KpiSurMesureBlock, type DonneesDividendes } from "@/components/admin/kpi-sur-mesure-block";
import DIVIDENDES_TOP5 from "@/data/admin-dividendes-top5.json";
import type { FicheDemo } from "./data";

function deviseCotation(symbole: string): string {
  const s = symbole.toUpperCase();
  if (/\.(PA|DE|AS|MI|MC|BR|LS|HE|VI|IR|F)$/.test(s)) return "€";
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".L")) return "£";
  return "$";
}

/** Onglet Admin : meme controle serveur que la fiche reelle ; hors admin, rien n est rendu ni serialise. */
export async function chargeAdminBlocs(fiches: FicheDemo[]): Promise<Record<string, ReactNode> | null> {
  if (!(await estAdminOutilsFiche({ auditBypass: false }))) return null;
  const out: Record<string, ReactNode> = {};
  for (const f of fiches) {
    const c = f.company;
    const { cours, couverture } = await chargeCoursFmp(c.ticker);
    out[f.ticker] = (
      <>
        <CoursKpiBlock
          ticker={c.ticker}
          nomSociete={c.name}
          kpis={c.kpis ?? []}
          heroShort={c.hero_kpi}
          cours={cours ? { source: cours.source, symbole_fmp: cours.symbole_fmp, premiere_date: cours.premiere_date, derniere_date: cours.derniere_date, dernier_cours: cours.dernier_cours, plus_haut: cours.plus_haut, cloture_annee_precedente: cours.cloture_annee_precedente, points: cours.points } : null}
          motifNonCouvert={cours ? null : couverture.couvert === null ? "société pas encore testée, quota quotidien de l’API atteint" : couverture.motif ?? null}
          devisePrix={deviseCotation(cours?.symbole_fmp ?? c.ticker)}
        />
        <KpiSurMesureBlock donnees={DIVIDENDES_TOP5 as unknown as DonneesDividendes} />
      </>
    );
  }
  return out;
}
