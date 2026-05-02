"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Link as LinkIcon, ExternalLink } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Input, PrimaryButton } from "./ui";

type L = { id: string; label: string; url: string; icon: string; position: number };

const SUGGESTED: { label: string; url: string }[] = [
  { label: "Stripe Dashboard", url: "https://dashboard.stripe.com" },
  { label: "Supabase Dashboard", url: "https://supabase.com/dashboard" },
  { label: "Vercel Dashboard", url: "https://vercel.com/dashboard" },
  { label: "Spaceship (mettrik.ai)", url: "https://www.spaceship.com" },
  { label: "GitHub repo", url: "https://github.com" },
  { label: "SEC EDGAR", url: "https://www.sec.gov/edgar/searchedgar/companysearch" },
  { label: "Brave Search API", url: "https://api.search.brave.com" },
  { label: "Groq Console", url: "https://console.groq.com" },
];

export function TabLinks({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<L[]>([]);
  const [t, setT] = useState({ label: "", url: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_links");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(label: string, url: string) {
    if (!url.trim()) return;
    await fetch("/api/desk/desk_links", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, url, position: items.length }),
    });
    setT({ label: "", url: "" });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/desk_links?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Quick link</span>
          <HelpTip>Liens vers tes outils internes (Stripe, Supabase, GitHub, dashboards). Différent des bookmarks : ce sont les outils que tu utilises souvent, pas du contenu à lire.</HelpTip>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input placeholder="Label" value={t.label} onChange={(e) => setT({ ...t, label: e.target.value })} />
          <Input placeholder="URL" value={t.url} onChange={(e) => setT({ ...t, url: e.target.value })} />
          <PrimaryButton onClick={() => add(t.label, t.url)}><Plus className="size-3.5" />Ajouter</PrimaryButton>
        </div>
        {items.length === 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] text-zinc-500">Suggestions à ajouter en 1 click :</div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <GhostButton key={s.label} onClick={() => add(s.label, s.url)}>
                  <Plus className="size-3" />{s.label}
                </GhostButton>
              ))}
            </div>
          </div>
        )}
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && <Empty icon={LinkIcon} title="Aucun lien" description="Ajoute tes outils pour les avoir sous la main." />}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]">
            <LinkIcon className="size-3.5 text-violet-300" />
            <span className="flex-1 text-[12.5px] text-zinc-100">{l.label || l.url}</span>
            <ExternalLink className="size-3 text-zinc-500" />
            <button onClick={(e) => { e.preventDefault(); del(l.id); }} className="text-zinc-600 hover:text-rose-400">
              <Trash2 className="size-3" />
            </button>
          </a>
        ))}
      </div>
    </div>
  );
}
