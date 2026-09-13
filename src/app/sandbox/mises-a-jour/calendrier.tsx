"use client";

import { useState } from "react";

type Entree = { ticker: string; nom: string; estimee: boolean };

/** Calendrier mensuel navigable (passé et futur) des publications de résultats. */
export function Calendrier({ parJour }: { parJour: Record<string, Entree[]> }) {
  const now = new Date();
  const [mois, setMois] = useState({ a: now.getFullYear(), m: now.getMonth() });
  const premier = new Date(mois.a, mois.m, 1);
  const decal = (premier.getDay() + 6) % 7;
  const nb = new Date(mois.a, mois.m + 1, 0).getDate();
  const cle = (j: number) => `${mois.a}-${String(mois.m + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
  const aujourdhui = now.toISOString().slice(0, 10);
  const total = Array.from({ length: nb }, (_, i) => parJour[cle(i + 1)]?.length ?? 0).reduce((x, y) => x + y, 0);
  return (
    <section className="mt-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setMois((v) => (v.m === 0 ? { a: v.a - 1, m: 11 } : { a: v.a, m: v.m - 1 }))} className="rounded-md border border-white/15 px-2 py-1 text-[12px] hover:bg-white/5">◀</button>
        <div className="text-[15px] font-semibold capitalize">{premier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
        <button onClick={() => setMois((v) => (v.m === 11 ? { a: v.a + 1, m: 0 } : { a: v.a, m: v.m + 1 }))} className="rounded-md border border-white/15 px-2 py-1 text-[12px] hover:bg-white/5">▶</button>
        <button onClick={() => setMois({ a: now.getFullYear(), m: now.getMonth() })} className="text-[11.5px] text-zinc-400 underline">aujourd hui</button>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">{total} publications ce mois · italique = date estimée</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-[11px]">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="px-1 font-mono text-[10px] uppercase text-zinc-500">{d}</div>)}
        {Array.from({ length: decal }).map((_, i) => <div key={"v" + i} />)}
        {Array.from({ length: nb }, (_, i) => {
          const k = cle(i + 1); const l = parJour[k] ?? [];
          return (
            <div key={k} className={`min-h-[72px] rounded-md border p-1 ${k === aujourdhui ? "border-violet-400/60 bg-violet-500/10" : "border-white/[0.07] bg-white/[0.015]"}`}>
              <div className="font-mono text-[10px] text-zinc-500">{i + 1}{l.length > 0 && <span className="ml-1 text-zinc-400">· {l.length}</span>}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-1 leading-tight">
                {l.slice(0, 14).map((e) => <a key={e.ticker} href={`/${e.ticker.toLowerCase()}`} title={e.nom} className={`text-zinc-200 hover:text-violet-200 ${e.estimee ? "italic text-zinc-400" : ""}`}>{e.ticker}</a>)}
                {l.length > 14 && <span className="text-zinc-500">+{l.length - 14}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
