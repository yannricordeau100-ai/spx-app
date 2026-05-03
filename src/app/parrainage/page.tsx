import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ParrainageClient } from "./client";
import { DEFAULT_REFERRAL_SETTINGS } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parrainage · Mettrik AI",
  description: "Parrainez un proche, gagnez 1 mois offert chacun.",
};

export default async function ParrainagePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Charge les settings (lecture publique)
  const { data: settingsRow } = await supabase
    .from("desk_referral_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const settings = settingsRow ?? DEFAULT_REFERRAL_SETTINGS;

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href={locale === "fr" ? "/fr" : "/"}
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {locale === "fr" ? "Retour à l'accueil" : "Back to home"}
        </Link>

        <h1 className="mb-3 font-display text-[36px] font-bold tracking-tight">
          {t("referral.title")}
        </h1>
        <p className="mb-8 max-w-xl text-[15px] text-zinc-400">
          {t("referral.subtitle")}
        </p>

        <ParrainageClient
          locale={locale}
          isAuthenticated={!!user?.email}
          userEmail={user?.email ?? null}
          codeFromUrl={sp.code ?? null}
          settingsEnabled={settings.enabled}
          rewardMonths={settings.reward_months}
          bannerText={locale === "fr" ? settings.banner_text_fr : settings.banner_text_en}
          strings={{
            cta_generate: t("referral.cta_generate"),
            cta_copy: t("referral.cta_copy"),
            cta_copied: t("referral.cta_copied"),
            your_code: t("referral.your_code"),
            your_link: t("referral.your_link"),
            signin_required: t("referral.signin_required"),
            paid_required: t("referral.paid_required"),
            history_title: t("referral.history_title"),
            history_empty: t("referral.history_empty"),
            status_pending: t("referral.status_pending"),
            status_signed_up: t("referral.status_signed_up"),
            status_subscribed: t("referral.status_subscribed"),
            status_rewarded: t("referral.status_rewarded"),
            status_expired: t("referral.status_expired"),
            status_invalid: t("referral.status_invalid"),
            expires_in: t("referral.expires_in"),
            how_it_works: t("referral.how_it_works"),
            step1: t("referral.step1"),
            step2: t("referral.step2"),
            step3: t("referral.step3"),
            code_invalid: t("referral.code_invalid"),
            code_valid_invited_by: t("referral.code_valid_invited_by"),
            disabled: t("referral.disabled"),
          }}
        />
      </div>
    </div>
  );
}
