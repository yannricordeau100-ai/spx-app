import { redirect } from "next/navigation";

/**
 * Ancienne URL CGU. Les CGU et CGV ont été fusionnées en un seul document
 * unifié à `/legal/conditions` (le 3 mai 2026). Cette route conserve l'URL
 * historique pour compatibilité (liens externes, emails déjà envoyés) mais
 * redirige systématiquement vers le doc fusionné.
 */
export default function CGURedirect() {
  redirect("/legal/conditions");
}
