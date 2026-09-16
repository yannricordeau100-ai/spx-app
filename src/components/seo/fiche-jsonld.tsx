/**
 * Données structurées d'une fiche société (Yann 16 sept 2026).
 *
 * Objectif référencement classique et réponses des moteurs IA : dire
 * explicitement de quelle société parle la page, quels indicateurs elle
 * mesure, d'où ils viennent et quand ils ont été mis à jour. Sans ce bloc,
 * une fiche n'est qu'un mur de chiffres pour un robot.
 */
export function FicheJsonLd({
  ticker,
  nom,
  secteur,
  description,
  url,
  kpis,
  misAJour,
}: {
  ticker: string;
  nom: string;
  secteur?: string | null;
  description?: string | null;
  url: string;
  kpis: string[];
  misAJour?: string | null;
}) {
  const societe = {
    "@type": "Corporation",
    name: nom,
    tickerSymbol: ticker.toUpperCase(),
    ...(secteur ? { industry: secteur } : {}),
  };
  const donnees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${nom} (${ticker.toUpperCase()}) · Mettrik AI`,
        ...(description ? { description } : {}),
        ...(misAJour ? { dateModified: misAJour } : {}),
        about: societe,
        isPartOf: { "@type": "WebSite", name: "Mettrik AI", url: "https://www.mettrik.ai" },
        publisher: { "@type": "Organization", name: "Mettrik AI", url: "https://www.mettrik.ai" },
      },
      {
        "@type": "Dataset",
        name: `Indicateurs clés de ${nom} (${ticker.toUpperCase()})`,
        ...(description ? { description } : {}),
        url,
        ...(misAJour ? { dateModified: misAJour } : {}),
        about: societe,
        creator: { "@type": "Organization", name: "Mettrik AI", url: "https://www.mettrik.ai" },
        isAccessibleForFree: true,
        variableMeasured: kpis.slice(0, 25),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Mettrik AI", item: "https://www.mettrik.ai" },
          { "@type": "ListItem", position: 2, name: `${nom} (${ticker.toUpperCase()})`, item: url },
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
    />
  );
}
