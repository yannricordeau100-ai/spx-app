"use client";

import { useEffect, useState } from "react";

export type ToggleKpi = "voir" | "creer";

// Yann 17 sept 2026 (soir) : deux toggles distincts. « Voir les KPI » regroupe les
// vues et tris (par société, par industrie, par secteur, définitions) ; « Création
// KPI et données » regroupe les outils qui cherchent de la donnée (directement ou
// indirectement) pour en faire un KPI. Les onglets vides (valeurs approximatives)
// ont été retirés.
export const ONGLETS: { id: string; toggle: ToggleKpi; groupe: string; label: string; url: string; mots: string }[] = [
  { id: "heros", toggle: "voir", groupe: "Par société", label: "KPI héros par société", url: "/admin/kpis-toggle", mots: "tous les KPI d'une fiche, choisir le KPI principal, activer ou désactiver" },
  { id: "phare", toggle: "voir", groupe: "Par société", label: "Produit phare", url: "/sandbox/produit-phare", mots: "exceptions produit phare à trancher, A / B / aucun" },
  { id: "accueil", toggle: "voir", groupe: "Par société", label: "KPI de l’accueil", url: "/sandbox/accueil-kpis", mots: "les 3 KPI affichés sur la page d'accueil" },
  { id: "industries", toggle: "voir", groupe: "Par industrie", label: "KPI par industrie", url: "/sandbox/gics", mots: "classification GICS, KPI attendus par sous-industrie, qui a quoi" },
  { id: "secteurs", toggle: "voir", groupe: "Par secteur", label: "KPI star par secteur", url: "/sandbox/kpi-secteurs", mots: "métrique reine par secteur (NIM, ratio combiné, FFO, production…), sociétés avec ou sans" },
  { id: "definitions", toggle: "voir", groupe: "Référentiel", label: "Définitions et unités", url: "/sandbox/kpi-definitions", mots: "référentiel, unités métiers, infobulles" },
  { id: "constructeur", toggle: "creer", groupe: "Long terme", label: "Constructeur de KPI", url: "/sandbox/kpi-builder", mots: "créer un KPI multi-sociétés à partir d'une demande, extraction 10-K / 10-Q" },
  { id: "speciaux", toggle: "creer", groupe: "Long terme", label: "KPI spéciaux", url: "/sandbox/special-kpis", mots: "recherche manuelle hors documents (unités vendues, abonnés, livraisons)" },
  { id: "moyen-terme", toggle: "creer", groupe: "Moyen terme", label: "Indicateurs variés - Moyen terme", url: "/sandbox/image-findings", mots: "graphiques reconstruits depuis une demande, approuver ou retirer" },
  { id: "court-terme", toggle: "creer", groupe: "Court terme", label: "Faits marquants - Court terme", url: "/sandbox/story-builder", mots: "stories du dernier trimestre depuis un lien" },
];

export const TITRES: Record<ToggleKpi, string> = { voir: "Voir les KPI", creer: "Création KPI et données" };

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
