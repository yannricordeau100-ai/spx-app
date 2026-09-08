"use client";

/**
 * Maquettes (8 sept 2026) : bloc « Concentration clients » sur la fiche,
 * a partir des donnees du Cahier (docs/cahier/clients/<T>.json) :
 *  - top : part du ou des tout premiers clients (1 a 3), avec plafond possible
 *    (« aucun client ne depasse 10 % ») ;
 *  - top10 : part des 6 a 10 plus gros clients ;
 *  - diffus : base de clients tres eclatee (grand public, distribution).
 * Trois variantes pour choix du proprietaire avant pose sur les fiches.
 */

import { Users, ShieldAlert, Layers, CircleHelp } from "lucide-react";

type Ex = {
  ticker: string; nom: string;
  top: { n: number; pct: number | "<1" | null; plafond: boolean; clients: string[]; exercice: string; commentaire: string };
  top10: { n: number; pct: number | null; plafond: boolean; exercice: string; commentaire: string } | null;
  diffus: boolean;
};

const EXEMPLES: Ex[] = [
  { ticker: "AAPL", nom: "Apple", diffus: false, top: { n: 1, pct: 10, plafond: true, clients: [], exercice: "2025", commentaire: "Aucun client ne dépasse 10 % des ventes nettes (10-K 2025)." }, top10: null },
  { ticker: "TSM", nom: "TSMC", diffus: false, top: { n: 2, pct: 38, plafond: false, clients: ["Apple", "NVIDIA"], exercice: "2025", commentaire: "Le premier client pèse 24 % et le second 14 % du chiffre d'affaires (rapport annuel 2025)." }, top10: { n: 10, pct: 71, plafond: false, exercice: "2025", commentaire: "Les dix premiers clients représentent 71 % du chiffre d'affaires." } },
  { ticker: "MC.PA", nom: "LVMH", diffus: true, top: { n: 1, pct: "<1", plafond: false, clients: [], exercice: "2025", commentaire: "Ventes au consommateur final dans plus de 6 000 magasins : aucun client significatif." }, top10: null },
];

function pctLabel(p: number | "<1" | null, plafond: boolean) {
  if (p === null) return "n. c.";
  if (p === "<1") return "< 1 %";
  return `${plafond ? "< " : ""}${p.toLocaleString("fr-FR")} %`;
}

function Entete({ e, accent }: { e: Ex; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}40` }}>
        <Users className="size-4" style={{ color: accent }} />
      </span>
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400">
        Clients <span className="text-zinc-500">·</span> <span className="text-zinc-300">Concentration du chiffre d’affaires</span>
      </span>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-zinc-500">{e.ticker} · exercice {e.top.exercice}</span>
    </div>
  );
}

/** V1 : deux jauges horizontales (top 1-3, top 6-10) + lecture investisseur. */
function V1({ e, accent }: { e: Ex; accent: string }) {
  const jauge = (label: string, sub: string, pct: number | "<1" | null, plafond: boolean, color: string) => {
    const v = pct === null ? 0 : pct === "<1" ? 1 : pct;
    return (
      <div className="rounded-lg border border-white/[0.06] px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-medium text-zinc-200">{label}</span>
          <span className="font-mono text-[15px] font-bold" style={{ color }}>{pctLabel(pct, plafond)}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
      </div>
    );
  };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <Entete e={e} accent={accent} />
      {e.diffus ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-2 text-[12.5px] text-emerald-100">
          <Layers className="size-4" /> Base de clients très diffuse : aucun client ne pèse plus de 1 % du chiffre d’affaires. Risque de dépendance quasi nul.
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {jauge(e.top.n === 1 ? "Premier client" : `${e.top.n} premiers clients`, e.top.clients.length ? e.top.clients.join(", ") : e.top.plafond ? "plafond publié par la société" : "noms non publiés", e.top.pct, e.top.plafond, accent)}
          {e.top10 ? jauge(`${e.top10.n} plus gros clients`, e.top10.plafond ? "plafond publié" : "part cumulée publiée", e.top10.pct, e.top10.plafond, "#22d3ee") : jauge("10 plus gros clients", "non publié par la société", null, false, "#71717a")}
        </div>
      )}
      <p className="mt-2 pl-11 text-[12px] leading-relaxed text-zinc-400">{e.top.commentaire}{e.top10 ? ` ${e.top10.commentaire}` : ""}</p>
    </div>
  );
}

/** V2 : anneau de concentration (premiers clients / reste) + chips des clients nommes. */
function V2({ e, accent }: { e: Ex; accent: string }) {
  const pct = e.top.pct === null || e.top.pct === "<1" ? 1 : e.top.pct;
  const p10 = e.top10?.pct ?? null;
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-transparent to-transparent p-3.5">
      <Entete e={e} accent={accent} />
      <div className="mt-3 flex flex-wrap items-center gap-5 pl-1">
        <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0">
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          {p10 !== null && <circle cx="46" cy="46" r={r} fill="none" stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="9" strokeDasharray={`${(p10 / 100) * c} ${c}`} transform="rotate(-90 46 46)" strokeLinecap="round" />}
          <circle cx="46" cy="46" r={r} fill="none" stroke={accent} strokeWidth="9" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 46 46)" strokeLinecap="round" />
          <text x="46" y="50" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fafafa" fontFamily="JetBrains Mono, monospace">{pctLabel(e.top.pct, e.top.plafond)}</text>
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-zinc-200"><span className="font-semibold" style={{ color: accent }}>{e.top.n === 1 ? "Premier client" : `${e.top.n} premiers clients`}</span> : {pctLabel(e.top.pct, e.top.plafond)} du chiffre d’affaires</div>
          {e.top10 && <div className="mt-0.5 text-[13px] text-zinc-200"><span className="font-semibold text-cyan-200">{e.top10.n} plus gros clients</span> : {pctLabel(e.top10.pct, e.top10.plafond)}</div>}
          {e.diffus && <div className="mt-0.5 text-[13px] text-emerald-200"><Layers className="mr-1 inline size-3.5" />Base très diffuse</div>}
          {e.top.clients.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{e.top.clients.map((n) => <span key={n} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-px text-[11px] text-zinc-300">{n}</span>)}</div>
          )}
          <p className="mt-2 text-[11.5px] leading-snug text-zinc-500">{e.top.commentaire}</p>
        </div>
      </div>
    </div>
  );
}

/** V3 : bandeau compact une ligne (niveau de risque + chiffres), details au survol du « i ». */
function V3({ e, accent }: { e: Ex; accent: string }) {
  const pct = e.top.pct === null || e.top.pct === "<1" ? 0 : e.top.pct;
  const niveau = e.diffus || pct < 10 ? { l: "Dépendance faible", c: "#34d399", I: Layers } : pct < 25 ? { l: "Dépendance modérée", c: "#fbbf24", I: Users } : { l: "Dépendance forte", c: "#f87171", I: ShieldAlert };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
      <span className="grid size-7 place-items-center rounded-md" style={{ background: `${niveau.c}1a` }}><niveau.I className="size-4" style={{ color: niveau.c }} /></span>
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-400">Clients</span>
      <span className="rounded-full border px-2 py-px text-[11.5px] font-semibold" style={{ color: niveau.c, borderColor: `${niveau.c}55`, background: `${niveau.c}12` }}>{niveau.l}</span>
      <span className="text-[12.5px] text-zinc-300">{e.top.n === 1 ? "1er client" : `${e.top.n} premiers`} <b className="font-mono" style={{ color: accent }}>{pctLabel(e.top.pct, e.top.plafond)}</b></span>
      {e.top10 && <span className="text-[12.5px] text-zinc-300">top {e.top10.n} <b className="font-mono text-cyan-200">{pctLabel(e.top10.pct, e.top10.plafond)}</b></span>}
      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500" title={`${e.top.commentaire}${e.top10 ? ` ${e.top10.commentaire}` : ""}`}><CircleHelp className="size-3.5" /> détail</span>
    </div>
  );
}

export function MockupClientsConcentration() {
  const accent = "#a78bfa";
  return (
    <div className="space-y-10">
      <p className="text-[13px] text-zinc-400">
        Trois façons d’afficher la concentration clients (premiers clients, dix plus gros, base diffuse) sur la fiche, à partir du Cahier. Exemples : plafond publié (Apple), concentration forte (TSMC), base diffuse (LVMH).
      </p>
      {[["V1 · deux jauges + lecture", V1], ["V2 · anneau de concentration + clients nommés", V2], ["V3 · bandeau compact une ligne", V3]].map(([titre, C]) => (
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
