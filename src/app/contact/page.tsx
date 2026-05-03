import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { ContactClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact · Mettrik AI",
  description: "Une question ? On répond. Contact général ou support technique.",
};

export default async function ContactPage() {
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={locale === "fr" ? "/fr" : "/"}
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {locale === "fr" ? "Retour à l'accueil" : "Back to home"}
        </Link>

        <h1 className="mb-3 font-display text-[36px] font-bold tracking-tight">
          {t("contact.title")}
        </h1>
        <p className="mb-8 text-[15px] text-zinc-400">
          {t("contact.subtitle")}
        </p>

        <ContactClient
          locale={locale}
          strings={{
            recipient_label: t("contact.recipient_label"),
            recipient_contact: t("contact.recipient_contact"),
            recipient_support: t("contact.recipient_support"),
            name_label: t("contact.name_label"),
            name_placeholder: t("contact.name_placeholder"),
            email_label: t("contact.email_label"),
            email_placeholder: t("contact.email_placeholder"),
            subject_label: t("contact.subject_label"),
            subject_placeholder: t("contact.subject_placeholder"),
            body_label: t("contact.body_label"),
            body_placeholder: t("contact.body_placeholder"),
            submit: t("contact.submit"),
            sending: t("contact.sending"),
            success_title: t("contact.success_title"),
            success_body: t("contact.success_body"),
            error: t("contact.error"),
            privacy_note: t("contact.privacy_note"),
          }}
        />
      </div>
    </div>
  );
}
