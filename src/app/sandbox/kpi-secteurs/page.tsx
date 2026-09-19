import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import ETAT from "@/data/kpi-secteurs-etat.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "KPI star par secteur · Sandbox Mettrik", robots: { index: false, follow: false } };

/**
 * /sandbox/kpi-secteurs (Yann 17 sept 2026) : pour chaque secteur a metrique
 * propre (banques, assureurs, petrole, utilities...), la metrique reine et,
 * societe par societe, si elle est posee en heros. Meme logique que l onglet
 * « KPI par industrie ». Source : src/data/kpi-secteurs-etat.json, copie de
 * l etat du chantier (.conv-state/secteurs-kpi-star.json).
 */
type Ste = { code: string; hero_actuel?: string; hero_nouveau?: string; statut?: string; note?: string; points?: number; kpi_nom?: string; kpi_etat?: string; graphiques_approuves?: boolean };
type Secteur = { statut: string; kpi_star: { star: string[]; choix: string; freq: string }; societes: Record<string, Ste> };

const LIB: Record<string, string> = {
  fait: "métrique reine posée (série nouvelle)", fait_partiel: "posée, série à prolonger", hero_bascule: "métrique reine posée (série existante)", deja_star: "déjà en héros",
  partiel: "KPI secondaire seulement", repli_fait: "graphique moyen terme déposé", repli_moyen_terme: "repli moyen terme prévu", repli_impossible: "aucune donnée publiée trouvée",
  a_faire: "à faire", a_refaire: "à refaire", a_verifier: "à vérifier",
};

// Yann 18 sept 2026 : on affiche le NOM du KPI de chaque societe, pas le libelle
// d etat du chantier. Vert : le KPI est le heros de la fiche. Orange : il est
// present dans les KPI IC mais n est pas le heros. Rouge : il n existe pas.
const ETAT_COULEUR: Record<string, string> = {
  heros: "text-emerald-300",
  moyen_terme: "text-emerald-300",
  present: "text-amber-300",
  absent: "text-rose-400",
};
const ETAT_LIB: Record<string, string> = {
  heros: "KPI présent et posé en héros",
  moyen_terme: "Métrique couverte par au moins un graphique moyen terme approuvé",
  present: "KPI présent dans les KPI IC, mais pas en héros",
  absent: "KPI absent des KPI IC",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const secteurs = (ETAT as unknown as { secteurs: Record<string, Secteur>; cree_le?: string }).secteurs;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">KPI star par secteur</h1>
      <p className="mt-1 text-[12px] text-cyan-300">Cadre pointillé cyan et « 📊 MT » : société dont le KPI spécifique est rendu en KPI moyen terme (graphique reconstruit), faute de série longue.</p>
      <p className="mt-2 max-w-3xl text-[13.5px] text-zinc-400">
        Pour chaque secteur à métrique propre, la métrique reine choisie et, société par société, le nom du KPI correspondant sur la fiche. En vert il est posé en héros, en orange il existe dans les KPI IC sans être le héros, en rouge il n&apos;existe pas. Relevé sur les fiches réellement servies le {(ETAT as { maj_le?: string; cree_le?: string }).maj_le ?? (ETAT as { cree_le?: string }).cree_le ?? ""}.
      </p>
      <div className="mt-6 grid gap-4">
        {Object.entries(secteurs).map(([id, s]) => {
          const stes = Object.entries(s.societes);
          const n = stes.length; const nOk = stes.filter(([, x]) => x.kpi_etat === "heros" || x.kpi_etat === "moyen_terme").length;
          return (
            <section key={id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-semibold capitalize text-zinc-50">{id.replace(/_/g, " ")}</h2>
                <span className="font-mono text-[12px] text-zinc-400">{nOk} / {n} sociétés sur la métrique reine</span>
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-300"><span className="text-zinc-500">Métrique reine : </span>{s.kpi_star.choix}<span className="text-zinc-500"> · fréquence : </span>{s.kpi_star.freq}</p>
              <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {stes.sort(([a], [b]) => a.localeCompare(b)).map(([t, x]) => (
                  <div key={t} className={`flex items-baseline gap-2 rounded-lg px-2 py-1 text-[12px] ${(x.statut ?? "").startsWith("repli") ? "border-2 border-dashed border-cyan-400/60 bg-cyan-500/[0.06]" : "border border-white/[0.05]"}`} title={(x.statut ?? "").startsWith("repli") ? "KPI spécifique rendu en graphique moyen terme (pas de série longue)" : undefined}>
                    {(x.statut ?? "").startsWith("repli") && <span className="shrink-0 font-mono text-[10px] text-cyan-300">📊 MT</span>}
                    <a href={`/${t.toLowerCase()}`} className="w-16 shrink-0 font-mono font-semibold text-violet-200 hover:underline">{t}</a>
                    <span
                      className={`truncate ${ETAT_COULEUR[x.kpi_etat ?? ""] ?? "text-zinc-400"}`}
                      title={`${ETAT_LIB[x.kpi_etat ?? ""] ?? LIB[x.statut ?? ""] ?? ""}${x.note ? ` · ${x.note}` : ""}`}
                    >
                      {x.kpi_nom ?? x.hero_nouveau ?? x.hero_actuel ?? "(non défini)"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
