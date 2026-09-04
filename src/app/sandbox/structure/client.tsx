"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type Noeud = { id: string; nom: string; desc: string; couche: string; critique?: boolean; chemins?: string[]; checks?: string[]; sous?: string[] };
export type Carte = { genere_le: string; compteurs: Record<string, number>; pages_publiques: string[]; api: string[]; tables: string[]; noeuds: Noeud[] };
type Feu = "vert" | "orange" | "rouge" | "gris";
type Controle = { id: string; feu: Feu; libelle: string; detail: string };

const COUCHES: { id: string; titre: string; sous: string; couleur: string }[] = [
  { id: "front", titre: "Ce que voit le visiteur", sous: "Pages publiques, parcours, paiement, emails", couleur: "#a78bfa" },
  { id: "back", titre: "Back-office", sous: "Tes outils de pilotage, réservés à toi", couleur: "#22d3ee" },
  { id: "donnees", titre: "Données", sous: "Ce qui nourrit les fiches", couleur: "#34d399" },
  { id: "automates", titre: "Automates", sous: "Ce qui tourne tout seul", couleur: "#f59e0b" },
  { id: "externes", titre: "Services externes", sous: "Ce dont le site dépend", couleur: "#f472b6" },
];
const FEU: Record<Feu, { bg: string; txt: string; label: string }> = {
  vert: { bg: "#10b981", txt: "Fonctionne", label: "vert" },
  orange: { bg: "#f59e0b", txt: "À surveiller", label: "orange" },
  rouge: { bg: "#f43f5e", txt: "Problème", label: "rouge" },
  gris: { bg: "#52525b", txt: "Non testable ici", label: "gris" },
};
const ORDRE: Record<Feu, number> = { rouge: 0, orange: 1, gris: 2, vert: 3 };

function feuNoeud(n: Noeud, par: Map<string, Controle>): Feu | null {
  const ids = n.checks ?? [];
  if (!ids.length) return null;
  const feux = ids.map((i) => par.get(i)?.feu).filter((f): f is Feu => !!f);
  if (!feux.length) return "gris";
  return feux.sort((a, b) => ORDRE[a] - ORDRE[b])[0];
}

export function StructureClient({ carte, jeton }: { carte: Carte; jeton: string | null }) {
  const [sante, setSante] = useState<{ genere_le: string; compteur: Record<Feu, number>; controles: Controle[] } | null>(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState<string>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [seulement, setSeulement] = useState(false);

  const charge = async () => {
    setErreur("");
    try {
      const r = await fetch(`/api/sandbox/structure-health${jeton ? `?audit_token=${encodeURIComponent(jeton)}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSante(await r.json());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "échec");
    }
  };
  useEffect(() => { void charge(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const par = useMemo(() => new Map((sante?.controles ?? []).map((c) => [c.id, c])), [sante]);
  const noeuds = carte.noeuds.filter((n) => (filtre === "tous" || n.couche === filtre) && (!seulement || n.critique));
  const compteurNoeuds = useMemo(() => {
    const c: Record<Feu, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
    for (const n of carte.noeuds) { const f = feuNoeud(n, par); if (f) c[f]++; }
    return c;
  }, [carte.noeuds, par]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 text-zinc-100">
      <Link href="/sandbox" className="text-sm text-zinc-500 hover:text-zinc-300">← Sandbox</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">Panneau de contrôle Front / Back End</h1>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
            Chaque carte est une brique de Mettrik, expliquée en une phrase. Un feu indique si la brique fonctionne
            en ce moment, d&apos;après des tests réels (services joints, fichiers présents, pages qui répondent, automates passés).
            Clique une carte pour voir ce qu&apos;elle contient et ce qui a été testé.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["rouge", "orange", "vert", "gris"] as Feu[]).map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[12px] text-zinc-300">
              <span className="size-2.5 rounded-full" style={{ background: FEU[f].bg, boxShadow: `0 0 8px ${FEU[f].bg}88` }} />
              {compteurNoeuds[f]} {FEU[f].txt.toLowerCase()}
            </span>
          ))}
          <button onClick={() => void charge()} className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[12px] text-violet-200 hover:bg-violet-500/20">
            Retester
          </button>
        </div>
      </div>

      {/* Parcours : lecture de gauche a droite */}
      <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
        {["Visiteur", "Pages publiques", "Fiches et paiement", "Données", "Automates", "Services externes"].map((e, i, arr) => (
          <span key={e} className="inline-flex items-center gap-2">
            <span className="rounded-md border border-white/10 bg-[#0a0a0a] px-2.5 py-1 text-zinc-200">{e}</span>
            {i < arr.length - 1 && <span className="text-zinc-600">→</span>}
          </span>
        ))}
        <span className="ml-auto text-zinc-500">
          {carte.compteurs.pages_publiques} pages publiques · {carte.compteurs.pages_internes} pages internes · {carte.compteurs.api} routes techniques · {carte.compteurs.tables} tables · {carte.compteurs.fiches} sociétés
        </span>
      </div>

      {/* Filtres */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[{ id: "tous", titre: "Tout" }, ...COUCHES].map((c) => (
          <button key={c.id} onClick={() => setFiltre(c.id)}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${filtre === c.id ? "border-violet-400 bg-violet-500/15 text-violet-100" : "border-[#262626] bg-[#0a0a0a] text-zinc-400 hover:border-[#3a3a3a]"}`}>
            {c.titre}
          </button>
        ))}
        <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-zinc-400">
          <input type="checkbox" checked={seulement} onChange={(e) => setSeulement(e.target.checked)} className="accent-violet-500" />
          Seulement les briques critiques
        </label>
        {sante && <span className="ml-auto text-[11px] text-zinc-500">Testé le {new Date(sante.genere_le).toLocaleString("fr-FR")}</span>}
        {erreur && <span className="ml-auto text-[12px] text-rose-400">Tests indisponibles : {erreur}</span>}
      </div>

      {/* Colonnes par couche */}
      <div className={`mt-6 grid gap-5 ${filtre === "tous" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-5" : "grid-cols-1"}`}>
        {COUCHES.filter((c) => filtre === "tous" || c.id === filtre).map((couche) => {
          const items = noeuds.filter((n) => n.couche === couche.id);
          return (
            <section key={couche.id} className="rounded-2xl border border-[#1f1f1f] bg-[#08080b] p-3">
              <div className="mb-3 border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: couche.couleur }} />
                  <h2 className="text-[14px] font-semibold text-zinc-100">{couche.titre}</h2>
                </div>
                <p className="mt-0.5 text-[11.5px] text-zinc-500">{couche.sous}</p>
              </div>
              <div className={`grid gap-2 ${filtre === "tous" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                {items.map((n) => {
                  const f = feuNoeud(n, par);
                  const est = ouvert === n.id;
                  return (
                    <div key={n.id} role="button" tabIndex={0} onClick={() => setOuvert(est ? null : n.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setOuvert(est ? null : n.id); }}
                      className={`cursor-pointer rounded-xl border p-3 transition-colors ${est ? "border-violet-400/50 bg-violet-500/[0.06]" : "border-[#222] bg-[#0b0b0e] hover:border-[#3a3a3a]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-medium leading-snug text-zinc-100">{n.nom}</div>
                        {f ? (
                          <span title={FEU[f].txt} className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: `${FEU[f].bg}22`, color: FEU[f].bg, border: `1px solid ${FEU[f].bg}55` }}>
                            <span className="size-2 rounded-full" style={{ background: FEU[f].bg, boxShadow: `0 0 8px ${FEU[f].bg}` }} />
                            {FEU[f].txt}
                          </span>
                        ) : (
                          <span className="mt-0.5 shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">non critique</span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{n.desc}</p>
                      {n.critique && !est && <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-wider text-rose-300/70">critique</div>}
                      {est && (
                        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-2">
                          {n.sous && n.sous.length > 0 && (
                            <div>
                              <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">Contient</div>
                              <ul className="mt-1 list-disc pl-4 text-[12px] text-zinc-300">{n.sous.map((s) => <li key={s}>{s}</li>)}</ul>
                            </div>
                          )}
                          {(n.checks ?? []).length > 0 && (
                            <div>
                              <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">Tests réels</div>
                              <ul className="mt-1 space-y-1">
                                {(n.checks ?? []).map((id) => {
                                  const ct = par.get(id);
                                  return (
                                    <li key={id} className="flex items-start gap-2 text-[12px] text-zinc-300">
                                      <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: FEU[ct?.feu ?? "gris"].bg }} />
                                      <span>{ct?.libelle ?? id}{ct?.detail ? <span className="text-zinc-500"> : {ct.detail}</span> : null}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {(n.chemins ?? []).length > 0 && (
                            <div>
                              <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">Où c&apos;est dans le code</div>
                              <div className="mt-1 flex flex-wrap gap-1">{(n.chemins ?? []).map((ch) => <code key={ch} className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-400">{ch}</code>)}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Legende */}
      <div className="mt-8 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 text-[12px] text-zinc-400">
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Comment lire les feux</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["vert", "orange", "rouge", "gris"] as Feu[]).map((f) => (
            <div key={f} className="flex items-start gap-2"><span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: FEU[f].bg }} />
              <span><b className="text-zinc-200">{FEU[f].txt}</b> : {f === "vert" ? "tous les tests de la brique passent." : f === "orange" ? "fonctionne mais un réglage manque ou une protection est absente." : f === "rouge" ? "au moins un test échoue : un visiteur peut être gêné." : "pas testable depuis le site (robot GitHub, source externe)."}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-zinc-500">
          Une brique est « critique » si sa panne gâcherait l&apos;expérience d&apos;au moins un utilisateur. Le feu d&apos;une brique prend la couleur du pire de ses tests. Le contrôle complet avant ouverture reste <code className="font-mono text-zinc-400">scripts/verif-release.py</code>.
        </p>
      </div>
    </main>
  );
}
