import type { MetadataRoute } from "next";
import { promises as fs } from "fs";
import path from "path";

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
 *    société viennent maintenant de la liste V1.9.5 clean-all (666 stés),
 *    la même qui décide de la visibilité publique.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const now = new Date();

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/faq", priority: 0.8, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
    { path: "/parrainage", priority: 0.4, changeFrequency: "monthly" },
    { path: "/legal/mentions", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/conditions", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/confidentialite", priority: 0.2, changeFrequency: "yearly" },
  ];

  let tickers: string[] = [];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"), "utf-8");
    const parsed = JSON.parse(raw) as { tickers?: string[] } | string[];
    tickers = Array.isArray(parsed) ? parsed : parsed.tickers ?? [];
  } catch {
    tickers = [];
  }

  const tickerRoutes = tickers
    .filter((t) => typeof t === "string" && t.length > 0 && !t.startsWith("_"))
    .map((t) => ({
      path: `/${t.toLowerCase()}`,
      priority: 0.9,
      changeFrequency: "daily" as const,
    }));

  return [...staticRoutes, ...tickerRoutes].map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
