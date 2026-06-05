"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

/**
 * <FaqPricing /> — bloc FAQ affiché sur la page tarifs avec un toggle
 * FR / EN / DE local qui surcharge la locale globale du site.
 *
 * Yann 5 juin 2026 : la page tarifs reste majoritairement consultée en
 * français (audience principale = investisseurs particuliers français)
 * mais Yann veut qu'un visiteur EN ou DE puisse lire les Q/R dans sa
 * langue sans changer la langue de tout le site. Le toggle est local au
 * bloc FAQ uniquement, le reste de la page reste dans la locale globale.
 *
 * Le contenu (questions + réponses) est passé par le serveur dans les
 * 3 langues. Le client ne fait que basculer entre les 3 versions du
 * texte sans aller-retour réseau.
 *
 * 9 questions (était 7, +Q8 nombre KPI variable + Q9 sources le 5 juin).
 * Éditables via /sandbox/v1-9-5/admin/faq.
 */

type LocaleKey = "fr" | "en" | "de";

export type FaqPair = {
  q: { fr: string; en: string; de: string };
  a: { fr: string; en: string; de: string };
};

const LOCALE_LABEL: Record<LocaleKey, string> = {
  fr: "FR",
  en: "EN",
  de: "DE",
};

const TOGGLE_HINT: Record<LocaleKey, string> = {
  fr: "Lire en",
  en: "Read in",
  de: "Lesen auf",
};

export function FaqPricing({
  pairs,
  initialLocale = "fr",
  title,
}: {
  pairs: FaqPair[];
  initialLocale?: LocaleKey;
  title: string;
}) {
  const [locale, setLocale] = useState<LocaleKey>(initialLocale);

  return (
    <section className="mx-auto mt-20 max-w-3xl">
      <h2 className="mb-4 text-center font-display text-3xl font-bold tracking-tight text-zinc-50">
        {title}
      </h2>

      {/* Toggle FR / EN / DE — gravé Yann 5 juin 2026, doit rester simple
          et compact. NE PAS remplacer par un dropdown (perdrait l'évidence
          visuelle des 3 langues dispo). */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
          <Languages className="size-3" />
          {TOGGLE_HINT[locale]}
        </span>
        <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {(["fr", "en", "de"] as const).map((loc) => {
            const active = locale === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                aria-pressed={active}
                className={
                  active
                    ? "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500/90 to-cyan-500/90 px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-zinc-50 shadow-[0_0_18px_-4px_rgba(167,139,250,0.5)] transition-all"
                    : "inline-flex items-center justify-center rounded-full px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
                }
              >
                {LOCALE_LABEL[loc]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <FaqItem key={idx} q={pair.q[locale]} a={pair.a[locale]} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors open:border-violet-500/20 open:bg-violet-500/[0.04]">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100">
        {q}
        <span className="text-[18px] text-zinc-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-zinc-400">
        {a}
      </p>
    </details>
  );
}
