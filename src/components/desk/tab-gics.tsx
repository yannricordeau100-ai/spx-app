"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Library } from "lucide-react";
import { GICS, countAll, searchGics } from "@/lib/desk/gics";
import { DeskCard, HelpTip, Input, Pill } from "./ui";
import { ArbreGics } from "./arbre-gics";

export function TabGics() {
  const counts = useMemo(() => countAll(), []);
  const [query, setQuery] = useState("");
  // Yann 4 sept 2026 : vue arborescente, pour voir la structure entiere ou
  // seulement les secteurs choisis.
  const [vue, setVue] = useState<"arbre" | "recherche">("arbre");
  const [selectedSector, setSelectedSector] = useState<string | null>(GICS[0]?.code ?? null);

  const searchResults = useMemo(() => searchGics(query), [query]);
  const sector = GICS.find((s) => s.code === selectedSector);

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Taxonomie GICS</span>
          <HelpTip>
            <strong>GICS</strong> (Global Industry Classification Standard) est la nomenclature mondiale de référence pour classer les sociétés cotées. Elle hiérarchise en 4 niveaux : <strong>secteur</strong> (le plus large) → <strong>groupe d'industries</strong> → <strong>industrie</strong> → <strong>sous-industrie</strong>. Maintenue par MSCI + S&P. C'est ce que tous les outils financiers (Bloomberg, Refinitiv, Stripe Tax, etc.) utilisent.
          </HelpTip>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] text-zinc-400">
          <span><strong className="font-mono text-zinc-100">{counts.sectors}</strong> secteurs</span>
          <span><strong className="font-mono text-zinc-100">{counts.groups}</strong> groupes</span>
          <span><strong className="font-mono text-zinc-100">{counts.industries}</strong> industries</span>
          <span><strong className="font-mono text-zinc-100">{counts.subs}</strong> sous-industries</span>
        </div>
      </DeskCard>

      {/* Yann 4 sept 2026 : deux facons de lire la meme nomenclature.
          L arbre pour voir la structure, la recherche pour retrouver un
          libelle precis. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {(["arbre", "recherche"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                vue === v ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {v === "arbre" ? "Arbre" : "Recherche"}
            </button>
          ))}
        </div>
        {vue === "recherche" && (
          <>
            <Search className="size-4 text-zinc-500" />
            <Input placeholder="Rechercher (ex : 'tech', 'aérospatiale', '15101010')" value={query} onChange={(e) => setQuery(e.target.value)} />
          </>
        )}
      </div>

      {vue === "arbre" && <ArbreGics />}

      {vue === "recherche" && query && (
        <DeskCard className="mb-4">
          <div className="mb-2 text-[12px] font-medium text-zinc-300">{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {searchResults.slice(0, 50).map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.04]">
                <Pill color="violet">{r.sub?.code ?? r.industry?.code ?? r.group?.code ?? r.sector.code}</Pill>
                <span className="text-zinc-200">{r.sub?.name ?? r.industry?.name ?? r.group?.name ?? r.sector.name}</span>
                <span className="ml-auto text-[10.5px] text-zinc-500">
                  {r.sector.name}{r.group ? ` / ${r.group.name}` : ""}{r.industry ? ` / ${r.industry.name}` : ""}
                </span>
              </div>
            ))}
            {searchResults.length > 50 && <div className="text-[11px] text-zinc-500">… {searchResults.length - 50} autres masqués</div>}
          </div>
        </DeskCard>
      )}

      {vue === "recherche" && (
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sectors list */}
        <div className="space-y-1">
          {GICS.map((s) => (
            <button
              key={s.code}
              onClick={() => setSelectedSector(s.code)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                selectedSector === s.code ? "bg-violet-500/15 text-violet-100" : "text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              <Pill color={selectedSector === s.code ? "violet" : "zinc"}>{s.code}</Pill>
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-[10.5px] text-zinc-500">{s.groups.length}g</span>
            </button>
          ))}
        </div>

        {/* Sector detail */}
        {sector && (
          <DeskCard>
            <div className="mb-3">
              <div className="font-display text-[16px] font-bold text-zinc-50">
                {sector.name}
              </div>
              <div className="text-[11.5px] italic text-zinc-500">{sector.nameEn} · code GICS {sector.code}</div>
            </div>
            <div className="space-y-3">
              {sector.groups.map((g) => (
                <div key={g.code} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-baseline gap-2">
                    <Pill color="cyan">{g.code}</Pill>
                    <span className="text-[13px] font-semibold text-zinc-100">{g.name}</span>
                  </div>
                  <div className="space-y-1.5 pl-3">
                    {g.industries.map((i) => (
                      <div key={i.code}>
                        <div className="flex items-center gap-2 text-[12.5px] text-zinc-200">
                          <ChevronRight className="size-3 text-zinc-600" />
                          <span className="font-mono text-[10.5px] text-zinc-500">{i.code}</span>
                          <span className="font-medium">{i.name}</span>
                        </div>
                        <div className="ml-5 mt-0.5 flex flex-wrap gap-1">
                          {i.subs.map((sub) => (
                            <span key={sub.code} className="rounded-sm border border-white/10 bg-white/[0.02] px-1.5 py-0.5 text-[10.5px] text-zinc-400">
                              <span className="font-mono text-zinc-600">{sub.code}</span> {sub.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DeskCard>
        )}
      </div>
      )}
    </div>
  );
}
