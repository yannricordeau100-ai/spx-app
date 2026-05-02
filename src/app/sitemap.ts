import type { MetadataRoute } from "next";
import { TICKERS } from "@/lib/data";

/**
 * Sitemap auto-généré pour le SEO.
 * Listé : home + pages société pour chaque ticker + pages légales,
 * EN VERSION ANGLAISE (URL sans préfixe) ET FRANÇAISE (URL /fr/...).
 *
 * `alternates` indique aux moteurs de recherche que les deux URL pointent
 * vers le même contenu en deux langues (Google hreflang protocol).
 * Mis à jour à chaque build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const now = new Date();

  const staticRoutes = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/legal/mentions", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/legal/cgu", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/legal/cgv", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/legal/confidentialite", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/pricing", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  const tickerRoutes = TICKERS.map((t) => ({
    path: `/${t.toLowerCase()}`,
    priority: 0.9,
    changeFrequency: "daily" as const,
  }));

  const allRoutes = [...staticRoutes, ...tickerRoutes];

  const sitemap: MetadataRoute.Sitemap = [];
  for (const r of allRoutes) {
    const enUrl = `${base}${r.path}`;
    const frUrl = r.path === "/" ? `${base}/fr` : `${base}/fr${r.path}`;
    sitemap.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      alternates: { languages: { en: enUrl, fr: frUrl } },
    });
    sitemap.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      alternates: { languages: { en: enUrl, fr: frUrl } },
    });
  }

  return sitemap;
}
