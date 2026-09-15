/**
 * Yann 16 sept 2026 : les 3 KPI affichés pour les 10 premières sociétés de
 * chaque zone de l accueil se choisissent depuis /sandbox/accueil-kpis (tout
 * KPI IC ou story de la fiche). Choix en base : desk_page_content,
 * page_key « accueil_kpis ». Valeurs lues via le chargeur de fiche, donc
 * identiques à celles de la fiche société.
 */
import { createClient } from "@supabase/supabase-js";
import { loadV17Company } from "@/lib/company-core/load-company";
import { formatHeroValue } from "@/lib/data";

export type KpiAccueil = { nom: string; valeur: string; unite: string; yoy: string | null; periode: string | null };
export type ChoixAccueil = Record<string, string[]>;
type K = { short?: string; name_fr?: string; unit?: string; value?: unknown; yoy?: unknown; history?: unknown[]; history_periods?: unknown[]; is_short_history?: boolean };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lireChoixAccueil(): Promise<ChoixAccueil> {
  try {
    const { data } = await admin().from("desk_page_content").select("content_fr").eq("page_key", "accueil_kpis").eq("section_key", "choix").maybeSingle();
    const brut = data?.content_fr ? (JSON.parse(data.content_fr) as ChoixAccueil) : {};
    return brut && typeof brut === "object" ? brut : {};
  } catch {
    return {};
  }
}

export async function ecrireChoixAccueil(ticker: string, shorts: string[]): Promise<ChoixAccueil> {
  const tous = await lireChoixAccueil();
  const t = ticker.toUpperCase();
  const propres = shorts.filter((x) => typeof x === "string" && x).slice(0, 3);
  if (propres.length === 0) delete tous[t];
  else tous[t] = propres;
  await admin().from("desk_page_content").upsert({ page_key: "accueil_kpis", section_key: "choix", content_fr: JSON.stringify(tous) }, { onConflict: "page_key,section_key" });
  return tous;
}

async function kpisFiche(ticker: string): Promise<K[]> {
  const r = (await loadV17Company(ticker).catch(() => null)) as unknown as { kind?: string; company?: { kpis?: K[] } } | null;
  return r?.kind === "ready" ? r.company?.kpis ?? [] : [];
}

function periode(k: K): string | null {
  let q: unknown = Array.isArray(k.history_periods) ? k.history_periods[k.history_periods.length - 1] : null;
  if (!q && Array.isArray(k.history)) {
    const d = k.history[k.history.length - 1] as { q?: string } | number | null;
    q = d && typeof d === "object" ? d.q : null;
  }
  if (typeof q !== "string") return null;
  const t = q.match(/^Q([1-4])[- ]?(?:FY)?(\d{4})$/i);
  if (t) return `T${t[1]} ${t[2]}`;
  const f = q.match(/^FY\s?(\d{4})$/i);
  if (f) return f[1];
  const h = q.match(/^H([12])[- ]?(\d{4})$/i);
  if (h) return `S${h[1]} ${h[2]}`;
  return q;
}

function yoyFr(y: unknown): string | null {
  if (y == null || y === "") return null;
  const s = String(y).replace(".", ",").replace(/\s*%$/, " %");
  return s.includes("%") ? s : `${s} %`;
}

/** Tous les KPI (IC et stories) de la fiche, pour le choix. */
export async function kpisDeSociete(ticker: string): Promise<{ short: string; nom: string; points: number; story: boolean }[]> {
  return (await kpisFiche(ticker))
    .filter((k) => typeof k.short === "string" && k.short)
    .map((k) => ({ short: k.short!, nom: k.name_fr || k.short!, points: Array.isArray(k.history) ? k.history.length : 0, story: !!k.is_short_history }));
}

/** KPI choisis, prêts à l affichage de l accueil (ticker -> 3 KPI). */
export async function kpisAccueilPersonnalises(): Promise<Record<string, KpiAccueil[]>> {
  const choix = await lireChoixAccueil();
  const out: Record<string, KpiAccueil[]> = {};
  await Promise.all(
    Object.entries(choix).map(async ([t, shorts]) => {
      const ks = await kpisFiche(t);
      const liste: KpiAccueil[] = [];
      for (const s of shorts) {
        const k = ks.find((x) => x.short === s);
        if (!k) continue;
        const f = formatHeroValue(k.value as number, k.unit ?? "");
        liste.push({ nom: k.name_fr || s, valeur: f.value, unite: f.unit, yoy: yoyFr(k.yoy), periode: periode(k) });
      }
      if (liste.length) out[t] = liste;
    }),
  );
  return out;
}
