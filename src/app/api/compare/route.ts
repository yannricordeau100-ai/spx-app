import { NextResponse } from "next/server";
import INDEX from "@/data/compare-index.json";
import { loadV17Company } from "@/lib/company-core/load-company";
import { parseUnite, periodeCle } from "@/lib/compare-keys";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";

export const dynamic = "force-dynamic";

/**
 * Comparer (Yann 11 sept 2026), reserve aux abonnes :
 *  GET ?t=AAPL&k=<short>          -> societes ayant le meme KPI (cle de comparabilite)
 *  GET ?a=AAPL&ka=<short>&b=MSFT  -> les deux series alignees sur les memes periodes
 */
type Idx = { names: Record<string, string>; byT: Record<string, Record<string, string>>; keys: Record<string, Array<[string, string]>> };
const IDX = INDEX as unknown as Idx;

async function autorise(req: Request): Promise<boolean> {
  const jeton = new URL(req.url).searchParams.get("audit_token");
  if (jeton && process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN) return true;
  const sim = await readSimulateTier();
  if (sim === "premium" || sim === "max") return true;
  if (sim === "anonymous" || sim === "free") return false;
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const t = await tierDepuisAbonnement(user);
    return t === "premium" || t === "max";
  } catch {
    return false;
  }
}

type K = { short: string; name_fr?: string; name_en?: string; unit?: string; period_type?: string; history?: unknown[]; history_periods?: unknown[]; last_data_date?: string };

function serie(k: K): Map<string, number> {
  const h = (k.history ?? []) as Array<number | null>;
  const hp = Array.isArray(k.history_periods) && k.history_periods.length === h.length ? (k.history_periods as string[]) : null;
  const m = new Map<string, number>();
  const finAn = Number(String(k.last_data_date ?? "").slice(0, 4)) || 2025;
  h.forEach((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    const cle = hp ? periodeCle(hp[i], k.period_type) : (k.period_type ?? "year") === "year" ? String(finAn - (h.length - 1 - i)) : null;
    if (cle) m.set(cle, v);
  });
  return m;
}

/** Trimestres -> exercices (somme des 4 trimestres, montants seulement). */
function annualise(m: Map<string, number>): Map<string, number> {
  const par = new Map<string, number[]>();
  for (const [c, v] of m) { const y = c.match(/^T[1-4]-(\d{4})$/)?.[1]; if (y) par.set(y, [...(par.get(y) ?? []), v]); }
  const out = new Map<string, number>();
  for (const [y, vs] of par) if (vs.length === 4) out.set(y, vs.reduce((a, b) => a + b, 0));
  return out;
}

function trie(a: string, b: string) {
  const n = (s: string) => { const q = s.match(/^[TS]([1-4])-(\d{4})$/); return q ? Number(q[2]) * 10 + Number(q[1]) : Number(s) * 10; };
  return n(a) - n(b);
}

export async function GET(req: Request) {
  if (!(await autorise(req))) return NextResponse.json({ error: "abonnes" }, { status: 403 });
  const sp = new URL(req.url).searchParams;

  const t = sp.get("t")?.toUpperCase();
  if (t) {
    const cle = IDX.byT[t]?.[sp.get("k") ?? ""];
    const items = cle ? (IDX.keys[cle] ?? []).filter(([x]) => x !== t).map(([x, s]) => ({ ticker: x, name: IDX.names[x] ?? x, short: s })) : [];
    return NextResponse.json({ cle: cle ?? null, items });
  }

  const a = sp.get("a")?.toUpperCase(), ka = sp.get("ka") ?? "", b = sp.get("b")?.toUpperCase();
  if (!a || !b) return NextResponse.json({ error: "parametres" }, { status: 400 });
  const cle = IDX.byT[a]?.[ka];
  const kb = cle ? Object.entries(IDX.byT[b] ?? {}).find(([, c]) => c === cle)?.[0] : undefined;
  if (!cle || !kb) return NextResponse.json({ error: "pas de KPI comparable" }, { status: 404 });

  const [ra, rb] = await Promise.all([loadV17Company(a, { mode: "v18", locale: "fr" }), loadV17Company(b, { mode: "v18", locale: "fr" })]);
  if (ra.kind !== "ready" || rb.kind !== "ready") return NextResponse.json({ error: "fiche indisponible" }, { status: 404 });
  const kpiA = ra.company.kpis.find((k) => k.short === ka) as unknown as K | undefined;
  const kpiB = rb.company.kpis.find((k) => k.short === kb) as unknown as K | undefined;
  if (!kpiA || !kpiB) return NextResponse.json({ error: "KPI introuvable" }, { status: 404 });

  const ua = parseUnite(kpiA.unit), ub = parseUnite(kpiB.unit);
  let sa = serie(kpiA), sb = serie(kpiB);
  const notes: string[] = [];
  const pa = kpiA.period_type ?? "year", pb = kpiB.period_type ?? "year";
  if (pa !== pb) {
    if (ua.fam === "money" && ub.fam === "money") {
      if (pa === "quarter") sa = annualise(sa);
      if (pb === "quarter") sb = annualise(sb);
      notes.push("Périodicités différentes : les trimestres sont additionnés en exercices complets.");
    }
  }
  let communs = [...sa.keys()].filter((c) => sb.has(c)).sort(trie).slice(-10);
  if (communs.length < 2 && pa === pb && pa !== "year") {
    notes.push("Calendriers d exercice différents : trimestres mis bout à bout dans l ordre.");
    const la = [...sa.keys()].sort(trie).slice(-8), lb = [...sb.keys()].sort(trie).slice(-8);
    const n = Math.min(la.length, lb.length);
    const na = new Map(la.slice(-n).map((c, i) => [String(i), sa.get(c)!])), nb = new Map(lb.slice(-n).map((c, i) => [String(i), sb.get(c)!]));
    communs = la.slice(-n); sa = new Map(communs.map((c, i) => [c, na.get(String(i))!])); sb = new Map(communs.map((c, i) => [c, nb.get(String(i))!]));
  }
  if (communs.length < 2) return NextResponse.json({ error: "periodes", message: "Pas assez de périodes communes pour comparer ces deux séries." }, { status: 422 });

  const memeDevise = ua.cur === ub.cur;
  const convertible = memeDevise && ua.fam === ub.fam;
  if (!memeDevise) notes.push(`Devises différentes (${ua.cur ?? "sans devise"} et ${ub.cur ?? "sans devise"}) : seules les dynamiques sont comparées, pas les montants.`);
  let facteur = convertible ? ub.scale / ua.scale : 1;
  let comparableEnMontant = convertible;
  if (convertible && ua.fam !== "pct") {
    // Garde-fou : un ecart d echelle superieur a 1000 entre les deux series
    // trahit une unite mal annotee a la source. Montants non compares.
    const med = (xs: number[]) => { const t = xs.map(Math.abs).filter((x) => x > 0).sort((p, q) => p - q); return t[Math.floor(t.length / 2)] ?? 0; };
    const ma = med(communs.map((c) => sa.get(c)!)), mb = med(communs.map((c) => sb.get(c)! * facteur));
    if (ma > 0 && mb > 0 && (ma / mb > 1000 || mb / ma > 1000)) {
      comparableEnMontant = false; facteur = 1;
      notes.push("Écart d échelle anormal entre les deux séries (unité probablement mal annotée à la source) : seules les dynamiques sont comparées.");
    }
  }

  return NextResponse.json({
    cle,
    labels: communs.map((c) => c.replace(/^T([1-4])-(\d{4})$/, "T$1 $2")),
    a: { ticker: ra.company.ticker, name: ra.company.name, subsector: ra.company.subsector, kpi: kpiA, valeurs: communs.map((c) => sa.get(c)!) },
    b: { ticker: rb.company.ticker, name: rb.company.name, subsector: rb.company.subsector, kpi: kpiB, valeurs: communs.map((c) => sb.get(c)! * facteur), uniteAlignee: comparableEnMontant ? kpiA.unit : kpiB.unit },
    convertible: comparableEnMontant,
    notes,
  });
}
