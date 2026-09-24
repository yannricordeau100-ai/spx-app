"use client";

/**
 * Onglet « Grandes tâches » du desk (24 sept 2026) : chantiers commencés et
 * restant à finir, avec ETA, modèle et réglages, puis l état société par
 * société de la mission des conférences de résultats. Données générées par
 * scripts/desk-taches-etat.py (src/data/desk-taches.json).
 */

import { useState } from "react";
import DATA from "@/data/desk-taches.json";

type Ste = { t: string; nom?: string; raison?: string };
type Disparue = { ticker: string; nom?: string; statut: string; detail?: string; source_url?: string };

const GROUPES = [
  { cle: "completes", titre: "Complètement faites", couleur: "border-emerald-400/30 bg-emerald-500/[0.05] text-emerald-200" },
  { cle: "partielles", titre: "Partiellement faites", couleur: "border-amber-400/30 bg-amber-500/[0.05] text-amber-200" },
  { cle: "aucune", titre: "Pas du tout faites", couleur: "border-rose-400/30 bg-rose-500/[0.05] text-rose-200" },
] as const;

export function TabTaches() {
  const [filtre, setFiltre] = useState("");
  const q = filtre.trim().toLowerCase();
  const soc = DATA.societes as Record<string, Ste[]>;
  const disparues = (DATA.disparues ?? []) as Disparue[];

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] text-zinc-500">
        État au {DATA.maj} · {DATA.total} sociétés dans l univers
      </p>

      <div className="space-y-2">
        {DATA.taches.map((t) => (
          <details key={t.titre} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-[14px] font-semibold text-zinc-100">
              {t.titre}
              <span className="ml-2 font-mono text-[11px] font-normal text-violet-300">ETA {t.eta}</span>
            </summary>
            <dl className="mt-2 grid gap-1.5 text-[12.5px] sm:grid-cols-[110px_1fr]">
              <dt className="text-zinc-500">État</dt><dd className="text-zinc-200">{t.etat}</dd>
              <dt className="text-zinc-500">Modèle</dt><dd className="text-zinc-200">{t.modele}</dd>
              <dt className="text-zinc-500">Réglages</dt><dd className="text-zinc-300">{t.reglages}</dd>
              {"commande" in t && t.commande && (
                <><dt className="text-zinc-500">Commande</dt><dd className="font-mono text-[11.5px] text-zinc-300">{t.commande}</dd></>
              )}
            </dl>
          </details>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-zinc-100">Conférences de résultats : état par société</h2>
        <input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer (ticker ou nom)…"
          className="mb-2 w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        <div className="space-y-2">
          {GROUPES.map((g) => {
            const liste = (soc[g.cle] ?? []).filter(
              (s) => !q || s.t.toLowerCase().includes(q) || (s.nom ?? "").toLowerCase().includes(q),
            );
            return (
              <details key={g.cle} className={`rounded-xl border p-3 ${g.couleur}`}>
                <summary className="cursor-pointer text-[13.5px] font-semibold">
                  {g.titre} <span className="font-mono text-[12px]">({soc[g.cle]?.length ?? 0})</span>
                </summary>
                <ul className="mt-2 grid gap-x-3 gap-y-0.5 text-[12px] text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
                  {liste.map((s) => (
                    <li key={s.t} title={s.raison}>
                      <span className="font-mono text-zinc-100">{s.t}</span> {s.nom}
                      {s.raison && g.cle !== "completes" && !s.raison.startsWith("4 conf") && (
                        <span className="text-zinc-500"> · {s.raison}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Complète = 4 conférences, KPI extraits et vérifiés mot pour mot, suivi calculé. Partielle = conférences collectées, extraction en attente ou moins de 4 conférences.
        </p>
      </div>

      {disparues.length > 0 && (
        <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-zinc-100">
            Sociétés disparues ou en cours de rachat ({disparues.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-300">
            {disparues.map((d) => (
              <li key={d.ticker}>
                <span className="font-mono text-zinc-100">{d.ticker}</span> {d.nom} · <span className="text-amber-200">{d.statut}</span>
                {d.detail ? ` · ${d.detail}` : ""}
                {d.source_url && (
                  <a href={d.source_url} target="_blank" rel="noreferrer" className="ml-1 text-violet-300 underline">source</a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
