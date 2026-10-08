import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { GICS } from "@/lib/desk/gics";
import COMPTES from "@/data/kpi-comptes-industries.json";
import type { CompteBlocs, FichierComptesKpi } from "@/lib/comptes-kpi";

/**
 * Totaux automatiques des KPI (Yann 8 oct 2026), reserve a l admin.
 * Source : src/data/kpi-comptes-industries.json, regenere a chaque mise en
 * ligne par scripts/genere-comptes-kpi.ts a partir des fiches reellement
 * servies. L accueil n en recoit que le total par industrie et le total general.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Totaux des KPI · Mettrik AI", robots: { index: false, follow: false } };

const nf = (n: number) => n.toLocaleString("fr-FR");

const BLOCS: { cle: keyof CompteBlocs; libelle: string; detail: string }[] = [
  { cle: "long_terme", libelle: "Long terme", detail: "Indicateurs clés long terme (KPI IC)" },
  { cle: "moyen_terme", libelle: "Moyen terme", detail: "Indicateurs variés, graphiques approuvés" },
  { cle: "stories", libelle: "Court terme", detail: "Faits marquants (stories)" },
];

function Ligne({ code, nom, c, fort = false }: { code: string; nom: string; c: CompteBlocs; fort?: boolean }) {
  const cls = fort ? "bg-white/[0.04] font-semibold text-zinc-100" : "text-zinc-300";
  return (
    <tr className={`border-t border-white/[0.06] ${cls}`}>
      <td className="px-2 py-1.5 font-mono text-[11px] text-zinc-500">{code}</td>
      <td className="px-2 py-1.5">{nom}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.stes)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.avances)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.standards)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.arretes)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.long_terme)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.moyen_terme)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{nf(c.stories)}</td>
      <td className="px-2 py-1.5 text-right font-mono text-orange-400">{nf(c.total)}</td>
    </tr>
  );
}

const somme = (l: CompteBlocs[]): CompteBlocs =>
  l.reduce(
    (a, c) => ({
      avances: a.avances + c.avances, standards: a.standards + c.standards, arretes: a.arretes + c.arretes,
      long_terme: a.long_terme + c.long_terme, moyen_terme: a.moyen_terme + c.moyen_terme, stories: a.stories + c.stories,
      ic: a.ic + c.ic, total: a.total + c.total, stes: a.stes + c.stes,
    }),
    { avances: 0, standards: 0, arretes: 0, long_terme: 0, moyen_terme: 0, stories: 0, ic: 0, total: 0, stes: 0 },
  );

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const f = COMPTES as unknown as FichierComptesKpi;
  const g = f.global;
  const par = f.par_industrie;
  const codesConnus = new Set(GICS.flatMap((s) => s.groups.flatMap((gr) => gr.industries.map((i) => i.code))));
  const horsArbre = Object.keys(par).filter((c) => !codesConnus.has(c));
  const sansIndustrie = g.stes - Object.values(par).reduce((n, c) => n + c.stes, 0);
  const genere = f.genere_le ? new Date(f.genere_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : f.maj;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-zinc-100">
      <h1 className="font-display text-[22px] font-bold">Totaux des KPI</h1>
      <p className="mt-1 text-[13px] text-zinc-400">
        Calculés sur les fiches réellement servies, avec les mêmes règles que la fiche, et recalculés à chaque mise en ligne. Dernier calcul : {genere}.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BLOCS.map((b) => (
          <div key={b.cle} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{b.libelle}</div>
            <div className="mt-1 font-mono text-[22px] font-semibold">{nf(g[b.cle])}</div>
            <div className="text-[11.5px] text-zinc-500">{b.detail}</div>
          </div>
        ))}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Sociétés</div>
          <div className="mt-1 font-mono text-[22px] font-semibold">{nf(g.stes)}</div>
          <div className="text-[11.5px] text-zinc-500">fiches comptées</div>
        </div>
        <div className="rounded-xl border border-orange-400/30 bg-orange-400/[0.05] p-3">
          <div className="text-[11px] uppercase tracking-wider text-orange-300">Total général</div>
          <div className="mt-1 font-mono text-[22px] font-semibold text-orange-400">{nf(g.total)}</div>
          <div className="text-[11.5px] text-zinc-500">affiché sur l’accueil</div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-zinc-500">
        Long terme : {nf(g.avances)} KPI avancés, {nf(g.standards)} KPI standard, {nf(g.arretes)} KPI arrêtés par la société. Total général = long terme + moyen terme + court terme.
        {sansIndustrie > 0 ? ` ${sansIndustrie} société(s) sans code d’industrie : comptées dans le total général seulement.` : ""}
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[820px] text-[12.5px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Secteur / industrie GICS</th>
              <th className="px-2 py-2 text-right">Stés</th>
              <th className="px-2 py-2 text-right">Avancés</th>
              <th className="px-2 py-2 text-right">Standard</th>
              <th className="px-2 py-2 text-right">Arrêtés</th>
              <th className="px-2 py-2 text-right">Long terme</th>
              <th className="px-2 py-2 text-right">Moyen terme</th>
              <th className="px-2 py-2 text-right">Court terme</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {GICS.map((s) => {
              const inds = s.groups.flatMap((gr) => gr.industries).filter((i) => par[i.code]);
              if (inds.length === 0) return null;
              return [
                <Ligne key={s.code} code={s.code} nom={s.name} c={somme(inds.map((i) => par[i.code]!))} fort />,
                ...inds.map((i) => <Ligne key={i.code} code={i.code} nom={i.name} c={par[i.code]!} />),
              ];
            })}
            {horsArbre.map((c) => <Ligne key={c} code={c} nom="Code hors classification" c={par[c]!} />)}
            <Ligne code="" nom="Total général" c={g} fort />
          </tbody>
        </table>
      </div>
    </main>
  );
}
