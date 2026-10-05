import "server-only";
import { loadV17Company } from "@/lib/company-core/load-company";
import { rate } from "@/lib/brand";
import type { KPI } from "@/lib/data";

/**
 * Donnees reelles pour les concepts « KPI court terme » : lues via le chargeur
 * de la fiche societe (loadV17Company), aucune valeur n est inventee. Seules
 * les series trimestrielles d au moins 6 points sont gardees.
 */

export type Pt = { p: string; v: number };
export type KpiCT = {
  nom: string;
  unite: string;
  valeur: string;
  yoy: string;
  yoyNum: number | null;
  note: string;
  couleurNote: string;
  signal: string;
  serie: Pt[];
};
export type EvtCT = { date: string; titre: string; texte: string };
export type SocieteCT = {
  ticker: string;
  nom: string;
  devise: string;
  kpis: KpiCT[];
  evts: EvtCT[];
};

function libelleTrim(d: Date): string {
  return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
}

function periodesDepuis(last: string | undefined, n: number): string[] | null {
  if (!last) return null;
  const d = new Date(last + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const out: string[] = [];
  let y = d.getUTCFullYear();
  let q = Math.floor(d.getUTCMonth() / 3);
  for (let i = 0; i < n; i += 1) {
    out.unshift(`T${q + 1} ${String(y).slice(2)}`);
    q -= 1;
    if (q < 0) { q = 3; y -= 1; }
  }
  void libelleTrim;
  return out;
}

function normLabel(s: string): string {
  const m = s.match(/Q([1-4])\D*(\d{2,4})/i) ?? s.match(/T([1-4])\D*(\d{2,4})/i);
  if (m) return `T${m[1]} ${m[2].slice(-2)}`;
  return s;
}

function parseYoy(s: string | null | undefined): number | null {
  if (typeof s !== "string") return null;
  const m = s.replace(/\s/g, "").replace(",", ".").match(/-?\+?\d+(\.\d+)?/);
  return m ? parseFloat(m[0].replace("+", "")) : null;
}

export async function chargeSociete(ticker: string): Promise<SocieteCT | null> {
  const r = await loadV17Company(ticker, { mode: "v18", locale: "fr" });
  if (r.kind !== "ready") return null;
  const c = r.company as unknown as {
    ticker: string; name: string; kpis?: KPI[];
    events?: Array<{ date?: string; title_fr?: string; description_fr?: string; title?: string; body?: string; year?: number; month?: number }>;
  };
  const kpis: KpiCT[] = [];
  for (const k of c.kpis ?? []) {
    const kk = k as KPI & { history_periods?: string[]; period_type?: string };
    if (kk.period_type !== "quarter") continue;
    const hist = (kk.history as unknown[]) ?? [];
    const pts: { v: number; p?: string }[] = [];
    for (const h of hist) {
      if (typeof h === "number" && Number.isFinite(h)) pts.push({ v: h });
      else if (h && typeof h === "object") {
        const o = h as { q?: string; v?: unknown };
        if (typeof o.v === "number") pts.push({ v: o.v, p: o.q ? normLabel(o.q) : undefined });
      }
    }
    if (pts.length < 6) continue;
    let labels: string[] | null = null;
    if (Array.isArray(kk.history_periods) && kk.history_periods.length === pts.length) {
      labels = kk.history_periods.map((x) => normLabel(String(x)));
    } else if (pts.every((x) => x.p)) {
      labels = pts.map((x) => x.p as string);
    } else {
      labels = periodesDepuis(kk.last_data_date, pts.length);
    }
    if (!labels) continue;
    const n = Math.min(pts.length, 13);
    const serie: Pt[] = pts.slice(-n).map((x, i) => ({ p: labels![pts.length - n + i], v: x.v }));
    // variation vs N-1 : 4 trimestres avant, calculee sur la serie reelle
    let yoyNum = parseYoy(kk.yoy);
    if (yoyNum === null && pts.length >= 5) {
      const a = pts[pts.length - 1].v;
      const b = pts[pts.length - 5].v;
      if (b !== 0) yoyNum = ((a - b) / Math.abs(b)) * 100;
    }
    let note = "Moyen";
    let couleurNote = "#f59e0b";
    try {
      const rt = rate(kk);
      note = rt.label;
      couleurNote = rt.color;
    } catch { /* ignore */ }
    kpis.push({
      nom: kk.name_fr,
      unite: kk.unit ?? "",
      valeur: String(kk.value ?? ""),
      yoy: kk.yoy ?? (yoyNum !== null ? `${yoyNum > 0 ? "+" : ""}${yoyNum.toFixed(1)}%` : ""),
      yoyNum,
      note,
      couleurNote,
      signal: kk.signal ?? "",
      serie,
    });
  }
  const evts: EvtCT[] = (c.events ?? [])
    .map((e) => ({
      date: e.date ?? (e.year ? `${e.year}-${String(e.month ?? 1).padStart(2, "0")}-01` : ""),
      titre: e.title_fr ?? e.title ?? "",
      texte: e.description_fr ?? e.body ?? "",
    }))
    .filter((e) => e.date && e.titre)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    ticker: c.ticker,
    nom: c.name,
    devise: ticker === "MC.PA" ? "€" : "$",
    kpis: kpis.slice(0, 8),
    evts,
  };
}
