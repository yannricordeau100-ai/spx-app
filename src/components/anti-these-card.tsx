"use client";

/**
 * anti-these-card.tsx — bloc "Anti-thèse d'investissement" (Yann 14 août 2026).
 *
 * Placé juste APRÈS le bloc Facteurs de risque sur la page sté V1.9.5.
 * Spec : .conv-state/att-spec.md. FR uniquement, pas d'em-dash.
 *
 * Toujours visibles (tous tiers) : titre, badge intensité, dates, hook.
 * Le reste (résumé, sections, glossaire) est réservé au plan Max : pour les
 * autres tiers, le serveur envoie `att.locked = true` SANS le contenu
 * (gateAttForTier) et ce composant rend un placeholder flouté + CTA.
 * Anti-triche : le texte réel n'est jamais dans le HTML des non-abonnés.
 */

import Link from "next/link";
import {
  Scale,
  CalendarDays,
  Landmark,
  Globe2,
  Calculator,
  ShieldCheck,
  BookOpen,
  Lock,
} from "lucide-react";
import type { CompanyAtt, AttArgument, AttQuantitatif } from "@/lib/att";

const INTENSITE_META: Record<
  CompanyAtt["intensite"],
  { label: string; color: string }
> = {
  faible: { label: "Intensité faible", color: "#10b981" },
  moderee: { label: "Intensité modérée", color: "#f59e0b" },
  elevee: { label: "Intensité élevée", color: "#f43f5e" },
};

function formatDateFr(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function SectionTitle({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider" style={{ color }}>
      {icon}
      {children}
    </h3>
  );
}

function ArgumentCard({ arg }: { arg: AttArgument }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="text-[13.5px] font-semibold text-zinc-100">{arg.titre}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">{arg.argument}</p>
      {arg.preuve && (
        <p className="mt-2 border-l-2 border-violet-500/40 pl-2.5 font-mono text-[11px] leading-relaxed text-zinc-500">
          {arg.preuve}
        </p>
      )}
    </div>
  );
}

function QuantCard({ q }: { q: AttQuantitatif }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="text-[13.5px] font-semibold text-zinc-100">{q.titre}</div>
      <div className="mt-1.5 font-mono text-[13px] text-cyan-300">{q.chiffre}</div>
      {q.perspective && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">{q.perspective}</p>
      )}
      {q.source && (
        <p className="mt-2 font-mono text-[11px] text-zinc-500">Source : {q.source}</p>
      )}
    </div>
  );
}

/** Placeholder neutre flouté (aucun contenu réel, texte générique). */
function LockedPlaceholder() {
  const fake =
    "Le contenu détaillé de cette anti-thèse (résumé, arguments fondamentaux internes et externes, lecture quantitative, points qui l'affaibliraient et glossaire) est réservé aux abonnés du plan Max. Chaque argument repose sur un fait vérifiable, chiffré et sourcé dans les documents officiels de la société.";
  return (
    <div className="relative mt-4 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#070707]">
      <div aria-hidden className="select-none p-5 blur-[7px]" style={{ pointerEvents: "none" }}>
        {[0, 1, 2].map((i) => (
          <p key={i} className="mb-4 text-[13px] leading-relaxed text-zinc-400">
            {fake}
          </p>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/30 via-black/55 to-black/75 p-6 text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-300">
          <Lock className="size-4" />
        </span>
        <div className="text-[14px] font-semibold text-zinc-100">Réservé au plan Max</div>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-zinc-400">
          L&apos;anti-thèse complète (arguments sourcés, lecture quantitative,
          points de bascule) est incluse dans le plan Max.
        </p>
        <Link
          href="/pricing"
          className="mt-1 rounded-lg border border-violet-400/50 bg-gradient-to-r from-violet-500/25 to-cyan-500/20 px-4 py-2 text-[12.5px] font-semibold text-violet-200 transition-colors hover:border-violet-300 hover:text-white"
        >
          Découvrir le plan Max
        </Link>
      </div>
    </div>
  );
}

export function AntiTheseCard({
  att,
  accent = "#a78bfa",
}: {
  att: CompanyAtt;
  accent?: string;
}) {
  const meta = INTENSITE_META[att.intensite] ?? INTENSITE_META.moderee;
  const interne = Array.isArray(att.fondamental_interne) ? att.fondamental_interne : [];
  const externe = Array.isArray(att.fondamental_externe) ? att.fondamental_externe : [];
  const quant = Array.isArray(att.quantitatif) ? att.quantitatif : [];
  const affaiblirait = Array.isArray(att.ce_qui_affaiblirait) ? att.ce_qui_affaiblirait : [];
  const glossaire = att.glossaire && typeof att.glossaire === "object"
    ? Object.entries(att.glossaire).filter(([k, v]) => k && typeof v === "string")
    : [];

  return (
    <section id="sec-anti-these" className="mt-9 scroll-mt-24 animate-fade-up-d2">
      {/* Header : titre + badge intensité + dates */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Scale className="size-5" style={{ color: accent }} />
            Anti-thèse d&apos;investissement
            <span
              className="rounded-md px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider"
              style={{
                background: `${meta.color}1a`,
                color: meta.color,
                border: `1px solid ${meta.color}40`,
              }}
            >
              {meta.label}
            </span>
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">
            Les raisons objectives d&apos;être méfiant, figées à date. L&apos;autre côté du dossier.
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          <CalendarDays className="size-3.5" />
          <span>
            Rédigée le {formatDateFr(att.redigee_le)}
            {att.donnees_arretees_au
              ? `, données arrêtées au ${formatDateFr(att.donnees_arretees_au)}`
              : ""}
          </span>
        </div>
      </div>

      {/* Hook : TOUJOURS visible, en clair, mis en valeur */}
      <div
        className="relative overflow-hidden rounded-xl border p-5"
        style={{
          borderColor: "rgba(167, 139, 250, 0.35)",
          background:
            "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(7, 7, 7, 0.9) 45%, rgba(34, 211, 238, 0.08) 100%)",
        }}
      >
        <p className="text-[15.5px] font-medium leading-relaxed text-zinc-100">
          {att.hook}
        </p>
      </div>

      {att.locked ? (
        <LockedPlaceholder />
      ) : (
        <div className="mt-4 grid gap-6">
          {/* Résumé */}
          {att.resume && (
            <p className="text-[13.5px] leading-relaxed text-zinc-300">{att.resume}</p>
          )}

          {/* Fondamental interne */}
          {interne.length > 0 && (
            <div>
              <SectionTitle icon={<Landmark className="size-3.5" />} color="#a78bfa">
                Fondamental interne
              </SectionTitle>
              <div className="grid gap-3">
                {interne.map((a, i) => (
                  <ArgumentCard key={`int-${i}`} arg={a} />
                ))}
              </div>
            </div>
          )}

          {/* Fondamental externe */}
          {externe.length > 0 && (
            <div>
              <SectionTitle icon={<Globe2 className="size-3.5" />} color="#a78bfa">
                Fondamental externe
              </SectionTitle>
              <div className="grid gap-3">
                {externe.map((a, i) => (
                  <ArgumentCard key={`ext-${i}`} arg={a} />
                ))}
              </div>
            </div>
          )}

          {/* Quantitatif */}
          {quant.length > 0 && (
            <div>
              <SectionTitle icon={<Calculator className="size-3.5" />} color="#22d3ee">
                Quantitatif
              </SectionTitle>
              <div className="grid gap-3 md:grid-cols-3">
                {quant.map((q, i) => (
                  <QuantCard key={`q-${i}`} q={q} />
                ))}
              </div>
            </div>
          )}

          {/* Ce qui affaiblirait cette anti-thèse */}
          {affaiblirait.length > 0 && (
            <div>
              <SectionTitle icon={<ShieldCheck className="size-3.5" />} color="#10b981">
                Ce qui affaiblirait cette anti-thèse
              </SectionTitle>
              <ul className="grid gap-2">
                {affaiblirait.map((item, i) => (
                  <li
                    key={`w-${i}`}
                    className="flex items-start gap-2.5 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5 text-[13px] leading-relaxed text-zinc-300"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400/80" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Glossaire (termes marqués d'un astérisque dans les textes) */}
          {glossaire.length > 0 && (
            <div>
              <SectionTitle icon={<BookOpen className="size-3.5" />} color="#71717a">
                Glossaire (termes suivis d&apos;un astérisque)
              </SectionTitle>
              <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 md:grid-cols-2">
                {glossaire.map(([term, def]) => (
                  <div key={term} className="text-[12.5px] leading-relaxed">
                    <dt className="inline font-mono font-semibold text-zinc-200">
                      {term.replace(/\*+$/, "")}
                    </dt>
                    <dd className="inline text-zinc-400"> : {def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
