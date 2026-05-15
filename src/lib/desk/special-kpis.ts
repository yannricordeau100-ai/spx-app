/**
 * KPIs spéciaux — accès BDD desk_special_kpis.
 *
 * Workflow : Yann crée une demande sur /sandbox/special-kpis, lance une
 * extraction (Groq Llama 3.3 70B gratuit, ou Claude conv MAX 20×), valide
 * le rendu en preview, puis coche "publié" pour que le KPI apparaisse sur
 * la page société live.
 */
import { createClient } from "@supabase/supabase-js";

export type SpecialKpiStyle = "classique" | "story";
export type SpecialKpiChart = "curve" | "bars" | "variation";
export type SpecialKpiStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "error"
  | "manual_needed"
  | "claude_assigned";
export type SpecialKpiMode = "single" | "multi";

export type SpecialKpiPoint = {
  period: string;            // "2020" ou "Q4 2024"
  value: number;
  uncertainty_pct?: number;  // ex 5 → ±5 %
  uncertainty_note?: string; // ex "estimation analyste consensus"
  source?: string;           // ex "10-K FY24 p.31" ou "IDC tracker Q3 2024"
};

export type SpecialKpiData = {
  values_by_period?: SpecialKpiPoint[];
  hero_summary?: string;
  interpretation?: string;
  yoy_latest?: string;
  cagr_5y_pct?: number;
};

/** Mapping 8 langues → string. Vide = pas traduit. */
export const SUPPORTED_LOCALES = [
  "fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH",
] as const;
export type SpecialKpiLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedString = Partial<Record<SpecialKpiLocale, string>>;

export type SpecialKpiAnnotation = {
  /** "2020" / "FY20" / "between:2020-2021" pour placer entre 2 années. */
  period: string;
  title_i18n: LocalizedString;
  text_i18n: LocalizedString;
};

export type SpecialKpi = {
  id: string;
  ticker: string | null;
  target_tickers: string[];
  mode: SpecialKpiMode;
  kpi_short: string;
  kpi_name_fr: string | null;
  kpi_name_en: string | null;
  /** Traductions du nom dans les 8 langues (clés SUPPORTED_LOCALES). */
  kpi_name_i18n: LocalizedString;
  /** Traductions du hero_summary dans les 8 langues. */
  hero_summary_i18n: LocalizedString;
  /** Traductions de l'interprétation dans les 8 langues. */
  interpretation_i18n: LocalizedString;
  /** Annotations "i" sur le chart par année (titre + texte en 8 langues). */
  annotations: SpecialKpiAnnotation[];
  kpi_unit: string | null;
  kpi_category: string;
  style: SpecialKpiStyle;
  chart_type: SpecialKpiChart;
  story_category: string | null;
  description: string | null;
  status: SpecialKpiStatus;
  error_msg: string | null;
  notes: string | null;
  data: SpecialKpiData;
  data_source: string | null;
  llm_provider: string | null;
  llm_prompt: string | null;
  llm_response_raw: string | null;
  llm_at: string | null;
  published: boolean;
  published_at: string | null;
  is_hero: boolean;
  created_at: string;
  updated_at: string;
};

/** Helper : récupère le nom du KPI dans la locale demandée avec fallback. */
export function pickLocalized(
  i18n: LocalizedString | null | undefined,
  locale: string,
  fallbackChain: string[] = ["fr", "en"],
): string {
  if (!i18n) return "";
  const v = i18n[locale as SpecialKpiLocale];
  if (v) return v;
  for (const f of fallbackChain) {
    const w = i18n[f as SpecialKpiLocale];
    if (w) return w;
  }
  return "";
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function listSpecialKpis(): Promise<SpecialKpi[]> {
  const supa = admin();
  const { data, error } = await supa
    .from("desk_special_kpis")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SpecialKpi[];
}

export async function getSpecialKpi(id: string): Promise<SpecialKpi | null> {
  const supa = admin();
  const { data } = await supa.from("desk_special_kpis").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as SpecialKpi | null;
}

export async function listPublishedForTicker(ticker: string): Promise<SpecialKpi[]> {
  const supa = admin();
  const t = ticker.toUpperCase();
  const { data } = await supa
    .from("desk_special_kpis")
    .select("*")
    .or(`ticker.eq.${t},target_tickers.cs.{${t}}`)
    .eq("published", true);
  return (data ?? []) as SpecialKpi[];
}

export async function upsertSpecialKpi(payload: Partial<SpecialKpi>): Promise<SpecialKpi> {
  const supa = admin();
  const row = {
    ...payload,
    ticker: payload.ticker ? payload.ticker.toUpperCase() : null,
    target_tickers: payload.target_tickers
      ? payload.target_tickers.map((t) => t.toUpperCase())
      : [],
  };
  const q = payload.id
    ? supa.from("desk_special_kpis").update(row).eq("id", payload.id).select().single()
    : supa.from("desk_special_kpis").insert(row).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data as SpecialKpi;
}

export async function deleteSpecialKpi(id: string): Promise<void> {
  const supa = admin();
  await supa.from("desk_special_kpis").delete().eq("id", id);
}

/**
 * Construit un prompt enrichi pour l'extraction LLM (Groq / Claude conv /
 * externe). Demande un JSON strict avec valeurs + 8 traductions des
 * libellés principaux (name, hero_summary, interpretation).
 */
export function buildExtractionPrompt(k: SpecialKpi): string {
  const targets = k.mode === "multi" && k.target_tickers.length
    ? k.target_tickers.join(", ")
    : k.ticker ?? "(non défini)";
  return `Tu es un analyste financier spécialisé extraction de KPIs métier pour Mettrik AI.
Mission : trouver les valeurs historiques (5 dernières années si possible, sinon
le maximum disponible) pour le KPI suivant.

KPI demandé : **${k.kpi_short}** (${k.kpi_name_fr ?? k.kpi_name_en ?? ""})
Société(s) cible : ${targets}
Unité : ${k.kpi_unit ?? "à déduire"}
Catégorie : ${k.kpi_category}
Style de présentation : ${k.style} (${k.chart_type})

Description / consigne Yann :
${k.description ?? "(rien fourni — utilise ton jugement, prends la métrique la plus pertinente)"}

INSTRUCTIONS STRICTES
1. Cherche les valeurs DANS LES RAPPORTS OFFICIELS de la société d'abord (10-K, 10-Q,
   8-K, earnings releases, slides). Si non trouvé dans les docs : sources reconnues
   (IDC, Statista, Counterpoint, Strategy Analytics, Visible Alpha, S&P Capital IQ).
2. Pour chaque point d'historique annuel ou trimestriel :
   - Si valeur OFFICIELLE → uncertainty_pct = null
   - Si ESTIMATION analyste → uncertainty_pct = ±X (5 / 10 / 15 selon dispersion)
   - source = citation précise (ex "Apple 10-K FY23 p.42")
3. JAMAIS inventer. Si zéro source crédible pour une année → omettre la ligne.
4. Réponds UNIQUEMENT en JSON valide, format strict ci-dessous.
5. Pour les CHAMPS TRADUITS (kpi_name_i18n, hero_summary_i18n,
   interpretation_i18n), donne les 8 langues exactes : fr, en, de, nl,
   sv, da, en-GB, de-CH. Si pas de différence en-GB vs en → copie de en.
   Si pas de différence de-CH vs de → copie de de. Aucun em-dash (—).

\`\`\`json
{
  "values_by_period": [
    {"period": "2020", "value": 196.7, "uncertainty_pct": null, "source": "Apple 10-K FY20"},
    {"period": "2021", "value": 235.4, "uncertainty_pct": null, "source": "Apple 10-K FY21"},
    {"period": "2022", "value": 226.5, "uncertainty_pct": 5, "uncertainty_note": "Apple a cessé de publier, estimation IDC", "source": "IDC tracker Q4 2022"}
  ],
  "kpi_name_i18n": {
    "fr": "Unités iPhone vendues",
    "en": "iPhone units sold",
    "de": "Verkaufte iPhone-Einheiten",
    "nl": "Verkochte iPhone-eenheden",
    "sv": "Sålda iPhone-enheter",
    "da": "Solgte iPhone-enheder",
    "en-GB": "iPhone units sold",
    "de-CH": "Verkaufte iPhone-Einheiten"
  },
  "hero_summary_i18n": {
    "fr": "1 phrase max 18 mots avec la valeur la plus récente.",
    "en": "1 sentence max 18 words with the latest value.",
    "de": "...", "nl": "...", "sv": "...", "da": "...",
    "en-GB": "...", "de-CH": "..."
  },
  "interpretation_i18n": {
    "fr": "2 phrases : drivers + signal pour l'investisseur.",
    "en": "2 sentences: drivers + signal for the investor.",
    "de": "...", "nl": "...", "sv": "...", "da": "...",
    "en-GB": "...", "de-CH": "..."
  },
  "yoy_latest": "+5,2 %",
  "cagr_5y_pct": 3.8,
  "data_source": "Apple 10-K FY20-24 + IDC tracker 2022-2024"
}
\`\`\`

Aucun texte hors du JSON.`;
}
