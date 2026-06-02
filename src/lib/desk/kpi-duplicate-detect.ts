/**
 * kpi-duplicate-detect — détecte si un finding "Graphiques et Schémas de
 * sources diverses" fait doublon avec un KPI déjà publié dans Mettrik
 * pour la même société (KPI normal ou story).
 *
 * Approche : pour chaque ticker cible du finding, on charge la sté via
 * loadV17Company et on compare les "keywords" extraits du title+summary
 * du finding avec les KPI existants (short + name_fr + name_en + nature).
 *
 * Renvoie une liste de matches : { ticker, kpi_short, similarity, reason }.
 * Yann 16 mai 2026 : "détecte les graph qui feraient doublons avec les
 * KPI déjà présents (dans KPI normaux ou story)".
 */
import { loadV17Company } from "@/lib/company-core/load-company";

export type DuplicateMatch = {
  ticker: string;
  kpi_short: string;
  kpi_name: string;
  match_terms: string[];
  is_story: boolean;
};

// Termes "topiques" courants extraits des findings → match dans KPI nature/short/name
const TOPIC_KEYWORDS: Record<string, string[]> = {
  // Audience / users
  users: ["maus", "mau", "dau", "users", "utilisateurs", "audience", "abonnés", "subscribers"],
  // Trafic
  traffic: ["traffic", "trafic", "visits", "visites", "pageviews"],
  // Marché
  market_share: ["market share", "part de marché", "share of", "% market"],
  // Revenu / chiffre d'affaires
  revenue: ["revenue", "chiffre d'affaires", "ca", "revenu", "sales", "ventes"],
  // Croissance
  growth: ["growth", "croissance", "yoy", "mom", "cagr", "yo y"],
  // App perf
  app_perf: ["app performance", "downloads", "store downloads", "téléchargements"],
  // Ads / monétisation
  ads: ["ads", "ad revenue", "publicité", "ctr", "advertising"],
  // Capex / efficience
  efficiency: ["revenue per employee", "ca par employé", "efficiency"],
  // Adoption
  adoption: ["adoption", "rollout", "deployment", "pénétration"],
};

function topicsFromText(text: string): string[] {
  const t = text.toLowerCase();
  const topics: string[] = [];
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some((kw) => t.includes(kw))) topics.push(topic);
  }
  return topics;
}

function topicsFromKpi(short: string, nameFr?: string, nameEn?: string): string[] {
  const text = [short, nameFr, nameEn].filter(Boolean).join(" ").toLowerCase();
  return topicsFromText(text);
}

/**
 * Détecte les doublons d'un finding contre les KPI publiés d'une liste
 * de sté. Retourne un array de matches (peut être vide).
 */
export async function detectDuplicates(
  findingTitle: string,
  findingSummary: string | null,
  findingCaption: string | null,
  targetTickers: string[],
): Promise<DuplicateMatch[]> {
  const findingText = [findingTitle, findingSummary, findingCaption].filter(Boolean).join(" ");
  const findingTopics = new Set(topicsFromText(findingText));
  if (findingTopics.size === 0) return [];

  const matches: DuplicateMatch[] = [];

  for (const ticker of targetTickers) {
    let company;
    try {
      company = await loadV17Company(ticker);
    } catch {
      continue;
    }
    if (!company) continue;

    // Cast loose : kpis array can vary
    const kpis = (company as unknown as { kpis?: Array<Record<string, unknown>> }).kpis ?? [];
    for (const k of kpis) {
      const short = String(k.short ?? "");
      const nameFr = k.name_fr ? String(k.name_fr) : undefined;
      const nameEn = k.name_en ? String(k.name_en) : undefined;
      if (!short) continue;
      const kpiTopics = new Set(topicsFromKpi(short, nameFr, nameEn));
      const shared = [...findingTopics].filter((t) => kpiTopics.has(t));
      if (shared.length >= 1) {
        // ≥1 topic en commun = potentiel doublon
        matches.push({
          ticker,
          kpi_short: short,
          kpi_name: nameFr || nameEn || short,
          match_terms: shared,
          is_story: Boolean(k.is_short_history),
        });
      }
    }
  }
  return matches;
}
