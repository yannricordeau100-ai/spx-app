/**
 * Gibberify — remplace texte/chiffres réels par du contenu aléatoire de
 * MÊME LONGUEUR. Utilisé côté SERVEUR avant d'envoyer des données à un
 * client non-payant.
 *
 * Modèle de sécurité :
 *   1. Le serveur connaît la vraie donnée
 *   2. Le serveur appelle `lockCompany(c)` qui retourne une copie où tous
 *      les champs sensibles sont gibberifiés
 *   3. Le serveur envoie la copie gibberifiée au client
 *   4. Le client applique un flou cosmétique (CSS filter blur)
 *   5. Même si l'utilisateur retire le flou (DevTools, copy-paste, IA,
 *      export, screenshot), il ne voit que du gibberish
 *
 * La vraie donnée ne quitte JAMAIS le serveur tant que l'utilisateur n'a
 * pas payé.
 */

import type { Company, KPI, CompanyRisk } from "@/lib/data";

/* ---------- RNG seedable (pour gibberish stable, pas qui flicker) ---------- */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const VOWELS = "aeiou";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";

/**
 * Gibberish text — préserve longueur, espaces, casse, ponctuation.
 * Génère des "mots" qui alternent consonnes/voyelles pour rester crédible.
 */
export function gibberishText(original: string, seed = "default"): string {
  if (!original) return original;
  const r = rng(seed + ":" + original.length);
  let result = "";
  let inWord = false;
  let wordPosition = 0;
  for (const c of original) {
    if (/\s/.test(c)) {
      result += c;
      inWord = false;
      wordPosition = 0;
      continue;
    }
    if (!/[a-zA-Z]/.test(c)) {
      // ponctuation : on garde
      result += c;
      continue;
    }
    inWord = true;
    // alternance consonne/voyelle pour des "mots" prononçables
    const pool = wordPosition % 2 === 0 ? CONSONANTS : VOWELS;
    let chr = pool[Math.floor(r() * pool.length)];
    if (/[A-Z]/.test(c)) chr = chr.toUpperCase();
    result += chr;
    wordPosition++;
  }
  return result;
}

/**
 * Gibberish nombre — préserve nombre de chiffres, signe, séparateur décimal,
 * symboles (%, $, etc.). Retourne une string puisque les valeurs peuvent
 * dépasser MAX_SAFE_INTEGER ou avoir un format spécifique.
 */
export function gibberishNumber(
  original: number | string,
  seed = "default"
): string {
  const s = typeof original === "number" ? String(original) : original;
  if (!s) return s;
  const r = rng(seed + ":num:" + s.length);
  let result = "";
  for (const c of s) {
    if (/[0-9]/.test(c)) {
      result += String(Math.floor(r() * 10));
    } else {
      // signe, point, virgule, %, $, espace : on garde
      result += c;
    }
  }
  return result;
}

/* ---------- High-level : gibberify une société entière ---------- */

function lockKPI(k: KPI, seed: string): KPI {
  const ks = seed + ":kpi:" + k.short;
  return {
    ...k,
    // KPI.short est l'ID interne, on le gibberifie pour cohérence
    short: gibberishText(k.short, ks + ":short"),
    name_fr: gibberishText(k.name_fr, ks + ":nameFr"),
    name_en: k.name_en ? gibberishText(k.name_en, ks + ":nameEn") : k.name_en,
    explanation: gibberishText(k.explanation, ks + ":explain"),
    // KPI.value est typé string par data.ts, on gibberifie comme tel.
    value: gibberishNumber(k.value, ks + ":val"),
    yoy: gibberishNumber(k.yoy, ks + ":yoy"),
    signal: gibberishText(k.signal, ks + ":signal"),
    description: gibberishText(k.description, ks + ":desc"),
    history: k.history.map((v, i) =>
      Number(gibberishNumber(v, ks + ":hist:" + i))
    ),
  };
}

function lockRisk(r: CompanyRisk, seed: string): CompanyRisk {
  const rs = seed + ":risk:" + r.title;
  return {
    ...r,
    title: gibberishText(r.title, rs + ":title"),
    // CompanyRisk a `quote` (citation 10-K), pas `description`.
    quote: gibberishText(r.quote ?? "", rs + ":quote"),
    score_rationale: r.score_rationale
      ? gibberishText(r.score_rationale, rs + ":rationale")
      : r.score_rationale,
  };
}

/**
 * lockCompany — retourne une copie de la société où TOUS les champs
 * sensibles sont gibberifiés. Logo / ticker / sector / subsector restent
 * pour que la société soit reconnaissable visuellement (le but est de
 * créer l'envie d'upgrader, pas de cacher l'existence de la société).
 */
export function lockCompany(c: Company): Company {
  const seed = "lock:" + c.ticker;
  return {
    ...c,
    // ticker, name, sector, subsector, founded, ipo, ranks : on garde
    // (sinon on ne sait même plus quelle société on regarde)
    tagline: gibberishText(c.tagline, seed + ":tagline"),
    kpis: c.kpis.map((k) => lockKPI(k, seed)),
    risks: c.risks?.map((r) => lockRisk(r, seed)),
    market_positions: c.market_positions?.map((mp) => ({
      ...mp,
      segment_name: gibberishText(mp.segment_name ?? "", seed + ":mp:" + (mp.segment_name ?? "")),
    })),
    ai_positioning: c.ai_positioning
      ? {
          ...c.ai_positioning,
          evidence: c.ai_positioning.evidence?.map((e, i) =>
            gibberishText(e, seed + ":ai:" + i)
          ),
        }
      : c.ai_positioning,
  };
}
