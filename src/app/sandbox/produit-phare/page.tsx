import { exceptionsPhare, lireChoixPhare, lireRegistre } from "@/lib/produit-phare";
import { ProduitPhareView } from "./view";

export const dynamic = "force-dynamic";

/**
 * Produit phare (Yann, 9 sept 2026) : page de contrôle des EXCEPTIONS seules.
 * Les sociétés dont le produit phare a été identifié sans ambiguïté n y
 * figurent pas : leur KPI est déjà posé en hero.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  const [choix] = await Promise.all([lireChoixPhare()]);
  const total = Object.keys(lireRegistre().stes).length;
  return <ProduitPhareView exceptions={exceptionsPhare()} choixInitial={choix} total={total} jeton={parJeton ? sp.audit_token ?? null : null} />;
}
