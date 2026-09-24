"use client";

/**
 * Yann 25 sept 2026 : « Emails et alertes que Mettrik t envoie ».
 * Onglet principal : alertes par email ; puis notifications par email ;
 * sous onglet : reglages. Chaque ligne montre en apercu le nombre d envois,
 * le dernier envoi et le destinataire ; un clic ouvre tout le detail.
 */
import { useState } from "react";
import { ALERTES, NOTIFICATIONS, type EntreeCatalogue } from "./catalogue";
import type { Reglages } from "@/lib/journal-emails";

type Journal = {
  types: Record<string, { nb: number; dernier: string | null; derniers: { d: string; sujet: string; dest: string }[] }>;
  evenements: Record<string, string[]>;
  totaux: Record<string, number>;
};

function quand(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Ligne({ e, j, rang }: { e: EntreeCatalogue; j: Journal; rang: number }) {
  const [ouvert, setOuvert] = useState(false);
  const t = j.types[e.type];
  const couleur = e.statut === "actif" ? "bg-emerald-400" : e.statut === "bloque" ? "bg-zinc-600" : "bg-amber-400";
  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
        <span className="w-5 font-mono text-[11px] text-zinc-500">{rang}</span>
        <span className={`size-2 shrink-0 rounded-full ${couleur}`} title={e.statut} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-zinc-100">{e.titre}</span>
          <span className="block truncate text-[12px] text-zinc-400">{e.quoi}</span>
        </span>
        <span className="hidden w-24 text-right text-[11.5px] text-zinc-400 sm:block">{e.destinataire}</span>
        <span className="w-16 text-right font-mono text-[15px] font-bold text-zinc-50">{e.statut === "hors journal" ? "n.c." : t?.nb ?? 0}</span>
        <span className="w-28 text-right font-mono text-[11px] text-zinc-400">{e.statut === "hors journal" ? "hors journal" : quand(t?.dernier)}</span>
      </button>
      {ouvert && (
        <div className="grid gap-x-4 gap-y-1.5 border-t border-white/[0.06] px-4 py-3 text-[12.5px] sm:grid-cols-[140px_1fr]">
          <span className="text-zinc-500">Déclencheur</span><span className="text-zinc-200">{e.declencheur}</span>
          <span className="text-zinc-500">Fréquence</span><span className="text-zinc-200">{e.frequence}</span>
          <span className="text-zinc-500">Destinataire</span><span className="text-zinc-200">{e.destinataire}</span>
          <span className="text-zinc-500">Statut</span><span className="text-zinc-200">{e.statut}</span>
          <span className="text-zinc-500">Code</span><span className="font-mono text-[11.5px] text-zinc-400">{e.source}</span>
          <span className="text-zinc-500">Derniers envois</span>
          <span>
            {t?.derniers?.length ? (
              <ul className="space-y-0.5">
                {t.derniers.map((l, i) => (
                  <li key={i} className="text-zinc-300"><span className="font-mono text-[11px] text-zinc-500">{quand(l.d)}</span> · {l.sujet} <span className="text-zinc-500">→ {l.dest}</span></li>
                ))}
              </ul>
            ) : (
              <span className="text-zinc-500">Aucun envoi enregistré depuis la mise en place du journal (25 sept 2026).</span>
            )}
          </span>
        </div>
      )}
    </li>
  );
}

function Tableau({ liste, j }: { liste: EntreeCatalogue[]; j: Journal }) {
  return (
    <div>
      <div className="mb-1.5 hidden gap-3 px-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:flex">
        <span className="w-5" /><span className="w-2" /><span className="flex-1">Email</span><span className="w-24 text-right">Pour</span><span className="w-16 text-right">Envoyés</span><span className="w-28 text-right">Dernier</span>
      </div>
      <ul className="space-y-1.5">{liste.map((e, i) => <Ligne key={e.type} e={e} j={j} rang={i + 1} />)}</ul>
    </div>
  );
}

function Reglage({ r }: { r: Reglages }) {
  const [v, setV] = useState(r);
  const [etat, setEtat] = useState("");
  const champ = (k: keyof Reglages, lib: string) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] px-3 py-2 text-[13px]">
      <span className="text-zinc-300">{lib}</span>
      <input type="number" min={1} value={v[k] as number} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-right font-mono text-zinc-100" />
    </label>
  );
  async function enregistrer() {
    setEtat("…");
    const r2 = await fetch("/api/sandbox/emails-alertes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) });
    setEtat(r2.ok ? "Enregistré" : "Échec");
  }
  return (
    <div className="max-w-xl space-y-2">
      <label className="flex items-center justify-between rounded-lg border border-white/[0.07] px-3 py-2 text-[13px]">
        <span className="text-zinc-300">Alertes de volume actives (contact et inscriptions)</span>
        <input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} />
      </label>
      {champ("notifContactSeuil", "Notification au Ne message de contact")}
      {champ("rafaleNb", "Rafale : alerte au-delà de N messages ou comptes")}
      {champ("rafaleMinutes", "Rafale : fenêtre en minutes")}
      {champ("jourNb", "Journée : alerte au-delà de N sur 24 h")}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={enregistrer} className="rounded-lg border border-violet-400/50 bg-violet-500/15 px-4 py-2 text-[13px] font-semibold text-violet-100 hover:bg-violet-500/25">Enregistrer</button>
        <span className="text-[12px] text-zinc-400">{etat}</span>
      </div>
      <p className="pt-2 text-[11.5px] text-zinc-500">Les emails de connexion (confirmation d adresse, mot de passe) sont envoyés par Supabase et ne sont pas comptés ici. Rendu de chaque modèle : /sandbox/emails.</p>
    </div>
  );
}

export function EmailsAlertesClient({ journal, reglages, ongletInitial }: { journal: Journal; reglages: Reglages; ongletInitial: string }) {
  const [onglet, setOnglet] = useState(ongletInitial);
  const somme = (l: EntreeCatalogue[]) => l.reduce((a, e) => a + (journal.types[e.type]?.nb ?? 0), 0);
  const ONGLETS = [
    { id: "alertes", titre: "Alertes par email", sous: `${ALERTES.length} types · ${somme(ALERTES)} envoyées` },
    { id: "notifications", titre: "Notifications par email", sous: `${NOTIFICATIONS.length} types · ${somme(NOTIFICATIONS)} envoyées` },
    { id: "reglages", titre: "Réglages", sous: "seuils des alertes de volume" },
  ];
  const d24 = (k: string) => (journal.evenements[k] ?? []).filter((d) => Date.now() - Date.parse(d) < 864e5).length;
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-[26px] font-bold">Emails et alertes envoyés par Mettrik</h1>
        <p className="mt-1 text-[13px] text-zinc-400">Alertes (sécurité, rafales de contact et d inscriptions, fiches en retard), notifications (messages reçus, veille des indices, emails aux clients) et réglages des seuils.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Messages de contact", journal.totaux.contact ?? 0, `${d24("contact")} sur 24 h`],
            ["Créations de compte", journal.totaux.inscription ?? 0, `${d24("inscription")} sur 24 h`],
            ["Alertes envoyées", somme(ALERTES), "depuis le 25 sept"],
            ["Notifications envoyées", somme(NOTIFICATIONS), "depuis le 25 sept"],
          ].map(([l, n, s]) => (
            <div key={String(l)} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[11.5px] text-zinc-400">{l}</div>
              <div className="font-mono text-[22px] font-bold">{n}</div>
              <div className="text-[11px] text-zinc-500">{s}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-b border-white/10 pb-2">
          {ONGLETS.map((o) => (
            <button key={o.id} onClick={() => setOnglet(o.id)} className={`rounded-lg px-3 py-2 text-left ${onglet === o.id ? "bg-violet-500/15 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}>
              <span className="block text-[13.5px] font-semibold">{o.titre}</span>
              <span className="block text-[11px] opacity-70">{o.sous}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          {onglet === "alertes" && <Tableau liste={ALERTES} j={journal} />}
          {onglet === "notifications" && <Tableau liste={NOTIFICATIONS} j={journal} />}
          {onglet === "reglages" && <Reglage r={reglages} />}
        </div>
      </div>
    </div>
  );
}
