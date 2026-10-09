import type { MetadataRoute } from "next";
import { promises as fs } from "fs";
import path from "path";
import { estAlias } from "@/lib/ticker-aliases";
import RETIREES from "@/data/societes-retirees.json";
import { estUniversN1, tickersUniversActif } from "@/lib/univers-actif";

/**
 * 8 oct 2026 (Yann) : sitemap TRES RESTRICTIF. Liste blanche explicite :
 * accueil, tarifs, pages legales, fiches societe publiques. Jamais de route
 * interne (sandbox, desk, admin, concepts, api, labs, preversion, test) :
 * le filtre PREFIXES_INTERDITS ci-dessous rejette toute URL qui y ressemble,
 * meme si une entree est ajoutee par erreur plus tard.
 */
const PREFIXES_INTERDITS = [
  "/sandbox", "/desk", "/admin", "/concepts", "/api", "/chart-lab", "/email-lab",
  "/whoami", "/auth", "/account", "/login", "/signup", "/maintenance",
  "/favorites", "/mes-societes", "/preversion", "/test", "/v1-9-5",
];
const estAutorisee = (p: string): boolean =>
  p.startsWith("/") && !p.startsWith("/_") && !p.startsWith("/k/") &&
  !PREFIXES_INTERDITS.some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x + "-"));

/**
 * Sitemap auto-généré pour le SEO.
 *
 * Yann 2 sept 2026 (audit SEO) :
 *  - le site est servi en français uniquement (Phase 1 FR-only, `/fr/<route>`
 *    redirige en 308 vers `/<route>`). L'ancien sitemap déclarait chaque page
 *    en double avec des URL /fr/... : des centaines d'URL en redirection et
 *    des hreflang incohérents. Une seule URL canonique par page désormais.
 *  - il ne listait que les 5 sociétés du dataset V1 (TICKERS legacy) : les
 *    661 autres fiches en ligne étaient invisibles pour Google. Les pages
 *    société viennent maintenant de la liste V1.9.5 clean-all (666 sociétés),
 *    la même qui décide de la visibilité publique.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const now = new Date();

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    // /faq retiree du site public (Yann 24 sept 2026)
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    // populaire-investisseurs archivee (Yann 07 sept 2026)
    { path: "/legal/mentions", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/conditions", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/confidentialite", priority: 0.2, changeFrequency: "yearly" },
  ];

  let tickers: string[] = [];
  // 9 oct 2026 : le niveau 1 (UNIVERS=sp5001000) ne declare que ses propres fiches.
  if (estUniversN1()) tickers = tickersUniversActif();
  else try {
    const raw = await fs.readFile(path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"), "utf-8");
    const parsed = JSON.parse(raw) as { tickers?: string[] } | string[];
    tickers = Array.isArray(parsed) ? parsed : parsed.tickers ?? [];
  } catch {
    tickers = [];
  }

  const retirees = new Set(Object.keys((RETIREES as { tickers: Record<string, string> }).tickers));
  const tickerRoutes = tickers
    .filter((t) => typeof t === "string" && /^[A-Za-z0-9][A-Za-z0-9.\-]*$/.test(t))
    .filter((t) => !estAlias(t.toUpperCase()) && !retirees.has(t.toUpperCase()))
    .map((t) => ({
      path: `/${t.toLowerCase()}`,
      priority: 0.9,
      changeFrequency: "daily" as const,
    }));

  const vues = new Set<string>();
  return [...staticRoutes, ...tickerRoutes].filter((r) => estAutorisee(r.path) && !vues.has(r.path) && !!vues.add(r.path)).map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
