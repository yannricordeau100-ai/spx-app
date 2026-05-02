"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Lightbulb } from "lucide-react";
import { DeskCard, Empty, HelpTip, Input, Pill, PrimaryButton, Textarea } from "./ui";

type I = { id: string; title: string; body: string; category: string; status: string };
const STATUS_COLOR = { idea: "zinc", shortlist: "cyan", doing: "violet", done: "green", rejected: "red" } as const;
const CAT_COLOR = { product: "violet", design: "cyan", business: "green", tech: "amber", marketing: "red", other: "zinc" } as const;

export function TabIdeas({ ownerEmail }: { ownerEmail: string }) {
  const [items, setItems] = useState<I[]>([]);
  const [t, setT] = useState({ title: "", body: "", category: "product", status: "idea" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/desk_ideas");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!t.title.trim()) return;
    await fetch("/api/desk/desk_ideas", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(t),
    });
    setT({ title: "", body: "", category: "product", status: "idea" });
    load();
  }
  async function patch(id: string, p: Partial<I>) {
    await fetch("/api/desk/desk_ideas", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...p }) });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/desk/desk_ideas?id=${id}`, { method: "DELETE" });
    load();
  }

  const grouped: Record<string, I[]> = { idea: [], shortlist: [], doing: [], done: [], rejected: [] };
  for (const i of items) (grouped[i.status] ?? grouped.idea).push(i);

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Nouvelle idée</span>
          <HelpTip>Carnet d'idées Mettrik AI. Statut : <strong>idea</strong> (germe) → <strong>shortlist</strong> (à faire bientôt) → <strong>doing</strong> (en cours) → <strong>done</strong> (livré). <strong>rejected</strong> garde la trace de ce qui a été jugé pas pertinent.</HelpTip>
        </div>
        <div className="grid gap-2 sm:grid-cols-[2fr_140px_140px_auto]">
          <Input placeholder="Titre court" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
          <select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-100 outline-none">
            <option value="product">product</option>
            <option value="design">design</option>
            <option value="business">business</option>
            <option value="tech">tech</option>
            <option value="marketing">marketing</option>
            <option value="other">other</option>
          </select>
          <select value={t.status} onChange={(e) => setT({ ...t, status: e.target.value })}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-100 outline-none">
            <option value="idea">idea</option>
            <option value="shortlist">shortlist</option>
            <option value="doing">doing</option>
          </select>
          <PrimaryButton onClick={add}><Plus className="size-3.5" />Ajouter</PrimaryButton>
        </div>
        <Textarea className="mt-2" rows={2} placeholder="Détails (optionnel)" value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} />
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Chargement…</div>}
      {!loading && items.length === 0 && <Empty icon={Lightbulb} title="Aucune idée" description="Note tout ce qui te passe par la tête, tu trieras après." />}

      {(["doing", "shortlist", "idea", "done", "rejected"] as const).map((s) =>
        grouped[s].length > 0 ? (
          <div key={s} className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Pill color={STATUS_COLOR[s]}>{s}</Pill>
              <span className="text-[10.5px] text-zinc-500">{grouped[s].length}</span>
            </div>
            <div className="space-y-1.5">
              {grouped[s].map((i) => (
                <div key={i.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <Pill color={CAT_COLOR[i.category as keyof typeof CAT_COLOR] ?? "zinc"}>{i.category}</Pill>
                    <span className="flex-1 text-[13px] font-medium text-zinc-100">{i.title}</span>
                    <select value={i.status} onChange={(e) => patch(i.id, { status: e.target.value })}
                      className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10.5px] text-zinc-300 outline-none">
                      {["idea", "shortlist", "doing", "done", "rejected"].map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <button onClick={() => del(i.id)} className="text-zinc-600 hover:text-rose-400">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {i.body && <div className="mt-1 text-[11.5px] text-zinc-400">{i.body}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
