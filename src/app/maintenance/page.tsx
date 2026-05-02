import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { MaintenanceClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mettrik AI · En cours d'amélioration / Under maintenance",
  robots: { index: false, follow: false },
};

/**
 * Page de maintenance, déclenchée via env var MAINTENANCE_MODE=on (cf. proxy.ts).
 * Bilingue FR/EN automatique selon URL (/fr/maintenance ou /maintenance).
 * Ton FUN : on évite l'austérité, on contrebalance la frustration de l'user.
 */
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ eta?: string }>;
}) {
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
  const sp = await searchParams;
  const etaText = sp.eta?.trim() || t("maintenance.eta_default");

  return (
    <MaintenanceClient
      locale={locale}
      etaText={etaText}
      strings={{
        headline: t("maintenance.headline"),
        subhead: t("maintenance.subhead"),
        body: t("maintenance.body"),
        notifyLabel: t("maintenance.notify_label"),
        notifyPlaceholder: t("maintenance.notify_placeholder"),
        notifySubmit: t("maintenance.notify_submit"),
        notifySuccess: t("maintenance.notify_success"),
        etaIntro: t("maintenance.eta_intro"),
        funCaption: t("maintenance.fun_caption"),
      }}
    />
  );
}
