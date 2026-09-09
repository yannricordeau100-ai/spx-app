"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import indexData from "@/data/sandbox-blocks-index.json";

type SearchEntry = {
  url: string;
  title: string;
  description: string;
  keywords?: string[];
};

const STATIQUES: SearchEntry[] = (indexData as { entries: SearchEntry[] }).entries;

/** Fusion index statique + entrees derivees de la page (les dynamiques
 *  priment sur l URL : la recherche couvre ainsi tout ce qui est affiche,
 *  meme ajoute apres la creation de l index). */
function fusionner(dynamiques: SearchEntry[]): SearchEntry[] {
  const parUrl = new Map<string, SearchEntry>();
  for (const e of STATIQUES) parUrl.set(e.url, e);
  for (const e of dynamiques) parUrl.set(e.url, { ...parUrl.get(e.url), ...e });
  return [...parUrl.values()];
}

/**
 * Recherche intelligente dans le sandbox. Monté en haut de /sandbox + ouverture
 * via cmd+K (mac) / ctrl+K. Fuse.js scoring sur title / description / keywords.
 * Top 5 résultats dans un dropdown sous l'input.
 */
export function SandboxSearch({ entreesDynamiques = [] }: { entreesDynamiques?: SearchEntry[] }) {
  const ENTRIES = useMemo(() => fusionner(entreesDynamiques), [entreesDynamiques]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fuse = useMemo(
    () =>
      new Fuse(ENTRIES, {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "keywords", weight: 0.35 },
          { name: "description", weight: 0.15 },
        ],
        // 9 sept 2026 : seuil plus tolerant, une paraphrase doit suffire.
        threshold: 0.55,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [ENTRIES],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const flous = fuse.search(q).map((r) => r.item);
    // 9 sept 2026 : complement par recouvrement de mots (paraphrases) : chaque
    // mot de la requete (3 lettres et plus) present dans titre, mots cles ou
    // descriptif compte ; les entrees qui en ont le plus remontent.
    const normaliser = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mots = normaliser(q).split(/[^a-z0-9]+/).filter((m) => m.length >= 3);
    const score = (e: SearchEntry) => {
      const texte = normaliser(`${e.title} ${e.description} ${(e.keywords ?? []).join(" ")}`);
      return mots.filter((m) => texte.includes(m)).length;
    };
    const parMots = mots.length > 0 ? ENTRIES.filter((e) => score(e) > 0).sort((a, b) => score(b) - score(a)) : [];
    const vus = new Set<string>();
    const fusion: SearchEntry[] = [];
    for (const e of [...flous, ...parMots]) {
      if (vus.has(e.url)) continue;
      vus.add(e.url);
      fusion.push(e);
    }
    return fusion.slice(0, 8);
  }, [query, fuse, ENTRIES]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // cmd+K / ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function selectResult(item: SearchEntry) {
    setOpen(false);
    setQuery("");
    router.push(item.url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlight];
      if (item) selectResult(item);
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Recherche dans le sandbox… (cmd+K)"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-20 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          ⌘K
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-2xl">
          {results.map((item, idx) => (
            <button
              key={`${item.url}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectResult(item);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`block w-full border-b border-white/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 ${
                idx === highlight ? "bg-violet-500/10" : "bg-transparent hover:bg-white/[0.03]"
              }`}
            >
              <div className="text-[13.5px] font-semibold text-zinc-100">{item.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[12px] text-zinc-400">
                {item.description}
              </div>
              <div className="mt-1 font-mono text-[10.5px] text-zinc-600">{item.url}</div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-3 text-[12.5px] text-zinc-500 shadow-2xl">
          Aucun résultat pour <span className="font-mono text-zinc-400">{query}</span>.
        </div>
      )}
    </div>
  );
}
