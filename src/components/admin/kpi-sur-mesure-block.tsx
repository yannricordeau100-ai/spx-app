"use client";

/**
 * Bloc ADMIN « KPI admin sur-mesure » (mission Yann, 1er oct 2026).
 * Memes consignes, design et ergonomie que le bloc KPI moyen terme
 * (titre de section, fleches, compteur, export, carte sombre, titre centre),
 * avec des graphiques propres. Premier graphique : les 5 plus hauts rendements
 * du dividende, avec le taux de distribution en barre associee, pour le
 * CAC 40, le S&P 500 et les actions eligibles au PEA.
 * Rendu uniquement apres controle admin cote serveur (preversion).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadSvgAsPng } from "@/lib/chart-export";

export type LigneDividende = {
  ticker: string;
  nom: string;
  rendement: number;
  taux_distribution: number | null;
  date_cours: string | null;
  dont_exceptionnel?: boolean;
};

export type ListeDividende = {
  titre: string;
  top5: LigneDividende[];
  societes_avec_dividende: number;
  membres: number;
  date_cours_max: string | null;
};

export type DonneesDividendes = {
  genere_le: string;
  source: string;
  definitions: { rendement: string; taux_distribution: string; pea: string };
  listes: Record<string, ListeDividende>;
};

const W = 920;
const H = 470;
const PAD_TOP = 56;
const PAD_BOTTOM = 96;
const PAD_LEFT = 64;
const PAD_RIGHT = 64;
const COUL_RDT = "#a78bfa";
const COUL_DIST = "#22d3ee";

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function pct(v: number, dec = 1): string {
  return `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec })} %`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function titreGraphique(liste: ListeDividende, cle: string): string {
  const perimetre = cle === "pea" ? "des actions éligibles au PEA" : `du ${liste.titre}`;
  return `Les 5 plus hauts rendements du dividende ${perimetre}, avec le taux de distribution`;
}

export function KpiSurMesureBlock({ donnees }: { donnees: DonneesDividendes }) {
  const ordre = ["cac40", "sp500", "pea"].filter((k) => donnees.listes[k]?.top5?.length);
  const [idx, setIdx] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  // Mesure des libelles a la police du document, apres hydratation seulement.
  const [mesurePrete, setMesurePrete] = useState(false);
  useEffect(() => setMesurePrete(true), []);
  if (ordre.length === 0) return null;
  const n = ordre.length;
  const cle = ordre[idx % n];
  const liste = donnees.listes[cle];
  const lignes = liste.top5;
  const titre = titreGraphique(liste, cle);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  // Deux axes aux graduations rondes et alignees (meme nombre d intervalles).
  const pasRond = (brut: number) => {
    const mag = Math.pow(10, Math.floor(Math.log10(brut)));
    const n = brut / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  };
  const maxR = Math.max(...lignes.map((l) => l.rendement)) * 1.12;
  const maxDist = Math.max(0.01, ...lignes.map((l) => l.taux_distribution ?? 0)) * 1.12;
  const NB = 5;
  const echR = { pas: pasRond(maxR / NB), max: 0 };
  echR.max = echR.pas * NB;
  const echD = { pas: pasRond(maxDist / NB), max: 0 };
  echD.max = echD.pas * NB;
  const yR = (v: number) => PAD_TOP + innerH - (v / echR.max) * innerH;
  const yD = (v: number) => PAD_TOP + innerH - (v / echD.max) * innerH;
  const ticksR = Array.from({ length: NB + 1 }, (_, i) => echR.pas * i);
  const ticksD = Array.from({ length: NB + 1 }, (_, i) => echD.pas * i);
  const decR = Math.round(echR.pas * 1000) % 10 === 0 ? 0 : 1;
  const decD = Math.round(echD.pas * 1000) % 10 === 0 ? 0 : 1;
  const slot = innerW / lignes.length;
  const barW = Math.min(46, slot * 0.27);
  const ecart = 6;
  const exceptionnel = lignes.some((l) => l.dont_exceptionnel);
  const dateCours = liste.date_cours_max;

  const exporter = async () => {
    if (!svgRef.current) return;
    await downloadSvgAsPng(svgRef.current, `mettrik-dividendes-top5-${cle}.png`, {
      title: `${titre} · ${cle === "pea" ? "PEA" : liste.titre}`,
      locale: "fr",
      headerCompact: true,
      peers: lignes.map((l) => l.ticker),
      admin: true,
      peerNames: Object.fromEntries(lignes.map((l) => [l.ticker.toUpperCase(), l.nom])),
    });
  };

  return (
    <section className="my-10" data-admin-bloc="kpi-sur-mesure">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-semibold leading-tight text-zinc-50">KPI admin sur-mesure</h2>
            <span className="rounded border border-amber-400/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">admin</span>
          </div>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">Classements construits à la demande, hors des documents de la société.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12px] text-zinc-500">({(idx % n) + 1}/{n})</span>
          <button type="button" onClick={() => setIdx((i) => (i - 1 + n) % n)} className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Graphique précédent">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={exporter} className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Exporter le graphique sur-mesure" title="Exporter le graphique (PNG)">
            <Download className="size-4" />
          </button>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % n)} className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Graphique suivant" data-admin-suivant="1">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
        <div className="mb-3 flex justify-center gap-1.5">
          {ordre.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => setIdx(i)}
              className={`rounded-md border px-2.5 py-1 text-[12px] ${i === idx % n ? "border-violet-400/60 bg-violet-500/15 text-zinc-50" : "border-white/[0.08] text-zinc-400 hover:bg-white/5"}`}
            >
              {k === "pea" ? "PEA" : donnees.listes[k].titre}
            </button>
          ))}
        </div>
        <h3 className="mx-auto mb-3 mt-0 max-w-[92%] text-center text-[16px] font-bold leading-snug text-zinc-50 sm:text-[17px]">{titre}</h3>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label={titre}>
          {/* Legende : repere colle au libelle (largeur estimee a 13 px, police du document) */}
          {(() => {
            const l1 = "Rendement du dividende", l2 = "Taux de distribution";
            const lw = (t: string) => {
              const c = mesurePrete && typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
              if (!c) return t.length * 13 * 0.5;
              c.font = `300 13px "Avenir", "Avenir Next", "Manrope", sans-serif`;
              return c.measureText(t).width;
            };
            const itemW = (t: string) => 12 + 8 + lw(t);
            const total = itemW(l1) + 30 + itemW(l2);
            const x1 = W / 2 - total / 2;
            const x2 = x1 + itemW(l1) + 30;
            return (
              <g>
                <rect x={x1} y={14} width={12} height={12} rx={2} fill={COUL_RDT} />
                <text x={x1 + 20 + lw(l1) / 2} y={24.5} textAnchor="middle" fontSize={13} fontWeight={300} fontFamily='"Avenir", "Avenir Next", "Manrope", sans-serif' fill="#d4d4d8">{l1}</text>
                <rect x={x2} y={14} width={12} height={12} rx={2} fill={COUL_DIST} />
                <text x={x2 + 20 + lw(l2) / 2} y={24.5} textAnchor="middle" fontSize={13} fontWeight={300} fontFamily='"Avenir", "Avenir Next", "Manrope", sans-serif' fill="#d4d4d8">{l2}</text>
              </g>
            );
          })()}
          {/* Grille et axes */}
          {ticksR.map((v, i) => (
            <g key={i}>
              <line x1={PAD_LEFT} x2={PAD_LEFT + innerW} y1={yR(v)} y2={yR(v)} stroke="#1f1f1f" strokeDasharray="3 6" data-export-role="gridline" strokeOpacity={0.6} />
              <text x={PAD_LEFT - 10} y={yR(v) + 4} textAnchor="end" fontSize={12} fill="#a1a1aa">{pct(v, decR)}</text>
              <text x={PAD_LEFT + innerW + 10} y={yD(ticksD[i]) + 4} textAnchor="start" fontSize={12} fill="#a1a1aa">{pct(ticksD[i], decD)}</text>
            </g>
          ))}
          <line x1={PAD_LEFT} x2={PAD_LEFT + innerW} y1={PAD_TOP + innerH} y2={PAD_TOP + innerH} stroke="#3f3f46" data-export-role="structure" />
          {lignes.map((l, i) => {
            const cx = PAD_LEFT + slot * i + slot / 2;
            const xR = cx - ecart / 2 - barW;
            const xD = cx + ecart / 2;
            const hR = PAD_TOP + innerH - yR(l.rendement);
            const dist = l.taux_distribution;
            const hD = dist != null ? PAD_TOP + innerH - yD(dist) : 0;
            const nom = l.nom.length > 22 ? l.nom.slice(0, 21).trimEnd() + "…" : l.nom;
            return (
              <g key={l.ticker}>
                <rect x={xR} y={yR(l.rendement)} width={barW} height={Math.max(1.5, hR)} rx={3} fill={COUL_RDT} opacity={0.9} />
                <text x={xR + barW / 2} y={yR(l.rendement) - 8} textAnchor="middle" fontSize={13} fill="#e4e4e7">{pct(l.rendement)}</text>
                {dist != null ? (
                  <>
                    <rect x={xD} y={yD(dist)} width={barW} height={Math.max(1.5, hD)} rx={3} fill={COUL_DIST} opacity={0.85} />
                    <text x={xD + barW / 2} y={yD(dist) - 8} textAnchor="middle" fontSize={13} fill="#e4e4e7">{pct(dist, 0)}</text>
                  </>
                ) : (
                  <text x={xD + barW / 2} y={PAD_TOP + innerH - 8} textAnchor="middle" fontSize={12} fill="#a1a1aa">n.d.</text>
                )}
                <text x={cx} y={PAD_TOP + innerH + 24} textAnchor="middle" fontSize={14} fill="#e4e4e7">{nom}{l.dont_exceptionnel ? " *" : ""}</text>
                <text x={cx} y={PAD_TOP + innerH + 42} textAnchor="middle" fontSize={11.5} fill="#a1a1aa">{l.ticker}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 12} textAnchor="middle" fontSize={11} fill="#a1a1aa">
            {`Cours du ${fmtDate(dateCours)} · dividendes versés sur 12 mois${exceptionnel ? " (* dont versement exceptionnel)" : ""}`}
          </text>
        </svg>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Source : {donnees.source}, relevé le {fmtDate(donnees.genere_le)}, cours de clôture du {fmtDate(dateCours)}.
        {" "}Rendement : {minuscule(donnees.definitions.rendement)}. Taux de distribution : {minuscule(donnees.definitions.taux_distribution)}.
        {" "}{liste.societes_avec_dividende} sociétés versant un dividende sur {liste.membres}{cle === "pea" ? ` (${minuscule(donnees.definitions.pea)})` : ""}.
      </p>
    </section>
  );
}
