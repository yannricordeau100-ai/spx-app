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
        allow: ["/", "/api/kpis-existants/"],
        disallow: [
          // Yann 29 aout 2026 : /api/kpis-existants reste ouvert aux outils de
          // lecture (verification anti-doublon depuis une conversation Claude
          // externe). Le reste de /api/ demeure bloque.
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
      // Bots d'entraînement IA / LLM : interdiction TOTALE.
      // Cohérent avec la clause anti-IA des CGV/CGU. Pas 100 % efficace
      // (les gros LLM ignorent souvent), mais signal opt-out
      // juridiquement opposable + élément de preuve en cas de litige.
      {
        userAgent: [
          "GPTBot", "ChatGPT-User", "OAI-SearchBot",
          "ClaudeBot", "anthropic-ai", "Claude-Web",
          "PerplexityBot", "Perplexity-User",
          "CCBot",
          "Google-Extended", "GoogleOther",
          "Bytespider",
          "FacebookBot", "Meta-ExternalAgent",
          "Applebot-Extended",
          "Amazonbot",
          "cohere-ai",
          "Diffbot", "ImagesiftBot", "Omgilibot",
          "PetalBot", "Timpibot", "YouBot",
          "ai2bot", "DataForSeoBot", "magpie-crawler",
        ],
        disallow: ["/"],
        // Meme opt-out qu avant, a une exception pres : l endpoint de
        // verification anti-doublon des KPI, concu pour etre lu par une
        // conversation Claude du compte de Yann.
        allow: ["/api/kpis-existants/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
