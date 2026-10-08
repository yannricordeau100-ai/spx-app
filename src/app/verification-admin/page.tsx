import { VerificationAdminClient } from "./client";
import { retourSur } from "@/lib/security/admin-2fa";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mettrik AI · Vérification",
  robots: { index: false, follow: false },
};

/**
 * Seconde verification des comptes admin (Yann 9 oct 2026) : saisie du code
 * a 6 chiffres envoye par e-mail avant l entree dans l outillage.
 * L acces (compte admin connecte) est controle par le proxy.
 */
export default async function VerificationAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const { retour } = await searchParams;
  return <VerificationAdminClient retour={retourSur(retour)} />;
}
