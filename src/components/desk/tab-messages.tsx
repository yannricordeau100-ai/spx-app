"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Reply, Archive, Trash2, AlertOctagon, ExternalLink } from "lucide-react";
import { DeskCard, Empty } from "./ui";

type ContactMsg = {
  id: string;
  recipient: "contact" | "support";
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
  source_locale: string | null;
  source_ip: string | null;
  user_agent: string | null;
  status: "new" | "read" | "replied" | "archived" | "spam";
  read_at: string | null;
  replied_at: string | null;
  notes: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<ContactMsg["status"], string> = {
  new: "Nouveau",
  read: "Lu",
  replied: "Répondu",
  archived: "Archivé",
  spam: "Spam",
};
const STATUS_COLOR: Record<ContactMsg["status"], string> = {
  new: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  read: "bg-zinc-500/10 text-zinc-300 border-white/10",
  replied: "bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
  archived: "bg-zinc-700/20 text-zinc-500 border-white/5",
  spam: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

export function TabMessages() {
  const [msgs, setMsgs] = useState<ContactMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "replied" | "archived" | "spam">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/desk/contact");
    if (r.ok) setMsgs(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: ContactMsg["status"]) {
    setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, status } : m)));
    await fetch("/api/desk/contact", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, ...(status === "read" ? { read_at: new Date().toISOString() } : {}), ...(status === "replied" ? { replied_at: new Date().toISOString() } : {}) }),
    });
  }

  const visible = useMemo(() => {
    if (filter === "all") return msgs;
    return msgs.filter((m) => m.status === filter);
  }, [msgs, filter]);

  const counts = useMemo(() => {
    const c = { all: msgs.length, new: 0, replied: 0, archived: 0, spam: 0 };
    for (const m of msgs) {
      if (m.status === "new") c.new++;
      else if (m.status === "replied") c.replied++;
      else if (m.status === "archived") c.archived++;
      else if (m.status === "spam") c.spam++;
    }
    return c;
  }, [msgs]);

  if (loading) return <div className="text-[12px] text-zinc-500">Chargement…</div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Filtrer :</span>
        {(["all", "new", "replied", "archived", "spam"] as const).map((f) => {
          const labels = { all: "Tous", new: "Nouveaux", replied: "Répondus", archived: "Archivés", spam: "Spam" };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                active ? "border-violet-500/50 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {labels[f]} <span className="ml-1 text-[10.5px] text-zinc-500">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <Empty
          icon={Mail}
          title={filter === "all" ? "Aucun message" : "Aucun message dans cette catégorie"}
          description="Les messages reçus via /contact apparaîtront ici."
        />
      )}

      <div className="space-y-2">
        {visible.map((m) => {
          const isOpen = openId === m.id;
          const stColor = STATUS_COLOR[m.status];
          return (
            <DeskCard key={m.id} className={`!p-0 overflow-hidden ${m.status === "new" ? "border-violet-500/30" : ""}`}>
              <button
                onClick={() => {
                  setOpenId(isOpen ? null : m.id);
                  if (!isOpen && m.status === "new") setStatus(m.id, "read");
                }}
                className="flex w-full items-start gap-3 p-3 text-left hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-[14px] font-bold text-zinc-100">{m.subject}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${stColor}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                      {m.recipient}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[12px] text-zinc-400">
                    <span className="text-zinc-200">{m.sender_name}</span> · {m.sender_email}
                  </div>
                  {!isOpen && (
                    <div className="mt-1 line-clamp-1 text-[12px] text-zinc-500">{m.body.slice(0, 120)}</div>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10.5px] text-zinc-500">
                  {new Date(m.created_at).toLocaleDateString("fr-FR")}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/8 bg-black/20 p-4">
                  <div className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">{m.body}</div>
                  <div className="mb-3 flex flex-wrap gap-3 font-mono text-[10.5px] text-zinc-500">
                    {m.source_locale && <span>locale: {m.source_locale}</span>}
                    {m.source_ip && <span>IP: {m.source_ip}</span>}
                    {m.user_agent && <span title={m.user_agent}>UA: {m.user_agent.slice(0, 30)}…</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`mailto:${m.sender_email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                      onClick={() => setStatus(m.id, "replied")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25"
                    >
                      <Reply className="size-3" /> Répondre par mail
                    </a>
                    <button
                      onClick={() => setStatus(m.id, "archived")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    >
                      <Archive className="size-3" /> Archiver
                    </button>
                    <button
                      onClick={() => setStatus(m.id, "spam")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-200 hover:bg-rose-500/20"
                    >
                      <AlertOctagon className="size-3" /> Spam
                    </button>
                  </div>
                </div>
              )}
            </DeskCard>
          );
        })}
      </div>
    </div>
  );
}
