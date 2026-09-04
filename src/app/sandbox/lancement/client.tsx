"use client";

/**
 * Interrupteur de lancement — sandbox (Yann 1er sept 2026, v2).
 * Bascule immédiate ou PROGRAMMÉE de mettrik.ai (pré-lancement / ouvert),
 * et vue des trois niveaux avec leurs liens.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Programme = { mode: "on" | "off"; quand: string } | null;
type Etat = {
  mode: "on" | "off" | "env";
  programme: Programme;
  variable_env: "on" | "off";
  maintenance_effective: boolean;
  niveaux: { n0: string; n1: string; n2: string };
};

/** Reporte le jeton d audit de l URL vers les appels d API, pour que
 *  l interrupteur reste utilisable quand la connexion est inaccessible. */
function jetonUrl(): string {
  if (typeof window === "undefined") return "";
  const t = new URLSearchParams(window.location.search).get("audit_token");
  return t ? `?audit_token=${encodeURIComponent(t)}` : "";
}

export function LancementClient() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [progMode, setProgMode] = useState<"off" | "on">("off");
  const [progQuand, setProgQuand] = useState("");

  const charge = useCallback(async () => {
    const r = await fetch(`/api/sandbox/lancement${jetonUrl()}`);
    if (r.ok) setEtat(await r.json());
  }, []);
  useEffect(() => {
    void charge();
    const m = window.setInterval(() => void charge(), 30_000);
    return () => window.clearInterval(m);
  }, [charge]);

  async function envoie(corps: { mode: "on" | "off" | "env"; programme?: Programme }) {
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch(`/api/sandbox/lancement${jetonUrl()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corps),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "échec");
      setMessage("Enregistré. Effet sur mettrik.ai sous ~20 secondes.");
      await charge();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "échec");
    } finally {
      setEnvoi(false);
    }
  }

  const ouvert = etat ? !etat.maintenance_effective : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">Lancement</h1>

      {etat && (
        <div className={`mt-5 rounded-xl border p-5 ${ouvert ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10"}`}>
          <div className="text-lg font-medium text-zinc-100">
            {ouvert ? "🟢 mettrik.ai est OUVERT au public" : "🟠 mettrik.ai affiche la page de pré-lancement"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Réglage : {etat.mode === "env" ? `suivre la variable Vercel (actuellement ${etat.variable_env})` : `forcé ${etat.mode === "on" ? "pré-lancement" : "ouvert"}`}
            {etat.programme && (
              <> · ⏰ bascule programmée : {etat.programme.mode === "off" ? "OUVERTURE" : "pré-lancement"} le{" "}
                {new Date(etat.programme.quand).toLocaleString("fr-FR")}</>
            )}
          </div>
        </div>
      )}

      <h2 className="mt-7 text-sm font-medium uppercase tracking-wide text-zinc-500">Bascule immédiate</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={envoi} onClick={() => void envoie({ mode: "off", programme: etat?.programme ?? null })}
          className="rounded-lg border border-emerald-500 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">
          Ouvrir le site maintenant
        </button>
        <button disabled={envoi} onClick={() => void envoie({ mode: "on", programme: etat?.programme ?? null })}
          className="rounded-lg border border-amber-500 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50">
          Repasser en pré-lancement
        </button>
        <button disabled={envoi} onClick={() => void envoie({ mode: "env", programme: etat?.programme ?? null })}
          className="rounded-lg border border-[#262626] px-4 py-2.5 text-sm text-zinc-400 hover:border-[#3a3a3a] disabled:opacity-50">
          Suivre la variable Vercel
        </button>
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-zinc-500">Bascule programmée</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Exemple : programmer l&apos;ouverture demain à 9h00. La bascule se fait toute
        seule à l&apos;heure dite (précision ~20 s), même Mac éteint.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select value={progMode} onChange={(e) => setProgMode(e.target.value as "on" | "off")}
          className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-zinc-200">
          <option value="off">Ouvrir le site</option>
          <option value="on">Passer en pré-lancement</option>
        </select>
        <input type="datetime-local" value={progQuand} onChange={(e) => setProgQuand(e.target.value)}
          className="rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-zinc-200" />
        <button disabled={envoi || !progQuand}
          onClick={() => etat && void envoie({ mode: etat.mode, programme: { mode: progMode, quand: new Date(progQuand).toISOString() } })}
          className="rounded-lg border border-purple-500 bg-purple-500/15 px-4 py-2 text-sm font-medium text-purple-200 hover:bg-purple-500/25 disabled:opacity-50">
          Programmer
        </button>
        {etat?.programme && (
          <button disabled={envoi} onClick={() => etat && void envoie({ mode: etat.mode, programme: null })}
            className="rounded-lg border border-[#262626] px-4 py-2 text-sm text-zinc-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50">
            Annuler la programmation
          </button>
        )}
      </div>
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

      <h2 className="mt-9 text-sm font-medium uppercase tracking-wide text-zinc-500">Les trois niveaux</h2>
      <div className="mt-3 space-y-2">
        {etat && (
          [
            ["N0 · Site public", etat.niveaux.n0, "Le vrai site, celui des visiteurs. Seul niveau touché par l'interrupteur ci-dessus."],
            ["N1 · Pré-production", etat.niveaux.n1, "Copie de contrôle : sert de référence stable et de point de comparaison avant promotion."],
            ["N2 · Travail", etat.niveaux.n2, "Là où les modifications arrivent en premier, pour tester avant de pousser plus loin."],
          ] as const
        ).map(([titre, url, desc]) => (
          <div key={titre} className="flex items-start justify-between gap-4 rounded-xl border border-[#262626] bg-[#0a0a0a] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-zinc-200">{titre}</div>
              <div className="text-xs text-zinc-500">{desc}</div>
            </div>
            <a href={url} target="_blank" rel="noreferrer"
              className="shrink-0 rounded-lg border border-[#262626] px-3 py-1.5 text-xs text-violet-300 hover:border-violet-500/50">
              Ouvrir ↗
            </a>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        Mécanique : le réglage (mode + programmation) est écrit en base et lu par le
        proxy avec un cache de 20 secondes par instance. « Forcé » prime sur la
        variable Vercel MAINTENANCE_MODE. mettrik-niveau1 et mettrik-niveau2 ne
        sont jamais mis en maintenance. Aucun redéploiement nécessaire.
      </p>
    </main>
  );
}
