/**
 * Recherche de societes cote SERVEUR (8 oct 2026, audit des fuites publiques,
 * lignes 6, 8, 9 et 10).
 *
 * Avant : company-search.tsx (composant client charge sur toutes les pages)
 * embarquait l univers complet (liste en ligne, classement capi, univers V1.9,
 * index des heros de 1 994 tickers dont les societes masquees, notes internes)
 * et telechargeait /api/online-tickers. N importe qui pouvait compter les
 * societes exactement.
 *
 * Maintenant : le navigateur envoie la saisie a /api/recherche-societes et ne
 * recoit que les 10 premiers resultats, deja mis en forme. Aucune liste
 * complete, aucun compte, aucun champ interne ne quitte le serveur.
 *
 * REGLE PERMANENTE : ce module ne doit JAMAIS etre importe par un composant
 * client ("use client"). Le controle scripts/verif-fuites-publiques.mjs
 * (bloc --static de verif-release.py) passe au rouge si une liste de plus de
 * 300 tickers reapparait dans le JS servi.
 */
import capiSortedJson from "@/data/v1-8-tickers-sorted.json";
import marketCapOrderJson from "@/data/market-cap-order.json";
import v19UniverseJson from "@/data/v1-9-universe.json";
import v195CleanAllJson from "@/data/v1-9-5-clean-all-tickers.json";
import heroKpiIndexJson from "@/data/v2-pipeline/_hero-kpi-index.json";
import { COMPANIES, TICKERS, TICKER_ALIASES, getHero } from "@/lib/data";
import {
  V17_SEARCH_INDEX,
  V17_SEARCH_BY_TICKER,
  V19_SEARCH_INDEX,
  V19_SEARCH_BY_TICKER,
} from "@/lib/company-core/tickers-search-index";
import { displayTicker } from "@/lib/ticker-display";
import { TICKER_DEDUP_ALIASES } from "@/lib/ticker-dedup-aliases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { estUniversN1, societesN1 } from "@/lib/univers-actif";

export const RESULTATS_MAX = 10;

export type HeroRecherche = {
  court: string;
  libelle: string | null;
  valeur: string | number | null;
  unite: string;
  yoy: string;
  type: string | null;
};

export type ResultatRecherche = {
  ticker: string;
  affiche: string;
  nom: string;
  secteur: string;
  sousSecteur: string;
  pays: string;
  source: "v1" | "v17" | "v19";
  hero: HeroRecherche | null;
};

type HeroKpiEntry = { s: string; v: string | number | null; u: string; y: string | number; t: string };
const HERO_KPI_INDEX = heroKpiIndexJson as unknown as Record<string, HeroKpiEntry>;

function pliAccents(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").toLowerCase();
}

const CAPI_RANK: Record<string, number> = Object.fromEntries(
  (marketCapOrderJson as { tickers: string[] }).tickers.map((t, i) => [t.toUpperCase(), i]),
);
const CAPI_RANK_SIZE = Object.keys(CAPI_RANK).length;
const CAPI_RANK_ANCIEN: Record<string, number> = Object.fromEntries(
  (capiSortedJson as string[]).map((t, i) => [t.toUpperCase(), i]),
);
const rangCapi = (ticker: string): number => {
  const up = ticker.toUpperCase();
  const c = CAPI_RANK[up];
  if (c !== undefined) return c;
  const a = CAPI_RANK_ANCIEN[up];
  return a !== undefined ? CAPI_RANK_SIZE + a : 99999;
};

/** Univers en ligne (clean_all) + canoniques des alias. */
const CLEAN_ALL_SET: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const raw of (v195CleanAllJson as { tickers: string[] }).tickers) {
    const upper = raw.toUpperCase();
    set.add(upper);
    const canonical = TICKER_ALIASES[raw] ?? TICKER_ALIASES[upper];
    if (canonical) set.add(canonical.toUpperCase());
  }
  return set;
})();

/** Perimetre de recherche de l accueil : clean_all dedoublonne (ex-prop searchableTickers). */
const PERIMETRE: ReadonlySet<string> = (() => {
  const vus = new Set<string>();
  const out = new Set<string>();
  for (const t of (v195CleanAllJson as { tickers: string[] }).tickers) {
    const up = t.toUpperCase();
    const canonical = TICKER_DEDUP_ALIASES[up] ?? up;
    if (vus.has(canonical)) continue;
    vus.add(canonical);
    out.add(up);
  }
  return out;
})();

const V19_UNIVERSE_SET: ReadonlySet<string> = new Set(
  (v19UniverseJson as { ticker: string }[]).map((x) => x.ticker.toUpperCase()),
);
const ALIAS_KEYS_UPPER: ReadonlySet<string> = new Set(Object.keys(TICKER_ALIASES).map((k) => k.toUpperCase()));
const REVERSE_ALIASES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [alias, target] of Object.entries(TICKER_ALIASES)) {
    const u = target.toUpperCase();
    (map[u] ??= []).push(alias);
  }
  return map;
})();
const TOUS_TICKERS: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const t of TICKERS) s.add(t.toUpperCase());
  for (const e of V17_SEARCH_INDEX) s.add(e.ticker.toUpperCase());
  for (const e of V19_SEARCH_INDEX) s.add(e.ticker.toUpperCase());
  return s;
})();

/** Societes publiees (desk_curated_companies, min_plan != hidden). Cache 60 s. */
let CACHE_EN_LIGNE: { at: number; set: Set<string> | null } | null = null;
async function societesEnLigne(): Promise<Set<string> | null> {
  if (CACHE_EN_LIGNE && Date.now() - CACHE_EN_LIGNE.at < 60_000) return CACHE_EN_LIGNE.set;
  let set: Set<string> | null = null;
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("desk_curated_companies")
      .select("ticker, min_plan");
    if (!error && data) {
      set = new Set(
        (data as { ticker: string; min_plan: string | null }[])
          .filter((r) => r.min_plan && r.min_plan !== "hidden")
          .map((r) => String(r.ticker).toUpperCase()),
      );
    }
  } catch {
    set = null; // base injoignable : comportement historique (tout clean_all)
  }
  CACHE_EN_LIGNE = { at: Date.now(), set };
  return set;
}

function heroIndex(ticker: string): HeroRecherche | null {
  return heroDepuisEntree(HERO_KPI_INDEX[ticker.toUpperCase()]);
}

function heroDepuisEntree(e: HeroKpiEntry | null | undefined): HeroRecherche | null {
  if (!e || e.v == null || e.v === "" || !e.s) return null;
  let yoy = "";
  if (typeof e.y === "number" && Number.isFinite(e.y)) yoy = `${e.y > 0 ? "+" : ""}${e.y}%`;
  else if (typeof e.y === "string") yoy = e.y.trim();
  return { court: e.s, libelle: null, valeur: e.v, unite: e.u ?? "", yoy, type: e.t ?? null };
}

export async function rechercheSocietes(saisie: string, max = RESULTATS_MAX): Promise<ResultatRecherche[]> {
  const q = pliAccents(saisie.trim()).slice(0, 60);
  const limite = Math.max(1, Math.min(RESULTATS_MAX, max));
  const strictMode = q.length > 0 && q.length < 3;
  const score = (ticker: string, name: string, sector: string, subsector: string, aliases: string[]): number => {
    if (!q) return 1;
    const tk = pliAccents(ticker);
    const nm = pliAccents(name);
    const sc = pliAccents(sector);
    const ss = pliAccents(subsector);
    if (tk === q) return 1000;
    if (tk.startsWith(q)) return 800;
    for (const a of aliases) {
      const al = pliAccents(a);
      if (al === q) return 600;
      if (al.startsWith(q)) return 500;
    }
    if (nm.startsWith(q)) return 400;
    if (nm.split(/\s+/).some((w) => w.startsWith(q))) return 300;
    if (sc.startsWith(q) || ss.startsWith(q)) return 200;
    if (!strictMode) {
      if (nm.includes(q)) return 100;
      if (sc.includes(q) || ss.includes(q)) return 50;
    }
    return 0;
  };

  // 9 oct 2026 (Russell 1000, vague sp5001000) : sur le niveau 1
  // (UNIVERS=sp5001000), la recherche ne connait QUE les fiches pretes de la
  // vague (src/data/univers-sp5001000.json), sans aucune societe de l univers
  // principal ni ligne desk_curated_companies (base partagee avec mettrik.ai).
  if (estUniversN1()) {
    const n1 = societesN1();
    const tousN1 = new Set(n1.map((x) => x.ticker.toUpperCase()));
    return n1
      .map((x) => ({ x, sc: score(x.ticker, x.nom, x.secteur, x.sous_secteur ?? "", []) }))
      .filter((r) => r.sc > 0)
      .sort((a, b) => b.sc - a.sc || (b.x.capi_usd ?? 0) - (a.x.capi_usd ?? 0) || a.x.ticker.localeCompare(b.x.ticker))
      .slice(0, limite)
      .map(({ x }) => ({
        ticker: x.ticker, affiche: displayTicker(x.ticker, tousN1), nom: x.nom, secteur: x.secteur || "-",
        sousSecteur: x.sous_secteur ?? "", pays: "", source: "v17" as const, hero: heroDepuisEntree(x.hero ?? null),
      }));
  }

  const sortie: { ticker: string; source: "v1" | "v17" | "v19"; score: number }[] = [];
  const v1Set = new Set(TICKERS.map((t) => t.toUpperCase()));
  for (const t of TICKERS) {
    const aliases = Object.entries(TICKER_ALIASES).filter(([, target]) => target === t).map(([a]) => a);
    const c = COMPANIES[t];
    const s = score(t, c.name, c.sector, c.subsector, aliases);
    if (s > 0) sortie.push({ ticker: t, source: "v1", score: s });
  }
  for (const e of V17_SEARCH_INDEX) {
    const up = e.ticker.toUpperCase();
    if (v1Set.has(up) || ALIAS_KEYS_UPPER.has(up) || !PERIMETRE.has(up) || !CLEAN_ALL_SET.has(up)) continue;
    if (!e.validated && !V19_UNIVERSE_SET.has(up)) continue;
    const s = score(e.ticker, e.name, e.sector, "", REVERSE_ALIASES[up] ?? []);
    if (s > 0) sortie.push({ ticker: e.ticker, source: "v17", score: s });
  }
  for (const e of V19_SEARCH_INDEX) {
    const up = e.ticker.toUpperCase();
    if (v1Set.has(up) || ALIAS_KEYS_UPPER.has(up) || !CLEAN_ALL_SET.has(up)) continue;
    const s = score(e.ticker, e.name, e.country ?? "", "", REVERSE_ALIASES[up] ?? []);
    if (s > 0) sortie.push({ ticker: e.ticker, source: "v19", score: s });
  }
  const ordreSource: Record<string, number> = { v1: 0, v17: 1, v19: 2 };
  sortie.sort((a, b) => b.score - a.score || rangCapi(a.ticker) - rangCapi(b.ticker) || ordreSource[a.source] - ordreSource[b.source]);

  // Dedoublonnage final par ticker (regle figee du 5 juin 2026) puis filtre en ligne.
  const enLigne = await societesEnLigne();
  const vus = new Set<string>();
  const res: ResultatRecherche[] = [];
  for (const r of sortie) {
    const up = r.ticker.toUpperCase();
    if (vus.has(up)) continue;
    vus.add(up);
    if (enLigne && !enLigne.has(up)) continue;
    const affiche = displayTicker(r.ticker, TOUS_TICKERS);
    if (r.source === "v1") {
      const c = COMPANIES[r.ticker];
      const h = getHero(c);
      res.push({
        ticker: r.ticker, affiche, nom: c.name, secteur: c.sector, sousSecteur: c.subsector, pays: "", source: "v1",
        hero: {
          court: h.short,
          libelle: `${h.name_fr}${h.name_en && h.name_en !== h.name_fr ? ` (${h.name_en})` : ""}`,
          valeur: h.value as string | number | null, unite: h.unit ?? "", yoy: String(h.yoy ?? ""), type: (h.type as string) ?? null,
        },
      });
    } else if (r.source === "v17") {
      const e = V17_SEARCH_BY_TICKER[up];
      if (!e) continue;
      res.push({ ticker: r.ticker, affiche, nom: e.name, secteur: e.sector || "-", sousSecteur: "", pays: "", source: "v17", hero: heroIndex(r.ticker) });
    } else {
      const e = V19_SEARCH_BY_TICKER[up];
      if (!e) continue;
      res.push({ ticker: r.ticker, affiche, nom: e.name, secteur: "", sousSecteur: "", pays: e.country ?? "", source: "v19", hero: heroIndex(r.ticker) });
    }
    if (res.length >= limite) break;
  }
  return res;
}
