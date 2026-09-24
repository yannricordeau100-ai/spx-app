import { NextResponse } from "next/server";
import { estAdminSandbox } from "@/lib/desk/auth";
import ETAT from "@/data/kpi-industries-etat.json";

export const dynamic = "force-dynamic";

type KpiEtat = { fr: string; en: string; stes_avec?: string[]; stes_sans?: Record<string, string>; sans_objet?: string[] };
type Industrie = { code: string; industrie: string; secteur: string; stes: string[]; kpis: KpiEtat[] };

/**
 * Yann 25 sept 2026 : « KPI que les institutionnels regardent », vue admin
 * uniquement. Referentiel des 74 industries GICS (docs/cahier), avec pour la
 * societe l etat de chaque KPI : sur la fiche, non publie (raison), sans objet.
 */
export async function GET(req: Request) {
  if (!(await estAdminSandbox(req))) return NextResponse.json({ admin: false });
  const t = (new URL(req.url).searchParams.get("ticker") ?? "").toUpperCase();
  const ind = (ETAT as unknown as { industries: Industrie[] }).industries.find((i) =>
    i.stes.some((s) => s.toUpperCase() === t || s.toUpperCase().replace(/-/g, ".") === t.replace(/-/g, ".")),
  );
  if (!ind) return NextResponse.json({ admin: true, industrie: null, kpis: [] });
  const kpis = ind.kpis.map((k) => {
    const avec = (k.stes_avec ?? []).map((s) => s.toUpperCase()).includes(t);
    const so = (k.sans_objet ?? []).map((s) => s.toUpperCase()).includes(t);
    const raison = Object.entries(k.stes_sans ?? {}).find(([s]) => s.toUpperCase() === t)?.[1] ?? null;
    return { fr: k.fr, en: k.en, etat: avec ? "present" : so ? "sans_objet" : "absent", raison };
  });
  return NextResponse.json({ admin: true, industrie: ind.industrie, secteur: ind.secteur, code: ind.code, maj: (ETAT as { maj?: string }).maj ?? null, kpis });
}
