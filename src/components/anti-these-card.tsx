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
import { InfoTooltip } from "@/components/info-tooltip";
import type { CompanyAtt, AttArgument, AttQuantitatif } from "@/lib/att";

const INTENSITE_META: Record<
  CompanyAtt["intensite"],
  { label: string; color: string }
> = {
  faible: { label: "Intensité faible", color: "#10b981" },
  moderee: { label: "Intensité modérée", color: "#f59e0b" },
  elevee: { label: "Intensité élevée", color: "#f43f5e" },
};

/** Mois + année seulement : "août 2026". Jamais le jour exact. */
function formatMoisAn(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Découpe un paragraphe massif en segments lisibles.
 * Un argument qui enchaîne plusieurs constats séparés par " ; " devient
 * une liste à puces ; sinon on garde le paragraphe tel quel.
 */
function splitEnPoints(texte: string): string[] {
  const parts = texte
    .split(/\s;\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => p.length > 25)) return parts;
  return [texte];
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
    <h3
      className="mb-3 flex items-center gap-2.5 font-mono text-[15px] font-semibold uppercase tracking-[0.14em]"
      style={{ color }}
    >
      {icon}
      {children}
    </h3>
  );
}

/** Corps d'argument : plusieurs constats deviennent des puces. */
function Corps({ texte }: { texte: string }) {
  const points = splitEnPoints(texte);
  if (points.length === 1) {
    return <p className="text-[13px] leading-[1.75] text-zinc-300">{points[0]}</p>;
  }
  return (
    <ul className="grid gap-1.5">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.75] text-zinc-300">
          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-zinc-600" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

/** Le "i" qui porte la preuve verbatim / la source, au niveau du titre. */
function SourceInfo({ label, contenu }: { label: string; contenu: string }) {
  return (
    <InfoTooltip color="#a78bfa" align="right" size="md">
      <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
        {label}
      </div>
      <p className="text-[12px] leading-relaxed text-zinc-300">{contenu}</p>
    </InfoTooltip>
  );
}

function ArgumentCard({ arg }: { arg: AttArgument }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold text-zinc-100">{arg.titre}</div>
        {arg.preuve && <SourceInfo label="Preuve et source" contenu={arg.preuve} />}
      </div>
      <div className="mt-2">
        <Corps texte={arg.argument} />
      </div>
    </div>
  );
}

function QuantCard({ q }: { q: AttQuantitatif }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold text-zinc-100">{q.titre}</div>
        {q.source && <SourceInfo label="Source" contenu={q.source} />}
      </div>
      <div className="mt-1.5 font-mono text-[13px] text-cyan-300">{q.chiffre}</div>
      {q.perspective && (
        <div className="mt-2">
          <Corps texte={q.perspective} />
        </div>
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
            Rédigée en {formatMoisAn(att.redigee_le)}
            {att.donnees_arretees_au
              ? `, sur la base des documents publiés jusqu'en ${formatMoisAn(att.donnees_arretees_au)}`
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
                      {(() => {
                        const t = term.replace(/\*+$/, "").trim();
                        // Majuscule initiale, le reste en minuscules sauf sigles
                        // (BPA, EBITDA, FCF restent tels quels).
                        if (t.length > 5 && t === t.toUpperCase()) {
                          return t.charAt(0) + t.slice(1).toLowerCase();
                        }
                        return t.charAt(0).toUpperCase() + t.slice(1);
                      })()}
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
