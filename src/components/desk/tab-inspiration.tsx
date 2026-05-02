"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ImageIcon, ExternalLink } from "lucide-react";
import { DeskCard, Empty, HelpTip, Input, Pill, PrimaryButton, Textarea } from "./ui";

type I = { id: string; title: string; url: string; image_url: string; category: string; notes: string };

export function TabInspiration({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<I[]>([]);
  const [t, setT] = useState({ title: "", url: "", image_url: "", category: "design", notes: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_inspiration");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!t.title.trim()) return;
    await fetch("/api/desk/desk_inspiration", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(t),
    });
    setT({ title: "", url: "", image_url: "", category: "design", notes: "" });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/desk_inspiration?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Nouvelle inspiration</span>
          <HelpTip>Stocke les visuels qui t'inspirent (Freepik, concurrents, sites design). L'<strong>URL image</strong> peut être l'adresse directe d'une miniature (clic droit, "Copier l'adresse de l'image").</HelpTip>
        </div>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_140px]">
          <Input placeholder="Titre / description rapide" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <Input placeholder="URL source" value={t.url} onChange={(e) => setT({ ...t, url: e.target.value })} />
          <Input placeholder="catégorie" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input placeholder="URL de l'image (.jpg/.png/.webp)" value={t.image_url} onChange={(e) => setT({ ...t, image_url: e.target.value })} />
          <PrimaryButton onClick={add}><Plus className="size-3.5" />Ajouter</PrimaryButton>
        </div>
        <Textarea className="mt-2" rows={2} placeholder="Notes (pourquoi tu l'as gardée)" value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} />
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && <Empty icon={ImageIcon} title="Galerie vide" description="Stocke ici les visuels qui t'inspirent (référence rapide pendant le design)." />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <DeskCard key={i.id} className="overflow-hidden p-0">
            {i.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.image_url} alt={i.title} className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full bg-white/[0.02]" />
            )}
            <div className="p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-medium text-zinc-100">{i.title}</span>
                <Pill color="cyan">{i.category}</Pill>
              </div>
              {i.notes && <div className="mt-1 line-clamp-2 text-[11px] text-zinc-400">{i.notes}</div>}
              <div className="mt-2 flex items-center gap-2">
                {i.url && (
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-violet-300 hover:text-violet-200">
                    <ExternalLink className="size-3" />source
                  </a>
                )}
                <button onClick={() => del(i.id)} className="ml-auto text-zinc-600 hover:text-rose-400">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </DeskCard>
        ))}
      </div>
    </div>
  );
}
