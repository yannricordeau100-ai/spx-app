"use client";

import { useState } from "react";
import {
  FileText, ListTodo, Library, FolderOpen, Calendar, Bookmark, Cpu, Lightbulb,
  Link as LinkIcon, ImageIcon, BarChart3, MessageSquare, Target, Map, Info,
} from "lucide-react";
import { TabNotes } from "@/components/desk/tab-notes";
import { TabTodos } from "@/components/desk/tab-todos";
import { TabGics } from "@/components/desk/tab-gics";
import { TabDocuments } from "@/components/desk/tab-documents";
import { TabCalendar } from "@/components/desk/tab-calendar";
import { TabBookmarks } from "@/components/desk/tab-bookmarks";
import { TabPipeline } from "@/components/desk/tab-pipeline";
import { TabIdeas } from "@/components/desk/tab-ideas";
import { TabLinks } from "@/components/desk/tab-links";
import { TabInspiration } from "@/components/desk/tab-inspiration";
import { TabMetrics } from "@/components/desk/tab-metrics";
import { TabDrafts } from "@/components/desk/tab-drafts";
import { TabPitch } from "@/components/desk/tab-pitch";
import { TabRoadmap } from "@/components/desk/tab-roadmap";

type TabId =
  | "notes" | "todos" | "roadmap"
  | "documents" | "gics" | "pipeline"
  | "calendar" | "bookmarks" | "links"
  | "drafts" | "pitch"
  | "inspiration" | "ideas" | "metrics";

type TabSection = {
  label: string;
  hint: string;
  items: { id: TabId; label: string; Icon: typeof FileText; hint: string }[];
};

const SECTIONS: TabSection[] = [
  {
    label: "Quotidien",
    hint: "Tes outils de tous les jours",
    items: [
      { id: "todos",   label: "To-do",          Icon: ListTodo, hint: "Tâches avec priorité et projet" },
      { id: "notes",   label: "Notes",          Icon: FileText, hint: "Notes markdown rangées par tag" },
      { id: "roadmap", label: "Roadmap launch", Icon: Map,      hint: "Tout ce qu'il reste à faire pour sortir l'app, trié par priorité" },
    ],
  },
  {
    label: "Production data",
    hint: "Sources, taxonomie, pipeline V2",
    items: [
      { id: "documents", label: "Documents",   Icon: FolderOpen, hint: "PDFs scannés du dossier 10-K Desktop" },
      { id: "gics",      label: "Taxonomie GICS", Icon: Library, hint: "11 secteurs, 25 groupes, 74 industries, 163 sous-industries" },
      { id: "pipeline",  label: "Pipeline V2", Icon: Cpu,        hint: "Sociétés à scraper (USA, CA, EU, JP)" },
    ],
  },
  {
    label: "Veille & inspiration",
    hint: "Externe au projet",
    items: [
      { id: "calendar",    label: "Calendrier",    Icon: Calendar,    hint: "Earnings, AGM, conférences sectorielles" },
      { id: "bookmarks",   label: "Bookmarks",     Icon: Bookmark,    hint: "Articles, vidéos, ressources tagguées" },
      { id: "links",       label: "Quick links",   Icon: LinkIcon,    hint: "Stripe, Supabase, GitHub, dashboards" },
      { id: "inspiration", label: "Galerie inspi", Icon: ImageIcon,   hint: "Screenshots de visuels qui t'inspirent" },
    ],
  },
  {
    label: "Stratégie & com",
    hint: "Pour toi seul",
    items: [
      { id: "ideas",  label: "Idées Mettrik", Icon: Lightbulb,    hint: "Carnet d'idées par catégorie + statut" },
      { id: "drafts", label: "Brouillons com", Icon: MessageSquare, hint: "Newsletters, posts LinkedIn avant envoi" },
      { id: "pitch",  label: "Mémo pitch",    Icon: Target,       hint: "Notes investisseurs (cloisonné des autres notes)" },
    ],
  },
  {
    label: "Analytics",
    hint: "À câbler en V2",
    items: [
      { id: "metrics", label: "Métriques app", Icon: BarChart3, hint: "Visiteurs, MRR, churn (placeholder)" },
    ],
  },
];

const ALL_TABS = SECTIONS.flatMap((s) => s.items);

export function DeskClient({ ownerEmail }: { ownerEmail: string }) {
  const [tab, setTab] = useState<TabId>("todos");
  const current = ALL_TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="sticky top-0 h-screen w-64 shrink-0 overflow-y-auto border-r border-white/8 bg-[#08080b]/95 backdrop-blur">
          <div className="border-b border-white/8 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[18px] font-bold tracking-tight text-zinc-50">
                Desk
              </span>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
                interne
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[10.5px] text-zinc-500">
              {ownerEmail}
            </div>
          </div>

          <nav className="space-y-5 p-3">
            {SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        title={item.hint}
                        className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                          isActive
                            ? "bg-violet-500/15 text-violet-100"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                        }`}
                      >
                        <item.Icon className={`size-4 shrink-0 ${isActive ? "text-violet-300" : ""}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/8 p-3 text-[10.5px] text-zinc-500">
            <div className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0" />
              <p className="leading-snug">
                Ce desk est isolé de l'app publique. URL secrète, gate par email.
                Aucune donnée ne fuit vers /<code>ticker</code>.
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/8 bg-[#050507]/85 px-6 py-3.5 backdrop-blur">
            <div className="flex items-baseline gap-2">
              <h1 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">
                {current?.label ?? "Desk"}
              </h1>
              {current?.hint && (
                <p className="text-[12.5px] text-zinc-400">{current.hint}</p>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-5xl p-6">
            {tab === "notes" && <TabNotes ownerEmail={ownerEmail} />}
            {tab === "todos" && <TabTodos ownerEmail={ownerEmail} />}
            {tab === "roadmap" && <TabRoadmap />}
            {tab === "documents" && <TabDocuments />}
            {tab === "gics" && <TabGics />}
            {tab === "pipeline" && <TabPipeline />}
            {tab === "calendar" && <TabCalendar ownerEmail={ownerEmail} />}
            {tab === "bookmarks" && <TabBookmarks ownerEmail={ownerEmail} />}
            {tab === "links" && <TabLinks ownerEmail={ownerEmail} />}
            {tab === "inspiration" && <TabInspiration ownerEmail={ownerEmail} />}
            {tab === "ideas" && <TabIdeas ownerEmail={ownerEmail} />}
            {tab === "drafts" && <TabDrafts ownerEmail={ownerEmail} />}
            {tab === "pitch" && <TabPitch ownerEmail={ownerEmail} />}
            {tab === "metrics" && <TabMetrics />}
          </div>
        </main>
      </div>
    </div>
  );
}
