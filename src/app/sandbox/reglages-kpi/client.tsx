"use client";

import { useEffect, useState } from "react";

const ONGLETS = [
  // Yann 17 sept 2026 : un seul toggle pour toute la creation de KPI, range par
  // horizon (long, moyen, court terme) puis controle.
  { id: "heros", groupe: "Long terme", label: "KPI héros", url: "/admin/kpis-toggle", mots: "choisir le KPI principal de chaque fiche, activer ou désactiver un KPI" },
  { id: "phare", groupe: "Long terme", label: "Produit phare", url: "/sandbox/produit-phare", mots: "trancher les exceptions produit phare, hero automatique" },
  { id: "industries", groupe: "Long terme", label: "KPI par industrie", url: "/sandbox/gics", mots: "classification GICS, KPI attendus par sous-industrie, qui a quoi" },
  { id: "secteurs", groupe: "Long terme", label: "KPI star par secteur", url: "/sandbox/kpi-secteurs", mots: "métrique reine par secteur (NIM, ratio combiné, FFO, production…), sociétés avec ou sans" },
  { id: "speciaux", groupe: "Long terme", label: "KPI spéciaux", url: "/sandbox/special-kpis", mots: "recherche hors documents, KPI sur mesure" },
  { id: "constructeur", groupe: "Long terme", label: "Constructeur de KPI", url: "/sandbox/kpi-builder", mots: "créer un KPI à partir d'une demande" },
  { id: "accueil", groupe: "Long terme", label: "KPI de l’accueil", url: "/sandbox/accueil-kpis", mots: "les 3 KPI affichés sur la page d'accueil" },
  { id: "approx", groupe: "Long terme", label: "Valeurs approximatives", url: "/sandbox/valeurs-approximatives", mots: "valeurs estimées signalées, à confirmer" },
  { id: "definitions", groupe: "Long terme", label: "Définitions et unités", url: "/sandbox/kpi-definitions", mots: "référentiel, unités métiers, infobulles" },
  { id: "moyen-terme", groupe: "Moyen terme", label: "Indicateurs variés - Moyen terme", url: "/sandbox/image-findings", mots: "graphiques reconstruits, demandes à lancer, approuver ou retirer" },
  { id: "court-terme", groupe: "Court terme", label: "Faits marquants - Court terme", url: "/sandbox/story-builder", mots: "stories du dernier trimestre depuis un lien" },
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
        {["Long terme", "Moyen terme", "Court terme"].map((g) => (
          <span key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{g}</span>
            {ONGLETS.filter((o) => o.groupe === g).map((o) => (
              <button key={o.id} type="button" title={o.mots} onClick={() => setOnglet(o.id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${onglet === o.id ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
                {o.label}
              </button>
            ))}
          </span>
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
