import Link from "next/link";
import { ArrowLeft, ArrowRight, Link2, Percent, BarChart3, Handshake } from "lucide-react";

export const metadata = {
  title: "Rejoindre Mettrik · Affiliation et partenariats",
  description:
    "Programme d'affiliation Mettrik AI : une commission sur les abonnements que vous apportez, avec un lien personnalisé. Partenariats ouverts aux créateurs, communautés, newsletters, écoles.",
  alternates: { canonical: "https://www.mettrik.ai/partenaires" },
};

const CONTACT_HREF = "/contact?sujet=Partenariat";

const ETAPES = [
  { icon: Link2, titre: "Un lien personnalisé", texte: "Vous recevez votre lien unique à partager où vous voulez." },
  { icon: Percent, titre: "Une commission", texte: "Vous touchez une commission sur chaque abonnement apporté par votre lien." },
  { icon: BarChart3, titre: "Un suivi clair", texte: "Vous voyez ce que votre audience apporte, sans zone d'ombre." },
];

const PROFILS = [
  "YouTubeurs finance",
  "Communautés Discord",
  "Reddit",
  "Comptes X",
  "Newsletters",
  "Podcasts",
  "Blogs",
  "Clubs d'investissement",
  "Écoles et universités",
];

export default function PartenairesPage() {
  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#050507] text-zinc-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-radial-glow" />
        <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
          <Link href="/" className="group mb-8 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Retour à l&apos;accueil
          </Link>

          <header className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">Rejoindre Mettrik</p>
            <h1 className="mt-3 text-balance font-display text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[46px]">
              Faites découvrir Mettrik, soyez rémunéré.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              Mettrik AI aide les investisseurs à comprendre les sociétés par leurs indicateurs clés. Si votre audience
              s&apos;intéresse à la bourse, devenez affilié ou construisons un partenariat sur mesure.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={CONTACT_HREF}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-400 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Nous contacter
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </header>

          <section className="mt-12 sm:mt-16" aria-labelledby="affiliation">
            <h2 id="affiliation" className="font-display text-[22px] font-bold tracking-tight sm:text-[26px]">
              Le programme d&apos;affiliation
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
              Simple : vous partagez, vos abonnés découvrent Mettrik, vous êtes commissionné sur les abonnements
              qui en découlent. Les conditions sont détaillées avec vous lors de la prise de contact.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {ETAPES.map(({ icon: Icon, titre, texte }) => (
                <div key={titre} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
                    <Icon className="size-4.5" />
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-zinc-100">{titre}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{texte}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 sm:mt-16" aria-labelledby="partenariats">
            <h2 id="partenariats" className="font-display text-[22px] font-bold tracking-tight sm:text-[26px]">
              Partenariats ouverts
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
              Nous cherchons des voix qui parlent d&apos;investissement avec rigueur. Si vous vous reconnaissez, écrivez-nous.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {PROFILS.map((p) => (
                <li key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-zinc-200">
                  {p}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 rounded-2xl border border-violet-400/25 bg-violet-500/[0.06] p-6 text-center sm:mt-16 sm:p-8">
            <Handshake className="mx-auto size-6 text-violet-200" />
            <h2 className="mt-3 font-display text-[22px] font-bold tracking-tight">Parlons-en</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-zinc-400">
              Dites-nous qui vous êtes et quelle audience vous touchez. Nous revenons vers vous avec une proposition.
            </p>
            <Link
              href={CONTACT_HREF}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-400 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Nous contacter
              <ArrowRight className="size-4" />
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
