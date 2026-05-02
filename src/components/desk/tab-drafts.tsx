"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, MessageSquare, Save, X } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Input, Pill, PrimaryButton, Textarea } from "./ui";

type D = { id: string; title: string; body: string; channel: string; status: string; updated_at: string };
const CHAN_COLOR = { email: "cyan", newsletter: "violet", linkedin: "green", twitter: "amber", blog: "red", other: "zinc" } as const;
const STATUS_COLOR = { draft: "zinc", review: "amber", published: "green", archived: "zinc" } as const;

export function TabDrafts({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<D[]>([]);
  const [editing, setEditing] = useState<D | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_drafts");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(d: D) {
    const isNew = d.id.startsWith("new-");
    await fetch("/api/desk/desk_drafts", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isNew ? { title: d.title, body: d.body, channel: d.channel, status: d.status } : d),
    });
    setEditing(null);
    load();
  }
  async function del(id: string) {
    if (!confirm("Supprimer ce brouillon ?")) return;
    await fetch(`/api/desk/desk_drafts?id=${id}`, { method: "DELETE" });
    setEditing(null);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <PrimaryButton onClick={() => setEditing({ id: `new-${Date.now()}`, title: "", body: "", channel: "email", status: "draft", updated_at: "" })}>
          <Plus className="size-3.5" />Nouveau brouillon
        </PrimaryButton>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          {items.length} brouillon{items.length > 1 ? "s" : ""}
          <HelpTip>Brouillons de newsletters, posts LinkedIn, emails investisseurs avant envoi. Statut <strong>review</strong> = à relire avant publication.</HelpTip>
        </span>
      </div>

      {editing && (
        <DeskCard className="mb-4 border-violet-500/30">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
              {editing.id.startsWith("new-") ? "Nouveau" : "Édition"}
            </span>
            <div className="flex gap-2">
              <PrimaryButton onClick={() => save(editing)}><Save className="size-3.5" />Enregistrer</PrimaryButton>
              <GhostButton onClick={() => setEditing(null)}><X className="size-3.5" /></GhostButton>
              {!editing.id.startsWith("new-") && (
                <GhostButton onClick={() => del(editing.id)}><Trash2 className="size-3.5" /></GhostButton>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[2fr_140px_140px]">
            <Input placeholder="Titre / sujet" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <select value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-100 outline-none">
              {["email", "newsletter", "linkedin", "twitter", "blog", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-100 outline-none">
              {["draft", "review", "published", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Textarea className="mt-2 font-mono text-[12.5px]" rows={12} placeholder="Contenu (markdown)" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
        </DeskCard>
      )}

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && !editing && (
        <Empty icon={MessageSquare} title="Aucun brouillon" description="Rédige ici tes communications avant de les publier." />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((d) => (
          <button key={d.id} onClick={() => setEditing(d)}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-zinc-100">{d.title || "Sans titre"}</span>
              <Pill color={STATUS_COLOR[d.status as keyof typeof STATUS_COLOR] ?? "zinc"}>{d.status}</Pill>
            </div>
            <div className="mt-1 line-clamp-2 text-[11.5px] text-zinc-400">{d.body || "(vide)"}</div>
            <div className="mt-2 flex items-center gap-2">
              <Pill color={CHAN_COLOR[d.channel as keyof typeof CHAN_COLOR] ?? "zinc"}>{d.channel}</Pill>
              <span className="ml-auto text-[10px] text-zinc-600">
                {d.updated_at ? new Date(d.updated_at).toLocaleDateString("fr-FR") : ""}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
