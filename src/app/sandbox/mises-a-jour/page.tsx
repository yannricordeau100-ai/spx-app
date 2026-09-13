import CAL from "@/data/earnings-calendar.json";
import REGLES from "@/data/mise-a-jour-regles.json";
import NOMS from "@/data/v1-7-public.json";
import { calculerEtatMisesAJour } from "@/lib/mises-a-jour/etat";
import { Calendrier } from "./calendrier";

export const dynamic = "force-dynamic";

/**
 * Mises a jour des fiches (Yann 13 sept 2026) : calendrier des publications
 * (passe et futur), regles par bloc, etat vert / orange / rouge, alerte rouge.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  if (process.env.VISUAL_AUDIT_TOKEN && sp.audit_token !== process.env.VISUAL_AUDIT_TOKEN) return <main className="p-8 text-zinc-300">Jeton requis.</main>;
  const etat = await calculerEtatMisesAJour();
  const cal = CAL as { MAJ: string; par_ticker: Record<string, { prochaine?: string | null; precedente?: string | null; estimee?: boolean }>; historique?: Record<string, string[]> };
  const noms = NOMS as Record<string, { name?: string }>;
  const parJour: Record<string, { ticker: string; nom: string; estimee: boolean }[]> = {};
  const ajoute = (d: string | null | undefined, t: string, estimee: boolean) => { if (!d) return; (parJour[d] ??= []).push({ ticker: t, nom: noms[t]?.name ?? t, estimee }); };
  for (const [t, e] of Object.entries(cal.par_ticker)) { ajoute(e.precedente, t, false); ajoute(e.prochaine, t, !!e.estimee); for (const d of cal.historique?.[t] ?? []) if (d !== e.precedente && d !== e.prochaine) ajoute(d, t, false); }
  const regles = (REGLES as { regle_generale: string; blocs: { id: string; nom: string; declencheur: string; delai_jours: number; source: string }[] });
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      {etat.rougesTotal > 0 ? (
        <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-rose-300">Alerte rouge</div>
          <div className="mt-1 text-[15px] font-semibold text-rose-100">{etat.rougesTotal} bloc(s) en retard sur {etat.stesRouges.length} société(s) : délai J+3 dépassé.</div>
          <div className="mt-1 text-[12.5px] text-rose-200/80">{etat.blocs.filter((b) => b.rouge > 0).map((b) => `${b.nom.split(" (")[0]} : ${b.rouge}`).join(" · ")}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-[14px] text-emerald-100">Aucun bloc en retard au-delà de J+3.</div>
      )}
      <h1 className="mt-6 font-display text-[26px] font-bold">Mises à jour des fiches</h1>
      <p className="mt-1 text-[13px] text-zinc-400">Calendrier des publications de résultats (passé et à venir, sources MarketBeat pour les sociétés américaines et stockanalysis.com pour les autres, mis à jour chaque jour), puis état de chaque bloc selon les règles. Calculé le {etat.calculeLe.slice(0, 16).replace("T", " ")} sur {etat.univers} sociétés. Calendrier du {cal.MAJ}.</p>
      <Calendrier parJour={parJour} />
      <h2 className="mt-8 text-[17px] font-semibold">Règles et état par bloc</h2>
      <p className="mt-1 text-[12.5px] text-zinc-400">{regles.regle_generale}</p>
      <div className="mt-3 grid gap-2">
        {etat.blocs.map((b) => {
          const r = regles.blocs.find((x) => x.id === b.id);
          return (
            <details key={b.id} className={`rounded-lg border p-3 ${b.rouge > 0 ? "border-rose-500/40" : "border-white/10"}`}>
              <summary className="cursor-pointer text-[13px]">
                <span className="font-semibold text-zinc-100">{b.nom}</span>
                <span className="ml-2 font-mono text-[11px] text-zinc-500">{b.declencheur} · J+{b.delai_jours}</span>
                <span className="ml-3 font-mono text-[11px]"><span className="text-emerald-300">● {b.vert}</span> <span className="ml-2 text-amber-300">● {b.orange}</span> <span className="ml-2 text-rose-300">● {b.rouge}</span></span>
              </summary>
              <p className="mt-1.5 text-[11.5px] text-zinc-500">Source : {r?.source}</p>
              {b.rouges.length > 0 && (
                <ul className="mt-2 grid gap-0.5 text-[12px] sm:grid-cols-2">
                  {b.rouges.slice(0, 60).map((l) => <li key={l.ticker} className="text-rose-200"><span className="font-mono">{l.ticker}</span> {l.nom} <span className="text-zinc-500">· {l.motif}{l.jours ? ` · ${l.jours} j de retard` : ""}</span></li>)}
                </ul>
              )}
              {b.oranges_exemples.length > 0 && <p className="mt-1 text-[11.5px] text-amber-200/80">Orange (date inconnue ou délai en cours), exemples : {b.oranges_exemples.join(", ")}</p>}
            </details>
          );
        })}
      </div>
    </main>
  );
}
