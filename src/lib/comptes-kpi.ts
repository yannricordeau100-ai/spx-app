/**
 * Totaux automatiques des KPI (Yann 8 oct 2026).
 *
 * Compte, pour chaque fiche, les KPI REELLEMENT servis par bloc, avec les
 * memes regles que la fiche (company-view) :
 *  - Long terme   : tableau « Indicateurs clés long terme » = KPI avancés +
 *                   KPI standard + KPI arrêtés (groupesKpisFiche). = KPI IC.
 *  - Moyen terme  : graphiques approuvés du bloc « Indicateurs variés - Moyen
 *                   terme » (company.image_findings), si le bloc est actif.
 *  - Court terme  : slides du bloc « Faits marquants - Court terme (Stories) »
 *                   (buildStories), si le bloc est actif.
 *  - KPI total    = long terme + moyen terme + court terme.
 *
 * Genere par scripts/genere-comptes-kpi.ts a chaque mise en ligne
 * (scripts/deploy-niveau2.sh) dans src/data/kpi-comptes-industries.json.
 * Module SERVEUR pour la lecture : ne jamais importer le JSON depuis un
 * composant "use client" (les chiffres non affiches restent cote serveur).
 */
import type { Company } from "@/lib/data";
import { groupesKpisFiche } from "@/lib/groupes-kpis-fiche";
import { buildStories, hasStories } from "@/lib/kpi-stories-ordering";
import { isBlockEnabled } from "@/lib/v1-9-blocks-control";

export type CompteBlocs = {
  avances: number;
  standards: number;
  arretes: number;
  /** Long terme = avances + standards + arretes (= KPI IC). */
  long_terme: number;
  moyen_terme: number;
  /** Court terme = stories. */
  stories: number;
  ic: number;
  total: number;
  stes: number;
};

export type CompteSociete = { gics: string | null; avances: number; standards: number; arretes: number; moyen_terme: number; stories: number };

export type FichierComptesKpi = {
  maj: string;
  genere_le?: string;
  regle: string;
  global: CompteBlocs;
  par_industrie: Record<string, CompteBlocs>;
  par_societe?: Record<string, CompteSociete>;
};

export const REGLE_COMPTES =
  "KPI total = long terme (KPI IC : avances + standard + arretes, memes filtres que la fiche) + moyen terme (graphiques approuves) + court terme (stories)";

/** KPI d une fiche par bloc, avec les memes conditions d affichage que company-view. */
export function compteBlocsSociete(company: Company, desactives: string[]): CompteSociete {
  const g = groupesKpisFiche(company);
  const ticker = company.ticker;
  const off = new Set(desactives);
  const findings = (company as Company & { image_findings?: unknown[] }).image_findings;
  const moyen =
    isBlockEnabled("image_findings", ticker) && !off.has("graphiques_schemas") && Array.isArray(findings)
      ? findings.length
      : 0;
  const stories =
    isBlockEnabled("stories", ticker) && !off.has("kpi_stories") && hasStories(company.kpis, [])
      ? buildStories(company.kpis, []).reduce((n, c) => n + c.slides.length, 0)
      : 0;
  return {
    gics: company.gics_code ? String(company.gics_code) : null,
    avances: g.avances.length,
    standards: g.standards.length,
    arretes: g.arretes.length,
    moyen_terme: moyen,
    stories,
  };
}

const vide = (): CompteBlocs => ({ avances: 0, standards: 0, arretes: 0, long_terme: 0, moyen_terme: 0, stories: 0, ic: 0, total: 0, stes: 0 });

function ajoute(c: CompteBlocs, s: CompteSociete): void {
  const lt = s.avances + s.standards + s.arretes;
  c.avances += s.avances;
  c.standards += s.standards;
  c.arretes += s.arretes;
  c.long_terme += lt;
  c.ic += lt;
  c.moyen_terme += s.moyen_terme;
  c.stories += s.stories;
  c.total += lt + s.moyen_terme + s.stories;
  c.stes += 1;
}

/** Agrege les comptes par societe : total general et par industrie GICS (6 chiffres). */
export function agregeComptes(parSociete: Record<string, CompteSociete>): Pick<FichierComptesKpi, "global" | "par_industrie"> {
  const global = vide();
  const par: Record<string, CompteBlocs> = {};
  for (const s of Object.values(parSociete)) {
    ajoute(global, s);
    const code = s.gics ? s.gics.slice(0, 6) : "";
    if (code.length !== 6) continue;
    ajoute((par[code] ??= vide()), s);
  }
  const tri = Object.fromEntries(Object.entries(par).sort(([a], [b]) => a.localeCompare(b)));
  return { global, par_industrie: tri };
}
