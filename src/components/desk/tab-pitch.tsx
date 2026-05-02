"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Target, Save, X, Lock } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Input, PrimaryButton, Textarea } from "./ui";

type P = { id: string; title: string; body: string; audience: string; status: string; updated_at: string };

export function TabPitch({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<P[]>([]);
  const [editing, setEditing] = useState<P | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_pitch_notes");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(p: P) {
    const isNew = p.id.startsWith("new-");
    await fetch("/api/desk/desk_pitch_notes", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isNew ? { title: p.title, body: p.body, audience: p.audience, status: p.status } : p),
    });
    setEditing(null);
    load();
  }
  async function del(id: string) {
    if (!confirm("Supprimer cette note pitch ?")) return;
    await fetch(`/api/desk/desk_pitch_notes?id=${id}`, { method: "DELETE" });
    setEditing(null);
    load();
  }

  return (
    <div>
      <DeskCard className="mb-4 border-amber-500/20 bg-amber-500/[0.04]">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 text-amber-300" />
          <div className="text-[12px] text-amber-200">
            <strong>Cloisonné</strong>. Notes sensibles (investisseurs, fundraising). Stockées dans une table séparée des autres notes pour pouvoir les exporter / supprimer indépendamment. <HelpTip>Pourquoi cloisonner : si tu exportes un dossier "notes" pour partage, tu ne risques pas d'inclure tes notes pitch privées par mégarde.</HelpTip>
          </div>
        </div>
      </DeskCard>

      <div className="mb-4 flex items-center gap-2">
        <PrimaryButton onClick={() => setEditing({ id: `new-${Date.now()}`, title: "", body: "", audience: "", status: "draft", updated_at: "" })}>
          <Plus className="size-3.5" />Nouvelle note pitch
        </PrimaryButton>
        <span className="ml-auto text-[11px] text-zinc-500">{items.length} note{items.length > 1 ? "s" : ""}</span>
      </div>

      {editing && (
        <DeskCard className="mb-4 border-violet-500/30">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
              {editing.id.startsWith("new-") ? "Nouvelle" : "Édition"}
            </span>
            <div className="flex gap-2">
              <PrimaryButton onClick={() => save(editing)}><Save className="size-3.5" />Enregistrer</PrimaryButton>
              <GhostButton onClick={() => setEditing(null)}><X className="size-3.5" /></GhostButton>
              {!editing.id.startsWith("new-") && <GhostButton onClick={() => del(editing.id)}><Trash2 className="size-3.5" /></GhostButton>}
            </div>
          </div>
          <Input placeholder="Titre" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mb-2" />
          <Input placeholder="Audience (ex : baggr.fr, iq-invest, family office X)" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} className="mb-2" />
          <Textarea rows={12} placeholder="Notes pitch (markdown)" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="font-mono text-[12.5px]" />
        </DeskCard>
      )}

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && !editing && (
        <Empty icon={Target} title="Aucune note pitch" description="Espace dédié aux notes investisseurs / fundraising." />
      )}

      <div className="space-y-2">
        {items.map((p) => (
          <button key={p.id} onClick={() => setEditing(p)}
            className="block w-full rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-zinc-100">{p.title || "Sans titre"}</span>
              {p.audience && <span className="rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">{p.audience}</span>}
              <span className="ml-auto text-[10px] text-zinc-600">{p.updated_at ? new Date(p.updated_at).toLocaleDateString("fr-FR") : ""}</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11.5px] text-zinc-400">{p.body || "(vide)"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
