"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, ArrowRight, X, Send, Sparkles, Phone, Clock, Shield } from "lucide-react";

/**
 * /concepts/contact-home — 2 propositions pour exposer la page contact
 * sur la home (Yann 8 mai 2026 : "en plus de la simple page contact
 * affiché en haut à coté des autres pages, propose moi 2 options
 * d'afficher la page contact sur la home").
 *
 * Option 1 : sticky bouton flottant en bas-droit (chat-bubble pattern,
 *           inspiration Intercom / Drift) avec card qui s'ouvre
 *           latéralement (1-clic vers la page contact ou form embed).
 * Option 2 : section dédiée juste avant le footer de la home, format
 *           large bandeau split avec CTA dominant + 3 trust badges
 *           (inspiration Stripe / Vercel "Talk to sales" sections).
 */

type Variant = "floating" | "section";

export default function ContactHomeConceptsPage() {
  const [active, setActive] = useState<Variant>("floating");

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050507]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/concepts" className="font-display text-[15px] font-bold tracking-tight text-zinc-100">
            ← Concepts
          </Link>
          <nav className="flex flex-wrap gap-1.5">
            {(["floating", "section"] as Variant[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActive(v)}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wider transition-colors ${
                  active === v ? "bg-violet-500/20 text-violet-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                {v === "floating" ? "Option 1 — Bouton flottant" : "Option 2 — Section bandeau"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-2 pt-4 text-center text-[12px] italic text-zinc-500 sm:px-6">
        {active === "floating"
          ? "Bouton flottant bas-droit. Inspiration Intercom / Drift. Discret et persistant. Bonne conversion B2B SaaS."
          : "Section dédiée juste avant le footer. Inspiration Stripe / Vercel. Trust badges + CTA dominant. Bonne conversion enterprise."}
      </div>

      {/* Mock home */}
      <main className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight">Mettrik AI</h1>
          <p className="mt-3 text-[14.5px] text-zinc-400">KPI Intelligence pour investisseurs</p>
          <p className="mx-auto mt-6 max-w-md text-[13px] text-zinc-500">
            (mock minimaliste de la home pour montrer où apparaît le contact)
          </p>
        </div>

        {/* Sociétés disponibles mock */}
        <div className="my-16 grid gap-3 sm:grid-cols-3">
          {["GOOGL", "META", "AAPL"].map((t) => (
            <div key={t} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center">
              <div className="font-mono text-[12px] font-bold text-violet-300">{t}</div>
              <div className="mt-1 text-[11px] text-zinc-500">Sé exemple</div>
            </div>
          ))}
        </div>

        {/* Variante 2 : section bandeau insérée ici */}
        {active === "section" && <ContactSectionBanner />}

        <footer className="mt-12 border-t border-white/[0.06] pt-6 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          Mettrik AI · 2026
        </footer>
      </main>

      {/* Variante 1 : bouton flottant */}
      {active === "floating" && <ContactFloatingButton />}
    </div>
  );
}

/* ─── Option 1 : bouton flottant ───────────────────────────────────── */

function ContactFloatingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500 px-5 py-3 text-[13px] font-bold text-zinc-50 shadow-2xl shadow-violet-500/30 transition-all hover:scale-105 hover:bg-violet-400"
      >
        <MessageCircle className="size-4" />
        <span>Contact</span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#0a0a0d] shadow-2xl shadow-violet-500/20">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-violet-500/[0.06] px-5 py-3.5">
            <div>
              <div className="text-[14px] font-bold text-zinc-100">On répond.</div>
              <div className="text-[11px] text-zinc-500">Sous 24 h ouvrées</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2.5 p-5">
            <ContactOption
              icon={<Mail className="size-4 text-violet-300" />}
              title="Question générale"
              body="Curieux du produit, pricing, démo"
              href="/sandbox/v1-8/contact?dest=contact"
            />
            <ContactOption
              icon={<Sparkles className="size-4 text-cyan-300" />}
              title="Support technique"
              body="Bug, demande compte, intégration"
              href="/sandbox/v1-8/contact?dest=support"
            />
            <ContactOption
              icon={<Phone className="size-4 text-emerald-300" />}
              title="Pro+ / Family Office"
              body="Devis personnalisé, démo live"
              href="/sandbox/v1-8/contact?dest=sales"
            />
          </div>
          <div className="border-t border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-center text-[10.5px] text-zinc-500">
            Inscription requise pour envoyer (anti-spam)
          </div>
        </div>
      )}
    </>
  );
}

function ContactOption({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-violet-400/30 hover:bg-white/[0.04]">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-black/30">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-zinc-100">{title}</div>
        <div className="text-[11px] text-zinc-500">{body}</div>
      </div>
      <ArrowRight className="size-3.5 text-zinc-600 transition-colors group-hover:text-violet-400" />
    </Link>
  );
}

/* ─── Option 2 : section bandeau ───────────────────────────────────── */

function ContactSectionBanner() {
  return (
    <section className="my-12 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.10] via-violet-500/[0.05] to-cyan-500/[0.05]">
      <div className="grid items-center gap-8 p-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-[36px]">
            Tu hésites ? <span className="bg-gradient-to-br from-violet-300 to-cyan-300 bg-clip-text text-transparent">Parle-nous.</span>
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-zinc-300">
            Question pricing, démo Pro+, intégration API : on prend 15 min pour répondre.
            Pas de pitch commercial, juste une vraie conversation avec l'équipe.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/sandbox/v1-8/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-[14px] font-bold text-zinc-50 transition-colors hover:bg-violet-400"
            >
              Envoyer un message
              <Send className="size-4" />
            </Link>
            <Link
              href="mailto:contact@mettrik.ai"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-[14px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.07]"
            >
              <Mail className="size-4" />
              contact@mettrik.ai
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <BadgeRow icon={<Clock className="size-4 text-emerald-300" />} title="Réponse < 24 h" sub="Jours ouvrés, équipe en France et Suisse" />
          <BadgeRow icon={<Shield className="size-4 text-cyan-300" />} title="Données privées" sub="On ne revend rien, anti-spam strict" />
          <BadgeRow icon={<Phone className="size-4 text-violet-300" />} title="Pro+ : appel direct" sub="Démo personnalisée pour les family offices" />
        </div>
      </div>
    </section>
  );
}

function BadgeRow({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-black/30">
        {icon}
      </span>
      <div>
        <div className="text-[13.5px] font-semibold text-zinc-100">{title}</div>
        <div className="text-[11.5px] text-zinc-400">{sub}</div>
      </div>
    </div>
  );
}
