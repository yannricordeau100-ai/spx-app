/**
 * 8 oct 2026 (audit des fuites publiques, ligne 11) : seuls les nombres
 * AFFICHES sur l accueil (KPI totaux par industrie GICS et total general)
 * sont transmis au navigateur. Les KPI avances (exclusifs), standards,
 * stories, IC et le nombre de societes restent cote serveur.
 * Module serveur : ne jamais l importer depuis un composant "use client".
 * 8 oct 2026 (Yann) : le fichier n est plus un instantane du 13 septembre. Il
 * est regenere a chaque mise en ligne par scripts/genere-comptes-kpi.ts a
 * partir des fiches reellement servies (long terme + moyen terme + court
 * terme, src/lib/comptes-kpi.ts). Detail par bloc : /sandbox/comptes-kpi.
 */
import COMPTES from "@/data/kpi-comptes-industries.json";
import type { ComptesGicsPublics } from "@/components/home-gics-block";

export function comptesGicsPublics(): ComptesGicsPublics {
  const c = COMPTES as { par_industrie: Record<string, { total: number }>; global: { total: number } };
  const parIndustrie: Record<string, number> = {};
  for (const [code, v] of Object.entries(c.par_industrie)) parIndustrie[code] = v.total;
  return { parIndustrie, total: c.global.total };
}
