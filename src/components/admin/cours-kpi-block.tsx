"use client";

/**
 * Bloc ADMIN « KPI et cours de bourse » (mission Yann, 1er oct 2026).
 * Rendu uniquement quand la page serveur a verifie l admin (preversion).
 *
 * Design retenu apres lecture de docs/concurrents.md (Fiscal.ai, Koyfin) :
 * barres du KPI sur l axe de gauche, cours en ligne fine sur un axe de droite,
 * axe du temps reel commun (les periodes du KPI sont posees sur leurs vraies
 * dates, le cours est continu), legende sobre, curseur de survol unique.
 * Un second KPI de la meme societe se lit en ligne pointee : axe de gauche si
 * meme unite, sinon son propre axe a droite.
 *
 * CONVENTION DE POSITION (Yann, 7 oct 2026, remplace celle du 5 oct) : chaque
 * barre occupe exactement l intervalle de sa periode sur l axe du temps : bord
 * gauche = premier jour (lendemain de la fin de la periode precedente), bord
 * droit = dernier jour inclus, moins 3 px d espacement retires a droite. Les
 * exercices decales (AAPL, MSFT, NVDA) suivent leurs vraies dates (voir
 * src/lib/cours-kpi-periodes.ts). Le second KPI se pose au centre de l intervalle.
 * La publication des resultats, qui tombe quelques semaines
 * apres, est marquee a part par un point sur la date reelle de publication
 * (src/data/resultats-dates.json, collecte par scripts/resultats-dates-collecte.py :
 * Yahoo Finance puis communiques 8-K de l EDGAR, jamais de date estimee).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { KPI } from "@/lib/data";
import { formatUnit } from "@/lib/data";
import { buildChartSpec, type GraphPeriod } from "@/lib/chart-template";
import { verifyAndFix } from "@/lib/chart-spec-verify";
import { getFiscalAudit } from "@/lib/fiscal-calendar";
import { chartAxisHeader } from "@/lib/chart-axis-header";
import { downloadSvgAsPng } from "@/lib/chart-export";
import { intervallePeriode } from "@/lib/cours-kpi-periodes";

export type CoursPoints = {
  source: string;
  symbole_fmp: string;
  premiere_date: string;
  derniere_date: string;
  dernier_cours: number;
  plus_haut: { date: string; cours: number };
  cloture_annee_precedente: { date: string; cours: number } | null;
  points: [string, number][];
};

type ModeCours = "cours" | "ath" | "ytd";

/** Dates reelles de publication des resultats (5 dernieres annees), par societe. */
type DatesResultats = Record<string, { source: string; dates: string[] }>;
const COUL_RESULTATS = "#f472b6";

const W = 920;
const H = 430;
const PAD_TOP_BASE = 46; // + hauteur de la legende (une ou deux lignes)
const POLICE_DOC = '"Avenir", "Avenir Next", "Manrope", "Nunito Sans", sans-serif';
const PAD_BOTTOM = 44;
const PAD_LEFT = 78;
const COUL_A = "#a78bfa";
const COUL_B = "#22d3ee";
const COUL_COURS = "#f59e0b";
const JOUR = 86400000;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max === min) {
    const d = Math.abs(max) || 1;
    min -= d * 0.1;
    max += d * 0.1;
  }
  const rough = (max - min) / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 1000; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

function fmtNombre(v: number, decimales?: number): string {
  const abs = Math.abs(v);
  const d = decimales ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d });
}

function fmtPct(v: number, signe = true, decimales = 1): string {
  const r = Math.round(v * 100 * 10 ** decimales) / 10 ** decimales;
  const n = Object.is(r, -0) || r === 0 ? 0 : r;
  const s = n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${signe && n > 0 ? "+" : ""}${s} %`;
}

let ctxMesure: CanvasRenderingContext2D | null = null;
/** Largeur d un libelle a la police du document exporte (meme police en direct). */
function largeurTexte(txt: string, taille: number, pret: boolean): number {
  if (pret && typeof document !== "undefined") {
    ctxMesure = ctxMesure ?? document.createElement("canvas").getContext("2d");
    if (ctxMesure) {
      ctxMesure.font = `300 ${taille}px ${POLICE_DOC}`;
      return ctxMesure.measureText(txt).width;
    }
  }
  return txt.length * taille * 0.52;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** `debut` = 1er jour, `fin` = dernier jour de la periode ; `milieu` = centre de l intervalle [debut, fin + 1 jour), pour les points de la ligne du second KPI. */
type PointKpi = { label: string; valeur: number; debut: number; fin: number; milieu: number };

function seriesKpi(kpi: KPI, ticker: string, periode: GraphPeriod): { points: PointKpi[]; unite: string } {
  const spec = verifyAndFix(buildChartSpec(kpi, ticker, periode)).spec;
  const audit = getFiscalAudit(ticker);
  const fy = audit?.fiscalYearEndMonth ?? 12;
  const conv = (audit as { fyLabelConvention?: "start" | "end" } | undefined)?.fyLabelConvention ?? "end";
  const pts: PointKpi[] = [];
  spec.values.forEach((v, i) => {
    const lab = spec.labels[i];
    if (!lab || lab === spec.ttmLabel || !Number.isFinite(v)) return;
    const iv = intervallePeriode(lab, fy, conv, ticker);
    if (!iv) return;
    pts.push({ label: lab, valeur: v * (spec.scaleFactor || 1), debut: iv.debut, fin: iv.fin, milieu: (iv.debut + iv.fin + JOUR) / 2 });
  });
  return { points: pts, unite: spec.unit || String(kpi.unit ?? "") };
}

function periodesDispo(kpi: KPI | undefined): GraphPeriod[] {
  const pt = kpi?.period_type;
  if (pt === "quarter") return ["quarter", "year"];
  if (pt === "semester") return ["semester", "year"];
  return ["year"];
}

const LIB_PERIODE: Record<GraphPeriod, string> = { quarter: "Trimestriel", semester: "Semestriel", year: "Annuel" };

function nomKpi(k: KPI): string {
  return (k.name_fr || k.short || "").trim();
}

function devise(unitePrix: string): string {
  return unitePrix;
}

/** Recherche du dernier point de cours a la date t ou avant. */
function coursA(points: [number, number][], t: number): [number, number] | null {
  let lo = 0, hi = points.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= t) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res >= 0 ? points[res] : null;
}

export function CoursKpiBlock({
  ticker,
  nomSociete,
  kpis,
  heroShort,
  cours,
  motifNonCouvert,
  devisePrix,
}: {
  ticker: string;
  nomSociete: string;
  kpis: KPI[];
  heroShort?: string;
  cours: CoursPoints | null;
  motifNonCouvert?: string | null;
  devisePrix: string;
}) {
  const utilisables = useMemo(
    () => kpis.filter((k) => Array.isArray(k.history) && k.history.filter((v) => typeof v === "number").length >= 2),
    [kpis],
  );
  const defautA = utilisables.find((k) => k.short === heroShort)?.short ?? utilisables[0]?.short ?? "";
  const [shortA, setShortA] = useState(defautA);
  const [shortB, setShortB] = useState("");
  // Yann 4 oct 2026 : « Aucun » (shortA vide) = cours seul, sans indicateur.
  const kpiA = shortA === "" ? undefined : (utilisables.find((k) => k.short === shortA) ?? utilisables[0]);
  const kpiB = shortA === "" ? undefined : utilisables.find((k) => k.short === shortB && k.short !== shortA);
  const periodes = periodesDispo(kpiA);
  const [periodeChoisie, setPeriode] = useState<GraphPeriod>(periodes[0]);
  const periode = periodes.includes(periodeChoisie) ? periodeChoisie : periodes[0];
  const [afficherCours, setAfficherCours] = useState(true);
  const [mode, setMode] = useState<ModeCours>("cours");
  const [survol, setSurvol] = useState<number | null>(null);
  // Mesure des textes a la police du document seulement apres l hydratation
  // (le rendu serveur et le premier rendu client restent identiques).
  const [mesurePrete, setMesurePrete] = useState(false);
  useEffect(() => setMesurePrete(true), []);
  const [resultats, setResultats] = useState<{ source: string; dates: string[] } | null>(null);
  useEffect(() => {
    let vivant = true;
    // Chargement a part (admin seulement) : le fichier n est pas dans le lot de la fiche publique.
    import("@/data/resultats-dates.json")
      .then((m) => {
        const tous = ((m as { default?: DatesResultats }).default ?? (m as unknown as DatesResultats));
        if (vivant) setResultats(tous[ticker.toUpperCase()] ?? null);
      })
      .catch(() => { if (vivant) setResultats(null); });
    return () => { vivant = false; };
  }, [ticker]);
  const svgRef = useRef<SVGSVGElement>(null);
  const boiteRef = useRef<HTMLDivElement>(null);

  const serieA = useMemo(() => (kpiA ? seriesKpi(kpiA, ticker, periode) : { points: [], unite: "" }), [kpiA, ticker, periode]);
  const serieB = useMemo(() => (kpiB ? seriesKpi(kpiB, ticker, periode) : null), [kpiB, ticker, periode]);

  const prix = useMemo<[number, number][]>(
    () => (cours?.points ?? []).map(([d, p]) => [Date.parse(d + "T00:00:00Z"), p] as [number, number]).filter(([t]) => Number.isFinite(t)),
    [cours],
  );
  // Series derivees : % vs plus haut (plus haut atteint jusqu a la date) et % depuis le 1er janvier.
  const prixMode = useMemo<[number, number][]>(() => {
    if (mode === "cours") return prix;
    if (mode === "ath") {
      let max = -Infinity;
      return prix.map(([t, p]) => { max = Math.max(max, p); return [t, p / max - 1] as [number, number]; });
    }
    const out: [number, number][] = [];
    let ref: number | null = null;
    let anneeRef = -1;
    let dernierAnnee: number | null = null;
    for (let i = 0; i < prix.length; i++) {
      const [t, p] = prix[i];
      const a = new Date(t).getUTCFullYear();
      if (a !== anneeRef) { ref = dernierAnnee; anneeRef = a; }
      if (ref) out.push([t, p / ref - 1]);
      dernierAnnee = p;
    }
    return out;
  }, [prix, mode]);

  const ath = cours?.plus_haut;
  const pctAth = cours && ath ? cours.dernier_cours / ath.cours - 1 : null;
  const pctYtd = cours?.cloture_annee_precedente ? cours.dernier_cours / cours.cloture_annee_precedente.cours - 1 : null;
  const anneeDebutHisto = cours?.premiere_date?.slice(0, 4);

  // Legende (dans le SVG pour figurer dans l export). Largeurs mesurees a la
  // police du document ; repli sur deux lignes si elle ne tient pas en largeur.
  const afficherResultats = !!resultats && resultats.dates.length > 0;
  const legende: { coul: string; lib: string; forme: "barre" | "ligne" | "pointee" | "point" }[] = kpiA || cours
    ? [
        ...(kpiA ? [{ coul: COUL_A, lib: nomKpi(kpiA), forme: "barre" as const }] : []),
        ...(kpiA && kpiB ? [{ coul: COUL_B, lib: nomKpi(kpiB), forme: "pointee" as const }] : []),
        ...((afficherCours || !kpiA) && cours
          ? [{ coul: COUL_COURS, lib: mode === "cours" ? "Cours de l’action" : mode === "ath" ? "Cours en % du plus haut" : "Cours en % depuis le 1er janvier", forme: "ligne" as const }]
          : []),
        ...(afficherResultats ? [{ coul: COUL_RESULTATS, lib: "Publication des résultats", forme: "point" as const }] : []),
      ]
    : [];
  const TAILLE_LEG = 12.5;
  const MARQUE = 14; // largeur du repere de couleur
  const ECART_MARQUE = 7; // repere -> libelle
  const ECART_ITEMS = 26;
  const LARGEUR_LEG_MAX = W - 40;
  const lignesLegende = (() => {
    const items = legende.map((l) => {
      let lib = l.lib;
      // un libelle seul plus large que la ligne entiere est raccourci
      while (largeurTexte(lib, TAILLE_LEG, mesurePrete) + MARQUE + ECART_MARQUE > LARGEUR_LEG_MAX && lib.length > 8) lib = lib.slice(0, -2).trimEnd() + "…";
      return { ...l, lib, w: MARQUE + ECART_MARQUE + largeurTexte(lib, TAILLE_LEG, mesurePrete) };
    });
    const lignes: (typeof items)[] = [[]];
    for (const it of items) {
      const cur = lignes[lignes.length - 1];
      const lw = cur.reduce((sum, x) => sum + x.w, 0) + ECART_ITEMS * cur.length;
      if (cur.length && lw + it.w > LARGEUR_LEG_MAX) lignes.push([it]);
      else cur.push(it);
    }
    return lignes;
  })();
  const PAD_TOP = PAD_TOP_BASE + lignesLegende.length * 20;

  // ── Echelles ──
  const coursVisible = (afficherCours || !kpiA) && !!cours && prix.length > 1;
  const memeUnite = !!serieB && serieB.unite.trim() === serieA.unite.trim();
  const axesDroite = (coursVisible ? 1 : 0) + (serieB && !memeUnite ? 1 : 0);
  const PAD_RIGHT = axesDroite === 0 ? 36 : axesDroite === 1 ? 84 : 158;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const tousKpi = [...serieA.points, ...(serieB?.points ?? [])];
  // Chaque barre occupe exactement [premier jour, dernier jour + 1 jour) de sa periode.
  const t0Kpi = tousKpi.length ? Math.min(...tousKpi.map((p) => p.debut)) : Date.now() - 5 * 365 * JOUR;
  const t1Kpi = tousKpi.length ? Math.max(...tousKpi.map((p) => p.fin + JOUR)) : Date.now();
  const tFinCours = prix.length ? prix[prix.length - 1][0] : t1Kpi;
  const tMin = t0Kpi;
  const tMax = Math.max(t1Kpi, coursVisible ? tFinCours : t1Kpi) + 20 * JOUR;
  const x = (t: number) => PAD_LEFT + ((t - tMin) / (tMax - tMin)) * innerW;
  const tDeX = (px: number) => tMin + ((px - PAD_LEFT) / innerW) * (tMax - tMin);

  const fabrique = (ticks: number[]) => {
    const lo = Math.min(...ticks), hi = Math.max(...ticks);
    const y = (v: number) => PAD_TOP + ((hi - v) / (hi - lo || 1)) * innerH;
    return { ticks, y, lo, hi };
  };
  // Axe de gauche : graduations rondes, avec une marge au-dessus de la plus
  // haute valeur (une barre ne touche jamais le cadre).
  const echelleGauche = (vals: number[], ancrerZero: boolean) => {
    const mn = Math.min(...vals, ancrerZero ? 0 : Infinity);
    const mx = Math.max(...vals, ancrerZero ? 0 : -Infinity);
    let ticks = niceTicks(mn, mx, 5);
    const pas = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
    if (Math.max(...ticks) - mx < pas * 0.04) ticks = [...ticks, Math.round((Math.max(...ticks) + pas) * 1e6) / 1e6];
    return fabrique(ticks);
  };
  // Axes de droite : MEME nombre d intervalles que l axe de gauche, pour que
  // leurs graduations tombent sur les lignes de la grille.
  const echelleAlignee = (vals: number[], n: number, ancrerZero: boolean, plafondZero = false) => {
    const mn = Math.min(...vals, ancrerZero ? 0 : Infinity);
    // Yann 4 oct 2026 : « % vs plus haut » ne depasse jamais 0 % (0 % = plus haut a date) :
    // le haut de l echelle est toujours 0 %, quelle que soit la periode.
    if (plafondZero) {
      const brutZ = Math.max(-mn / n, 1e-6);
      const magZ = Math.pow(10, Math.floor(Math.log10(brutZ)));
      for (const m of [1, 2, 2.5, 5, 10]) {
        const pas = m * magZ;
        if (n * pas >= -mn - 1e-9) return fabrique(Array.from({ length: n + 1 }, (_, i) => Math.round((-n * pas + i * pas) * 1e6) / 1e6));
      }
    }
    const mx = Math.max(...vals, ancrerZero ? 0 : -Infinity);
    const brut = Math.max((mx - mn) / n, Math.abs(mx || 1) * 1e-6);
    const mag = Math.pow(10, Math.floor(Math.log10(brut)));
    for (const m of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
      const pas = m * mag;
      const lo = Math.floor(mn / pas + 1e-9) * pas;
      if (lo + n * pas >= mx * (mx >= 0 ? 1.0 : 1) - 1e-9) {
        return fabrique(Array.from({ length: n + 1 }, (_, i) => Math.round((lo + i * pas) * 1e6) / 1e6));
      }
    }
    return fabrique(niceTicks(mn, mx, n + 1));
  };
  const valsGauche = [...serieA.points.map((p) => p.valeur), ...(memeUnite && serieB ? serieB.points.map((p) => p.valeur) : [])];
  const echA = echelleGauche(valsGauche.length ? valsGauche : [0, 1], valsGauche.every((v) => v >= 0));
  const nIntervalles = echA.ticks.length - 1;
  const prixFenetre = prixMode.filter(([t]) => t >= tMin && t <= tMax);
  const echC = coursVisible && prixFenetre.length
    ? echelleAlignee(prixFenetre.map(([, v]) => v), nIntervalles, mode !== "cours", mode === "ath")
    : null;
  const echB = serieB && !memeUnite ? echelleAlignee(serieB.points.map((p) => p.valeur), nIntervalles, serieB.points.every((p) => p.valeur >= 0)) : null;

  // Axe du temps : une annee par repere, espacement mini 84 px (lisible dans l export, ou les annees grossissent).
  const reperes = useMemo(() => {
    const a0 = new Date(tMin).getUTCFullYear() + 1;
    const a1 = new Date(tMax).getUTCFullYear();
    const nb = Math.max(1, a1 - a0 + 1);
    const pas = Math.max(1, Math.ceil(nb / Math.max(1, Math.floor(innerW / 84))));
    const out: { t: number; lab: string }[] = [];
    for (let a = a0; a <= a1; a += pas) out.push({ t: Date.UTC(a, 0, 1), lab: String(a) });
    return out;
  }, [tMin, tMax, innerW]);

  // Largeur d une barre = largeur de sa periode ; l espacement visuel (3 px) est retire du bord DROIT seulement.
  const ESPACE_BARRES = 3;
  const largeurBarre = (p: PointKpi) => Math.max(2, ((p.fin + JOUR - p.debut) / (tMax - tMin)) * innerW - ESPACE_BARRES);

  const uniteA = formatUnit(serieA.unite);
  const uniteB = serieB ? formatUnit(serieB.unite) : "";
  const enteteA = chartAxisHeader(serieA.unite, "fr") || uniteA;
  const enteteB = serieB ? chartAxisHeader(serieB.unite, "fr") || uniteB : "";
  const enteteC = mode === "cours" ? devise(devisePrix) : "%";
  const decTicksC = echC && echC.ticks.length > 1 && Math.abs(echC.ticks[1] - echC.ticks[0]) * 100 < 1 ? 1 : 0;
  const fmtC = (v: number) => (mode === "cours" ? fmtNombre(v) : fmtPct(v, true, decTicksC));

  // ── Survol ──
  const infoSurvol = useMemo(() => {
    if (survol == null) return null;
    const t = survol;
    const pc = coursVisible ? coursA(prix, t) : null;
    const pm = coursVisible ? coursA(prixMode, t) : null;
    const dansPeriode = (pts: PointKpi[]) =>
      pts.find((p) => t >= p.debut && t < p.fin + JOUR) ??
      (pts.length ? pts.reduce((a, b) => (Math.abs(b.milieu - t) < Math.abs(a.milieu - t) ? b : a)) : null);
    const dateRes = afficherResultats
      ? resultats!.dates.map((d) => Date.parse(d + "T00:00:00Z")).find((td) => Math.abs(td - t) <= 6 * JOUR) ?? null
      : null;
    const pa = dansPeriode(serieA.points);
    const pb = serieB ? dansPeriode(serieB.points) : null;
    return { t, pc, pm, pa, pb, dateRes };
  }, [survol, coursVisible, prix, prixMode, serieA.points, serieB, afficherResultats, resultats]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    if (px < PAD_LEFT || px > PAD_LEFT + innerW) { setSurvol(null); return; }
    setSurvol(tDeX(px));
  };

  const pathCours = echC
    ? prixFenetre.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${echC.y(v).toFixed(1)}`).join(" ")
    : "";
  const pathB = serieB
    ? serieB.points.map((p, i) => `${i ? "L" : "M"}${x(p.milieu).toFixed(1)},${(echB ?? echA).y(p.valeur).toFixed(1)}`).join(" ")
    : "";
  // Points « publication des resultats » : sur la courbe du cours quand elle est affichee, sinon sur l axe du temps.
  const pointsResultats = afficherResultats
    ? resultats!.dates
        .map((d) => Date.parse(d + "T00:00:00Z"))
        .filter((td) => Number.isFinite(td) && td >= tMin && td <= tMax)
        .map((td) => {
          const pm = echC ? coursA(prixMode, td) : null;
          return { t: td, y: echC && pm ? echC.y(pm[1]) : PAD_TOP + innerH };
        })
    : [];
  const dernierPrix = prixFenetre.length ? prixFenetre[prixFenetre.length - 1] : null;

  const exporter = async () => {
    if (!svgRef.current) return;
    setSurvol(null);
    await new Promise((r) => setTimeout(r, 60));
    const titreKpi = !kpiA ? "" : kpiB ? `${nomKpi(kpiA)} face à ${nomKpi(kpiB)}` : nomKpi(kpiA);
    const titre = !kpiA
      ? (mode === "cours" ? "Cours de l’action" : mode === "ath" ? "Cours en % du plus haut" : "Cours en % depuis le 1er janvier")
      : coursVisible
      ? `${titreKpi} et ${mode === "cours" ? "cours de l’action" : mode === "ath" ? "cours en % du plus haut" : "cours en % depuis le 1er janvier"}`
      : titreKpi;
    await downloadSvgAsPng(svgRef.current, `mettrik-${ticker.toLowerCase()}-kpi-cours.png`, {
      title: `${titre} · ${nomSociete}`,
      ticker,
      locale: "fr",
      headerCompact: true,
    });
  };

  if (!kpiA && !cours) return null;


  const btn = (actif: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition ${actif ? "border-violet-400/60 bg-violet-500/15 text-zinc-50" : "border-white/[0.08] text-zinc-400 hover:bg-white/5"}`;

  return (
    <section className="my-10" data-admin-bloc="cours-kpi">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-semibold leading-tight text-zinc-50">KPI et cours de bourse</h2>
            <span className="rounded border border-amber-400/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">admin</span>
          </div>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            Le cours de l’action sur le même axe du temps que l’indicateur, et la comparaison de deux indicateurs de la société.
          </p>
        </div>
        <button
          type="button"
          onClick={exporter}
          className="self-start rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5 sm:self-auto"
          aria-label="Exporter le graphique KPI et cours"
          title="Exporter le graphique (PNG)"
        >
          <Download className="size-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="flex min-w-0 items-center gap-2 text-[12px] text-zinc-400">
            <span className="shrink-0">Indicateur</span>
            <select
              value={kpiA?.short ?? ""}
              onChange={(e) => setShortA(e.target.value)}
              className="min-w-0 flex-1 truncate rounded-md border border-white/[0.08] bg-[#111] px-2 py-1 text-[12.5px] text-zinc-100"
              data-admin-select="kpi-a"
            >
              <option value="">Aucun (cours seul)</option>
              {utilisables.map((k) => (
                <option key={k.short} value={k.short}>{nomKpi(k)}{k.unit ? ` (${formatUnit(String(k.unit))})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 items-center gap-2 text-[12px] text-zinc-400">
            <span className="shrink-0">Comparer avec</span>
            <select
              value={kpiB?.short ?? ""}
              onChange={(e) => setShortB(e.target.value)}
              className="min-w-0 flex-1 truncate rounded-md border border-white/[0.08] bg-[#111] px-2 py-1 text-[12.5px] text-zinc-100"
              data-admin-select="kpi-b"
            >
              <option value="">Aucun</option>
              {utilisables.filter((k) => k.short !== kpiA?.short).map((k) => (
                <option key={k.short} value={k.short}>{nomKpi(k)}{k.unit ? ` (${formatUnit(String(k.unit))})` : ""}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {periodes.map((p) => (
            <button key={p} type="button" className={btn(p === periode)} onClick={() => setPeriode(p)}>{LIB_PERIODE[p]}</button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {cours ? (
            <>
              <button type="button" className={btn(afficherCours)} onClick={() => setAfficherCours((v) => !v)} data-admin-toggle="cours">
                {afficherCours ? "Masquer le cours" : "Afficher le cours"}
              </button>
              {afficherCours && (
                <>
                  <button type="button" className={btn(mode === "cours")} onClick={() => setMode("cours")}>Cours</button>
                  <button type="button" className={btn(mode === "ath")} onClick={() => setMode("ath")} data-admin-mode="ath">% vs plus haut</button>
                  <button type="button" className={btn(mode === "ytd")} onClick={() => setMode("ytd")} data-admin-mode="ytd">% depuis le 1er janvier</button>
                </>
              )}
            </>
          ) : (
            <span className="text-[12px] text-zinc-500">
              Cours non couvert par l’API FMP gratuite{motifNonCouvert ? ` (${motifNonCouvert.startsWith("Premium") ? "symbole réservé aux offres payantes" : motifNonCouvert})` : ""}.
            </span>
          )}
        </div>

        {cours && (
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-zinc-400">
            <span>Cours actuel <span className="text-zinc-100">{fmtNombre(cours.dernier_cours)} {devisePrix}</span> au {fmtDate(cours.derniere_date)}</span>
            {pctAth != null && ath && (
              <span title={`Plus haut de cloture ${fmtNombre(ath.cours)} ${devisePrix} le ${fmtDate(ath.date)}`}>
                vs plus haut depuis {anneeDebutHisto} <span className={pctAth < 0 ? "text-rose-300" : "text-emerald-300"}>{fmtPct(pctAth)}</span>
              </span>
            )}
            {pctYtd != null && (
              <span>depuis le 1er janvier <span className={pctYtd < 0 ? "text-rose-300" : "text-emerald-300"}>{fmtPct(pctYtd)}</span></span>
            )}
          </div>
        )}

        <div ref={boiteRef} className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: "block" }}
            onMouseMove={onMove}
            onMouseLeave={() => setSurvol(null)}
            role="img"
            aria-label={kpiA ? `Graphique ${nomKpi(kpiA)} et cours de ${nomSociete}` : `Cours de ${nomSociete}`}
          >
            {/* Legende */}
            {lignesLegende.map((ligne, li) => {
              const largeur = ligne.reduce((sum, it) => sum + it.w, 0) + ECART_ITEMS * (ligne.length - 1);
              let cx = W / 2 - largeur / 2;
              const yl = 9 + li * 20;
              return ligne.map((it, i) => {
                const x0 = cx;
                cx += it.w + ECART_ITEMS;
                const xt = x0 + MARQUE + ECART_MARQUE + (it.w - MARQUE - ECART_MARQUE) / 2;
                return (
                  <g key={`${li}-${i}`}>
                    {it.forme === "barre" ? (
                      <rect x={x0 + 1} y={yl - 6} width={12} height={12} rx={2} fill={it.coul} opacity={0.85} />
                    ) : it.forme === "point" ? (
                      <circle cx={x0 + MARQUE / 2} cy={yl} r={4.2} fill={it.coul} stroke="#0a0a0a" strokeWidth={1.2} />
                    ) : (
                      <line x1={x0} x2={x0 + MARQUE} y1={yl} y2={yl} stroke={it.coul} strokeWidth={2.2} strokeDasharray={it.forme === "pointee" ? "4 3" : undefined} />
                    )}
                    <text x={xt} y={yl + 4.5} textAnchor="middle" fontSize={TAILLE_LEG} fontWeight={300} fontFamily={POLICE_DOC} fill="#d4d4d8">{it.lib}</text>
                  </g>
                );
              });
            })}

            {/* En-tetes d unite au-dessus de chaque axe */}
            <text x={8} y={PAD_TOP - 16} textAnchor="start" fontSize={12} fill="#a1a1aa" style={{ fill: COUL_A }}>{enteteA}</text>
            {echC && (
              <text x={PAD_LEFT + innerW + 10} y={PAD_TOP - 16} textAnchor="start" fontSize={12} fill="#a1a1aa" style={{ fill: COUL_COURS }}>{enteteC}</text>
            )}
            {echB && (
              <text x={PAD_LEFT + innerW + (echC ? 84 : 10)} y={PAD_TOP - 16} textAnchor="start" fontSize={12} fill="#a1a1aa" style={{ fill: COUL_B }}>{enteteB}</text>
            )}

            {/* Grille et graduations de gauche */}
            {echA.ticks.map((v) => (
              <g key={`a${v}`}>
                <line x1={PAD_LEFT} x2={PAD_LEFT + innerW} y1={echA.y(v)} y2={echA.y(v)} stroke="#1f1f1f" strokeDasharray="3 6" data-export-role="gridline" strokeOpacity={0.6} />
                {kpiA && <text x={PAD_LEFT - 10} y={echA.y(v) + 4} textAnchor="end" fontSize={12} fill="#a1a1aa">{fmtNombre(v)}</text>}
              </g>
            ))}
            {echC && echC.ticks.map((v) => (
              <text key={`c${v}`} x={PAD_LEFT + innerW + 10} y={echC.y(v) + 4} textAnchor="start" fontSize={12} fill="#a1a1aa">{fmtC(v)}</text>
            ))}
            {echB && echB.ticks.map((v) => (
              <text key={`b${v}`} x={PAD_LEFT + innerW + (echC ? 84 : 10)} y={echB.y(v) + 4} textAnchor="start" fontSize={12} fill="#a1a1aa">{fmtNombre(v)}</text>
            ))}

            {/* Axe du temps */}
            <line x1={PAD_LEFT} x2={PAD_LEFT + innerW} y1={PAD_TOP + innerH} y2={PAD_TOP + innerH} stroke="#3f3f46" data-export-role="structure" />
            {reperes.map((r) => (
              <g key={r.lab}>
                <line x1={x(r.t)} x2={x(r.t)} y1={PAD_TOP + innerH} y2={PAD_TOP + innerH + 5} stroke="#3f3f46" data-export-role="structure" />
                <text x={x(r.t)} y={PAD_TOP + innerH + 22} textAnchor="middle" fontSize={12} fill="#a1a1aa">{r.lab}</text>
              </g>
            ))}

            {/* Zero du cours en % */}
            {echC && mode !== "cours" && (
              <line x1={PAD_LEFT} x2={PAD_LEFT + innerW} y1={echC.y(0)} y2={echC.y(0)} stroke={COUL_COURS} strokeOpacity={0.35} strokeDasharray="2 4" />
            )}

            {/* Barres du KPI principal, posees sur leur vraie periode */}
            {serieA.points.map((p) => {
              const base = echA.y(Math.max(echA.lo, Math.min(echA.hi, 0)));
              const yv = echA.y(p.valeur);
              const actif = infoSurvol?.pa === p;
              const bw = largeurBarre(p);
              return (
                <rect
                  key={`ba${p.label}`}
                  x={x(p.debut)}
                  y={Math.min(yv, base)}
                  width={bw}
                  height={Math.max(1.5, Math.abs(base - yv))}
                  rx={Math.min(3, bw / 4)}
                  fill={COUL_A}
                  opacity={actif ? 0.95 : 0.7}
                />
              );
            })}

            {/* Second KPI : ligne pointee */}
            {serieB && (
              <g>
                <path d={pathB} fill="none" stroke={COUL_B} strokeWidth={2} strokeDasharray="5 4" />
                {serieB.points.map((p) => (
                  <circle key={`pb${p.label}`} cx={x(p.milieu)} cy={(echB ?? echA).y(p.valeur)} r={3.2} fill={COUL_B} data-chart-point="1" />
                ))}
              </g>
            )}

            {/* Cours */}
            {echC && (
              <g>
                <path d={pathCours} fill="none" stroke={COUL_COURS} strokeWidth={1.6} strokeLinejoin="round" />
                {dernierPrix && (
                  <circle cx={x(dernierPrix[0])} cy={echC.y(dernierPrix[1])} r={3.5} fill={COUL_COURS} data-chart-point="1" />
                )}
              </g>
            )}

            {/* Dates de publication des resultats */}
            {pointsResultats.map((p) => (
              <circle key={`res${p.t}`} cx={x(p.t)} cy={p.y} r={4} fill={COUL_RESULTATS} stroke="#0a0a0a" strokeWidth={1.3} data-chart-point="1" />
            ))}

            {/* Curseur de survol (jamais exporte) */}
            {infoSurvol && (
              <g data-export-hide="true" pointerEvents="none">
                <line x1={x(infoSurvol.t)} x2={x(infoSurvol.t)} y1={PAD_TOP} y2={PAD_TOP + innerH} stroke="#71717a" strokeDasharray="2 3" />
                {echC && infoSurvol.pm && (
                  <circle cx={x(infoSurvol.pm[0])} cy={echC.y(infoSurvol.pm[1])} r={4} fill={COUL_COURS} stroke="#0a0a0a" strokeWidth={1.5} />
                )}
              </g>
            )}
          </svg>

          {infoSurvol && (
            <div
              className="pointer-events-none absolute top-14 z-10 min-w-[190px] rounded-lg border border-white/10 bg-[#111]/95 px-3 py-2 font-mono text-[11.5px] text-zinc-300 shadow-xl"
              style={(() => {
                const pct = (x(infoSurvol.t) / W) * 100;
                return pct > 60 ? { right: `${100 - pct + 2}%` } : { left: `${pct + 2}%` };
              })()}
            >
              <div className="mb-1 text-zinc-500">{fmtDate(new Date(infoSurvol.t).toISOString().slice(0, 10))}</div>
              {infoSurvol.pc && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: COUL_COURS }}>Cours</span>
                  <span className="text-zinc-100">
                    {fmtNombre(infoSurvol.pc[1])} {devisePrix}
                    {mode !== "cours" && infoSurvol.pm ? ` (${fmtPct(infoSurvol.pm[1])})` : ""}
                  </span>
                </div>
              )}
              {infoSurvol.pa && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: COUL_A }}>{infoSurvol.pa.label}</span>
                  <span className="text-zinc-100">{fmtNombre(infoSurvol.pa.valeur)} {uniteA}</span>
                </div>
              )}
              {infoSurvol.pb && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: COUL_B }}>{infoSurvol.pb.label}</span>
                  <span className="text-zinc-100">{fmtNombre(infoSurvol.pb.valeur)} {uniteB}</span>
                </div>
              )}
              {infoSurvol.dateRes != null && (
                <div className="flex justify-between gap-4">
                  <span style={{ color: COUL_RESULTATS }}>Résultats publiés</span>
                  <span className="text-zinc-100">{fmtDate(new Date(infoSurvol.dateRes).toISOString().slice(0, 10))}</span>
                </div>
              )}
              {infoSurvol.pa && coursVisible && (() => {
                const c = coursA(prix, infoSurvol.pa.fin);
                return c ? (
                  <div className="mt-1 border-t border-white/10 pt-1 text-[10.5px] text-zinc-500">
                    Cours en fin de {infoSurvol.pa.label} : {fmtNombre(c[1])} {devisePrix}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        {cours
          ? `Cours : ${cours.source}, symbole ${cours.symbole_fmp}, ${fmtDate(cours.premiere_date)} au ${fmtDate(cours.derniere_date)}. Plus haut calculé sur cette période. Indicateurs : documents de la société, chaque barre couvre exactement sa période, du premier au dernier jour.${afficherResultats ? ` Publications des résultats : ${resultats!.source}.` : ""}`
          : "Indicateurs : documents de la société, chaque barre couvre exactement sa période, du premier au dernier jour."}
      </p>
    </section>
  );
}
