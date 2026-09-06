import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { MaintenanceClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mettrik AI · Bientôt en ligne",
  robots: { index: false, follow: false },
};

/**
 * Page de maintenance / pré-lancement.
 * - Page FIXE : aucune action, aucun formulaire, aucune donnée demandée.
 * - Ton positif "on se fait beau" : donne envie sans donner d'info.
 * - Bilingue auto via cookie/locale.
 */
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
  const { zone } = await searchParams;
  // 6 sept 2026 : variante « tarifs » (page tarifs seule en maintenance,
  // le site lui-meme restant ouvert). Meme page fixe, autre message.
  const tarifs = zone === "tarifs";
  const fr = locale !== "en";

  return (
    <MaintenanceClient
      locale={locale}
      strings={{
        headline: tarifs ? (fr ? "Nos tarifs arrivent." : "Our pricing is on its way.") : t("maintenance.headline"),
        subhead: tarifs
          ? (fr
              ? "La grille tarifaire est en cours de finalisation. Le reste du site est ouvert : revenez très vite."
              : "The pricing grid is being finalised. The rest of the site is open: check back very soon.")
          : t("maintenance.subhead"),
        caption: t("maintenance.fun_caption"),
      }}
    />
  );
}
