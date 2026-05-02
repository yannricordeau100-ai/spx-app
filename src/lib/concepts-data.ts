/**
 * Concepts data loader — sert UNIQUEMENT à la page /concepts.
 *
 * Surchage les datasets live pour CAT et SPGI avec les versions enrichies
 * (KPI nouveaux short-history extraits des earnings 2025-2026), pour pouvoir
 * tester l'intégration du bloc Stories sans toucher la version live.
 *
 * Pour les tickers non listés (META, GOOGL, MSCI), fallback sur le dataset
 * live via getCompany() de @/lib/data.
 */
import catConcept from "@/data/concepts/cat.json";
import spgiConcept from "@/data/concepts/spgi.json";
import { COMPANIES, getCompany, type Company } from "@/lib/data";

const CONCEPT_OVERRIDES: Record<string, Company> = {
  CAT: catConcept as Company,
  SPGI: spgiConcept as Company,
};

/** Retourne la version concept (enrichie short-history) si dispo, sinon live. */
export function getConceptCompany(ticker: string): Company | null {
  const t = ticker.toUpperCase();
  return CONCEPT_OVERRIDES[t] ?? getCompany(t);
}

/** Map équivalent à COMPANIES mais avec les overrides concepts. */
export const CONCEPT_COMPANIES: Record<string, Company> = {
  ...COMPANIES,
  ...CONCEPT_OVERRIDES,
};
