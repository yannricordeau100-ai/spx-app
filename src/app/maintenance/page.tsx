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
export default async function MaintenancePage() {
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);

  return (
    <MaintenanceClient
      locale={locale}
      strings={{
        headline: t("maintenance.headline"),
        subhead: t("maintenance.subhead"),
        caption: t("maintenance.fun_caption"),
      }}
    />
  );
}
