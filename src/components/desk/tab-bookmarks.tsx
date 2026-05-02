"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, Bookmark } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Input, Pill, PrimaryButton } from "./ui";

type B = { id: string; title: string; url: string; description: string; category: string; tags: string[]; created_at: string };

export function TabBookmarks({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<B[]>([]);
  const [t, setT] = useState({ title: "", url: "", description: "", category: "general", tags: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_bookmarks");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!t.url.trim()) return;
    await fetch("/api/desk/desk_bookmarks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...t, tags: t.tags.split(",").map((x) => x.trim()).filter(Boolean) }),
    });
    setT({ title: "", url: "", description: "", category: "general", tags: "" });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/desk_bookmarks?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Nouveau bookmark</span>
          <HelpTip>Articles, vidéos earnings, papiers académiques, threads X… tout lien à garder pour t'y replonger plus tard.</HelpTip>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px]">
          <Input placeholder="Titre" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <Input placeholder="URL" value={t.url} onChange={(e) => setT({ ...t, url: e.target.value })} />
          <Input placeholder="catégorie" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="description rapide" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} />
          <Input placeholder="tags séparés par virgule" value={t.tags} onChange={(e) => setT({ ...t, tags: e.target.value })} />
          <PrimaryButton onClick={add}><Plus className="size-3.5" />Ajouter</PrimaryButton>
        </div>
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && <Empty icon={Bookmark} title="Aucun bookmark" description="Ajoute tes liens utiles ci-dessus." />}

      <div className="space-y-1.5">
        {items.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
            <Bookmark className="size-3.5 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-zinc-100 hover:text-violet-200">
                {b.title || b.url}
                <ExternalLink className="size-3 text-zinc-500" />
              </a>
              {b.description && <div className="mt-0.5 line-clamp-1 text-[11.5px] text-zinc-400">{b.description}</div>}
            </div>
            <Pill color="cyan">{b.category}</Pill>
            {b.tags?.slice(0, 3).map((tg) => <Pill key={tg}>{tg}</Pill>)}
            <button onClick={() => del(b.id)} className="text-zinc-600 hover:text-rose-400">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
