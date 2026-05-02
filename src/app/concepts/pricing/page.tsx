import { COMPANIES, TICKERS, getCompany } from "@/lib/data";
import { lockCompany } from "@/lib/gibberify";
import type { Company } from "@/lib/data";
import { PricingClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing concept · Mettrik",
};

/**
 * Sociétés autorisées en plan FREE.
 * Toute société hors de cette liste sera servie gibberifiée au client
 * (le vrai contenu ne quitte JAMAIS le serveur tant que l'utilisateur
 * n'a pas le plan Premium).
 */
const FREE_TIER_TICKERS = ["GOOGL", "META"];

export default function PricingConceptPage() {
  // Pour le concept brouillon : on pré-calcule la version "free" et la
  // version "premium" pour que le toggle dans la démo soit instantané.
  // En PRODUCTION : seule la version correspondant au plan de l'utilisateur
  // (déterminé via session Supabase) serait envoyée au client.
  const freeVersions: Record<string, Company> = {};
  const premiumVersions: Record<string, Company> = {};

  for (const ticker of TICKERS) {
    const c = getCompany(ticker);
    if (!c) continue;
    premiumVersions[ticker] = c;
    freeVersions[ticker] = FREE_TIER_TICKERS.includes(ticker)
      ? c
      : lockCompany(c);
  }

  return (
    <PricingClient
      freeVersions={freeVersions}
      premiumVersions={premiumVersions}
      freeTierTickers={FREE_TIER_TICKERS}
    />
  );
}
