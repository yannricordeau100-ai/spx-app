"use client";

/**
 * Catalogue des graphiques moyen terme (Yann 26 sept 2026). Remplace la
 * longue liste de demandes par une grille filtrable :
 *  - recherche de plusieurs sociétés en même temps ;
 *  - tri par date de création ;
 *  - filtres : statut (approuvé, rejeté, en attente), nature des données
 *    (société, comparaison avec des concurrents, marché ou secteur), KPI
 *    d'industrie (oui / non / lequel), nom de la recherche, fréquence ;
 *  - aperçu sur 2 ou 3 colonnes ;
 *  - sur chaque carte : KPI d'industrie et nom de la recherche en évidence,
 *    fréquence, nombre de points et période.
 * La nature est ESTIMÉE à partir du contenu (titre, séries), pas de la
 * société qui a lancé la recherche.
 */
import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import CATALOGUE from "@/data/findings-catalogue.json";
import type { ImageFinding, ImageFindingRequest } from "@/lib/desk/image-findings";

type Meta = { frequence: string; points: number; categories: number; series: string[]; nature: string; debut: string; fin: string };
const IDX = CATALOGUE as unknown as Record<string, Meta>;

const NATURES: Record<string, string> = { societe: "Données de la société", comparaison: "Comparaison avec des concurrents", marche: "Marché ou secteur" };
const FREQ: Record<string, string> = { annuel: "Annuel", trimestriel: "Trimestriel", mensuel: "Mensuel", semestriel: "Semestriel", categories: "Par catégories", autre: "Autre" };

function slugDe(f: ImageFinding): string | null {
  const p = f.image_local_path ?? "";
  const m = p.match(/([^/]+)-(dark|light)\.(svg|png|jpe?g)$/);
  return m ? m[1] : null;
}
function statut(f: ImageFinding): "approuve" | "rejete" | "attente" {
  return f.approved ? "approuve" : f.rejected ? "rejete" : "attente";
}

export function CatalogueGraphiques({
  requests,
  findings,
  onPatch,
}: {
  requests: ImageFindingRequest[];
  findings: Record<string, ImageFinding[]>;
  onPatch: (reqId: string, p: Partial<ImageFinding>) => Promise<void>;
}) {
  const reqParId = useMemo(() => Object.fromEntries(requests.map((r) => [r.id, r])), [requests]);
  const tous = useMemo(
    () =>
      Object.entries(findings ?? {}).flatMap(([rid, rows]) =>
        (rows ?? []).map((f) => {
          const meta = IDX[slugDe(f) ?? ""] ?? null;
          const req = reqParId[rid];
          return { f, rid, meta, recherche: req?.title || req?.query || "Sans titre" };
        }),
      ),
    [findings, reqParId],
  );

  const [societes, setSocietes] = useState<string[]>([]);
  const [saisie, setSaisie] = useState("");
  const [ordre, setOrdre] = useState<"recent" | "ancien">("recent");
  const [fStatut, setFStatut] = useState<string>("tous");
  const [fNature, setFNature] = useState<string>("toutes");
  const [fIndus, setFIndus] = useState<string>("tous");
  const [fRecherche, setFRecherche] = useState<string>("toutes");
  const [fFreq, setFFreq] = useState<string>("toutes");
  const [colonnes, setColonnes] = useState<2 | 3>(3);

  const kpisIndus = useMemo(() => [...new Set(tous.map((x) => x.f.industry_kpi).filter(Boolean) as string[])].sort(), [tous]);
  const recherches = useMemo(() => [...new Set(tous.map((x) => x.recherche))].sort(), [tous]);

  const ajouteSociete = () => {
    const ts = saisie.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (ts.length) setSocietes((s) => [...new Set([...s, ...ts])]);
    setSaisie("");
  };

  const liste = useMemo(() => {
    let l = tous;
    if (societes.length) l = l.filter((x) => (x.f.target_tickers ?? []).some((t) => societes.includes(String(t).toUpperCase())));
    if (fStatut !== "tous") l = l.filter((x) => statut(x.f) === fStatut);
    if (fNature !== "toutes") l = l.filter((x) => (x.meta?.nature ?? "inconnue") === fNature);
    if (fIndus === "oui") l = l.filter((x) => !!x.f.industry_kpi);
    else if (fIndus === "non") l = l.filter((x) => !x.f.industry_kpi);
    else if (fIndus !== "tous") l = l.filter((x) => x.f.industry_kpi === fIndus);
    if (fRecherche !== "toutes") l = l.filter((x) => x.recherche === fRecherche);
    if (fFreq !== "toutes") l = l.filter((x) => (x.meta?.frequence ?? "inconnue") === fFreq);
    return [...l].sort((a, b) => (ordre === "recent" ? -1 : 1) * String(a.f.created_at).localeCompare(String(b.f.created_at)));
  }, [tous, societes, fStatut, fNature, fIndus, fRecherche, fFreq, ordre]);

  // Tableau par société : approuvés / rejetés / en attente, sur la sélection.
  const parSociete = useMemo(() => {
    const acc: Record<string, { approuve: number; rejete: number; attente: number }> = {};
    for (const x of liste) for (const t of x.f.target_tickers ?? []) {
      const k = String(t).toUpperCase();
      acc[k] ??= { approuve: 0, rejete: 0, attente: 0 };
      acc[k][statut(x.f)]++;
    }
    return Object.entries(acc).sort((a, b) => b[1].approuve + b[1].attente - (a[1].approuve + a[1].attente)).slice(0, 40);
  }, [liste]);

  const sel = "rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12.5px] text-zinc-200";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1">
          <Search className="size-3.5 text-zinc-500" />
          {societes.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-1.5 py-0.5 font-mono text-[11.5px] text-violet-100">
              {t}
              <button onClick={() => setSocietes((s) => s.filter((x) => x !== t))} aria-label={`Retirer ${t}`}><X className="size-3" /></button>
            </span>
          ))}
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); ajouteSociete(); } }}
            onBlur={ajouteSociete}
            placeholder={societes.length ? "Ajouter une société…" : "Sociétés (ex. NFLX, AAPL, MC.PA), Entrée pour ajouter"}
            className="min-w-[140px] flex-1 bg-transparent py-1 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </div>
        <select className={sel} value={ordre} onChange={(e) => setOrdre(e.target.value as "recent" | "ancien")}>
          <option value="recent">Création : plus récents</option>
          <option value="ancien">Création : plus anciens</option>
        </select>
        <select className={sel} value={fStatut} onChange={(e) => setFStatut(e.target.value)}>
          <option value="tous">Tous statuts</option>
          <option value="approuve">Approuvés</option>
          <option value="attente">En attente</option>
          <option value="rejete">Rejetés</option>
        </select>
        <select className={sel} value={fNature} onChange={(e) => setFNature(e.target.value)}>
          <option value="toutes">Toutes natures</option>
          {Object.entries(NATURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel} value={fFreq} onChange={(e) => setFFreq(e.target.value)}>
          <option value="toutes">Toutes fréquences</option>
          {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={`${sel} max-w-[260px]`} value={fIndus} onChange={(e) => setFIndus(e.target.value)}>
          <option value="tous">KPI d&apos;industrie : tous</option>
          <option value="oui">KPI d&apos;industrie : oui</option>
          <option value="non">KPI d&apos;industrie : non</option>
          {kpisIndus.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className={`${sel} max-w-[300px]`} value={fRecherche} onChange={(e) => setFRecherche(e.target.value)}>
          <option value="toutes">Toutes les recherches</option>
          {recherches.map((r) => <option key={r} value={r}>{r.slice(0, 80)}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 text-[12px] text-zinc-400">
          Aperçu
          {[2, 3].map((n) => (
            <button key={n} onClick={() => setColonnes(n as 2 | 3)} className={`rounded-md border px-2 py-1 ${colonnes === n ? "border-violet-400/60 bg-violet-500/15 text-violet-100" : "border-white/10"}`}>{n} colonnes</button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-zinc-400">
        <span className="font-semibold text-zinc-200">{liste.length} graphiques</span>
        <span>{liste.filter((x) => statut(x.f) === "approuve").length} approuvés</span>
        <span>{liste.filter((x) => statut(x.f) === "attente").length} en attente</span>
        <span>{liste.filter((x) => statut(x.f) === "rejete").length} rejetés</span>
        <span>{liste.filter((x) => x.f.industry_kpi).length} liés à un KPI d&apos;industrie</span>
      </div>

      {parSociete.length > 0 && (
        <details className="mt-2 rounded-lg border border-white/[0.08] p-2 text-[12px]">
          <summary className="cursor-pointer text-zinc-300">Par société : approuvés, en attente, rejetés</summary>
          <div className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-5">
            {parSociete.map(([t, c]) => (
              <button key={t} onClick={() => setSocietes([t])} className="flex justify-between text-left hover:text-zinc-100">
                <span className="font-mono text-zinc-200">{t}</span>
                <span><span className="text-emerald-300">{c.approuve}</span> · <span className="text-amber-300">{c.attente}</span> · <span className="text-rose-300">{c.rejete}</span></span>
              </button>
            ))}
          </div>
        </details>
      )}

      <div className={`mt-4 grid gap-3 ${colonnes === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {liste.slice(0, 300).map(({ f, rid, meta, recherche }) => {
          const st = statut(f);
          const img = f.image_local_path ? f.image_local_path.replace(/\.svg$/, ".png") : f.image_url;
          return (
            <div key={f.id} className={`flex flex-col rounded-xl border bg-white/[0.02] ${st === "approuve" ? "border-emerald-400/30" : st === "rejete" ? "border-rose-400/25 opacity-70" : "border-white/10"}`}>
              <div className="border-b border-white/[0.06] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${f.industry_kpi ? "bg-violet-500/20 text-violet-100" : "bg-white/[0.05] text-zinc-400"}`}>
                    {f.industry_kpi ? `KPI d'industrie : ${f.industry_kpi}` : "Hors KPI d'industrie"}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${st === "approuve" ? "bg-emerald-500/15 text-emerald-200" : st === "rejete" ? "bg-rose-500/15 text-rose-200" : "bg-amber-500/15 text-amber-200"}`}>
                    {st === "approuve" ? "Approuvé" : st === "rejete" ? "Rejeté" : "En attente"}
                  </span>
                </div>
                <div className="mt-1.5 text-[12px] text-cyan-200">Recherche : {recherche}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img && <img src={img} alt={f.title ?? ""} loading="lazy" className="aspect-video w-full bg-black/60 object-contain" onError={(e) => { if (f.image_local_path) (e.currentTarget as HTMLImageElement).src = f.image_local_path; }} />}
              <div className="flex flex-1 flex-col gap-1.5 px-3 py-2">
                <div className="text-[13px] font-semibold leading-snug text-zinc-100">{f.title}</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-zinc-200">{meta ? FREQ[meta.frequence] ?? meta.frequence : "Fréquence n.c."}</span>
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-zinc-200">{meta ? `${meta.points} points` : "points n.c."}</span>
                  {meta && meta.frequence !== "categories" && <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-zinc-400">{meta.debut} → {meta.fin}</span>}
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-zinc-400">{meta ? NATURES[meta.nature] : "Nature n.c."}</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-500">{(f.target_tickers ?? []).join(" · ")} · créé le {new Date(f.created_at).toLocaleDateString("fr-FR")}</div>
                <div className="mt-auto flex gap-2 pt-1">
                  <button onClick={() => onPatch(rid, { id: f.id, approved: !f.approved, rejected: false, reviewed_at: new Date().toISOString() })} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] ${f.approved ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : "border-white/10 text-zinc-300 hover:border-emerald-400/50"}`}>
                    <Check className="size-3.5" /> {f.approved ? "Approuvé" : "Approuver"}
                  </button>
                  <button onClick={() => onPatch(rid, { id: f.id, rejected: !f.rejected, approved: false, reviewed_at: new Date().toISOString() })} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] ${f.rejected ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-white/10 text-zinc-300 hover:border-rose-400/50"}`}>
                    <X className="size-3.5" /> {f.rejected ? "Rejeté" : "Rejeter"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {liste.length > 300 && <p className="mt-3 text-[12px] text-zinc-500">300 premiers affichés : affinez les filtres pour voir les autres.</p>}
    </div>
  );
}
