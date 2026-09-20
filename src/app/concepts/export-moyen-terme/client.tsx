"use client";

import { logoNeedsLightBg } from "@/components/logos";

/**
 * Cinq gabarits pour l image exportee depuis le bloc « Indicateurs varies -
 * Moyen terme » (Yann 20 sept 2026).
 *
 * Contraintes du cahier des charges, communes aux cinq :
 *   - affichage centre, propre, professionnel ;
 *   - ecarts maitrises et REGULIERS entre le bloc logo / nom, la rangee des
 *     autres societes, le titre et le graphique ;
 *   - le titre descend nettement, il est pose juste au-dessus du graphique ;
 *   - aucune date dans le titre du haut (« , 2022-2026 » retire) ;
 *   - rangee des logos et tickers des autres societes rattachees ;
 *   - signature en bas a droite, la barre verticale separee du pseudo et de
 *     « KPIs Powered by » par l equivalent de trois espaces de chaque cote.
 *
 * Les gabarits sont dessines en SVG au format reel 1744 x 1504 et mis a
 * l echelle par la largeur de la page. Le graphique est le vrai SVG moyen
 * terme publie, pas une maquette.
 */

const W = 1744;
const H = 1504;

const BG = "#050505";
const TEXTE = "#fafafa";
const TEXTE_2 = "#a1a1aa";
const FILET = "rgba(255,255,255,0.10)";
const ACCENT = "#a78bfa";

const POLICE_TITRE = "var(--font-instrument), Georgia, serif";
const POLICE_UI = "var(--font-sans-app), -apple-system, sans-serif";
const POLICE_MONO = "var(--font-jetbrains), ui-monospace, monospace";

/** Graphique reel : desk_image_findings, « Puces IA expediees par concepteur ». */
const GRAPHIQUE = "/findings/demande-0/nvda-unites-par-concepteur-dark.svg";
/** Titre de la ligne desk_image_findings, date retiree comme demande. */
const TITRE = "Puces IA expédiées par concepteur";
const SOCIETE = { ticker: "NVDA", nom: "NVIDIA" };
/** Cinq societes en tout : la principale plus quatre rattachees. */
const AUTRES = ["AMD", "GOOG", "META", "MSFT"];
const PSEUDO = "AlterEgo1";
const LOGO_METTRIK = "/brand/mettrik-ai-white-purple.png";
const LOGO_METTRIK_RATIO = 3.6;


const lg = (t: string) => `/logos/${t.toUpperCase().replace(/\./g, "-")}.png`;

/** Largeur approchee d un texte, suffisante pour centrer un bloc en SVG. */
function estW(texte: string, taille: number, facteur = 0.58): number {
  return texte.length * taille * facteur;
}

/* ─────────────────────────── briques communes ─────────────────────────── */

function Pastille({
  x,
  y,
  taille,
  ticker,
}: {
  x: number;
  y: number;
  taille: number;
  ticker: string;
}) {
  const r = taille * 0.22;
  const clair = logoNeedsLightBg(ticker);
  const id = `clip-${ticker}-${Math.round(x)}-${Math.round(y)}-${taille}`;
  return (
    <g>
      <clipPath id={id}>
        <rect x={x} y={y} width={taille} height={taille} rx={r} ry={r} />
      </clipPath>
      <rect
        x={x}
        y={y}
        width={taille}
        height={taille}
        rx={r}
        ry={r}
        fill={clair ? "#ffffff" : "#0a0a0a"}
        stroke={clair ? "rgba(0,0,0,0.15)" : FILET}
        strokeWidth={1}
      />
      <image
        href={lg(ticker)}
        x={x}
        y={y}
        width={taille}
        height={taille}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${id})`}
      />
    </g>
  );
}

/** Bloc logo + nom de la societe principale, centre sur cx. */
function Identite({
  cx,
  yHaut,
  tailleLogo,
  tailleNom,
  ancre = "centre",
  x,
}: {
  cx?: number;
  yHaut: number;
  tailleLogo: number;
  tailleNom: number;
  ancre?: "centre" | "gauche";
  x?: number;
}) {
  const gap = Math.round(tailleLogo * 0.36);
  const wNom = estW(SOCIETE.nom, tailleNom, 0.63);
  const total = tailleLogo + gap + wNom;
  const debut = ancre === "gauche" ? (x ?? 0) : (cx ?? W / 2) - total / 2;
  return (
    <g>
      <Pastille x={debut} y={yHaut} taille={tailleLogo} ticker={SOCIETE.ticker} />
      <text
        x={debut + tailleLogo + gap}
        y={yHaut + tailleLogo * 0.72}
        fill={TEXTE}
        fontFamily={POLICE_UI}
        fontWeight={300}
        fontSize={tailleNom}
        letterSpacing="-0.01em"
      >
        {SOCIETE.nom}
      </text>
    </g>
  );
}

/** Rangee « logo + ticker » des autres societes rattachees au graphique. */
function RangeeAutres({
  cx,
  cy,
  tailleLogo = 34,
  tailleTexte = 21,
  ecart = 40,
  ancre = "centre",
  x,
  pastilleFond = false,
}: {
  cx?: number;
  cy: number;
  tailleLogo?: number;
  tailleTexte?: number;
  ecart?: number;
  ancre?: "centre" | "gauche" | "droite";
  x?: number;
  pastilleFond?: boolean;
}) {
  const gapTexte = 11;
  const largeurs = AUTRES.map(
    (t) => tailleLogo + gapTexte + estW(t, tailleTexte, 0.66),
  );
  const total =
    largeurs.reduce((s, v) => s + v, 0) + ecart * (AUTRES.length - 1);
  const debut =
    ancre === "centre"
      ? (cx ?? W / 2) - total / 2
      : ancre === "droite"
        ? (x ?? 0) - total
        : (x ?? 0);
  let curseur = debut;
  const items = AUTRES.map((t, i) => {
    const xi = curseur;
    curseur += largeurs[i] + ecart;
    return (
      <g key={t}>
        {pastilleFond ? (
          <rect
            x={xi - 14}
            y={cy - tailleLogo / 2 - 11}
            width={largeurs[i] + 28}
            height={tailleLogo + 22}
            rx={(tailleLogo + 22) / 2}
            fill="rgba(255,255,255,0.035)"
            stroke={FILET}
            strokeWidth={1}
          />
        ) : null}
        <Pastille
          x={xi}
          y={cy - tailleLogo / 2}
          taille={tailleLogo}
          ticker={t}
        />
        <text
          x={xi + tailleLogo + gapTexte}
          y={cy + tailleTexte * 0.36}
          fill={TEXTE_2}
          fontFamily={POLICE_MONO}
          fontSize={tailleTexte}
          letterSpacing="0.04em"
        >
          {t}
        </text>
      </g>
    );
  });
  return <g>{items}</g>;
}

/** Colonne verticale « logo + ticker » (gabarit 3). */
function ColonneAutres({ x, yHaut, pas = 62 }: { x: number; yHaut: number; pas?: number }) {
  return (
    <g>
      {AUTRES.map((t, i) => (
        <g key={t}>
          <Pastille x={x} y={yHaut + i * pas} taille={38} ticker={t} />
          <text
            x={x + 38 + 14}
            y={yHaut + i * pas + 25}
            fill={TEXTE_2}
            fontFamily={POLICE_MONO}
            fontSize={21}
            letterSpacing="0.04em"
          >
            {t}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * Signature bas de document. La barre verticale recoit l equivalent de trois
 * espaces a GAUCHE et a DROITE (demande ferme de Yann, 20 sept 2026).
 */
function Signature({
  xDroite,
  cy,
  taille = 26,
}: {
  xDroite: number;
  cy: number;
  taille?: number;
}) {
  const hLogo = Math.round(taille * 1.75);
  const wLogo = Math.round(hLogo * LOGO_METTRIK_RATIO);
  const espace3 = Math.round(taille * 0.82); // ~ trois espaces a cette taille
  const wBarre = Math.round(taille * 0.26);
  const wPseudo = estW(PSEUDO, taille, 0.56);
  const wSignature = estW("KPIs Powered by", taille, 0.53);
  const total =
    wPseudo + espace3 + wBarre + espace3 + wSignature + 3 + wLogo;
  let cur = xDroite - total;
  const yTexte = cy + taille * 0.36;
  const commun = {
    fill: TEXTE,
    fontFamily: POLICE_UI,
    fontWeight: 300,
    fontSize: taille,
    letterSpacing: "0.02em",
    opacity: 0.85,
  };
  const xPseudo = cur;
  cur += wPseudo + espace3;
  const xBarre = cur;
  cur += wBarre + espace3;
  const xSign = cur;
  cur += wSignature + 3;
  const xLogo = cur;
  return (
    <g>
      <text x={xPseudo} y={yTexte} {...commun}>
        {PSEUDO}
      </text>
      <text x={xBarre} y={yTexte} {...commun} opacity={0.55}>
        |
      </text>
      <text x={xSign} y={yTexte} {...commun}>
        KPIs Powered by
      </text>
      <image
        href={LOGO_METTRIK}
        x={xLogo}
        y={cy - hLogo / 2}
        width={wLogo}
        height={hLogo}
        preserveAspectRatio="xMinYMid meet"
        opacity={0.95}
      />
    </g>
  );
}

function Graphique({
  x,
  y,
  largeur,
}: {
  x: number;
  y: number;
  largeur: number;
}) {
  const hauteur = Math.round((largeur * 450) / 800);
  return (
    <image
      href={GRAPHIQUE}
      x={x}
      y={y}
      width={largeur}
      height={hauteur}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="block h-auto w-full rounded-xl border border-white/[0.07]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={W} height={H} fill={BG} />
      {children}
    </svg>
  );
}

/* ───────────────────────────── gabarit 1 ───────────────────────────── */
/* Colonne centree, rythme constant : un seul ecart G entre chaque bloc.   */

function Gabarit1() {
  const M = 72;
  const LARGEUR = W - M * 2; // 1600
  const HAUTEUR = Math.round((LARGEUR * 450) / 800); // 900
  const G = 64;
  const yLogo = 96;
  const hLogo = 88;
  const cyAutres = yLogo + hLogo + G + 28;
  const yTitre = cyAutres + 28 + G + 44;
  const yChart = yTitre + G;
  const cySign = yChart + HAUTEUR + 48 + 24;
  return (
    <Cadre>
      <Identite cx={W / 2} yHaut={yLogo} tailleLogo={hLogo} tailleNom={54} />
      <RangeeAutres cx={W / 2} cy={cyAutres} />
      <text
        x={W / 2}
        y={yTitre}
        textAnchor="middle"
        fill={TEXTE}
        fontFamily={POLICE_TITRE}
        fontWeight={600}
        fontSize={46}
        letterSpacing="-0.02em"
      >
        {TITRE}
      </text>
      <Graphique x={M} y={yChart} largeur={LARGEUR} />
      <Signature xDroite={M + LARGEUR} cy={cySign} />
    </Cadre>
  );
}

/* ───────────────────────────── gabarit 2 ───────────────────────────── */
/* Bandeau plein largeur : identite a gauche, societes rattachees a droite. */

function Gabarit2() {
  const M = 72;
  const LARGEUR = W - M * 2;
  const HAUTEUR = Math.round((LARGEUR * 450) / 800);
  const hBande = 216;
  const G = 72;
  const yTitre = hBande + G + 46;
  const yChart = yTitre + G;
  const cySign = yChart + HAUTEUR + 52 + 24;
  return (
    <Cadre>
      <rect x={0} y={0} width={W} height={hBande} fill="#0b0b10" />
      <rect x={0} y={hBande - 1} width={W} height={2} fill={FILET} />
      <rect x={0} y={0} width={6} height={hBande} fill={ACCENT} opacity={0.75} />
      <Identite
        ancre="gauche"
        x={M}
        yHaut={hBande / 2 - 44}
        tailleLogo={88}
        tailleNom={54}
      />
      <RangeeAutres ancre="droite" x={W - M} cy={hBande / 2} ecart={34} />
      <text
        x={W / 2}
        y={yTitre}
        textAnchor="middle"
        fill={TEXTE}
        fontFamily={POLICE_TITRE}
        fontWeight={600}
        fontSize={48}
        letterSpacing="-0.02em"
      >
        {TITRE}
      </text>
      <Graphique x={M} y={yChart} largeur={LARGEUR} />
      <Signature xDroite={M + LARGEUR} cy={cySign} />
    </Cadre>
  );
}

/* ───────────────────────────── gabarit 3 ───────────────────────────── */
/* Deux colonnes : identite et societes rattachees a gauche, titre et       */
/* graphique a droite, separes par un filet vertical.                       */

function Gabarit3() {
  const M = 80;
  const xFilet = 470;
  const xDroite = xFilet + 64;
  const LARGEUR = W - M - xDroite;
  const HAUTEUR = Math.round((LARGEUR * 450) / 800);
  const yChart = 470;
  const yTitre = yChart - 56;
  const cySign = yChart + HAUTEUR + 60 + 24;
  return (
    <Cadre>
      <Identite ancre="gauche" x={M} yHaut={150} tailleLogo={96} tailleNom={52} />
      <text
        x={M}
        y={300}
        fill={TEXTE_2}
        fontFamily={POLICE_UI}
        fontSize={20}
        letterSpacing="0.14em"
        opacity={0.75}
      >
        SOCIÉTÉS RATTACHÉES
      </text>
      <ColonneAutres x={M} yHaut={332} />
      <rect x={xFilet} y={140} width={1} height={620} fill={FILET} />
      <text
        x={xDroite}
        y={yTitre}
        fill={TEXTE}
        fontFamily={POLICE_TITRE}
        fontWeight={600}
        fontSize={44}
        letterSpacing="-0.02em"
      >
        {TITRE}
      </text>
      <Graphique x={xDroite} y={yChart} largeur={LARGEUR} />
      <Signature xDroite={xDroite + LARGEUR} cy={cySign} />
    </Cadre>
  );
}

/* ───────────────────────────── gabarit 4 ───────────────────────────── */
/* Titre epingle au graphique par un filet d accent, societes en pastilles.  */

function Gabarit4() {
  const M = 72;
  const LARGEUR = W - M * 2;
  const HAUTEUR = Math.round((LARGEUR * 450) / 800);
  const G = 60;
  const yLogo = 104;
  const hLogo = 92;
  const cyAutres = yLogo + hLogo + G + 29;
  const yTitre = cyAutres + 29 + G + 46;
  const yChart = yTitre + G;
  const cySign = yChart + HAUTEUR + 50 + 24;
  return (
    <Cadre>
      <Identite cx={W / 2} yHaut={yLogo} tailleLogo={hLogo} tailleNom={56} />
      <RangeeAutres cx={W / 2} cy={cyAutres} pastilleFond ecart={26} />
      <rect
        x={M}
        y={yTitre - 42}
        width={6}
        height={56}
        rx={3}
        fill={ACCENT}
        opacity={0.9}
      />
      <text
        x={M + 28}
        y={yTitre}
        fill={TEXTE}
        fontFamily={POLICE_TITRE}
        fontWeight={700}
        fontSize={48}
        letterSpacing="-0.025em"
      >
        {TITRE}
      </text>
      <Graphique x={M} y={yChart} largeur={LARGEUR} />
      <Signature xDroite={M + LARGEUR} cy={cySign} />
    </Cadre>
  );
}

/* ───────────────────────────── gabarit 5 ───────────────────────────── */
/* Pile serree : identite, filet fin, titre, puis les societes rattachees    */
/* juste au-dessus du graphique.                                             */

function Gabarit5() {
  const M = 72;
  const LARGEUR = W - M * 2;
  const HAUTEUR = Math.round((LARGEUR * 450) / 800);
  const G = 52;
  const yLogo = 120;
  const hLogo = 84;
  const yFilet = yLogo + hLogo + G;
  const yTitre = yFilet + G + 44;
  const cyAutres = yTitre + G + 20;
  const yChart = cyAutres + 20 + G;
  const cySign = yChart + HAUTEUR + 46 + 24;
  return (
    <Cadre>
      <Identite cx={W / 2} yHaut={yLogo} tailleLogo={hLogo} tailleNom={52} />
      <rect x={W / 2 - 220} y={yFilet} width={440} height={1} fill={FILET} />
      <text
        x={W / 2}
        y={yTitre}
        textAnchor="middle"
        fill={TEXTE}
        fontFamily={POLICE_TITRE}
        fontWeight={600}
        fontSize={46}
        letterSpacing="-0.02em"
      >
        {TITRE}
      </text>
      <RangeeAutres cx={W / 2} cy={cyAutres} tailleLogo={30} tailleTexte={19} ecart={34} />
      <Graphique x={M} y={yChart} largeur={LARGEUR} />
      <Signature xDroite={M + LARGEUR} cy={cySign} />
    </Cadre>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

const GABARITS: { n: number; principe: string; noeud: React.ReactNode }[] = [
  {
    n: 1,
    principe:
      "Colonne centrée, rythme constant. Un seul écart (64 px) sépare le bloc logo et nom, la rangée des sociétés rattachées, le titre et le graphique. Aucun vide libre, le titre tombe juste au-dessus du graphique.",
    noeud: <Gabarit1 />,
  },
  {
    n: 2,
    principe:
      "Bandeau. L'identité occupe une bande pleine largeur en haut (logo et nom à gauche, sociétés rattachées à droite), le titre est centré juste au-dessus du graphique.",
    noeud: <Gabarit2 />,
  },
  {
    n: 3,
    principe:
      "Deux colonnes. Colonne d'identité à gauche (logo, nom, sociétés rattachées empilées), titre et graphique à droite, séparés par un filet vertical.",
    noeud: <Gabarit3 />,
  },
  {
    n: 4,
    principe:
      "Titre épinglé. Identité centrée, sociétés rattachées en pastilles, titre aligné à gauche sur le bord du graphique et marqué par un filet d'accent violet.",
    noeud: <Gabarit4 />,
  },
  {
    n: 5,
    principe:
      "Pile serrée. Identité, filet fin de séparation, titre, puis la rangée des sociétés rattachées posée juste au-dessus du graphique : les logos servent de légende d'entrée au graphique.",
    noeud: <Gabarit5 />,
  },
];

export function ExportMoyenTermeConcepts() {
  return (
    <div className="mt-8 space-y-14">
      {GABARITS.map((g) => (
        <section key={g.n}>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="font-mono text-[12px] text-violet-300">
              Gabarit {g.n}
            </span>
            {g.n === 1 ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                appliqué à l&apos;export réel
              </span>
            ) : null}
          </div>
          {g.noeud}
          <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-400">
            <span className="font-mono text-zinc-300">{g.n}.</span> {g.principe}
          </p>
        </section>
      ))}
    </div>
  );
}
