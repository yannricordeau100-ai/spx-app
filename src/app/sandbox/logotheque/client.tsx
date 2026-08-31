"use client";

/**
 * Logothèque — sandbox (Yann 31 août 2026).
 *
 * Une ligne par EMPLACEMENT du site, une vignette par variante de logo
 * retenue. Un clic sur une vignette active cette variante pour cet
 * emplacement. Enregistrement en base, effet immédiat en production sans
 * redéploiement.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import activeWordmark from "@/data/active-wordmark.json";
import {
  WORDMARK_VARIANT_META,
  getWordmarkVariant,
} from "@/components/wordmark-variants";
import { EMPLACEMENTS, type ReglagesLogotheque } from "@/lib/logotheque";
import { rafraichitLogotheque } from "@/components/logo-mettrik";

type Etat = "repos" | "envoi" | "ok" | "erreur";

export function LogothequeClient({ initial }: { initial: ReglagesLogotheque }) {
  const [reglages, setReglages] = useState<ReglagesLogotheque>(initial);
  const [etat, setEtat] = useState<Etat>("repos");
  const [message, setMessage] = useState("");
  const [familleFiltre, setFamilleFiltre] = useState<string>("Toutes");

  const familles = useMemo(
    () => ["Toutes", ...Array.from(new Set(WORDMARK_VARIANT_META.map((v) => v.family)))],
    [],
  );
  const visibles = useMemo(
    () =>
      familleFiltre === "Toutes"
        ? WORDMARK_VARIANT_META
        : WORDMARK_VARIANT_META.filter((v) => v.family === familleFiltre),
    [familleFiltre],
  );

  async function enregistre(suivant: ReglagesLogotheque) {
    setReglages(suivant);
    setEtat("envoi");
    setMessage("");
    try {
      const r = await fetch("/api/logotheque", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reglages: suivant }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "echec");
      rafraichitLogotheque(j.reglages ?? suivant);
      setEtat("ok");
      setMessage("Enregistré. Actif en production immédiatement.");
    } catch (err) {
      setEtat("erreur");
      setMessage(err instanceof Error ? err.message : "échec de l'enregistrement");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Sandbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">Logothèque</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Tous les logos Mettrik créés et retenus, et le choix du logo affiché à
        chaque endroit du site. Un clic active la variante pour l&apos;emplacement
        de la ligne. Sans choix explicite, l&apos;emplacement suit la variante
        générale ({activeWordmark.id}).
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {familles.map((f) => (
          <button
            key={f}
            onClick={() => setFamilleFiltre(f)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              familleFiltre === f
                ? "border-purple-500 bg-purple-500/15 text-purple-200"
                : "border-[#262626] bg-[#0a0a0a] text-zinc-400 hover:border-[#3a3a3a]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {etat !== "repos" && (
        <p
          className={`mt-4 text-sm ${
            etat === "erreur" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {etat === "envoi" ? "Enregistrement…" : message}
        </p>
      )}

      <div className="mt-8 space-y-10">
        {EMPLACEMENTS.map((e) => {
          const actif = reglages[e.id] ?? activeWordmark.id;
          const herite = !reglages[e.id];
          return (
            <section key={e.id}>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-lg font-medium text-zinc-100">{e.label}</h2>
                <span className="text-xs text-zinc-500">{e.ou}</span>
                {herite ? (
                  <span className="rounded-full border border-[#262626] px-2 py-0.5 text-[11px] text-zinc-500">
                    hérite du réglage général
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      const suivant = { ...reglages };
                      delete suivant[e.id];
                      void enregistre(suivant);
                    }}
                    className="rounded-full border border-[#262626] px-2 py-0.5 text-[11px] text-zinc-400 hover:border-[#3a3a3a] hover:text-zinc-200"
                  >
                    revenir au réglage général
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibles.map((v) => {
                  const Variante = getWordmarkVariant(v.id);
                  const choisi = actif === v.id;
                  return (
                    <button
                      key={`${e.id}-${v.id}`}
                      onClick={() => void enregistre({ ...reglages, [e.id]: v.id })}
                      className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border px-4 py-5 text-center transition-colors ${
                        choisi
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-[#262626] bg-[#0a0a0a] hover:border-[#3a3a3a]"
                      }`}
                    >
                      <Variante size="sm" animated={false} showRail={false} />
                      <span className="text-[11px] leading-tight text-zinc-500">
                        {v.label}
                      </span>
                      {choisi && (
                        <span className="text-[11px] font-medium text-purple-300">
                          actif ici
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
