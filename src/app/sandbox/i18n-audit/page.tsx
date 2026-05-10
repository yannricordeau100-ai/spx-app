import { promises as fs } from "fs";
import path from "path";
import { I18nAuditClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit i18n · Mettrik",
};

/**
 * Audit i18n : pour chaque langue supportée, montre la couverture de
 * traduction par groupe de clés (page).
 *
 * Server component : lit dictionary.ts et dictionary-extra-locales.ts au
 * build, parse les entrées avec un parser robuste (gère les accolades
 * imbriquées dans les strings, ex `{n}`), et passe les stats au client
 * qui rend un menu déroulant + tableau.
 */

type Entry = { key: string; body: string };

function parseEntries(text: string): Entry[] {
  const out: Entry[] = [];
  let pos = 0;
  // Match `"key": {` au début d'une entrée
  const re = /"([a-zA-Z0-9._\-]+)":\s*\{/g;
  while (true) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) break;
    const key = m[1];
    const start = m.index + m[0].length; // juste après {
    let depth = 1;
    let i = start;
    let inStr = false;
    let esc = false;
    let quote = "";
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === quote) inStr = false;
      } else {
        if (c === '"' || c === "'") {
          inStr = true;
          quote = c;
        } else if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
      }
      i += 1;
    }
    out.push({ key, body: text.slice(start, i - 1) });
    pos = i;
  }
  return out;
}

const LOCALES = ["fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH"] as const;

const GROUPS: Array<{ id: string; label: string; prefixes: string[] }> = [
  { id: "home", label: "Home", prefixes: ["home.", "brand."] },
  { id: "company", label: "Page société", prefixes: ["company.", "kpi.", "stories.", "hero.", "anomaly.", "freshness.", "transcript.", "timefrac.", "senate."] },
  { id: "account", label: "Mon compte", prefixes: ["account.", "auth.", "billing.", "compte."] },
  { id: "contact", label: "Contact", prefixes: ["contact.", "legal.contact"] },
  { id: "faq", label: "FAQ", prefixes: ["faq."] },
  { id: "pricing", label: "Pricing", prefixes: ["pricing."] },
  { id: "nav", label: "Navigation", prefixes: ["nav."] },
  { id: "legal", label: "Légal (CGU/CGV/Confidentialité)", prefixes: ["legal."] },
  { id: "footer", label: "Footer", prefixes: ["footer."] },
];

function getGroup(key: string): string {
  for (const g of GROUPS) {
    if (g.prefixes.some((p) => key.startsWith(p))) return g.id;
  }
  return "other";
}

export type LangStat = {
  locale: string;
  total: number;
  groups: Array<{ id: string; label: string; total: number; covered: number; missingKeys: string[] }>;
};

export default async function I18nAuditPage() {
  const ROOT = process.cwd();
  const mainPath = path.join(ROOT, "src/lib/i18n/dictionary.ts");
  const extraPath = path.join(ROOT, "src/lib/i18n/dictionary-extra-locales.ts");
  const main = await fs.readFile(mainPath, "utf-8");
  const extra = await fs.readFile(extraPath, "utf-8");

  const mainEntries = parseEntries(main);
  const extraEntries = parseEntries(extra);

  // Toutes les clés ayant au moins fr ou en dans le dictionnaire principal
  const mainKeys = mainEntries
    .filter((e) => /\bfr\s*:/.test(e.body) || /\ben\s*:/.test(e.body))
    .map((e) => e.key);

  // Lookup extra : agrège plusieurs définitions si la même clé apparaît
  const extraLookup = new Map<string, string>();
  for (const e of extraEntries) {
    extraLookup.set(e.key, (extraLookup.get(e.key) ?? "") + " " + e.body);
  }

  function hasLocale(key: string, locale: string): boolean {
    if (locale === "fr" || locale === "en") return true;
    if (locale === "en-GB") return true; // fallback automatique sur en
    if (locale === "de-CH") {
      const body = extraLookup.get(key) ?? "";
      return /\bde\s*:\s*"/.test(body);
    }
    const body = extraLookup.get(key) ?? "";
    const re = new RegExp("\\b" + locale + "\\s*:\\s*\"");
    return re.test(body);
  }

  // Group all keys
  const groupMap = new Map<string, string[]>();
  for (const k of mainKeys) {
    const g = getGroup(k);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(k);
  }

  const stats: LangStat[] = LOCALES.map((loc) => {
    const groups = GROUPS.map((g) => {
      const keys = groupMap.get(g.id) ?? [];
      const missing = keys.filter((k) => !hasLocale(k, loc));
      return {
        id: g.id,
        label: g.label,
        total: keys.length,
        covered: keys.length - missing.length,
        missingKeys: missing,
      };
    }).filter((g) => g.total > 0);
    return {
      locale: loc,
      total: mainKeys.length,
      groups,
    };
  });

  return <I18nAuditClient stats={stats} />;
}
