import type { MetadataRoute } from "next";

/**
 * robots.txt auto-généré.
 * Bloque les routes internes (/desk-, /sandbox/, /concepts/, /api/, etc.)
 * et autorise les pages publiques (home, sociétés, légal).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/auth/",
          "/account/",
          "/admin/",
          "/desk-",       // toute URL secrète /desk-<slug>
          "/sandbox/",
          "/concepts/",
          "/whoami",
          "/_not-found-desk",
        ],
      },
      // GPTBot et autres scrapers IA : autorise (gain de visibilité dans les
      // réponses ChatGPT / Perplexity / Claude). Désactive si tu veux bloquer.
      {
        userAgent: ["GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "anthropic-ai"],
        allow: ["/"],
        disallow: ["/api/", "/auth/", "/account/", "/admin/", "/desk-", "/sandbox/", "/concepts/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
