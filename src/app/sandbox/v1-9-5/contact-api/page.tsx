import Link from "next/link";
import { ArrowLeft, Mail, Server, Lock, Zap } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { ContactApiClient } from "./client";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accès API · Mettrik AI",
  description:
    "Formulaire de demande d'accès API Mettrik AI. Réservé aux fonds, family offices, wealth managers et analystes pro.",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/contact-api — formulaire dédié aux pros qui veulent
 * l'API Mettrik AI (Yann P7, 31 mai 2026).
 *
 * Différent de /contact (générique) : champs spécifiques API (use case,
 * volume estimé, nb de sociétés suivies, société).
 *
 * Public : pas de gate auth (les pros veulent souvent démarcher avant
 * de créer un compte).
 */
export default async function SandboxV195ContactApiPage() {
  const locale = await getServerLocale();
  const isFr = locale === "fr";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(251,191,36,0.10), transparent 60%)",
        }}
      />

      <nav className="relative mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href={`/sandbox/${LATEST_VERSION_SLUG}/pricing`}
          className="group inline-flex items-center gap-2 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {isFr ? "Retour aux tarifs" : "Back to pricing"}
        </Link>
        <span className="font-display text-lg tracking-tight text-zinc-100">Mettrik AI</span>
        <div className="w-12" />
      </nav>

      <main className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber-200">
            Pour les pros
          </div>
          <h1 className="mt-4 font-display text-[28px] font-bold tracking-tight sm:text-[34px]">
            {isFr ? "Demander un accès API" : "Request API access"}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
            {isFr
              ? "Fonds, family offices, wealth managers, analystes pro : remplis le formulaire ci-dessous. Notre équipe te répond sous 24 h ouvrées avec une proposition tarifaire sur mesure (volume + nombre de sociétés suivies)."
              : "Funds, family offices, wealth managers, professional analysts: fill in the form below. Our team replies within 24 business hours with a tailored pricing proposal (volume + number of companies tracked)."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TrustBadge
            icon={<Server className="size-3.5 text-amber-300" />}
            label={isFr ? "API REST JSON" : "REST JSON API"}
            sub={isFr ? "Authentification clé" : "Key auth"}
          />
          <TrustBadge
            icon={<Zap className="size-3.5 text-cyan-300" />}
            label={isFr ? "SLA dédié" : "Dedicated SLA"}
            sub={isFr ? "Disponibilité 99,5 %" : "99.5% uptime"}
          />
          <TrustBadge
            icon={<Lock className="size-3.5 text-emerald-300" />}
            label="RGPD"
            sub={isFr ? "Hébergement EU" : "EU hosting"}
          />
        </div>

        <ContactApiClient locale={locale} />

        <p className="mt-8 text-center text-[11.5px] text-zinc-500">
          {isFr
            ? "Tu cherches un usage particulier (pas pro) ? "
            : "Looking for a personal plan (not pro)? "}
          <Link
            href={`/sandbox/${LATEST_VERSION_SLUG}/pricing`}
            className="text-violet-300 hover:text-violet-200"
          >
            {isFr ? "Voir les plans grand public" : "See consumer plans"}
          </Link>
        </p>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          <Mail className="mr-1 inline size-3" />
          contact@mettrik.ai
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
