"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import { DeskCard, Empty, HelpTip, Input, Pill, PrimaryButton } from "./ui";

type E = { id: string; title: string; description: string; category: string; ticker: string | null; starts_at: string; ends_at: string | null; url: string };
const CAT_COLOR = { earnings: "amber", agm: "violet", conference: "cyan", product: "green", general: "zinc" } as const;

export function TabCalendar({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<E[]>([]);
  const [t, setT] = useState({ title: "", description: "", category: "earnings", ticker: "", starts_at: "", url: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_calendar");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!t.title || !t.starts_at) return;
    await fetch("/api/desk/desk_calendar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...t, ticker: t.ticker || null, starts_at: new Date(t.starts_at).toISOString() }),
    });
    setT({ title: "", description: "", category: "earnings", ticker: "", starts_at: "", url: "" });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/desk_calendar?id=${id}`, { method: "DELETE" });
    load();
  }

  const upcoming = items.filter((i) => new Date(i.starts_at) >= new Date()).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const past = items.filter((i) => new Date(i.starts_at) < new Date()).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Nouvel événement</span>
          <HelpTip>Earnings (publication des résultats), AGM (Assemblée Générale), conférences sectorielles, lancements produit. Source typique : Investor Relations de chaque société.</HelpTip>
        </div>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_120px_140px]">
          <Input placeholder="Titre (ex: GOOGL Q4 earnings)" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-100 outline-none">
            <option value="earnings">earnings</option>
            <option value="agm">AGM</option>
            <option value="conference">conférence</option>
            <option value="product">produit</option>
            <option value="general">général</option>
          </select>
          <Input placeholder="ticker" value={t.ticker} onChange={(e) => setT({ ...t, ticker: e.target.value.toUpperCase() })} />
          <Input type="datetime-local" value={t.starts_at} onChange={(e) => setT({ ...t, starts_at: e.target.value })} />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="description" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} />
          <Input placeholder="URL (optionnel)" value={t.url} onChange={(e) => setT({ ...t, url: e.target.value })} />
          <PrimaryButton onClick={add}><Plus className="size-3.5" />Ajouter</PrimaryButton>
        </div>
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && <Empty icon={Calendar} title="Aucun événement" description="Ajoute des earnings, AGM, conférences à suivre." />}

      {upcoming.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">À venir ({upcoming.length})</div>
          <div className="space-y-1.5">
            {upcoming.map((e) => <Row key={e.id} e={e} onDel={() => del(e.id)} />)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Passés ({past.length})</div>
          <div className="space-y-1.5 opacity-60">
            {past.slice(0, 10).map((e) => <Row key={e.id} e={e} onDel={() => del(e.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ e, onDel }: { e: E; onDel: () => void }) {
  const d = new Date(e.starts_at);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
      <Calendar className="size-3.5 text-zinc-500" />
      <div className="font-mono text-[10.5px] text-zinc-400">
        {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} · {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <span className="flex-1 text-[13px] text-zinc-100">{e.title}</span>
      {e.ticker && <Pill color="violet">{e.ticker}</Pill>}
      <Pill color={CAT_COLOR[e.category as keyof typeof CAT_COLOR] ?? "zinc"}>{e.category}</Pill>
      <button onClick={onDel} className="text-zinc-600 hover:text-rose-400">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
