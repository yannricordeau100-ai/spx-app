"use client";

import { useState } from "react";
import Link from "next/link";
import type { Decision } from "@/lib/unites-source";

export type Cas = {
  id: string; ticker: string; short: string; nom: string; unite_affichee: string; periodicite: string; periode: string;
  exemple_brut: string; valeur_attendue: string; cause: string; couche: string; correction_proposee: string; resolvable: string;
};

// Prompt à recoller le dimanche 13 sept 2026 à partir de 11:00 (quota renouvelé).
const PROMPT = `Reprise « unités mal annotées + Comparer » (état : .conv-state/comparer.md). Dans l ordre, Opus en exécutant et Sonnet en vérificateur, sans dépasser la limite de quota (arrêt propre sinon) :
1) Passe IA d annotation : ranger les ~16 000 libellés KPI distincts (39 909 KPI servis) dans un catalogue canonique de comparabilité (même mesure, même périmètre), vérifié par Sonnet ; brancher le catalogue dans src/lib/compare-keys.ts puis régénérer src/data/compare-index.json (scripts/build-compare-index.ts par tranches + build-compare-index-merge.ts).
2) Détecteur d unités sur TOUS les KPI servis et toute leur histoire (pas seulement la dernière valeur) : écart d échelle entre sociétés d une même clé, ruptures d un facteur 1 000 dans une série, unité contre 10-K/10-Q du data-lake.
3) Corrections automatiques des cas résolvables avec preuve (10-K fait foi, trois valeurs sondées contre la source avant écriture), version-bump, déploiement niveau2.
4) Remplir src/data/unites-a-corriger.json avec les SEULS cas restants qu Opus et Sonnet n ont pas pu résoudre (pas les KPI propres à une société comme le CA iPhone) : KPI, couche fautive, cause, période, exemple brut, valeur attendue, sources consultées. Appliquer ensuite les décisions déjà prises sur /sandbox/unites-source (desk_page_content unites_source/decisions).
5) Types de KPI (définitions sur /sandbox/kpi-definitions) : classer chaque KPI IC (standard + avancés) en type comparable ou KPI unique avec la règle du concurrent ; généraliser les KPI uniques dont l actif sous-jacent est comparable (ex : part de marché de Chrome -> part de marché des navigateurs web) ; poser le type dans un champ invisible, l afficher dans le « i » et le brancher dans le Comparer (remplace la clé par libellé du point 1). Compter KPI total, KPI IC total et KPI (global et par société). Travail minutieux, Opus puis Sonnet vérificateur, échantillon relu.
6) Tableau récapitulatif avec liens, TERMINE.`;

export function UnitesSourceView({ cas, maj, etat, decisionsInitiales, jeton }: { cas: Cas[]; maj: string; etat: string; decisionsInitiales: Record<string, Decision>; jeton: string | null }) {
  const [dec, setDec] = useState<Record<string, Decision>>(decisionsInitiales);
  const [brouillon, setBrouillon] = useState<Record<string, { facteur: string; unite: string; explication: string }>>({});
  const [statut, setStatut] = useState("");
  const [copie, setCopie] = useState(false);
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";

  async function enregistre(id: string, d: Decision | null) {
    setStatut(`${id} : enregistrement…`);
    const r = await fetch(`/api/sandbox/unites-source${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision: d }) });
    if (r.ok) {
      setDec((v) => { const n = { ...v }; if (d) n[id] = d; else delete n[id]; return n; });
      setStatut(`${id} : ${d ? "enregistré" : "décision annulée"}`);
    } else setStatut(`${id} : échec (${r.status})`);
  }

  const b = (id: string) => brouillon[id] ?? { facteur: "", unite: "", explication: "" };
  const maj1 = (id: string, champ: "facteur" | "unite" | "explication", v: string) => setBrouillon((x) => ({ ...x, [id]: { ...b(id), [champ]: v } }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <section className="rounded-xl border border-violet-400/30 bg-violet-500/[0.06] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-violet-200">Prompt à recoller dimanche 13 sept à partir de 11:00</h2>
          <button onClick={() => { navigator.clipboard.writeText(PROMPT); setCopie(true); }} className="rounded-md border border-violet-300/40 px-2.5 py-1 text-[12px] text-violet-100 hover:bg-violet-500/20">{copie ? "Copié" : "Copier"}</button>
        </div>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-zinc-300">{PROMPT}</pre>
      </section>

      <h1 className="mt-6 font-display text-[26px] font-bold">Unités mal annotées à la source</h1>
      <p className="mt-2 text-[13.5px] text-zinc-400">
        Un KPI est « mal annoté » quand ses valeurs ne sont pas dans l unité affichée (ex : des milliers de dollars stockés sous « Mds $ »). Conséquence : fiche et Comparer faux ou bloqués par le garde-fou d échelle. Pour chaque cas : corrige (facteur et unité), ou indique que tu ne peux pas résoudre en l état (dis ce qui manque), ou que ce n est pas résolvable. Les corrections sont appliquées par Claude à la passe suivante, jamais sans preuve. Mise à jour : {maj}. {etat}
      </p>
      {statut && <p className="mt-2 font-mono text-[12px] text-cyan-300">{statut}</p>}

      <div className="mt-5 grid gap-3">
        {cas.map((c) => {
          const d = dec[c.id];
          return (
            <section key={c.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <Link href={`/${c.ticker.toLowerCase()}${q}`} className="font-mono text-[14px] font-bold text-violet-200 hover:underline">{c.ticker}</Link>
                <span className="text-[13.5px] text-zinc-100">{c.nom}</span>
                <span className="font-mono text-[11px] text-zinc-500">{c.short} · {c.periodicite}</span>
                {d && <span className="ml-auto rounded-full border border-emerald-400/40 px-2 py-px font-mono text-[10.5px] text-emerald-300">{d.statut === "corriger" ? `à corriger : ${d.facteur || "?"}${d.unite ? ` → ${d.unite}` : ""}` : d.statut === "bloque" ? "bloqué en l état" : "non résolvable"}</span>}
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12.5px] md:grid-cols-2">
                <div><dt className="inline text-zinc-500">Unité affichée : </dt><dd className="inline">{c.unite_affichee}</dd></div>
                <div><dt className="inline text-zinc-500">Période concernée : </dt><dd className="inline">{c.periode}</dd></div>
                <div><dt className="inline text-zinc-500">Valeur stockée : </dt><dd className="inline font-mono">{c.exemple_brut}</dd></div>
                <div><dt className="inline text-zinc-500">Valeur attendue : </dt><dd className="inline font-mono">{c.valeur_attendue}</dd></div>
                <div className="md:col-span-2"><dt className="inline text-zinc-500">D où vient le problème : </dt><dd className="inline">{c.cause}</dd></div>
                <div className="md:col-span-2"><dt className="inline text-zinc-500">Fichier fautif : </dt><dd className="inline font-mono text-[11.5px]">{c.couche}</dd></div>
                <div className="md:col-span-2"><dt className="inline text-zinc-500">Correction proposée : </dt><dd className="inline text-amber-200">{c.correction_proposee}</dd></div>
              </dl>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="text-[12px] font-semibold text-zinc-200">Corriger</div>
                  <select value={b(c.id).facteur} onChange={(e) => maj1(c.id, "facteur", e.target.value)} className="mt-2 w-full rounded border border-white/15 bg-black px-2 py-1 text-[12px]">
                    <option value="">facteur…</option>
                    {["diviser par 1 000", "diviser par 1 000 000", "diviser par 1 000 000 000", "multiplier par 1 000", "multiplier par 1 000 000", "garder les valeurs, changer l unité"].map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <input value={b(c.id).unite} onChange={(e) => maj1(c.id, "unite", e.target.value)} placeholder="unité correcte (ex : Mds $)" className="mt-2 w-full rounded border border-white/15 bg-black px-2 py-1 text-[12px]" />
                  <button onClick={() => enregistre(c.id, { statut: "corriger", facteur: b(c.id).facteur || c.correction_proposee, unite: b(c.id).unite || c.unite_affichee })} className="mt-2 w-full rounded bg-emerald-600/80 px-2 py-1 text-[12px] hover:bg-emerald-600">Valider la correction</button>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="text-[12px] font-semibold text-zinc-200">Je ne peux pas résoudre en l état</div>
                  <textarea value={b(c.id).explication} onChange={(e) => maj1(c.id, "explication", e.target.value)} placeholder="Ce qui manque pour résoudre (source, accès, info…)" rows={3} className="mt-2 w-full rounded border border-white/15 bg-black px-2 py-1 text-[12px]" />
                  <button onClick={() => enregistre(c.id, { statut: "bloque", explication: b(c.id).explication })} className="mt-1 w-full rounded bg-amber-600/80 px-2 py-1 text-[12px] hover:bg-amber-600">Enregistrer</button>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-white/10 p-3">
                  <div className="text-[12px] font-semibold text-zinc-200">Pas résolvable</div>
                  <p className="mt-1 text-[11.5px] text-zinc-500">Le KPI sera retiré du Comparer et signalé.</p>
                  <button onClick={() => enregistre(c.id, { statut: "non_resolvable" })} className="mt-2 w-full rounded bg-rose-600/80 px-2 py-1 text-[12px] hover:bg-rose-600">Non résolvable</button>
                  {d && <button onClick={() => enregistre(c.id, null)} className="mt-1 text-[11px] text-zinc-500 underline">annuler ma décision</button>}
                </div>
              </div>
              {d?.explication && <p className="mt-2 text-[12px] text-amber-200">Ce qui manque : {d.explication}</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
