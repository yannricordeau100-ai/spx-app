"use client";

/**
 * Maquettes (8 sept 2026) : integration de la TENDANCE DU MOAT evaluee par
 * Mettrik dans le bandeau « Moat · Avantage compétitif » de la fiche
 * (company-profile-card.tsx, MoatStrip). Trois variantes, pour choix du
 * proprietaire avant pose. La note (Wide / Narrow / None) reste celle de
 * Morningstar ; la tendance et sa justification sont l evaluation Mettrik,
 * et sont marquees comme telles.
 */

import { useState } from "react";
import { Shield, TrendingUp, TrendingDown, Equal, Sparkles } from "lucide-react";

type Ex = { ticker: string; nom: string; niveau: "Important" | "Moyen" | "Aucun"; tendance: "hausse" | "stable" | "baisse"; justification: string; confiance: "haute" | "moyenne" | "faible"; texte: string };

const EXEMPLES: Ex[] = [
  { ticker: "NVDA", nom: "NVIDIA", niveau: "Important", tendance: "hausse", confiance: "haute", justification: "Demande data center toujours en accélération, écosystème CUDA verrouillé, risques concurrentiels stables : l'avantage se renforce.", texte: "Avantage bâti sur l'écosystème logiciel CUDA, l'avance technologique des accélérateurs et les coûts de changement des clients cloud." },
  { ticker: "NKE", nom: "Nike", niveau: "Important", tendance: "baisse", confiance: "moyenne", justification: "Ventes directes en recul, concurrence des marques de course en hausse, risque distribution aggravé : l'avantage de marque s'érode.", texte: "Avantage fondé sur la marque, la distribution mondiale et le marketing sportif." },
  { ticker: "ADP", nom: "Automatic Data Processing", niveau: "Important", tendance: "stable", confiance: "haute", justification: "Rétention clients toujours supérieure à 92 %, revenus récurrents en croissance régulière, aucun risque en aggravation : avantage inchangé.", texte: "Avantage bâti sur les coûts de changement élevés de la paie externalisée et l'échelle du traitement." },
];

const NIVEAU: Record<string, { cls: string; dot: string }> = {
  Important: { cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100", dot: "#34d399" },
  Moyen: { cls: "border-amber-400/40 bg-amber-500/10 text-amber-100", dot: "#fbbf24" },
  Aucun: { cls: "border-white/10 bg-white/[0.04] text-zinc-400", dot: "#71717a" },
};
const TEND = {
  hausse: { Icon: TrendingUp, c: "#34d399", label: "en amélioration" },
  stable: { Icon: Equal, c: "#71717a", label: "stable" },
  baisse: { Icon: TrendingDown, c: "#f87171", label: "en dégradation" },
};
const CONF: Record<string, string> = { haute: "confiance haute", moyenne: "confiance moyenne", faible: "confiance faible" };

function Entete({ e, accent }: { e: Ex; accent: string }) {
  const st = NIVEAU[e.niveau]!;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}40` }}>
        <Shield className="size-4" style={{ color: accent }} />
      </span>
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400">
        Moat <span className="text-zinc-500">·</span> <span className="text-zinc-300">Avantage compétitif</span>
      </span>
      <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${st.cls}`}>{e.niveau}</span>
    </div>
  );
}

/** V1 : pastille tendance signée Mettrik dans la ligne d en-tête + justification en dessous du texte. */
function V1({ e, accent }: { e: Ex; accent: string }) {
  const t = TEND[e.tendance]; const st = NIVEAU[e.niveau]!;
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${st.dot}66, transparent)` }} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Entete e={e} accent={accent} />
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider" style={{ color: t.c, background: `${t.c}14`, boxShadow: `inset 0 0 0 1px ${t.c}33` }} title={`Évaluation Mettrik, ${CONF[e.confiance]}`}>
          <t.Icon className="size-3.5" />
          {t.label}
          <span className="ml-1 rounded-sm bg-white/10 px-1 text-[8.5px] tracking-[0.12em] text-zinc-300">éval. Mettrik</span>
        </span>
      </div>
      <p className="mt-2 pl-11 text-[12.5px] leading-relaxed text-zinc-300">{e.texte}</p>
      <p className="mt-1.5 pl-11 text-[12px] leading-relaxed text-zinc-400">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: t.c }}>Tendance, évaluation Mettrik · </span>{e.justification}
      </p>
    </div>
  );
}

/** V2 : deux colonnes, gauche Morningstar (note + texte), droite carte « Tendance Mettrik » avec grande flèche. */
function V2({ e, accent }: { e: Ex; accent: string }) {
  const t = TEND[e.tendance]; const st = NIVEAU[e.niveau]!;
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${st.dot}66, transparent)` }} />
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <Entete e={e} accent={accent} />
          <p className="mt-2 pl-11 text-[12.5px] leading-relaxed text-zinc-300">{e.texte}</p>
          <p className="mt-1 pl-11 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Note : Morningstar</p>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: `${t.c}40`, background: `${t.c}0d` }}>
          <div className="flex items-center gap-2">
            <t.Icon className="size-6" style={{ color: t.c }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: t.c }}>Moat {t.label}</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400">Évaluation Mettrik · {CONF[e.confiance]}</div>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-zinc-300">{e.justification}</p>
        </div>
      </div>
    </div>
  );
}

/** V3 : frise passé récent → présent → futur proche, avec la flèche Mettrik sur le dernier segment ; justification au survol et en dessous. */
function V3({ e, accent }: { e: Ex; accent: string }) {
  const t = TEND[e.tendance]; const st = NIVEAU[e.niveau]!;
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${st.dot}66, transparent)` }} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Entete e={e} accent={accent} />
        <button onClick={() => setOuvert((v) => !v)} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">passé</span>
          <span className="h-px w-6 bg-zinc-600" />
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">présent</span>
          <span className="h-px w-6" style={{ background: t.c }} />
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider" style={{ color: t.c }}><t.Icon className="size-3.5" />{t.label}</span>
          <Sparkles className="size-3 text-violet-300" />
        </button>
      </div>
      <p className="mt-2 pl-11 text-[12.5px] leading-relaxed text-zinc-300">{e.texte}</p>
      {ouvert && (
        <div className="mt-2 ml-11 rounded-lg border border-violet-400/25 bg-violet-500/[0.06] px-3 py-2 text-[12px] text-zinc-200">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-violet-200">Évaluation Mettrik (pas Morningstar) · {CONF[e.confiance]} · </span>{e.justification}
        </div>
      )}
    </div>
  );
}

export function MockupMoatTendance() {
  const accent = "#a78bfa";
  return (
    <div className="space-y-10">
      <p className="text-[13px] text-zinc-400">
        Trois façons d’afficher la tendance du moat évaluée par Mettrik dans le bandeau existant de la fiche. La note (Important / Moyen / Aucun) reste Morningstar ; la tendance et la phrase sont Mettrik, et signées comme telles.
      </p>
      {[["V1 · pastille signée + phrase sous le texte", V1], ["V2 · carte Tendance Mettrik à droite", V2], ["V3 · frise passé / présent / futur, justification au clic", V3]].map(([titre, C]) => (
        <section key={String(titre)}>
          <h3 className="mb-3 font-display text-[16px] font-bold text-zinc-100">{String(titre)}</h3>
          <div className="space-y-3">
            {EXEMPLES.map((e) => {
              const Comp = C as ({ e, accent }: { e: Ex; accent: string }) => React.ReactElement;
              return <Comp key={e.ticker} e={e} accent={accent} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
