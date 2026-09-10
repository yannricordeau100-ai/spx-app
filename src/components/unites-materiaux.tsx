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
import METIERS from "@/data/unites-metiers.json";

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
  "Clients, abonnés et utilisateurs": "#f87171",
  "Produits, véhicules et unités vendues": "#2dd4bf",
  "Données, réseaux et capacités": "#e879f9",
  "Actions, titres et marchés": "#facc15",
  "Santé, science et essais": "#38bdf8",
  "Transport et logistique": "#4ade80",
  "Indicateurs métiers par secteur": "#fb7185",
};
const PALETTE = ["#f87171", "#2dd4bf", "#e879f9", "#facc15", "#38bdf8", "#4ade80", "#fb7185", "#a78bfa"];
function couleurDe(cat: string, index: number): string {
  return COULEURS[cat] ?? PALETTE[index % PALETTE.length]!;
}

const ORDRE = [
  "Indicateurs métiers par secteur",
  "Énergie : pétrole, gaz et électricité",
  "Masses et volumes de production",
  "Prix par quantité physique",
  "Rythmes et cadences",
  "Surfaces et distances",
  "Santé, science et essais",
  "Transport et logistique",
  "Données, réseaux et capacités",
  "Produits, véhicules et unités vendues",
  "Clients, abonnés et utilisateurs",
  "Ratios, taux et scores",
  "Effectifs, sites et volumes de comptage",
  "Actions, titres et marchés",
  "Durées",
  "Monnaies et montants",
];

function secteurCle(gics: string | null | undefined): "materiaux" | "energie" | null {
  if (!gics) return null;
  if (gics.startsWith("15")) return "materiaux";
  if (gics.startsWith("10")) return "energie";
  return null;
}

/* 10 sept 2026 (Yann) : mini calculette de conversion vers l unité européenne
   (celle donnée en référence dans les explications), et trois notions
   expliquées simplement : le Mix, le WACC, la note « investment grade ». */
const CONVERSIONS: { id: string; de: string; vers: string; f: (x: number) => number; note?: string }[] = [
  { id: "lb", de: "lb (livre)", vers: "kg", f: (x) => x * 0.45359 },
  { id: "oz", de: "oz (once)", vers: "g", f: (x) => x * 28.3495 },
  { id: "ozt", de: "oz troy (or, argent)", vers: "g", f: (x) => x * 31.1035 },
  { id: "ston", de: "short ton (tonne US)", vers: "t", f: (x) => x * 0.90718 },
  { id: "gal", de: "gallon US", vers: "L", f: (x) => x * 3.78541 },
  { id: "bbl", de: "baril (bbl)", vers: "L", f: (x) => x * 158.987 },
  { id: "cf", de: "pied cube (cf)", vers: "m³", f: (x) => x * 0.0283168 },
  { id: "mcf", de: "Mcf (1 000 pieds cubes)", vers: "m³", f: (x) => x * 28.3168 },
  { id: "mmbtu", de: "MMBtu", vers: "kWh", f: (x) => x * 293.071 },
  { id: "mile", de: "mile", vers: "km", f: (x) => x * 1.60934 },
  { id: "ft", de: "pied (ft)", vers: "m", f: (x) => x * 0.3048 },
  { id: "in", de: "pouce (in)", vers: "cm", f: (x) => x * 2.54 },
  { id: "sqft", de: "pied carré (sq ft)", vers: "m²", f: (x) => x * 0.092903 },
  { id: "acre", de: "acre", vers: "ha", f: (x) => x * 0.404686 },
  { id: "f", de: "°F", vers: "°C", f: (x) => (x - 32) / 1.8 },
  { id: "bu", de: "boisseau (bushel, volume)", vers: "L", f: (x) => x * 35.2391, note: "En masse : blé et soja 27,2 kg, maïs 25,4 kg par boisseau." },
  { id: "hp", de: "cheval-vapeur (hp)", vers: "kW", f: (x) => x * 0.7457 },
  { id: "mpg", de: "miles par gallon (mpg)", vers: "L/100 km", f: (x) => (x > 0 ? 235.215 / x : 0) },
  { id: "usdlb", de: "$ par lb", vers: "$ par kg", f: (x) => x * 2.20462 },
  { id: "usdgal", de: "$ par gallon", vers: "$ par L", f: (x) => x / 3.78541 },
  { id: "usdbbl", de: "$ par baril", vers: "$ par L", f: (x) => x / 158.987 },
  { id: "usdmmbtu", de: "$ par MMBtu", vers: "$ par MWh", f: (x) => x * 3.41214 },
  { id: "usdsqft", de: "$ par sq ft", vers: "$ par m²", f: (x) => x * 10.7639 },
];

function Convertisseur() {
  const [id, setId] = useState(CONVERSIONS[0]!.id);
  const [val, setVal] = useState("1");
  const c = CONVERSIONS.find((x) => x.id === id) ?? CONVERSIONS[0]!;
  const x = Number(String(val).replace(",", "."));
  const res = Number.isFinite(x) ? c.f(x) : NaN;
  const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : n.toLocaleString("fr-FR", { maximumFractionDigits: 3 }));
  return (
    <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-zinc-400">Calculette : unité américaine vers unité européenne</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
        <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" className="w-24 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-zinc-100" aria-label="valeur" />
        <select value={id} onChange={(e) => setId(e.target.value)} className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-zinc-100">
          {CONVERSIONS.map((o) => <option key={o.id} value={o.id}>{o.de}</option>)}
        </select>
        <span className="text-zinc-500">=</span>
        <span className="font-mono font-semibold text-emerald-300">{Number.isFinite(res) ? fmt(res) : "?"} {c.vers}</span>
      </div>
      {c.note && <div className="mt-1 text-[11.5px] text-zinc-500">{c.note}</div>}
    </div>
  );
}

const NOTIONS: { titre: string; texte: string[] }[] = [
  {
    titre: "Le « Mix » (mix prix, mix produit, mix alimentaire…)",
    texte: [
      "Quand une société vend plusieurs produits à des prix différents, son chiffre d’affaires bouge pour trois raisons : elle vend plus d’unités (volume), elle vend plus cher (prix), ou la part des produits chers dans le panier change (mix).",
      "Exemple : un supermarché vend autant d’articles qu’avant, aux mêmes prix, mais les clients achètent plus de plats préparés et moins de pâtes. Le panier moyen monte : c’est un effet mix positif, ici un « mix alimentaire » exprimé en dollars parce qu’il se mesure sur le chiffre d’affaires.",
      "Un mix négatif est l’inverse : les clients glissent vers les produits d’entrée de gamme.",
    ],
  },
  {
    titre: "Le WACC (coût moyen pondéré du capital), en deux étapes",
    texte: [
      "Étape 1 : une société finance ses usines et ses projets avec deux sortes d’argent. L’argent prêté par les banques et les obligataires (la dette), qui coûte un intérêt. Et l’argent des actionnaires (les fonds propres), qui attendent un rendement plus élevé parce qu’ils prennent plus de risque.",
      "Étape 2 : le WACC est la moyenne de ces deux coûts, pondérée par le poids de chacun. Exemple : 40 % de dette à 4 % et 60 % de fonds propres à 9 % donnent un WACC d’environ 7 %. Un projet ne crée de la valeur que s’il rapporte plus que ce 7 %.",
    ],
  },
  {
    titre: "« Investment grade » pour une foncière (REIT)",
    texte: [
      "Les agences de notation (Moody’s, S&P, Fitch) donnent une note à la dette d’une société. Au-dessus d’un certain seuil (BBB- chez S&P, Baa3 chez Moody’s), la dette est dite « investment grade » : jugée sûre, elle peut être achetée par les grands investisseurs prudents comme les assureurs.",
      "Pour une foncière (REIT), qui vit d’emprunts pour acheter des immeubles, être investment grade est vital : elle emprunte moins cher, sur des durées plus longues, et garde l’accès au marché même quand il se tend. Perdre cette note renchérit toute la dette d’un coup.",
    ],
  },
];

function Notions() {
  return (
    <div className="mt-4 grid gap-2">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-zinc-400">Notions utiles</div>
      {NOTIONS.map((n) => (
        <details key={n.titre} className="rounded-lg border border-white/[0.06] px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-semibold text-zinc-200">{n.titre}</summary>
          {n.texte.map((t, i) => <p key={i} className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">{t}</p>)}
        </details>
      ))}
    </div>
  );
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
  const [toutVoir, setToutVoir] = useState(false);
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
      ...((METIERS as { unites: Unite[] }).unites ?? []),
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
          <Convertisseur />
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
          <button
            type="button"
            onClick={() => setToutVoir((v) => !v)}
            className="mb-3 rounded-md border border-white/10 px-2.5 py-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            {toutVoir ? "Ne montrer que les unités de cette fiche" : `Voir tout le relevé (${total} unités)`}
          </button>
          {/* 9 sept 2026 : le relevé couvre plus de 1 200 unités. Les unités de la
              fiche sont montrées d abord, en clair ; le reste du relevé est replié. */}
          {groupes.map(([cat, unites], ci) => {
            const c = couleurDe(cat, ci);
            const actives = unites.filter((u) => u.active);
            const autres = unites.filter((u) => !u.active);
            const Ligne = ({ u }: { u: (typeof unites)[number] }) => (
              <div
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
                    <span className="font-mono text-[10.5px] text-zinc-600">aussi écrit {u.variantes.slice(0, 6).join(", ")}{u.variantes.length > 6 ? "…" : ""}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{u.signification}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-cyan-200/80">{u.comparatif}</div>
              </div>
            );
            if (actives.length === 0 && !toutVoir) return null;
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
                  {actives.map((u) => <Ligne key={u.unite} u={u} />)}
                  {toutVoir && autres.map((u) => <Ligne key={u.unite} u={u} />)}
                </div>
              </div>
            );
          })}
          <Notions />
        </div>
      )}
    </div>
  );
}
