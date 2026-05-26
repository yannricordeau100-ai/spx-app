import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Shield, FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { loadPageContent } from "@/lib/desk/page-content";
import { ContactV18Client } from "../../v1-8/contact/client";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact · Mettrik AI",
  description:
    "Contacte l'équipe Mettrik AI : support technique, questions commerciales, demandes Max.",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/contact — page contact V1.9.5 (= dernière version).
 *
 * Réutilise le composant client de V1.8 (`ContactV18Client`) pour rester
 * en synchro. Nav retour pointe vers `/sandbox/v1-9-5` via
 * LATEST_VERSION_SLUG.
 */
export default async function SandboxV195ContactPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?auth=signin&next=/sandbox/${LATEST_VERSION_SLUG}/contact`);
  }

  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
  const isFr = locale === "fr";

  const cms = await loadPageContent("contact", locale);
  const txt = (key: string, fallback: string) => cms[key] ?? fallback;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(167,139,250,0.15), transparent 60%)",
        }}
      />

      <nav className="relative mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href={`/sandbox/${LATEST_VERSION_SLUG}`}
          className="group inline-flex items-center gap-2 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {isFr ? "Retour" : "Back"}
        </Link>
        <span className="font-display text-lg tracking-tight text-zinc-100">Mettrik AI</span>
        <div className="w-12" />
      </nav>

      <main className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <Mail className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight sm:text-[34px]">
              {txt("title", isFr ? "Contacte l'équipe" : "Contact the team")}
            </h1>
            <p className="text-[13px] text-zinc-400">
              {txt(
                "subtitle",
                isFr
                  ? "Réponse sous 24 h ouvrées. Choisis la bonne destination ci-dessous."
                  : "Reply within 24 business hours. Pick the right destination below.",
              )}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TrustBadge
            icon={<Shield className="size-3.5 text-emerald-300" />}
            label={isFr ? "Données privées" : "Private data"}
            sub={isFr ? "Pas de revente, pas de spam" : "No reselling, no spam"}
          />
          <TrustBadge
            icon={<FileText className="size-3.5 text-cyan-300" />}
            label="RGPD"
            sub={isFr ? "Hébergement européen" : "EU hosting"}
          />
          <TrustBadge
            icon={<Mail className="size-3.5 text-violet-300" />}
            label={isFr ? "Réponse < 24 h" : "Reply < 24 h"}
            sub={isFr ? "Jours ouvrés" : "Business days"}
          />
        </div>

        <ContactV18Client
          locale={locale}
          userEmail={user.email ?? ""}
          strings={{
            recipient_label: t("contact.recipient_label"),
            recipient_contact: t("contact.recipient_contact"),
            recipient_support: t("contact.recipient_support"),
            recipient_sales: isFr ? "Commercial / Max" : "Sales / Max",
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
            lang_notice: t("contact.lang_notice"),
            cg_accept: isFr
              ? "J'ai lu et j'accepte les "
              : "I have read and accept the ",
            cg_link_label: isFr ? "Conditions Générales" : "Terms of Service",
            cg_required: isFr
              ? "Tu dois accepter les CG pour envoyer ton message."
              : "You must accept the Terms to send your message.",
          }}
        />

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          Mettrik AI · {user.email}
        </p>
      </main>
    </div>
  );
}

function TrustBadge({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-200">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[10.5px] text-zinc-500">{sub}</div>
    </div>
  );
}
