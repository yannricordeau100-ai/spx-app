import fs from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { PopulaireClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Actions populaires · Mettrik AI",
  description: "Top des actions les plus consultées par les investisseurs, par langue.",
};

export type PopularRow = {
  ticker: string;
  name: string;
  rank: number;
  views?: number;
  total_views?: number;
  qid?: string | null;
};

export type PopularData = Record<string, PopularRow[]> & {
  _meta?: { window?: string; source?: string };
};

const COUNTRY_TO_LANGS: Record<string, string[]> = {
  FR: ["fr"], US: ["en"], GB: ["en-GB"], DE: ["de"], NL: ["nl"],
  SE: ["sv"], DK: ["da"], CH: ["de-CH", "fr"], BE: ["fr", "nl"],
  AT: ["de"], LU: ["fr", "de"],
};

const LANG_LABEL: Record<string, string> = {
  en: "Anglais (US)", fr: "Français", de: "Allemand", nl: "Néerlandais",
  "en-GB": "Anglais (UK)", sv: "Suédois", da: "Danois", "de-CH": "Allemand (CH)",
};

export default async function PopulairePage() {
  const dataPath = path.join(process.cwd(), "src/data/popular-stocks-by-language.json");
  let data: PopularData = {};
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as PopularData;
  } catch {
    data = {};
  }

  const h = await headers();
  const countryHeader =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country-code") ||
    "";
  const country = countryHeader.toUpperCase() || "FR";
  const visitorLangs = COUNTRY_TO_LANGS[country] ?? [];
  const locale = await getServerLocale();

  const t = (k: string) => translate(k, locale);

  return (
    <PopulaireClient
      data={data}
      country={country}
      visitorLangs={visitorLangs}
      siteLangs={["en", "fr", "de", "nl", "en-GB", "sv", "da", "de-CH"]}
      langLabel={LANG_LABEL}
      labels={{
        title: locale === "fr" ? "Actions les plus consultées" : "Most viewed stocks",
        subtitle: locale === "fr"
          ? "Classements par langue depuis Wikipedia (12 derniers mois). Pages vues = proxy popularité grand public."
          : "Per-language rankings from Wikipedia (last 12 months). Page views = proxy retail popularity.",
        your_country: locale === "fr" ? "Pour vous" : "For you",
        world: locale === "fr" ? "Monde (toutes langues)" : "World (all languages)",
        other_langs: locale === "fr" ? "Autres langues du site" : "Other site languages",
        country: country || "?",
        download_csv: locale === "fr" ? "Télécharger CSV complet" : "Download full CSV",
        back: t("contact.back_home"),
        powered: data._meta?.source || "Wikipedia pageviews API",
        window: data._meta?.window || "—",
      }}
    />
  );
}
