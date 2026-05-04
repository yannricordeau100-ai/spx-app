"use client";

import { useT } from "@/lib/i18n/provider";

/**
 * HomeFAQ — bloc FAQ en bas de la home.
 *
 * Contenu écrit FROM SCRATCH (4 mai 2026) : aucune copie ni paraphrase de
 * sources externes (baggr.fr ou autres apps invest). Les sujets couverts
 * sont les "topiques universels" de toute app fintech grand public
 * (sécurité, sources, pas-de-conseil, prix, données erronées, etc.) avec
 * un wording 100% Mettrik et un ton investisseur clair.
 *
 * Disclaimers explicites cohérents avec les CG (article 10 statut éditorial,
 * article 11 limitation responsabilité, article 12 délai données) :
 *   - "Pas un service de conseil en investissement" (Q5, Q6)
 *   - "Données peuvent comporter des erreurs" (Q11)
 *   - "Informatif uniquement, vérification chez sources officielles" (Q4)
 *
 * i18n : FR/EN via dictionnaire `faq.*`. Cascade fallback EN pour autres
 * locales tant que pas traduit.
 */
type QA = { q: string; a: string };

function buildItems(t: (k: string) => string): QA[] {
  // 12 questions = couvre 90% des objections d'un investisseur découvrant l'app.
  // Réponses courtes (2-4 phrases), ton direct, vocabulaire accessible.
  const ids = ["what", "data_sources", "freshness", "advice", "scores_trust", "coverage", "free_or_paid", "cancel", "delete", "data_errors", "personal_data", "support"];
  return ids.map((id) => ({
    q: t(`faq.q.${id}`),
    a: t(`faq.a.${id}`),
  }));
}

export function HomeFAQ() {
  const { t } = useT();
  const items = buildItems(t);
  return (
    <section className="mx-auto mt-24 max-w-3xl px-2 sm:mt-32" aria-labelledby="faq-title">
      <h2
        id="faq-title"
        className="mb-2 text-center font-display text-[26px] font-bold tracking-tight text-zinc-50 sm:text-[32px]"
      >
        {t("faq.title")}
      </h2>
      <p className="mb-10 text-center text-[13.5px] text-zinc-400">
        {t("faq.subtitle")}
      </p>

      <div className="space-y-2">
        {items.map((item, i) => (
          // <details> natif = accordéon a11y-friendly, zéro JS, zéro state.
          // Yann préfère composants simples qui survivent sans effort à toute
          // refonte visuelle ultérieure.
          <details
            key={i}
            className="group rounded-xl border border-white/8 bg-white/[0.02] transition-colors open:border-violet-500/30 open:bg-violet-500/[0.04]"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[14.5px] font-medium text-zinc-100 hover:text-white">
              <span>{item.q}</span>
              <span
                className="shrink-0 text-violet-300 transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="px-5 pb-5 pt-1 text-[13.5px] leading-relaxed text-zinc-300">
              {item.a}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5 text-[12.5px] leading-relaxed text-amber-100/90">
        <strong className="text-amber-200">{t("faq.disclaimer.title")}</strong>{" "}
        {t("faq.disclaimer.body")}
      </div>
    </section>
  );
}
