"use client";

import { useEffect, useState } from "react";
import { Pin, PinOff, Plus, Trash2, Save, X } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Input, PrimaryButton, Textarea } from "./ui";
import { FileText } from "lucide-react";

type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
};

export function TabNotes({ ownerEmail }: { ownerEmail: string }) {
  // SWR cache : hydrate localStorage au mount = affichage instantané.
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("mettrik.desk.cache.v1.notes");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    if (notes.length === 0) setLoading(true);
    const r = await fetch("/api/desk/notes");
    if (r.ok) {
      const data = await r.json();
      setNotes(data);
      try { window.localStorage.setItem("mettrik.desk.cache.v1.notes", JSON.stringify(data)); } catch {}
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(n: Note) {
    const isNew = n.id.startsWith("new-");
    const r = await fetch("/api/desk/notes", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isNew ? { title: n.title, body: n.body, tags: n.tags, pinned: n.pinned } : n),
    });
    if (r.ok) {
      await load();
      setEditing(null);
    }
  }
  async function del(id: string) {
    if (!confirm("Supprimer cette note ?")) return;
    await fetch(`/api/desk/notes?id=${id}`, { method: "DELETE" });
    setEditing(null);
    load();
  }
  async function togglePin(n: Note) {
    await fetch("/api/desk/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: n.id, pinned: !n.pinned }),
    });
    load();
  }

  const filtered = notes.filter((n) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => setEditing({ id: `new-${Date.now()}`, title: "", body: "", tags: [], pinned: false, updated_at: "" })}>
          <Plus className="size-3.5" />
          Nouvelle note
        </PrimaryButton>
        <Input
          placeholder="Filtrer (titre, contenu, tag)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          {notes.length} note{notes.length > 1 ? "s" : ""}
          <HelpTip>
            Tes notes sont sauvegardées sur Supabase, table <code>desk_notes</code>. Elles ne sont visibles que par toi (RLS Row Level Security activée sur ton email).
          </HelpTip>
        </span>
      </div>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}

      {!loading && filtered.length === 0 && !editing && (
        <Empty
          icon={FileText}
          title="Aucune note"
          description="Crée ta première note pour garder trace de tes idées, briefs, recherches."
        />
      )}

      {editing && (
        <DeskCard className="mb-4 border-violet-500/30">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
              {editing.id.startsWith("new-") ? "Nouvelle note" : "Édition"}
            </span>
            <div className="flex gap-2">
              <PrimaryButton onClick={() => save(editing)}>
                <Save className="size-3.5" />
                Enregistrer
              </PrimaryButton>
              <GhostButton onClick={() => setEditing(null)}>
                <X className="size-3.5" />
                Annuler
              </GhostButton>
              {!editing.id.startsWith("new-") && (
                <GhostButton onClick={() => del(editing.id)}>
                  <Trash2 className="size-3.5" />
                </GhostButton>
              )}
            </div>
          </div>
          <Input
            placeholder="Titre"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            className="mb-2"
          />
          <Textarea
            placeholder="Contenu (markdown)…"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={8}
            className="mb-2 text-[14px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder="tags séparés par des virgules"
              value={editing.tags.join(", ")}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
            />
            <HelpTip label="Tags">
              Les tags servent à filtrer rapidement (ex : "design", "data", "billing"). Sépare-les par des virgules.
            </HelpTip>
          </div>
        </DeskCard>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => setEditing(n)}
            className="group rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-100">{n.title || "Sans titre"}</div>
                <div className="mt-1 line-clamp-3 text-[12px] text-zinc-400">{n.body || "(vide)"}</div>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); togglePin(n); }}
                className={`shrink-0 rounded p-1 ${n.pinned ? "text-violet-300" : "text-zinc-600 opacity-0 group-hover:opacity-100"}`}
                role="button"
              >
                {n.pinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
              </span>
            </div>
            {n.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {n.tags.map((t) => (
                  <span key={t} className="rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 text-[10px] text-zinc-600">
              {n.updated_at ? new Date(n.updated_at).toLocaleDateString("fr-FR") : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
