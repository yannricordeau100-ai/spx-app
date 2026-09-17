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
type Ste = { code: string; hero_actuel?: string; hero_nouveau?: string; statut?: string; note?: string; points?: number };
type Secteur = { statut: string; kpi_star: { star: string[]; choix: string; freq: string }; societes: Record<string, Ste> };

const LIB: Record<string, string> = {
  fait: "métrique reine posée (série nouvelle)", fait_partiel: "posée, série à prolonger", hero_bascule: "métrique reine posée (série existante)", deja_star: "déjà en héros",
  partiel: "KPI secondaire seulement", repli_fait: "graphique moyen terme déposé", repli_moyen_terme: "repli moyen terme prévu", repli_impossible: "aucune donnée publiée trouvée",
  a_faire: "à faire", a_refaire: "à refaire", a_verifier: "à vérifier",
};
const COULEUR: Record<string, string> = {
  fait: "text-emerald-300", fait_partiel: "text-emerald-200", hero_bascule: "text-emerald-300", deja_star: "text-emerald-300",
  partiel: "text-amber-200", repli_fait: "text-cyan-200", repli_moyen_terme: "text-amber-200", repli_impossible: "text-rose-300",
  a_faire: "text-zinc-400", a_refaire: "text-rose-300", a_verifier: "text-amber-200",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const secteurs = (ETAT as { secteurs: Record<string, Secteur>; cree_le?: string }).secteurs;
  const ok = new Set(["fait", "fait_partiel", "hero_bascule", "deja_star"]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">KPI star par secteur</h1>
      <p className="mt-2 max-w-3xl text-[13.5px] text-zinc-400">
        Pour chaque secteur à métrique propre, la métrique reine choisie et, société par société, son état : posée en héros, KPI secondaire seulement, repli en graphique moyen terme, ou données introuvables. État du chantier au {(ETAT as { cree_le?: string }).cree_le ?? ""}, mis à jour à chaque déploiement.
      </p>
      <div className="mt-6 grid gap-4">
        {Object.entries(secteurs).map(([id, s]) => {
          const stes = Object.entries(s.societes);
          const n = stes.length; const nOk = stes.filter(([, x]) => ok.has(x.statut ?? "")).length;
          return (
            <section key={id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-semibold capitalize text-zinc-50">{id.replace(/_/g, " ")}</h2>
                <span className="font-mono text-[12px] text-zinc-400">{nOk} / {n} sociétés sur la métrique reine</span>
              </div>
              <p className="mt-1 text-[12.5px] text-zinc-300"><span className="text-zinc-500">Métrique reine : </span>{s.kpi_star.choix}<span className="text-zinc-500"> · fréquence : </span>{s.kpi_star.freq}</p>
              <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {stes.sort(([a], [b]) => a.localeCompare(b)).map(([t, x]) => (
                  <div key={t} className="flex items-baseline gap-2 rounded-lg border border-white/[0.05] px-2 py-1 text-[12px]">
                    <a href={`/${t.toLowerCase()}`} className="w-16 shrink-0 font-mono font-semibold text-violet-200 hover:underline">{t}</a>
                    <span className={`shrink-0 ${COULEUR[x.statut ?? ""] ?? "text-zinc-400"}`}>{LIB[x.statut ?? ""] ?? x.statut}</span>
                    <span className="truncate text-zinc-500" title={x.note ?? ""}>{(x.hero_nouveau ?? x.hero_actuel ?? "").slice(0, 34)}</span>
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
