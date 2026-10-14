"use client";

/**
 * Ecriture partagee de l axe Y (Yann 13 oct 2026) : en-tete d unite et traits
 * de graduation, selon le style actif de src/lib/style-axe-y.ts. En style
 * « actuel », le rendu est identique a l ancien code des graphiques.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { attrsEntete, attrsGraduation, graduationsEcrites, texteEntete, type StyleAxeY } from "@/lib/style-axe-y";

// useLayoutEffect cote client seulement (pas d avertissement au rendu serveur).
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Boite = { x: number; y: number; width: number; height: number };

/** Taille minimale REELLE des ecritures de l axe (px a l ecran), propositions D a G. */
export const PX_MIN_AXE = 11.5;

/**
 * Echelle reelle du SVG (px a l ecran par unite du viewBox), relue a chaque
 * redimensionnement. Sert a garantir PX_MIN_AXE sur mobile, ou le SVG est reduit.
 */
function useEchelleReelle() {
  const ref = useRef<SVGGElement>(null);
  const [k, setK] = useState<number | null>(null);
  useIsoLayout(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const maj = () => {
      const vb = svg.viewBox?.baseVal;
      const w = svg.getBoundingClientRect().width;
      if (vb && vb.width > 0 && w > 0) setK(w / vb.width);
    };
    maj();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(maj);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  return [ref, k] as const;
}

/** Taille en unites SVG relevee au minimum lisible (styles D a G seulement). */
function auMoins(s: StyleAxeY, taille: number, k: number | null): number {
  if (!k || s.id === "actuel" || ["A", "B", "C"].includes(s.id)) return taille;
  return Math.max(taille, Math.round((PX_MIN_AXE / k) * 10) / 10);
}

/**
 * Texte SVG mesure apres rendu (et apres chargement des polices) : la boite
 * sert a dessiner la plaque (D) ou le repere (G) a la taille exacte du mot.
 * Avant la mesure, une estimation est utilisee.
 */
function AvecBoite({ estimation, texte, dessin, cle }: { estimation: Boite; texte: (ref: RefObject<SVGTextElement | null>) => ReactNode; dessin: (b: Boite) => ReactNode; cle: string }) {
  const ref = useRef<SVGTextElement>(null);
  const [b, setB] = useState<Boite | null>(null);
  useIsoLayout(() => {
    let vivant = true;
    const mesure = () => {
      const el = ref.current;
      if (!el || !vivant) return;
      try {
        const r = el.getBBox();
        if (r.width > 0) setB({ x: r.x, y: r.y, width: r.width, height: r.height });
      } catch { /* element non rendu */ }
    };
    mesure();
    if (typeof document !== "undefined" && document.fonts) document.fonts.ready.then(mesure).catch(() => {});
    return () => { vivant = false; };
  }, [cle]);
  return (
    <g>
      {dessin(b ?? estimation)}
      {texte(ref)}
    </g>
  );
}

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

export function EnteteAxeY(props: PropsEntete) {
  const [ref, k] = useEchelleReelle();
  const neuf = !["actuel", "A", "B", "C"].includes(props.s.id);
  const contenu = <EnteteAxeYInterne {...props} k={k} />;
  // Styles D a G : groupe mesure (taille minimale reelle). Ancien rendu inchange sinon.
  return neuf ? <g ref={ref}>{contenu}</g> : contenu;
}

function EnteteAxeYInterne({ s, lignes, x, y, anchor, taille, poids = 600, interligne = 14, locale = "fr", debout, sansTspan = false, k }: PropsEntete & { k: number | null }) {
  const a0 = attrsEntete(s, taille, poids);
  const a = { ...a0, fontSize: auMoins(s, Number(a0.fontSize), k) };
  // Interligne proportionnel si la taille a ete relevee.
  if (a.fontSize !== a0.fontSize) interligne = interligne * (a.fontSize / Number(a0.fontSize));
  // E : l unite est ecrite avec la plus haute graduation (GraduationsY).
  if (s.entete.disposition === "integre") return null;
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
  if (s.entete.disposition === "cartouche" || s.entete.repere) {
    // Estimation avant mesure : chasse moyenne 0,56 em.
    const w = Math.max(...textes.map((l) => l.length)) * fs * 0.56;
    const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    const est = { x: x0, y: y - fs * 0.8, width: w, height: fs * 1.05 + (textes.length - 1) * interligne };
    const cle = `${textes.join("|")}-${fs}-${x}-${y}`;
    if (s.entete.disposition === "cartouche") {
      // D : plaque de signaletique, le texte remonte un peu pour que la plaque
      // ne touche pas la plus haute graduation.
      const px = fs * 0.5, py = fs * 0.28;
      y -= fs * 0.3;
      return (
        <AvecBoite
          cle={cle}
          estimation={est}
          texte={(ref) => (
            <text ref={ref} x={x} y={y} textAnchor={anchor} {...a}>
              {sansTspan && textes.length === 1
                ? textes[0]
                : textes.map((l, i) => (<tspan key={i} x={x} dy={i === 0 ? 0 : interligne}>{l}</tspan>))}
            </text>
          )}
          dessin={(b) => (
            <rect
              data-axe-y="cartouche"
              data-export-role="structure"
              x={b.x - px}
              y={b.y - py}
              width={b.width + 2 * px}
              height={b.height + 2 * py}
              rx={fs * 0.22}
              fill="#e4e4e7"
              fillOpacity={0.08}
              stroke="#e4e4e7"
              strokeOpacity={0.5}
              strokeWidth={Math.max(1, fs * 0.07)}
            />
          )}
        />
      );
    }
    // G : repere violet de Mettrik devant l unite.
    const couleur = s.entete.repere as string;
    return (
      <AvecBoite
        cle={cle}
        estimation={est}
        texte={(ref) => (
          <text ref={ref} x={x} y={y} textAnchor={anchor} {...a}>
            {sansTspan && textes.length === 1
              ? textes[0]
              : textes.map((l, i) => (<tspan key={i} x={x} dy={i === 0 ? 0 : interligne}>{l}</tspan>))}
          </text>
        )}
        dessin={(b) => (
          <rect
            data-axe-y="repere"
            x={b.x - fs * 0.62}
            y={b.y + b.height * 0.2}
            width={Math.max(2.5, fs * 0.26)}
            height={b.height * 0.62}
            rx={Math.max(1, fs * 0.08)}
            fill={couleur}
          />
        )}
      />
    );
  }
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

type PropsGraduations = {
  s: StyleAxeY;
  /** Graduations (y en unites SVG, texte deja passe par texteGraduation). */
  ticks: { y: number; texte: string }[];
  /** Taille d origine passee a attrsGraduation (16 * AF, 15 * AFX...). */
  taille: number;
  /** Abscisse du texte en placement « gauche » (expression d origine du graphique). */
  xTexte: number;
  /** Decalage vertical de la ligne de base (5 dans les graphiques). */
  dy?: number;
  /** Bord du trace cote axe (PAD_LEFT, ou PAD_LEFT + largeur si axe a droite). */
  xAxe: number;
  aDroite: boolean;
  /** Unite (en-tete), ecrite avec la plus haute graduation en style E. */
  unite?: string;
  /** Bord libre du cadre cote axe (style E : debut du trait de rappel et du chiffre). */
  xBord?: number;
};

/**
 * Graduations de l axe Y selon le style (14 oct 2026). En « actuel », A, B, C,
 * D et G : rendu identique a l ancien code des graphiques (texte ancre a droite
 * a xTexte, traits B). E : chiffres poses sur leur ligne de grille prolongee.
 * F : regle graduee.
 */
export function GraduationsY(props: PropsGraduations) {
  const [ref, k] = useEchelleReelle();
  const neuf = !["actuel", "A", "B", "C"].includes(props.s.id);
  const contenu = <GraduationsYInterne {...props} k={k} />;
  return neuf ? <g ref={ref}>{contenu}</g> : contenu;
}

function GraduationsYInterne({ s, ticks, taille, xTexte, dy = 5, xAxe, aDroite, unite, xBord, k: kEcran }: PropsGraduations & { k: number | null }) {
  const g = s.graduation;
  const aG = attrsGraduation(s, taille);
  const attrsG = { ...aG, fontSize: auMoins(s, Number(aG.fontSize), kEcran) };
  const place = g.placement ?? "gauche";
  if (place === "gauche") {
    return (
      <>
        {ticks.map(({ y, texte }, i) => (
          <text key={`yn-${i}`} x={xTexte} y={y + (attrsG.fontSize !== aG.fontSize ? Number(attrsG.fontSize) * 0.34 : dy)} textAnchor="end" {...attrsG}>
            {texte}
          </text>
        ))}
        <TraitsGraduationY s={s} ys={ticks.map(({ y }) => y)} xAxe={xAxe} aDroite={aDroite} />
      </>
    );
  }
  const a = attrsG;
  const fs = Number(a.fontSize);
  const k = taille / 16;
  const tr = g.trait ?? { longueur: 9, couleur: "#a1a1aa", epaisseur: 1.1 };
  const L = tr.longueur * Math.max(1, k);
  // Ordre du bas vers le haut (y decroissant).
  const tri = ticks.map((t, i) => ({ ...t, i })).sort((p, q) => q.y - p.y);
  if (place === "trace") {
    // E : pas de colonne d axe. Chaque ligne de grille se prolonge jusqu au bord
    // en un trait plein (le trait de rappel) et le chiffre est pose dessus.
    const bord = xBord ?? (aDroite ? xAxe + 50 : xAxe - 50);
    const haut = tri[tri.length - 1];
    const ae0 = attrsEntete(s, taille, 400);
    const ae = { ...ae0, fontSize: auMoins(s, Number(ae0.fontSize), kEcran) };
    let u = (unite ?? "").trim();
    if (u && haut && /%$/.test(haut.texte) && u.startsWith("%")) u = u.replace(/^%\s*/, "").replace(/^\((.*)\)$/, "$1");
    return (
      <g data-axe-y="trace">
        {tri.map(({ y, texte, i }) => (
          <g key={`yt-${i}`}>
            <line x1={bord} x2={xAxe} y1={y} y2={y} stroke={tr.couleur} strokeOpacity={0.75} strokeWidth={tr.epaisseur * Math.max(1, k * 0.8)} data-axe-y="rappel" data-export-role="structure" />
            <text x={bord} y={y - fs * 0.32} textAnchor={aDroite ? "end" : "start"} {...a}>
              {texte}
              {u && haut && haut.i === i ? (
                <tspan fill={ae.fill} fontWeight={ae.fontWeight} fontSize={ae.fontSize} data-axe-y="unite">{` ${u}`}</tspan>
              ) : null}
            </text>
          </g>
        ))}
      </g>
    );
  }
  // Regle graduee : trait par graduation, 4 traits fins entre deux, 3 valeurs ecrites.
  const sens = aDroite ? 1 : -1;
  const ecrites = graduationsEcrites(s, tri.length);
  const mineurs: number[] = [];
  for (let j = 0; j < tri.length - 1; j++) {
    for (let m = 1; m <= 4; m++) mineurs.push(tri[j].y + ((tri[j + 1].y - tri[j].y) * m) / 5);
  }
  const ys = tri.map((t) => t.y);
  return (
    <g data-axe-y="regle">
      <line x1={xAxe} x2={xAxe} y1={Math.min(...ys)} y2={Math.max(...ys)} stroke={tr.couleur} strokeOpacity={0.7} strokeWidth={Math.max(1, k * 0.9)} data-export-role="structure" />
      {tri.map(({ y, i }) => (
        <line key={`rM-${i}`} x1={xAxe} x2={xAxe + sens * L} y1={y} y2={y} stroke={tr.couleur} strokeWidth={tr.epaisseur * Math.max(1, k * 0.8)} strokeLinecap="round" data-export-role="structure" />
      ))}
      {mineurs.map((y, j) => (
        <line key={`rm-${j}`} x1={xAxe} x2={xAxe + sens * L * 0.5} y1={y} y2={y} stroke={tr.couleur} strokeOpacity={0.75} strokeWidth={Math.max(0.8, k * 0.7)} data-export-role="structure" />
      ))}
      {tri.map(({ y, texte, i }, j) => (ecrites.has(j) ? (
        <text key={`rt-${i}`} x={xAxe + sens * (L + fs * 0.35)} y={y + fs * 0.34} textAnchor={aDroite ? "start" : "end"} {...a}>
          {texte}
        </text>
      ) : null))}
    </g>
  );
}
