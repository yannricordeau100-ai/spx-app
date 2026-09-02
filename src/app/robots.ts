import type { MetadataRoute } from "next";

/**
 * robots.txt auto-généré.
 * Bloque les routes internes (/desk-, /sandbox/, /concepts/, /api/, etc.)
 * et autorise les pages publiques (home, sociétés, FAQ, tarifs, légal).
 *
 * Yann 2 sept 2026 (GEO : être trouvé par les moteurs de réponse IA).
 * Deux familles de robots IA, deux traitements :
 *  - ENTRAÎNEMENT (GPTBot, ClaudeBot, CCBot, Bytespider, Google-Extended...) :
 *    toujours INTERDITS, conformément à la clause anti-IA des CGV/CGU.
 *  - RECHERCHE / RÉPONSE EN TEMPS RÉEL (OAI-SearchBot, ChatGPT-User,
 *    PerplexityBot, Claude-SearchBot...) : AUTORISÉS sur les pages publiques.
 *    Ces robots ne servent pas à entraîner un modèle : ils vont lire la page
 *    au moment où un utilisateur pose une question, et la citent avec un lien.
 *    Sans eux, Mettrik n'apparaît jamais dans les réponses de ChatGPT,
 *    Perplexity ou Claude. Le meta "noai" du layout reste en place pour
 *    l'opt-out d'entraînement.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";

  const internes = [
    // Yann 29 aout 2026 : /api/kpis-existants reste ouvert aux outils de
    // lecture (verification anti-doublon depuis une conversation Claude
    // externe). Le reste de /api/ demeure bloque.
    "/api/",
    "/auth/",
    "/account/",
    "/admin/",
    "/desk-", // toute URL secrète /desk-<slug>
    "/sandbox/",
    "/concepts/",
    "/whoami",
    "/_not-found-desk",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: internes,
      },
      // Robots de RECHERCHE des assistants IA : bienvenus sur les pages
      // publiques, mêmes limites que les moteurs classiques.
      {
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "PerplexityBot",
          "Perplexity-User",
          "Claude-SearchBot",
          "Claude-User",
          "Applebot",
          "DuckAssistBot",
          "MistralAI-User",
        ],
        allow: ["/"],
        disallow: internes,
      },
      // Robots d'ENTRAÎNEMENT IA / LLM : interdiction TOTALE.
      // Cohérent avec la clause anti-IA des CGV/CGU. Pas 100 % efficace
      // (les gros LLM ignorent souvent), mais signal opt-out
      // juridiquement opposable + élément de preuve en cas de litige.
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot", "anthropic-ai", "Claude-Web",
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
        allow: [],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
