"use client";

/**
 * Rangee « Clients · Moat » (9 sept 2026, demande du proprietaire).
 *
 * Deux demi-largeurs sous « Comprendre la societe » :
 *  - gauche : concentration du chiffre d affaires sur les premiers clients
 *    (Cahier docs/cahier/clients/<T>.json), maquette V2 : anneau + clients
 *    nommes, sans le centre vide ;
 *  - droite : Moat, maquette V2 : note (Morningstar, non signee : le « i »
 *    explique « moyenne des entreprises de rating de premier rang ») et carte
 *    « Tendance Mettrik » avec sa justification.
 * Chaque bloc ne garde que ses parties utiles.
 *
 * Floutage (9 sept 2026) : chaque bloc porte son identifiant stable
 * (data-blur="clients" / "moat") et ses parties (data-blur-part), pilotables
 * separement dans /sandbox/admin/floutage-selector ; le texte est caviarde
 * cote serveur (floutage-caviardage.ts). Les donnees viennent de la fiche
 * (company.clients_concentration, company.moat), jamais d un JSON embarque.
 */

import { Shield, Users, TrendingUp, TrendingDown, Equal, Layers } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import type { Company, ClientsConcentration, MoatEntree } from "@/lib/data";

const NIVEAU: Record<string, { cls: string; dot: string }> = {
  Important: { cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100", dot: "#34d399" },
  Moyen: { cls: "border-amber-400/40 bg-amber-500/10 text-amber-100", dot: "#fbbf24" },
  Aucun: { cls: "border-white/10 bg-white/[0.04] text-zinc-400", dot: "#71717a" },
};
const TEND = {
  hausse: { Icon: TrendingUp, c: "#34d399", label: "en amélioration" },
  stable: { Icon: Equal, c: "#71717a", label: "stable" },
  baisse: { Icon: TrendingDown, c: "#f87171", label: "en dégradation" },
} as const;
const CONF: Record<string, string> = { haute: "confiance haute", moyenne: "confiance moyenne", faible: "confiance faible" };

function pctLabel(p: number | "<1" | null | undefined, plafond: boolean): string {
  if (p === null || p === undefined) return "n. c.";
  if (p === "<1") return "< 1 %";
  return `${plafond ? "< " : ""}${p.toLocaleString("fr-FR")} %`;
}

function Entete({ Icon, titre, sous, accent, droite }: { Icon: typeof Users; titre: string; sous: string; accent: string; droite?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}40` }}>
        <Icon className="size-4" style={{ color: accent }} />
      </span>
      <span data-blur-part="titre" className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400">
        {titre} <span className="text-zinc-500">·</span> <span className="text-zinc-300">{sous}</span>
      </span>
      {droite}
    </div>
  );
}

function BlocClients({ c, accent }: { c: ClientsConcentration; accent: string }) {
  const pct = c.top.pct === null || c.top.pct === undefined || c.top.pct === "<1" ? 1 : c.top.pct;
  const p10 = c.top10 && typeof c.top10.pct === "number" ? c.top10.pct : null;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const exercice = c.top.exercice ?? c.top10?.exercice;
  return (
    <div data-blur="clients" className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <Entete
        Icon={Users}
        titre="Clients"
        sous="Concentration du chiffre d’affaires"
        accent={accent}
        droite={exercice ? <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-zinc-500">exercice {exercice}</span> : undefined}
      />
      <div className="mt-3 flex items-start gap-4">
        <svg data-blur-part="graphique" width="92" height="92" viewBox="0 0 92 92" className="shrink-0" aria-hidden>
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          {p10 !== null && (
            <circle cx="46" cy="46" r={r} fill="none" stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="9" strokeDasharray={`${(Math.min(100, p10) / 100) * circ} ${circ}`} transform="rotate(-90 46 46)" strokeLinecap="round" />
          )}
          <circle cx="46" cy="46" r={r} fill="none" stroke={accent} strokeWidth="9" strokeDasharray={`${(Math.min(100, pct) / 100) * circ} ${circ}`} transform="rotate(-90 46 46)" strokeLinecap="round" />
          <text x="46" y="50" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fafafa" fontFamily="JetBrains Mono, monospace">
            {pctLabel(c.top.pct, c.top.plafond)}
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          <div data-blur-part="valeur">
            {c.top.pct !== null && c.top.pct !== undefined && (
              <div className="text-[13px] text-zinc-200">
                <span className="font-semibold" style={{ color: accent }}>{c.top.n === 1 ? "Premier client" : `${c.top.n} premiers clients`}</span> : {pctLabel(c.top.pct, c.top.plafond)} du chiffre d’affaires
              </div>
            )}
            {c.top10 && c.top10.pct !== null && c.top10.pct !== undefined && (
              <div className="mt-0.5 text-[13px] text-zinc-200">
                <span className="font-semibold text-cyan-200">{c.top10.n} plus gros clients</span> : {c.top10.estimation ? "≈ " : ""}{pctLabel(c.top10.pct, c.top10.plafond)}
                {c.top10.estimation && <span className="ml-1 text-[10.5px] text-zinc-500" title={`Estimation (fiabilité ${c.top10.fiabilite ?? "moyenne"}), pas une donnée publiée`}>estimation</span>}
              </div>
            )}
            {c.diffus && (
              <div className="mt-0.5 text-[13px] text-emerald-200">
                <Layers className="mr-1 inline size-3.5" />Base de clients très diffuse
              </div>
            )}
          </div>
          {c.top.clients.length > 0 && (
            <div data-blur-part="noms" className="mt-2 flex flex-wrap gap-1.5">
              {c.top.clients.map((n) => (
                <span key={n} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-px text-[11px] text-zinc-300">{n}</span>
              ))}
            </div>
          )}
          {c.top.commentaire && <p data-blur-part="texte" className="mt-2 text-[11.5px] leading-snug text-zinc-500">{c.top.commentaire}</p>}
        </div>
      </div>
    </div>
  );
}

function BlocMoat({ m, accent }: { m: MoatEntree; accent: string }) {
  const st = NIVEAU[m.niveau] ?? NIVEAU.Aucun!;
  const tendKey = (m.tendance_mettrik ?? m.tendance ?? "stable") as keyof typeof TEND;
  const t = TEND[tendKey] ?? TEND.stable;
  const justification = m.justification_mettrik;
  return (
    <div data-blur="moat" className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${st.dot}66, transparent)` }} />
      <Entete
        Icon={Shield}
        titre="Moat"
        sous="Avantage compétitif"
        accent={accent}
        droite={
          <>
            <span data-blur-part="niveau" className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${st.cls}`}>{m.niveau}</span>
            <InfoTooltip color={accent} size="sm" align="left">
              <p className="text-[12px] leading-relaxed text-zinc-200">Note : moyenne des entreprises de rating de premier rang.</p>
            </InfoTooltip>
          </>
        }
      />
      {m.niveau !== "Aucun" && m.texte && (
        <p data-blur-part="texte" className="mt-2 text-[12.5px] leading-relaxed text-zinc-300">{m.texte}</p>
      )}
      <div data-blur-part="tendance" className="mt-3 rounded-lg border p-3" style={{ borderColor: `${t.c}40`, background: `${t.c}0d` }}>
        <div className="flex items-center gap-2">
          <t.Icon className="size-6 shrink-0" style={{ color: t.c }} />
          <div>
            <div className="text-[13px] font-semibold" style={{ color: t.c }}>Moat {t.label}</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400">
              Évaluation Mettrik{m.confiance_mettrik ? ` · ${CONF[m.confiance_mettrik] ?? m.confiance_mettrik}` : ""}
            </div>
          </div>
        </div>
        {justification && <p className="mt-2 text-[11.5px] leading-snug text-zinc-300">{justification}</p>}
      </div>
    </div>
  );
}

export function MoatClientsRow({
  company,
  accent,
  afficherMoat = true,
  afficherClients = true,
}: {
  company: Company;
  accent: string;
  /** Interrupteurs du controle des blocs (moat, clients). */
  afficherMoat?: boolean;
  afficherClients?: boolean;
}) {
  const clients = afficherClients ? company.clients_concentration : undefined;
  const moat = afficherMoat ? company.moat : undefined;
  if (!clients && !moat) return null;
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {clients && <BlocClients c={clients} accent={accent} />}
      {moat && <BlocMoat m={moat} accent={accent} />}
    </div>
  );
}
