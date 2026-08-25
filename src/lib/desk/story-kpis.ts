/**
 * story-kpis.ts — file de création de KPI "story" à partir d'une SOURCE WEB
 * (article, page investisseurs, communiqué) ou d'un POST X (lien du post).
 *
 * Yann 26 août 2026. Troisième outil de création, à côté de :
 *   - kpi-builder    → KPI intégré au tableau "Indicateurs clés"
 *   - special-kpis   → bloc graphique dédié
 *   - story-kpis     → carte du bloc "Stories" (celui-ci)
 *
 * Le principe diffère des deux autres : ici la donnée ne vient pas d'un
 * filing, mais d'une URL fournie à la main. Le texte est récupéré côté
 * serveur, un modèle en extrait UN chiffre marquant, et la source reste
 * attachée à la carte pour rester vérifiable.
 *
 * Table : public.desk_story_kpis (migration 20260826_desk_story_kpis.sql).
 */

import { createClient } from "@supabase/supabase-js";

export type StoryKpiStatus = "draft" | "in_progress" | "done" | "error" | "published";
export type StoryKpiSourceKind = "web" | "x";

export type StoryKpi = {
  id: string;
  ticker: string;
  /** URL de l'article ou du post X. Seule entrée obligatoire avec le ticker. */
  source_url: string;
  source_kind: StoryKpiSourceKind;
  /** Auteur du post X ou nom du média, rempli à l'extraction. */
  source_label: string | null;
  source_published_at: string | null;
  /** Consigne libre de Yann ("garde le chiffre d'abonnés", ...). */
  hint: string | null;

  kpi_short: string | null;
  kpi_name_fr: string | null;
  kpi_name_en: string | null;
  kpi_value: number | null;
  kpi_unit: string | null;
  /** Période de référence normalisée ("Q2-2026", "FY2025"). */
  kpi_period: string | null;
  /** Phrase courte affichée sous le chiffre dans la carte story. */
  signal_fr: string | null;
  signal_en: string | null;
  /** Citation exacte de la source, pour vérification. */
  evidence: string | null;
  /** Famille d'affichage (voir STORY_FAMILIES). */
  family: string | null;

  status: StoryKpiStatus;
  error_msg: string | null;
  llm_raw: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Familles de rangement des stories. Elles servent à regrouper les cartes
 * quand une société en accumule beaucoup (Alphabet en a déjà 19).
 */
export const STORY_FAMILIES = [
  { key: "usage", label_fr: "Usage & audience", label_en: "Usage & audience" },
  { key: "clients", label_fr: "Clients & abonnés", label_en: "Customers & subscribers" },
  { key: "capacite", label_fr: "Capacité & production", label_en: "Capacity & output" },
  { key: "innovation", label_fr: "Innovation & lancements", label_en: "Innovation & launches" },
  { key: "marche", label_fr: "Position de marché", label_en: "Market position" },
  { key: "operations", label_fr: "Opérations & efficacité", label_en: "Operations & efficiency" },
  { key: "jalons", label_fr: "Jalons financiers", label_en: "Financial milestones" },
  { key: "risques", label_fr: "Risques & litiges", label_en: "Risks & litigation" },
] as const;

export type StoryFamilyKey = (typeof STORY_FAMILIES)[number]["key"];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role non configuré");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Un lien x.com / twitter.com est traité comme un post, le reste comme du web. */
export function detectSourceKind(url: string): StoryKpiSourceKind {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(url.trim()) ? "x" : "web";
}

export async function listStoryKpis(ticker?: string): Promise<StoryKpi[]> {
  const supa = admin();
  let q = supa.from("desk_story_kpis").select("*").order("created_at", { ascending: false });
  if (ticker) q = q.eq("ticker", ticker.toUpperCase());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StoryKpi[];
}

export async function getStoryKpi(id: string): Promise<StoryKpi | null> {
  const supa = admin();
  const { data } = await supa.from("desk_story_kpis").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as StoryKpi | null;
}

export async function upsertStoryKpi(payload: Partial<StoryKpi>): Promise<StoryKpi> {
  const supa = admin();
  const row = {
    ...payload,
    ticker: payload.ticker ? payload.ticker.toUpperCase() : undefined,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supa
    .from("desk_story_kpis")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as StoryKpi;
}

export async function deleteStoryKpi(id: string): Promise<void> {
  const supa = admin();
  const { error } = await supa.from("desk_story_kpis").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Consigne d'extraction. Le modèle ne doit JAMAIS calculer ni compléter :
 * soit le chiffre est écrit dans la source, soit il rend null.
 */
export function buildStoryPrompt(kpi: StoryKpi, pageText: string): string {
  return [
    "Tu extrais UN SEUL indicateur marquant d'un texte, pour une carte de type story.",
    "",
    `Société : ${kpi.ticker}`,
    kpi.hint ? `Consigne : ${kpi.hint}` : "Consigne : prends le chiffre le plus marquant et le plus concret.",
    "",
    "RÈGLES STRICTES",
    "- Le chiffre doit être écrit tel quel dans le texte. Aucun calcul, aucune estimation.",
    "- Priorité aux indicateurs NON financiers et concrets (utilisateurs, abonnés, unités,",
    "  capacité, trajets, vues, sièges, sites). Un montant n'est retenu que s'il constitue",
    "  un jalon explicite.",
    "- `evidence` doit être la phrase exacte du texte contenant le chiffre.",
    "- Si aucun chiffre ne convient, renvoie value: null et explique dans signal_fr.",
    "",
    `Familles possibles : ${STORY_FAMILIES.map((f) => f.key).join(", ")}`,
    "",
    "Réponds en JSON pur, sans commentaire :",
    "{",
    '  "kpi_short": "code_court_en_anglais",',
    '  "kpi_name_fr": "nom en francais",',
    '  "kpi_name_en": "name in english",',
    '  "value": 950,',
    '  "unit": "M utilisateurs",',
    '  "period": "Q2-2026",',
    '  "signal_fr": "une phrase de contexte",',
    '  "signal_en": "one sentence of context",',
    '  "evidence": "phrase exacte du texte",',
    '  "family": "usage",',
    '  "source_label": "auteur ou media",',
    '  "source_published_at": "2026-07-22"',
    "}",
    "",
    "TEXTE SOURCE :",
    pageText.slice(0, 12000),
  ].join("\n");
}
