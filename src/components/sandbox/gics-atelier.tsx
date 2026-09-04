"use client";

/**
 * Atelier GICS (/sandbox/gics), Yann 5 sept 2026.
 *
 * Trois onglets :
 *  1. Classification : l arbre des 4 niveaux (secteur, groupe d industries,
 *     industrie, sous-industrie) avec noms et codes.
 *  2. KPI par sous-industrie : les KPI souhaites / necessaires pour un
 *     investisseur, lus dans docs/cahier/kpi/<code>.json.
 *  3. Prompts : le registre docs/cahier/PROMPTS.md, lisible d un coup d oeil.
 *
 * Le contenu vient du Cahier (dossier docs/cahier du depot), partage par
 * toutes les sessions Claude ; cette page ne fait que l afficher.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { GICS } from "@/lib/desk/gics";
import { ArbreGics } from "@/components/desk/arbre-gics";
import type { KpiParSousIndustrie, PromptCahier } from "@/lib/cahier";

type Onglet = "arbre" | "kpi" | "prompts";

const STATUT_CLASSE: Record<string, string> = {
  brouillon: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  pret: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  en_cours: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  fait: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  a_verifier: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  verifie: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
};

function Statut({ valeur }: { valeur?: string }) {
  const v = (valeur || "brouillon").toLowerCase();
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STATUT_CLASSE[v] ?? STATUT_CLASSE.brouillon}`}>
      {v.replace("_", " ")}
    </span>
  );
}

export function GicsAtelier({
  kpiParSousIndustrie,
  prompts,
}: {
  kpiParSousIndustrie: Record<string, KpiParSousIndustrie>;
  prompts: PromptCahier[];
}) {
  const [onglet, setOnglet] = useState<Onglet>("arbre");

  const nbSous = useMemo(
    () => GICS.reduce((t, s) => t + s.groups.reduce((u, g) => u + g.industries.reduce((v, i) => v + i.subs.length, 0), 0), 0),
    [],
  );
  const nbDocumentees = Object.values(kpiParSousIndustrie).filter((k) => k.kpis.length > 0).length;

  const onglets: { id: Onglet; label: string; compte: string }[] = [
    { id: "arbre", label: "Classification", compte: `${nbSous} sous-industries` },
    { id: "kpi", label: "KPI par sous-industrie", compte: `${nbDocumentees} / ${nbSous} documentées` },
    { id: "prompts", label: "Prompts", compte: `${prompts.length}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {onglets.map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`rounded-xl border px-4 py-2 text-left transition-colors ${
              onglet === o.id
                ? "border-violet-400/60 bg-violet-500/15 text-violet-50"
                : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
            }`}
          >
            <div className="text-[14px] font-semibold">{o.label}</div>
            <div className="font-mono text-[11px] text-zinc-500">{o.compte}</div>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {onglet === "arbre" && <ArbreGics />}
        {onglet === "kpi" && <OngletKpi kpiParSousIndustrie={kpiParSousIndustrie} />}
        {onglet === "prompts" && <OngletPrompts prompts={prompts} />}
      </div>
    </div>
  );
}

/* ───────────── KPI par sous-industrie ───────────── */

function OngletKpi({ kpiParSousIndustrie }: { kpiParSousIndustrie: Record<string, KpiParSousIndustrie> }) {
  const [filtre, setFiltre] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const lignes = useMemo(() => {
    const out: { code: string; nom: string; secteur: string; industrie: string }[] = [];
    for (const s of GICS) for (const g of s.groups) for (const i of g.industries) for (const sub of i.subs) {
      out.push({ code: sub.code, nom: sub.name, secteur: s.name, industrie: i.name });
    }
    const q = filtre.trim().toLowerCase();
    return q ? out.filter((l) => `${l.code} ${l.nom} ${l.secteur} ${l.industrie}`.toLowerCase().includes(q)) : out;
  }, [filtre]);

  const actif = code ? kpiParSousIndustrie[code] : null;
  const ligneActive = lignes.find((l) => l.code === code) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer : code, nom, secteur…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        <ul className="mt-3 max-h-[70vh] divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/10 bg-white/[0.02]">
          {lignes.map((l) => {
            const doc = kpiParSousIndustrie[l.code];
            const n = doc?.kpis.length ?? 0;
            return (
              <li key={l.code}>
                <button
                  onClick={() => setCode(l.code)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    code === l.code ? "bg-violet-500/15" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="font-mono text-[12px] text-violet-300/80">{l.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-200">{l.nom}</span>
                  <span className={`font-mono text-[11px] ${n > 0 ? "text-emerald-300" : "text-zinc-600"}`}>{n > 0 ? `${n} KPI` : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        {!ligneActive ? (
          <p className="text-[14px] text-zinc-400">Choisis une sous-industrie à gauche.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[13px] text-violet-300">{ligneActive.code}</span>
              <h2 className="text-[20px] font-semibold text-zinc-50">{ligneActive.nom}</h2>
              <Statut valeur={actif?.statut} />
            </div>
            <p className="mt-1 text-[12.5px] text-zinc-500">
              {ligneActive.secteur} · {ligneActive.industrie}
            </p>

            {!actif || actif.kpis.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-[13.5px] text-zinc-400">
                Aucun KPI écrit pour cette sous-industrie.
                <div className="mt-2 font-mono text-[12px] text-zinc-500">
                  À produire : <span className="text-zinc-300">docs/cahier/kpi/{ligneActive.code}.json</span> (prompt « kpi-sous-industrie », onglet Prompts).
                </div>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="pb-2 text-left">KPI</th>
                      <th className="pb-2 text-left">Définition</th>
                      <th className="pb-2 text-left">Unité · fréquence</th>
                      <th className="pb-2 text-left">Source</th>
                      <th className="pb-2 text-left">Exemples</th>
                      <th className="pb-2 text-left">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {actif.kpis.map((k) => (
                      <tr key={k.short} className="border-t border-white/[0.06] align-top">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            {k.wow && <span className="rounded bg-violet-500/20 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-violet-200">wow</span>}
                            <span className="font-semibold text-zinc-100">{k.nom_fr}</span>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-500">{k.short}{k.nom_en ? ` · ${k.nom_en}` : ""}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-400">{k.definition ?? "—"}</td>
                        <td className="py-2.5 pr-3 font-mono text-[12px]">{k.unite ?? "—"}{k.frequence ? ` · ${k.frequence}` : ""}</td>
                        <td className="py-2.5 pr-3 text-zinc-400">{k.source_habituelle ?? "—"}</td>
                        <td className="py-2.5 pr-3 font-mono text-[12px] text-zinc-400">{(k.exemples_societes ?? []).join(", ") || "—"}</td>
                        <td className="py-2.5"><Statut valeur={k.statut} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────── Prompts ───────────── */

function OngletPrompts({ prompts }: { prompts: PromptCahier[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const categories = useMemo(() => {
    const m = new Map<string, PromptCahier[]>();
    for (const p of prompts) {
      const c = p.categorie || "Sans catégorie";
      m.set(c, [...(m.get(c) ?? []), p]);
    }
    return [...m.entries()];
  }, [prompts]);

  if (prompts.length === 0) {
    return <p className="text-[14px] text-zinc-400">Aucun prompt dans docs/cahier/PROMPTS.md.</p>;
  }

  return (
    <div className="space-y-8">
      {categories.map(([cat, liste]) => (
        <section key={cat}>
          <h2 className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {cat}
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="font-mono text-[11px]">{liste.length}</span>
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {liste.map((p) => {
              const estOuvert = ouvert === p.id;
              return (
                <article key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11.5px] text-violet-300">{p.id}</span>
                    <Statut valeur={p.statut} />
                  </div>
                  <h3 className="mt-1.5 text-[16px] font-semibold text-zinc-50">{p.titre}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{p.objectif}</p>
                  <dl className="mt-3 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[12.5px]">
                    <dt className="text-zinc-500">Entrée</dt><dd className="text-zinc-300">{p.entree || "—"}</dd>
                    <dt className="text-zinc-500">Sortie</dt><dd className="font-mono text-[12px] text-zinc-300">{p.sortie || "—"}</dd>
                  </dl>
                  {p.prompt && (
                    <>
                      <button
                        onClick={() => setOuvert(estOuvert ? null : p.id)}
                        className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-violet-300 hover:text-violet-200"
                      >
                        {estOuvert ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        {estOuvert ? "Masquer le prompt" : "Voir le prompt"}
                      </button>
                      {estOuvert && (
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-zinc-300">
                          {p.prompt}
                        </pre>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
