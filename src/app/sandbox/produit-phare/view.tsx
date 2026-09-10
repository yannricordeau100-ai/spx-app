"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChoixPhare, EntreePhare } from "@/lib/produit-phare";

type Ligne = { ticker: string } & EntreePhare;

export function ProduitPhareView({
  exceptions,
  choixInitial,
  total,
  jeton,
}: {
  exceptions: Ligne[];
  choixInitial: Record<string, ChoixPhare>;
  total: number;
  jeton: string | null;
}) {
  const [choix, setChoix] = useState<Record<string, ChoixPhare>>(choixInitial);
  const [statut, setStatut] = useState<string>("");
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";

  async function coche(ticker: string, c: ChoixPhare) {
    setChoix((v) => ({ ...v, [ticker]: c }));
    setStatut(`${ticker} : enregistrement…`);
    try {
      const r = await fetch(`/api/sandbox/produit-phare${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker, choix: c }) });
      const j = (await r.json()) as { ok?: boolean; hero?: string | null; error?: string };
      setStatut(r.ok ? `${ticker} : ${c === "aucun" ? "pas de KPI produit phare, hero précédent rétabli" : `hero = ${j.hero ?? "?"}`}` : `${ticker} : échec (${j.error ?? r.status})`);
    } catch (e) {
      setStatut(`${ticker} : échec (${String(e)})`);
    }
  }

  const faits = exceptions.filter((e) => choix[e.ticker]).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Produit phare : exceptions à trancher</h1>
      <p className="mt-2 text-[13.5px] text-zinc-400">
        {total} sociétés traitées (Industrie, Consommation discrétionnaire, Consommation de base). Seules les {exceptions.length} exceptions apparaissent ici : hésitation entre deux produits, ou aucun produit phare identifiable. Coche A, B ou « pas de KPI » : le hero de la fiche change immédiatement. {faits} / {exceptions.length} tranchées.
      </p>
      {statut && <p className="mt-2 font-mono text-[12px] text-cyan-300">{statut}</p>}
      <div className="mt-6 grid gap-3">
        {exceptions.map((e) => {
          const c = choix[e.ticker];
          const det = e.exception_detail;
          return (
            <section key={e.ticker} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <Link href={`/${e.ticker.toLowerCase()}${q}`} className="font-mono text-[14px] font-bold text-violet-200 hover:underline">{e.ticker}</Link>
                <span className="text-[13.5px] text-zinc-200">{e.nom}</span>
                <span className={`rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-wider ${e.exception === "sans_produit" ? "border-amber-400/40 text-amber-200" : "border-cyan-400/40 text-cyan-200"}`}>
                  {e.exception === "sans_produit" ? "aucun produit phare trouvé" : "hésitation entre deux produits"}
                </span>
                {c && <span className="ml-auto font-mono text-[11px] text-emerald-300">choix : {c === "aucun" ? "pas de KPI" : c}</span>}
              </div>
              {det?.raison && <p className="mt-1.5 text-[12px] text-zinc-400">{det.raison}</p>}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {(["A", "B"] as const).map((k) => {
                  const cand = k === "A" ? e.candidat_A : e.candidat_B;
                  const nomProduit = cand?.produit ?? (k === "A" ? det?.A?.produit : det?.B?.produit) ?? null;
                  if (!nomProduit) return <div key={k} className="rounded-lg border border-dashed border-white/10 p-3 text-[12px] text-zinc-600">{k} : aucun candidat</div>;
                  const dispo = !!cand;
                  return (
                    <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${c === k ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 hover:border-white/25"} ${dispo ? "" : "opacity-60"}`}>
                      <input type="radio" name={e.ticker} checked={c === k} disabled={!dispo} onChange={() => coche(e.ticker, k)} className="mt-1" />
                      <span>
                        <span className="font-mono text-[10.5px] text-zinc-500">{k}</span>
                        <span className="block text-[13px] text-zinc-100">{nomProduit}</span>
                        {cand ? (
                          <span className="block font-mono text-[10.5px] text-zinc-500">{cand.short} · {cand.points} exercices{cand.statut === "court" ? " (série courte)" : ""}</span>
                        ) : (
                          <span className="block font-mono text-[10.5px] text-amber-300">série de données pas encore disponible</span>
                        )}
                      </span>
                    </label>
                  );
                })}
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${c === "aucun" ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 hover:border-white/25"}`}>
                  <input type="radio" name={e.ticker} checked={c === "aucun"} onChange={() => coche(e.ticker, "aucun")} className="mt-1" />
                  <span>
                    <span className="font-mono text-[10.5px] text-zinc-500">pas de KPI</span>
                    <span className="block text-[13px] text-zinc-100">Pas de produit phare : garder le hero actuel{e.hero_precedent ? ` (${e.hero_precedent})` : ""}</span>
                  </span>
                </label>
              </div>
            </section>
          );
        })}
        {exceptions.length === 0 && <p className="text-[13px] text-zinc-500">Aucune exception : toutes les sociétés ont un produit phare tranché.</p>}
      </div>
    </main>
  );
}
