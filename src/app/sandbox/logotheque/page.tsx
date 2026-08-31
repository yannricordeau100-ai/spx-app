/**
 * /sandbox/logotheque — registre des logos Mettrik et affectation par
 * emplacement du site (Yann 31 août 2026).
 */
import { chargeReglagesLogotheque } from "@/lib/desk/logotheque-store";
import { LogothequeClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logothèque · Sandbox Mettrik" };

export default async function Page() {
  const reglages = await chargeReglagesLogotheque();
  return <LogothequeClient initial={reglages} />;
}
