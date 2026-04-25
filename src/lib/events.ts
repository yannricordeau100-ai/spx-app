/**
 * Hand-curated key events per company per year.
 * Used to annotate charts with hoverable context.
 */

export type CompanyEvent = {
  year: number;
  title: string;
  body: string;
};

export const EVENTS: Record<string, CompanyEvent[]> = {
  GOOGLE: [
    {
      year: 2022,
      title: "Récession publicitaire",
      body: "Le marché publicitaire mondial se contracte ; YouTube ads recule pour la première fois.",
    },
    {
      year: 2023,
      title: "Lancement Bard / Gemini",
      body: "Google riposte à ChatGPT avec Bard (mars), renommé Gemini (déc.) ; capex IA accélère.",
    },
    {
      year: 2024,
      title: "AI Overviews dans Search",
      body: "Déploiement d'AI Overviews dans Search aux US — premier grand changement de l'expérience Search depuis 10 ans.",
    },
    {
      year: 2025,
      title: "Gemini 3 + Cloud à $70B run rate",
      body: "Gemini 3 lancé en novembre, traite 10 Mds tokens/min via API. Google Cloud sort 2025 à un run rate annuel >$70B. Charge Waymo $2.1B.",
    },
  ],
  GOOGL: [], // alias
  META: [
    {
      year: 2022,
      title: "iOS ATT + récession pub",
      body: "Apple App Tracking Transparency + récession publicitaire = effondrement du prix par pub (-16 % YoY).",
    },
    {
      year: 2023,
      title: "Year of Efficiency",
      body: "Mark Zuckerberg réduit les effectifs de 22 %. Reels monétise enfin. Marché récompense (+200 % cours).",
    },
    {
      year: 2024,
      title: "Llama 3 + Meta AI",
      body: "Llama 3 open-source. Meta AI déployé sur WhatsApp/Instagram. Reality Labs perte continue.",
    },
    {
      year: 2025,
      title: "Capex x2 vers $72B",
      body: "Investissements infra IA doublent. Mark annonce \"superintelligence personnelle\". Revenu dépasse $200B.",
    },
  ],
  MSCI: [
    {
      year: 2022,
      title: "Burst de marché bear",
      body: "Marchés baissiers : ABF (frais sur AUM) stagnent. Subscription Run Rate continue de croître.",
    },
    {
      year: 2023,
      title: "Boom ESG global",
      body: "Demande forte pour les indices ESG/climat. Run Rate total franchit $2.7B.",
    },
    {
      year: 2024,
      title: "Foundry Fabric (acq.)",
      body: "Acquisition Foundry pour renforcer la plateforme données privées. Retention dip à 93.1 %.",
    },
    {
      year: 2025,
      title: "AUM ETF record",
      body: "Flux record sur ETF indexés MSCI. ABF Run Rate +26 %. Marge EBITDA franchit 60.8 %.",
    },
  ],
  SPGI: [
    {
      year: 2022,
      title: "Fusion IHS Markit",
      body: "Clôture de la fusion IHS Markit (fév. 2022). Revenue saute de $8.3B à $11.2B.",
    },
    {
      year: 2023,
      title: "Refinancement de la dette",
      body: "Vague de refinancement post-2022 : Ratings rebondit progressivement.",
    },
    {
      year: 2024,
      title: "Reprise des émissions",
      body: "Vague d'émissions corporate ; Ratings +31 %. Marges en expansion.",
    },
    {
      year: 2025,
      title: "Acquisition With Intelligence",
      body: "Acquisition de With Intelligence (nov.) pour étendre Market Intelligence. EPS ajusté +14 %.",
    },
  ],
  CAT: [
    {
      year: 2022,
      title: "Inflation + post-COVID",
      body: "Demande forte mais coûts d'intrants en hausse. Marges sous pression mais en récupération.",
    },
    {
      year: 2023,
      title: "Pricing record",
      body: "Pricing power exceptionnel. Adjusted op margin grimpe de 15.4 % à 20.5 %. Backlog reste haut.",
    },
    {
      year: 2024,
      title: "Destockage dealers",
      body: "Dealers réduisent leurs stocks ($1.3B). Revenue -3 %. Carnet de commandes stable.",
    },
    {
      year: 2025,
      title: "Boom Power & Energy / Datacenters",
      body: "Datacenters portent la demande Power & Energy. Backlog explose à $51.2B (+71 %, record). Centenaire de Caterpillar.",
    },
  ],
};

export function eventsForCompany(ticker: string): CompanyEvent[] {
  if (ticker === "GOOGL") return EVENTS.GOOGLE;
  return EVENTS[ticker] ?? [];
}

export function eventForYear(ticker: string, year: number): CompanyEvent | null {
  return eventsForCompany(ticker).find((e) => e.year === year) ?? null;
}
