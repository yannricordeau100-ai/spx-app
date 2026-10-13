"use client";

/**
 * Ecriture partagee de l axe Y (Yann 13 oct 2026) : en-tete d unite et traits
 * de graduation, selon le style actif de src/lib/style-axe-y.ts. En style
 * « actuel », le rendu est identique a l ancien code des graphiques.
 */
import { attrsEntete, texteEntete, type StyleAxeY } from "@/lib/style-axe-y";

type PropsEntete = {
  s: StyleAxeY;
  /** Lignes deja calculees par calculeEnteteAxe (style « actuel » et en-tete en haut). */
  lignes: string[];
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  taille: number;
  poids?: number;
  interligne?: number;
  locale?: string;
  /** Unite debout (style A) : abscisse de la ligne de base et haut du trace. */
  debout?: { x: number; yHaut: number; aDroite: boolean };
  /** Texte brut sans tspan (graphique de variation, ecrit ainsi avant). */
  sansTspan?: boolean;
};

export function EnteteAxeY({ s, lignes, x, y, anchor, taille, poids = 600, interligne = 14, locale = "fr", debout, sansTspan = false }: PropsEntete) {
  const a = attrsEntete(s, taille, poids);
  if (s.entete.disposition === "vertical" && debout) {
    const brut = lignes.join(" ");
    const t = s.entete.capitales ? brut.toUpperCase() : brut;
    const rot = debout.aDroite ? 90 : -90;
    return (
      <text
        x={debout.x}
        y={debout.yHaut}
        transform={`rotate(${rot} ${debout.x} ${debout.yHaut})`}
        textAnchor={debout.aDroite ? "start" : "end"}
        {...a}
      >
        {t}
      </text>
    );
  }
  const textes = s.entete.developpe ? [texteEntete(s, lignes.join(" "), locale)] : lignes;
  const fs = a.fontSize;
  // Le trait de plume prend de la place sous le mot : en-tete remonte d autant.
  if (s.entete.souligne) y -= Math.round(fs * 0.3);
  const texte = (
    <text x={x} y={y} textAnchor={anchor} {...a}>
      {sansTspan && textes.length === 1
        ? textes[0]
        : textes.map((l, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : interligne}>{l}</tspan>
        ))}
    </text>
  );
  if (!s.entete.souligne) return texte;
  return (
    <g>
      {texte}
      {(() => {
        // Trait de plume : leger arc, plus epais au milieu, pas une regle.
        const w = Math.max(...textes.map((l) => l.length)) * fs * 0.56;
        const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
        const yb = y + fs * 0.42 + (textes.length - 1) * interligne;
        return (
          <path
            d={`M ${x0 - 1},${yb + 1.5} C ${x0 + w * 0.3},${yb + 3.6} ${x0 + w * 0.7},${yb - 0.6} ${x0 + w + 4},${yb + 0.8}`}
            fill="none"
            stroke="#a78bfa"
            strokeOpacity={0.85}
            strokeWidth={Math.max(1.3, fs * 0.12)}
            strokeLinecap="round"
            data-axe-y="souligne"
          />
        );
      })()}
    </g>
  );
}

/** Traits de graduation dessines contre l axe (style B), rien sinon. */
export function TraitsGraduationY({ s, ys, xAxe, aDroite }: { s: StyleAxeY; ys: number[]; xAxe: number; aDroite: boolean }) {
  const tr = s.graduation.trait;
  if (!tr) return null;
  const sens = aDroite ? 1 : -1;
  return (
    <g data-axe-y="traits">
      <line x1={xAxe} x2={xAxe} y1={Math.min(...ys)} y2={Math.max(...ys)} stroke={tr.couleur} strokeOpacity={0.45} strokeWidth={0.8} />
      {ys.map((y, i) => (
        <line key={i} x1={xAxe} x2={xAxe + sens * tr.longueur} y1={y} y2={y} stroke={tr.couleur} strokeWidth={tr.epaisseur} strokeLinecap="round" />
      ))}
    </g>
  );
}
