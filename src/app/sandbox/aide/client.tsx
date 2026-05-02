"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, ExternalLink, AlertTriangle, AlertCircle, Info, Copy, Check } from "lucide-react";
import type { HelpURL, HelpProblem } from "./help-data";

const SEVERITY_STYLE = {
  critical: { icon: AlertTriangle, color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  warning:  { icon: AlertCircle,   color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  info:     { icon: Info,          color: "text-cyan-300",  bg: "bg-cyan-500/10",  border: "border-cyan-500/30" },
} as const;

const CONTEXT_LABEL: Record<HelpProblem["context"], string> = {
  front: "Site public",
  "back-office": "Desk interne",
  deploy: "Déploiement",
  data: "Données",
  auth: "Connexion",
  general: "Général",
};

const CATEGORY_LABEL: Record<HelpURL["category"], string> = {
  url: "URL",
  github: "GitHub",
  vercel: "Vercel",
  supabase: "Supabase",
  spaceship: "Domaine",
  stripe: "Stripe",
};

/**
 * Recherche fuzzy sur title, symptoms, aliases, solution.
 * Retourne 0 (no match), ou un score (plus haut = mieux).
 */
function matchProblem(p: HelpProblem, query: string): number {
  if (!query.trim()) return 1;
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const haystack = [
    p.title,
    p.cause,
    ...p.symptoms,
    ...p.solution,
    ...p.aliases,
    CONTEXT_LABEL[p.context],
  ].join(" ").toLowerCase();
  for (const tok of tokens) {
    if (haystack.includes(tok)) score += 1;
    if (p.aliases.some((a) => a.toLowerCase().includes(tok))) score += 2;
    if (p.title.toLowerCase().includes(tok)) score += 3;
  }
  return score;
}

function matchURL(u: HelpURL, query: string): number {
  if (!query.trim()) return 1;
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const haystack = [u.label, u.description, ...u.aliases, CATEGORY_LABEL[u.category]]
    .join(" ").toLowerCase();
  for (const tok of tokens) {
    if (haystack.includes(tok)) score += 1;
    if (u.label.toLowerCase().includes(tok)) score += 2;
    if (u.aliases.some((a) => a.toLowerCase().includes(tok))) score += 2;
  }
  return score;
}

export function AideClient({ urls, problems }: { urls: HelpURL[]; problems: HelpProblem[] }) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredURLs = useMemo(() => {
    return urls
      .map((u) => ({ u, score: matchURL(u, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.u);
  }, [urls, query]);

  const filteredProblems = useMemo(() => {
    return problems
      .map((p) => ({ p, score: matchProblem(p, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [problems, query]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/sandbox"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour Sandbox
        </Link>

        <div className="mb-2 flex items-baseline gap-3">
          <h1 className="font-display text-[32px] font-bold tracking-tight">Aide & dépannage</h1>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
            FR · perso
          </span>
        </div>
        <p className="mb-6 max-w-3xl text-[14px] text-zinc-400">
          URLs canoniques + fiches problèmes. Tape un mot-clé (ex: <em>rollback</em>, <em>maintenance</em>,
          <em> 404</em>, <em>todo</em>, <em>dns</em>) pour filtrer.
        </p>

        {/* Search */}
        <div className="sticky top-0 z-10 mb-6 -mx-6 bg-[#050507]/95 px-6 py-3 backdrop-blur-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tape un mot (ex : rollback, maintenance, dns, login fail, todo, V2.5)..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-[14px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-400/50 focus:bg-white/[0.05]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 hover:text-zinc-200"
              >
                effacer
              </button>
            )}
          </div>
          {query && (
            <div className="mt-2 text-[11px] text-zinc-500">
              {filteredURLs.length} URL · {filteredProblems.length} fiche{filteredProblems.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* URLs */}
        {filteredURLs.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              URLs ({filteredURLs.length})
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredURLs.map((u) => (
                <div
                  key={u.url}
                  className="group flex flex-col rounded-lg border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/15"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-display text-[13.5px] font-bold text-zinc-100">{u.label}</span>
                    <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                      {CATEGORY_LABEL[u.category]}
                    </span>
                  </div>
                  <p className="mb-2 text-[12px] leading-relaxed text-zinc-400">{u.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 truncate rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[11px] text-violet-200 transition-colors hover:bg-violet-500/20"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{u.url.replace(/^https?:\/\//, "")}</span>
                    </a>
                    <button
                      onClick={() => copy(u.url, u.url)}
                      title="Copier l'URL"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-white/25 hover:text-zinc-200"
                    >
                      {copiedId === u.url ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      copier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Problèmes */}
        {filteredProblems.length > 0 && (
          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Fiches problèmes ({filteredProblems.length})
            </h2>
            <div className="space-y-3">
              {filteredProblems.map((p) => {
                const sev = SEVERITY_STYLE[p.severity];
                const Icon = sev.icon;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border ${sev.border} ${sev.bg} p-4`}
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <Icon className={`size-4 shrink-0 ${sev.color}`} />
                        <h3 className={`font-display text-[15px] font-bold ${sev.color}`}>{p.title}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                        {CONTEXT_LABEL[p.context]}
                      </span>
                    </div>

                    {p.symptoms.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          Comment ça se manifeste
                        </div>
                        <ul className="space-y-0.5 pl-4 text-[12.5px] text-zinc-300">
                          {p.symptoms.map((s, i) => (
                            <li key={i} className="list-disc text-zinc-300">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        Pourquoi
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-zinc-300">{p.cause}</p>
                    </div>

                    <div>
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        Comment résoudre
                      </div>
                      <ol className="space-y-1 pl-4 text-[12.5px] text-zinc-200">
                        {p.solution.map((s, i) => (
                          <li key={i} className="leading-relaxed">{s}</li>
                        ))}
                      </ol>
                    </div>

                    {p.aliases.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-white/8 pt-2">
                        {p.aliases.slice(0, 8).map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[9.5px] text-zinc-500"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {filteredURLs.length === 0 && filteredProblems.length === 0 && query && (
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-8 text-center">
            <p className="text-[14px] text-zinc-400">
              Rien trouvé pour <strong className="text-zinc-200">{query}</strong>.
            </p>
            <p className="mt-2 text-[12px] text-zinc-500">
              Essaye un autre mot-clé, ou ping-moi (Claude) si ton problème n'est pas couvert.
            </p>
          </div>
        )}

        {!query && (
          <p className="mt-10 text-center text-[11px] text-zinc-600">
            Cette page évolue. Quand un nouveau problème survient, je l'ajoute ici avec ses alias.
          </p>
        )}
      </div>
    </div>
  );
}
