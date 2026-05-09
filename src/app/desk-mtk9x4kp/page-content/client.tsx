"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import type { PageContent } from "@/lib/desk/page-content";

export function PageContentClient({ initialRows }: { initialRows: PageContent[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function api<T>(path: string, method: string, body?: unknown): Promise<T | null> {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        setMsg({ type: "err", text: `❌ ${err.error || r.statusText}` });
        return null;
      }
      const data = await r.json();
      if (method !== "GET") {
        setMsg({ type: "ok", text: "✅ Sauvegardé" });
        setTimeout(() => setMsg(null), 1800);
      }
      return data as T;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const data = await api<PageContent[]>("/api/desk/page-content", "GET");
    if (data) setRows(data);
  }

  async function newSection() {
    const page = prompt("Page (ex 'contact', 'about') :", "contact");
    if (!page) return;
    const section = prompt("Identifiant de section (ex 'sidebar_text') :");
    if (!section) return;
    const fr = prompt("Texte en français :");
    if (!fr) return;
    await api("/api/desk/page-content", "POST", {
      page_key: page,
      section_key: section,
      content_fr: fr,
      is_active: true,
    });
    await refresh();
  }

  async function toggleActive(row: PageContent) {
    await api(`/api/desk/page-content/${row.id}`, "PATCH", { is_active: !row.is_active });
    await refresh();
  }

  async function deleteRow(row: PageContent) {
    if (!confirm(`Supprimer la section "${row.page_key}/${row.section_key}" ?`)) return;
    await api(`/api/desk/page-content/${row.id}`, "DELETE");
    await refresh();
  }

  // Group by page_key
  const byPage = rows.reduce<Record<string, PageContent[]>>((acc, r) => {
    if (!acc[r.page_key]) acc[r.page_key] = [];
    acc[r.page_key].push(r);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-zinc-100">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Contenu des pages</h1>
        <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
          {rows.length} sections · {Object.keys(byPage).length} pages
        </div>
      </div>

      <p className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2 text-[12px] text-zinc-300">
        Édite ici les textes affichés sur les pages publiques. Si une section
        est désactivée ou absente, la page utilise automatiquement le texte
        codé en dur (fallback `dictionary.ts`).
      </p>

      {msg && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${
          msg.type === "ok"
            ? "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200"
            : "border-rose-500/30 bg-rose-500/[0.05] text-rose-200"
        }`}>
          {msg.text}
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={newSection}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Nouvelle section
        </button>
      </div>

      {Object.entries(byPage).map(([page, sections]) => (
        <section key={page} className="mb-6">
          <h2 className="mb-2 font-display text-[16px] font-bold capitalize">{page}</h2>
          <div className="space-y-2.5">
            {sections.map((s) => (
              <SectionEditor key={s.id} row={s} onSaved={refresh} onToggle={() => toggleActive(s)} onDelete={() => deleteRow(s)} api={api} busy={busy} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function SectionEditor({
  row,
  onSaved,
  onToggle,
  onDelete,
  api,
  busy,
}: {
  row: PageContent;
  onSaved: () => void;
  onToggle: () => void;
  onDelete: () => void;
  api: <T>(path: string, method: string, body?: unknown) => Promise<T | null>;
  busy: boolean;
}) {
  const [fr, setFr] = useState(row.content_fr);
  const [en, setEn] = useState(row.content_en ?? "");
  const [de, setDe] = useState(row.content_de ?? "");
  const dirty = fr !== row.content_fr || en !== (row.content_en ?? "") || de !== (row.content_de ?? "");

  async function save() {
    await api(`/api/desk/page-content/${row.id}`, "PATCH", {
      content_fr: fr,
      content_en: en || null,
      content_de: de || null,
    });
    onSaved();
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{row.section_key}</div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onToggle} title={row.is_active ? "Désactiver (page utilise le fallback)" : "Activer"} className="rounded p-1 hover:bg-white/[0.04]">
            {row.is_active ? <Eye className="size-3.5 text-emerald-300" /> : <EyeOff className="size-3.5 text-zinc-600" />}
          </button>
          <button type="button" onClick={onDelete} title="Supprimer" className="rounded p-1 text-rose-300 hover:bg-white/[0.04]">
            <Trash2 className="size-3.5" />
          </button>
          {dirty && (
            <button type="button" onClick={save} disabled={busy} className="ml-1 inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1 text-[11px] font-bold text-zinc-50 hover:bg-violet-400">
              <Save className="size-3.5" />Enregistrer
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <LangInput label="FR" value={fr} onChange={setFr} />
        <LangInput label="EN" value={en} onChange={setEn} placeholder="(vide = fallback FR)" />
        <LangInput label="DE" value={de} onChange={setDe} placeholder="(vide = fallback FR)" />
      </div>
    </div>
  );
}

function LangInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
      />
    </div>
  );
}
