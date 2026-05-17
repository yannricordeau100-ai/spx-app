/**
 * load-company.ts — chargement et enrichissement d'une fiche société V1.7.
 *
 * Lit `src/data/v2-pipeline/<ticker>.json` (extraction CONV-DATA) puis
 * enrichit avec les fichiers latéraux produits par CONV-SYSTEMS qui ne
 * doivent pas écraser le dataset principal :
 *
 *   - `src/data/v2-pipeline-enrich/<ticker>.tam.json` → market_positions
 *     (TAM honesty rule, batch nuit du 5→6 mai 2026)
 *   - `src/data/v2-pipeline-enrich/<ticker>.json` (futur) → events,
 *     revenue_by_segment, revenue_by_geography (scope CONV-SYSTEMS)
 *   - `src/data/transcripts/<TICKER>.json` → transcript story bloc
 *
 * Auto-applique le filtre admission Pass 3 strict via `isStrictPass3`. Si
 * la sté n'est pas Pass 3 → renvoie `null` (la route appelle alors notFound
 * ou un "Fiche en préparation").
 *
 * Intentionnellement pur lecture FS : pas de cache mémoire (Yann ne veut
 * pas de stale data après un rebuild de pipeline). Next.js cache la route
 * via `revalidate` quand pertinent.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Company, CompanyRisk } from "@/lib/data";
import { enhanceFreshness } from "@/lib/v1-7/enhance-freshness";
import { isStrictPass3, isV18Eligible } from "@/lib/v1-7/strict-pass3";

type AnyKPI = Record<string, unknown>;
type AnyCo = Record<string, unknown>;

function normalizeHistory(h: unknown): number[] {
  if (!Array.isArray(h)) return [];
  return h
    .map((item) => {
      if (typeof item === "number") return item;
      if (item && typeof item === "object" && "value" in item) {
        const v = (item as { value: unknown }).value;
        return typeof v === "number" ? v : Number(v);
      }
      return Number(item);
    })
    .filter((v) => Number.isFinite(v));
}

/**
 * Coercion défensive sur tout le dataset d'une sé. Yann 7 mai 2026 : 27 %
 * des sés ont au moins un défaut de type silencieux (governance.top_capital
 * null, hero unit null, history null, etc). Plutôt que d'attendre que
 * CONV-DATA corrige toutes ces données, on coerce ici à la lecture pour
 * que la UI ne soit jamais exposée à des null inattendus → composants
 * crash, "Fiche en préparation" silencieux, etc.
 *
 * Les composants downstream peuvent supposer que les types sont stables.
 *
 * Retour : la même donnée mais avec :
 *  - hero_kpi normalisé via fuzzy match si exact short pas trouvé
 *  - hero KPI string fields coercés ("" si null) → laisse le filtre Pass 3
 *    décider de l'admission, mais évite les crash render
 *  - hero KPI history coercé en []
 *  - governance.top_capital / top_voting coercés en []
 *  - ai_positioning supprimé si stance null (= absent)
 *  - market_positions[].slices coercés en [] si null
 */
function sanitizeCompanyData(data: AnyCo): AnyCo {
  // 1. Hero KPI : si hero_kpi pointe sur un short qui n'existe pas, on
  //    cherche un fuzzy match (substring case-insensitive). Sinon kpis[0].
  const kpis = (data.kpis as AnyKPI[] | undefined) ?? [];
  const heroShort = data.hero_kpi as string | undefined;
  if (heroShort && kpis.length > 0) {
    const exact = kpis.find((k) => k.short === heroShort);
    if (!exact) {
      const heroLow = heroShort.toLowerCase();
      const fuzzy = kpis.find((k) => {
        const s = String(k.short ?? "").toLowerCase();
        return s && (heroLow.includes(s) || s.includes(heroLow));
      });
      if (fuzzy) {
        // Réécrit hero_kpi pour pointer sur le short réel trouvé
        data.hero_kpi = fuzzy.short as string;
      } else if (kpis[0]?.short) {
        data.hero_kpi = kpis[0].short as string;
      }
    }
  }

  // 2. Coerce KPIs : null → defaults, history non-array → [].
  if (Array.isArray(data.kpis)) {
    data.kpis = data.kpis.map((k) => {
      const out = { ...(k as AnyKPI) };
      // Strings critiques : si null → "" pour ne pas crasher formatUnit() etc.
      // (le filtre Pass 3 rejettera la sé si vraiment vide.)
      for (const field of ["unit", "type", "name_fr", "name_en", "explanation", "signal", "description", "comparable", "nature"]) {
        if (out[field] === null) out[field] = "";
      }
      // history null → [].
      if (out.history === null || out.history === undefined) {
        out.history = [];
      } else if (Array.isArray(out.history)) {
        out.history = normalizeHistory(out.history);
      } else {
        out.history = [];
      }
      // Yann 14 mai 2026 : si la direction history first→last contredit
      // le sign du yoy (ex Tesla Cash [44.1, 36.6] mais yoy +20.54%),
      // on inverse l'history côté affichage. Bug détecté sur 75/200
      // stés. Évite le sparkline qui descend alors que yoy monte.
      const yoyStr = typeof out.yoy === "string" ? out.yoy : "";
      if (yoyStr && Array.isArray(out.history) && out.history.length >= 2) {
        const yoyN = Number(yoyStr.replace("%", "").replace(",", ".").replace("+", "").trim());
        const h = out.history as number[];
        const first = h[0];
        const last = h[h.length - 1];
        if (Number.isFinite(yoyN) && Math.abs(yoyN) > 5 && first > 0 && last > 0) {
          const trendPct = ((last - first) / Math.abs(first)) * 100;
          // Disagrément de signe ET amplitude significative ET premier point
          // est l'inverse du yoy → history en sens inverse → on reverse.
          if (Math.abs(trendPct) > 5 && (yoyN > 0) !== (trendPct > 0)) {
            out.history = [...h].reverse();
          }
        }
      }
      return out;
    });
  }

  // 3. Governance : top_capital / top_voting null → [].
  if (data.governance && typeof data.governance === "object") {
    const gov = data.governance as Record<string, unknown>;
    if (gov.top_capital === null || (gov.top_capital !== undefined && !Array.isArray(gov.top_capital))) {
      gov.top_capital = [];
    }
    if (gov.top_voting === null || (gov.top_voting !== undefined && !Array.isArray(gov.top_voting))) {
      gov.top_voting = [];
    }
  }

  // 4. AI positioning : si stance null → supprimer le bloc entier (la
  //    AIPositioningCard gère absent/présent, mais pas null à l'intérieur).
  const ai = data.ai_positioning as Record<string, unknown> | undefined;
  if (ai && (ai.stance === null || ai.stance === undefined) && (ai.evidence === null || (Array.isArray(ai.evidence) && ai.evidence.length === 0))) {
    delete data.ai_positioning;
  } else if (ai && ai.evidence !== undefined && !Array.isArray(ai.evidence)) {
    ai.evidence = [];
  }

  // 5. market_positions[].slices null → [].
  if (Array.isArray(data.market_positions)) {
    data.market_positions = (data.market_positions as Record<string, unknown>[]).map((mp) => {
      const out = { ...mp };
      if (out.slices === null || (out.slices !== undefined && !Array.isArray(out.slices))) {
        out.slices = [];
      }
      return out;
    });
  }

  // 6. Risks : si pas un array, supprimer.
  if (data.risks !== undefined && !Array.isArray(data.risks)) {
    delete data.risks;
  }

  return data;
}

async function readJsonOrNull<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type LoadOutcome =
  | { kind: "ready"; company: Company }
  | { kind: "preparing"; company: Pick<Company, "ticker" | "name"> }
  | { kind: "missing" };

/**
 * Charge la fiche pour un ticker donné. Trois résultats possibles :
 *  - `ready`     : fiche Pass 3 strict, prête à être rendue dans CompanyView.
 *  - `preparing` : ticker connu mais pas encore Pass 3 → "Fiche en préparation".
 *  - `missing`   : ticker inconnu → notFound.
 */
export async function loadV17Company(
  ticker: string,
  opts: { mode?: "v17" | "v18"; locale?: string } = {}
): Promise<LoadOutcome> {
  const ROOT = process.cwd();
  // Résolution doublons multi-classes : GOOG → GOOGL, NWSA → NWS, UAA → UA, etc.
  // Les variantes (Class A / B / C) doivent toutes pointer vers la même fiche.
  // On lit l'alias map runtime sans dépendance circulaire (data.ts est lourd
  // et déjà chargé via Company type).
  const ALIASES: Record<string, string> = {
    GOOG: "GOOGL",
    "BRK.A": "BRK-B",
    "BRK-A": "BRK-B",
    "BRK.B": "BRK-B",
    FOX: "FOXA",
    NWSA: "NWS",
    UAA: "UA",
    // Top 307 V1.8 doublons ADR/multi-listing (canonical = listing principale)
    ASMLF: "ASML",
    ABBNY: "ABBN.SW",
    ABLZF: "ABBN.SW",
    DTEGY: "DTEGF",
    ADTTF: "ATEYY",
    BPAQF: "BP",
    "BP.L": "BP",
    "NDA-DK.CO": "NDA-FI.HE",
    EDPFY: "EDP.LS",
    BCLYF: "BARC.L",
    BBVXF: "BBVA",
  };
  const upper = ticker.toUpperCase();
  const canonical = ALIASES[upper] ?? upper;
  const filePath = path.join(ROOT, "src/data/v2-pipeline", `${canonical.toLowerCase()}.json`);
  const raw = await readJsonOrNull<AnyCo>(filePath);
  if (!raw) return { kind: "missing" };

  // Normalise stories_kpis → kpis avec is_short_history flag
  const data = { ...raw } as AnyCo & { stories_kpis?: AnyKPI[]; kpis?: AnyKPI[] };
  if (Array.isArray(data.stories_kpis)) {
    const stories = data.stories_kpis.map((s) => ({ ...s, is_short_history: true }));
    data.kpis = [...(data.kpis || []), ...stories];
    delete data.stories_kpis;
  }

  // Normalise history (objet | nombre)
  if (Array.isArray(data.kpis)) {
    data.kpis = data.kpis.map((k) => ({
      ...k,
      history: normalizeHistory((k as AnyKPI).history),
    }));
  }

  // Defaults UI
  if (!data.logo_treatment) data.logo_treatment = "orbit";
  if (!data.ranks) data.ranks = { global_world: "-", global_us: "-", sector: "-", subsector: "-" };
  if (!data.tagline) data.tagline = "";

  // Coercion défensive contre les défauts de type CONV-DATA (cf. comment
  // de sanitizeCompanyData ci-dessus). 27 % des sés en avaient au moins
  // un avant ce fix.
  sanitizeCompanyData(data);

  // Enrichissement ranks : merge depuis `v2-pipeline-enrich/<ticker>.ranks.json`
  // produit par `scripts/enrich-ranks-v2.py` (CONV-MODULE-RANKS-V2, 8 mai 2026).
  // PRIORITÉ : ranks.json gagne sur v2-pipeline. Raison : les ranks
  // v2-pipeline sont des extractions LLM des 10-K (texte narratif, ex
  // "NVDA = ≈ #10 mondial") et sont périmés / faux. Le fichier
  // ranks.json est calculé à partir du market_cap live yfinance + FX
  // USD, source objective et fraîche.
  const ranksPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.ranks.json`,
  );
  const ranksEnrich = await readJsonOrNull<{ ranks?: Record<string, string> }>(ranksPath);
  if (ranksEnrich?.ranks) {
    const cur = (data.ranks as Record<string, unknown>) || {};
    for (const k of ["global_world", "global_us", "sector", "subsector"] as const) {
      if (ranksEnrich.ranks[k]) {
        cur[k] = ranksEnrich.ranks[k];
      }
    }
    data.ranks = cur;
  }

  // Filtre admission : V1.7 strict OU V1.8 relaxé selon le mode demandé.
  // V1.8 = juste Pass 3 Sonnet + hero usable, blocs manquants montrés en
  // placeholder rouge dans la UI (Yann 7 mai 2026).
  const eligible = opts.mode === "v18" ? isV18Eligible(data) : isStrictPass3(data);
  if (!eligible) {
    return {
      kind: "preparing",
      company: {
        ticker: String(data.ticker ?? ticker.toUpperCase()),
        name: String(data.name ?? ticker.toUpperCase()),
      },
    };
  }

  // Enrichissement TAM (batch nuit 5→6 mai 2026 produit
  // src/data/v2-pipeline-enrich/<ticker>.tam.json séparément pour ne pas
  // écraser le pipeline. Merge ici si présent ET la fiche n'a pas déjà
  // ses propres market_positions). TAM honesty rule respectée par le batch.
  if (!Array.isArray((data as Record<string, unknown>).market_positions)) {
    const tamPath = path.join(
      ROOT,
      "src/data/v2-pipeline-enrich",
      `${ticker.toLowerCase()}.tam.json`,
    );
    const tam = await readJsonOrNull<{ market_positions?: unknown }>(tamPath);
    if (tam && Array.isArray(tam.market_positions) && tam.market_positions.length > 0) {
      (data as Record<string, unknown>).market_positions = tam.market_positions;
    }
  }

  // Enrichissement générique (events, revenue_by_segment, revenue_by_geography,
  // stories_kpis additionnels…) depuis v2-pipeline-enrich/<ticker>.json si
  // présent (sans écraser).
  const enrichPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.json`,
  );
  const enrich = await readJsonOrNull<Record<string, unknown>>(enrichPath);

  // Mettrik description (simple + advanced × 3 langues) : fichier séparé
  // `.description.json` (Yann 14 mai 2026). Gemini 2.5 Flash, distinct
  // de l'ancienne `company_description` yfinance. Merge dans la company
  // sous `mettrik_description` (toujours, prioritaire sur yfinance).
  const descPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.description.json`,
  );
  const descFile = await readJsonOrNull<{
    simple?: { fr?: string; en?: string; de?: string };
    advanced?: { fr?: string; en?: string; de?: string };
  }>(descPath);
  if (descFile && descFile.simple && descFile.advanced) {
    (data as Record<string, unknown>).mettrik_description = {
      simple: descFile.simple,
      advanced: descFile.advanced,
    };
  }

  // AI positioning v2 : fichier séparé .ai-pos.json (Yann 8 mai 2026,
  // process amélioré qui combine 10-K + transcripts + Anthropic Haiku).
  // S'il existe et que le dataset CONV-DATA n'a pas d'ai_positioning ou
  // a un "absent" (10-K-only minimisé), on prend le .ai-pos.json.
  const aiPosPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.ai-pos.json`,
  );
  const aiPosV2 = await readJsonOrNull<Record<string, unknown>>(aiPosPath);
  if (aiPosV2) {
    const cur = (data as Record<string, unknown>).ai_positioning as
      | Record<string, unknown>
      | undefined;
    const curStance = cur?.stance;
    const curEvidence = Array.isArray(cur?.evidence) ? cur?.evidence : [];
    const v2Stance = aiPosV2.stance;
    const v2Evidence = Array.isArray(aiPosV2.evidence) ? aiPosV2.evidence : [];
    // Override si v2 a plus d'evidence ou si v1 disait "absent" / vide.
    const v1Weak =
      !cur ||
      curStance === "absent" ||
      curStance === null ||
      curEvidence.length < (v2Evidence as unknown[]).length;
    if (v1Weak && v2Stance) {
      (data as Record<string, unknown>).ai_positioning = {
        stance: v2Stance,
        summary: aiPosV2.summary,
        evidence: v2Evidence,
        source_note: aiPosV2.source_note,
      };
    }
  }
  if (enrich) {
    for (const key of [
      "events",
      "revenue_by_segment",
      "revenue_by_geography",
      "profit_warning",
      "company_description",
      "financial_snapshot",
      "key_facts",
      "peers",
      "latest_filing",
    ] as const) {
      if (
        enrich[key] !== undefined &&
        (data as Record<string, unknown>)[key] === undefined
      ) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Risks / governance / AI positioning : merge SEULEMENT si la fiche
    // CONV-DATA ne les a pas déjà fournis. Évite de doubler des données.
    for (const key of ["risks", "governance", "ai_positioning"] as const) {
      const existing = (data as Record<string, unknown>)[key];
      const empty =
        existing === undefined ||
        existing === null ||
        (Array.isArray(existing) && existing.length === 0);
      if (empty && enrich[key] !== undefined) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Stories KPIs : ajout APPEND. CONV-SYSTEMS produit des KPIs short-history
    // additionnels (ex : Netflix ad-tier MAU, Live hours) qui complètent ceux
    // de CONV-DATA. Tag is_short_history forcé à true côté carrousel Stories.
    if (Array.isArray(enrich.stories_kpis) && Array.isArray(data.kpis)) {
      const extraStories = enrich.stories_kpis.map((s) => ({
        ...(s as AnyKPI),
        is_short_history: true,
        history: normalizeHistory((s as AnyKPI).history),
      }));
      data.kpis = [...data.kpis, ...extraStories];
    }
    // KPIs additionnels (ex : DividendStories CONV-DIV — DPS / Cap Return /
    // Payout Ratio). APPEND si le `short` n'existe pas déjà dans CONV-DATA.
    if (Array.isArray(enrich.kpis) && Array.isArray(data.kpis)) {
      const existingShorts = new Set(
        (data.kpis as AnyKPI[]).map((k) => k?.short).filter(Boolean),
      );
      const extraKpis = (enrich.kpis as AnyKPI[])
        .filter((k) => k && typeof k === "object" && !existingShorts.has(k.short))
        .map((k) => ({ ...k, history: normalizeHistory(k.history) }));
      if (extraKpis.length > 0) {
        data.kpis = [...data.kpis, ...extraKpis];
      }
    }
    // Yann 15 mai 2026 v2 : RÉACTIVÉ avec contrainte stricte.
    // Le merge accepte SEULEMENT les fichiers .quarterly-history.json
    // marqués method="xbrl-companyfacts" (extraction directe XBRL SEC EDGAR,
    // chiffres taggés par la sté elle-même). Tout fichier sans cette
    // marque (= ancien script LLM Cerebras qui hallucinait) est ignoré.
    const qPath = path.join(
      ROOT,
      "src/data/v2-pipeline-enrich",
      `${ticker.toLowerCase()}.quarterly-history.json`,
    );
    const qExt = await readJsonOrNull<{
      method?: string;
      kpis?: Array<{
        short: string;
        period_type?: string;
        history?: number[];
        history_periods?: string[];
        last_data_date?: string;
        unit?: string | null;
      }>;
    }>(qPath);
    if (
      qExt
      && qExt.method === "xbrl-companyfacts"
      && Array.isArray(qExt.kpis)
      && Array.isArray(data.kpis)
    ) {
      const extByShort = new Map(
        qExt.kpis.filter((k) => k && k.short).map((k) => [k.short, k] as const),
      );
      data.kpis = (data.kpis as AnyKPI[]).map((k) => {
        const ext = extByShort.get(String(k.short));
        if (!ext || !Array.isArray(ext.history) || ext.history.length === 0) return k;
        const curHist = Array.isArray(k.history) ? (k.history as number[]) : [];
        // Yann 16 mai 2026 : merge intelligent.
        // Si ext (XBRL) > cur (CONV-DATA) : prend ext comme base.
        // PUIS si CONV-DATA a un last_data_date plus récent ET des quarters
        // au-delà de ext.last_data_date, on les APPEND. Évite de perdre
        // Q1 2026 quand l'extracteur XBRL s'arrête à Q4 2025 alors que la
        // sté a déjà publié Q1 2026 via 10-Q.
        const useExt = ext.history.length > curHist.length;
        const baseHist = useExt ? ext.history : curHist;
        const baseLast = useExt ? ext.last_data_date : (k as AnyKPI & { last_data_date?: string }).last_data_date;
        const otherLast = useExt ? (k as AnyKPI & { last_data_date?: string }).last_data_date : ext.last_data_date;
        const otherHist = useExt ? curHist : ext.history;
        let mergedHist = [...baseHist];
        let mergedLast = baseLast;
        const baseDate = typeof baseLast === "string" ? new Date(baseLast) : null;
        const otherDate = typeof otherLast === "string" ? new Date(otherLast) : null;
        if (baseDate && otherDate && !Number.isNaN(baseDate.getTime()) && !Number.isNaN(otherDate.getTime()) && otherDate > baseDate) {
          // Combien de quarters between baseDate (exclu) et otherDate (inclus) ?
          const monthsDiff = (otherDate.getUTCFullYear() - baseDate.getUTCFullYear()) * 12 + (otherDate.getUTCMonth() - baseDate.getUTCMonth());
          const qDiff = Math.max(0, Math.round(monthsDiff / 3));
          if (qDiff > 0 && otherHist.length >= qDiff) {
            const tail = otherHist.slice(-qDiff);
            mergedHist = [...baseHist, ...tail];
            mergedLast = otherLast;
          }
        }
        if (!useExt && mergedHist === baseHist) return k;
        return {
          ...k,
          history: mergedHist,
          history_periods: ext.history_periods,
          period_type: ext.period_type ?? k.period_type ?? "quarter",
          last_data_date: mergedLast ?? k.last_data_date,
          unit: ext.unit ?? k.unit,
        } as AnyKPI;
      });
    }
    // KPIs SPÉCIAUX (Yann 14 mai 2026) — fetch BDD desk_special_kpis publiés
    // pour ce ticker. APPEND comme indicateurs clés ou remplace hero si is_hero.
    // Convertit le format desk_special_kpis → KPI standard.
    try {
      const { listPublishedForTicker } = await import("@/lib/desk/special-kpis");
      const specials = await listPublishedForTicker(ticker);
      if (Array.isArray(specials) && specials.length > 0 && Array.isArray(data.kpis)) {
        const existingShorts = new Set(
          (data.kpis as AnyKPI[]).map((k) => k?.short).filter(Boolean),
        );
        for (const sp of specials) {
          if (!sp.kpi_short || existingShorts.has(sp.kpi_short)) continue;
          const pts = sp.data?.values_by_period ?? [];
          if (pts.length === 0) continue;
          const latest = pts[pts.length - 1];
          const history = pts.map((p) => p.value);
          const periods = pts.map((p) => p.period);
          const kpi: AnyKPI = {
            short: sp.kpi_short,
            name_fr: sp.kpi_name_fr ?? sp.kpi_short,
            name_en: sp.kpi_name_en ?? sp.kpi_short,
            value: latest.value,
            unit: sp.kpi_unit ?? "",
            yoy: sp.data?.yoy_latest ?? null,
            type: sp.kpi_category ?? "Volume",
            nature: "extracted",
            comparable: false,
            history,
            history_periods: periods,
            period_type: "annual",
            signal: sp.data?.hero_summary ?? "",
            description: sp.data?.interpretation ?? "",
            explanation: sp.kpi_name_fr ?? sp.kpi_short,
            is_wow: true,
            is_short_history: pts.length < 5,
            story_category: sp.story_category ?? undefined,
            // Incertitudes annotées par point — utilisé par charts pour
            // afficher un "i" jaune sur les points concernés.
            uncertainty_by_period: pts
              .filter((p) => p.uncertainty_pct)
              .map((p) => ({
                period: p.period,
                pct: p.uncertainty_pct,
                note: p.uncertainty_note,
                source: p.source,
              })),
            _special_kpi_id: sp.id,
            _data_source: sp.data_source ?? null,
          } as AnyKPI;
          data.kpis = [...(data.kpis as AnyKPI[]), kpi];
          existingShorts.add(sp.kpi_short);
          // Si is_hero : remplace le hero_kpi de la company.
          if (sp.is_hero && sp.style === "classique") {
            (data as Record<string, unknown>).hero_kpi = sp.kpi_short;
          }
        }
      }
    } catch (err) {
      // Fail-safe : si BDD inaccessible, on continue sans special KPIs.
      console.warn(`special_kpis merge failed for ${ticker}:`, err);
    }
    // Image findings approuvés (Yann 15 mai 2026) — bloc "Graphiques et
    // Schémas de sources diverses".
    try {
      const { listApprovedForTicker } = await import("@/lib/desk/image-findings");
      const findings = await listApprovedForTicker(ticker);
      if (Array.isArray(findings) && findings.length > 0) {
        (data as Record<string, unknown>).image_findings = findings.map((f) => ({
          id: f.id,
          image_url: f.image_url,
          title: f.title,
          caption: f.caption,
          summary: f.summary,
          // i18n (FR/EN/DE) — picked côté UI selon locale active
          title_i18n: f.title_i18n,
          summary_i18n: f.summary_i18n,
          source_url: f.source_url,
          source_author: f.source_author,
          source_handle: f.source_handle,
          source_date: f.source_date,
          source_platform: f.source_platform,
          // Toggle sandbox admin (Yann 17 mai 2026) : default true.
          show_summary: f.show_summary !== false,
        }));
      }
    } catch (err) {
      console.warn(`image_findings merge failed for ${ticker}:`, err);
    }
    // Exhaustive extract (CONV-DEPAN 16 mai 2026) : merge le JSON
    // 18-domaines `v2-pipeline-exhaustive/<ticker>.json` (Haiku/Sonnet)
    // dans `company.exhaustive`. Les nouveaux blocs UI peuvent consommer
    // financials.balance_sheet, segments[].growth_yoy, events_milestones,
    // kpis_proprietary, esg structuré, etc. sans nouveau Pass LLM.
    // Optionnel : ne casse rien si fichier absent.
    try {
      const exhaustivePath = path.join(
        process.cwd(),
        "src/data/v2-pipeline-exhaustive",
        `${ticker.toLowerCase()}.json`,
      );
      const exhaustive = await readJsonOrNull<Record<string, unknown>>(exhaustivePath);
      if (exhaustive && typeof exhaustive === "object") {
        (data as Record<string, unknown>).exhaustive = exhaustive;
      }
    } catch (err) {
      console.warn(`exhaustive merge failed for ${ticker}:`, err);
    }
    // dividend_meta : propagé tel quel à la company (utilisé par
    // DividendAristocratCard pour calculer yearsStreak depuis first_year).
    // CONV-DIV 9 mai 2026.
    if (
      enrich.dividend_meta &&
      typeof enrich.dividend_meta === "object" &&
      !Array.isArray(enrich.dividend_meta)
    ) {
      (data as Record<string, unknown>).dividend_meta = enrich.dividend_meta;
    }
    // Sync Headcount KPI ↔ key_facts.employees_count (Yann 10 mai 2026).
    // Bug NVDA : KPI affiche 26.3 K (10-K FY2024) mais "Profil société" via
    // yfinance dit 42 000 (à jour). On aligne la valeur affichée du KPI sur
    // la source la plus récente (yfinance/key_facts), en gardant l'history
    // historique pour le graph.
    const kf = (data as Record<string, unknown>).key_facts as
      | { employees_count?: number }
      | undefined;
    const empNow = kf?.employees_count;
    if (typeof empNow === "number" && empNow > 0 && Array.isArray(data.kpis)) {
      data.kpis = (data.kpis as AnyKPI[]).map((k) => {
        if (!k || typeof k !== "object") return k;
        const short = String(k.short ?? "").toLowerCase();
        const nameFr = String(k.name_fr ?? "").toLowerCase();
        const isHeadcount =
          short === "headcount" ||
          short === "employees" ||
          nameFr.includes("effectif") ||
          nameFr.includes("employé");
        if (!isHeadcount) return k;
        // Reformater la valeur courante avec la même unité que le KPI existant.
        const unit = String(k.unit ?? "K");
        const val = unit === "K" ? (empNow / 1000).toFixed(1).replace(".", ",") : String(empNow);
        const hist = Array.isArray(k.history) ? [...(k.history as number[])] : [];
        const lastHistVal = unit === "K" ? empNow / 1000 : empNow;
        // Append à l'history seulement si le dernier point diffère significativement
        if (hist.length === 0 || Math.abs(hist[hist.length - 1] - lastHistVal) / lastHistVal > 0.02) {
          hist.push(Number(lastHistVal.toFixed(2)));
        }
        return {
          ...k,
          value: val,
          history: hist,
          last_data_date: new Date().toISOString().slice(0, 10),
        };
      });
    }
  }

  // Yann 15 mai 2026 : overlay i18n KPI / tagline / risks pour les locales
  // autres que FR. Lit `src/data/v2-pipeline-i18n/<ticker>.<locale>.json`
  // produit par `scripts/translate-v17-kpis-to-de.py` (et variantes).
  // Locale "fr" = pas de merge (les fichiers source sont déjà en FR).
  // Cas pour les variantes : de-CH → de, en-GB → en, nl/sv/da → leur propre fichier.
  const requestedLocale = (opts.locale ?? "").toLowerCase();
  const localeMap: Record<string, string> = {
    "de": "de",
    "de-ch": "de",
    "en": "en",
    "en-gb": "en",
    "nl": "nl",
    "sv": "sv",
    "da": "da",
  };
  const i18nKey = localeMap[requestedLocale];
  if (i18nKey) {
    type I18nKpiTr = { short: string; name?: string; explanation?: string; description?: string; signal?: string };
    type I18nFile = {
      tagline?: string;
      hero_kpi_rationale?: string;
      kpis?: Array<I18nKpiTr>;
      risks?: Array<{ title?: string; description?: string; score_rationale?: string }>;
      governance?: { notes?: string };
      ai_positioning?: { summary?: string; evidence?: Array<{ short?: string; detail?: string; quote?: string }> };
    };
    const i18nPath = path.join(
      ROOT,
      "src/data/v2-pipeline-i18n",
      `${ticker.toLowerCase()}.${i18nKey}.json`,
    );
    const i18n = await readJsonOrNull<I18nFile>(i18nPath);
    // Yann 17 mai 2026 : fallback EN si la locale demandée n'est pas EN et
    // que le KPI/tagline/etc n'a pas de traduction dans le fichier locale-
    // specific. Évite l'affichage de FR sur les pages DE/NL/SV/DA/de-CH
    // pour les contenus pas encore traduits dans cette langue (typiquement
    // les KPIs enrich Cap Return / DPS / Payout qui n'étaient pas dans
    // _merged.json au moment du run des scripts trad).
    let enFallback: I18nFile | null = null;
    if (i18nKey !== "en") {
      const enPath = path.join(
        ROOT,
        "src/data/v2-pipeline-i18n",
        `${ticker.toLowerCase()}.en.json`,
      );
      enFallback = await readJsonOrNull<I18nFile>(enPath);
    }
    if (i18n || enFallback) {
      const d = data as Record<string, unknown>;
      if (i18n?.tagline) d.tagline = i18n.tagline;
      else if (enFallback?.tagline) d.tagline = enFallback.tagline;
      if (i18n?.hero_kpi_rationale) d.hero_kpi_rationale = i18n.hero_kpi_rationale;
      else if (enFallback?.hero_kpi_rationale) d.hero_kpi_rationale = enFallback.hero_kpi_rationale;
      // KPI overlay : locale-specific d'abord, fallback EN par KPI manquant.
      if (Array.isArray(data.kpis)) {
        const byShortLocale = new Map(
          (i18n?.kpis ?? []).filter((k) => k.short).map((k) => [k.short, k] as const),
        );
        const byShortEn = new Map(
          (enFallback?.kpis ?? []).filter((k) => k.short).map((k) => [k.short, k] as const),
        );
        data.kpis = (data.kpis as AnyKPI[]).map((k) => {
          const trLocale = byShortLocale.get(String(k.short));
          const trEn = byShortEn.get(String(k.short));
          // Pour chaque champ : locale > EN > original.
          const name = trLocale?.name || trEn?.name || k.name_fr;
          const explanation = trLocale?.explanation || trEn?.explanation || k.explanation;
          const description = trLocale?.description || trEn?.description || k.description;
          const signal = trLocale?.signal || trEn?.signal || k.signal;
          if (!trLocale && !trEn) return k;
          return {
            ...k,
            name_fr: name,
            explanation,
            description,
            signal,
          } as AnyKPI;
        });
      }
      // Risks overlay (match par index, alignment supposé identique).
      // Yann 17 mai 2026 : fallback EN par index si locale-specific manque.
      const risks = (data as Record<string, unknown>).risks;
      const localeRisks = i18n?.risks ?? [];
      const enRisks = enFallback?.risks ?? [];
      if ((localeRisks.length > 0 || enRisks.length > 0) && Array.isArray(risks)) {
        (data as Record<string, unknown>).risks = (risks as Array<Record<string, unknown>>).map(
          (r, idx) => {
            const tr = localeRisks[idx];
            const trEn = enRisks[idx];
            if (!tr && !trEn) return r;
            return {
              ...r,
              title: tr?.title || trEn?.title || r.title,
              description: tr?.description || trEn?.description || r.description,
              score_rationale: tr?.score_rationale || trEn?.score_rationale || r.score_rationale,
            };
          },
        );
      }
      // Governance notes
      const gov = (data as Record<string, unknown>).governance as Record<string, unknown> | undefined;
      if (gov) {
        if (i18n?.governance?.notes) gov.notes = i18n.governance.notes;
        else if (enFallback?.governance?.notes) gov.notes = enFallback.governance.notes;
      }
      // AI positioning summary + evidence.
      // Yann 15 mai 2026 : evidence vient dans 2 formats selon la source
      // (CONV-DATA enrich = array de strings, CONV-SYSTEMS = array d'objets
      // {short, detail, quote}). On évite donc le merge field-par-field
      // (qui crasherait sur string spread) et on remplace simplement par
      // la version traduite si présente. Même format en entrée et en sortie.
      // Yann 17 mai 2026 : fallback EN.
      const ai = (data as Record<string, unknown>).ai_positioning as Record<string, unknown> | undefined;
      if (ai) {
        if (i18n?.ai_positioning?.summary) ai.summary = i18n.ai_positioning.summary;
        else if (enFallback?.ai_positioning?.summary) ai.summary = enFallback.ai_positioning.summary;
        if (Array.isArray(i18n?.ai_positioning?.evidence)) {
          ai.evidence = i18n!.ai_positioning!.evidence;
        } else if (Array.isArray(enFallback?.ai_positioning?.evidence)) {
          ai.evidence = enFallback!.ai_positioning!.evidence;
        }
      }
    }
  }

  // Fresh / stale backfill via existing helper
  const company = enhanceFreshness(data as Company & Record<string, unknown>);

  // Sanity : si risks n'a pas score_rationale (V1.0 le requiert), on
  // laisse RiskStack rendre quand même mais sans le tooltip.
  if (Array.isArray(company.risks)) {
    company.risks = company.risks.map((r: CompanyRisk) => ({ ...r }));
  }

  return { kind: "ready", company };
}
