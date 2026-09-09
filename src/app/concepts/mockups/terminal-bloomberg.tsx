"use client";

/**
 * Maquettes « page sté façon terminal » (9 sept 2026, demande du propriétaire).
 *
 * Trois styles inspirés des terminaux de marché, pour choix du DESIGN
 * uniquement : rien n est fonctionnel, les chiffres sont ceux de Microsoft
 * (exercice 2026, 10-K, Cahier) figés au 9 sept 2026. Blocs représentés :
 * en-tête ticker, hero KPI avec graphe, indicateurs clés (avancés / standard),
 * TAM, Moat, concentration clients, unités, anti-thèse, répartition.
 *
 *  V1 · Terminal ambre : fond noir, texte orange et blanc, grille dense,
 *       codes de fonction en haut, séparateurs fins.
 *  V2 · Terminal bleu nuit : panneaux bleu profond, texte blanc et cyan,
 *       onglets de fonctions, tableaux zébrés.
 *  V3 · Terminal Mettrik : la grille dense du terminal, mais avec la
 *       palette violet / cyan de la marque et des barres pleines.
 */

import { useMemo } from "react";

type Theme = {
  bg: string; panel: string; border: string; text: string; dim: string; accent: string; accent2: string; up: string; down: string; head: string; zebra: string; font: string;
};

const THEMES: Record<"ambre" | "bleu" | "mettrik", Theme> = {
  ambre: { bg: "#000000", panel: "#050505", border: "#2a2a2a", text: "#f2f2f2", dim: "#8a8a8a", accent: "#ff9a00", accent2: "#ffd166", up: "#2fdc73", down: "#ff4d4d", head: "#ff9a00", zebra: "#0c0c0c", font: "JetBrains Mono, ui-monospace, Menlo, monospace" },
  bleu: { bg: "#050a16", panel: "#0a1224", border: "#1b2a4a", text: "#eaf1ff", dim: "#7f93b8", accent: "#39c6ff", accent2: "#9fd8ff", up: "#3ee08a", down: "#ff6b6b", head: "#ffffff", zebra: "#0e1830", font: "JetBrains Mono, ui-monospace, Menlo, monospace" },
  mettrik: { bg: "#070707", panel: "#0b0b0f", border: "#26233a", text: "#f4f4f5", dim: "#8b8a9a", accent: "#a78bfa", accent2: "#22d3ee", up: "#34d399", down: "#f87171", head: "#c4b5fd", zebra: "#0f0e16", font: "JetBrains Mono, ui-monospace, Menlo, monospace" },
};

/* Données Microsoft (exercice clos le 30 juin 2026, 10-K ; Cahier Mettrik). */
const HERO = { code: "AZURE_GROWTH", nom: "Croissance Azure (Cloud et IA)", unit: "%", val: "40 %", yoy: "+7 pts", serie: [["Q2 25", 31], ["Q3 25", 33], ["Q4 25", 39], ["Q1 26", 40], ["Q2 26", 39], ["Q3 26", 40]] as [string, number][] };
const AVANCES = [
  ["INTELLIGENT_CLOUD_REV", "Revenu Intelligent Cloud", "39 300", "M $", "+32 %"],
  ["COMMERCIAL_RPO", "Obligations de performance restantes", "678 000", "M $", "+84 %"],
  ["M365_COMMERCIAL_GROWTH", "Croissance M365 Commercial cloud", "19", "%", "+2 pts"],
  ["DYNAMICS365_GROWTH", "Croissance Dynamics 365", "22", "%", "+3 pts"],
  ["LINKEDIN_GROWTH", "Croissance revenus LinkedIn", "12", "%", "+1 pt"],
  ["M365_CONSUMER_SUBS", "Abonnés Microsoft 365 Consumer", "82,5", "M", "+23 %"],
  ["SEARCH_ADS_GROWTH", "Publicité Search et actualités (hors TAC)", "12", "%", "-4 pts"],
  ["XBOX_CONTENT_GROWTH", "Xbox contenu et services", "-5", "%", "-6 pts"],
];
const STANDARD = [
  ["TOTAL_REVENUE", "Chiffre d’affaires (T4 FY26)", "90,0", "Mds $", "+18 %"],
  ["OP_MARGIN", "Marge opérationnelle", "45,1", "%", "+0,2 pt"],
  ["NET_INCOME", "Résultat net (T4 FY26)", "35,8", "Mds $", "+31 %"],
  ["EPS_DIL", "BPA dilué (T3 FY26)", "4,27", "$", "+23 %"],
  ["FCF", "Flux de trésorerie libre (T4 FY26)", "19,6", "Mds $", "-23 %"],
  ["HEADCOUNT", "Effectifs", "223", "k", "-2 %"],
];
const TAM = { segment: "Intelligent Cloud", rev: 137.8, tam: 419, marche: "Services d’infrastructure en nuage (2025)", part: 21, croissance: 30 };
const MOAT = { niveau: "Important", texte: "L’imbrication entre système d’exploitation, bureautique et cloud rend le changement de fournisseur coûteux, prolongée par l’écosystème de partenaires.", tendance: "en amélioration", justif: "Carnet commercial doublé à 627 Mds $, activité IA +123 %, cloud +29 %." };
const CLIENTS = { top1: "< 10 %", top10: "≈ 15 %", est: true, exercice: "2026" };
const UNITES = [
  ["M $", "Millions de dollars", "Monnaies"],
  ["Mds $", "Milliards de dollars", "Monnaies"],
  ["%", "Pourcentage", "Ratios"],
  ["pts", "Points de pourcentage", "Ratios"],
  ["M", "Millions d’abonnés", "Clients"],
  ["k", "Milliers de personnes", "Effectifs"],
];
// T4 FY26 : 39,3 + 37,8 + 12,9 = 90,0 Mds $.
const REPARTITION = [["Intelligent Cloud", 43.7], ["Productivity & Business", 42.0], ["More Personal Computing", 14.3]] as [string, number][];
const ANTITHESE = ["Capex 2026 en forte hausse pour l’IA : le retour sur ces investissements n’est pas encore démontré.", "Concentration du carnet cloud sur quelques très grands contrats d’IA.", "Pression réglementaire (Union européenne, FTC) sur les offres groupées."];

function Sparkline({ serie, t, fill = false }: { serie: [string, number][]; t: Theme; fill?: boolean }) {
  const W = 420, H = 120, p = 18;
  const vals = serie.map((s) => s[1]);
  const min = Math.min(...vals) - 4, max = Math.max(...vals) + 4;
  const pts = serie.map((s, i) => [p + (i * (W - 2 * p)) / (serie.length - 1), H - p - ((s[1] - min) / (max - min)) * (H - 2 * p)] as [number, number]);
  const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full">
      {[0, 1, 2, 3].map((k) => <line key={k} x1={p} x2={W - p} y1={p + (k * (H - 2 * p)) / 3} y2={p + (k * (H - 2 * p)) / 3} stroke={t.border} strokeDasharray="2 4" />)}
      {fill && <path d={`${d} L${pts[pts.length - 1]![0]},${H - p} L${pts[0]![0]},${H - p} Z`} fill={t.accent} opacity="0.12" />}
      <path d={d} fill="none" stroke={t.accent} strokeWidth="2" />
      {pts.map((q, i) => (
        <g key={i}>
          <circle cx={q[0]} cy={q[1]} r="2.5" fill={t.accent2} />
          <text x={q[0]} y={q[1] - 7} textAnchor="middle" fontSize="9" fill={t.text} fontFamily={t.font}>{serie[i]![1]}</text>
          <text x={q[0]} y={H - 4} textAnchor="middle" fontSize="8.5" fill={t.dim} fontFamily={t.font}>{serie[i]![0]}</text>
        </g>
      ))}
    </svg>
  );
}

function Bars({ serie, t }: { serie: [string, number][]; t: Theme }) {
  const W = 420, H = 120, p = 18;
  const max = Math.max(...serie.map((s) => s[1])) + 4;
  const bw = (W - 2 * p) / serie.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full">
      {serie.map((s, i) => {
        const h = ((s[1]) / max) * (H - 2 * p);
        return (
          <g key={i}>
            <rect x={p + i * bw + bw * 0.2} y={H - p - h} width={bw * 0.6} height={h} fill={i === serie.length - 1 ? t.accent2 : t.accent} opacity={i === serie.length - 1 ? 1 : 0.75} />
            <text x={p + i * bw + bw / 2} y={H - p - h - 4} textAnchor="middle" fontSize="9" fill={t.text} fontFamily={t.font}>{s[1]}</text>
            <text x={p + i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize="8.5" fill={t.dim} fontFamily={t.font}>{s[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Panel({ t, code, titre, children, className = "" }: { t: Theme; code: string; titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col ${className}`} style={{ background: t.panel, border: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: `1px solid ${t.border}`, background: t.zebra }}>
        <span className="text-[10px] font-bold tracking-widest" style={{ color: t.accent, fontFamily: t.font }}>{code}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: t.head, fontFamily: t.font }}>{titre}</span>
        <span className="ml-auto text-[9.5px]" style={{ color: t.dim, fontFamily: t.font }}>10-K FY26</span>
      </div>
      <div className="flex-1 p-2.5">{children}</div>
    </section>
  );
}

function Tableau({ t, lignes, zebra = true }: { t: Theme; lignes: string[][]; zebra?: boolean }) {
  return (
    <table className="w-full border-collapse text-[11.5px]" style={{ fontFamily: t.font }}>
      <thead>
        <tr style={{ color: t.dim }}>
          {["CODE", "INDICATEUR", "VALEUR", "UNITÉ", "VAR N-1"].map((h) => <th key={h} className="pb-1 text-left font-medium" style={{ borderBottom: `1px solid ${t.border}` }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={l[0]} style={{ background: zebra && i % 2 ? t.zebra : "transparent", color: t.text }}>
            <td className="py-[3px] pr-2" style={{ color: t.accent }}>{l[0]}</td>
            <td className="py-[3px] pr-2">{l[1]}</td>
            <td className="py-[3px] pr-2 text-right tabular-nums font-semibold">{l[2]}</td>
            <td className="py-[3px] pr-2" style={{ color: t.dim }}>{l[3]}</td>
            <td className="py-[3px] text-right tabular-nums" style={{ color: l[4]!.startsWith("-") ? t.down : t.up }}>{l[4]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Terminal({ variante }: { variante: keyof typeof THEMES }) {
  const t = THEMES[variante];
  const fonctions = useMemo(() => ["DES", "KPI", "FA", "TAM", "MOAT", "CLI", "UNIT", "ATT", "SEG", "GO"], []);
  const heroChart = variante === "mettrik" ? <Bars serie={HERO.serie} t={t} /> : <Sparkline serie={HERO.serie} t={t} fill={variante === "bleu"} />;
  return (
    <div className="overflow-hidden rounded-md" style={{ background: t.bg, color: t.text, fontFamily: t.font, border: `1px solid ${t.border}` }}>
      {/* Barre de commande */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px]" style={{ background: t.zebra, borderBottom: `1px solid ${t.border}` }}>
        <span className="font-bold" style={{ color: t.accent }}>MSFT US Equity</span>
        <span>Microsoft Corp</span>
        <span style={{ color: t.dim }}>NASDAQ GS · Technologie · Logiciels (45103010)</span>
        <span className="ml-auto" style={{ color: t.dim }}>Cours et capitalisation : bandeau prix existant (valeurs à jour)</span>
        <span style={{ color: t.dim }}>09/09/26 16:00</span>
      </div>
      <div className="flex flex-wrap gap-1 px-3 py-1.5 text-[10px]" style={{ borderBottom: `1px solid ${t.border}` }}>
        {fonctions.map((f, i) => (
          <span key={f} className="px-2 py-0.5" style={{ background: i === 1 ? t.accent : "transparent", color: i === 1 ? "#000" : t.accent, border: `1px solid ${i === 1 ? t.accent : t.border}` }}>{i + 1}) {f}</span>
        ))}
        <span className="ml-auto" style={{ color: t.dim }}>Anti-thèse rédigée 08/26 · Synchro 10-K FY26 à jour</span>
      </div>

      <div className="grid gap-px p-px lg:grid-cols-12" style={{ background: t.border }}>
        {/* Hero */}
        <Panel t={t} code="KPI" titre="Hero KPI" className="lg:col-span-8">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-[200px]">
              <div className="text-[10px]" style={{ color: t.dim }}>{HERO.code}</div>
              <div className="text-[13px] font-semibold">{HERO.nom}</div>
              <div className="mt-2 text-[40px] font-bold leading-none tabular-nums" style={{ color: t.accent2 }}>{HERO.val}</div>
              <div className="mt-1 text-[11px]"><span style={{ color: t.up }}>▲ {HERO.yoy}</span> <span style={{ color: t.dim }}>vs N-1 · trimestriel</span></div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px]" style={{ color: t.dim }}>
                <span>Qualité</span><span style={{ color: t.text }}>Excellent</span>
                <span>CAGR 3 ans</span><span style={{ color: t.text }}>+8,4 pts</span>
                <span>Percentile</span><span style={{ color: t.text }}>Top 5 % logiciels</span>
                <span>Source</span><span style={{ color: t.text }}>Communiqué T4 FY26</span>
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <div className="mb-1 flex gap-1 text-[10px]">
                {["1A", "3A", "5A", "MAX", "T", "A"].map((x, i) => <span key={x} className="px-1.5" style={{ border: `1px solid ${t.border}`, color: i === 0 || i === 4 ? t.accent : t.dim }}>{x}</span>)}
              </div>
              {heroChart}
            </div>
          </div>
          <div className="mt-2 grid gap-1 text-[11px] sm:grid-cols-4" style={{ borderTop: `1px solid ${t.border}`, paddingTop: 6 }}>
            {[["LEAD", "Azure accélère pour le 3e trimestre de suite, porté par l’IA."], ["MOTEUR", "Capacité livrée et carnet commercial record."], ["VIGILANCE", "Capex 2026 en forte hausse."], ["VEILLE", "Cadence des mises en service de centres de données."]].map(([k, v]) => (
              <div key={k}><span style={{ color: t.accent }}>{k}</span> <span style={{ color: t.dim }}>{v}</span></div>
            ))}
          </div>
        </Panel>

        {/* Répartition + TAM */}
        <Panel t={t} code="SEG" titre="Répartition du CA" className="lg:col-span-4">
          {REPARTITION.map(([n, v]) => (
            <div key={n} className="mb-1.5 text-[11px]">
              <div className="flex justify-between"><span>{n}</span><span className="tabular-nums" style={{ color: t.accent2 }}>{v.toLocaleString("fr-FR")} %</span></div>
              <div className="h-[6px] w-full" style={{ background: t.zebra }}><div className="h-full" style={{ width: `${v}%`, background: t.accent }} /></div>
            </div>
          ))}
          <div className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: t.dim }}>TAM · position marché</div>
          <div className="mt-1 text-[11px]">{TAM.segment} <span style={{ color: t.dim }}>{TAM.rev} Mds $</span> / {TAM.marche} <span style={{ color: t.dim }}>{TAM.tam} Mds $</span></div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: t.accent2 }}>{TAM.part} %</span>
            <span className="text-[10.5px]" style={{ color: t.dim }}>part captée · marché +{TAM.croissance} %/an · fiabilité haute</span>
          </div>
          <div className="mt-1 h-[8px] w-full" style={{ background: t.zebra }}><div className="h-full" style={{ width: `${TAM.part}%`, background: t.accent2 }} /></div>
        </Panel>

        {/* KPI avancés */}
        <Panel t={t} code="KPI" titre="Indicateurs clés · KPI avancés" className="lg:col-span-7">
          <Tableau t={t} lignes={AVANCES} />
          <div className="mt-2 text-[10.5px]" style={{ color: t.accent }}>▸ Voir 6 KPI standard</div>
          <div className="mt-1 opacity-70"><Tableau t={t} lignes={STANDARD.slice(0, 3)} zebra={false} /></div>
        </Panel>

        {/* Moat + clients */}
        <div className="grid gap-px lg:col-span-5" style={{ background: t.border }}>
          <Panel t={t} code="MOAT" titre="Avantage compétitif">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-1.5 py-px font-bold" style={{ background: t.up, color: "#000" }}>{MOAT.niveau}</span>
              <span style={{ color: t.up }}>▲ Moat {MOAT.tendance}</span>
              <span style={{ color: t.dim }}>· confiance haute</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug" style={{ color: t.text }}>{MOAT.texte}</p>
            <p className="mt-1 text-[10.5px] leading-snug" style={{ color: t.dim }}>Évaluation Mettrik : {MOAT.justif}</p>
          </Panel>
          <Panel t={t} code="CLI" titre="Concentration clients">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><div style={{ color: t.dim }}>Premier client</div><div className="text-[20px] font-bold" style={{ color: t.accent2 }}>{CLIENTS.top1}</div></div>
              <div><div style={{ color: t.dim }}>10 plus gros clients</div><div className="text-[20px] font-bold" style={{ color: t.accent }}>{CLIENTS.top10}</div><div className="text-[9.5px]" style={{ color: t.dim }}>estimation · fiabilité moyenne</div></div>
            </div>
            <div className="mt-1 text-[10.5px]" style={{ color: t.dim }}>Base de clients très diffuse · exercice {CLIENTS.exercice}</div>
          </Panel>
        </div>

        {/* Unités */}
        <Panel t={t} code="UNIT" titre="Comprendre les unités de cette fiche" className="lg:col-span-5">
          <div className="grid gap-1 text-[11px]">
            {UNITES.map(([u, n, c]) => (
              <div key={u} className="flex items-baseline gap-2 px-1.5 py-[3px]" style={{ borderLeft: `3px solid ${t.accent}`, background: t.zebra }}>
                <span className="w-14 font-bold" style={{ color: t.accent2 }}>{u}</span>
                <span>{n}</span>
                <span className="ml-auto text-[9.5px] uppercase tracking-wider" style={{ color: t.dim }}>{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[10px]" style={{ color: t.accent }}>▸ Voir tout le relevé (1 289 unités)</div>
        </Panel>

        {/* Anti-thèse */}
        <Panel t={t} code="ATT" titre="Anti-thèse d’investissement" className="lg:col-span-7">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-1.5 py-px font-bold" style={{ background: t.accent, color: "#000" }}>Modérée</span>
            <span style={{ color: t.dim }}>rédigée en août 2026, documents jusqu’en juillet 2026</span>
          </div>
          <ul className="mt-1.5 space-y-1 text-[11px]">
            {ANTITHESE.map((a) => <li key={a} className="flex gap-2"><span style={{ color: t.down }}>■</span><span>{a}</span></li>)}
          </ul>
        </Panel>
      </div>
      <div className="flex justify-between px-3 py-1.5 text-[9.5px]" style={{ background: t.zebra, borderTop: `1px solid ${t.border}`, color: t.dim }}>
        <span>Mettrik AI · KPI Intelligence · données 10-K et communiqués officiels, jamais de valeur inventée</span>
        <span>F1 aide · F8 comparer · F10 exporter</span>
      </div>
    </div>
  );
}

export function MockupTerminalBloomberg() {
  return (
    <div className="space-y-14 px-4 pb-16 pt-6">
      <p className="mx-auto max-w-3xl text-center text-[13px] text-zinc-400">
        Trois styles « terminal de marché » pour la page sté, à partir de Microsoft (exercice 2026). Design uniquement : rien n’est cliquable, les blocs (hero, KPI avancés et standard, TAM, Moat, clients, unités, anti-thèse, répartition) sont représentés en grille dense.
      </p>
      {([
        ["V1 · Terminal ambre : noir, orange et blanc, grille dense, codes de fonction", "ambre"],
        ["V2 · Terminal bleu nuit : panneaux bleu profond, blanc et cyan, courbe remplie", "bleu"],
        ["V3 · Terminal Mettrik : même grille, palette violet et cyan de la marque, barres pleines", "mettrik"],
      ] as const).map(([titre, v]) => (
        <section key={v}>
          <h3 className="mb-2 text-center font-display text-[16px] font-bold text-zinc-100">{titre}</h3>
          <Terminal variante={v} />
        </section>
      ))}
    </div>
  );
}
