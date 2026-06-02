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

// Yann 18 mai 2026 : carte globale EN tagline → FR translation. Chargée
// lazy-une-fois par process. Utilisée pour peupler tagline_i18n.fr.
let TAGLINES_FR_CACHE: Record<string, string> | null = null;
async function loadTaglinesFr(): Promise<Record<string, string>> {
  if (TAGLINES_FR_CACHE) return TAGLINES_FR_CACHE;
  try {
    const fp = path.join(process.cwd(), "src/data/taglines-fr.json");
    const raw = await fs.readFile(fp, "utf-8");
    TAGLINES_FR_CACHE = JSON.parse(raw);
    return TAGLINES_FR_CACHE!;
  } catch {
    TAGLINES_FR_CACHE = {};
    return {};
  }
}

type AnyKPI = Record<string, unknown>;
type AnyCo = Record<string, unknown>;

/**
 * Mappe la catégorie KPI (telle que définie dans `desk_kpi_requests` /
 * `desk_special_kpis`) vers une des 4 natures canoniques utilisées par
 * l'UI Mettrik :
 *   - "Structurel"   : marges, coûts, R&D, capex (intrinsèque)
 *   - "Conjoncturel" : revenus, ventes, ARR (suit le cycle économique)
 *   - "Récurrent"    : dividendes, yield, payout (versement régulier)
 *   - "Cyclique"     : volumes, unités, abonnés, production (défaut)
 *
 * Si la catégorie n'est pas reconnue, fallback "Cyclique".
 */
function mapKpiCategoryToNature(
  category: string | null | undefined,
): "Structurel" | "Conjoncturel" | "Récurrent" | "Cyclique" {
  if (!category) return "Cyclique";
  const c = category.toLowerCase();
  // Récurrent (vérifié en premier car "Dividend Yield" contient "yield")
  if (
    c.includes("dividend") ||
    c.includes("yield") ||
    c.includes("payout")
  ) {
    return "Récurrent";
  }
  // Structurel : marges, coûts, dépenses intrinsèques
  if (
    c.includes("margin") ||
    c.includes("marge") ||
    c.includes("cost") ||
    c.includes("coût") ||
    c.includes("capex") ||
    c.includes("r&d") ||
    c.includes("r & d") ||
    c.includes("research")
  ) {
    return "Structurel";
  }
  // Conjoncturel : revenus, ventes, ARR
  if (
    c.includes("revenue") ||
    c.includes("revenus") ||
    c.includes("sales") ||
    c.includes("arr")
  ) {
    return "Conjoncturel";
  }
  // Cyclique : volumes, unités, production, abonnés
  if (
    c.includes("volume") ||
    c.includes("units") ||
    c.includes("unités") ||
    c.includes("production") ||
    c.includes("subscribers") ||
    c.includes("abonnés")
  ) {
    return "Cyclique";
  }
  return "Cyclique";
}

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
    // Phase 4 (30 mai 2026) : 89 aliases supplémentaires post-dédup
    // SP500+Top307 (most-data-wins + ADR US tie-break). Source :
    // /tmp/dedup-aliases.json généré par scripts/audit-duplicates.py
    // + curation Yann. Conserve uniquement le canonical avec le plus
    // de KPIs/data extraits.
    "ABB.ST": "ABLZF",
    ABVX: "AAVXF",
    "AIR.PA": "AIR.DE",
    "ALC.SW": "ALC",
    ALV: "ALIV-SDB.ST",
    ARBEW: "ARBE",
    "ARGX.BR": "ARGX",
    "ASML.AS": "ASML",
    ASRMF: "ASR",
    "ATCO-B.ST": "ATCO-A.ST",
    "AZN.L": "AZN",
    "AZN.ST": "AZN",
    "BAESF": "BA.L",
    "BAESY": "BA.L",
    "BATS.L": "BTAFF",
    "BBVA.MC": "BBVA",
    BCS: "BARC.L",
    "BMW.DE": "BMWYY",
    "BN.PA": "BNPQY",
    "BNP.PA": "BNPQY",
    "BNPQF": "BNPQY",
    BTI: "BTAFF",
    "BUD": "ABI.BR",
    "BVI.PA": "BVRDF",
    "CRH.L": "CRH",
    "CS.PA": "CSGKF",
    "DANSKE.CO": "DNKEY",
    DEGAF: "DGEAF",
    "DEO": "DGEAF",
    DGEAY: "DGEAF",
    "DG.PA": "VCISY",
    DTGHF: "DTG.DE",
    "EL": "EL.PA",
    EMSHF: "EMSHY",
    "EQNR.OL": "EQNR",
    "ESLOY": "EL.PA",
    GLAXF: "GSK",
    "GLEN.L": "GLNCY",
    "GSK.L": "GSK",
    "HEIA.AS": "HINKF",
    "HEIO.AS": "HINKF",
    HOLIY: "HCMLF",
    "HSBA.L": "HSBC",
    "HUM": "HUM.CO",
    INFY: "INFY.NS",
    "ITX.MC": "ITXAF",
    "LIN.DE": "LIN",
    "LIN.L": "LIN",
    "LLOY.L": "LYG",
    LRLCF: "OR.PA",
    LRLCY: "OR.PA",
    "MAERSK-B.CO": "AMKBY",
    "MC.PA": "LVMHF",
    "MRK.DE": "MKKGY",
    "MUV2.DE": "MURGY",
    "NESN.SW": "NSRGY",
    NJDCY: "JD",
    "NOKIA.HE": "NOK",
    "NOVN.SW": "NVS",
    "NOVO-B.CO": "NVO",
    NWS_A: "NWSA",
    "OR.PA": "LRLCF",
    "ORK.OL": "ORKLY",
    "PHIA.AS": "PHG",
    PRGOF: "PRGO",
    "REL.L": "RELX",
    REPYY: "REP.MC",
    "RIO.L": "RIO",
    "RR.L": "RYCEF",
    "RTO.L": "RTOXY",
    "RWE.DE": "RWEOY",
    SAFRF: "SAFRY",
    SAN: "SAN.PA",
    SAP: "SAP.DE",
    SCMWY: "MUV2.DE",
    "SHEL.L": "SHEL",
    "SHEL": "RDSMY",
    SHELF: "SHEL",
    "SIE.DE": "SIEGY",
    "SLHN.SW": "SHLAF",
    "SMSN.IL": "SSNLF",
    SU: "SU.PA",
    "TEL.L": "TELOF",
    TEL2A: "TEL2-B.ST",
    "TM": "7203.T",
    "TOTF": "TTE.PA",
    "TOTGY": "TTE.PA",
    UBSFY: "UBS",
    "UBSG.SW": "UBS",
    "ULVR.L": "UL",
    VWAGY: "VWAPY",
    "VOW.DE": "VWAPY",
    "VOW3.DE": "VWAPY",
    YHOO: "YHOO.O",
  };
  const upper = ticker.toUpperCase();
  const canonical = ALIASES[upper] ?? upper;
  // Phase 3A (29 mai 2026) : `src/data/companies/<ticker>.json` est généré
  // par `scripts/build-companies-unified.ts` pour audits LOCAUX uniquement.
  // Il n'est PAS lu en runtime (exclu du bundle Vercel pour size cap 250 MB).
  // Runtime lit toujours `v2-pipeline/<ticker>.json` + merge enrich.
  const legacyPath = path.join(
    ROOT,
    "src/data/v2-pipeline",
    `${canonical.toLowerCase()}.json`,
  );
  const raw = await readJsonOrNull<AnyCo>(legacyPath);
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
    // Yann 26 mai 2026 — Règle ABSOLUE : aucun KPI hero ou Indicateurs clés
    // avec moins de 3 ans d'historique. Produit par scripts/fix-hero-kpi-history.py.
    // - hero_kpi_override : repointe data.hero_kpi vers un KPI valide.
    // - hero_kpi_replaced_reason : trace la raison du remplacement.
    // - _kpis_hidden_by_history_rule : liste de KPI shorts à cacher du tableau
    //   "Indicateurs clés" car leur history est insuffisante (filtré côté UI).
    // Yann 27 mai 2026 (point 4) : hero_kpi_override seulement si l'override
    // correspond à un short présent dans data.kpis (ou enrich.kpis qui sera
    // mergé juste après). Sinon des stés comme ATO (override='Distribution
    // Customer Count' absent des data.kpis) se retrouvent avec un hero_kpi
    // pointant dans le vide → erreur 500 server-side au render.
    if (typeof enrich.hero_kpi_override === "string" && enrich.hero_kpi_override.trim()) {
      const overrideShort = enrich.hero_kpi_override;
      const dataShorts = new Set(
        (data.kpis || []).map((k: AnyKPI) => k?.short).filter(Boolean)
      );
      const enrichShorts = new Set(
        (Array.isArray(enrich.kpis) ? enrich.kpis : []).map((k: AnyKPI) => k?.short).filter(Boolean)
      );
      if (dataShorts.has(overrideShort) || enrichShorts.has(overrideShort)) {
        (data as Record<string, unknown>).hero_kpi = overrideShort;
      }
    }
    if (typeof enrich.hero_kpi_replaced_reason === "string") {
      (data as Record<string, unknown>).hero_kpi_replaced_reason = enrich.hero_kpi_replaced_reason;
    }
    if (Array.isArray(enrich._kpis_hidden_by_history_rule)) {
      (data as Record<string, unknown>)._kpis_hidden_by_history_rule = enrich._kpis_hidden_by_history_rule;
    }
    // Yann 27 mai 2026 : propager les markers de traçabilité fraîcheur risks
    // au SSR pour qu'un audit puisse les vérifier visiblement (Agent 2
    // §0sexies a flag l'absence).
    for (const meta of ["_risks_reextracted_at", "_risks_source_year", "_risks_source_path", "_risks_verification_needed", "_risks_no_source"] as const) {
      if (enrich[meta] !== undefined) {
        (data as Record<string, unknown>)[meta] = enrich[meta];
      }
    }

    // Mission Mettrik #5 (28 mai 2026, CONV-DATA sub-agent #5) :
    // ai_positioning_override remappe les stances non-canoniques (prominent,
    // emerging, present, mentioned, central, active, etc.) vers le mapping UI
    // strict (leader / integrator / cautious / absent). Sans ça, le composant
    // ai-positioning-card.tsx fallback sur STANCE_META.absent -> badge
    // "AUCUN POSITIONNEMENT" alors que le summary décrit un engagement IA réel
    // (cas observé MU "prominent" + summary leader + CMBU +257 % YoY).
    if (
      enrich.ai_positioning_override &&
      typeof enrich.ai_positioning_override === "object" &&
      !Array.isArray(enrich.ai_positioning_override)
    ) {
      const ovr = enrich.ai_positioning_override as Record<string, unknown>;
      const newStance = ovr.stance;
      const CANONICAL_STANCES = new Set(["leader", "integrator", "cautious", "absent"]);
      if (typeof newStance === "string" && CANONICAL_STANCES.has(newStance)) {
        const ai = (data as Record<string, unknown>).ai_positioning as
          | Record<string, unknown>
          | undefined;
        if (ai && typeof ai === "object") {
          ai.stance = newStance;
          (ai as Record<string, unknown>)._stance_overridden_from = ovr._original_stance;
        }
      }
    }

    // Helper : "vide" = undefined, null, [], {} sans slices, {} sans champs significatifs
    const isBlockEmpty = (val: unknown): boolean => {
      if (val === undefined || val === null) return true;
      if (Array.isArray(val)) return val.length === 0;
      if (typeof val === "object") {
        const v = val as Record<string, unknown>;
        // Cas revenue_by_segment / revenue_by_geography : slices vides = vide
        if ("slices" in v) {
          return !Array.isArray(v.slices) || (v.slices as unknown[]).length === 0;
        }
        // Cas financial_snapshot / key_facts / peers / events : objet sans clés
        return Object.keys(v).length === 0;
      }
      if (typeof val === "string") return val.length === 0;
      return false;
    };
    for (const key of [
      "events",
      "revenue_by_segment",
      "revenue_by_geography",
      "revenue_by_ai_customer_type",
      "profit_warning",
      "company_description",
      "financial_snapshot",
      "key_facts",
      "peers",
      "latest_filing",
    ] as const) {
      if (
        enrich[key] !== undefined &&
        !isBlockEmpty(enrich[key]) &&
        isBlockEmpty((data as Record<string, unknown>)[key])
      ) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Yann 21 mai 2026 (sub-agent #37 CONV-CONCEPTS programmatic events fill) :
    // events fusion = si data.events a < 4 entrées et enrich.events en a plus,
    // fusionner les deux listes (dedup par title+date, sort date desc, cap 8).
    // Sans ce merge, les events programmatic (earnings, dividends, splits)
    // ajoutés par scripts/fill-events-programmatic.py restent invisibles sur
    // les fiches sté qui ont déjà 1-3 events news.
    if (Array.isArray(enrich.events) && enrich.events.length > 0) {
      const cur = Array.isArray((data as Record<string, unknown>).events)
        ? ((data as Record<string, unknown>).events as Array<Record<string, unknown>>)
        : [];
      if (cur.length < 4 && enrich.events.length > cur.length) {
        const seen = new Set<string>();
        const out: Array<Record<string, unknown>> = [];
        for (const e of [...cur, ...(enrich.events as Array<Record<string, unknown>>)]) {
          if (!e || typeof e !== "object") continue;
          const title = String(e.title ?? "").toLowerCase().slice(0, 60);
          const date = String(e.date ?? "");
          const key = `${title}|${date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(e);
        }
        out.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
        (data as Record<string, unknown>).events = out.slice(0, 8);
      }
    }
    // Risks / governance / AI positioning : merge SEULEMENT si la fiche
    // CONV-DATA ne les a pas déjà fournis. Évite de doubler des données.
    // Yann 27 mai 2026 : EXCEPTION pour risks → si enrich._risks_reextracted_at
    // est présent (re-extraction fraîche depuis filings 2024-2026 par les
    // 5 sub-agents Claude MAX), on OVERRIDE les risks v2-pipeline avec les
    // enrich.risks (data plus fraîche = priorité). Les autres clés (governance
    // / ai_positioning) gardent la sémantique "merge si vide".
    for (const key of ["risks", "governance", "ai_positioning"] as const) {
      const existing = (data as Record<string, unknown>)[key];
      const empty =
        existing === undefined ||
        existing === null ||
        (Array.isArray(existing) && existing.length === 0);
      const enrichRisksFresh =
        key === "risks" &&
        typeof enrich._risks_reextracted_at === "string" &&
        Array.isArray(enrich.risks) &&
        enrich.risks.length > 0;
      if ((empty || enrichRisksFresh) && enrich[key] !== undefined) {
        (data as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Yann 21 mai 2026 (sub-agent #52 CONV-CONCEPTS hero signal fix follow-up) :
    // kpis_type_overrides field-by-field. Pure heuristique pattern match sur
    // KPI.short / name_fr (cf scripts/heuristic-fill-kpi-types.py). Pour les
    // ~313 stés où des KPIs ont des types non reconnus par interpretStructured
    // (Balance Sheet / Comptes / Profit / Risk / Specific / Pipeline / etc.),
    // on remappe le `type` field vers les catégories Driver (Revenue, Demand,
    // User, Adoption) / Vigilance (Margin, Profitability, Cost, Investment) /
    // Surveillance (Cash Flow, Capital, Dividende). N'écrase JAMAIS le type si
    // déjà reconnu côté CONV-DATA. Merge SSR-only, n'altère pas v2-pipeline/.
    const RECOGNIZED_TYPES = new Set([
      // EN canoniques (legacy, gardés pour les ~2200 stés autres)
      "Demand", "User", "Adoption", "Revenue", "Volume", "Pricing", "Growth",
      "Engagement", "Capacity", "Productivity", "Operations", "Production",
      "Quality", "Innovation", "Subscription",
      "Cost", "Margin", "Profitability", "Investment",
      "Cash", "Cash Flow", "Capital", "Dividende",
      // FR canoniques (Yann 30 mai 2026, mission catégories KPI témoin 11 stés)
      "Revenus", "Marges", "Trésorerie", "Solidité financière",
      "Capacité", "Clientèle", "Investissement", "Productivité",
      "Engagement", "Pipeline", "Distribution", "Coûts", "Demande", "Prix",
    ]);
    // Shorts à FORCE override (high-confidence LLM mislabel) : Net Income en Revenue,
    // Free Cash Flow en Revenue, etc. Patterns autoritaires. Cf
    // scripts/heuristic-fill-kpi-types.py HIGH_CONFIDENCE_PATTERNS.
    const FORCE_OVERRIDE_PATTERNS: Array<[RegExp, string]> = [
      [/^net\s*income(\s*\(loss\))?$/i, "Profitability"],
      [/^operating\s*income$/i, "Profitability"],
      [/\beps\b/i, "Profitability"],
      [/^free\s*cash\s*flow$|^fcf$|^operating\s*cash\s*flow$/i, "Cash Flow"],
      [/^(adj(usted)?\s+)?(gross|operating|net|ebitda)\s*margin$/i, "Margin"],
      [/^r&d$|^capex$/i, "Investment"],
      [/^dps$|^payout\s*ratio$|^cap\s*return$/i, "Dividende"],
    ];
    // Sub-agent #58 (b_interpretation residual) : Vigilance targets forcent
    // override même si type courant reconnu, pour débloquer 2 stés restantes
    // (KEY Tier 1, MAR Adj EBITDA Margin). Sécurité : seulement pour cibles
    // Vigilance strictes (Cost/Margin/Profitability/Investment). Évite de
    // déstabiliser les overrides Driver/Surveillance déjà OK.
    const VIGILANCE_TARGETS = new Set(["Cost", "Margin", "Profitability", "Investment"]);
    const typeOverrides = (enrich as Record<string, unknown>).kpis_type_overrides;
    if (typeOverrides && typeof typeOverrides === "object" && !Array.isArray(typeOverrides) && Array.isArray(data.kpis)) {
      const ov = typeOverrides as Record<string, string>;
      data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
        const short = typeof k.short === "string" ? k.short : "";
        const curType = typeof k.type === "string" ? k.type : "";
        if (!short || !ov[short]) return k;
        // 1. Force override pour shorts high-confidence (override même si type reconnu)
        const forced = FORCE_OVERRIDE_PATTERNS.find(([re]) => re.test(short));
        if (forced && curType !== forced[1]) {
          return { ...k, type: forced[1] };
        }
        // 2. Force override si cible = Vigilance (b_interpretation unblock)
        const target = ov[short];
        if (VIGILANCE_TARGETS.has(target) && curType !== target) {
          return { ...k, type: target };
        }
        // 3. Sinon override seulement si type courant pas reconnu (génériques / vides)
        if (!RECOGNIZED_TYPES.has(curType)) {
          return { ...k, type: target };
        }
        return k;
      });
    }
    // Yann 21 mai 2026 (sub-agent #52 CONV-CONCEPTS) : overrides_governance
    // field-by-field. Fill heuristique (voting_structure_note, board_size via
    // yfinance.companyOfficers, board_independence_pct 80% US default,
    // avg_tenure_years 7y US / 5.5y EU, ceo_pay_ratio 100 US default).
    // N'écrase JAMAIS un champ déjà présent côté CONV-DATA. Merge propre.
    const govOverrides = (enrich as Record<string, unknown>).overrides_governance;
    if (govOverrides && typeof govOverrides === "object" && !Array.isArray(govOverrides)) {
      const existingGov =
        data.governance && typeof data.governance === "object" && !Array.isArray(data.governance)
          ? { ...(data.governance as Record<string, unknown>) }
          : ({} as Record<string, unknown>);
      const ov = govOverrides as Record<string, unknown>;
      for (const [k, v] of Object.entries(ov)) {
        if (v === undefined || v === null) continue;
        const cur = existingGov[k];
        const curEmpty =
          cur === undefined ||
          cur === null ||
          (typeof cur === "string" && cur.length === 0) ||
          (typeof cur === "number" && Number.isNaN(cur));
        if (curEmpty) {
          existingGov[k] = v;
        }
      }
      data.governance = existingGov as typeof data.governance;
    }
    // Yann 21 mai 2026 : risks_rationale_overrides (CONV-CONCEPTS sub-agent #24
    // Cerebras Qwen-3 235B). Pour les 391 stés avec weak_rationale identifiés
    // par v1-9-risks-audit.json, override le score_rationale du risk matchant
    // (title + category) sans toucher v2-pipeline/<t>.json (scope CONV-DATA).
    // Format enrich: { risks_rationale_overrides: [{title, category, score_rationale}] }
    if (
      Array.isArray((enrich as Record<string, unknown>).risks_rationale_overrides) &&
      Array.isArray(data.risks)
    ) {
      const overrides = (enrich as Record<string, unknown>)
        .risks_rationale_overrides as Array<{
        title?: string;
        category?: string;
        score_rationale?: string;
      }>;
      data.risks = (data.risks as CompanyRisk[]).map((r: CompanyRisk) => {
        const match = overrides.find(
          (o) =>
            (o.title || "") === (r.title || "") &&
            (o.category || "") === (r.category || ""),
        );
        if (match && match.score_rationale && typeof match.score_rationale === "string") {
          return { ...r, score_rationale: match.score_rationale };
        }
        return r;
      });
    }
    // Freshness overrides (CONV-CONCEPTS 21 mai 2026, script
    // refresh-freshness-yf-v19.py) : rafraîchit last_data_date sur le hero KPI
    // (ou KPI nommé) via yfinance.mostRecentQuarter / lastFiscalYearEnd. N'écrase
    // pas v2-pipeline/ (scope CONV-DATA). Format enrich:
    // { kpis_freshness_overrides: [{short, last_data_date, source, refreshed_at}] }
    if (
      Array.isArray((enrich as Record<string, unknown>).kpis_freshness_overrides) &&
      Array.isArray(data.kpis)
    ) {
      const freshOverrides = (enrich as Record<string, unknown>)
        .kpis_freshness_overrides as Array<{
        short?: string;
        last_data_date?: string;
        source?: string;
      }>;
      data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
        const match = freshOverrides.find(
          (o) => o.short && k.short && o.short === k.short,
        );
        if (match && match.last_data_date && typeof match.last_data_date === "string") {
          return { ...k, last_data_date: match.last_data_date };
        }
        return k;
      });
    }
    // latest_filing_update (CONV-CONCEPTS 27 mai 2026, daily-doc-watcher) :
    // si Cerebras a extrait un trimestre plus récent depuis un 10-Q / 10-K /
    // 8-K nouvellement téléchargé, étend history du hero KPI et MAJ
    // last_data_date. Format enrich.latest_filing_update :
    // { filing_date, form_type, hero_value_new, hero_period_end,
    //   sentiment, key_takeaway, risks_changed, source_path, extracted_at }
    // Skip si _extraction_pending: true (Cerebras saturé, retry au prochain cron).
    const latestFilingUpdate = (enrich as Record<string, unknown>).latest_filing_update;
    if (
      latestFilingUpdate
      && typeof latestFilingUpdate === "object"
      && Array.isArray(data.kpis)
      && data.hero_kpi
    ) {
      const lfu = latestFilingUpdate as {
        filing_date?: string;
        form_type?: string;
        hero_value_new?: number | null;
        hero_period_end?: string | null;
        sentiment?: string | null;
        key_takeaway?: string | null;
        risks_changed?: boolean;
        _extraction_pending?: boolean;
      };
      if (
        !lfu._extraction_pending
        && lfu.filing_date
        && typeof lfu.hero_value_new === "number"
        && lfu.hero_period_end
      ) {
        data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
          if (k.short !== data.hero_kpi) return k;
          const currentLast = ((k as AnyKPI & { last_data_date?: string }).last_data_date as string | undefined) ?? "";
          if (lfu.hero_period_end! <= currentLast) return k;
          const newHistory = Array.isArray(k.history) ? [...k.history] : [];
          const lastVal = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
          if (lastVal !== lfu.hero_value_new) {
            newHistory.push(lfu.hero_value_new as number);
          }
          return {
            ...k,
            history: newHistory,
            last_data_date: lfu.hero_period_end!,
          } as AnyKPI;
        });
      }
    }
    // next_earnings_date override (Yann 27 mai 2026) : daily-doc-watcher
    // met à jour enrich.next_earnings_date via yfinance.calendar. Sans ce
    // merge, le SSR utilise la valeur stale de v2-pipeline/<t>.json
    // → bug "earning attendu" alors que publié (cas NVDA).
    const enrichNextEarnings = (enrich as Record<string, unknown>).next_earnings_date;
    if (typeof enrichNextEarnings === "string" && enrichNextEarnings) {
      (data as Record<string, unknown>).next_earnings_date = enrichNextEarnings;
    }
    // Hero signal override (CONV-CONCEPTS 21 mai 2026, sub-agent #48 follow-up) :
    // fill heuristique signal vide sur hero KPI (7 stés publishable). Format :
    // { overrides_hero_signal: { hero_short, signal, _source } }. N'écrase pas
    // un signal existant. Merge SSR-only (n'altère pas v2-pipeline/<t>.json).
    const overrideSignal = (enrich as Record<string, unknown>).overrides_hero_signal;
    if (
      overrideSignal
      && typeof overrideSignal === "object"
      && Array.isArray(data.kpis)
    ) {
      const ov = overrideSignal as { hero_short?: string; signal?: string };
      if (ov.hero_short && ov.signal && typeof ov.signal === "string") {
        data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
          if (k.short === ov.hero_short && (!k.signal || !String(k.signal).trim())) {
            return { ...k, signal: ov.signal };
          }
          return k;
        });
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
    // Payout Ratio). FUSION par `short` : si KPI existe déjà côté CONV-DATA,
    // on garde la version avec history LA PLUS LONGUE (et propage period_type
    // + champs spécifiques du gagnant, en préservant les champs v2-pipeline
    // tels que yoy/signal si pas dans la version enrich). Sinon append.
    // (Yann 2 juin 2026 : fix bug iPhone Revenue tronquée à 3 ans alors que
    // specific-kpis avait 5+ ans, idem GOOGL re-extract.)
    if (Array.isArray(enrich.kpis) && Array.isArray(data.kpis)) {
      const enrichKpis: AnyKPI[] = (enrich.kpis as AnyKPI[])
        .filter((k) => k && typeof k === "object" && typeof k.short === "string" && k.short)
        .map((k) => ({ ...k, history: normalizeHistory(k.history) }) as AnyKPI);
      const dataKpis = data.kpis as AnyKPI[];
      const mergedKpis: AnyKPI[] = [];
      const dataByShort = new Map<string, AnyKPI>();
      for (const k of dataKpis) {
        if (typeof k?.short === "string" && k.short) dataByShort.set(k.short, k);
      }
      const consumedShorts = new Set<string>();
      for (const ek of enrichKpis) {
        const ekShort = ek.short as string;
        const existing = dataByShort.get(ekShort);
        if (existing) {
          consumedShorts.add(ekShort);
          const existingLen = Array.isArray(existing.history) ? (existing.history as unknown[]).length : 0;
          const enrichLen = Array.isArray(ek.history) ? (ek.history as unknown[]).length : 0;
          // Égalité → on prend la version enrich (souvent plus récente).
          // Strict > → on garde existing.
          const winner = enrichLen >= existingLen ? ek : existing;
          const loser = winner === ek ? existing : ek;
          // Fusion : champs du winner prennent priorité, mais on récupère
          // depuis loser les champs absents/vides du winner (préserve yoy /
          // signal / description issus de v2-pipeline si enrich ne les a pas).
          const merged: AnyKPI = { ...loser, ...winner };
          if (winner === ek) {
            merged.history = winner.history;
            if (winner.period_type) merged.period_type = winner.period_type;
          }
          mergedKpis.push(merged);
        }
      }
      // Garder les KPIs existants non touchés par fusion.
      for (const k of dataKpis) {
        if (typeof k?.short === "string" && k.short && !consumedShorts.has(k.short)) {
          mergedKpis.push(k);
        }
      }
      // Append les KPIs enrich qui n'existaient pas côté data.
      const existingMergedShorts = new Set(
        mergedKpis.map((k) => k?.short).filter((s): s is string => typeof s === "string" && Boolean(s)),
      );
      for (const ek of enrichKpis) {
        const ekShort = ek.short as string;
        if (!existingMergedShorts.has(ekShort)) {
          mergedKpis.push(ek);
        }
      }
      data.kpis = mergedKpis;
    }
    // Yann 19 mai 2026 : KPI SPÉCIFIQUES dispatchés par sub-agents Claude
    // (146 stés priorité 0 re-extracted, scope CONV-CONCEPTS).
    // Source : `src/data/v2-pipeline-specific-kpis/<ticker>.json`.
    // Format : { kpis: [...] } avec champs short/name/value/unit/yoy/
    // history/period_type/description_fr/en/_specific_to.
    // Si `_fit_for_site: false` → sté marquée non-publishable (skip merge).
    try {
      // Yann 30 mai 2026 (Bug GOOGL 4 KPIs prod) : fallback case-insensitive.
      // Convention canonique = lowercase. On essaie d'abord lowercase, puis
      // uppercase pour rétro-compatibilité avec anciens fichiers non normalisés.
      // Sur Vercel Linux FS case-sensitive, sinon les uppercase ne matchent pas.
      const specificDir = path.join(ROOT, "src/data/v2-pipeline-specific-kpis");
      let specificData = await readJsonOrNull<{
        kpis?: AnyKPI[];
        _fit_for_site?: boolean;
        _verification_needed?: boolean;
      }>(path.join(specificDir, `${ticker.toLowerCase()}.json`));
      if (!specificData) {
        specificData = await readJsonOrNull<{
          kpis?: AnyKPI[];
          _fit_for_site?: boolean;
          _verification_needed?: boolean;
        }>(path.join(specificDir, `${ticker.toUpperCase()}.json`));
      }
      if (
        specificData
        && specificData._fit_for_site !== false
        && specificData._verification_needed !== true
        && Array.isArray(specificData.kpis)
        && Array.isArray(data.kpis)
      ) {
        // FUSION par `short` (Yann 2 juin 2026) : si le KPI existe déjà,
        // on garde la version avec history LA PLUS LONGUE (+ propage
        // period_type du gagnant). En cas d'égalité de longueur, specific
        // gagne (plus récent souvent). Préserve champs v2-pipeline absents
        // côté specific (yoy / signal / description / etc.).
        const specificKpis: AnyKPI[] = specificData.kpis
          .filter((k) => k && typeof k === "object" && typeof k.short === "string" && k.short)
          .map((k) => ({
            ...k,
            history: normalizeHistory(k.history),
            _source: "v2-pipeline-specific-kpis",
          }) as AnyKPI);
        const dataKpis = data.kpis as AnyKPI[];
        const mergedKpis: AnyKPI[] = [];
        const dataByShort = new Map<string, AnyKPI>();
        for (const k of dataKpis) {
          if (typeof k?.short === "string" && k.short) dataByShort.set(k.short, k);
        }
        const consumedShorts = new Set<string>();
        for (const sk of specificKpis) {
          const skShort = sk.short as string;
          const existing = dataByShort.get(skShort);
          if (existing) {
            consumedShorts.add(skShort);
            const existingLen = Array.isArray(existing.history) ? (existing.history as unknown[]).length : 0;
            const specificLen = Array.isArray(sk.history) ? (sk.history as unknown[]).length : 0;
            const winner = specificLen >= existingLen ? sk : existing;
            const loser = winner === sk ? existing : sk;
            const merged: AnyKPI = { ...loser, ...winner };
            if (winner === sk) {
              merged.history = winner.history;
              if (winner.period_type) merged.period_type = winner.period_type;
            }
            mergedKpis.push(merged);
          }
        }
        for (const k of dataKpis) {
          if (typeof k?.short === "string" && k.short && !consumedShorts.has(k.short)) {
            mergedKpis.push(k);
          }
        }
        const existingMergedShorts = new Set(
          mergedKpis.map((k) => k?.short).filter((s): s is string => typeof s === "string" && Boolean(s)),
        );
        for (const sk of specificKpis) {
          const skShort = sk.short as string;
          if (!existingMergedShorts.has(skShort)) {
            mergedKpis.push(sk);
          }
        }
        data.kpis = mergedKpis;
      }
    } catch {
      // best effort, silent fail si le fichier n'existe pas pour ce ticker
    }
    // Yann 25 mai 2026 v2 : merge auto kpis-v3 vérifiés (CONV-VERIF-KPIS-V3)
    // Source : `src/data/v2-pipeline-enrich/<ticker>.kpis-v3.json`.
    // Format : { ticker, kpis_v3: [...], _signed_by, _extracted_at }.
    // Anti-hallucination déjà appliquée en pipeline Python (source_quote ≥5 mots,
    // value présente dans quote, mention count canonique ≥3 dans filing).
    try {
      const v3Path = path.join(
        ROOT,
        "src/data/v2-pipeline-enrich",
        `${ticker.toLowerCase()}.kpis-v3.json`,
      );
      const v3Data = await readJsonOrNull<{
        kpis_v3?: AnyKPI[];
      }>(v3Path);
      if (
        v3Data
        && Array.isArray(v3Data.kpis_v3)
        && Array.isArray(data.kpis)
      ) {
        const existingShortsV3 = new Set(
          (data.kpis as AnyKPI[]).map((k) => k?.short).filter(Boolean),
        );
        const extraV3 = v3Data.kpis_v3
          .filter((k): k is AnyKPI => Boolean(k && typeof k === "object" && k.short && !existingShortsV3.has(k.short)))
          .map((k) => ({
            ...k,
            history: normalizeHistory(k.history),
            _source: "kpis-v3-verif",
          }));
        if (extraV3.length > 0) {
          data.kpis = [...data.kpis, ...extraV3];
        }
      }
    } catch {
      // best effort, silent fail si le fichier n'existe pas pour ce ticker
    }
    // Yann 20 mai 2026 : EXTENSION HERO HISTORY (mission CONV-CONCEPTS).
    // Pour les ~28 stés US où le hero_kpi est SPÉCIFIQUE mais history <3 ans
    // (bloquait publishable), extraction multi-année 10-K Segment Reporting.
    // Source : `_hero_history_extension` dans v2-pipeline-enrich/<ticker>.json.
    // Format : { hero_kpi_short, history: number[], _source, _extracted_at }.
    // Le merge étend la `history` du hero KPI si l'extension a ≥3 points
    // ET si le short matche le hero_kpi actuel (exact ou substring tolérant).
    if (
      enrich._hero_history_extension
      && typeof enrich._hero_history_extension === "object"
    ) {
      const ext = enrich._hero_history_extension as {
        hero_kpi_short?: string;
        history?: unknown;
      };
      const extHist = Array.isArray(ext.history)
        ? (ext.history as unknown[]).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        : [];
      if (extHist.length >= 3 && ext.hero_kpi_short && Array.isArray(data.kpis)) {
        const heroShort = data.hero_kpi as string | undefined;
        const extShortLow = ext.hero_kpi_short.toLowerCase();
        // Trouve le KPI hero (par hero_kpi field, sinon fuzzy match)
        const heroKpi = (data.kpis as AnyKPI[]).find((k) => {
          if (!k || typeof k !== "object") return false;
          const s = (typeof k.short === "string" ? k.short : "").toLowerCase();
          if (heroShort && s === heroShort.toLowerCase()) return true;
          return s === extShortLow || s.includes(extShortLow) || extShortLow.includes(s);
        });
        if (heroKpi) {
          const currentLen = Array.isArray(heroKpi.history) ? heroKpi.history.length : 0;
          if (extHist.length > currentLen) {
            heroKpi.history = extHist;
            // Désactive le flag is_short_history si on dépasse 3 points
            if (extHist.length >= 3) {
              heroKpi.is_short_history = false;
            }
          }
        }
      }
    }
    // Yann 30 mai 2026 — MISSION 4b · MERGE MULTI-KPI QUARTERLY EXTENSION.
    // Produit par scripts/merge-quarterly-to-hq-180.py sur 180 stés haute
    // qualité (union v2-pipeline-kpi-v2 + v2-pipeline-exhaustive).
    // Source : `_quarterly_history_extension` dans v2-pipeline-enrich/<t>.json.
    // Format réel observé :
    //   {
    //     "ticker": "AAPL",
    //     "kpis": [
    //       {
    //         "kpi_short": "iPhone Revenue",
    //         "unit": "USD",
    //         "period_type": "quarter",
    //         "history": [n, n, n, ...],          // valeurs trimestrielles
    //         "history_periods": ["Q1 2020", ...], // labels alignés sur history
    //         "last_data_date": "2025-09-27",
    //         "source": "SEC EDGAR XBRL companyfacts",
    //         "_sec_tag": "Revenue",
    //         "_sync_validation": {...}
    //       },
    //       ...
    //     ],
    //     "_legacy_hero_extension": {...}   // optionnel (ancien format mono-hero)
    //   }
    //
    // Effet : pour CHAQUE KPI canonique correspondant (match exact par
    // short, case-insensitive trim), si KPI canonique a period_type='year'
    // ET le quarterly history est non-vide → on REMPLACE history par les
    // valeurs trimestrielles, on aligne history_periods + last_data_date +
    // unit éventuel, et on force period_type='quarter'.
    //
    // Anti-écrasement : si KPI canonique a déjà period_type='quarter'
    // (NFLX, et autres natifs), on SKIP (le bloc XBRL plus haut ligne 921+
    // gère déjà les merges intelligents pour ces cas). Évite régression.
    //
    // Backward-compat : si `_quarterly_history_extension` absent, ce bloc
    // ne fait rien (no-op silencieux).
    //
    // Le champ `_legacy_hero_extension` (ancien format hero-only sur ~7
    // stés) est préservé dans le payload mais le merge effectif a déjà
    // été fait au bloc précédent via `_hero_history_extension`. Le
    // fallback ascendant fonctionne donc tel quel : si une sté n'a que
    // l'ancien hero extension (= pas migrée), elle est servie par le
    // bloc d'au-dessus. Si elle a l'extension multi-KPI nouvelle, on
    // applique celle-ci ici en plus.
    if (
      enrich._quarterly_history_extension
      && typeof enrich._quarterly_history_extension === "object"
      && Array.isArray(data.kpis)
    ) {
      const qhExt = enrich._quarterly_history_extension as Record<string, unknown>;
      const extKpis = Array.isArray(qhExt.kpis)
        ? (qhExt.kpis as Array<Record<string, unknown>>)
        : [];
      if (extKpis.length > 0) {
        // Indexe par short normalisé (lowercase, trim) pour matching O(1).
        const byShort = new Map<string, Record<string, unknown>>();
        for (const ek of extKpis) {
          if (!ek || typeof ek !== "object") continue;
          const short = typeof ek.kpi_short === "string" ? ek.kpi_short.trim().toLowerCase() : "";
          if (!short) continue;
          byShort.set(short, ek);
        }
        if (byShort.size > 0) {
          data.kpis = (data.kpis as AnyKPI[]).map((k) => {
            if (!k || typeof k !== "object") return k;
            const short = typeof k.short === "string" ? k.short.trim().toLowerCase() : "";
            if (!short) return k;
            const ek = byShort.get(short);
            if (!ek) return k;
            // Garde-fou null/array vide : skip silencieux si malformé.
            const qHist = Array.isArray(ek.history)
              ? (ek.history as unknown[]).filter(
                  (v): v is number => typeof v === "number" && Number.isFinite(v),
                )
              : [];
            if (qHist.length === 0) return k;
            // Skip si KPI canonique déjà en quarter natif (NFLX etc.).
            // Le bloc XBRL plus haut (~ligne 921+) gère déjà les merges
            // intelligents pour ces cas. Évite de doubler / régresser.
            const curPeriod = typeof k.period_type === "string" ? k.period_type : "";
            if (curPeriod.toLowerCase() === "quarter") return k;
            // Récupère history_periods / last_data_date / unit du quarterly
            // s'ils sont présents, sinon laisse intact côté KPI canonique.
            const qPeriods = Array.isArray(ek.history_periods)
              ? (ek.history_periods as unknown[]).filter((v): v is string => typeof v === "string")
              : undefined;
            const qLastDate = typeof ek.last_data_date === "string" ? ek.last_data_date : undefined;
            const qUnit = typeof ek.unit === "string" ? ek.unit : undefined;
            return {
              ...k,
              history: qHist,
              history_periods: qPeriods && qPeriods.length === qHist.length ? qPeriods : k.history_periods,
              period_type: "quarter",
              last_data_date: qLastDate ?? (k as AnyKPI & { last_data_date?: string }).last_data_date,
              unit: qUnit ?? k.unit,
              is_short_history: qHist.length < 3,
            } as AnyKPI;
          });
        }
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
          // Yann 19 mai 2026 : `otherHist.slice(-qDiff)` faisait l'hypothèse
          // que les dernières N valeurs de l'history LLM main.kpis sont les
          // quarters les plus récents. Or pour AAPL (et d'autres), main.kpi
          // .history est désuète (10 quarters Q1 FY24 → Q2 FY26 = 23.9 last)
          // alors que main.kpi.value = 30.976 = Q2 FY26 canonique. Append
          // de 23.9 créait un faux drop visible sur le chart (30 → 23.9).
          //
          // Fix : préférer `main.kpi.value` (canonique = dernier quarter
          // publié) au lieu de la queue history. Plus fiable parce que
          // CONV-DATA rafraîchit `value` à chaque earnings mais pas
          // toujours `history`.
          if (qDiff > 0) {
            // qDiff = 1 → append le seul main.kpi.value
            // qDiff > 1 → append (qDiff-1) tail values + main.kpi.value en dernier
            const mainValue = typeof (k as AnyKPI).value === "number"
              ? ((k as AnyKPI).value as number)
              : Number((k as AnyKPI).value);
            if (Number.isFinite(mainValue)) {
              const padding = qDiff > 1 && otherHist.length >= qDiff - 1
                ? otherHist.slice(-(qDiff - 1), -1)
                : [];
              mergedHist = [...baseHist, ...padding, mainValue];
              mergedLast = otherLast;
            } else if (otherHist.length >= qDiff) {
              // Fallback ancien comportement si main.kpi.value invalide
              const tail = otherHist.slice(-qDiff);
              mergedHist = [...baseHist, ...tail];
              mergedLast = otherLast;
            }
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
    // Yann 2026-05-26 : MERGE `hero_quarterly_history` (mission extraction
    // Cerebras Qwen 235B sur ~258 stés clean_all dont hero KPI period_type
    // était undefined ou "year"). Source :
    // `v2-pipeline-enrich/<ticker>.json` field `hero_quarterly_history`.
    // Format payload :
    //   { short, period_type: "quarter"|"semester", history: number[],
    //     history_periods?, last_data_date?, source?, extracted_at, method }
    // Effet : ajoute un champ `quarterly_history` séparé sur le hero KPI
    // (n'écrase pas `history` annuel). Le composant ChartCycle lit
    // `kpi.quarterly_history` quand toggle = "Trimestriel".
    if (
      enrich.hero_quarterly_history
      && typeof enrich.hero_quarterly_history === "object"
      && Array.isArray(data.kpis)
    ) {
      const qh = enrich.hero_quarterly_history as {
        short?: string;
        period_type?: string;
        history?: unknown;
        history_periods?: unknown;
        last_data_date?: string;
        source?: string;
        skip_reason?: string;
      };
      const qhHist = Array.isArray(qh.history)
        ? (qh.history as unknown[]).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        : [];
      // Only merge if non-empty (skip placeholders with skip_reason)
      if (qhHist.length >= 3 && qh.short) {
        const heroShortCur = data.hero_kpi as string | undefined;
        const targetShortLow = qh.short.toLowerCase();
        const heroKpi = (data.kpis as AnyKPI[]).find((k) => {
          if (!k || typeof k !== "object") return false;
          const s = (typeof k.short === "string" ? k.short : "").toLowerCase();
          if (heroShortCur && s === heroShortCur.toLowerCase()) return true;
          return s === targetShortLow;
        });
        if (heroKpi) {
          (heroKpi as AnyKPI).quarterly_history = qhHist;
          if (Array.isArray(qh.history_periods)) {
            (heroKpi as AnyKPI).quarterly_history_periods = qh.history_periods;
          }
          (heroKpi as AnyKPI).quarterly_period_type = qh.period_type ?? "quarter";
          if (qh.last_data_date) {
            (heroKpi as AnyKPI).quarterly_last_data_date = qh.last_data_date;
          }
          if (qh.source) {
            (heroKpi as AnyKPI).quarterly_source = qh.source;
          }
        }
      }
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
            nature: mapKpiCategoryToNature(sp.kpi_category),
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
          // Yann 18 mai 2026 : SVG local recréé (priorité affichage).
          image_local_path: f.image_local_path,
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

    // Yann 28 mai 2026 v2 — MERGE *_fr écrits par 17 sub-agents successifs.
    // Reproduit le commit ed840dd97 reverted (efd871981), avec garde-fous
    // défensifs renforcés contre les variations de format observées dans
    // les 570+ fichiers enrich :
    //  - evidence_fr = array d'objets {source, text_fr} (pas strings) →
    //    on extrait text_fr pour produire un array de strings (sinon React
    //    crashe "Objects are not valid as a React child" + composant
    //    ai-positioning-card l.146 rend `e` direct quand non-string).
    //  - events_fr = 4 formats distincts {title_fr/description_fr},
    //    {title/description}, etc. → on supporte les 2 plus courants.
    //  - kpis_supplementary.value = float|int|str → conservé tel quel.
    //  - Tout est wrap dans try/catch + Array.isArray / typeof checks.
    const reqLocale = (opts.locale ?? "").toLowerCase();
    const isFr = reqLocale === "fr" || reqLocale === "fr-fr" || reqLocale === "";

    try {
      // 1. tagline_fr → tagline_i18n.fr (coexiste avec taglines-fr.json
      // global injecté plus bas dans la fonction). Cet enrich SPÉCIFIQUE
      // gagne sur le global s'il existe.
      if (typeof enrich.tagline_fr === "string" && enrich.tagline_fr.trim().length > 0) {
        const curT = ((data as Record<string, unknown>).tagline_i18n as
          | Record<string, string>
          | undefined) ?? {};
        (data as Record<string, unknown>).tagline_i18n = {
          ...curT,
          fr: enrich.tagline_fr,
        };
      }
    } catch (err) {
      console.warn(`tagline_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 1bis. sector_fr / subsector_fr → remap data.sector / data.subsector
      // quand locale=fr. Sources extraction LLM CONV-DATA contenaient
      // souvent des libellés EN bruts (Banking, Financial Services,
      // Integrated Oil & Gas, etc.) qui apparaissaient sur les chips
      // header de page sté FR. Yann 28 mai 2026 : audit visuel confirmé
      // sur BNP.PA, TTE.PA, ROG.SW, AAPL. Le dict EN→FR est appliqué côté
      // pipeline sub-agent dans v2-pipeline-enrich/<ticker>.json. On
      // remplace data.sector/subsector in-place (pas de duplication
      // sector_i18n, le composant lit data.sector direct).
      if (isFr) {
        if (
          typeof enrich.sector_fr === "string" &&
          enrich.sector_fr.trim().length > 0
        ) {
          (data as Record<string, unknown>).sector = enrich.sector_fr;
        }
        if (
          typeof enrich.subsector_fr === "string" &&
          enrich.subsector_fr.trim().length > 0
        ) {
          (data as Record<string, unknown>).subsector = enrich.subsector_fr;
        }
      }
    } catch (err) {
      console.warn(`sector_fr/subsector_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 2. hero_kpi_rationale_fr → company.hero_kpi_rationale (locale=fr only).
      if (
        isFr &&
        typeof enrich.hero_kpi_rationale_fr === "string" &&
        enrich.hero_kpi_rationale_fr.trim().length > 0
      ) {
        (data as Record<string, unknown>).hero_kpi_rationale =
          enrich.hero_kpi_rationale_fr;
      }
    } catch (err) {
      console.warn(`hero_kpi_rationale_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 3. events_fr → match par date avec data.events. Supporte 2 formats :
      //  - {date, title_fr, description_fr} (407 stés, le plus courant)
      //  - {date, title, description} (44 stés, déjà FR du sub-agent)
      // Set title/description in-place quand locale=fr.
      if (
        isFr &&
        Array.isArray(enrich.events_fr) &&
        Array.isArray(data.events) &&
        data.events.length > 0
      ) {
        const evFr = enrich.events_fr as Array<Record<string, unknown>>;
        const byDate = new Map<string, { title?: string; description?: string }>();
        for (const e of evFr) {
          if (!e || typeof e !== "object") continue;
          const dateStr = typeof e.date === "string" ? e.date : "";
          if (!dateStr) continue;
          const titleFr =
            typeof e.title_fr === "string" && e.title_fr.trim().length > 0
              ? e.title_fr
              : typeof e.title === "string" && e.title.trim().length > 0
                ? e.title
                : undefined;
          const descFr =
            typeof e.description_fr === "string" && e.description_fr.trim().length > 0
              ? e.description_fr
              : typeof e.description === "string" && e.description.trim().length > 0
                ? e.description
                : undefined;
          byDate.set(dateStr, { title: titleFr, description: descFr });
        }
        if (byDate.size > 0) {
          (data as Record<string, unknown>).events = (
            data.events as Array<Record<string, unknown>>
          ).map((ev) => {
            if (!ev || typeof ev !== "object") return ev;
            const dateStr = typeof ev.date === "string" ? ev.date : "";
            const match = dateStr ? byDate.get(dateStr) : undefined;
            if (!match) return ev;
            return {
              ...ev,
              title: match.title ?? ev.title,
              description: match.description ?? ev.description,
            };
          });
        }
      }
    } catch (err) {
      console.warn(`events_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 4. risks_rationale_fr → dict {index_str: rationale_fr}. Set
      // score_rationale in-place sur data.risks[i] quand locale=fr.
      if (
        isFr &&
        enrich.risks_rationale_fr &&
        typeof enrich.risks_rationale_fr === "object" &&
        !Array.isArray(enrich.risks_rationale_fr) &&
        Array.isArray(data.risks) &&
        data.risks.length > 0
      ) {
        const dict = enrich.risks_rationale_fr as Record<string, unknown>;
        (data as Record<string, unknown>).risks = (data.risks as CompanyRisk[]).map(
          (r: CompanyRisk, i: number) => {
            if (!r || typeof r !== "object") return r;
            const key = String(i);
            const v = dict[key];
            if (typeof v === "string" && v.trim().length > 0) {
              return { ...r, score_rationale: v };
            }
            return r;
          },
        );
      }
    } catch (err) {
      console.warn(`risks_rationale_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 5. kpis_explanation_fr / kpis_description_fr / kpis_signal_fr :
      // dicts {short: value_fr}. Set in-place sur les KPIs matching par
      // .short, locale=fr. N'écrase pas si dict vide ou clé manquante.
      if (isFr && Array.isArray(data.kpis) && data.kpis.length > 0) {
        const expDict =
          enrich.kpis_explanation_fr &&
          typeof enrich.kpis_explanation_fr === "object" &&
          !Array.isArray(enrich.kpis_explanation_fr)
            ? (enrich.kpis_explanation_fr as Record<string, unknown>)
            : null;
        const descDict =
          enrich.kpis_description_fr &&
          typeof enrich.kpis_description_fr === "object" &&
          !Array.isArray(enrich.kpis_description_fr)
            ? (enrich.kpis_description_fr as Record<string, unknown>)
            : null;
        const sigDict =
          enrich.kpis_signal_fr &&
          typeof enrich.kpis_signal_fr === "object" &&
          !Array.isArray(enrich.kpis_signal_fr)
            ? (enrich.kpis_signal_fr as Record<string, unknown>)
            : null;
        if (expDict || descDict || sigDict) {
          data.kpis = (data.kpis as AnyKPI[]).map((k) => {
            if (!k || typeof k !== "object") return k;
            const short = typeof k.short === "string" ? k.short : "";
            if (!short) return k;
            const out: AnyKPI = { ...k };
            if (expDict) {
              const v = expDict[short];
              if (typeof v === "string" && v.trim().length > 0) out.explanation = v;
            }
            if (descDict) {
              const v = descDict[short];
              if (typeof v === "string" && v.trim().length > 0) out.description = v;
            }
            if (sigDict) {
              const v = sigDict[short];
              if (typeof v === "string" && v.trim().length > 0) out.signal = v;
            }
            return out;
          });
        }
      }
    } catch (err) {
      console.warn(`kpis_*_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 5bis. revenue_by_geography_fr.slices_label_fr → dict {EN label: FR label}.
      // Remap chaque slice.label via le dict quand locale=fr. Évite que des
      // labels EN purs (Other Asia Pacific, Rest of World, North America, etc.)
      // apparaissent sur la fiche FR. Source : v2-pipeline-enrich/<t>.json.
      if (
        isFr &&
        enrich.revenue_by_geography_fr &&
        typeof enrich.revenue_by_geography_fr === "object" &&
        !Array.isArray(enrich.revenue_by_geography_fr)
      ) {
        const geoFr = enrich.revenue_by_geography_fr as Record<string, unknown>;
        const labelDict = geoFr.slices_label_fr;
        if (
          labelDict &&
          typeof labelDict === "object" &&
          !Array.isArray(labelDict)
        ) {
          const dict = labelDict as Record<string, string>;
          const geo = (data as Record<string, unknown>).revenue_by_geography as
            | Record<string, unknown>
            | undefined;
          if (geo && Array.isArray(geo.slices)) {
            geo.slices = (geo.slices as Array<Record<string, unknown>>).map(
              (sl) => {
                if (!sl || typeof sl !== "object") return sl;
                const lab = sl.label;
                if (typeof lab === "string" && typeof dict[lab] === "string") {
                  return { ...sl, label: dict[lab] };
                }
                return sl;
              },
            );
          }
        }
      }
    } catch (err) {
      console.warn(`revenue_by_geography_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 6. ai_positioning_fr.{summary_fr, evidence_fr} → ai_positioning.
      // CRITIQUE : evidence_fr est un array de DICTS {source, text_fr}
      // (235/235 cas observés). Composant ai-positioning-card.tsx ligne
      // 146 rend `e` direct quand non-string → React crashe sur les objets.
      // FIX : on extrait text_fr pour produire un array de strings.
      if (
        isFr &&
        enrich.ai_positioning_fr &&
        typeof enrich.ai_positioning_fr === "object" &&
        !Array.isArray(enrich.ai_positioning_fr)
      ) {
        const aiFr = enrich.ai_positioning_fr as Record<string, unknown>;
        const ai = (data as Record<string, unknown>).ai_positioning as
          | Record<string, unknown>
          | undefined;
        if (ai && typeof ai === "object") {
          const summaryFr = aiFr.summary_fr;
          if (typeof summaryFr === "string" && summaryFr.trim().length > 0) {
            ai.summary = summaryFr;
          }
          const evidenceFr = aiFr.evidence_fr;
          if (Array.isArray(evidenceFr) && evidenceFr.length > 0) {
            const cleanedEv: string[] = [];
            for (const ev of evidenceFr) {
              if (typeof ev === "string" && ev.trim().length > 0) {
                cleanedEv.push(ev);
              } else if (ev && typeof ev === "object" && !Array.isArray(ev)) {
                const evObj = ev as Record<string, unknown>;
                const textFr = evObj.text_fr;
                if (typeof textFr === "string" && textFr.trim().length > 0) {
                  cleanedEv.push(textFr);
                }
              }
            }
            if (cleanedEv.length > 0) {
              ai.evidence = cleanedEv;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`ai_positioning_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 7. stories_body_fr → array [{kpi_short, body_fr}]. Match par
      // kpi.short et set kpi.description (champ réellement lu par
      // kpi-story-card.tsx ligne 191 `kpi.description`).
      if (
        isFr &&
        Array.isArray(enrich.stories_body_fr) &&
        Array.isArray(data.kpis) &&
        data.kpis.length > 0
      ) {
        const storiesArr = enrich.stories_body_fr as Array<Record<string, unknown>>;
        const byShort = new Map<string, string>();
        for (const s of storiesArr) {
          if (!s || typeof s !== "object") continue;
          const kpiShort = s.kpi_short;
          const bodyFr = s.body_fr;
          if (
            typeof kpiShort === "string" &&
            kpiShort.trim().length > 0 &&
            typeof bodyFr === "string" &&
            bodyFr.trim().length > 0
          ) {
            byShort.set(kpiShort, bodyFr);
          }
        }
        if (byShort.size > 0) {
          data.kpis = (data.kpis as AnyKPI[]).map((k) => {
            if (!k || typeof k !== "object") return k;
            const short = typeof k.short === "string" ? k.short : "";
            if (!short) return k;
            const bodyFr = byShort.get(short);
            if (bodyFr) {
              return { ...k, description: bodyFr };
            }
            return k;
          });
        }
      }
    } catch (err) {
      console.warn(`stories_body_fr merge failed for ${ticker}:`, err);
    }

    try {
      // 8. CRITIQUE — kpis_supplementary (array nouveaux KPIs spec) :
      // APPEND à data.kpis avec anti-doublon sur le champ `short`.
      // Source unique des KPIs spécifiques pour ~570 stés. Spread
      // immutable (pas de push) pour éviter mutation accidentelle.
      if (Array.isArray(enrich.kpis_supplementary) && Array.isArray(data.kpis)) {
        const existingShortsSupp = new Set(
          (data.kpis as AnyKPI[])
            .map((k) => (k && typeof k === "object" ? k.short : undefined))
            .filter(Boolean),
        );
        const extraSupp: AnyKPI[] = [];
        for (const k of enrich.kpis_supplementary as unknown[]) {
          if (!k || typeof k !== "object" || Array.isArray(k)) continue;
          const kObj = k as AnyKPI;
          const short = kObj.short;
          if (typeof short !== "string" || !short.trim()) continue;
          if (existingShortsSupp.has(short)) continue;
          extraSupp.push({
            ...kObj,
            history: normalizeHistory(kObj.history),
            _source: "kpis-supplementary",
          });
        }
        if (extraSupp.length > 0) {
          data.kpis = [...(data.kpis as AnyKPI[]), ...extraSupp];
        }
      }
    } catch (err) {
      console.warn(`kpis_supplementary merge failed for ${ticker}:`, err);
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

  // Hero name_fr override (CONV-CONCEPTS 21 mai 2026, sub-agent l_hero_name_fr) :
  // fix critère audit l_hero_name_fr KO (55 stés où name_fr du hero KPI est
  // vide, identique au short, ou en anglais). Source :
  // `src/data/v2-pipeline-enrich/<ticker>.hero_name_fr.json`. Format :
  // { overrides_hero_name_fr: { hero_short, name_fr }, hero_kpi_override?: "..." }
  // - Si hero_kpi_override présent → repointe data.hero_kpi (cas hero introuvable
  //   dans kpis[]).
  // - Applique name_fr au KPI matching (écrase name_fr courant — qui était vide,
  //   = short, ou en anglais).
  // Merge SSR-only (n'altère pas v2-pipeline/<t>.json).
  const heroNameFrPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.hero_name_fr.json`,
  );
  const heroNameFrFile = await readJsonOrNull<{
    overrides_hero_name_fr?: { hero_short?: string; name_fr?: string };
    hero_kpi_override?: string;
  }>(heroNameFrPath);
  if (heroNameFrFile) {
    if (
      heroNameFrFile.hero_kpi_override &&
      typeof heroNameFrFile.hero_kpi_override === "string"
    ) {
      // Yann 27 mai 2026 (point 4) : idem garde-fou que merge enrich plus haut.
      const ov = heroNameFrFile.hero_kpi_override;
      const dataShortsFinal = new Set(
        (Array.isArray(data.kpis) ? data.kpis : []).map((k: AnyKPI) => k?.short).filter(Boolean)
      );
      if (dataShortsFinal.has(ov)) {
        (data as Record<string, unknown>).hero_kpi = ov;
      }
    }
    const ov = heroNameFrFile.overrides_hero_name_fr;
    if (
      ov &&
      ov.hero_short &&
      ov.name_fr &&
      typeof ov.name_fr === "string" &&
      Array.isArray(data.kpis)
    ) {
      data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
        if (
          typeof k.short === "string" &&
          k.short.toLowerCase() === ov.hero_short!.toLowerCase()
        ) {
          return { ...k, name_fr: ov.name_fr };
        }
        return k;
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
      // Yann 18 mai 2026 : tagline garde la langue d'origine (EN, CLAUDE.md §6).
      // On stocke la traduction localisée dans `tagline_i18n[locale]` pour
      // que le composant CompanyHeader affiche un tooltip "i" avec la trad.
      // Le tagline EN original reste affiché.
      if (i18n?.tagline) {
        const taglineI18n = (d.tagline_i18n as Record<string, string>) || {};
        taglineI18n[requestedLocale] = i18n.tagline;
        d.tagline_i18n = taglineI18n;
      }
      if (i18n?.hero_kpi_rationale) d.hero_kpi_rationale = i18n.hero_kpi_rationale;
      else if (enFallback?.hero_kpi_rationale) d.hero_kpi_rationale = enFallback.hero_kpi_rationale;
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

  // Yann 25 mai 2026 : si locale demandée = "fr", on overlay l'ai_positioning
  // evidence depuis v2-pipeline-i18n/<ticker>.fr.json champ
  // `ai_positioning_evidence_fr`. Les sources enrich (CONV-DATA) contiennent
  // souvent des phrases EN dans evidence. Cet overlay les remplace par leur
  // traduction FR quand disponible (translated by script translate-ai-evidence-fr-cerebras.py).
  // Fallback : si pas de FR pour un index, on garde la phrase originale (souvent FR déjà).
  if (requestedLocale === "fr" || requestedLocale === "fr-fr") {
    const frPath = path.join(
      ROOT,
      "src/data/v2-pipeline-i18n",
      `${ticker.toLowerCase()}.fr.json`,
    );
    const frFile = await readJsonOrNull<{
      ai_positioning_evidence_fr?: Array<string>;
    }>(frPath);
    const aiEv = frFile?.ai_positioning_evidence_fr;
    const ai = (data as Record<string, unknown>).ai_positioning as
      | Record<string, unknown>
      | undefined;
    if (
      Array.isArray(aiEv) &&
      ai &&
      Array.isArray((ai as { evidence?: unknown }).evidence)
    ) {
      const original = (ai as { evidence: unknown[] }).evidence;
      const merged = original.map((orig, idx) => {
        const tr = aiEv[idx];
        if (typeof tr === "string" && tr.trim().length > 0) {
          return tr;
        }
        return orig;
      });
      (ai as { evidence: unknown }).evidence = merged;
    }
  }

  // Yann 29 mai 2026 : filtre KPIs désactivés individuellement par sté
  // (granulaire, via /admin/kpis-toggle). Source de vérité unique :
  // `src/data/disabled-kpis-per-ste.json`. Appliqué APRÈS tous les merges
  // (enrich, supplementary, overrides) pour cacher exactement les KPIs
  // que Yann a décochés. Si le hero_kpi est désactivé, on fallback sur le
  // premier KPI activé et on marque `_hero_kpi_replaced_by_disable` pour
  // traçabilité côté admin.
  try {
    const { getDisabledKpisForTicker } = await import("@/lib/disabled-kpis");
    const disabledShorts = new Set(getDisabledKpisForTicker(canonical));
    if (disabledShorts.size > 0 && Array.isArray(data.kpis)) {
      const before = (data.kpis as AnyKPI[]).length;
      const filtered = (data.kpis as AnyKPI[]).filter((k) => {
        const s = typeof k?.short === "string" ? k.short : "";
        return !disabledShorts.has(s);
      });
      data.kpis = filtered;
      // Si le hero a été désactivé, repointer sur le premier KPI restant.
      const heroShort = data.hero_kpi as string | undefined;
      if (heroShort && disabledShorts.has(heroShort)) {
        const fallback = filtered.find((k) => typeof k?.short === "string");
        if (fallback) {
          (data as Record<string, unknown>).hero_kpi = fallback.short;
          (data as Record<string, unknown>)._hero_kpi_replaced_by_disable = {
            original: heroShort,
            fallback_to: fallback.short,
          };
        }
      }
      if (before !== filtered.length) {
        (data as Record<string, unknown>)._kpis_disabled_count = before - filtered.length;
      }
    }
  } catch (err) {
    console.warn(`disabled-kpis filter failed for ${ticker}:`, err);
  }

  // Fresh / stale backfill via existing helper
  const company = enhanceFreshness(data as Company & Record<string, unknown>);

  // Sanity : si risks n'a pas score_rationale (V1.0 le requiert), on
  // laisse RiskStack rendre quand même mais sans le tooltip.
  if (Array.isArray(company.risks)) {
    company.risks = company.risks.map((r: CompanyRisk) => ({ ...r }));
  }

  // Yann 18 mai 2026 : injecte traduction FR du tagline depuis le fichier
  // global taglines-fr.json. Source tagline = EN (CLAUDE.md §6).
  // Yann 28 mai 2026 : ne PAS écraser une trad FR déjà posée par
  // `enrich.tagline_fr` (cf merge ligne ~1167). La trad par-sté dans enrich
  // est canonique (rédigée spécifiquement pour la sté), alors que le fichier
  // global est un fallback générique. Cas observé : MU enrich.tagline_fr
  // "Leader mondial des semi-conducteurs de mémoire et stockage, au service
  // de l'IA et du cloud." vs taglines-fr.json "semiconducteurs..." (générique
  // sans tiret + traduction littérale). On garde la spécifique.
  if (company.tagline) {
    const taglineMap = await loadTaglinesFr();
    const frTr = taglineMap[company.tagline];
    if (frTr) {
      const cur = ((company as Company & { tagline_i18n?: Record<string, string> }).tagline_i18n) || {};
      if (!cur.fr) {
        (company as Company & { tagline_i18n?: Record<string, string> }).tagline_i18n = {
          ...cur,
          fr: frTr,
        };
      }
    }
  }

  return { kind: "ready", company };
}
