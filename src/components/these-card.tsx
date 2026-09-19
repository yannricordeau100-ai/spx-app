"use client";

/**
 * these-card.tsx — bloc « Thèse d'investissement » (Yann 19 sept 2026).
 *
 * Placé juste AVANT l'anti-thèse sur la page société. Miroir de
 * anti-these-card.tsx : titre, badge de conviction, style d'analyse
 * (investisseur célèbre, banque ou méthode reconnue), dates et hook visibles
 * par tous ; le reste réservé au plan Max (these.locked pilote le placeholder).
 * La valorisation est volontairement ignorée, le préambule le dit.
 */

import Link from "next/link";
import {
  Sparkles,
  CalendarDays,
  Landmark,
  Globe2,
  Calculator,
  ShieldAlert,
  BookOpen,
  Lock,
  Compass,
  LineChart,
  Lightbulb,
} from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import type { CompanyThese, TheseArgument, TheseQuantitatif } from "@/lib/these";

const CONVICTION_META: Record<CompanyThese["conviction"], { label: string; color: string }> = {
  faible: { label: "Conviction faible", color: "#f59e0b" },
  moderee: { label: "Conviction modérée", color: "#22d3ee" },
  elevee: { label: "Conviction élevée", color: "#10b981" },
};

const STYLE_LABEL: Record<CompanyThese["style"]["type"], string> = {
  investisseur: "Selon les critères de",
  banque: "Selon la méthode de",
  methode: "Selon la méthode",
};

function formatMoisAn(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function splitEnPoints(texte: string): string[] {
  const parts = texte.split(/\s;\s/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => p.length > 25)) return parts;
  return [texte];
}

function SectionTitle({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2.5 font-mono text-[15px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
      {icon}
      {children}
    </h3>
  );
}

function Corps({ texte }: { texte: string }) {
  const points = splitEnPoints(texte);
  if (points.length === 1) return <p className="text-[13px] leading-[1.75] text-zinc-300">{points[0]}</p>;
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

function SourceInfo({ label, contenu }: { label: string; contenu: string }) {
  return (
    <InfoTooltip color="#10b981" align="right" size="md">
      <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-emerald-300">{label}</div>
      <p className="text-[12px] leading-relaxed text-zinc-300">{contenu}</p>
    </InfoTooltip>
  );
}

function ArgumentCard({ arg }: { arg: TheseArgument }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold text-zinc-100">{arg.titre}</div>
        {arg.preuve && <SourceInfo label="Preuve et source" contenu={arg.preuve} />}
      </div>
      {arg.critere_style && (
        <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-emerald-400/80">Critère : {arg.critere_style}</div>
      )}
      <div className="mt-2">
        <Corps texte={arg.argument} />
      </div>
    </div>
  );
}

function QuantCard({ q }: { q: TheseQuantitatif }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-semibold text-zinc-100">{q.titre}</div>
        {q.source && <SourceInfo label="Source" contenu={q.source} />}
      </div>
      <div className="mt-1.5 font-mono text-[13px] text-emerald-300">{q.chiffre}</div>
      {q.perspective && (
        <div className="mt-2">
          <Corps texte={q.perspective} />
        </div>
      )}
    </div>
  );
}

function LockedPlaceholder() {
  const fake =
    "Le contenu détaillé de cette thèse (résumé, qualité interne, dynamique externe, lecture quantitative, graphique extérieur, élément additionnel et points qui l'invalideraient) est réservé aux abonnés du plan Max. Chaque argument repose sur un fait vérifiable, chiffré et sourcé, confronté aux critères de l'investisseur ou de la méthode choisie.";
  return (
    <div className="relative mt-4 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#070707]">
      <div aria-hidden className="select-none p-5 blur-[7px]" style={{ pointerEvents: "none" }}>
        {[0, 1, 2].map((i) => (
          <p key={i} className="mb-4 text-[13px] leading-relaxed text-zinc-400">{fake}</p>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/30 via-black/55 to-black/75 p-6 text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
          <Lock className="size-4" />
        </span>
        <div className="text-[14px] font-semibold text-zinc-100">Réservé au plan Max</div>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-zinc-400">
          La thèse complète (arguments sourcés, critères de l&apos;investisseur, lecture quantitative, graphique extérieur) est incluse dans le plan Max.
        </p>
        <Link href="/pricing" className="mt-1 rounded-lg border border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 px-4 py-2 text-[12.5px] font-semibold text-emerald-200 transition-colors hover:border-emerald-300 hover:text-white">
          Découvrir le plan Max
        </Link>
      </div>
    </div>
  );
}

export function TheseCard({ these, accent = "#10b981" }: { these: CompanyThese; accent?: string }) {
  const meta = CONVICTION_META[these.conviction] ?? CONVICTION_META.moderee;
  const interne = Array.isArray(these.qualite_interne) ? these.qualite_interne : [];
  const externe = Array.isArray(these.dynamique_externe) ? these.dynamique_externe : [];
  const quant = Array.isArray(these.quantitatif) ? these.quantitatif : [];
  const invaliderait = Array.isArray(these.ce_qui_invaliderait) ? these.ce_qui_invaliderait : [];
  const glossaire = these.glossaire && typeof these.glossaire === "object" ? Object.entries(these.glossaire).filter(([k, v]) => k && typeof v === "string") : [];
  const graphique = these.graphique_externe && (these.graphique_externe.image_dark || these.graphique_externe.image_light) ? these.graphique_externe : null;
  const criteres = Array.isArray(these.style?.criteres) ? these.style.criteres : [];

  return (
    <section id="sec-these" data-blur="these" className="mt-9 scroll-mt-24 animate-fade-up-d2">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 data-blur-part="titre" className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <Sparkles className="size-5" style={{ color: accent }} />
            Thèse d&apos;investissement
            <InfoTooltip color={accent} size="md">
              Pourquoi ce bloc existe : le cas favorable, rédigé avec les mêmes documents officiels et la même exigence de source que l&apos;anti-thèse, mais selon les critères publiés d&apos;un investisseur célèbre, d&apos;une grande banque ou d&apos;une méthode reconnue. La valorisation est volontairement laissée de côté : la thèse juge l&apos;entreprise, pas son prix.
            </InfoTooltip>
            <span className="rounded-md px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider" style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}40` }}>
              {meta.label}
            </span>
          </h2>
          <p className="mt-0.5 text-[13.5px] text-zinc-300">Le cas favorable, figé à date, sans tenir compte du prix.</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          <CalendarDays className="size-3.5" />
          <span>
            Rédigée en {formatMoisAn(these.redigee_le)}
            {these.donnees_arretees_au ? `, sur la base des documents publiés jusqu'en ${formatMoisAn(these.donnees_arretees_au)}` : ""}
          </span>
        </div>
      </div>

      {/* Style d'analyse : toujours visible. */}
      <div data-blur-part="texte" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#1a1a1a] bg-[#070707] px-4 py-3">
        <Compass className="size-4 shrink-0" style={{ color: accent }} />
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{STYLE_LABEL[these.style.type] ?? "Selon"}</span>
        <span className="text-[14px] font-semibold text-zinc-100">{these.style.nom}</span>
        {these.style.justification && <span className="text-[12.5px] text-zinc-400">· {these.style.justification}</span>}
        {criteres.length > 0 && !these.locked && (
          <InfoTooltip color={accent} align="right" size="md">
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-emerald-300">Critères appliqués</div>
            <ul className="grid gap-1 text-[12px] leading-relaxed text-zinc-300">
              {criteres.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </InfoTooltip>
        )}
      </div>

      {these.preambule && (
        <p data-blur-part="texte" className="mb-3 text-[12.5px] italic leading-relaxed text-zinc-400">{these.preambule}</p>
      )}

      <div
        data-blur-part="texte"
        className="relative overflow-hidden rounded-xl border p-5"
        style={{
          borderColor: "rgba(16, 185, 129, 0.35)",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(7, 7, 7, 0.9) 45%, rgba(34, 211, 238, 0.08) 100%)",
        }}
      >
        <p className="text-[15.5px] font-medium leading-relaxed text-zinc-100">{these.hook}</p>
      </div>

      <div data-blur-part="texte">
        {these.locked ? (
          <LockedPlaceholder />
        ) : (
          <div className="mt-4 grid gap-6">
            {these.resume && <p className="text-[13.5px] leading-relaxed text-zinc-300">{these.resume}</p>}

            {interne.length > 0 && (
              <div>
                <SectionTitle icon={<Landmark className="size-3.5" />} color="#10b981">Qualité interne</SectionTitle>
                <div className="grid gap-3">{interne.map((a, i) => <ArgumentCard key={`int-${i}`} arg={a} />)}</div>
              </div>
            )}

            {externe.length > 0 && (
              <div>
                <SectionTitle icon={<Globe2 className="size-3.5" />} color="#10b981">Dynamique externe</SectionTitle>
                <div className="grid gap-3">{externe.map((a, i) => <ArgumentCard key={`ext-${i}`} arg={a} />)}</div>
              </div>
            )}

            {quant.length > 0 && (
              <div>
                <SectionTitle icon={<Calculator className="size-3.5" />} color="#22d3ee">Quantitatif</SectionTitle>
                <div className="grid gap-3 md:grid-cols-3">{quant.map((q, i) => <QuantCard key={`q-${i}`} q={q} />)}</div>
              </div>
            )}

            {graphique && (
              <div>
                <SectionTitle icon={<LineChart className="size-3.5" />} color="#a78bfa">Le regard extérieur</SectionTitle>
                <div className="rounded-xl border border-[#1a1a1a] bg-[#070707] p-4">
                  <div className="text-[13.5px] font-semibold text-zinc-100">{graphique.titre}</div>
                  <div className="mt-3 overflow-hidden rounded-lg">
                    {graphique.image_dark && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={graphique.image_dark} alt={graphique.titre} className="block w-full dark-only" />
                    )}
                    {graphique.image_light && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={graphique.image_light} alt="" aria-hidden className="hidden w-full light-only" />
                    )}
                  </div>
                  {graphique.lecture && <p className="mt-3 text-[13px] leading-[1.75] text-zinc-300">{graphique.lecture}</p>}
                  {graphique.source_date && (
                    <p className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Données au {formatMoisAn(graphique.source_date)}</p>
                  )}
                </div>
              </div>
            )}

            {these.element_additionnel && these.element_additionnel.texte && (
              <div>
                <SectionTitle icon={<Lightbulb className="size-3.5" />} color="#f59e0b">Un élément en plus</SectionTitle>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13.5px] font-semibold text-zinc-100">{these.element_additionnel.titre}</div>
                    {these.element_additionnel.source && <SourceInfo label="Source" contenu={these.element_additionnel.source} />}
                  </div>
                  <div className="mt-2"><Corps texte={these.element_additionnel.texte} /></div>
                </div>
              </div>
            )}

            {invaliderait.length > 0 && (
              <div>
                <SectionTitle icon={<ShieldAlert className="size-3.5" />} color="#f43f5e">Ce qui invaliderait cette thèse</SectionTitle>
                <ul className="grid gap-2">
                  {invaliderait.map((item, i) => (
                    <li key={`w-${i}`} className="flex items-start gap-2.5 rounded-xl border border-[#1a1a1a] bg-[#070707] p-3.5 text-[13px] leading-relaxed text-zinc-300">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-400/80" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {glossaire.length > 0 && (
              <div>
                <SectionTitle icon={<BookOpen className="size-3.5" />} color="#71717a">Glossaire (termes suivis d&apos;un astérisque)</SectionTitle>
                <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 md:grid-cols-2">
                  {glossaire.map(([term, def]) => (
                    <div key={term} className="text-[12.5px] leading-relaxed">
                      <dt className="inline font-mono font-semibold text-zinc-200">{term.replace(/\*+$/, "")}*</dt>
                      <dd className="inline text-zinc-400"> : {def}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
