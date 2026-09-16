"use client";

import { useEffect, useState } from "react";

const ONGLETS = [
  { id: "heros", label: "KPI héros", url: "/admin/kpis-toggle" },
  { id: "phare", label: "Produit phare", url: "/sandbox/produit-phare" },
  { id: "industries", label: "KPI par industrie", url: "/sandbox/gics" },
  { id: "accueil", label: "KPI de l’accueil", url: "/sandbox/accueil-kpis" },
  { id: "approx", label: "Valeurs approximatives", url: "/sandbox/valeurs-approximatives" },
  { id: "speciaux", label: "KPI spéciaux", url: "/sandbox/special-kpis" },
  { id: "definitions", label: "Définitions et unités", url: "/sandbox/kpi-definitions" },
  // Yann 16 sept 2026 : un seul toggle pour toute la creation de KPI et de
  // donnees des pages societe, un onglet par type.
  { id: "moyen-terme", label: "Indicateurs variés - Moyen terme", url: "/sandbox/image-findings" },
  { id: "court-terme", label: "Faits marquants - Court terme", url: "/sandbox/story-builder" },
  { id: "constructeur", label: "Constructeur de KPI", url: "/sandbox/kpi-builder" },
];

export function ReglagesKpiClient({ jeton, ongletInitial }: { jeton: string | null; ongletInitial: string }) {
  const [onglet, setOnglet] = useState(ONGLETS.some((o) => o.id === ongletInitial) ? ongletInitial : "heros");
  const [vus, setVus] = useState<Set<string>>(new Set([onglet]));
  useEffect(() => {
    setVus((v) => new Set(v).add(onglet));
    const u = new URL(window.location.href);
    u.searchParams.set("onglet", onglet);
    window.history.replaceState(null, "", u.toString());
  }, [onglet]);
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";
  return (
    <div className="flex h-screen flex-col bg-[#050505] text-zinc-100">
      <nav className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="mr-2 font-display text-[15px] font-bold">Création KPI et données</span>
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" onClick={() => setOnglet(o.id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${onglet === o.id ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
            {o.label}
          </button>
        ))}
      </nav>
      {/* Chaque onglet est chargé à la première ouverture, puis conservé (les filtres et saisies ne se perdent pas). */}
      <div className="relative min-h-0 flex-1">
        {ONGLETS.filter((o) => vus.has(o.id)).map((o) => (
          <iframe key={o.id} title={o.label} src={o.url + q} className={`absolute inset-0 h-full w-full border-0 ${onglet === o.id ? "" : "hidden"}`} />
        ))}
      </div>
    </div>
  );
}
