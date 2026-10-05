import "server-only";
import { loadV17Company } from "@/lib/company-core/load-company";
import { brand } from "@/lib/brand";
import { formatHeroValue, type KPI } from "@/lib/data";
import { buildStories } from "@/lib/kpi-stories-ordering";
import { storyFamily, STORY_FAMILIES } from "@/lib/story-family";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { kpiPeriodLabel } from "@/lib/period-label";

/**
 * Donnees reelles pour les concepts « Remplacer le bloc story » : on reprend
 * exactement la liste des stories de la fiche (buildStories sur company.kpis,
 * memes filtres), avec les memes champs que la carte story. Aucune valeur
 * n est inventee ; ce qui manque reste vide.
 */

export type PtS = { q: string; v: number };
export type StoryCT = {
  id: string;
  famille: string;
  familleLabel: string;
  titre: string;
  periode: string | null;
  valeur: string;
  unite: string;
  approx: "min" | "env" | null;
  yoy: string | null;
  signal: string;
  description: string;
  explication: string;
  date: number;
  serie: PtS[];
};
export type SocieteCT = {
  ticker: string;
  nom: string;
  accent: string;
  stories: StoryCT[];
};

export async function chargeSociete(ticker: string): Promise<SocieteCT | null> {
  const r = await loadV17Company(ticker, { mode: "v18", locale: "fr" });
  if (r.kind !== "ready") return null;
  const c = r.company as unknown as { ticker: string; name: string; kpis?: KPI[] };
  const slides = buildStories(c.kpis ?? [], []).flatMap((x) => x.slides);
  const stories: StoryCT[] = [];
  slides.forEach((sl, i) => {
    if (sl.kind !== "kpi") return;
    const k = sl.data;
    const f = formatHeroValue(k.value ?? null, k.unit ?? "");
    const famille = storyFamily(k);
    const hist = Array.isArray(k.history) ? (k.history as unknown[]) : [];
    const serie: PtS[] = [];
    for (const h of hist) {
      if (h && typeof h === "object") {
        const o = h as { q?: unknown; v?: unknown };
        const v = typeof o.v === "number" ? o.v : parseFloat(String(o.v));
        if (Number.isFinite(v) && o.q) serie.push({ q: String(o.q), v });
      }
    }
    const d = k.last_data_date ? Date.parse(String(k.last_data_date)) : NaN;
    const yoy = typeof k.yoy === "string" && k.yoy.trim() && k.yoy.toLowerCase() !== "n/a"
      ? k.yoy.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %")
      : null;
    stories.push({
      id: `${i}-${k.short ?? ""}`,
      famille,
      familleLabel: STORY_FAMILIES.find((x) => x.key === famille)?.label_fr ?? "Autres jalons",
      titre: normalizeNarrative(k.name_fr ?? ""),
      periode: kpiPeriodLabel(k as unknown as { last_data_date?: string | null; history?: unknown; history_periods?: unknown }, c.ticker, "fr"),
      valeur: f.value,
      unite: f.unit,
      approx: (k as { approx?: "min" | "env" }).approx ?? null,
      yoy,
      signal: normalizeNarrative(k.signal ?? ""),
      description: normalizeNarrative(k.description ?? ""),
      explication: k.explanation ?? "",
      date: Number.isFinite(d) ? d : 0,
      serie,
    });
  });
  return { ticker: c.ticker, nom: c.name, accent: brand(c.ticker).primary, stories };
}
