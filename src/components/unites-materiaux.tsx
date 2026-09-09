"use client";

/**
 * Comprendre les unités (Yann 07 sept 2026, point 3 ; élargi le 9 sept 2026).
 *
 * Dépliable discret sous le tableau des indicateurs clés, sur TOUTES les
 * fiches. Contenu : le relevé du Cahier (docs/cahier/unites-materiaux.md,
 * exporté en src/data/unites-materiaux.json, complété par
 * src/data/unites-univers.json pour les autres secteurs) : acronyme, nom
 * complet, signification, ordre de grandeur comparé à un objet du quotidien.
 *
 * 9 sept 2026 (demande du propriétaire) :
 *  - chaque catégorie porte sa couleur, contrastée, pour se repérer d un
 *    coup d oeil ;
 *  - chaque unité EFFECTIVEMENT utilisée par un KPI de la fiche (axe Y du
 *    graphe) est surlignée (bord + fond de la couleur de sa catégorie, pastille
 *    « sur cette fiche ») ; les autres restent en retrait ;
 *  - une unité de la fiche absente du relevé est listée en tête, en ambre,
 *    pour qu aucune unité vue sur un axe ne manque au dépliant.
 */

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import DATA from "@/data/unites-materiaux.json";
import UNIVERS from "@/data/unites-univers.json";

type Unite = {
  categorie: string;
  unite: string;
  variantes: string[];
  nom: string;
  signification: string;
  comparatif: string;
  secteurs?: string[];
};

/** Normalisation d une unité pour la comparaison : accents, casse, espaces, points. */
export function normaliseUnite(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s\u00a0\u202f.]+/g, "")
    .replace(/’/g, "'");
}

/** Couleur par catégorie (contrastées entre elles, stables d une fiche à l autre). */
const COULEURS: Record<string, string> = {
  "Énergie : pétrole, gaz et électricité": "#fbbf24",
  "Masses et volumes de production": "#f472b6",
  "Prix par quantité physique": "#fb923c",
  "Rythmes et cadences": "#34d399",
  "Surfaces et distances": "#a3e635",
  "Ratios, taux et scores": "#22d3ee",
  "Effectifs, sites et volumes de comptage": "#c084fc",
  "Durées": "#94a3b8",
  "Monnaies et montants": "#60a5fa",
};
const PALETTE = ["#f87171", "#2dd4bf", "#e879f9", "#facc15", "#38bdf8", "#4ade80", "#fb7185", "#a78bfa"];
function couleurDe(cat: string, index: number): string {
  return COULEURS[cat] ?? PALETTE[index % PALETTE.length]!;
}

const ORDRE = [
  "Énergie : pétrole, gaz et électricité",
  "Masses et volumes de production",
  "Prix par quantité physique",
  "Rythmes et cadences",
  "Surfaces et distances",
  "Ratios, taux et scores",
  "Effectifs, sites et volumes de comptage",
  "Durées",
  "Monnaies et montants",
];

function secteurCle(gics: string | null | undefined): "materiaux" | "energie" | null {
  if (!gics) return null;
  if (gics.startsWith("15")) return "materiaux";
  if (gics.startsWith("10")) return "energie";
  return null;
}

export function UnitesMateriaux({
  gicsCode,
  secteurLabel,
  unites = [],
}: {
  /** Code GICS de la fiche (10 Énergie, 15 Matériaux...). */
  gicsCode?: string | null;
  /** Libellé du secteur pour le titre (« Énergie », « Technologie »...). */
  secteurLabel?: string | null;
  /** Unités utilisées par les KPI de la fiche (axe Y), telles quelles. */
  unites?: (string | null | undefined)[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const secteur = secteurCle(gicsCode);

  const { groupes, total, surFiche, sansDefinition } = useMemo(() => {
    const utilisees = new Map<string, string>();
    for (const u of unites) {
      const n = normaliseUnite(u);
      if (n) utilisees.set(n, String(u).trim());
    }
    const toutes = [
      ...((DATA as { unites: Unite[] }).unites ?? []),
      ...((UNIVERS as { unites: Unite[] }).unites ?? []),
    ];
    const vues = new Set<string>();
    const g = new Map<string, (Unite & { active: boolean })[]>();
    const trouvees = new Set<string>();
    for (const u of toutes) {
      if (!u) continue;
      const cle = normaliseUnite(u.unite);
      if (vues.has(cle)) continue;
      vues.add(cle);
      const formes = [u.unite, ...(u.variantes ?? [])].map(normaliseUnite);
      const active = formes.some((f) => utilisees.has(f));
      if (active) for (const f of formes) if (utilisees.has(f)) trouvees.add(f);
      // Les « valeurs non numériques » (mentions, statuts) sont reconnues mais
      // pas affichées : rien à expliquer sur un axe.
      if (u.categorie.startsWith("Valeurs non numériques")) continue;
      // Une unité propre à un secteur (champ secteurs) n est montrée que sur
      // ce secteur, sauf si la fiche l utilise vraiment.
      if (!active && u.secteurs && (!secteur || !u.secteurs.includes(secteur))) continue;
      const l = g.get(u.categorie) ?? [];
      l.push({ ...u, active });
      g.set(u.categorie, l);
    }
    // Unités actives en tête de chaque catégorie.
    for (const l of g.values()) l.sort((a, b) => Number(b.active) - Number(a.active));
    const rang = (c: string) => {
      const i = ORDRE.indexOf(c);
      return i < 0 ? ORDRE.length - 2.5 : i;
    };
    const groupes = [...g.entries()].sort((a, b) => rang(a[0]) - rang(b[0]));
    const total = groupes.reduce((t, [, l]) => t + l.length, 0);
    const surFiche = groupes.reduce((t, [, l]) => t + l.filter((x) => x.active).length, 0);
    const sansDefinition = [...utilisees.entries()].filter(([n]) => !trouvees.has(n)).map(([, brut]) => brut);
    return { groupes, total, surFiche, sansDefinition };
  }, [secteur, unites]);

  const titreSecteur = secteurLabel?.trim() ? `du secteur ${secteurLabel.trim()}` : "de cette fiche";

  return (
    <div data-blur="unites" className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.015]">
      <button
        data-blur-part="titre"
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
        <span className="text-[13.5px] font-semibold text-zinc-200">Comprendre les unités {titreSecteur}</span>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">
          {surFiche > 0 && <span className="text-emerald-300">{surFiche} sur cette fiche · </span>}
          {total} unités
        </span>
      </button>
      {ouvert && (
        <div data-blur-part="tableau" className="border-t border-white/[0.05] px-4 py-3">
          {sansDefinition.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.07] px-3 py-2">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-amber-300">Unités de cette fiche sans définition encore</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sansDefinition.map((u) => (
                  <span key={u} className="rounded-md border border-amber-400/30 bg-black/30 px-2 py-0.5 font-mono text-[12px] text-amber-100">{u}</span>
                ))}
              </div>
            </div>
          )}
          {groupes.map(([cat, unites], ci) => {
            const c = couleurDe(cat, ci);
            return (
              <div key={cat} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: c }}>
                  <span className="inline-block size-2 rounded-sm" style={{ background: c }} />
                  {cat}
                  <span className="text-zinc-600">
                    {unites.filter((u) => u.active).length > 0 && `${unites.filter((u) => u.active).length} sur cette fiche`}
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {unites.map((u) => (
                    <div
                      key={u.unite}
                      className={`rounded-lg border px-3 py-2 ${u.active ? "" : "border-white/[0.06] opacity-60"}`}
                      style={u.active ? { borderColor: `${c}80`, background: `${c}14`, boxShadow: `inset 3px 0 0 ${c}` } : undefined}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-[12.5px] font-semibold" style={{ color: u.active ? c : "#c4b5fd" }}>{u.unite}</span>
                        <span className={`text-[13px] ${u.active ? "text-zinc-50" : "text-zinc-200"}`}>{u.nom}</span>
                        {u.active && (
                          <span className="rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold uppercase tracking-wider text-black" style={{ background: c }}>sur cette fiche</span>
                        )}
                        {u.variantes.length > 0 && (
                          <span className="font-mono text-[10.5px] text-zinc-600">aussi écrit {u.variantes.join(", ")}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{u.signification}</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-cyan-200/80">{u.comparatif}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
