"use client";

/**
 * Atelier TAM (/sandbox/tam), 7 sept 2026.
 *
 * Meme esprit que l atelier GICS : les candidats de TAM du Cahier
 * (docs/cahier/tam/<T>.json) sont presentes par secteur et sous-industrie,
 * ou dans des listes ciblees (hesitations, sans candidat, non arbitres). Le
 * proprietaire coche jusqu a deux candidats par societe ; le choix est
 * enregistre immediatement (desk_page_content, page tam / arbitrages) et
 * servira a la pose du bloc « Position marche » sur la fiche. Aucune case
 * cochee apres arbitrage = bloc volontairement masque.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";
import { GICS, type GicsSubIndustry } from "@/lib/desk/gics";
import { Arbre } from "@/components/sandbox/gics-atelier";
import type { AnnuaireGics, TamCandidat, TamSociete } from "@/lib/cahier";

type Onglet = "secteurs" | "hesitations" | "a_arbitrer" | "sans" | "arbitres";

function cheminDe(code: string): { secteur: string; sub: GicsSubIndustry } | null {
  for (const s of GICS) for (const g of s.groups) for (const i of g.industries) for (const sub of i.subs) {
    if (sub.code === code) return { secteur: s.name, sub };
  }
  return null;
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: n >= 100 ? 0 : 1 });
}

const FIAB: Record<string, string> = {
  haute: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
  moyenne: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  faible: "border-rose-400/50 bg-rose-500/15 text-rose-100",
};

export function TamAtelier({
  tam,
  annuaire,
  noms,
  choixInitial,
  jeton,
}: {
  tam: Record<string, TamSociete>;
  annuaire: AnnuaireGics;
  noms: Record<string, string>;
  choixInitial: Record<string, string[]>;
  jeton: string | null;
}) {
  const [onglet, setOnglet] = useState<Onglet>("a_arbitrer");
  const [choix, setChoix] = useState<Record<string, string[]>>(choixInitial);
  const [filtre, setFiltre] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  const codeDe = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [code, liste] of Object.entries(annuaire.parSousIndustrie)) for (const s of liste) m[s.ticker.toUpperCase()] = code;
    return m;
  }, [annuaire]);

  const tickers = useMemo(() => Object.keys(tam).sort(), [tam]);
  const q = filtre.trim().toLowerCase();
  const passeFiltre = (t: string) => !q || t.toLowerCase().includes(q) || (noms[t] ?? "").toLowerCase().includes(q);

  const listes = useMemo(() => {
    const hes = tickers.filter((t) => (tam[t].hesitation ?? "").trim().length > 0);
    const sans = tickers.filter((t) => tam[t].candidats.length === 0);
    const arb = tickers.filter((t) => choix[t] !== undefined);
    const aArb = tickers.filter((t) => choix[t] === undefined && tam[t].candidats.length > 0);
    return { hes, sans, arb, aArb };
  }, [tickers, tam, choix]);

  async function enregistre(ticker: string, ids: string[] | null) {
    setEnCours(ticker);
    setErreur("");
    try {
      const r = await fetch(`/api/sandbox/tam-arbitrage${jeton ? `?audit_token=${encodeURIComponent(jeton)}` : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, ids }),
      });
      const j = (await r.json()) as { ok?: boolean; choix?: Record<string, string[]>; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "échec");
      setChoix(j.choix ?? {});
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "échec");
    } finally {
      setEnCours(null);
    }
  }

  function bascule(ticker: string, id: string) {
    const actuel = choix[ticker] ?? [];
    const suivant = actuel.includes(id) ? actuel.filter((x) => x !== id) : [...actuel, id].slice(-2);
    void enregistre(ticker, suivant);
  }

  const onglets: { id: Onglet; label: string; n: number }[] = [
    { id: "a_arbitrer", label: "À arbitrer", n: listes.aArb.length },
    { id: "hesitations", label: "Hésitations signalées", n: listes.hes.length },
    { id: "arbitres", label: "Arbitrés", n: listes.arb.length },
    { id: "sans", label: "Sans candidat", n: listes.sans.length },
    { id: "secteurs", label: "Arborescence", n: tickers.length },
  ];

  /* Bout de branche de l arborescence GICS (Yann 07 sept 2026) : les stés de
     la sous-industrie avec le ou les TAM retenus (ou leur statut). */
  /* Yann 07 sept 2026 : au bout de chaque branche, la carte complete de
     chaque sté (les memes cartes que les autres onglets : candidats, revenu
     segment, taille du marché, part captée, sources, cases à cocher). Le
     propriétaire valide ainsi tout depuis l arborescence, sans mise en
     ligne. Une ligne compacte au-dessus résume le ou les TAM retenus. */
  function BoutDeBranche({ sub }: { sub: GicsSubIndustry }) {
    const stes = (annuaire.parSousIndustrie[sub.code] ?? []).filter((s) => tam[s.ticker.toUpperCase()]);
    if (stes.length === 0) return <p className="py-1 text-[12px] text-zinc-600">Pas encore de candidats TAM ici.</p>;
    return (
      <div className="grid gap-3 py-1.5">
        {stes.map((s) => {
          const t = s.ticker.toUpperCase();
          const sel = choix[t];
          const retenus = (sel ?? []).map((id) => tam[t].candidats.find((c) => c.id === id)).filter(Boolean) as TamCandidat[];
          return (
            <div key={t}>
              {retenus.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {retenus.map((c) => (
                    <span key={c.id} className="rounded-full border border-emerald-400/40 bg-emerald-500/[0.08] px-2 py-px text-[11px] text-emerald-100">
                      Retenu : {c.tam_intitule} · {fmt(c.tam)} {c.tam_unite} ({c.tam_annee})
                    </span>
                  ))}
                </div>
              )}
              <Carte ticker={t} />
            </div>
          );
        })}
      </div>
    );
  }

  function Carte({ ticker }: { ticker: string }) {
    const d = tam[ticker];
    const sel = choix[ticker];
    const chemin = codeDe[ticker] ? cheminDe(codeDe[ticker]) : null;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={`/${ticker.toLowerCase()}`} className="font-mono text-[13px] font-semibold text-violet-200 hover:underline">{ticker}</Link>
          <span className="text-[15px] font-semibold text-zinc-100">{noms[ticker] ?? ticker}</span>
          {chemin && <span className="text-[11.5px] text-zinc-500">{chemin.secteur} · {chemin.sub.name}</span>}
          <span className={`ml-auto rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${sel === undefined ? "border-zinc-500/40 text-zinc-400" : sel.length === 0 ? "border-rose-400/40 text-rose-200" : "border-emerald-400/40 text-emerald-200"}`}>
            {sel === undefined ? "non arbitré" : sel.length === 0 ? "bloc masqué" : `${sel.length} retenu${sel.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="mt-1 text-[12.5px] text-zinc-400">Activité{d.activites_principales.length > 1 ? "s" : ""} : {d.activites_principales.join(" · ")}</div>
        {d.hesitation && <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-3 py-2 text-[12.5px] text-amber-100">Hésitation : {d.hesitation}</div>}
        {d.candidats.length === 0 && <div className="mt-2 text-[12.5px] text-zinc-500">Aucun candidat fiable. {d.commentaire}</div>}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {d.candidats.map((c) => (
            <Candidat key={c.id} c={c} coche={(sel ?? []).includes(c.id)} desactive={enCours === ticker} onToggle={() => bascule(ticker, c.id)} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <button disabled={enCours === ticker} onClick={() => void enregistre(ticker, [])} className="rounded-md border border-rose-400/40 px-2.5 py-1 text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">Aucun : masquer le bloc</button>
          {sel !== undefined && (
            <button disabled={enCours === ticker} onClick={() => void enregistre(ticker, null)} className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50">Effacer l’arbitrage</button>
          )}
          {enCours === ticker && <span className="text-zinc-500">enregistrement…</span>}
        </div>
      </div>
    );
  }

  const listeCourante =
    onglet === "hesitations" ? listes.hes : onglet === "sans" ? listes.sans : onglet === "arbitres" ? listes.arb : onglet === "a_arbitrer" ? listes.aArb : tickers;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {onglets.map((o) => (
          <button key={o.id} onClick={() => setOnglet(o.id)} className={`rounded-xl border px-4 py-2 text-left transition-colors ${onglet === o.id ? "border-violet-400/60 bg-violet-500/15 text-violet-50" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"}`}>
            <div className="text-[14px] font-semibold">{o.label}</div>
            <div className="font-mono text-[11px] text-zinc-500">{o.n} société{o.n > 1 ? "s" : ""}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <Search className="size-4 text-zinc-500" />
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer par ticker ou nom…" className="w-full bg-transparent text-[13.5px] text-zinc-100 outline-none placeholder:text-zinc-600" />
      </div>
      {erreur && <div className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">{erreur}</div>}

      {onglet !== "secteurs" ? (
        <div className="mt-5 grid gap-4">
          {listeCourante.filter(passeFiltre).map((t) => <Carte key={t} ticker={t} />)}
          {listeCourante.filter(passeFiltre).length === 0 && <div className="text-[13px] text-zinc-500">Rien dans cette liste.</div>}
        </div>
      ) : (
        <div className="mt-5">
          {/* Yann 07 sept 2026 : meme arborescence 4 niveaux que l atelier
              GICS, avec au bout de chaque branche les stés et le(s) TAM
              retenus. */}
          <Arbre
            mode="societes"
            rendu={(sub) => <BoutDeBranche sub={sub} />}
            compte={(sub) => {
              const stes = (annuaire.parSousIndustrie[sub.code] ?? []).filter((s) => tam[s.ticker.toUpperCase()]);
              const arb = stes.filter((s) => choix[s.ticker.toUpperCase()] !== undefined).length;
              return stes.length > 0 ? `${stes.length} sté${stes.length > 1 ? "s" : ""} · ${arb} arbitrée${arb > 1 ? "s" : ""}` : "";
            }}
          />
        </div>
      )}
    </div>
  );
}

function Candidat({ c, coche, desactive, onToggle }: { c: TamCandidat; coche: boolean; desactive: boolean; onToggle: () => void }) {
  const part = c.tam > 0 ? (c.segment_revenu / c.tam) * 100 : 0;
  return (
    <label className={`block cursor-pointer rounded-xl border p-3 transition-colors ${coche ? "border-emerald-400/60 bg-emerald-500/[0.08]" : "border-white/10 bg-black/20 hover:border-white/25"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={coche} disabled={desactive} onChange={onToggle} className="mt-1 size-4 accent-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] text-zinc-500">{c.id}</span>
            <span className={`rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-wider ${FIAB[c.fiabilite ?? ""] ?? "border-zinc-500/40 text-zinc-400"}`}>fiabilité {c.fiabilite ?? "?"}</span>
          </div>
          <div className="mt-1 text-[13.5px] font-semibold text-zinc-100">{c.tam_intitule}</div>
          <div className="text-[12px] text-zinc-400">Activité de la société : {c.segment}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div className="rounded-lg border border-white/10 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-zinc-500">Revenu segment</div><div className="font-mono text-zinc-100">{fmt(c.segment_revenu)} {c.segment_unite}</div><div className="text-[10.5px] text-zinc-500">{c.segment_exercice}</div></div>
            <div className="rounded-lg border border-white/10 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-zinc-500">Taille du marché</div><div className="font-mono text-zinc-100">{fmt(c.tam)} {c.tam_unite}</div><div className="text-[10.5px] text-zinc-500">{c.tam_annee}{c.tam_fourchette ? ` · ${fmt(c.tam_fourchette[0])} à ${fmt(c.tam_fourchette[1])}` : ""}</div></div>
            <div className="rounded-lg border border-white/10 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-zinc-500">Part captée</div><div className="font-mono text-sky-200">{part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</div><div className="text-[10.5px] text-zinc-500">{c.croissance_marche_pct != null ? `marché ${c.croissance_marche_pct > 0 ? "+" : ""}${c.croissance_marche_pct} % / an` : ""}</div></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-400">
            {c.tam_source?.url && <a href={c.tam_source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-100">TAM : {c.tam_source.titre ?? c.tam_source.url} <ExternalLink className="size-3" /></a>}
            {c.segment_source?.url && <a href={c.segment_source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-100">Revenu : {c.segment_source.titre ?? c.segment_source.url} <ExternalLink className="size-3" /></a>}
          </div>
          {c.commentaire && <div className="mt-1.5 text-[12px] text-zinc-400">{c.commentaire}</div>}
        </div>
      </div>
    </label>
  );
}
