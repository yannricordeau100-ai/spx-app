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
import { definitionGeneriqueKpi } from "@/lib/kpi-definitions-generiques";
import doublonsForcesJson from "@/data/kpi-doublons-forces.json";
import path from "path";
import type { Company, CompanyRisk } from "@/lib/data";
import { enhanceFreshness } from "@/lib/company-core/enhance-freshness";
import { isStrictPass3, isV18Eligible } from "@/lib/company-core/strict-pass3";
import { isGenericKpi } from "@/lib/kpi-generic";
import { cleanSourceCitations } from "@/lib/ui-fix-templates";

/**
 * Yann 21 août 2026 — nettoyage des citations de source pour TOUTES les stés.
 *
 * Les libellés type "(10-Q MU 2026-06-25, XBRL EarningsPerShareDiluted)" sont
 * figés dans les datasets (signal, description, interprétation, risques…).
 * On les normalise ICI, côté serveur, avant sérialisation : le rendu ET la
 * payload React ne contiennent plus ni code de formulaire SEC, ni "XBRL",
 * ni nom de balise technique.
 *
 * Clés ignorées : identifiants et URLs (jamais du texte affiché).
 */
const CITATION_SKIP_KEY_RE =
  /(?:^|_)(?:url|href|src|link|logo|image|img|path|slug|domain|email|ticker|cik|isin|id|key|short|type|unit|period_type|last_data_date|date|filed|form)$/i;

function deepCleanCitations<T>(value: T, key?: string): T {
  if (typeof value === "string") {
    if (key && CITATION_SKIP_KEY_RE.test(key)) return value;
    if (/^(?:https?:)?\/\//i.test(value)) return value;
    return cleanSourceCitations(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = deepCleanCitations(value[i], key);
    }
    return value;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      obj[k] = deepCleanCitations(obj[k], k);
    }
    return value;
  }
  return value;
}

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
 * Yann 9 juin 2026 — GARDE-FOU HERO PRIME : un hero spécifique valide
 * (présent dans kpis[] ET hors generic-library) PRIME sur toute
 * ré-désignation tardive vers un KPI générique.
 *
 * Contexte bug MCHP : `enrich.hero_kpi_override = "Microcontroller Revenue"`
 * (spécifique, présent) était écrasé par une couche TARDIVE
 * (`<t>.hero_name_fr.json` → `hero_kpi_override: "Net Sales"`), ce qui
 * affichait un hero GÉNÉRIQUE. Règle : on ne rétrograde JAMAIS un hero
 * spécifique valide vers un générique via les couches d'auto-désignation
 * (special-kpis is_hero, pivot hero_name_fr, fallback disabled).
 *
 * Retourne true si `candidate` peut remplacer le hero courant de `data`.
 * Bloque uniquement la rétrogradation spécifique→générique : tout le reste
 * (générique→spécifique, spécifique→spécifique, hero courant absent) reste
 * autorisé pour ne pas régresser les autres mécanismes.
 */
function canReplaceHero(data: AnyCo, candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const cur = data.hero_kpi as string | undefined;
  if (!cur || cur === candidate) return true;
  const kpis = (data.kpis as AnyKPI[] | undefined) ?? [];
  const shorts = new Set(kpis.map((k) => k?.short).filter(Boolean) as string[]);
  const curIsValidSpecific = shorts.has(cur) && !isGenericKpi(cur);
  // Hero courant spécifique + présent → on refuse de le remplacer par un générique.
  if (curIsValidSpecific && isGenericKpi(candidate)) return false;
  return true;
}

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
  // 1. Hero KPI : match EXACT sur k.short uniquement. Si aucun match exact,
  //    on laisse hero_kpi tel quel : le merge enrich complétera. Yann 11 juil
  //    2026 : ancien fuzzy substring provoquait cross-pollution KPI (bug graph
  //    ~250 stés).
  const kpis = (data.kpis as AnyKPI[] | undefined) ?? [];
  const heroShort = data.hero_kpi as string | undefined;
  if (heroShort && kpis.length > 0) {
    // match exact seulement — si absent, on laisse tel quel.
    kpis.find((k) => k.short === heroShort);
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
      const unitStr = typeof out.unit === "string" ? out.unit : "";
      if (yoyStr && Array.isArray(out.history) && out.history.length >= 2) {
        const yoyN = Number(yoyStr.replace("%", "").replace(",", ".").replace("+", "").trim());
        const h = out.history as number[];
        const first = h[0];
        const last = h[h.length - 1];
        // Garde-fous (Yann 11 juin 2026) : cette re-inversion ne vaut QUE pour
        // des séries de NIVEAU monotones stockées à l'envers. Elle corrompait
        // les KPI de VARIATION (% YoY, ex "Prix par pub" [24,-16,-9,10,9] : pic
        // en 2021, +9% en 2025 → faussement inversé en 2025=24) et toute série
        // non-monotone. On ne reverse plus si :
        //  - unité de variation (% YoY, pts, évolution, croissance) ;
        //  - une valeur <= 0 (typique d'une série de variation) ;
        //  - série non strictement monotone.
        const isVariation = /yoy|variation|évolution|evolution|croissance|\bpts?\b/i.test(unitStr);
        const hasNonPos = h.some((x) => typeof x === "number" && x <= 0);
        let monotonic = true;
        let dir = 0;
        for (let k = 1; k < h.length; k++) {
          const d = h[k] - h[k - 1];
          if (d > 0) { if (dir < 0) { monotonic = false; break; } dir = 1; }
          else if (d < 0) { if (dir > 0) { monotonic = false; break; } dir = -1; }
        }
        if (!isVariation && !hasNonPos && monotonic &&
            Number.isFinite(yoyN) && Math.abs(yoyN) > 5 && first > 0 && last > 0) {
          const trendPct = ((last - first) / Math.abs(first)) * 100;
          // Désaccord de signe + amplitude significative → série à l'envers.
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
/** Historique trimestriel verifie (v2-pipeline-enrich/<t>.quarterly-history.json). */
type SerieTrimestrielleExt = {
  method?: string;
  kpis?: Array<{
    short: string;
    period_type?: string;
    history?: number[];
    history_periods?: string[];
    last_data_date?: string;
    unit?: string | null;
  }>;
};

const ALLOWED_QUARTERLY_METHODS = new Set(["xbrl-companyfacts", "llm-filing-crosschecked"]);

/**
 * Fusionne les series trimestrielles verifiees dans une liste de KPI.
 * Yann 3 sept 2026 : cette fusion etait appliquee AVANT l injection de la
 * couche kpis-haut, qui remplace ensuite les KPI de meme identifiant. Les
 * series verifiees du lot Q4 n arrivaient donc jamais a l ecran. La fusion
 * est desormais une fonction, appelee aux DEUX endroits.
 */
function fusionneSeriesTrimestrielles(
  kpis: AnyKPI[],
  qExt: SerieTrimestrielleExt | null,
): AnyKPI[] {
    if (
    !qExt
    || typeof qExt.method !== "string"
    || !ALLOWED_QUARTERLY_METHODS.has(qExt.method)
    || !Array.isArray(qExt.kpis)
  ) return kpis;
  {
    const extByShort = new Map(
      qExt.kpis.filter((k) => k && k.short).map((k) => [k.short, k] as const),
    );
    return (kpis).map((k) => {
      const ext = extByShort.get(String(k.short));
      if (!ext || !Array.isArray(ext.history) || ext.history.length === 0) return k;
      // Garde-fou 3 sept 2026 : une serie dont les etiquettes de periode ne
      // correspondent pas au nombre de valeurs produit un graphique aux
      // dates fausses (les labels sont refabriques a rebours). On l ignore.
      if (
        Array.isArray(ext.history_periods)
        && ext.history_periods.length !== ext.history.length
      ) return k;
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
  return kpis;
}

// Yann 3 sept 2026 : ouverture d une fiche trop lente (5 a 6 s a froid). Les
// donnees d une societe ne changent qu au deploiement : cache memoire 10 min
// par instance serveur, cle ticker + mode + langue. Le palier et l auth
// restent calcules a chaque requete par la page.
const CACHE_FICHES = new Map<string, { at: number; valeur: LoadOutcome }>();
const CACHE_TTL_MS = 10 * 60_000;

export async function loadV17Company(
  ticker: string,
  opts: { mode?: "v17" | "v18"; locale?: string } = {}
): Promise<LoadOutcome> {
  const cle = `${ticker.toUpperCase()}|${opts.mode ?? "v17"}|${opts.locale ?? "fr"}`;
  const hit = CACHE_FICHES.get(cle);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.valeur;
  const valeur = await loadV17CompanyBrut(ticker, opts);
  if (valeur.kind === "ready") {
    CACHE_FICHES.set(cle, { at: Date.now(), valeur });
    if (CACHE_FICHES.size > 400) {
      const plusVieux = [...CACHE_FICHES.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
      if (plusVieux) CACHE_FICHES.delete(plusVieux);
    }
  }
  return valeur;
}

async function loadV17CompanyBrut(
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
    // Yann 4 juin 2026 : Alibaba listing HK -> ADR US BABA (canonical).
    "9988.HK": "BABA",
    "9988-HK": "BABA",
    // Top 307 V1.8 doublons ADR/multi-listing (canonical = listing principale)
    ASMLF: "ASML",
    ABBNY: "ABBN.SW",
    ABLZF: "ABBN.SW",
    ADTTF: "ATEYY",
    BPAQF: "BP",
    "BP.L": "BP",
    "NDA-DK.CO": "NDA-FI.HE",
    "NDA-SE.ST": "NDA-FI.HE",
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
    BMWYY: "BMW.DE",
    "BNPQF": "BNPQY",
    BTI: "BTAFF",
    "BUD": "ABI.BR",
    "CRH.L": "CRH",
    "DANSKE.CO": "DNKEY",
    DEGAF: "DGEAF",
    "DEO": "DGEAF",
    DGEAY: "DGEAF",
    DTGHF: "DTG.DE",
    EMSHF: "EMSHY",
    "EQNR.OL": "EQNR",
    "ESLOY": "EL.PA",
    GLAXF: "GSK",
    "GLEN.L": "GLNCY",
    "GSK.L": "GSK",
    HINKF: "HEIA.AS",
    "HEIO.AS": "HEIA.AS",
    HOLIY: "HCMLF",
    "HSBA.L": "HSBC",
    INFY: "INFY.NS",
    "ITX.MC": "ITXAF",
    "LIN.DE": "LIN",
    "LIN.L": "LIN",
    "LLOY.L": "LYG",
    LRLCF: "OR.PA",
    LRLCY: "OR.PA",
    "MAERSK-B.CO": "AMKBY",
    MURGY: "MUV2.DE",
    NJDCY: "JD",
    "NOKIA.HE": "NOK",
    "NOVO-B.CO": "NVO",
    NWS_A: "NWSA",
    "ORK.OL": "ORKLY",
    PHG: "PHIA.AS",
    PRGOF: "PRGO",
    "REL.L": "RELX",
    REPYY: "REP.MC",
    "RIO.L": "RIO",
    "RR.L": "RYCEF",
    "RTO.L": "RTOXY",
    RWEOY: "RWE.DE",
    SAFRF: "SAFRY",
    SAN: "SAN.PA",
    SAP: "SAP.DE",
    SCMWY: "MUV2.DE",
    "SHEL.L": "SHEL",
    "SHEL": "RDSMY",
    SHELF: "SHEL",
    SIEGY: "SIE.DE",
    "SMSN.IL": "SSNLF",
    SU: "SU.PA",
    "TEL.L": "TELOF",
    TEL2A: "TEL2-B.ST",
    "TM": "7203.T",
    "TOTF": "TTE.PA",
    "TOTGY": "TTE.PA",
    UBSFY: "UBS",
    "ULVR.L": "UL",
    VWAGY: "VWAPY",
    "VOW.DE": "VOW3.DE",
    VWAPY: "VOW3.DE",
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

  // Mettrik description (simple + advanced × 3 langues) : fichiers séparés.
  // - Legacy : `<t>.description.json` (Yann 14 mai 2026, Gemini Flash)
  // - Nouveau : `<t>.mettrik-description.json` (sub-agent 1 juin 2026,
  //   Cerebras gpt-oss-120b, schéma {mettrik_description:{simple:{fr:{...}},
  //   advanced:{fr:{...}}}})
  // Yann 4 juin 2026 : le nouveau path n'était pas chargé → la description
  // tombait sur le legacy yfinance EN. Fix : on charge les 2 et le nouveau
  // gagne s'il existe.
  const legacyDescPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.description.json`,
  );
  const legacyDescFile = await readJsonOrNull<{
    simple?: { fr?: unknown; en?: unknown; de?: unknown };
    advanced?: { fr?: unknown; en?: unknown; de?: unknown };
  }>(legacyDescPath);
  if (legacyDescFile && legacyDescFile.simple && legacyDescFile.advanced) {
    (data as Record<string, unknown>).mettrik_description = {
      simple: legacyDescFile.simple,
      advanced: legacyDescFile.advanced,
    };
  }
  const newDescPath = path.join(
    ROOT,
    "src/data/v2-pipeline-enrich",
    `${ticker.toLowerCase()}.mettrik-description.json`,
  );
  const newDescFile = await readJsonOrNull<{
    mettrik_description?: {
      simple?: { fr?: unknown; en?: unknown; de?: unknown };
      advanced?: { fr?: unknown; en?: unknown; de?: unknown };
    };
  }>(newDescPath);
  const newMd = newDescFile?.mettrik_description;
  if (newMd && newMd.simple && newMd.advanced) {
    (data as Record<string, unknown>).mettrik_description = {
      simple: newMd.simple,
      advanced: newMd.advanced,
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
      "revenue_history",
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
      // Yann 11 juil 2026 : clef case-insensitive + trim pour éviter les
      // mismatches "Total Revenue" vs "total revenue" vs " Total Revenue ".
      // Si conflit après normalisation : winner = celui qui a last_data_date
      // non vide + history_periods non vide.
      const normKey = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
      const hasStrong = (k: AnyKPI) => {
        const ldd = typeof k?.last_data_date === "string" && k.last_data_date.trim().length > 0;
        const hp = Array.isArray((k as AnyKPI & { history_periods?: unknown[] }).history_periods)
          && ((k as AnyKPI & { history_periods?: unknown[] }).history_periods as unknown[]).length > 0;
        return ldd && hp;
      };
      const dataByShort = new Map<string, AnyKPI>();
      for (const k of dataKpis) {
        const key = normKey(k?.short);
        if (!key) continue;
        const prev = dataByShort.get(key);
        if (!prev) dataByShort.set(key, k);
        else if (hasStrong(k) && !hasStrong(prev)) dataByShort.set(key, k);
      }
      const consumedKeys = new Set<string>();
      for (const ek of enrichKpis) {
        const ekKey = normKey(ek.short);
        if (!ekKey) continue;
        const existing = dataByShort.get(ekKey);
        if (existing) {
          consumedKeys.add(ekKey);
          const existingLen = Array.isArray(existing.history) ? (existing.history as unknown[]).length : 0;
          const enrichLen = Array.isArray(ek.history) ? (ek.history as unknown[]).length : 0;
          // Égalité → on prend la version enrich (souvent plus récente).
          // Strict > → on garde existing.
          let winner: AnyKPI = enrichLen >= existingLen ? ek : existing;
          let loser: AnyKPI = winner === ek ? existing : ek;
          // Conflit fort : si l'un a last_data_date + history_periods non vides
          // et pas l'autre, c'est lui le winner.
          const ekStrong = hasStrong(ek);
          const exStrong = hasStrong(existing);
          if (ekStrong && !exStrong) { winner = ek; loser = existing; }
          else if (exStrong && !ekStrong) { winner = existing; loser = ek; }
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
        const key = normKey(k?.short);
        if (key && !consumedKeys.has(key)) {
          mergedKpis.push(k);
        }
      }
      // Append les KPIs enrich qui n'existaient pas côté data.
      const existingMergedKeys = new Set(
        mergedKpis.map((k) => normKey(k?.short)).filter((s) => Boolean(s)),
      );
      for (const ek of enrichKpis) {
        const ekKey = normKey(ek.short);
        if (ekKey && !existingMergedKeys.has(ekKey)) {
          mergedKpis.push(ek);
          existingMergedKeys.add(ekKey);
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
    // Yann 3 juin 2026 : merge SA22-D nouveaux KPIs sectoriels quarterly Cerebras.
    // Source : `src/data/v2-pipeline-enrich/<ticker>.sa22d.json`.
    // Format : { ticker, _sa22_d_extracted_at, model, kpis: [...] }.
    // Anti-invention : history ≥4 trims chiffrés, devise native, ticker spécifique.
    // Append-only (skip si short déjà présent).
    try {
      const sa22dPath = path.join(
        ROOT,
        "src/data/v2-pipeline-enrich",
        `${ticker.toLowerCase()}.sa22d.json`,
      );
      const sa22dData = await readJsonOrNull<{ kpis?: AnyKPI[] }>(sa22dPath);
      if (
        sa22dData
        && Array.isArray(sa22dData.kpis)
        && Array.isArray(data.kpis)
      ) {
        const existingShortsSA22 = new Set(
          (data.kpis as AnyKPI[]).map((k) => k?.short).filter(Boolean),
        );
        const extraSA22 = sa22dData.kpis
          .filter((k): k is AnyKPI => Boolean(k && typeof k === "object" && k.short && !existingShortsSA22.has(k.short)))
          .map((k) => ({
            ...k,
            history: normalizeHistory(k.history),
            _source: "sa22-d-cerebras",
          }));
        if (extraSA22.length > 0) {
          data.kpis = [...data.kpis, ...extraSA22];
        }
      }
    } catch {
      // best effort
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
        const extShortLow = ext.hero_kpi_short.toLowerCase();
        // BUG FIX : matcher UNIQUEMENT la cible explicite extShortLow (comme
        // _quarterly_history_extension corrige le 3 juin). L'ancien match
        // prioritaire sur data.hero_kpi ecrasait le hero courant avec la serie
        // de l'extension meme quand elle visait un AUTRE KPI (ex CNP "Electric
        // Customers" ecrase par le CA total).
        const heroKpi = (data.kpis as AnyKPI[]).find((k) => {
          if (!k || typeof k !== "object") return false;
          const s = (typeof k.short === "string" ? k.short : "").trim().toLowerCase();
          return s === extShortLow.trim().toLowerCase();
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
    // Yann 2 juin 2026 — MERGE FORMAT OBJET `_quarterly_history_extension`.
    // 492 stés ont un payload de la forme :
    //   {
    //     hero_kpi_short: "Microsoft Cloud",
    //     period_type: "quarter",
    //     history: [{quarter:"Q1 2020", value:35.021, date:"...", source:"..."}, ...]
    //   }
    // Ce format n'était PAS mergé avant (les blocs existants attendent
    // `history: number[]` ou `kpis: [...]`). Effet : extension du hero KPI
    // (matching fuzzy par short) avec les valeurs trimestrielles, en
    // forçant period_type="quarter" si applicable.
    if (
      enrich._quarterly_history_extension
      && typeof enrich._quarterly_history_extension === "object"
      && Array.isArray(data.kpis)
    ) {
      const qhe = enrich._quarterly_history_extension as {
        hero_kpi_short?: string;
        period_type?: string;
        history?: unknown;
        last_data_date?: string;
        unit?: string;
      };
      const rawHist = Array.isArray(qhe.history) ? qhe.history : [];
      const isObjectFormat = rawHist.length > 0
        && typeof rawHist[0] === "object"
        && rawHist[0] !== null
        && !Array.isArray(rawHist[0]);
      // Yann 2 juin 2026 v10 : accepte aussi "semester" pour les stés EU
      // semestrielles (BN.PA, ROG.SW, etc.).
      if (
        isObjectFormat
        && (qhe.period_type === "quarter" || qhe.period_type === "semester")
        && qhe.hero_kpi_short
      ) {
        const values: number[] = [];
        const periods: string[] = [];
        let lastDate: string | undefined;
        for (const item of rawHist as Array<Record<string, unknown>>) {
          if (!item || typeof item !== "object") continue;
          const v = item.value;
          if (typeof v !== "number" || !Number.isFinite(v)) continue;
          values.push(v);
          const q = typeof item.quarter === "string"
            ? item.quarter
            : typeof item.period === "string"
              ? item.period
              : undefined;
          if (q) periods.push(q);
          const d = typeof item.date === "string" ? item.date : undefined;
          if (d) lastDate = d;
        }
        if (values.length >= 4) {
          const extShortLow = qhe.hero_kpi_short.toLowerCase();
          // BUG FIX 3 juin 2026 : ancien code matchait data.hero_kpi en
          // PRIORITÉ, ce qui écrasait le hero actuel avec les données
          // de l'extension même si l'extension visait un AUTRE KPI.
          // Exemple AAPL : hero_kpi="iPhone Revenue", extension visait
          // "Total Revenue" → les valeurs Total Revenue (FY14-FY25)
          // écrasaient l'history iPhone Revenue. Fix : matcher
          // UNIQUEMENT sur extShortLow (cible explicite de l'extension).
          const heroKpi = (data.kpis as AnyKPI[]).find((k) => {
            if (!k || typeof k !== "object") return false;
            const s = (typeof k.short === "string" ? k.short : "").trim().toLowerCase();
            return s === extShortLow.trim().toLowerCase();
          });
          if (heroKpi) {
            const curLen = Array.isArray(heroKpi.history) ? heroKpi.history.length : 0;
            const isQuarterAlready = (heroKpi as AnyKPI).period_type === "quarter";
            // Anti-écrasement : si le hero KPI est déjà quarter avec
            // h >= values.length, on garde l'existant. Sinon on
            // remplace par les valeurs trimestrielles extraites.
            if (!isQuarterAlready || values.length > curLen) {
              (heroKpi as AnyKPI).history = values;
              (heroKpi as AnyKPI).period_type = "quarter";
              if (periods.length === values.length) {
                (heroKpi as AnyKPI).history_periods = periods;
              }
              if (lastDate) (heroKpi as AnyKPI).last_data_date = lastDate;
              if (qhe.unit) (heroKpi as AnyKPI).unit = qhe.unit;
              (heroKpi as AnyKPI).is_short_history = values.length < 3;
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
            // Yann 2 juin 2026 v10 : skip si KPI déjà natif quarter OU semester.
            if (curPeriod.toLowerCase() === "quarter" || curPeriod.toLowerCase() === "semester") return k;
            // Récupère history_periods / last_data_date / unit du quarterly
            // s'ils sont présents, sinon laisse intact côté KPI canonique.
            const qPeriods = Array.isArray(ek.history_periods)
              ? (ek.history_periods as unknown[]).filter((v): v is string => typeof v === "string")
              : undefined;
            const qLastDate = typeof ek.last_data_date === "string" ? ek.last_data_date : undefined;
            const qUnit = typeof ek.unit === "string" ? ek.unit : undefined;
            // Yann 2 juin 2026 v10 : propage period_type depuis ek
            // ("semester" pour EU, "quarter" pour US/Canada/FPI).
            const ekPeriod = typeof ek.period_type === "string"
              ? ek.period_type
              : "quarter";
            return {
              ...k,
              history: qHist,
              history_periods: qPeriods && qPeriods.length === qHist.length ? qPeriods : k.history_periods,
              period_type: ekPeriod,
              last_data_date: qLastDate ?? (k as AnyKPI & { last_data_date?: string }).last_data_date,
              unit: qUnit ?? k.unit,
              is_short_history: qHist.length < 3,
            } as AnyKPI;
          });
        }
      }
    }
    // Yann 15 mai 2026 v2 : RÉACTIVÉ avec contrainte stricte.
    // Le merge accepte les fichiers .quarterly-history.json marqués
    // method="xbrl-companyfacts" (extraction directe XBRL SEC EDGAR,
    // chiffres taggés par la sté elle-même). Tout fichier sans une des
    // marques autorisées (= ancien script LLM Cerebras qui hallucinait) est
    // ignoré.
    // Yann 2 juillet 2026 : ajout method="llm-filing-crosschecked" — go
    // explicite de Yann pour l'extraction historique complet SP500 (Claude
    // Opus/Sonnet, lecture directe des 10-Q/10-K, chaque valeur recoupée
    // FY = somme(Q1..Q4) quand applicable). Tag distinct de xbrl-companyfacts
    // pour rester réversible/traçable si un problème est détecté.
    const qPath = path.join(
      ROOT,
      "src/data/v2-pipeline-enrich",
      `${ticker.toLowerCase()}.quarterly-history.json`,
    );
    const qExt = await readJsonOrNull<SerieTrimestrielleExt>(qPath);
    if (Array.isArray(data.kpis)) {
      data.kpis = fusionneSeriesTrimestrielles(data.kpis as AnyKPI[], qExt);
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
          // Garde-fou (Yann 9 juin 2026) : ne pas rétrograder un hero
          // spécifique valide (ex enrich.hero_kpi_override) vers un générique.
          if (sp.is_hero && sp.style === "classique" && canReplaceHero(data, sp.kpi_short as string)) {
            (data as Record<string, unknown>).hero_kpi = sp.kpi_short;
          }
        }
      }
    } catch (err) {
      // Fail-safe : si BDD inaccessible, on continue sans special KPIs.
      console.warn(`special_kpis merge failed for ${ticker}:`, err);
    }
    // Yann (2 juin 2026) : merge auto des KPIs créés via /sandbox/kpi-builder
    // qui ont été extraits par le worker (status === "done", result avec value).
    // Source : Supabase desk_kpi_requests. Complète le merge desk_special_kpis
    // (manuel) ci-dessus avec les KPIs auto-extraits.
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const upTicker = ticker.toUpperCase();
      const { data: kpiReqs } = await sb
        .from("desk_kpi_requests")
        .select("*")
        .contains("tickers", [upTicker])
        .eq("status", "done");
      if (Array.isArray(kpiReqs) && kpiReqs.length > 0 && Array.isArray(data.kpis)) {
        for (const req of kpiReqs as Array<Record<string, unknown>>) {
          const results = Array.isArray(req.results) ? (req.results as Array<Record<string, unknown>>) : [];
          const result = results.find(
            (r) =>
              typeof r?.ticker === "string" &&
              (r.ticker as string).toUpperCase() === upTicker &&
              r?.value != null,
          );
          if (!result) continue;
          const kpiNameFr = typeof req.kpi_name_fr === "string" ? req.kpi_name_fr : "";
          const kpiNameEn = typeof req.kpi_name_en === "string" ? req.kpi_name_en : "";
          const short =
            (typeof req.kpi_short === "string" && req.kpi_short) ||
            (kpiNameFr ? kpiNameFr.slice(0, 30) : "") ||
            (kpiNameEn ? kpiNameEn.slice(0, 30) : "");
          if (!short) continue;
          if ((data.kpis as AnyKPI[]).some((k) => k?.short === short)) continue;
          const histRaw = result.history;
          const value = result.value as number | string;
          const historyArr = Array.isArray(histRaw)
            ? (histRaw as Array<number>)
            : [typeof value === "number" ? value : Number(value)];
          const kpiCategory = typeof req.kpi_category === "string" ? req.kpi_category : "";
          const kpi: AnyKPI = {
            short,
            name_fr: kpiNameFr || short,
            name_en: kpiNameEn || short,
            value,
            unit: (result.unit as string) ?? (typeof req.kpi_unit === "string" ? req.kpi_unit : "") ?? "",
            yoy: (result.yoy as number | string | null) ?? null,
            type: kpiCategory || "Volume",
            nature: mapKpiCategoryToNature(kpiCategory),
            comparable: false,
            history: historyArr,
            period_type: (result.period_type as string) ?? "year",
            signal: (result.signal as string) ?? "",
            description: (result.description as string) ?? "",
            explanation: kpiNameFr || short,
            is_wow: true,
            is_short_history: historyArr.length < 5,
          };
          (data.kpis as AnyKPI[]).push(kpi);
        }
      }
    } catch (err) {
      // Fail-safe : si BDD inaccessible, on continue sans kpi_requests.
      console.warn(`kpi_requests merge failed for ${ticker}:`, err);
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

  // Stories signal patch (Yann 5 juin 2026, sub-agent stories-signal) :
  // Source : `src/data/v2-pipeline-enrich/<ticker>.stories_signal_patch.json`
  // Format : { ticker, patches: [{ short, signal, description, _signal_patch_source }] }
  // Pour chaque KPI avec is_short_history=true et signal vide/absent, on
  // applique signal + description du patch matching par `short`. N'écrase
  // jamais un signal/description déjà rempli. Merge SSR-only, n'altère pas
  // v2-pipeline/<t>.json ni v2-pipeline-enrich/<t>.json principal.
  try {
    const storiesSignalPatchPath = path.join(
      ROOT,
      "src/data/v2-pipeline-enrich",
      `${ticker.toLowerCase()}.stories_signal_patch.json`,
    );
    const patchData = await readJsonOrNull<{
      patches?: Array<{ short?: string; signal?: string; description?: string }>;
    }>(storiesSignalPatchPath);
    if (
      patchData
      && Array.isArray(patchData.patches)
      && patchData.patches.length > 0
      && Array.isArray(data.kpis)
    ) {
      const patchByShort = new Map<string, { signal?: string; description?: string }>();
      for (const p of patchData.patches) {
        if (p && typeof p.short === "string" && p.short.trim()) {
          patchByShort.set(p.short, {
            signal: typeof p.signal === "string" ? p.signal : undefined,
            description: typeof p.description === "string" ? p.description : undefined,
          });
        }
      }
      data.kpis = (data.kpis as AnyKPI[]).map((k: AnyKPI) => {
        if (!k || typeof k !== "object") return k;
        if (!k.is_short_history) return k;
        const shortKey = typeof k.short === "string" ? k.short : "";
        if (!shortKey) return k;
        const patch = patchByShort.get(shortKey);
        if (!patch) return k;
        const out = { ...k };
        const curSignal = typeof k.signal === "string" ? k.signal.trim() : "";
        const curDesc = typeof k.description === "string" ? k.description.trim() : "";
        if (!curSignal && patch.signal) out.signal = patch.signal;
        if (!curDesc && patch.description) out.description = patch.description;
        return out;
      });
    }
  } catch (err) {
    console.warn(`stories_signal_patch merge failed for ${ticker}:`, err);
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
      // Garde-fou (Yann 9 juin 2026) : ce pivot file-based ne doit PAS
      // rétrograder un hero spécifique valide vers un générique (bug MCHP :
      // "Microcontroller Revenue" écrasé par "Net Sales"). Le pivot reste
      // appliqué quand le hero courant est introuvable ou déjà générique.
      if (dataShortsFinal.has(ov) && canReplaceHero(data, ov)) {
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
        // Garde-fou (Yann 9 juin 2026) : préférer un KPI spécifique comme
        // fallback hero plutôt que le premier venu (souvent générique).
        const fallback =
          filtered.find((k) => typeof k?.short === "string" && !isGenericKpi(k.short as string)) ??
          filtered.find((k) => typeof k?.short === "string");
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

  // Yann 2 juillet 2026 : REMPLACE TOTALEMENT les KPIs (v2-pipeline générique
  // + enrich + specific-kpis + sa22d + supplementary, tous mergés au-dessus)
  // par les KPIs "haut de gamme" dédiés (`.batches-drafts-safe/kpis-haut/<T>.json`)
  // quand ce fichier existe. Positionné en tout dernier, juste avant
  // enhanceFreshness, pour ne laisser AUCUN doublon (ex NVDA "Data Center
  // Revenue" legacy + "DC_REV" kpis-haut coexistant dans le tableau — bug
  // détecté par Yann le 4 juillet 2026). Un KPI haut de gamme n'est jamais
  // un simple earning/CA/revenu générique — c'est un indicateur distinctif
  // propre à la sté (production rate, backlog, NIM, attach rate, etc.).
  const kpisHautPath = path.join(
    ROOT,
    ".batches-drafts-safe/kpis-haut",
    `${ticker.toUpperCase()}.json`,
  );
  const kpisHaut = await readJsonOrNull<{
    kpis?: Array<{
      short: string;
      name_fr?: string;
      name_en?: string;
      value?: unknown;
      unit?: string;
      yoy?: unknown;
      pv_score?: number;
      signal?: string;
      frequency?: string;
      last_data_date?: string;
      history?: Array<{ q: string; v: number }>;
      _fp_note?: string;
      _needs_review?: boolean;
      _value_note?: string;
      _gap_note?: string;
    }>;
  }>(kpisHautPath);
  // Yann 4 juillet 2026 : type deduit du sens du KPI (avant: "Volume"
  // hardcode -> blocs Interpretation Moteur/Vigilance/Cash mal classes).
  const inferKpiHautType = (k: { short: string; name_fr?: string; name_en?: string; unit?: string }): string => {
    const blob = `${k.short} ${k.name_fr ?? ""} ${k.name_en ?? ""}`.toLowerCase();
    const unit = String(k.unit ?? "").toLowerCase();
    if (/\b(fcf|free cash flow|operating cash flow|tr[ée]sorerie)\b/.test(blob)) return "Cash Flow";
    if (/%/.test(unit) && /(margin|marge|nim|yield|rate|ratio|taux)/.test(blob)) return "Margin";
    if (/(backlog|carnet de commande|rpo|bookings|orders)/.test(blob)) return "Demand";
    if (/(subscriber|abonn|members|users|utilisateur|customers|clients|dau|mau|dap|doctors|advisors|headcount|effectif)/.test(blob)) return "User";
    if (/(capex|r&d|investissement|investment)/.test(blob)) return "Investment";
    if (/(cost|co[uû]t|expense|charge)/.test(blob)) return "Cost";
    if (/(revenue|revenu|\brev\b|sales|\bca\b|chiffre d'affaires|fees|premium|prime)/.test(blob)) return "Revenue";
    if (/(production|deliveries|livraison|shipment|volume|throughput|tons|tonnes|unites|units|capacity|capacite)/.test(blob)) return "Volume";
    return "Volume";
  };
  if (kpisHaut && Array.isArray(kpisHaut.kpis) && kpisHaut.kpis.length > 0) {
    const converted: AnyKPI[] = kpisHaut.kpis
      .filter((k) => k && k.short && Array.isArray(k.history) && k.history.length > 0)
      .map((k) => {
        // Tri CHRONOLOGIQUE par (année, trimestre) numériques — jamais
        // alphabétique. Le tri string mettait "Q1-FY2022 < Q1-FY2026 <
        // Q2-FY2022", ce qui affichait tous les Q1 puis tous les Q2 →
        // graphs en dents de scie sur tous les tickers (bug Yann 4 juil
        // 2026, vu sur NVDA/AAPL). FYxxxx (annuel) trié après Q4 de la
        // même année.
        const periodKey = (q: string): number => {
          let m = q.match(/^Q([1-4])-(?:FY)?(\d{4})$/i);
          if (m) return Number(m[2]) * 10 + Number(m[1]);
          m = q.match(/^H([12])-(\d{4})$/i);
          // 26 juil 2026 : supporte cadence SEMESTRIELLE (Netflix Engagement
          // Report H1/H2). H1 trié après Q2 (juin), H2 après Q4 (décembre).
          if (m) return Number(m[2]) * 10 + (Number(m[1]) === 1 ? 2 : 4);
          m = q.match(/^FY(\d{4})$/i);
          if (m) return Number(m[1]) * 10 + 5;
          // Yann 29 aout 2026 : les KPI crees a la main portent des annees
          // seules ("2024", regle sans FY) ou des FY courts ("FY24"). Sans ces
          // deux formes, les Unites iPhone vendues et le KPI pays PLTR etaient
          // vides apres fusion, donc invisibles.
          m = q.match(/^(\d{4})$/);
          if (m) return Number(m[1]) * 10 + 5;
          m = q.match(/^FY(\d{2})$/i);
          if (m) return (2000 + Number(m[1])) * 10 + 5;
          return Number.MAX_SAFE_INTEGER; // labels inconnus en fin
        };
        // Un KPI quarterly ne garde QUE les trimestres (les entrées FYxxxx
        // sont des cumuls annuels ~4x plus gros qui créent des pics faux
        // dans le graph trimestriel ; la vue Annuel est recalculée par
        // aggregateQuarterlyToAnnual). Un KPI annual ne garde que les FY.
        // Un KPI semiannual ne garde que H1/H2 (rapports semestriels).
        const isAnnualKpi = k.frequency === "annual";
        const isSemiKpi = k.frequency === "semiannual";
        const hist = (k.history as Array<{ q: string; v: number }>)
          .filter((h) => h && typeof h.v === "number")
          .filter((h) =>
            isAnnualKpi
              ? /^(FY\d{2}|FY\d{4}|\d{4})$/i.test(h.q)
              : isSemiKpi
                ? /^H[12]-\d{4}$/i.test(h.q)
                : /^Q[1-4]-/i.test(h.q),
          )
          .slice()
          .sort((a, b) => periodKey(a.q) - periodKey(b.q));
        const values = hist.map((h) => h.v);
        const periods = hist.map((h) => h.q);
        return {
          short: k.short,
          name_fr: k.name_fr ?? k.short,
          name_en: k.name_en ?? k.short,
          value: k.value,
          unit: k.unit ?? "",
          yoy: k.yoy ?? "",
          type: inferKpiHautType(k),
          nature: "Structurel",
          comparable: "Non comparable",
          signal: k.signal ?? "",
          description: k.signal ?? "",
          history: values,
          history_periods: periods,
          period_type:
            k.frequency === "annual"
              ? "year"
              : k.frequency === "semiannual"
                ? "semester"
                : "quarter",
          is_wow: true,
          is_generic: false,
          pv_score: k.pv_score ?? 0,
          // 12 juil 2026 (fix DLR/KR) : passthrough du last_data_date propre
          // au KPI haut de gamme quand le fichier le fournit. Sans lui,
          // enhanceFreshness backfillait la date max des AUTRES KPIs de la
          // sté → axe trimestriel décalé (KR héritait d'une date bidon →
          // labels jusqu'à "T2 27"). Optionnel : aucun impact si absent.
          ...(typeof k.last_data_date === "string" && k.last_data_date.trim().length > 0
            ? { last_data_date: k.last_data_date }
            : {}),
          // 12 juil 2026 (spec annual-allkpi) : passthrough du flag
          // is_short_history pour marquer proprement les KPI structurellement
          // recents/ponctuels (segment cree recemment, plan capex, reserve
          // FY-only). Sans lui, le loader compte le KPI dans le total et le
          // bouton Annuel reste grise sans indication.
          ...((k as { is_short_history?: boolean }).is_short_history === true
            ? { is_short_history: true }
            : {}),
          // 18 juil 2026 (lint-mix R5) : passthrough des notes de
          // faux-positif / revue posées sur les KPI kpis-haut. Sans elles,
          // le linter R5 re-flaggait des valeurs annuelles légitimes
          // (saisonnalité, cumuls FY) déjà auditées et notées dans le draft.
          ...(typeof k._fp_note === "string" && k._fp_note.trim().length > 0
            ? { _fp_note: k._fp_note }
            : {}),
          // 1er sept 2026 : passthrough du marquage de lot (revue Yann en
          // jaune des KPI ajoutes) et de la definition FR du "i". Le mapping
          // etant une liste blanche, sans ces lignes les deux champs etaient
          // silencieusement perdus a la fusion.
          ...(typeof (k as { _added_batch?: string })._added_batch === "string"
            ? { _added_batch: (k as { _added_batch?: string })._added_batch }
            : {}),
          ...(typeof (k as { explanation_fr?: string }).explanation_fr === "string"
            ? { explanation_fr: (k as { explanation_fr?: string }).explanation_fr }
            : {}),
          ...(typeof (k as { explanation?: string }).explanation === "string"
            ? { explanation: (k as { explanation?: string }).explanation }
            : {}),
          ...(k._needs_review === true ? { _needs_review: true } : {}),
          ...(typeof k._value_note === "string" && k._value_note.trim().length > 0
            ? { _value_note: k._value_note }
            : {}),
          // 18 juil 2026 (vagues R3) : passthrough des notes de trou de série
          // (trimestre non publié par la sté) pour que le linter classe le
          // trou en orange documenté au lieu de rouge.
          ...(typeof k._gap_note === "string" && k._gap_note.trim().length > 0
            ? { _gap_note: k._gap_note }
            : {}),
        } as AnyKPI;
      });
    if (converted.length > 0) {
      // Yann 7 juillet 2026 : le remplacement TOTAL ecrasait aussi les KPI
      // earnings/calls/stories/sectoriels integres dans v2-pipeline apres le
      // 2 juillet (ER, calls 5 ans, stories, sectoriels invisibles sur le
      // site). On garde le remplacement pour les KPI generiques legacy, mais
      // on REINJECTE les KPI tagges _source, dedupliques par short vs
      // kpis-haut.
      const KEPT_SOURCES = new Set([
        "ER+earnings-calls",
        "calls-5y",
        "stories-calls",
        "stories-filings",
        "sectoriel",
        "kpis-haut 10-Q/10-K",
        // 1er sept 2026 : stories a sources tierces du lot META/GOOGL
        // (StatCounter, Nielsen, Swiss Re, eMarketer...). Sans ce tag, le
        // remplacement kpis-haut les eliminait silencieusement.
        "stories-tiers",
      ]);
      const hautShorts = new Set(
        converted.map((k) => String(k.short ?? "").toLowerCase()),
      );
      // Yann 17 juil 2026 (audit 100 stés : 36 doublons visibles dans les
      // Indicateurs clés, ex ABT "Électrophysiologie" présent via le short
      // legacy ELECTROPHYS ET via le kpis-haut "Electrophysiology") : la
      // dédup par short ne suffit pas, les couches nomment différemment le
      // même KPI. On déduplique AUSSI par name_fr/name_en normalisés
      // (accents et non-lettres retirés), kpis-haut prioritaire.
      const normName = (s: unknown) =>
        String(s ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");
      const hautNames = new Set(
        converted.flatMap((k) => [normName(k.name_fr), normName(k.name_en)]).filter(Boolean),
      );
      const keptExtras = ((data.kpis as AnyKPI[]) ?? []).filter((k) => {
        const src = (k as { _source?: unknown })._source;
        if (typeof src !== "string" || !KEPT_SOURCES.has(src)) return false;
        const s = String(k?.short ?? "").toLowerCase();
        if (s.length === 0 || hautShorts.has(s)) return false;
        const nf = normName((k as { name_fr?: unknown }).name_fr);
        const ne = normName((k as { name_en?: unknown }).name_en);
        if ((nf && hautNames.has(nf)) || (ne && hautNames.has(ne))) return false;
        return true;
      });
      data.kpis = [...converted, ...keptExtras];
      // Yann 3 sept 2026 : la couche kpis-haut vient de REMPLACER les KPI de
      // meme identifiant, y compris ceux que la fusion trimestrielle avait
      // enrichis plus haut. On rejoue donc la fusion sur le tableau final,
      // sinon les series verifiees sur les rapports officiels (lot Q4) ne
      // sont jamais affichees. La fusion ne garde que l historique le plus
      // long : rejouer ne peut pas raccourcir une serie.
      const qExtApresHaut = await readJsonOrNull<SerieTrimestrielleExt>(
        path.join(ROOT, "src/data/v2-pipeline-enrich", `${ticker.toLowerCase()}.quarterly-history.json`),
      );
      data.kpis = fusionneSeriesTrimestrielles(data.kpis as AnyKPI[], qExtApresHaut);
      const bestHero = converted.reduce((best, k) =>
        ((k.pv_score as number) ?? 0) > ((best?.pv_score as number) ?? -1) ? k : best,
      converted[0]);
      data.hero_kpi = bestHero.short as string;
    }
    if (ticker.toUpperCase() === "NVDA") {
      console.error("DEBUG2 kpisHaut FINAL injected count=", converted.length, "data.kpis shorts=", (data.kpis as AnyKPI[]).map((k) => k.short));
    }
  } else if (ticker.toUpperCase() === "NVDA") {
    console.error("DEBUG2 kpisHaut FILE NOT FOUND OR EMPTY at path=", kpisHautPath, "kpisHaut=", kpisHaut ? "exists-but-invalid" : "null");
  }

  // ── Reperes annuels sur 10 ans (Yann 3 sept 2026) ────────────────────────
  // Chiffre d affaires, flux de tresorerie libre, dette totale et effectifs,
  // au meme instant : la cloture de l exercice decrite par le 10-K. Les trois
  // premiers viennent du XBRL depose a la SEC, les effectifs sont lus dans le
  // texte du rapport (ils ne sont pas balises). Injectes APRES la couche
  // kpis-haut, sinon ils seraient ecrases comme l etaient les series
  // trimestrielles. Un indicateur annuel deja present sous le meme nom n est
  // pas double.
  const reperesAnnuels = await readJsonOrNull<{ kpis?: AnyKPI[] }>(
    path.join(ROOT, "src/data/kpi-annuel-fiche", `${ticker.toUpperCase()}.json`),
  );
  if (reperesAnnuels && Array.isArray(reperesAnnuels.kpis) && Array.isArray(data.kpis)) {
    const normalise = (v: unknown) =>
      String(v ?? "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const existants = data.kpis as AnyKPI[];
    const shortsPris = new Set(existants.map((k) => String(k.short ?? "").toLowerCase()));
    const nbPoints = (k: AnyKPI) => (Array.isArray(k.history) ? k.history.length : 0);
    const aDesAnnees = (k: AnyKPI) => Array.isArray((k as { history_periods?: unknown }).history_periods);
    // Un indicateur annuel de meme nom peut deja exister, mais sans dates de
    // periode (cas des effectifs Apple) : le graphique fabrique alors des
    // etiquettes a rebours et l interface finit par ne rien afficher. On
    // remplace donc l ancien quand le notre est meilleur, et on garde l ancien
    // sinon. Jamais les deux : ce serait une ligne en double.
    const remplaces = new Set<AnyKPI>();
    const ajouts: AnyKPI[] = [];
    for (const neuf of reperesAnnuels.kpis) {
      const sh = String(neuf.short ?? "").toLowerCase();
      if (!sh || shortsPris.has(sh)) continue;
      const nf = normalise((neuf as { name_fr?: string }).name_fr);
      const ne = normalise((neuf as { name_en?: string }).name_en);
      const jumeau = existants.find((k) => {
        if ((k as { period_type?: string }).period_type !== "year") return false;
        const a = normalise((k as { name_fr?: string }).name_fr);
        const b = normalise((k as { name_en?: string }).name_en);
        return (nf && a === nf) || (ne && b === ne) || (nf && b === nf) || (ne && a === ne);
      });
      if (!jumeau) {
        ajouts.push(neuf);
        continue;
      }
      // Un jumeau porte par un identifiant "generique" (Headcount, Revenue...)
      // est masque du rendu par isGenericKpi : le garder reviendrait a ne rien
      // afficher du tout. Dans ce cas notre serie, datee et sur dix ans, prend
      // sa place. On conserve NOTRE identifiant, sinon le masquage s applique
      // de nouveau.
      const jumeauMasque = isGenericKpi(String(jumeau.short ?? ""));
      const meilleur = jumeauMasque
        || nbPoints(neuf) > nbPoints(jumeau)
        || (nbPoints(neuf) === nbPoints(jumeau) && aDesAnnees(neuf) && !aDesAnnees(jumeau));
      if (meilleur) {
        remplaces.add(jumeau);
        ajouts.push(neuf);
      }
    }
    if (ajouts.length > 0) {
      data.kpis = [...existants.filter((k) => !remplaces.has(k)), ...ajouts];
    }
  }

  // Fresh / stale backfill via existing helper
  const company = enhanceFreshness(data as Company & Record<string, unknown>);

  // Sanity : si risks n'a pas score_rationale (V1.0 le requiert), on
  // laisse RiskStack rendre quand même mais sans le tooltip.
  if (Array.isArray(company.risks)) {
    company.risks = company.risks.map((r: CompanyRisk) => ({ ...r }));
  }

  // Yann 5 juin 2026 : OVERRIDE hero_kpi depuis Supabase
  // `desk_hero_kpi_overrides` (source de vérité posée via `/admin/kpis-toggle`).
  // Remplace l'ancienne écriture fs.writeFile qui était PERDUE à chaque deploy
  // Vercel (filesystem read-only). Cache mémoire 60 s côté serveur.
  // Appliqué TOUT À LA FIN pour gagner sur tous les autres mécanismes (enrich
  // hero_kpi_override, special-kpi promotions, fuzzy match, etc.).
  try {
    const { getHeroKpiOverride } = await import(
      "@/lib/company-core/hero-kpi-overrides"
    );
    const override = await getHeroKpiOverride(canonical);
    if (override && Array.isArray(company.kpis)) {
      const shorts = new Set(
        company.kpis
          .map((k) => (k as { short?: unknown }).short)
          .filter((s): s is string => typeof s === "string" && Boolean(s)),
      );
      if (shorts.has(override)) {
        company.hero_kpi = override;
      }
    }
  } catch (err) {
    // best effort : si Supabase down ou env vars absentes, on garde le hero
    // calculé par les mécanismes précédents (auto-promote heuristique).
    console.warn("[load-company] hero override fetch failed", err);
  }

  // Yann 14 août 2026 : Anti-thèse d'investissement (ATT). Charge
  // src/data/att/<ticker minuscule>.json si présent, avec override Supabase
  // `desk_att` (une ligne desk REMPLACE le JSON local, même pattern que
  // desk_disabled_blocks). Import dynamique + try/catch : si Supabase down
  // ou fichier absent → pas d'ATT, zéro régression. Le GATING plan Max est
  // fait dans les pages serveur via gateAttForTier() AVANT sérialisation.
  try {
    const { loadAttForTicker } = await import("@/lib/att-server");
    const att = await loadAttForTicker(canonical);
    if (att) {
      (company as Company & { att?: unknown }).att = att;
    }
  } catch (err) {
    console.warn("[load-company] att load failed", err);
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

  // Yann 21 août 2026 : dernier passage AVANT sérialisation — supprime les
  // citations SEC techniques ("10-Q", "XBRL", noms de balises) de tous les
  // textes affichés, sur toutes les stés.
  deepCleanCitations(company as unknown as Record<string, unknown>);

  // Yann 30 août 2026 (KO "Effet prix/mix" affiché en double) : dédup finale
  // des KPI dont les séries se recouvrent (mêmes chiffres sous deux libellés,
  // sources pipeline/kpis-haut/enrich avec des shorts différents). Audit du
  // 30 août : 197 paires rendues sur 129 stés. On garde la série qui va le
  // plus loin dans le temps et on lui greffe les champs manquants de l'autre.
  // Yann 30 août 2026 : 35 789 KPI rendus sur 35 949 n'avaient AUCUNE
  // définition (tooltip "i" vide, screen KO). Repli serveur : définition
  // pédagogique générique déduite du nom quand explanation est vide. Les KPI
  // spécifiques restants sont complétés par le batch de rédaction nocturne.
  if (Array.isArray(company.kpis)) {
    for (const k of company.kpis as AnyKPI[]) {
      const ex = (k as { explanation?: string }).explanation;
      if (ex == null || (typeof ex === "string" && !ex.trim())) {
        const def = definitionGeneriqueKpi((k as { name_fr?: string }).name_fr || (k as { name_en?: string }).name_en);
        if (def) (k as { explanation?: string }).explanation = def;
      }
    }
  }
  if (Array.isArray(company.kpis)) {
    company.kpis = dedupKpisSeriesRecouvrantes(company.kpis as AnyKPI[], ticker) as Company["kpis"];
  }

  return { kind: "ready", company };
}

// ---------------------------------------------------------------------------
// Dédup par recouvrement de séries (Yann 30 août 2026).
// Deux KPI d'une même sté qui partagent une sous-série contiguë d'au moins
// 10 points identiques sont le même indicateur sous deux libellés. Le loader
// fusionne par short, mais les shorts diffèrent souvent entre sources
// ("Price/mix" pipeline vs "price_mix_impact" kpis-haut).
// ---------------------------------------------------------------------------
function histAsNumbers(h: unknown): number[] {
  if (!Array.isArray(h)) return [];
  const out: number[] = [];
  for (let p of h as unknown[]) {
    if (p && typeof p === "object" && "v" in (p as object)) p = (p as { v: unknown }).v;
    if (typeof p === "number" && Number.isFinite(p)) out.push(Math.round(p * 10000) / 10000);
  }
  return out;
}

/** Deux points "identiques" à l'arrondi d'affichage près (14 810 vs 14 800). */
function pointsEgaux(x: number, y: number): boolean {
  if (x === y) return true;
  const m = Math.max(Math.abs(x), Math.abs(y));
  if (m === 0) return true;
  return Math.abs(x - y) <= 0.015 * m;
}

/**
 * Facteur d'échelle plausible entre deux séries (unités K/M/Mds écrites
 * différemment, ou série réécrite en nombres bruts par un override) :
 * seuls 1, 1000 et 1/1000 sont acceptés, tout autre ratio = séries
 * réellement différentes. NVDA "NETWORKING" ($M, 14 800) vs sa copie en
 * Mds (14,8) ne se voyait pas avec une égalité stricte.
 */
function facteurEchelle(a: number[], b: number[]): number | null {
  const med = (xs: number[]) => {
    const s = xs.map(Math.abs).filter((x) => x > 0).sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const ma = med(a);
  const mb = med(b);
  if (!ma || !mb) return 1;
  const r = mb / ma;
  for (const f of [1, 1000, 0.001]) {
    if (r >= f * 0.95 && r <= f * 1.05) return f;
  }
  return null;
}

/** Plus longue sous-série CONTIGUË commune + points restants après elle. */
function lcsContigInfo(a: number[], b: number[]): { len: number; restA: number; restB: number } {
  let best = 0;
  let endA = 0;
  let endB = 0;
  const dp = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = pointsEgaux(a[i - 1], b[j - 1]) ? prevDiag + 1 : 0;
      if (dp[j] > best) {
        best = dp[j];
        endA = i;
        endB = j;
      }
      prevDiag = tmp;
    }
  }
  return { len: best, restA: a.length - endA, restB: b.length - endB };
}

function dedupKpisSeriesRecouvrantes(kpis: AnyKPI[], ticker?: string): AnyKPI[] {
  // Paires revues a la main (fusion d office, sous le seuil automatique)
  const forcees = new Set(
    (doublonsForcesJson as unknown as { paires: { ticker: string; shorts: string[] }[] }).paires
      .filter((p) => p.ticker === String(ticker ?? "").toUpperCase())
      .map((p) => [...p.shorts].sort().join("\u0000")),
  );
  const infos = kpis.map((k) => {
    const h = histAsNumbers(k?.history);
    return { k, h, distinct: new Set(h).size };
  });
  const drop = new Set<number>();
  // "M USD" / "M $" / "$M", "Md" / "Mds", "000" / "K", "tons" / "tonnes",
  // "vehicles" / "véhicules", "$/action" / "$" : même unité écrite autrement.
  // Sans cette normalisation, les vrais doublons (BMY Eliquis, UBER Gross
  // Bookings, TSLA deliveries, CRM cRPO...) passaient sous le seuil renforcé.
  const normUnit = (u: unknown) =>
    String(u ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\/(trimestre|an|mois|action|share)\b/g, "")
      .replace(/usd/g, "$")
      .replace(/eur/g, "€")
      .replace(/\bmds\b|\bmilliards?\b/g, "md")
      .replace(/\bmillions?\b/g, "m")
      .replace(/\b000\b/g, "k")
      .replace(/\btonnes?\b|\btons?\b/g, "t")
      .replace(/\bvehicles\b/g, "vehicules")
      .replace(/\s+/g, "");
  const sortChars = (s: string) => s.split("").sort().join("");
  const memeUnite = (a: unknown, b: unknown) => {
    const na = normUnit(a);
    const nb = normUnit(b);
    if (na === nb) return true;
    // "$m" vs "m$" ; "m" vs "mjours" (préfixe de magnitude commun)
    if (na && nb && (na.startsWith(nb) || nb.startsWith(na))) return true;
    return sortChars(na) === sortChars(nb);
  };
  for (let i = 0; i < infos.length; i++) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < infos.length; j++) {
      if (drop.has(j)) continue;
      const A = infos[i];
      const B = infos[j];
      const paireForcee = forcees.has(
        [String(A.k.short ?? ""), String(B.k.short ?? "")].sort().join("\u0000"),
      );
      // Les paires revues a la main court-circuitent les gardes automatiques
      // (series parfois trop courtes pour le seuil, ex CFG CET1 a 5 points).
      if (!paireForcee) {
        if (A.h.length < 6 || B.h.length < 6) continue;
        // séries plates/binaires : coïncidences trop probables, on ne touche pas
        if (A.distinct < 3 || B.distinct < 3) continue;
      }
      // séries en magnitudes différentes ("$M" 14 800 vs "Mds $" 14,8) :
      // on essaie les trois échelles K/M/Mds et on garde le meilleur
      // recouvrement. (Un pré-filtre par médianes globales ratait les paires
      // dont la série courte est plus récente — BKNG room_nights, médianes
      // décalées par la croissance.)
      let len = 0;
      let restA = 0;
      let restB = 0;
      let fact = 1;
      for (const f of [1, 1000, 0.001]) {
        const bScaled = f === 1 ? B.h : B.h.map((x) => x / f);
        const r = lcsContigInfo(A.h, bScaled);
        if (r.len > len) {
          len = r.len;
          restA = r.restA;
          restB = r.restB;
          fact = f;
        }
        if (f === 1 && r.len >= 12) break;
      }
      const sameUnit = memeUnite(A.k.unit, B.k.unit) || fact !== 1;
      // Fusion si : chevauchement long (10 pts mêmes unités variées, 12 sinon)
      // OU inclusion totale (une série entièrement contenue dans l'autre,
      // >=6 pts, >=4 valeurs distinctes — cas NVDA Networking 9/9 pts).
      const seuilChevauchement = sameUnit && A.distinct >= 5 && B.distinct >= 5 ? 10 : 12;
      const inclusionTotale =
        len >= 6 &&
        len === Math.min(A.h.length, B.h.length) &&
        Math.min(A.distinct, B.distinct) >= 4 &&
        sameUnit;
      if (len < seuilChevauchement && !inclusionTotale && !paireForcee) continue;
      // gagnant = série qui continue APRÈS la fenêtre commune (plus récente) ;
      // égalité → labels de périodes, puis last_data_date, puis plus longue.
      const hasLabels = (k: AnyKPI) => Array.isArray(k.history) && (k.history as unknown[]).some((p) => p && typeof p === "object");
      let winnerIdx: number;
      if (restA !== restB) winnerIdx = restA > restB ? i : j;
      else if (hasLabels(A.k) !== hasLabels(B.k)) winnerIdx = hasLabels(A.k) ? i : j;
      else {
        const da = typeof A.k.last_data_date === "string" ? A.k.last_data_date : "";
        const db = typeof B.k.last_data_date === "string" ? B.k.last_data_date : "";
        if (da !== db) winnerIdx = da > db ? i : j;
        else winnerIdx = A.h.length >= B.h.length ? i : j;
      }
      const loserIdx = winnerIdx === i ? j : i;
      const w = infos[winnerIdx].k as Record<string, unknown>;
      const l = infos[loserIdx].k as Record<string, unknown>;
      // greffe les champs texte absents du gagnant (jamais les valeurs/séries)
      for (const f of ["signal", "description", "explanation", "name_en", "type", "story_category", "quality", "nature", "comparable"]) {
        const cur = w[f];
        const other = l[f];
        const vide = cur == null || (typeof cur === "string" && !cur.trim());
        if (vide && other != null) w[f] = other;
      }
      drop.add(loserIdx);
    }
  }
  if (drop.size === 0) return kpis;
  return kpis.filter((_, idx) => !drop.has(idx));
}
