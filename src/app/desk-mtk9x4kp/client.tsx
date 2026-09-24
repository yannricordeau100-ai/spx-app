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

/**
 * AdminPanelReminder : petit rappel informatif (remplace l'ancienne SimulateTierBar).
 * Visible uniquement en niveau 1/2/3, caché en niveau 0 (prod).
 * Renvoie vers le panel admin floating bottom-right qui contient les vrais switches.
 */
function AdminPanelReminder() {
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) setLevel(3);
    else if (h === "mettrik.ai" || h === "www.mettrik.ai") setLevel(0);
    else if (h.startsWith("mettrik-niveau1") || h.startsWith("niveau1.")) setLevel(1);
    else if (h.endsWith(".vercel.app")) setLevel(2);
    else setLevel(0);
  }, []);
  if (level === 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/[0.05] px-3 py-2 text-[12px] leading-relaxed text-violet-100/90">
      💡 Le panel admin (bottom-right de l&apos;app) permet de switcher entre tier simulé
      (Anonyme / Gratuit / Premium / Max), version de l&apos;app (V1.7.5 / V1.8) et niveau d&apos;infra (1 / 2).
    </div>
  );
}
import {
  FileText, ListTodo, Library, FolderOpen, Calendar, Bookmark, Cpu, Lightbulb,
  Link as LinkIcon, ImageIcon, BarChart3, MessageSquare, Target, Map, Info, Gift,
  PanelLeftClose, PanelLeftOpen, Mail, ClipboardList,
} from "lucide-react";
import { TabNotes } from "@/components/desk/tab-notes";
import { TabTodos } from "@/components/desk/tab-todos";
import { TabGics } from "@/components/desk/tab-gics";
import { TabPipeline } from "@/components/desk/tab-pipeline";
import { TabIdeas } from "@/components/desk/tab-ideas";
import { TabReferrals } from "@/components/desk/tab-referrals";
import { TabRoadmap } from "@/components/desk/tab-roadmap";
import { TabTaches } from "@/components/desk/tab-taches";

type TabId =
  | "notes" | "todos" | "roadmap"
  | "documents" | "gics" | "pipeline"
  | "calendar" | "bookmarks" | "links"
  | "drafts" | "pitch"
  | "inspiration" | "ideas" | "metrics"
  | "referrals" | "messages" | "taches";

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
      { id: "taches",  label: "Grandes tâches", Icon: ClipboardList, hint: "Chantiers commencés et restant à finir : ETA, modèle, réglages, état par société" },
      { id: "roadmap", label: "Roadmap launch", Icon: Map,      hint: "Tout ce qu'il reste à faire pour sortir l'app, trié par priorité" },
    ],
  },
  {
    label: "Production data",
    hint: "Sources, taxonomie, pipeline V2",
    items: [
      { id: "gics",      label: "Taxonomie GICS", Icon: Library, hint: "11 secteurs, 25 groupes, 74 industries, 163 sous-industries" },
      { id: "pipeline",  label: "Pipeline V2", Icon: Cpu,        hint: "Sociétés à scraper (USA, CA, EU, JP)" },
    ],
  },
  {
    label: "Stratégie & com",
    hint: "Pour toi seul",
    items: [
      { id: "ideas",  label: "Idées Mettrik", Icon: Lightbulb,    hint: "Carnet d'idées par catégorie + statut" },
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
  // Yann 4 sept 2026 : l onglet se lit dans l URL (?tab=gics) pour pouvoir
  // donner un lien direct vers chaque outil du desk.
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "todos";
    const voulu = new URLSearchParams(window.location.search).get("tab");
    const connus = SECTIONS.flatMap((sec) => sec.items.map((i) => i.id));
    return voulu && (connus as string[]).includes(voulu) ? (voulu as TabId) : "todos";
  });
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
            {/* Yann 20 mai 2026 : retour rapide vers sandbox (hub V1.8 /
                V1.7.5 / V1.9 + outils admin). Évite de retaper l'URL. */}
            <a
              href="/sandbox"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-violet-400/50 hover:bg-violet-500/[0.08] hover:text-violet-100"
              aria-label="Retour au sandbox"
            >
              <span aria-hidden="true">←</span>
              <span>Retour sandbox</span>
            </a>
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
            {/* Rappel informatif : le panel admin (bottom-right) remplace l'ancienne SimulateTierBar */}
            <AdminPanelReminder />

            {/* PERF : keep-alive lazy mount.
                Chaque tab visité reste monté en mémoire (cache local) puis caché
                via CSS quand on en change. 1er click sur un tab = fetch normal,
                clicks suivants sur le même tab = instantané (data déjà en RAM).
                Coût mémoire négligeable (quelques KB par tab). */}
            <KeepAlive active={tab} id="notes"><TabNotes ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="todos"><TabTodos ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="taches"><TabTaches /></KeepAlive>
            <KeepAlive active={tab} id="roadmap"><TabRoadmap /></KeepAlive>
            <KeepAlive active={tab} id="gics"><TabGics /></KeepAlive>
            <KeepAlive active={tab} id="pipeline"><TabPipeline /></KeepAlive>
            <KeepAlive active={tab} id="ideas"><TabIdeas ownerEmail={ownerEmail} /></KeepAlive>
            <KeepAlive active={tab} id="referrals"><TabReferrals /></KeepAlive>
          </div>
        </main>
      </div>
    </div>
  );
}
