"use client";

import { useEffect, useState } from "react";

import { ONGLETS, TITRES, type ToggleKpi } from "./onglets";

export function ReglagesKpiClient({ jeton, ongletInitial, toggle }: { jeton: string | null; ongletInitial: string; toggle: ToggleKpi }) {
  const onglets = ONGLETS.filter((o) => o.toggle === toggle);
  const groupes = Array.from(new Set(onglets.map((o) => o.groupe)));
  const [onglet, setOnglet] = useState(onglets.some((o) => o.id === ongletInitial) ? ongletInitial : onglets[0].id);
  const [vus, setVus] = useState<Set<string>>(new Set([onglet]));
  useEffect(() => {
    setVus((v) => new Set(v).add(onglet));
    const u = new URL(window.location.href);
    u.searchParams.set("onglet", onglet);
    window.history.replaceState(null, "", u.toString());
  }, [onglet]);
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";
  const autre: ToggleKpi = toggle === "voir" ? "creer" : "voir";
  const lienAutre = `/sandbox/${autre === "voir" ? "voir-kpi" : "reglages-kpi"}${q}`;
  return (
    <div className="flex h-screen flex-col bg-[#050505] text-zinc-100">
      <nav className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="mr-2 font-display text-[15px] font-bold">{TITRES[toggle]}</span>
        {groupes.map((g) => (
          <span key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{g}</span>
            {onglets.filter((o) => o.groupe === g).map((o) => (
              <button key={o.id} type="button" title={o.mots} onClick={() => setOnglet(o.id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${onglet === o.id ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"}`}>
                {o.label}
              </button>
            ))}
          </span>
        ))}
        <a href={lienAutre} className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[12px] text-zinc-400 hover:border-white/25 hover:text-zinc-200">
          → {TITRES[autre]}
        </a>
      </nav>
      {/* Chaque onglet est chargé à la première ouverture, puis conservé (les filtres et saisies ne se perdent pas). */}
      <div className="relative min-h-0 flex-1">
        {onglets.filter((o) => vus.has(o.id)).map((o) => (
          <iframe key={o.id} title={o.label} src={o.url + q} className={`absolute inset-0 h-full w-full border-0 ${onglet === o.id ? "" : "hidden"}`} />
        ))}
      </div>
    </div>
  );
}
