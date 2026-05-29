"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type ListEntry = { ticker: string; added_at: string; note?: string; scheduled_at?: string };
type ListFile = { updated_at: string; tickers: ListEntry[] };

type Defect = { id: string; severity: number; obs: string; corrected?: boolean; reverified?: boolean };
type StatusEntry = {
  ticker: string;
  last_run_at?: string;
  state: "idle" | "running" | "done" | "error";
  defects?: Defect[];
  mode_screenshots?: Record<string, string>;
  error?: string;
};
type StatusFile = { updated_at: string; results: Record<string, StatusEntry> };

const SEV_COLOR: Record<number, string> = {
  5: "bg-red-500/20 text-red-300 border-red-500/40",
  4: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  3: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  2: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  1: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export function VipInspectionClient({
  initialList,
  initialStatus,
}: {
  initialList: ListFile;
  initialStatus: StatusFile;
}) {
  const [list, setList] = useState(initialList);
  const [status, setStatus] = useState(initialStatus);
  const [newTicker, setNewTicker] = useState("");
  const [newNote, setNewNote] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [groupNote, setGroupNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");
  // Notification "Terminé" quand un ticker passe de running → done
  // (Yann 17 mai 2026 : "j'ai besoin que ça indique terminé").
  const [doneNotif, setDoneNotif] = useState<string | null>(null);
  const prevStatesRef = useRef<Record<string, string>>({});

  async function api(action: string, ticker: string, note?: string) {
    setMsg("…");
    const r = await fetch("/api/vip-inspection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ticker, note }),
    });
    const j = await r.json();
    if (j.list) setList(j.list);
    setMsg(j.hint || (j.ok ? "✓" : j.error || "?"));
    setTimeout(() => setMsg(""), 4000);
  }

  // Yann 19 mai 2026 : action groupe (add_group + launch_group).
  async function apiGroup(action: "add_group" | "launch_group", tickers: string[], note?: string) {
    setMsg("…");
    const r = await fetch("/api/vip-inspection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, tickers, note }),
    });
    const j = await r.json();
    if (j.list) setList(j.list);
    setMsg(j.hint || (j.ok ? "✓" : j.error || "?"));
    setTimeout(() => setMsg(""), 6000);
    void refresh();
  }

  function parseTickers(raw: string): string[] {
    return raw
      .split(/[\s,;\n]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0 && t.length <= 12);
  }

  async function refresh() {
    const r = await fetch("/api/vip-inspection");
    const j = await r.json();
    if (j.list) setList(j.list);
    if (j.status) setStatus(j.status);
  }

  // Auto-refresh : si au moins 1 ticker en running → poll toutes les 15s
  // pour récupérer le résultat dès qu'il arrive (sans rafraîchir manuellement).
  useEffect(() => {
    const anyRunning = Object.values(status.results || {}).some((s) => s?.state === "running");
    if (!anyRunning) return;
    const id = setInterval(() => { void refresh(); }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Detection transition running → done (notification flash 8s en haut).
  useEffect(() => {
    const newStates: Record<string, string> = {};
    for (const [tk, s] of Object.entries(status.results || {})) {
      newStates[tk] = s?.state || "idle";
      const prev = prevStatesRef.current[tk];
      if (prev === "running" && s?.state === "done") {
        const d = s.defects || [];
        const fixed = d.filter((x) => x.corrected).length;
        setDoneNotif(`✓ Inspection ${tk} TERMINÉE · ${d.length} défauts détectés · ${fixed} corrigés`);
        setTimeout(() => setDoneNotif(null), 8000);
      } else if (prev === "running" && s?.state === "error") {
        setDoneNotif(`⚠ Inspection ${tk} ÉCHEC : ${s.error || "erreur inconnue"}`);
        setTimeout(() => setDoneNotif(null), 8000);
      }
    }
    prevStatesRef.current = newStates;
  }, [status]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicker.trim()) return;
    startTransition(async () => {
      await api("add", newTicker, newNote || undefined);
      setNewTicker("");
      setNewNote("");
    });
  }

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* Notification flash "Terminé" en haut quand inspection done */}
      {doneNotif && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-[13.5px] font-medium text-emerald-100 backdrop-blur shadow-lg">
          {doneNotif}
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-display text-[30px] font-bold tracking-tight">VIP Inspection</h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Liste des stés où tout doit être <strong className="text-amber-300">PARFAIT</strong>.
            Chaque inspection lance un audit visuel approfondi (Courbe / Barres 2D-3D / Variation / Tableau de bord, par /an /mois /semaine /jour /heure /minute /seconde, trimestriel + annuel), télécharge les charts en PNG, les passe à Gemini, applique les auto-fixes connus, re-vérifie.
          </p>
        </header>

        {/* Form add ticker */}
        <form onSubmit={handleAdd} className="mb-6 rounded-md border border-white/10 bg-[#080808] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Ticker (ex BABA, NVDA)"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              className="w-32 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[13px] uppercase tracking-wider text-zinc-100 focus:border-violet-500/50 focus:outline-none"
              maxLength={10}
            />
            <input
              type="text"
              placeholder="Note (optionnel)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 min-w-[200px] rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100"
            />
            <button
              type="submit"
              disabled={isPending || !newTicker.trim()}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/[0.08] px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-40"
            >
              + Ajouter
            </button>
            <button
              type="button"
              onClick={refresh}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.07]"
            >
              ↻ Refresh
            </button>
          </div>
          {msg ? <p className="mt-2 text-[11.5px] text-violet-300">{msg}</p> : null}
        </form>

        {/* Yann 19 mai 2026 : Ajout par GROUPE de tickers + lancement multiple.
            Coller une liste séparée par virgules / espaces / sauts de ligne. */}
        <div className="mb-6 rounded-md border border-cyan-500/30 bg-cyan-500/[0.04] p-3">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-cyan-300">
            Mode groupe (multi-tickers, inspection séquentielle 1 par 1)
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <textarea
              placeholder="LVMH, RMS.PA, TTE.PA, KER.PA, NESN.SW … (séparés par virgule / espace / saut de ligne)"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              className="min-h-[60px] flex-1 min-w-[280px] rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] uppercase tracking-wider text-zinc-100 focus:border-cyan-500/50 focus:outline-none"
              rows={2}
            />
            <input
              type="text"
              placeholder="Note groupe (optionnel)"
              value={groupNote}
              onChange={(e) => setGroupNote(e.target.value)}
              className="w-[200px] rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const tk = parseTickers(groupInput);
                if (tk.length === 0) { setMsg("⚠ aucun ticker valide détecté"); return; }
                startTransition(async () => {
                  await apiGroup("add_group", tk, groupNote || undefined);
                  setGroupInput("");
                  setGroupNote("");
                });
              }}
              disabled={isPending}
              className="rounded-md border border-cyan-500/40 bg-cyan-500/[0.08] px-3 py-1.5 text-[12px] text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-40"
            >
              ➕ Ajouter le groupe
            </button>
            <button
              type="button"
              onClick={() => {
                const tk = parseTickers(groupInput);
                if (tk.length === 0) { setMsg("⚠ groupe vide — ajoute des tickers d'abord"); return; }
                startTransition(async () => {
                  // 1) ajoute si pas déjà présents
                  await apiGroup("add_group", tk, groupNote || undefined);
                  // 2) lance l'inspection en série
                  await apiGroup("launch_group", tk);
                });
              }}
              disabled={isPending}
              className="rounded-md border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-[12px] font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
            >
              ▶▶ Ajouter + Inspecter ce groupe
            </button>
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  // Lance toutes les stés VIP non-running
                  await apiGroup("launch_group", []);
                });
              }}
              disabled={isPending || list.tickers.length === 0}
              className="rounded-md border border-amber-500/40 bg-amber-500/[0.08] px-3 py-1.5 text-[12px] text-amber-100 hover:bg-amber-500/15 disabled:opacity-40"
            >
              ⚡ Lancer TOUTES les stés VIP (en série)
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-zinc-500">
            Les stés sont inspectées <strong>séquentiellement</strong> (1 par 1) par le worker
            GitHub Action sur le Mac runner. Chaque inspection = audit visuel Gemini + auto-fixes + re-vérif.
          </p>
        </div>

        {/* List + status */}
        {list.tickers.length === 0 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-4 text-[13px] text-amber-200">
            Aucune sté VIP encore. Ajoute un ticker ci-dessus pour démarrer.
          </p>
        ) : (
          <div className="space-y-3">
            {list.tickers.map((entry) => {
              const s = status.results[entry.ticker];
              return (
                <article key={entry.ticker} className="rounded-lg border border-white/10 bg-[#080808] p-4">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-mono text-[18px] font-bold text-zinc-50">
                        {entry.ticker}
                        <a
                          href={`/sandbox/v1-9-5/${entry.ticker.toLowerCase()}?audit_token=preview`}
                          target="_blank"
                          rel="noopener"
                          className="ml-2 text-[12px] font-normal text-violet-300 hover:text-violet-200"
                        >
                          → page sté
                        </a>
                      </h2>
                      {entry.note ? <p className="mt-0.5 text-[11.5px] text-zinc-400">{entry.note}</p> : null}
                      <p className="mt-0.5 text-[10.5px] text-zinc-600">
                        Ajouté : {new Date(entry.added_at).toLocaleString("fr-FR")}
                        {entry.scheduled_at ? ` · Programmé : ${new Date(entry.scheduled_at).toLocaleString("fr-FR")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StateBadge state={s?.state ?? "idle"} />
                      <button
                        onClick={() => api("launch", entry.ticker)}
                        disabled={s?.state === "running"}
                        className="rounded-md border border-violet-500/40 bg-violet-500/[0.08] px-3 py-1.5 text-[12px] text-violet-100 hover:bg-violet-500/15 disabled:opacity-40"
                      >
                        ▶ Lancer
                      </button>
                      <button
                        onClick={() => api("remove", entry.ticker)}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.07]"
                      >
                        Retirer
                      </button>
                    </div>
                  </header>

                  {s ? (
                    <div className="mt-3">
                      {s.last_run_at ? (
                        <p className="text-[11px] text-zinc-500">
                          Dernière inspection : {new Date(s.last_run_at).toLocaleString("fr-FR")}
                        </p>
                      ) : null}
                      {s.error ? <p className="mt-1 text-[12px] text-red-300">⚠ {s.error}</p> : null}
                      {s.defects && s.defects.length > 0 ? (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
                          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
                            Défauts ({s.defects.filter((d) => !d.reverified).length} ouverts · {s.defects.filter((d) => d.reverified).length} corrigés)
                          </p>
                          <ul className="space-y-1">
                            {s.defects
                              .slice()
                              .sort((a, b) => Number(a.reverified ?? 0) - Number(b.reverified ?? 0) || b.severity - a.severity)
                              .map((d, i) => (
                                <li key={i} className="flex items-start gap-2 text-[11.5px]">
                                  <span className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[9.5px] ${SEV_COLOR[d.severity]}`}>S{d.severity}</span>
                                  <span className={d.reverified ? "text-zinc-500 line-through" : "text-zinc-300"}>
                                    <span className="font-mono">{d.id}</span> — {d.obs}
                                  </span>
                                  {d.corrected ? <span className="text-emerald-400" title="Auto-fix appliqué">⚙</span> : null}
                                  {d.reverified ? <span className="text-emerald-400" title="Re-vérifié OK après fix">✓</span> : null}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : s.state === "done" ? (
                        <p className="mt-2 text-[12px] text-emerald-300">✓ Aucun défaut détecté.</p>
                      ) : null}
                      {s.mode_screenshots && Object.keys(s.mode_screenshots).length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-cyan-300/80 hover:text-cyan-200">
                            Screenshots par mode ({Object.keys(s.mode_screenshots).length})
                          </summary>
                          <ul className="ml-3 mt-1 list-disc font-mono text-[10.5px] text-zinc-500">
                            {Object.entries(s.mode_screenshots).map(([mode, p]) => (
                              <li key={mode}>
                                <strong className="text-zinc-300">{mode}</strong>: <span className="font-mono">{p}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11.5px] text-zinc-500">Pas encore inspecté. Clique « Lancer » pour démarrer.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-6 rounded-md border border-white/10 bg-[#080808] p-4">
          <h3 className="text-[13px] font-semibold text-zinc-300">Ce que fait une inspection « VIP »</h3>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-zinc-400">
            <li>Visite la page sté via Chrome headless (avec bypass audit_token)</li>
            <li>Toggle chaque mode chart (Courbe / Barres 2D / Barres 3D / Variation / Tableau de bord)</li>
            <li>Toggle chaque temporalité (Annuel / Trimestriel) — si dispo</li>
            <li>Toggle chaque fraction de temps ($/an / $/mois / $/semaine / $/jour / $/heure / $/minute / $/seconde) — si applicable au KPI hero</li>
            <li>Screenshot full-page + cible chart à chaque combinaison</li>
            <li>Télécharge le PNG du chart via le bouton in-app (vérifie le mini-logo intégré + watermark)</li>
            <li>Envoie chaque PNG à Gemini 2.5 Flash avec le template visual-audit étendu (cf. <code className="font-mono">scripts/visual-audit-template.yaml</code>)</li>
            <li>Applique les auto-fixes connus (cf. <code className="font-mono">scripts/fix-element.py FIXES</code>)</li>
            <li>Re-visite la page + re-vérifie chaque défaut → coche ✓ si OK</li>
            <li>Stocke le résultat dans <code className="font-mono">src/data/vip-inspection-status.json</code></li>
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            Lancement manuel via CLI : <code className="rounded bg-white/[0.06] px-1 font-mono">python3 scripts/vip-deep-inspection.py --ticker BABA</code>.
            Pour BABA spécifiquement : pas de DEF14A → governance via annual report HK / 6-K / page IR officielle.
          </p>
        </section>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle: { label: "Pas lancé", cls: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40" },
    running: { label: "En cours", cls: "bg-violet-500/20 text-violet-300 border-violet-500/40" },
    done: { label: "Fini", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    error: { label: "Erreur", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  };
  const c = map[state] ?? map.idle;
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${c.cls}`}>{c.label}</span>;
}
