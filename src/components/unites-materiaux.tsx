"use client";

/**
 * Comprendre les unités du secteur Matériaux (Yann 07 sept 2026, point 3).
 *
 * Dépliable discret affiché UNIQUEMENT sur les fiches du secteur Matériaux,
 * sous le tableau des indicateurs clés. Contenu : le relevé du Cahier
 * (docs/cahier/unites-materiaux.md, exporté en src/data/unites-materiaux.json) :
 * acronyme, nom complet, signification, et un ordre de grandeur comparé à un
 * objet du quotidien.
 */

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import DATA from "@/data/unites-materiaux.json";

type Unite = {
  categorie: string;
  unite: string;
  variantes: string[];
  nom: string;
  signification: string;
  comparatif: string;
};

export function UnitesMateriaux({ secteur = "materiaux" }: { secteur?: "materiaux" | "energie" }) {
  const [ouvert, setOuvert] = useState(false);
  const groupes = useMemo(() => {
    const g = new Map<string, Unite[]>();
    for (const u of (DATA as { unites: (Unite & { secteurs?: string[] })[] }).unites) {
      if (u.categorie.startsWith("Valeurs non numériques")) continue;
      // 8 sept 2026 : une unite peut etre propre a un secteur (champ secteurs) ;
      // sans ce champ elle vaut pour les deux.
      if (u.secteurs && !u.secteurs.includes(secteur)) continue;
      const l = g.get(u.categorie) ?? [];
      l.push(u);
      g.set(u.categorie, l);
    }
    // 8 sept 2026 (demande du proprietaire) : unites exotiques du secteur en
    // premier (energie, masses, prix physiques, cadences, surfaces), puis les
    // ratios et comptages, et en dernier les unites connues de tous (durees,
    // monnaies).
    const ORDRE = [
      "Énergie : pétrole, gaz et électricité",
      "Masses et volumes de production",
      "Prix par quantité physique",
      "Rythmes et cadences",
      "Surfaces et distances",
      "Ratios, taux et scores",
      "Effectifs, sites et volumes de comptage",
      "Durées",
      "Monnaies et montants",
    ];
    const rang = (c: string) => { const i = ORDRE.indexOf(c); return i < 0 ? ORDRE.length - 2.5 : i; };
    return [...g.entries()].sort((a, b) => rang(a[0]) - rang(b[0]));
  }, [secteur]);

  return (
    <div data-blur="unites" className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.015]">
      <button
        data-blur-part="titre"
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
        <span className="text-[13.5px] font-semibold text-zinc-200">Comprendre les unités du secteur {secteur === "energie" ? "Énergie" : "Matériaux"}</span>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">
          {groupes.reduce((t, [, l]) => t + l.length, 0)} unités
        </span>
      </button>
      {ouvert && (
        <div data-blur-part="tableau" className="border-t border-white/[0.05] px-4 py-3">
          {groupes.map(([cat, unites]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-zinc-500">{cat}</div>
              <div className="grid gap-1.5">
                {unites.map((u) => (
                  <div key={u.unite} className="rounded-lg border border-white/[0.06] px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[12.5px] font-semibold text-violet-200">{u.unite}</span>
                      <span className="text-[13px] text-zinc-200">{u.nom}</span>
                      {u.variantes.length > 0 && (
                        <span className="font-mono text-[10.5px] text-zinc-600">aussi écrit {u.variantes.join(", ")}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{u.signification}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-cyan-200/80">{u.comparatif}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
