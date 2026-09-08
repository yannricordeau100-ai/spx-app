"use client";

/**
 * Atelier Moat Morningstar (/sandbox/moat), 07 sept 2026.
 *
 * Toutes les notes du Cahier (docs/cahier/moat.json) lisibles d un coup d oeil :
 *  - resume en tete (repartition Wide / Narrow / None, changements recents),
 *  - filtres par note, par allocation, changements de note seulement,
 *  - recherche ticker ou nom,
 *  - meme arborescence depliable par secteur GICS que les autres ateliers,
 *    avec une ligne claire par societe (badges colores, changement de note,
 *    allocation, incertitude, etoiles, lien fiche et lien Morningstar).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Search, Star } from "lucide-react";
import { GICS } from "@/lib/desk/gics";

export type MoatEntree = {
  moat: "Wide" | "Narrow" | "None" | null;
  moat_precedent?: string | null;
  moat_depuis?: string | null;
  quantitatif?: boolean;
  allocation_capital?: string | null;
  incertitude?: string | null;
  etoiles?: number | null;
  chemin?: string | null;
  commentaire?: string;
};

const MOAT_STYLE: Record<string, string> = {
  Wide: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
  Narrow: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  None: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
};

const ALLOC_STYLE: Record<string, string> = {
  Exemplary: "text-emerald-200",
  Standard: "text-zinc-300",
  Poor: "text-rose-300",
};

const INCERT_STYLE: Record<string, string> = {
  Low: "text-emerald-200",
  Medium: "text-zinc-300",
  High: "text-amber-200",
  "Very High": "text-rose-300",
  Extreme: "text-rose-300",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function secteurDe(code: string | undefined): { code: string; name: string } | null {
  if (!code) return null;
  const s = GICS.find((x) => code.startsWith(x.code));
  return s ? { code: s.code, name: s.name } : null;
}

export type MettrikTendance = {
  tendance_mettrik: "hausse" | "stable" | "baisse";
  justification_mettrik: string;
  confiance?: "haute" | "moyenne" | "faible";
  date?: string;
};

const MK_STYLE: Record<string, { cls: string; fleche: string; label: string }> = {
  hausse: { cls: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100", fleche: "↑", label: "en amélioration" },
  stable: { cls: "border-white/15 bg-white/[0.05] text-zinc-300", fleche: "=", label: "stable" },
  baisse: { cls: "border-rose-400/50 bg-rose-500/15 text-rose-100", fleche: "↓", label: "en dégradation" },
};

/** 8 sept 2026 : pastille « évaluation Mettrik » (tendance du moat), pas Morningstar. */
function PastilleMettrik({ e }: { e?: MettrikTendance }) {
  if (!e) return <span className="rounded-full border border-dashed border-white/15 px-2 py-px font-mono text-[10px] uppercase tracking-wider text-zinc-600" title="Évaluation Mettrik non encore produite">Mettrik : à venir</span>;
  const st = MK_STYLE[e.tendance_mettrik] ?? MK_STYLE.stable;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-px font-mono text-[10.5px] uppercase tracking-wider ${st.cls}`} title={`Évaluation Mettrik (pas Morningstar)${e.confiance ? `, confiance ${e.confiance}` : ""} : ${e.justification_mettrik}`}>
      <span className="text-[9px] text-zinc-400">Mettrik</span> {st.fleche} {st.label}
    </span>
  );
}

export function MoatAtelier({
  societes,
  gics,
  noms,
  mettrik = {},
}: {
  societes: Record<string, MoatEntree>;
  gics: Record<string, string>;
  noms: Record<string, string>;
  /** 8 sept 2026 : evaluation Mettrik de la tendance du moat, par ticker. */
  mettrik?: Record<string, MettrikTendance>;
}) {
  const [filtre, setFiltre] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [changesSeuls, setChangesSeuls] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const lignes = useMemo(
    () =>
      Object.entries(societes)
        .map(([t, m]) => ({ t: t.toUpperCase(), m, secteur: secteurDe(gics[t]) }))
        .sort((a, b) => a.t.localeCompare(b.t)),
    [societes, gics],
  );

  const stats = useMemo(() => {
    const c = { Wide: 0, Narrow: 0, None: 0, sans: 0, quant: 0, changes2026: 0 };
    for (const { m } of lignes) {
      if (!m.moat) c.sans += 1;
      else c[m.moat] += 1;
      if (m.quantitatif) c.quant += 1;
      if ((m.moat_depuis || "") >= "2026-01-01") c.changes2026 += 1;
    }
    return c;
  }, [lignes]);

  const q = filtre.trim().toLowerCase();
  const passe = (t: string, m: MoatEntree) => {
    if (q && !t.toLowerCase().includes(q) && !(noms[t] ?? "").toLowerCase().includes(q)) return false;
    if (notes.length && !notes.includes(m.moat ?? "sans")) return false;
    if (changesSeuls && !((m.moat_depuis || "") >= "2026-01-01")) return false;
    return true;
  };

  const bascule = (cle: string) =>
    setOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const resume: { cle: string; label: string; n: number; cls: string }[] = [
    { cle: "Wide", label: "Wide (avantage large)", n: stats.Wide, cls: MOAT_STYLE.Wide! },
    { cle: "Narrow", label: "Narrow (avantage étroit)", n: stats.Narrow, cls: MOAT_STYLE.Narrow! },
    { cle: "None", label: "None (sans avantage)", n: stats.None, cls: MOAT_STYLE.None! },
    { cle: "sans", label: "Non notées (radiées)", n: stats.sans, cls: "border-rose-400/40 bg-rose-500/10 text-rose-200" },
  ];

  return (
    <div>
      {/* Resume + filtres par note (cliquer une pastille filtre) */}
      <div className="flex flex-wrap items-center gap-2">
        {resume.map((r) => (
          <button
            key={r.cle}
            onClick={() => setNotes((p) => (p.includes(r.cle) ? p.filter((x) => x !== r.cle) : [...p, r.cle]))}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition-opacity ${r.cls} ${notes.length && !notes.includes(r.cle) ? "opacity-40" : ""}`}
          >
            {r.label} <span className="ml-1 font-mono text-[12px] font-bold">{r.n}</span>
          </button>
        ))}
        <button
          onClick={() => setChangesSeuls((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-[13px] ${changesSeuls ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
        >
          Notes changées en 2026 <span className="ml-1 font-mono text-[12px] font-bold">{stats.changes2026}</span>
        </button>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">{stats.quant} en notation quantitative (sans allocation ni étoiles)</span>
      </div>

      <div className="relative mt-3 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Ticker ou nom (ex. AAPL, Nvidia)…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
        />
      </div>

      {/* Arborescence par secteur GICS */}
      <div className="mt-4 space-y-1.5">
        {GICS.map((s) => {
          const stes = lignes.filter((l) => l.secteur?.code === s.code && passe(l.t, l.m));
          if (stes.length === 0) return null;
          const ouvert = ouverts.has(s.code) || !!q || notes.length > 0 || changesSeuls;
          const wide = stes.filter((x) => x.m.moat === "Wide").length;
          return (
            <div key={s.code} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <button onClick={() => bascule(s.code)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03]">
                <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
                <span className="font-mono text-[12px] text-violet-300">{s.code}</span>
                <span className="text-[15px] font-semibold text-zinc-100">{s.name}</span>
                <span className="ml-auto font-mono text-[12px] text-zinc-500">
                  {stes.length} sté{stes.length > 1 ? "s" : ""} · {wide} Wide
                </span>
              </button>
              {ouvert && (
                <div className="border-t border-white/[0.05] px-3 py-2">
                  <div className="grid gap-1">
                    {stes.map(({ t, m }) => (
                      <div key={t} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-white/[0.05] px-2.5 py-1.5 text-[12.5px]">
                        <Link href={`/${t.toLowerCase()}`} className="w-[74px] shrink-0 font-mono font-semibold text-violet-200 hover:underline">{t}</Link>
                        <span className="min-w-0 flex-1 basis-40 truncate text-zinc-200">{noms[t] ?? t}</span>
                        {m.moat ? (
                          <span className={`rounded-full border px-2 py-px font-mono text-[10.5px] uppercase tracking-wider ${MOAT_STYLE[m.moat]}`}>{m.moat}</span>
                        ) : (
                          <span className="rounded-full border border-rose-400/40 px-2 py-px font-mono text-[10.5px] uppercase tracking-wider text-rose-200" title={m.commentaire}>non notée</span>
                        )}
                        {m.moat && m.moat_precedent && m.moat_precedent !== m.moat && (
                          <span className="font-mono text-[11px] text-cyan-200/90" title={`Note précédente : ${m.moat_precedent}`}>
                            {m.moat_precedent} → {m.moat}{m.moat_depuis ? ` (${fmtDate(m.moat_depuis)})` : ""}
                          </span>
                        )}
                        <PastilleMettrik e={mettrik[t]} />
                        {mettrik[t]?.justification_mettrik && (
                          <span className="basis-full pl-[86px] text-[11.5px] leading-snug text-zinc-400">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">éval. Mettrik · </span>{mettrik[t].justification_mettrik}
                          </span>
                        )}
                        {m.quantitatif && (
                          <span className="rounded border border-white/10 px-1.5 py-px text-[10px] uppercase tracking-wider text-zinc-500" title="Note issue du modèle quantitatif Morningstar, pas d'analyste">quant</span>
                        )}
                        <span className="ml-auto flex items-center gap-2.5">
                          {m.allocation_capital && (
                            <span className={`text-[11.5px] ${ALLOC_STYLE[m.allocation_capital] ?? "text-zinc-400"}`} title="Allocation du capital">
                              {m.allocation_capital}
                            </span>
                          )}
                          {m.incertitude && (
                            <span className={`text-[11.5px] ${INCERT_STYLE[m.incertitude] ?? "text-zinc-400"}`} title="Incertitude">
                              incert. {m.incertitude}
                            </span>
                          )}
                          {typeof m.etoiles === "number" && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[11.5px] text-amber-200" title="Étoiles Morningstar (valorisation)">
                              {m.etoiles}
                              <Star className="size-3 fill-amber-300 text-amber-300" />
                            </span>
                          )}
                          {m.chemin && (
                            <a
                              href={`https://www.morningstar.com/stocks/${m.chemin}/quote`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 hover:text-zinc-200"
                              title="Fiche Morningstar"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
