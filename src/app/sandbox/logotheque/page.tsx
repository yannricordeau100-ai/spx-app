/**
 * /sandbox/logotheque — images de marque fournies par Yann (avec tous leurs
 * usages produit et hors site), affectation du logo par emplacement, et
 * gestion croix / suppression multiple (Yann 31 août 2026, refonte 2 sept).
 */
import {
  chargeMasquesLogotheque,
  chargeReglagesLogotheque,
} from "@/lib/desk/logotheque-store";
import { LogothequeClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logothèque · Sandbox Mettrik" };

export default async function Page() {
  const [reglages, masques] = await Promise.all([
    chargeReglagesLogotheque(),
    chargeMasquesLogotheque(),
  ]);
  return <LogothequeClient initial={reglages} masquesInitial={masques} />;
}
