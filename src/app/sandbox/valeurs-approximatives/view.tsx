"use client";

import { useState } from "react";
import Link from "next/link";
import type { DecisionApprox } from "@/lib/valeurs-approx";

export type CasApprox = { id: string; ticker: string; short: string; avant: string; applique: string | null; affichage: string | null; type: "corrige" | "doute"; propositions: string[] };

export function ValeursApproxView({ cas, maj, regle, decisionsInitiales, jeton }: { cas: CasApprox[]; maj: string; regle: string; decisionsInitiales: Record<string, DecisionApprox>; jeton: string | null }) {
  const [dec, setDec] = useState(decisionsInitiales);
  const [autre, setAutre] = useState<Record<string, string>>({});
  const [statut, setStatut] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "doute" | "corrige">("doute");
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";
  async function enregistre(id: string, d: DecisionApprox | null) {
    setStatut(`${id} : enregistrement…`);
    const r = await fetch(`/api/sandbox/valeurs-approximatives${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision: d }) });
    if (r.ok) { setDec((v) => { const n = { ...v }; if (d) n[id] = d; else delete n[id]; return n; }); setStatut(`${id} : ${d ? "enregistré" : "annulé"}`); }
    else setStatut(`${id} : échec (${r.status})`);
  }
  const liste = cas.filter((c) => filtre === "tous" || c.type === filtre);
  const b = (c: CasApprox) => c.type === "doute" ? "border-amber-400/40" : "border-white/[0.08]";
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Valeurs approximatives</h1>
      <p className="mt-2 text-[13.5px] text-zinc-400">{regle} Mise à jour : {maj}. {cas.filter((c) => c.type === "corrige").length} corrections appliquées, {cas.filter((c) => c.type === "doute").length} cas à trancher. Pour chaque cas : accepter la proposition, ne rien faire, annuler la correction, ou indiquer autre chose. Claude applique les décisions à la passe suivante.</p>
      <div className="mt-3 flex gap-2 text-[12px]">
        {(["doute", "corrige", "tous"] as const).map((f) => <button key={f} onClick={() => setFiltre(f)} className={`rounded-md border px-2.5 py-1 ${filtre === f ? "border-violet-400/60 bg-violet-500/15" : "border-white/10"}`}>{f === "doute" ? "À trancher" : f === "corrige" ? "Corrigés" : "Tous"}</button>)}
      </div>
      {statut && <p className="mt-2 font-mono text-[12px] text-cyan-300">{statut}</p>}
      <div className="mt-4 grid gap-2">
        {liste.map((c) => {
          const d = dec[c.id];
          return (
            <section key={c.id} className={`rounded-lg border bg-white/[0.02] p-3 ${b(c)}`}>
              <div className="flex flex-wrap items-baseline gap-3 text-[12.5px]">
                <Link href={`/${c.ticker.toLowerCase()}${q}`} className="font-mono font-bold text-violet-200 hover:underline">{c.ticker}</Link>
                <span className="font-mono text-zinc-500">{c.short}</span>
                <span className="text-zinc-400">avant : <span className="text-zinc-200">{c.avant}</span></span>
                {c.affichage && <span className="text-zinc-400">affiché : <span className="text-emerald-300">{c.affichage}</span></span>}
                {d && <span className="ml-auto font-mono text-[11px] text-emerald-300">décision : {d.statut}{d.proposition ? ` (${d.proposition})` : ""}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                {c.type === "doute" ? c.propositions.map((p) => (
                  <button key={p} onClick={() => enregistre(c.id, { statut: "accepter", proposition: p })} className="rounded border border-emerald-400/40 px-2 py-1 hover:bg-emerald-500/10">{p}</button>
                )) : (
                  <button onClick={() => enregistre(c.id, { statut: "accepter", proposition: c.applique ?? "" })} className="rounded border border-emerald-400/40 px-2 py-1 hover:bg-emerald-500/10">Valider la correction</button>
                )}
                <button onClick={() => enregistre(c.id, { statut: "rien" })} className="rounded border border-white/15 px-2 py-1 hover:bg-white/5">Ne rien faire</button>
                <button onClick={() => enregistre(c.id, { statut: "annuler" })} className="rounded border border-rose-400/40 px-2 py-1 hover:bg-rose-500/10">Annuler la correction</button>
                <input value={autre[c.id] ?? ""} onChange={(e) => setAutre((v) => ({ ...v, [c.id]: e.target.value }))} placeholder="autre chose…" className="w-56 rounded border border-white/15 bg-black px-2 py-1" />
                <button onClick={() => enregistre(c.id, { statut: "autre", explication: autre[c.id] ?? "" })} className="rounded border border-amber-400/40 px-2 py-1 hover:bg-amber-500/10">Envoyer</button>
                {d && <button onClick={() => enregistre(c.id, null)} className="text-[11px] text-zinc-500 underline">effacer la décision</button>}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
