"use client";

/**
 * Télémétrie — tableau de bord sandbox (Yann 31 août 2026).
 * Toutes les métriques de la collecte première partie : audience, pages,
 * clics, appareils, pays, erreurs, latence API (couche logicielle), emails.
 * Interrupteur global de collecte en tête de page.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Duo = [string, number];
type Stats = {
  actif: boolean;
  fenetre_heures: number;
  evenements: number;
  tronque: boolean;
  visiteurs: number;
  visiteurs_ip: number;
  connectes: number;
  pages_vues: number;
  duree_moyenne_s: number | null;
  scroll_moyen_pct: number | null;
  top_pages: Duo[];
  top_clics: Duo[];
  top_pays: Duo[];
  appareils: Duo[];
  navigateurs: Duo[];
  erreurs: Duo[];
  api: { appels: number; p50_ms: number | null; p95_ms: number | null; top_routes: Duo[] };
  emails: { total: number; par_etat: Duo[] };
  evenements_serveur: Duo[];
  serie_pages: [number, number][];
};

const FENETRES: [number, string][] = [[24, "24 h"], [168, "7 j"], [720, "30 j"]];

function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{titre}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{valeur}</div>
      {detail && <div className="text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

function Tableau({ titre, lignes, vide }: { titre: string; lignes: Duo[]; vide?: string }) {
  const max = lignes[0]?.[1] ?? 1;
  return (
    <div className="rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-200">{titre}</h3>
      {lignes.length === 0 && <p className="text-xs text-zinc-600">{vide ?? "Rien sur la fenêtre."}</p>}
      <div className="space-y-1.5">
        {lignes.map(([nom, n]) => (
          <div key={nom} className="relative overflow-hidden rounded px-2 py-1">
            <div className="absolute inset-y-0 left-0 bg-purple-500/10" style={{ width: `${(n / max) * 100}%` }} />
            <div className="relative flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-zinc-300">{nom}</span>
              <span className="shrink-0 font-mono text-zinc-400">{n.toLocaleString("fr-FR")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelemetrieClient() {
  const [heures, setHeures] = useState(24);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const charge = useCallback(async (h: number) => {
    setChargement(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/sandbox/telemetrie?heures=${h}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "echec");
      setStats(j);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "échec du chargement");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { void charge(heures); }, [charge, heures]);

  async function bascule() {
    if (!stats) return;
    const suivant = !stats.actif;
    setStats({ ...stats, actif: suivant });
    await fetch("/api/sandbox/telemetrie", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actif: suivant }),
    });
  }

  const serieMax = Math.max(1, ...(stats?.serie_pages.map(([, n]) => n) ?? [1]));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-zinc-100">Télémétrie</h1>
        {stats && (
          <button
            onClick={() => void bascule()}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              stats.actif
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-red-500 bg-red-500/15 text-red-300"
            }`}
          >
            {stats.actif ? "Collecte active — cliquer pour couper" : "Collecte COUPÉE — cliquer pour activer"}
          </button>
        )}
        <div className="ml-auto flex gap-1.5">
          {FENETRES.map(([h, label]) => (
            <button
              key={h}
              onClick={() => setHeures(h)}
              className={`rounded-full border px-3 py-1 text-xs ${
                heures === h
                  ? "border-purple-500 bg-purple-500/15 text-purple-200"
                  : "border-[#262626] text-zinc-400 hover:border-[#3a3a3a]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-zinc-500">
        Mesure première partie, sans aucun service tiers : audience, comportement,
        couche logicielle (latence API, erreurs) et emails. IP jamais stockée en clair.
      </p>

      {erreur === "table_absente" && (
        <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          La table n&apos;existe pas encore. Colle le contenu de
          <code className="mx-1">supabase/migrations/20260831_telemetrie.sql</code>
          dans l&apos;éditeur SQL Supabase (Dashboard → SQL Editor → Run), puis recharge.
        </div>
      )}
      {erreur && erreur !== "table_absente" && (
        <p className="mt-6 text-sm text-red-400">{erreur}</p>
      )}
      {chargement && !stats && <p className="mt-6 text-sm text-zinc-500">Chargement…</p>}

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Carte titre="Visiteurs (sessions)" valeur={stats.visiteurs.toLocaleString("fr-FR")} detail={`${stats.visiteurs_ip} IP distinctes`} />
            <Carte titre="Connectés" valeur={stats.connectes.toLocaleString("fr-FR")} />
            <Carte titre="Pages vues" valeur={stats.pages_vues.toLocaleString("fr-FR")} />
            <Carte titre="Durée moyenne / page" valeur={stats.duree_moyenne_s != null ? `${stats.duree_moyenne_s}s` : "—"} />
            <Carte titre="Scroll moyen" valeur={stats.scroll_moyen_pct != null ? `${stats.scroll_moyen_pct}%` : "—"} />
            <Carte titre="Événements" valeur={stats.evenements.toLocaleString("fr-FR")} detail={stats.tronque ? "fenêtre tronquée à 20 000" : undefined} />
          </div>

          {stats.serie_pages.length > 1 && (
            <div className="mt-4 rounded-xl border border-[#262626] bg-[#0a0a0a] p-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-200">Pages vues dans le temps</h3>
              <div className="flex h-20 items-end gap-[2px]">
                {stats.serie_pages.map(([t, n]) => (
                  <div
                    key={t}
                    title={`${new Date(t).toLocaleString("fr-FR")} : ${n}`}
                    className="flex-1 rounded-t bg-purple-500/60"
                    style={{ height: `${Math.max(4, (n / serieMax) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Tableau titre="Pages les plus vues" lignes={stats.top_pages} />
            <Tableau titre="Clics les plus fréquents" lignes={stats.top_clics} />
            <Tableau titre="Pays" lignes={stats.top_pays} />
            <Tableau titre="Appareils" lignes={stats.appareils} />
            <Tableau titre="Navigateurs" lignes={stats.navigateurs} />
            <Tableau titre="Erreurs JavaScript" lignes={stats.erreurs} vide="Aucune erreur sur la fenêtre." />
            <Tableau
              titre={`Couche logicielle — API (${stats.api.appels.toLocaleString("fr-FR")} appels, p50 ${stats.api.p50_ms ?? "—"} ms, p95 ${stats.api.p95_ms ?? "—"} ms)`}
              lignes={stats.api.top_routes}
            />
            <Tableau
              titre={`Emails (${stats.emails.total.toLocaleString("fr-FR")})`}
              lignes={stats.emails.par_etat}
              vide="Aucun événement email. Brancher le webhook Resend (voir /api/webhooks/resend)."
            />
            <Tableau titre="Événements serveur" lignes={stats.evenements_serveur} vide="Aucun (connexions, exports... apparaîtront ici)." />
          </div>
        </>
      )}
    </main>
  );
}
