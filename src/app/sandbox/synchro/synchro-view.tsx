"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Mic, BarChart3, Sparkles } from "lucide-react";
import type { CategorieSynchro, EtatSynchro } from "@/lib/synchro/etat";
import type { Interrupteurs } from "@/lib/synchro/interrupteurs";

const CATS: { cle: CategorieSynchro; titre: string; Icon: typeof Mic; quoi: string; comment: string }[] = [
  {
    cle: "transcripts",
    titre: "Transcripts d’earnings calls",
    Icon: Mic,
    quoi: "Le transcript de la dernière conférence de résultats (src/data/transcripts), puis sa synthèse.",
    comment: "À jour si la page porte un transcript daté au plus tard 45 jours après le dernier dépôt SEC (10-Q ou 10-K).",
  },
  {
    cle: "kpi_ic",
    titre: "KPI · indicateurs clés",
    Icon: BarChart3,
    quoi: "Le nouveau point trimestriel ou semestriel de chaque indicateur clé (séries longues du tableau).",
    comment: "À jour si le dernier point de la page couvre la fin de période du dernier dépôt SEC (tolérance 10 jours).",
  },
  {
    cle: "kpi_stories",
    titre: "KPI · stories",
    Icon: Sparkles,
    quoi: "Les stories (KPI à série courte, chiffres ponctuels des communiqués et des calls).",
    comment: "À jour si une story de la page date au moins de la fin de période du dernier dépôt SEC (tolérance 10 jours).",
  },
];

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function SynchroView({ etat, interrupteurs: init }: { etat: EtatSynchro; interrupteurs: Interrupteurs }) {
  const [inter, setInter] = useState<Interrupteurs>(init);
  const [enCours, setEnCours] = useState<CategorieSynchro | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<CategorieSynchro | null>(null);

  async function bascule(cle: CategorieSynchro) {
    setEnCours(cle);
    setErreur(null);
    try {
      const r = await fetch(`/api/sandbox/synchro${location.search}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cle]: !inter[cle] }),
      });
      const j = (await r.json()) as { interrupteurs?: Interrupteurs; error?: string };
      if (!r.ok || !j.interrupteurs) throw new Error(j.error ?? `HTTP ${r.status}`);
      setInter(j.interrupteurs);
    } catch (e) {
      setErreur(String(e));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 flex items-center gap-3">
          <RefreshCw className="size-5 text-violet-300" />
          <h1 className="font-display text-[26px] font-bold tracking-tight">Synchronisation quotidienne</h1>
        </div>
        <p className="mb-1 max-w-3xl text-[13.5px] text-zinc-400">
          Un interrupteur par famille de mise à jour. Le feu vert ou rouge ne vient d’aucun journal de robot : il compare ce que la page porte réellement à ce que la société a réellement publié (dernier dépôt SEC, rafraîchi chaque jour depuis EDGAR).
        </p>
        <p className="mb-8 font-mono text-[11px] text-zinc-500">
          Calculé le {fmt(etat.calculeLe)} · univers {etat.univers} sociétés · dépôts SEC lus le {fmt(etat.fichiers.depotsSecMisAJour)} · transcripts modifiés le {fmt(etat.fichiers.transcriptsMisAJour)} · kpis-haut modifiés le {fmt(etat.fichiers.kpisHautMisAJour)}
        </p>
        {erreur && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-200">{erreur}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          {CATS.map(({ cle, titre, Icon, quoi, comment }) => {
            const c = etat.categories[cle];
            const total = c.aJour + c.enRetard + c.sansDonnee;
            const pct = total ? Math.round((c.aJour / total) * 100) : 0;
            const couleur = pct >= 95 ? "#34d399" : pct >= 80 ? "#fbbf24" : "#f87171";
            const on = inter[cle];
            return (
              <div key={cle} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300"><Icon className="size-4" /></span>
                    <div>
                      <div className="text-[14.5px] font-semibold text-zinc-50">{titre}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{on ? "mise à jour quotidienne active" : "mise à jour quotidienne arrêtée"}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => bascule(cle)}
                    disabled={enCours === cle}
                    aria-pressed={on}
                    className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? "border-emerald-400/60 bg-emerald-500/40" : "border-white/15 bg-white/10"} ${enCours === cle ? "opacity-50" : ""}`}
                    title={on ? "Cliquer pour arrêter cette mise à jour" : "Cliquer pour relancer cette mise à jour"}
                  >
                    <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="mt-3 text-[12.5px] leading-snug text-zinc-400">{quoi}</p>

                <div className="mt-4 flex items-end gap-3">
                  <div className="font-mono text-[34px] font-bold leading-none" style={{ color: couleur }}>{pct} %</div>
                  <div className="text-[12px] text-zinc-400">
                    <div><span className="text-emerald-300">{c.aJour}</span> à jour</div>
                    <div><span className="text-red-300">{c.enRetard}</span> en retard · <span className="text-amber-300">{c.sansDonnee}</span> sans donnée</div>
                    <div className="text-zinc-500">{c.horsSec} hors SEC (pas de référence)</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: couleur }} />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-zinc-500">{comment} Point le plus récent porté par une page : {fmt(c.pointLePlusRecent)}.</p>

                <button type="button" onClick={() => setOuvert(ouvert === cle ? null : cle)} className="mt-3 text-[12px] text-violet-300 hover:text-violet-200">
                  {ouvert === cle ? "Masquer" : "Voir"} les {c.retards.length} sociétés en retard ou sans donnée
                </button>
                {ouvert === cle && (
                  <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-white/[0.06]">
                    <table className="w-full text-[11.5px]">
                      <thead className="sticky top-0 bg-[#0a0a0c] text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        <tr><th className="px-2 py-1">Sté</th><th className="px-2 py-1">Page</th><th className="px-2 py-1">Réel (fin de période)</th><th className="px-2 py-1">Déposé</th><th className="px-2 py-1">Retard</th></tr>
                      </thead>
                      <tbody>
                        {c.retards.map((r) => (
                          <tr key={r.ticker} className="border-t border-white/[0.04]">
                            <td className="px-2 py-1 font-mono"><Link href={`/${r.ticker.toLowerCase()}`} className="text-violet-300 hover:underline">{r.ticker}</Link></td>
                            <td className="px-2 py-1 text-zinc-300">{fmt(r.page)}</td>
                            <td className="px-2 py-1 text-zinc-300">{fmt(r.reel)}</td>
                            <td className="px-2 py-1 text-zinc-400">{fmt(r.depose)}</td>
                            <td className="px-2 py-1 text-red-300">{r.joursRetard} j</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-[12px] text-zinc-400">
          <div className="mb-1 font-semibold text-zinc-200">Ce que font les interrupteurs</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Ils sont lus chaque nuit par la passe de 23 h du Mac (scripts/earnings-refresh.sh) avant chaque étape : transcripts et synthèses, extraction des KPI, stories.</li>
            <li>Un interrupteur arrêté ne touche pas aux données déjà en place : il empêche seulement les prochains ajouts.</li>
            <li>Les feux de cette page ne dépendent pas des interrupteurs : ils disent si la page est conforme à la réalité de la société, quoi qu’aient fait les robots.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
