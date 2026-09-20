"use client";

import { useEffect, useState } from "react";

import { ONGLETS, TITRES, type ToggleKpi } from "./onglets";

export function ReglagesKpiClient({ jeton, ongletInitial, toggle }: { jeton: string | null; ongletInitial: string; toggle: ToggleKpi }) {
  const onglets = ONGLETS.filter((o) => o.toggle === toggle);
  const groupes = Array.from(new Set(onglets.map((o) => o.groupe)));
  const [onglet, setOnglet] = useState(onglets.some((o) => o.id === ongletInitial) ? ongletInitial : onglets[0].id);
  const [vus, setVus] = useState<Set<string>>(new Set([onglet]));
  // Yann 20 sept 2026 : une page lourde (Indicateurs variés) met plusieurs
  // secondes a repondre ; le cadre restait blanc pendant ce temps. On garde la
  // trace des cadres reellement charges pour afficher un voile sombre a la place.
  const [charges, setCharges] = useState<Set<string>>(new Set());
  useEffect(() => {
    setVus((v) => new Set(v).add(onglet));
    const u = new URL(window.location.href);
    u.searchParams.set("onglet", onglet);
    window.history.replaceState(null, "", u.toString());
  }, [onglet]);
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";
  const autre: ToggleKpi = toggle === "voir" ? "creer" : "voir";
  const lienAutre = `/sandbox/${autre === "voir" ? "voir-kpi" : "reglages-kpi"}${q}`;
  // Yann 20 sept 2026 : coquille calee sur la fenetre. « h-screen » valait 110 %
  // de la hauteur visible a cause du zoom global (body { zoom: 1.1 }) : la page
  // etait plus grande que l ecran et la barre d onglets partait au defilement.
  // « fixed inset-0 » donne exactement la fenetre, a condition qu aucun zoom ne
  // soit applique au-dessus : la classe « coquille-onglets » retire le zoom du
  // site sur cette page hote (regle dans globals.css), sinon la coquille etait
  // calculee sur la fenetre entiere puis agrandie de 10 %, d ou le defilement
  // horizontal et le contenu coupe. Le zoom du site est rendu aux pages
  // affichees dans les cadres par le parametre « cadre=plein ».
  return (
    <div className="coquille-onglets fixed inset-0 flex w-full min-w-0 max-w-full flex-col overflow-hidden bg-[#050505] text-zinc-100">
      <nav className="flex w-full min-w-0 max-w-full shrink-0 flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="mr-2 font-display text-[15px] font-bold">{TITRES[toggle]}</span>
        {groupes.map((g) => (
          <span key={g} className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
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
      <div className="relative min-h-0 w-full min-w-0 max-w-full flex-1">
        {onglets.filter((o) => vus.has(o.id)).map((o) => (
          <iframe
            key={o.id}
            title={o.label}
            src={`${o.url}${q ? `${q}&` : "?"}cadre=plein`}
            onLoad={() => setCharges((c) => new Set(c).add(o.id))}
            className={`absolute inset-0 h-full w-full border-0 bg-[#050505] ${onglet === o.id ? "" : "hidden"}`}
          />
        ))}
        {!charges.has(onglet) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#050505]">
            <span className="flex items-center gap-2 text-[13px] text-zinc-400">
              <span className="size-3.5 animate-spin rounded-full border-2 border-violet-400/40 border-t-violet-300" />
              Chargement de {onglets.find((o) => o.id === onglet)?.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
