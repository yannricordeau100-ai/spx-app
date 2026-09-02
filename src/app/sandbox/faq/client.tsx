"use client";

/**
 * Éditeur de la FAQ (Yann 2 sept 2026).
 * Une carte par question : catégorie, question et réponse en français,
 * question et réponse en anglais (réserve pour la version EN). Monter,
 * descendre, retirer, ajouter. Enregistrer = effet immédiat sur /faq.
 * Syntaxe des réponses : paragraphes séparés par une ligne vide,
 * liens [texte](/adresse).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { FaqContenu, FaqItem } from "@/lib/faq";

type Etat = "chargement" | "repos" | "envoi" | "ok" | "erreur";

export function FaqEditeur() {
  const [contenu, setContenu] = useState<FaqContenu | null>(null);
  const [source, setSource] = useState<"base" | "depot">("depot");
  const [etat, setEtat] = useState<Etat>("chargement");
  const [message, setMessage] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charge = useCallback(async () => {
    const r = await fetch("/api/sandbox/faq");
    if (!r.ok) {
      setEtat("erreur");
      setMessage("Accès refusé ou base injoignable.");
      return;
    }
    const j = await r.json();
    setContenu(j.contenu);
    setSource(j.source);
    setEtat("repos");
  }, []);
  useEffect(() => {
    void charge();
  }, [charge]);

  async function enregistre() {
    if (!contenu) return;
    setEtat("envoi");
    setMessage("");
    try {
      const r = await fetch("/api/sandbox/faq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenu }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "échec");
      setContenu(j.contenu);
      setSource("base");
      setEtat("ok");
      setMessage("Enregistré. Visible sur /faq immédiatement (données structurées incluses).");
    } catch (e) {
      setEtat("erreur");
      setMessage(e instanceof Error ? e.message : "échec");
    }
  }

  async function retablitDepot() {
    if (!confirm("Effacer tes modifications et revenir au contenu du dépôt ?")) return;
    setEtat("envoi");
    const r = await fetch("/api/sandbox/faq", { method: "DELETE" });
    const j = await r.json();
    if (r.ok) {
      setContenu(j.contenu);
      setSource("depot");
      setEtat("ok");
      setMessage("Contenu du dépôt rétabli.");
    } else {
      setEtat("erreur");
      setMessage(j?.error ?? "échec");
    }
  }

  const majItem = (id: string, patch: Partial<FaqItem>) =>
    setContenu((c) => c && { ...c, items: c.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const deplace = (id: string, sens: -1 | 1) =>
    setContenu((c) => {
      if (!c) return c;
      const i = c.items.findIndex((it) => it.id === id);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= c.items.length) return c;
      const items = [...c.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...c, items };
    });
  const retire = (id: string) =>
    setContenu((c) => c && { ...c, items: c.items.filter((it) => it.id !== id) });
  const ajoute = (categorie: string) => {
    const id = `nouvelle-question-${Date.now().toString(36)}`;
    setContenu((c) => c && { ...c, items: [...c.items, { id, categorie, q_fr: "", r_fr: "", q_en: "", r_en: "" }] });
    setOuvert(id);
  };

  if (!contenu) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10 text-zinc-300">
        <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
        <p className="mt-6 text-sm">{etat === "erreur" ? message : "Chargement…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">FAQ publique</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {contenu.items.length} questions · source actuelle : {source === "base" ? "base (tes modifications)" : "dépôt (contenu de départ)"} · mise à jour {contenu.mis_a_jour}.
            Voir <Link href="/faq" className="text-violet-300 underline" target="_blank">/faq</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={retablitDepot} className="rounded-full border border-[#3a3a3a] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            Rétablir le dépôt
          </button>
          <button
            onClick={enregistre}
            disabled={etat === "envoi"}
            className="rounded-full bg-violet-400 px-4 py-1.5 text-sm font-semibold text-[#0b0b0e] hover:bg-violet-300 disabled:opacity-50"
          >
            {etat === "envoi" ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${etat === "erreur" ? "text-red-400" : "text-emerald-400"}`}>{message}</p>
      )}
      <p className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] text-zinc-500">
        Réponses : sépare les paragraphes par une ligne vide ; un lien s&apos;écrit [texte](/pricing). Pas de tiret cadratin.
        Les champs anglais sont facultatifs (réserve pour la version EN).
      </p>

      <div className="mt-8 space-y-10">
        {contenu.categories.map((cat) => {
          const items = contenu.items.filter((it) => it.categorie === cat.id);
          return (
            <section key={cat.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-medium text-zinc-100">{cat.titre_fr}</h2>
                <button onClick={() => ajoute(cat.id)} className="text-xs text-violet-300 hover:text-violet-200">
                  + Ajouter une question ici
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {items.map((it) => {
                  const estOuvert = ouvert === it.id;
                  return (
                    <div key={it.id} className="rounded-xl border border-[#262626] bg-[#0a0a0a]">
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button onClick={() => setOuvert(estOuvert ? null : it.id)} className="flex-1 text-left text-sm text-zinc-200">
                          {it.q_fr || <span className="italic text-zinc-500">(question vide)</span>}
                        </button>
                        <button onClick={() => deplace(it.id, -1)} title="Monter" className="text-zinc-500 hover:text-zinc-200">↑</button>
                        <button onClick={() => deplace(it.id, 1)} title="Descendre" className="text-zinc-500 hover:text-zinc-200">↓</button>
                        <button onClick={() => retire(it.id)} title="Retirer" className="text-zinc-500 hover:text-red-400">✕</button>
                      </div>
                      {estOuvert && (
                        <div className="grid gap-3 border-t border-[#1f1f1f] p-4 md:grid-cols-2">
                          <label className="text-xs text-zinc-500">
                            Catégorie
                            <select
                              value={it.categorie}
                              onChange={(e) => majItem(it.id, { categorie: e.target.value })}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-sm text-zinc-200"
                            >
                              {contenu.categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.titre_fr}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-zinc-500">
                            Identifiant (ancre, ne pas changer sans raison)
                            <input
                              value={it.id}
                              onChange={(e) => majItem(it.id, { id: e.target.value })}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 font-mono text-xs text-zinc-300"
                            />
                          </label>
                          <label className="text-xs text-zinc-500 md:col-span-2">
                            Question (FR)
                            <input
                              value={it.q_fr}
                              onChange={(e) => majItem(it.id, { q_fr: e.target.value })}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-sm text-zinc-100"
                            />
                          </label>
                          <label className="text-xs text-zinc-500 md:col-span-2">
                            Réponse (FR)
                            <textarea
                              value={it.r_fr}
                              onChange={(e) => majItem(it.id, { r_fr: e.target.value })}
                              rows={6}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-sm leading-relaxed text-zinc-100"
                            />
                          </label>
                          <label className="text-xs text-zinc-500">
                            Question (EN, facultatif)
                            <input
                              value={it.q_en}
                              onChange={(e) => majItem(it.id, { q_en: e.target.value })}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-sm text-zinc-200"
                            />
                          </label>
                          <label className="text-xs text-zinc-500">
                            Réponse (EN, facultatif)
                            <textarea
                              value={it.r_en}
                              onChange={(e) => majItem(it.id, { r_en: e.target.value })}
                              rows={4}
                              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-sm text-zinc-200"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-10 flex justify-end">
        <button
          onClick={enregistre}
          disabled={etat === "envoi"}
          className="rounded-full bg-violet-400 px-5 py-2 text-sm font-semibold text-[#0b0b0e] shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:bg-violet-300 disabled:opacity-50"
        >
          {etat === "envoi" ? "Enregistrement…" : "Enregistrer la FAQ"}
        </button>
      </div>
    </main>
  );
}
