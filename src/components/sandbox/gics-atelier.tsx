"use client";

/**
 * Atelier GICS (/sandbox/gics), 5 sept 2026.
 *
 * Trois onglets, tous sur la meme page :
 *  1. Classification : l arbre des 4 niveaux (secteur, groupe d industries,
 *     industrie, sous-industrie) puis, sous chaque sous-industrie, un
 *     cinquieme niveau : les deux types de KPI, organiques et complementaires,
 *     chacun depliable (ou les deux).
 *  2. Societes : le meme arbre ; sous chaque sous-industrie, les societes de
 *     l univers avec lien direct vers la fiche. Un champ permet aussi de
 *     partir d une societe pour retrouver ses codes (secteur > groupe >
 *     industrie > sous-industrie).
 *  3. Prompts : le registre docs/cahier/PROMPTS.md.
 *
 * Tout le contenu vient du Cahier (docs/cahier) ; cette page l affiche.
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Minus, Plus, Search } from "lucide-react";
import { GICS, type GicsSector, type GicsSubIndustry } from "@/lib/desk/gics";
import type { AnnuaireGics, KpiParSousIndustrie, KpiSouhaite, PromptCahier } from "@/lib/cahier";

type Onglet = "classification" | "societes" | "prompts";

const STATUT_CLASSE: Record<string, string> = {
  brouillon: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  pret: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  en_cours: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  fait: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  a_verifier: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  valide: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  verifie: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
};

function Statut({ valeur }: { valeur?: string }) {
  const v = (valeur || "brouillon").toLowerCase();
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STATUT_CLASSE[v] ?? STATUT_CLASSE.brouillon}`}>
      {v.replace("_", " ")}
    </span>
  );
}

function Niveau({ label }: { label: string }) {
  return <span className="rounded border border-white/10 px-1.5 py-px text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>;
}

function compteSous(s: GicsSector): number {
  return s.groups.reduce((t, g) => t + g.industries.reduce((u, i) => u + i.subs.length, 0), 0);
}

type Chemin = { secteur: GicsSector; groupe: GicsSector["groups"][number]; industrie: GicsSector["groups"][number]["industries"][number]; sub: GicsSubIndustry };

function cheminDe(code: string): Chemin | null {
  for (const s of GICS) for (const g of s.groups) for (const i of g.industries) for (const sub of i.subs) {
    if (sub.code === code) return { secteur: s, groupe: g, industrie: i, sub };
  }
  return null;
}

export function GicsAtelier({
  kpiParSousIndustrie,
  prompts,
  annuaire,
}: {
  kpiParSousIndustrie: Record<string, KpiParSousIndustrie>;
  prompts: PromptCahier[];
  annuaire: AnnuaireGics;
}) {
  const [onglet, setOnglet] = useState<Onglet>("classification");

  const nbSous = useMemo(() => GICS.reduce((t, s) => t + compteSous(s), 0), []);
  const nbDocumentees = Object.values(kpiParSousIndustrie).filter((k) => k.kpis.length > 0).length;
  const nbClassees = Object.values(annuaire.parSousIndustrie).reduce((t, l) => t + l.length, 0);

  const onglets: { id: Onglet; label: string; compte: string }[] = [
    { id: "classification", label: "Classification et KPI", compte: `${nbSous} sous-industries · ${nbDocumentees} documentées` },
    { id: "societes", label: "Sociétés", compte: `${nbClassees} classées · ${annuaire.aClasser.length} à classer` },
    { id: "prompts", label: "Prompts", compte: `${prompts.length}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {onglets.map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`rounded-xl border px-4 py-2 text-left transition-colors ${
              onglet === o.id
                ? "border-violet-400/60 bg-violet-500/15 text-violet-50"
                : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
            }`}
          >
            <div className="text-[14px] font-semibold">{o.label}</div>
            <div className="font-mono text-[11px] text-zinc-500">{o.compte}</div>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {onglet === "classification" && (
          <Arbre
            mode="kpi"
            rendu={(sub) => <TiroirsKpi doc={kpiParSousIndustrie[sub.code]} code={sub.code} />}
            compte={(sub) => {
              const d = kpiParSousIndustrie[sub.code];
              const n = d?.kpis.length ?? 0;
              if (n === 0) return "";
              const o = d.kpis.filter((k) => (k.type ?? "organique") === "organique").length;
              return `${o} org. · ${n - o} compl.`;
            }}
          />
        )}
        {onglet === "societes" && (
          <>
            <DepuisLaSociete annuaire={annuaire} />
            <div className="mt-6">
              <Arbre
                mode="societes"
                rendu={(sub) => <ListeSocietes liste={annuaire.parSousIndustrie[sub.code] ?? []} />}
                compte={(sub) => {
                  const n = annuaire.parSousIndustrie[sub.code]?.length ?? 0;
                  return n > 0 ? `${n} sté${n > 1 ? "s" : ""}` : "";
                }}
              />
            </div>
            {annuaire.aClasser.length > 0 && (
              <details className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.05] p-4">
                <summary className="cursor-pointer text-[14px] font-semibold text-amber-100">
                  {annuaire.aClasser.length} sociétés à classer (hors S&P 500 : pas encore de sous-industrie sourcée)
                </summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {annuaire.aClasser.map((s) => (
                    <Link key={s.ticker} href={`/${s.ticker.toLowerCase()}`} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[12px] text-zinc-300 hover:border-violet-400/50">
                      <span className="font-mono text-violet-200">{s.ticker}</span> {s.name}
                    </Link>
                  ))}
                </div>
                {annuaire.source && <p className="mt-3 text-[11.5px] text-zinc-500">Source : {annuaire.source}</p>}
              </details>
            )}
          </>
        )}
        {onglet === "prompts" && <OngletPrompts prompts={prompts} />}
      </div>
    </div>
  );
}

/* ───────────── Partir d une société pour retrouver ses codes ───────────── */

function DepuisLaSociete({ annuaire }: { annuaire: AnnuaireGics }) {
  const [q, setQ] = useState("");
  const index = useMemo(() => {
    const out: { ticker: string; name: string; code: string }[] = [];
    for (const [code, liste] of Object.entries(annuaire.parSousIndustrie)) for (const s of liste) out.push({ ...s, code });
    return out;
  }, [annuaire]);
  const t = q.trim().toLowerCase();
  const resultats = t ? index.filter((s) => s.ticker.toLowerCase().includes(t) || s.name.toLowerCase().includes(t)).slice(0, 8) : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Partir d’une société</div>
      <div className="relative mt-2 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ticker ou nom (ex. KO, Nvidia)…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
        />
      </div>
      {resultats.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {resultats.map((r) => {
            const ch = cheminDe(r.code);
            return (
              <li key={r.ticker} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.07] px-3 py-2 text-[13px]">
                <Link href={`/${r.ticker.toLowerCase()}`} className="font-mono font-semibold text-violet-200 hover:underline">{r.ticker}</Link>
                <span className="text-zinc-200">{r.name}</span>
                {ch ? (
                  <span className="ml-auto flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-zinc-400">
                    <span><span className="text-violet-300">{ch.secteur.code}</span> {ch.secteur.name}</span>
                    <ChevronRight className="size-3 text-zinc-600" />
                    <span><span className="text-violet-300">{ch.groupe.code}</span> {ch.groupe.name}</span>
                    <ChevronRight className="size-3 text-zinc-600" />
                    <span><span className="text-violet-300">{ch.industrie.code}</span> {ch.industrie.name}</span>
                    <ChevronRight className="size-3 text-zinc-600" />
                    <span><span className="text-violet-300">{ch.sub.code}</span> {ch.sub.name}</span>
                  </span>
                ) : (
                  <span className="ml-auto font-mono text-[12px] text-amber-200">{r.code} (code inconnu de la table)</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {t && resultats.length === 0 && <p className="mt-2 text-[12.5px] text-zinc-500">Aucune société classée ne correspond.</p>}
    </div>
  );
}

/* ───────────── Arbre à 4 niveaux + contenu sous chaque sous-industrie ───────────── */

function Arbre({
  mode,
  rendu,
  compte,
}: {
  mode: "kpi" | "societes";
  rendu: (sub: GicsSubIndustry) => ReactNode;
  compte: (sub: GicsSubIndustry) => string;
}) {
  const [filtre, setFiltre] = useState("");
  const [secteursRetenus, setSecteursRetenus] = useState<string[]>([]);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const q = filtre.trim().toLowerCase();

  const bascule = (cle: string) =>
    setOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const deplier = (jusquAuxSous: boolean) => {
    const n = new Set<string>();
    for (const s of GICS) {
      n.add(s.code);
      for (const g of s.groups) {
        n.add(g.code);
        for (const i of g.industries) {
          n.add(i.code);
          if (jusquAuxSous) for (const sub of i.subs) n.add(sub.code);
        }
      }
    }
    setOuverts(n);
  };

  const visible = (texte: string) => !q || texte.toLowerCase().includes(q);
  const secteurs = secteursRetenus.length ? GICS.filter((s) => secteursRetenus.includes(s.code)) : GICS;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Secteurs</span>
        {GICS.map((s) => {
          const actif = secteursRetenus.includes(s.code);
          return (
            <button
              key={s.code}
              onClick={() => setSecteursRetenus((p) => (actif ? p.filter((c) => c !== s.code) : [...p, s.code]))}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                actif ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="mr-1.5 font-mono text-[11px] text-violet-300/70">{s.code}</span>
              {s.name}
              <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{compteSous(s)}</span>
            </button>
          );
        })}
        {secteursRetenus.length > 0 && (
          <button onClick={() => setSecteursRetenus([])} className="rounded-full border border-white/10 px-3 py-1.5 text-[13px] text-zinc-400 hover:text-zinc-200">
            Tout afficher
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer une sous-industrie (code ou nom)…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        <button onClick={() => deplier(false)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-zinc-300 hover:border-violet-400/40">
          <Plus className="size-3.5" /> Déplier l’arbre
        </button>
        <button onClick={() => deplier(true)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-zinc-300 hover:border-violet-400/40">
          <Plus className="size-3.5" /> {mode === "kpi" ? "Déplier jusqu’aux KPI" : "Déplier jusqu’aux sociétés"}
        </button>
        <button onClick={() => setOuverts(new Set())} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-zinc-300 hover:border-violet-400/40">
          <Minus className="size-3.5" /> Tout replier
        </button>
      </div>

      <div className="mt-4 space-y-1.5">
        {secteurs.map((s) => {
          const sOuvert = ouverts.has(s.code) || !!q;
          const subsVisibles = s.groups.flatMap((g) => g.industries.flatMap((i) => i.subs)).filter((sub) => visible(`${sub.code} ${sub.name}`));
          if (q && subsVisibles.length === 0) return null;
          return (
            <div key={s.code} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <button onClick={() => bascule(s.code)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03]">
                <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${sOuvert ? "rotate-90" : ""}`} />
                <span className="font-mono text-[12px] text-violet-300">{s.code}</span>
                <span className="text-[16px] font-semibold text-zinc-100">{s.name}</span>
                <Niveau label="Secteur" />
                <span className="ml-auto font-mono text-[12px] text-zinc-500">{s.groups.length} groupes · {compteSous(s)} sous-industries</span>
              </button>
              {sOuvert && (
                <div className="border-t border-white/[0.05] px-3 py-2">
                  {s.groups.map((g) => {
                    const gOuvert = ouverts.has(g.code) || !!q;
                    const gSubs = g.industries.flatMap((i) => i.subs).filter((sub) => visible(`${sub.code} ${sub.name}`));
                    if (q && gSubs.length === 0) return null;
                    return (
                      <div key={g.code} className="ml-1">
                        <button onClick={() => bascule(g.code)} className="flex w-full items-center gap-2 py-1.5 text-left">
                          <ChevronRight className={`size-3.5 shrink-0 text-zinc-600 transition-transform ${gOuvert ? "rotate-90" : ""}`} />
                          <span className="font-mono text-[11.5px] text-violet-300/80">{g.code}</span>
                          <span className="text-[15px] font-medium text-zinc-200">{g.name}</span>
                          <Niveau label="Groupe d’industries" />
                        </button>
                        {gOuvert && (
                          <div className="ml-4 border-l border-white/[0.07] pl-3">
                            {g.industries.map((i) => {
                              const iOuvert = ouverts.has(i.code) || !!q;
                              const iSubs = i.subs.filter((sub) => visible(`${sub.code} ${sub.name}`));
                              if (q && iSubs.length === 0) return null;
                              return (
                                <div key={i.code}>
                                  <button onClick={() => bascule(i.code)} className="flex w-full items-center gap-2 py-1 text-left">
                                    <ChevronRight className={`size-3.5 shrink-0 text-zinc-600 transition-transform ${iOuvert ? "rotate-90" : ""}`} />
                                    <span className="font-mono text-[11px] text-violet-300/70">{i.code}</span>
                                    <span className="text-[14px] text-zinc-300">{i.name}</span>
                                    <Niveau label="Industrie" />
                                    <span className="ml-auto font-mono text-[11px] text-zinc-600">{i.subs.length} sous-industries</span>
                                  </button>
                                  {iOuvert && (
                                    <div className="ml-5 border-l border-white/[0.07] pl-3">
                                      {iSubs.map((sub) => {
                                        const subOuvert = ouverts.has(sub.code);
                                        const c = compte(sub);
                                        return (
                                          <div key={sub.code} className="py-1">
                                            <button onClick={() => bascule(sub.code)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/[0.03]">
                                              <ChevronRight className={`size-3.5 shrink-0 text-zinc-500 transition-transform ${subOuvert ? "rotate-90" : ""}`} />
                                              <span className="font-mono text-[11.5px] text-violet-300/70">{sub.code}</span>
                                              <span className="text-[14px] text-zinc-200">{sub.name}</span>
                                              <Niveau label="Sous-industrie" />
                                              <span className={`ml-auto font-mono text-[11px] ${c ? "text-emerald-300" : "text-zinc-600"}`}>{c || "—"}</span>
                                            </button>
                                            {subOuvert && <div className="ml-6 mb-2 mt-1">{rendu(sub)}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Niveau 5 : KPI organiques / complémentaires ───────────── */

function TiroirsKpi({ doc, code }: { doc?: KpiParSousIndustrie; code: string }) {
  const [ouverts, setOuverts] = useState<{ organique: boolean; complementaire: boolean; europe: boolean }>({ organique: true, complementaire: false, europe: false });
  const kpis = doc?.kpis ?? [];
  const organiques = kpis.filter((k) => (k.type ?? "organique") === "organique");
  const complementaires = kpis.filter((k) => k.type === "complementaire");

  if (kpis.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-[13px] text-zinc-400">
        Aucun KPI écrit. À produire : <span className="font-mono text-zinc-300">docs/cahier/kpi/{code}.json</span> (prompt « kpi-sous-industrie »).
      </div>
    );
  }

  const tiroir = (cle: "organique" | "complementaire", titre: string, liste: KpiSouhaite[]) => (
    <div className="rounded-xl border border-white/[0.08] bg-black/20">
      <button onClick={() => setOuverts((o) => ({ ...o, [cle]: !o[cle] }))} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        {ouverts[cle] ? <ChevronDown className="size-3.5 text-zinc-500" /> : <ChevronRight className="size-3.5 text-zinc-500" />}
        <span className={`text-[13.5px] font-semibold ${cle === "organique" ? "text-violet-200" : "text-cyan-200"}`}>{titre}</span>
        <span className="font-mono text-[11px] text-zinc-500">{liste.length}</span>
        <Niveau label="KPI" />
      </button>
      {ouverts[cle] && (
        <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {liste.length === 0 && <li className="px-3 py-2 text-[12.5px] text-zinc-500">Aucun.</li>}
          {liste.map((k) => (
            <li key={k.short} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {k.wow && <span className="rounded bg-violet-500/20 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-violet-200">wow</span>}
                <span className="text-[14px] font-semibold text-zinc-100">{k.nom_fr}</span>
                {k.nom_en && <span className="text-[12px] italic text-zinc-500">{k.nom_en}</span>}
                <span className="font-mono text-[11px] text-zinc-500">{k.short}</span>
                {k.confiance && <span className="font-mono text-[10.5px] text-zinc-500">confiance {k.confiance}</span>}
                <span className="ml-auto"><Statut valeur={k.statut} /></span>
              </div>
              {k.definition && <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{k.definition}</p>}
              <p className="mt-1 font-mono text-[11.5px] text-zinc-500">
                {[k.unite, k.frequence, k.source_habituelle].filter(Boolean).join(" · ")}
                {k.exemples_societes?.length ? ` · ex. ${k.exemples_societes.join(", ")}` : ""}
              </p>
              {k.reference_standard && <p className="mt-0.5 text-[11.5px] text-zinc-500">Référence : {k.reference_standard}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const eu = doc?.cadre_europeen;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Statut valeur={doc?.statut} />
        <button onClick={() => setOuverts({ organique: true, complementaire: true, europe: true })} className="text-[11.5px] text-zinc-500 hover:text-zinc-300">tout déplier</button>
        <span className="text-zinc-700">·</span>
        <button onClick={() => setOuverts({ organique: false, complementaire: false, europe: false })} className="text-[11.5px] text-zinc-500 hover:text-zinc-300">tout replier</button>
        {doc?.sources_consultees?.length ? (
          <span className="ml-auto text-[11.5px] text-zinc-500">
            Sources : {doc.sources_consultees.map((s) => s.reference).join(" ; ")}
          </span>
        ) : null}
      </div>
      {tiroir("organique", "KPI organiques", organiques)}
      {tiroir("complementaire", "KPI complémentaires", complementaires)}
      {eu && (eu.esrs?.length || eu.esma_apm) ? (
        <div className="rounded-xl border border-white/[0.08] bg-black/20">
          <button onClick={() => setOuverts((o) => ({ ...o, europe: !o.europe }))} className="flex w-full items-center gap-2 px-3 py-2 text-left">
            {ouverts.europe ? <ChevronDown className="size-3.5 text-zinc-500" /> : <ChevronRight className="size-3.5 text-zinc-500" />}
            <span className="text-[13.5px] font-semibold text-emerald-200">Cadre européen (ESRS / CSRD, ESMA)</span>
          </button>
          {ouverts.europe && (
            <div className="border-t border-white/[0.06] px-3 py-2 text-[13px]">
              {eu.esrs?.map((e, i) => (
                <p key={i} className="py-1 text-zinc-300">
                  <span className="font-mono text-emerald-300">{e.norme}</span> · {e.datapoint}
                  {e.pertinence ? <span className="text-zinc-500"> · {e.pertinence}</span> : null}
                </p>
              ))}
              {eu.esma_apm && <p className="mt-1 text-zinc-400"><span className="font-mono text-emerald-300">ESMA APM</span> · {eu.esma_apm}</p>}
              {eu.note && <p className="mt-1 text-zinc-500">{eu.note}</p>}
            </div>
          )}
        </div>
      ) : null}
      {doc?.notes && <p className="text-[12px] italic text-zinc-500">{doc.notes}</p>}
    </div>
  );
}

/* ───────────── Sociétés d une sous-industrie ───────────── */

function ListeSocietes({ liste }: { liste: { ticker: string; name: string }[] }) {
  if (liste.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-[13px] text-zinc-500">Aucune société de l’univers classée ici.</div>;
  }
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {liste.map((s) => (
        <li key={s.ticker}>
          <Link href={`/${s.ticker.toLowerCase()}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 transition-colors hover:border-violet-400/50 hover:bg-white/[0.04]">
            <span className="font-mono text-[12px] font-semibold text-violet-200">{s.ticker}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-200">{s.name}</span>
            <ExternalLink className="size-3.5 shrink-0 text-zinc-600" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Prompts ───────────── */

function OngletPrompts({ prompts }: { prompts: PromptCahier[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const categories = useMemo(() => {
    const m = new Map<string, PromptCahier[]>();
    for (const p of prompts) {
      const c = p.categorie || "Sans catégorie";
      m.set(c, [...(m.get(c) ?? []), p]);
    }
    return [...m.entries()];
  }, [prompts]);

  if (prompts.length === 0) return <p className="text-[14px] text-zinc-400">Aucun prompt dans docs/cahier/PROMPTS.md.</p>;

  return (
    <div className="space-y-8">
      {categories.map(([cat, liste]) => (
        <section key={cat}>
          <h2 className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {cat}
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="font-mono text-[11px]">{liste.length}</span>
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {liste.map((p) => {
              const estOuvert = ouvert === p.id;
              return (
                <article key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11.5px] text-violet-300">{p.id}</span>
                    <Statut valeur={p.statut} />
                  </div>
                  <h3 className="mt-1.5 text-[16px] font-semibold text-zinc-50">{p.titre}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{p.objectif}</p>
                  <dl className="mt-3 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[12.5px]">
                    <dt className="text-zinc-500">Entrée</dt><dd className="text-zinc-300">{p.entree || "—"}</dd>
                    <dt className="text-zinc-500">Sortie</dt><dd className="font-mono text-[12px] text-zinc-300">{p.sortie || "—"}</dd>
                  </dl>
                  {p.prompt && (
                    <>
                      <button onClick={() => setOuvert(estOuvert ? null : p.id)} className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-violet-300 hover:text-violet-200">
                        {estOuvert ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        {estOuvert ? "Masquer le prompt" : "Voir le prompt"}
                      </button>
                      {estOuvert && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-zinc-300">{p.prompt}</pre>}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
