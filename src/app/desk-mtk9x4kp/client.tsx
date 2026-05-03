"use client";

import { useEffect, useRef, useState } from "react";

/**
 * KeepAlive : monte le composant au 1er affichage actif, puis le garde en
 * mémoire (display:none) quand on change de tab. Évite le re-fetch des
 * données BDD à chaque switch d'onglet. Premier mount = fetch normal,
 * mounts suivants = instantané (data déjà en RAM).
 */
function KeepAlive({ active, id, children }: { active: string; id: string; children: React.ReactNode }) {
  const wasActive = useRef(false);
  const isActive = active === id;
  if (isActive) wasActive.current = true;
  if (!wasActive.current) return null; // pas encore visité, pas monté
  return <div style={{ display: isActive ? "block" : "none" }}>{children}</div>;
}
import {
  FileText, ListTodo, Library, FolderOpen, Calendar, Bookmark, Cpu, Lightbulb,
  Link as LinkIcon, ImageIcon, BarChart3, MessageSquare, Target, Map, Info, Gift,
  PanelLeftClose, PanelLeftOpen,
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
import { TabReferrals } from "@/components/desk/tab-referrals";
import { TabDrafts } from "@/components/desk/tab-drafts";
import { TabPitch } from "@/components/desk/tab-pitch";
import { TabRoadmap } from "@/components/desk/tab-roadmap";

type TabId =
  | "notes" | "todos" | "roadmap"
  | "documents" | "gics" | "pipeline"
  | "calendar" | "bookmarks" | "links"
  | "drafts" | "pitch"
  | "inspiration" | "ideas" | "metrics"
  | "referrals";

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
      { id: "links",       label: "Quick links",   Icon: LinkIcon,    hint: "Stripe, GitHub, dashboards techniques" },
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
  {
    label: "Croissance",
    hint: "Programmes user growth",
    items: [
      { id: "referrals", label: "Parrainage", Icon: Gift, hint: "Paramètres du programme de parrainage (page /parrainage publique)" },
    ],
  },
];

const ALL_TABS = SECTIONS.flatMap((s) => s.items);

export function DeskClient({ ownerEmail }: { ownerEmail: string }) {
  const [tab, setTab] = useState<TabId>("todos");
  // Persistance UI : sidebar collapse mémorisé en localStorage entre visites.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mettrik.desk.sidebar.v1");
      if (saved === "closed") setSidebarOpen(false);
    } catch {}
  }, []);
  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem("mettrik.desk.sidebar.v1", next ? "open" : "closed"); } catch {}
      return next;
    });
  }
  const current = ALL_TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="flex">
        {/* SIDEBAR (collapsible) */}
        <aside
          className={`sticky top-0 h-screen shrink-0 overflow-hidden border-r border-white/8 bg-[#08080b]/95 backdrop-blur transition-[width] duration-200 ease-out ${
            sidebarOpen ? "w-64" : "w-0"
          }`}
          aria-hidden={!sidebarOpen}
        >
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
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                title={sidebarOpen ? "Cacher le menu" : "Afficher le menu"}
                aria-label={sidebarOpen ? "Cacher le menu" : "Afficher le menu"}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
              >
                {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">
                  {current?.label ?? "Desk"}
                </h1>
                {current?.hint && (
                  <p className="text-[12.5px] text-zinc-400">{current.hint}</p>
                )}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-5xl p-6">
            {/* PERF : keep-alive lazy mount.
                Chaque tab visité reste monté en mémoire (cache local) puis caché
                via CSS quand on en change. 1er click sur un tab = fetch normal,
                clicks suivants sur le même tab = instantané (data déjà en RAM).
                Coût mémoire négligeable (quelques KB par tab). */}
            <KeepAlive active={tab} id="notes"><TabNotes ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="todos"><TabTodos ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="roadmap"><TabRoadmap /></KeepAlive>
            <KeepAlive active={tab} id="documents"><TabDocuments /></KeepAlive>
            <KeepAlive active={tab} id="gics"><TabGics /></KeepAlive>
            <KeepAlive active={tab} id="pipeline"><TabPipeline /></KeepAlive>
            <KeepAlive active={tab} id="calendar"><TabCalendar ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="bookmarks"><TabBookmarks ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="links"><TabLinks ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="inspiration"><TabInspiration ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="ideas"><TabIdeas ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="drafts"><TabDrafts ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="pitch"><TabPitch ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="metrics"><TabMetrics /></KeepAlive>
            <KeepAlive active={tab} id="referrals"><TabReferrals /></KeepAlive>
          </div>
        </main>
      </div>
    </div>
  );
}
