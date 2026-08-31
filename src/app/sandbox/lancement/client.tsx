"use client";

/**
 * Interrupteur de lancement — sandbox (Yann 1er sept 2026).
 * Bascule mettrik.ai entre la page de pré-lancement et le site ouvert,
 * sans redéploiement (effet sous ~20 s).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Etat = {
  mode: "on" | "off" | "env";
  variable_env: "on" | "off";
  maintenance_effective: boolean;
};

export function LancementClient() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  const charge = useCallback(async () => {
    const r = await fetch("/api/sandbox/lancement");
    if (r.ok) setEtat(await r.json());
  }, []);
  useEffect(() => { void charge(); }, [charge]);

  async function pose(mode: "on" | "off" | "env") {
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch("/api/sandbox/lancement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
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
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">Lancement</h1>
      <p className="mt-2 text-sm text-zinc-500">
        État de mettrik.ai (le vrai domaine public). mettrik-niveau2 n&apos;est jamais
        affecté par cet interrupteur.
      </p>

      {etat && (
        <div className={`mt-6 rounded-xl border p-5 ${ouvert ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10"}`}>
          <div className="text-lg font-medium text-zinc-100">
            {ouvert ? "🟢 mettrik.ai est OUVERT au public" : "🟠 mettrik.ai affiche la page de pré-lancement"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Réglage : {etat.mode === "env" ? `suivre la variable Vercel (actuellement ${etat.variable_env})` : `forcé ${etat.mode === "on" ? "maintenance" : "ouvert"}`}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          disabled={envoi}
          onClick={() => void pose("off")}
          className="rounded-lg border border-emerald-500 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
        >
          Ouvrir le site (lancement)
        </button>
        <button
          disabled={envoi}
          onClick={() => void pose("on")}
          className="rounded-lg border border-amber-500 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
        >
          Repasser en pré-lancement
        </button>
        <button
          disabled={envoi}
          onClick={() => void pose("env")}
          className="rounded-lg border border-[#262626] px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-[#3a3a3a] disabled:opacity-50"
        >
          Suivre la variable Vercel
        </button>
      </div>
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        Mécanique : le réglage est écrit en base et lu par le proxy avec un cache
        de 20 secondes par instance. « Forcé » prime sur la variable Vercel
        MAINTENANCE_MODE ; « Suivre la variable » restaure le comportement
        historique. Aucun redéploiement nécessaire dans les trois cas.
      </p>
    </main>
  );
}
