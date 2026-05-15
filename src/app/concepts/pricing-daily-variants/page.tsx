import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Variantes prix /jour · Mettrik (concepts)",
  robots: { index: false, follow: false },
};

/**
 * 4 variantes du bloc "prix/jour" pour comparer le rendu visuel et
 * choisir la version finale (Yann 15 mai 2026). Inspirations :
 * Notion, Linear, Cursor, Vercel, Stripe Pricing.
 */
export default function PricingDailyVariantsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/concepts" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft className="size-4" /> Retour concepts
        </Link>
        <h1 className="font-display text-3xl font-semibold">Variantes bloc prix /jour</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          4 designs pour le bloc <strong>0,99 €/jour</strong> sur la carte
          Premium pricing. Choisis celle qui convertit le mieux (style Notion /
          Linear / Cursor en référence). La V0 actuelle (production) est en haut,
          les 4 nouvelles propositions ci-dessous.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <PreviewCard title="V0 — version ancienne (avant fix)" body={<V0Old />} />
          <PreviewCard title="V1 — DÉPLOYÉ (gradient + grosse valeur)" body={<V1Hero />} note="actuellement en prod" />
          <PreviewCard title="V2 — Banner stripe horizontal (Linear-style)" body={<V2Banner />} />
          <PreviewCard title="V3 — Ticket gauche / slogan droite (Notion-style)" body={<V3Ticket />} />
          <PreviewCard title="V4 — Hero centré avec slogan en haut (Cursor-style)" body={<V4Centered />} />
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  title, body, note,
}: { title: string; body: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">{title}</div>
        {note && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">{note}</span>}
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-5">
        {/* Contexte simulé : prix mensuel grand + billed annually + emplacement bloc */}
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">29,90</span>
          <span className="text-[15px] font-medium text-zinc-400">€</span>
          <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
        </div>
        <div className="mt-1 text-[11.5px] text-zinc-500">
          Soit <strong className="text-zinc-300">238,80 €</strong> facturés annuellement
          <span className="ml-1 text-emerald-300">· 2 mois offerts</span>
        </div>
        {body}
      </div>
    </div>
  );
}

/* ─── V0 : version ancienne moche ────────────────────────────────── */
function V0Old() {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[22px] font-bold leading-none tracking-tight text-emerald-200">0,99</span>
        <span className="text-[12px] font-semibold text-emerald-300/80">€</span>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-emerald-300/70">/JOUR</span>
      </div>
      <span className="text-right text-[10.5px] italic leading-tight text-zinc-400">
        Soit moins que le prix d&apos;un café,<br />
        <strong className="not-italic text-zinc-200">mais bien mieux investi !</strong>
      </span>
    </div>
  );
}

/* ─── V1 : gradient + grosse valeur (déjà déployé) ────────────────── */
function V1Hero() {
  return (
    <div className="relative mt-5 overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent px-4 py-3.5">
      <div className="absolute -top-8 -right-8 size-24 rounded-full bg-emerald-400/15 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[40px] font-bold leading-none tracking-tight text-emerald-50">0,99</span>
          <div className="flex flex-col leading-none">
            <span className="text-[14px] font-semibold text-emerald-200">€</span>
            <span className="mt-1 text-[10.5px] font-mono font-semibold uppercase tracking-[0.16em] text-emerald-300/90">/JOUR</span>
          </div>
        </div>
        <span className="text-right text-[12px] italic leading-tight text-zinc-300">
          Soit moins que le prix d&apos;un café,<br />
          <strong className="not-italic text-emerald-100">mais bien mieux investi !</strong>
        </span>
      </div>
    </div>
  );
}

/* ─── V2 : banner horizontal Linear-style ─────────────────────────── */
function V2Banner() {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/[0.12] px-4 py-2.5 ring-1 ring-emerald-500/30">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-emerald-500/25 text-[14px]">☕</div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">Moins qu&apos;un café par jour</div>
          <div className="font-display text-[18px] font-bold leading-tight text-emerald-50">
            <span className="text-[26px]">0,99 €</span>
            <span className="text-[11px] font-medium text-emerald-300/80"> · soit 7 € / semaine</span>
          </div>
        </div>
      </div>
      <span className="rounded-full bg-emerald-500/30 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-emerald-50">
        Bien mieux investi
      </span>
    </div>
  );
}

/* ─── V3 : ticket gauche / slogan droite ──────────────────────────── */
function V3Ticket() {
  return (
    <div className="mt-5 flex overflow-hidden rounded-xl border border-emerald-500/30 bg-black/30">
      <div className="flex flex-col items-center justify-center bg-emerald-500/[0.18] px-5 py-3">
        <span className="font-display text-[34px] font-bold leading-none tracking-tight text-emerald-50">0,99 €</span>
        <span className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-300">par jour</span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold text-emerald-100">Moins qu&apos;un café ☕</div>
          <div className="mt-0.5 text-[10.5px] italic text-zinc-400">Bien mieux investi qu&apos;un café (et que ChatGPT pour des KPI sociétés)</div>
        </div>
      </div>
    </div>
  );
}

/* ─── V4 : hero centré, slogan en haut ────────────────────────────── */
function V4Centered() {
  return (
    <div className="mt-5 rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.10] to-transparent px-4 py-4 text-center">
      <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-emerald-300/80">Moins qu&apos;un café par jour</div>
      <div className="mt-2 flex items-end justify-center gap-1.5">
        <span className="font-display text-[48px] font-bold leading-none tracking-tight text-emerald-50">0,99</span>
        <span className="pb-1 text-[18px] font-semibold text-emerald-200">€</span>
        <span className="pb-1.5 text-[12px] uppercase tracking-wider text-emerald-300/80">/jour</span>
      </div>
      <div className="mt-1.5 text-[11px] italic text-zinc-400">Bien mieux investi !</div>
    </div>
  );
}
