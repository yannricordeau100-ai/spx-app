"use client";

import { useState } from "react";

type Kpi = { short: string; nom: string; points: number; story: boolean };
type Zone = { cle: string; libelle: string; stes: { ticker: string; nom: string; defaut: string[] }[] };

export function AccueilKpisClient({ zones, kpis, choixInitial, jeton }: { zones: Zone[]; kpis: Record<string, Kpi[]>; choixInitial: Record<string, string[]>; jeton: string | null }) {
  const [choix, setChoix] = useState<Record<string, string[]>>(choixInitial);
  const [statut, setStatut] = useState("");
  const [zone, setZone] = useState(zones[0]?.cle ?? "");
  const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";

  async function enregistre(ticker: string, shorts: string[]) {
    setStatut(`${ticker} : enregistrement…`);
    const r = await fetch(`/api/sandbox/accueil-kpis${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker, shorts }) });
    const j = (await r.json().catch(() => ({}))) as { shorts?: string[]; error?: string };
    if (r.ok) {
      setChoix((c) => ({ ...c, [ticker]: j.shorts ?? [] }));
      setStatut(`${ticker} : ${j.shorts?.length ? "enregistré, visible sur l’accueil au prochain chargement" : "retour aux KPI automatiques"}`);
    } else setStatut(`${ticker} : échec (${j.error ?? r.status})`);
  }

  const z = zones.find((x) => x.cle === zone);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5">
        {zones.map((x) => (
          <button key={x.cle} type="button" onClick={() => setZone(x.cle)} className={`rounded-full border px-3 py-1 text-[12px] ${zone === x.cle ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
            {x.libelle}
          </button>
        ))}
      </div>
      {statut && <p className="mt-2 font-mono text-[12px] text-cyan-300">{statut}</p>}
      <div className="mt-3 grid gap-2">
        {z?.stes.map((s) => <Ligne key={s.ticker} s={s} liste={kpis[s.ticker] ?? []} actuel={choix[s.ticker] ?? []} enregistre={enregistre} />)}
      </div>
    </div>
  );
}

function Ligne({ s, liste, actuel, enregistre }: { s: Zone["stes"][number]; liste: Kpi[]; actuel: string[]; enregistre: (t: string, shorts: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([actuel[0] ?? "", actuel[1] ?? "", actuel[2] ?? ""]);
  const ic = liste.filter((k) => !k.story);
  const stories = liste.filter((k) => k.story);
  return (
    <details className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
      <summary className="cursor-pointer text-[13px]">
        <span className="font-mono font-semibold text-violet-200">{s.ticker}</span> {s.nom}
        <span className="ml-2 text-[11.5px] text-zinc-500">{actuel.length ? `choisi : ${actuel.map((x) => liste.find((k) => k.short === x)?.nom ?? x).join(" · ")}` : `automatique : ${s.defaut.join(" · ")}`}</span>
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <select key={i} value={sel[i]} onChange={(e) => setSel((v) => v.map((x, j) => (j === i ? e.target.value : x)))} className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-zinc-100">
            <option value="">KPI {i + 1} : automatique</option>
            <optgroup label="Indicateurs clés">
              {ic.map((k) => <option key={k.short} value={k.short}>{k.nom} ({k.points} pts)</option>)}
            </optgroup>
            <optgroup label="Stories">
              {stories.map((k) => <option key={k.short} value={k.short}>{k.nom} ({k.points} pts)</option>)}
            </optgroup>
          </select>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => enregistre(s.ticker, sel.filter(Boolean))} className="rounded-md bg-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-400">Enregistrer</button>
        <button type="button" onClick={() => { setSel(["", "", ""]); enregistre(s.ticker, []); }} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300 hover:text-white">Revenir à l’automatique</button>
      </div>
    </details>
  );
}
