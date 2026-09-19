"use client";

/**
 * anti-these-card.tsx — bloc "Anti-thèse d'investissement" (Yann 14 août 2026).
 *
 * Placé juste APRÈS le bloc Facteurs de risque sur la page société V1.9.5.
 * Spec : .conv-state/att-spec.md. FR uniquement, pas d'em-dash.
 *
 * Toujours visibles (tous tiers) : titre, badge intensité, dates, hook.
 * Le reste (résumé, sections, glossaire) est réservé au plan Max : pour les
 * autres tiers, le serveur envoie `att.locked = true` SANS le contenu
 * (gateAttForTier) et ce composant rend un placeholder flouté + CTA.
 * Anti-triche : le texte réel n'est jamais dans le HTML des non-abonnés.
 *
 * 19 sept 2026 : cadre visuel net autour du bloc entier (teinte violette, en
 * miroir de la teinte émeraude de la thèse) et parties numérotées dans un
 * médaillon avec bandeau de titre, pour voir la délimitation d'un coup d'oeil.
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
  FileText,
} from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import type { CompanyAtt, AttArgument, AttQuantitatif } from "@/lib/att";

/** Teinte du cadre général de l'anti-thèse (la thèse prend l'émeraude). */
const CADRE = "#a78bfa";

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

/**
 * Une partie de l'anti-thèse : médaillon numéroté, bandeau de titre coloré,
 * fine ligne de séparation puis le contenu.
 */
function Partie({
  n,
  icon,
  color,
  titre,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  color: string;
  titre: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#151515] bg-[#050505]">
      <div
        className="flex items-center gap-2.5 border-b px-4 py-2.5"
        style={{
          borderColor: `${color}26`,
          background: `linear-gradient(90deg, ${color}14 0%, rgba(7, 7, 7, 0) 70%)`,
        }}
      >
        <span
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold leading-none"
          style={{ borderColor: `${color}59`, background: `${color}1f`, color }}
        >
          {n}
        </span>
        <h3
          className="flex items-center gap-2 font-mono text-[12.5px] font-semibold uppercase tracking-[0.14em]"
          style={{ color }}
        >
          {icon}
          {titre}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
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

  /* Parties numérotées : l'ordre de cette liste donne les numéros 1, 2, 3... */
  const parties: { key: string; color: string; icon: React.ReactNode; titre: React.ReactNode; contenu: React.ReactNode }[] = [];

  if (att.resume) {
    parties.push({
      key: "resume",
      color: "#a78bfa",
      icon: <FileText className="size-3.5" />,
      titre: "En résumé",
      contenu: <p className="text-[13.5px] leading-relaxed text-zinc-300">{att.resume}</p>,
    });
  }

  if (interne.length > 0) {
    parties.push({
      key: "interne",
      color: "#a78bfa",
      icon: <Landmark className="size-3.5" />,
      titre: "Fondamental interne",
      contenu: (
        <div className="grid gap-3">
          {interne.map((a, i) => (
            <ArgumentCard key={`int-${i}`} arg={a} />
          ))}
        </div>
      ),
    });
  }

  if (externe.length > 0) {
    parties.push({
      key: "externe",
      color: "#c4b5fd",
      icon: <Globe2 className="size-3.5" />,
      titre: "Fondamental externe",
      contenu: (
        <div className="grid gap-3">
          {externe.map((a, i) => (
            <ArgumentCard key={`ext-${i}`} arg={a} />
          ))}
        </div>
      ),
    });
  }

  if (quant.length > 0) {
    parties.push({
      key: "quant",
      color: "#22d3ee",
      icon: <Calculator className="size-3.5" />,
      titre: "Quantitatif",
      contenu: (
        <div className="grid gap-3 md:grid-cols-3">
          {quant.map((q, i) => (
            <QuantCard key={`q-${i}`} q={q} />
          ))}
        </div>
      ),
    });
  }

  if (affaiblirait.length > 0) {
    parties.push({
      key: "affaiblirait",
      color: "#10b981",
      icon: <ShieldCheck className="size-3.5" />,
      titre: "Ce qui affaiblirait cette anti-thèse",
      contenu: (
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
      ),
    });
  }

  if (glossaire.length > 0) {
    parties.push({
      key: "glossaire",
      color: "#71717a",
      icon: <BookOpen className="size-3.5" />,
      titre: "Glossaire (termes suivis d'un astérisque)",
      contenu: (
        <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
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
      ),
    });
  }

  return (
    <section id="sec-anti-these" data-blur="antithese" className="mt-9 scroll-mt-24 animate-fade-up-d2">
      {/* Cadre général du bloc : teinte violette, en miroir de l'émeraude de la thèse. */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: `${CADRE}4d`,
          background: `linear-gradient(180deg, ${CADRE}0d 0%, rgba(7, 7, 7, 0) 260px)`,
        }}
      >
        {/* Bandeau de titre du bloc : titre + badge intensité + dates */}
        <div
          className="flex flex-wrap items-end justify-between gap-2 border-b px-5 py-4 sm:px-6"
          style={{
            borderColor: `${CADRE}33`,
            background: `linear-gradient(90deg, ${CADRE}1a 0%, rgba(7, 7, 7, 0) 70%)`,
          }}
        >
          <div>
            <h2 data-blur-part="titre" className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
              <Scale className="size-5" style={{ color: accent }} />
              Anti-thèse d&apos;investissement
              {/* Yann 18 sept 2026 : « pourquoi ce bloc existe » dans un grand i a cote du titre. */}
              <InfoTooltip color={accent} size="md">
                Pourquoi ce bloc existe : on lit surtout ce qui conforte une position parfois déjà prise, et l&apos;information disponible pousse dans le même sens, puisque ni la société, ni le courtier, ni l&apos;analyste n&apos;ont intérêt à écrire l&apos;inverse. L&apos;anti-thèse force la lecture contraire, avec les mêmes documents officiels et la même exigence de source.
              </InfoTooltip>
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

        <div className="p-5 sm:p-6">
          {/* Hook : TOUJOURS visible, en clair, mis en valeur.
              9 sept 2026 : bloc « antithese » pilotable dans le selecteur de
              floutage (parties titre / texte). */}
          <div
            data-blur-part="texte"
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

          <div data-blur-part="texte">
            {att.locked ? (
              <LockedPlaceholder />
            ) : (
              <div className="mt-4 grid gap-4">
                {parties.map((p, i) => (
                  <Partie key={p.key} n={i + 1} color={p.color} icon={p.icon} titre={p.titre}>
                    {p.contenu}
                  </Partie>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
