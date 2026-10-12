"use client";

/**
 * Yann 12 oct 2026 : coque de la fiche societe reprise du concept valide
 * « rail-survol-v2 » (version 3, /concepts/fiche-onglets/rail-survol-v2).
 *  - rail a gauche qui s elargit au survol (104 px ferme, 400 px ouvert),
 *    logo complet centre en haut, Rechercher sous le logo, blocs et outils en
 *    un groupe centre ;
 *  - page unique : clic = defilement vers le bloc (sous l en-tete collant,
 *    zoom du site compris), mise en evidence au defilement ;
 *  - en-tete collant complet sur ordinateur, ligne compacte de 60 px sur
 *    mobile (ou quand l en-tete depasse 140 px) ;
 *  - mobile : barre d onglets en bas et tiroir.
 * Les outils reprennent les composants du site (CompanySearch, ThemeToggle,
 * CompareControl, StarButton, bloc compte du serveur), avec les memes regles
 * (clair reserve aux offres payantes, outils inertes pour un anonyme).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Compass, BarChart3, Layers, LineChart, Target, AlertTriangle, Building2, Brain, FileText, Scale, ShieldCheck,
  Star, GitCompare, UserRound, Sun, Moon, Search, Menu, X, Bookmark, Lock, type LucideIcon,
} from "lucide-react";
import type { Company, KPI } from "@/lib/data";
import { PageSearch } from "@/components/page-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompareControl } from "@/components/compare-control";
import { StarButton } from "@/components/star-button";
import { LogoMettrik } from "@/components/logo-mettrik";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { displayTicker } from "@/lib/ticker-display";
import { lienInscription } from "@/components/freemium/zone-reservee";

/* ------------------------------------------------------------------ */
/* Blocs                                                               */
/* ------------------------------------------------------------------ */

export type BlocFicheId = "apercu" | "kpi" | "stories" | "moyen" | "marche" | "risques" | "gouv" | "ia" | "resultats" | "these" | "admin";
type Bloc = { id: BlocFicheId; titre: string; Icon: LucideIcon; phrase: string; anim: string };

/** Ordre de la fiche. « Sources » est en pied de page, hors du rail. */
export const BLOCS_FICHE: Bloc[] = [
  { id: "apercu", titre: "Aperçu", Icon: Compass, phrase: "Rangs, description et chiffres de marché", anim: "boussole" },
  { id: "kpi", titre: "Indicateurs clés", Icon: BarChart3, phrase: "Graphique du KPI principal et liste des indicateurs", anim: "barres" },
  { id: "moyen", titre: "Moyen terme", Icon: LineChart, phrase: "Graphiques de sources externes", anim: "trace" },
  { id: "stories", titre: "KPI court terme", Icon: Layers, phrase: "Les indicateurs récents en cartes", anim: "pile" },
  { id: "marche", titre: "Marché et TAM", Icon: Target, phrase: "Chiffre d’affaires, clients, avantage, marché", anim: "cible" },
  { id: "risques", titre: "Risques", Icon: AlertTriangle, phrase: "Facteurs de risque suivis", anim: "secoue" },
  { id: "gouv", titre: "Gouvernance et rachats", Icon: Building2, phrase: "Dirigeants, votes, sociétés rachetées", anim: "monte" },
  { id: "ia", titre: "IA", Icon: Brain, phrase: "Positionnement en intelligence artificielle", anim: "pulse" },
  { id: "resultats", titre: "Publications officielles", Icon: FileText, phrase: "Résultats publiés et dernier appel", anim: "page" },
  { id: "these", titre: "Thèse et anti-thèse", Icon: Scale, phrase: "Cas favorable et cas défavorable", anim: "balance" },
  { id: "admin", titre: "Admin", Icon: ShieldCheck, phrase: "Cours de bourse et KPI sur-mesure", anim: "pop" },
];

const RAIL = 104;
const RAIL_OUVERT = 400;
const COMPACT_PX = 60;
const VAR_ENTETE = "--entete-fiche";

/* Le site applique un zoom sur <body> : positions d ecran (getBoundingClientRect,
   scrollY) en px d ecran, offsetHeight en px CSS du body. */
const zoomSite = () => (typeof document === "undefined" ? 1 : parseFloat(getComputedStyle(document.body).zoom) || 1);
/** Hauteur affichee de l en-tete collant, en px d ecran (0 hors fiche). */
export function hauteurEnteteFiche(): number {
  if (typeof document === "undefined") return 0;
  return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue(VAR_ENTETE)) || 0) * zoomSite();
}
const sectionDe = (id: string) => document.querySelector<HTMLElement>(`[data-bloc-fiche="${id}"]`);

/** Intertitre d un bloc de la page unique (absent pour le premier bloc). */
export function IntertitreBloc({ id, accent }: { id: BlocFicheId; accent: string }) {
  const b = BLOCS_FICHE.find((x) => x.id === id);
  if (!b) return null;
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06]"><b.Icon className="size-4" style={{ color: accent }} aria-hidden /></span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">{b.titre}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/** Section d un bloc : intertitre puis contenu (la marge haute du premier enfant est neutralisee). */
export function SectionBloc({ id, accent, premier = false, children }: { id: BlocFicheId; accent: string; premier?: boolean; children: React.ReactNode }) {
  const b = BLOCS_FICHE.find((x) => x.id === id);
  return (
    <section data-bloc-fiche={id} aria-label={b?.titre} className={premier ? "" : "mt-14"}>
      {!premier && <IntertitreBloc id={id} accent={accent} />}
      <div className={premier ? "" : "[&>*:first-child]:!mt-0"}>{children}</div>
    </section>
  );
}

/* Effets de survol, un par icone. Pas d animation si l utilisateur la refuse. */
const STYLE_ANIM = `
@keyframes v2-boussole{0%{transform:rotate(0)}70%{transform:rotate(380deg)}100%{transform:rotate(360deg)}}
@keyframes v2-barres{0%,100%{transform:scaleY(1)}35%{transform:scaleY(.62)}70%{transform:scaleY(1.14)}}
@keyframes v2-pile{0%,100%{transform:translateY(0)}45%{transform:translateY(-4px)}70%{transform:translateY(1px)}}
@keyframes v2-trace{0%{clip-path:inset(0 100% 0 0)}100%{clip-path:inset(0 0 0 0)}}
@keyframes v2-cible{0%,100%{transform:scale(1)}40%{transform:scale(.72)}75%{transform:scale(1.12)}}
@keyframes v2-secoue{0%,100%{transform:rotate(0)}20%{transform:rotate(-13deg)}40%{transform:rotate(11deg)}60%{transform:rotate(-7deg)}80%{transform:rotate(4deg)}}
@keyframes v2-monte{0%,100%{transform:translateY(0) scale(1)}45%{transform:translateY(-4px) scale(1.08)}}
@keyframes v2-pulse{0%,100%{transform:scale(1);filter:none}50%{transform:scale(1.14);filter:drop-shadow(0 0 6px var(--v2-acc))}}
@keyframes v2-page{0%,100%{transform:perspective(60px) rotateY(0)}50%{transform:perspective(60px) rotateY(-38deg)}}
@keyframes v2-balance{0%,100%{transform:rotate(0)}25%{transform:rotate(-11deg)}60%{transform:rotate(9deg)}85%{transform:rotate(-3deg)}}
@keyframes v2-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
@keyframes v2-etoile{0%{transform:rotate(0) scale(1)}55%{transform:rotate(86deg) scale(1.22)}100%{transform:rotate(72deg) scale(1)}}
@keyframes v2-echange{0%,100%{transform:translateX(0)}30%{transform:translateX(-3px)}65%{transform:translateX(3px)}}
@keyframes v2-salut{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(-3px) rotate(-6deg)}70%{transform:translateY(0) rotate(5deg)}}
@keyframes v2-astre{0%{transform:rotate(0) scale(1)}60%{transform:rotate(100deg) scale(1.15)}100%{transform:rotate(90deg) scale(1)}}
@keyframes v2-lune{0%,100%{transform:rotate(0)}40%{transform:rotate(-24deg)}75%{transform:rotate(8deg)}}
@keyframes v2-loupe{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(-16deg) scale(1.16) translate(-1px,-1px)}}
@media (max-width:767px){html:root{--flot-pastille:78px}}
/* Pied de page du site : decale a droite du rail fixe (ordinateur). */
@media (min-width:768px){body:has([data-fiche-rail]) footer[class*="bg-[#070707]"]{padding-left:calc(104px + 1.5rem)}}
.v2-ico{transform-origin:center;will-change:transform}
.v2a-barres{transform-origin:50% 90%}
.v2a-salut{transform-origin:50% 100%}
.v2a-balance{transform-origin:50% 20%}
@media (prefers-reduced-motion:no-preference){
.v2-item:hover .v2a-boussole,.v2-item:focus-visible .v2a-boussole{animation:v2-boussole .9s cubic-bezier(.3,1.4,.5,1)}
.v2-item:hover .v2a-barres,.v2-item:focus-visible .v2a-barres{animation:v2-barres .55s ease-out}
.v2-item:hover .v2a-pile,.v2-item:focus-visible .v2a-pile{animation:v2-pile .5s ease-out}
.v2-item:hover .v2a-trace,.v2-item:focus-visible .v2a-trace{animation:v2-trace .6s ease-out}
.v2-item:hover .v2a-cible,.v2-item:focus-visible .v2a-cible{animation:v2-cible .55s ease-out}
.v2-item:hover .v2a-secoue,.v2-item:focus-visible .v2a-secoue{animation:v2-secoue .55s ease-in-out}
.v2-item:hover .v2a-monte,.v2-item:focus-visible .v2a-monte{animation:v2-monte .5s ease-out}
.v2-item:hover .v2a-pulse,.v2-item:focus-visible .v2a-pulse{animation:v2-pulse .9s ease-in-out}
.v2-item:hover .v2a-page,.v2-item:focus-visible .v2a-page{animation:v2-page .6s ease-in-out}
.v2-item:hover .v2a-balance,.v2-item:focus-visible .v2a-balance{animation:v2-balance .8s ease-in-out}
.v2-item:hover .v2a-pop,.v2-item:focus-visible .v2a-pop{animation:v2-pop .4s ease-out}
.v2-item:hover .v2a-etoile,.v2-item:focus-visible .v2a-etoile{animation:v2-etoile .6s ease-out forwards}
.v2-item:hover .v2a-echange,.v2-item:focus-visible .v2a-echange{animation:v2-echange .5s ease-in-out}
.v2-item:hover .v2a-salut,.v2-item:focus-visible .v2a-salut{animation:v2-salut .55s ease-in-out}
.v2-item:hover .v2a-astre,.v2-item:focus-visible .v2a-astre{animation:v2-astre .7s ease-out forwards}
.v2-item:hover .v2a-lune,.v2-item:focus-visible .v2a-lune{animation:v2-lune .7s ease-in-out}
.v2-item:hover .v2a-loupe,.v2-item:focus-visible .v2a-loupe{animation:v2-loupe .5s ease-in-out}
}
`;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

type Mode = "light" | "dark";
type OutilId = "favoris" | "comparer" | "compte" | "theme" | "recherche";
type Outil = { id: OutilId; titre: string; Icon: LucideIcon; anim: string; couleur?: string; inerte?: boolean };

/** Mode affiche, lu sur <html data-theme> (pose par ThemeToggle). */
function useModeAffiche(): Mode {
  const [mode, setMode] = useState<Mode>("dark");
  useEffect(() => {
    const html = document.documentElement;
    const lire = () => setMode(html.getAttribute("data-theme") === "light" ? "light" : "dark");
    lire();
    const mo = new MutationObserver(lire);
    mo.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return mode;
}

function listeOutils(mode: Mode, anon: boolean): Outil[] {
  const l: Outil[] = [];
  // Favoris : reserve aux visiteurs connectes (comme le menu « Mes favoris »).
  if (!anon) l.push({ id: "favoris", titre: "Favoris", Icon: Star, anim: "etoile", couleur: "#fcd34d" });
  l.push({ id: "comparer", titre: "Comparer", Icon: GitCompare, anim: "echange", inerte: anon });
  l.push({ id: "compte", titre: "Mon compte", Icon: UserRound, anim: "salut" });
  l.push(mode === "light"
    ? { id: "theme", titre: "Passer en nuit", Icon: Moon, anim: "lune" }
    : { id: "theme", titre: "Passer en jour", Icon: Sun, anim: "astre" });
  l.push({ id: "recherche", titre: "Rechercher", Icon: Search, anim: "loupe", inerte: anon });
  return l;
}

type Panneau = { id: "favoris" | "comparer" | "compte" | "theme"; y: number } | null;

function PanneauOutil({ p, titre, onFermer, children, fermetureExterne = true, debordement = false }: { p: NonNullable<Panneau>; titre: string; onFermer: () => void; children: React.ReactNode; fermetureExterne?: boolean; debordement?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [haut, setHaut] = useState(16);
  useEffect(() => {
    const caler = () => {
      const z = zoomSite();
      const h = ref.current?.offsetHeight ?? 300;
      setHaut(Math.max(12, Math.min(p.y / z - 24, window.innerHeight / z - h - 12)));
    };
    caler();
    const ro = new ResizeObserver(caler);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [p.y]);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    const dehors = (e: Event) => {
      const cible = e.target as HTMLElement;
      // Les menus ouverts depuis le panneau (langue) vivent parfois hors de lui.
      if (cible.closest?.("[role=menu],[role=listbox]")) return;
      if (fermetureExterne && ref.current && !ref.current.contains(cible)) onFermer();
    };
    document.addEventListener("keydown", echap);
    document.addEventListener("pointerdown", dehors);
    return () => { document.removeEventListener("keydown", echap); document.removeEventListener("pointerdown", dehors); };
  }, [onFermer, fermetureExterne]);
  return (
    <motion.div ref={ref} role="dialog" aria-label={titre}
      initial={{ opacity: 0, x: -8, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -8, scale: 0.97 }} transition={{ duration: 0.16 }}
      className={`fixed inset-x-3 bottom-[84px] z-[60] ${debordement ? "" : "overflow-hidden"} rounded-2xl border border-[#262626] bg-[#0a0a0a] shadow-[0_18px_60px_rgba(0,0,0,0.65)] md:inset-x-auto md:bottom-auto md:left-[var(--v2-px)] md:top-[var(--v2-py)] md:w-80`}
      style={{ ["--v2-px" as string]: `${RAIL + 10}px`, ["--v2-py" as string]: `${haut}px` }}>
      <div className="flex items-center justify-between rounded-t-2xl border-b border-[#1a1a1a] px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-zinc-100">{titre}</span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"><X className="size-4" /></button>
      </div>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Rail ordinateur                                                     */
/* ------------------------------------------------------------------ */

type RailProps = {
  blocs: Bloc[];
  actif: string;
  accent: string;
  outils: Outil[];
  capture: boolean;
  onBloc: (id: string) => void;
  onOutil: (id: OutilId, y: number) => void;
};

function LogoRail({ ouvert }: { ouvert: boolean }) {
  return (
    <Link href="/" aria-label="Accueil Mettrik" className="relative flex h-[64px] shrink-0 items-center overflow-hidden border-b border-white/[0.06]">
      <span className={`absolute left-0 flex justify-center transition-all duration-200 ${ouvert ? "scale-75 opacity-0" : "opacity-100"}`} style={{ width: RAIL }}>
        <picture className="block select-none">
          <source srcSet="/brand/mettrik-mark.webp" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mettrik-mark.png" alt="Mettrik" className="h-8 w-auto select-none" draggable={false} />
        </picture>
      </span>
      <span className={`absolute left-0 flex justify-center transition-all duration-200 ${ouvert ? "scale-100 opacity-100" : "scale-90 opacity-0"}`} style={{ width: RAIL_OUVERT }}>
        <span className="block origin-center scale-[1.75]">
          <LogoMettrik emplacement="retour-societe" size="lg" animated={false} showRail={false} hauteurPng="30px" />
        </span>
      </span>
    </Link>
  );
}

function RailOrdinateur({ blocs, actif, accent, outils, capture, onBloc, onOutil }: RailProps) {
  const [ouvert, setOuvert] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const rech = outils.find((o) => o.id === "recherche");
  const autres = outils.filter((o) => o.id !== "recherche");
  const outil = (o: Outil, pleine = false) => (
    <button key={o.id} type="button" aria-label={o.titre} title={ouvert ? undefined : o.titre}
      aria-disabled={o.inerte || undefined}
      className={`v2-item group flex h-9 min-w-0 items-center text-left outline-none ${o.inerte ? "pointer-events-none opacity-40" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (o.inerte) return; const r = e.currentTarget.getBoundingClientRect(); onOutil(o.id, r.top + r.height / 2); setOuvert(false); }}>
      <span className="flex shrink-0 justify-center" style={{ width: pleine ? RAIL : RAIL / 2 }}>
        <span className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-colors group-hover:bg-white/[0.06] group-hover:text-zinc-100">
          <o.Icon className={`v2-ico v2a-${o.anim} size-[18px]`} style={o.couleur ? { color: o.couleur } : undefined} aria-hidden />
        </span>
      </span>
      <span className={`min-w-0 whitespace-nowrap pr-2 text-[12.5px] text-zinc-300 transition-opacity duration-200 ${ouvert ? "opacity-100" : "opacity-0"}`}>{o.titre}</span>
    </button>
  );
  return (
    // Vitrine anonyme : le rail passe au-dessus du voile d inscription (z 60) pour garder « Mon compte ».
    <div data-rail-gauche data-fiche-rail className={`fixed inset-y-0 left-0 hidden md:block ${capture ? "z-[61]" : "z-50"}`} style={{ width: RAIL }}>
      <nav ref={navRef} aria-label="Blocs de la fiche"
        onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)}
        onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) setOuvert(true); }} onBlur={(e) => { if (!navRef.current?.contains(e.relatedTarget as Node)) setOuvert(false); }}
        className={`absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-white/10 bg-[#08080a] transition-[width,box-shadow] duration-200 ease-out ${ouvert ? "shadow-[14px_0_44px_rgba(0,0,0,0.6)]" : ""}`}
        style={{ width: ouvert ? RAIL_OUVERT : RAIL, ["--v2-acc" as string]: accent }}>
        <LogoRail ouvert={ouvert} />
        {rech && <div className="flex shrink-0 flex-col border-b border-white/[0.06] py-1.5">{outil(rech, true)}</div>}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="my-auto flex flex-col py-2">
            <div role="tablist" aria-orientation="vertical" className="flex flex-col">
              {blocs.map((b) => {
                const on = b.id === actif;
                return (
                  <button key={b.id} type="button" role="tab" aria-selected={on} aria-label={b.titre} data-rail-bloc={b.id}
                    onClick={() => { onBloc(b.id); setOuvert(false); }}
                    className="v2-item group relative flex w-full shrink-0 items-center text-left outline-none">
                    {on && <motion.span layoutId="fiche-rail-trait" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: accent }} />}
                    <span className="flex shrink-0 flex-col items-center gap-[2px] px-1.5 py-[3px]" style={{ width: RAIL }}>
                      <span className={`flex size-7 items-center justify-center rounded-xl transition-colors duration-150 ${on ? "bg-white/[0.09]" : "group-hover:bg-white/[0.06] group-focus-visible:bg-white/[0.06]"}`}
                        style={on ? { boxShadow: `inset 0 0 0 1px ${accent}40` } : undefined}>
                        <b.Icon className={`v2-ico v2a-${b.anim} size-[19px] transition-colors`} style={{ color: on ? accent : undefined }} aria-hidden />
                      </span>
                      <span className={`w-full text-center text-[11px] leading-[1.15] transition-opacity duration-150 ${ouvert ? "opacity-0" : "opacity-100"} ${on ? "font-semibold text-zinc-50" : "text-zinc-400 group-hover:text-zinc-200"}`}>{b.titre}</span>
                    </span>
                    <span className={`min-w-0 flex-1 pr-4 transition-opacity duration-200 ${ouvert ? "opacity-100 delay-75" : "pointer-events-none opacity-0"}`}>
                      <span className={`block whitespace-nowrap text-[13.5px] ${on ? "font-semibold text-zinc-50" : "text-zinc-200"}`}>{b.titre}</span>
                      <span className="block whitespace-nowrap text-[11.5px] text-zinc-500">{b.phrase}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mx-4 my-2 h-px shrink-0 bg-white/10" />
            <div className="grid shrink-0 grid-cols-2 gap-y-0.5">
              {autres.map((o) => outil(o))}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile : barre d onglets en bas + tiroir                            */
/* ------------------------------------------------------------------ */

function BarreMobile({ blocs, actif, accent, outils, capture, onBloc, onOutil }: RailProps) {
  const [tiroir, setTiroir] = useState(false);
  const piste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = piste.current?.querySelector<HTMLElement>(`[data-bloc="${actif}"]`);
    const p = piste.current;
    // Recentrage horizontal de la piste seule (scrollIntoView ferait aussi defiler la page).
    if (el && p) p.scrollTo({ left: el.offsetLeft - (p.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [actif]);
  useEffect(() => {
    if (!tiroir) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [tiroir]);
  return (
    <>
      <div className={`fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#08080a]/[0.98] pb-[env(safe-area-inset-bottom)] md:hidden ${capture ? "z-[61]" : "z-50"}`} style={{ ["--v2-acc" as string]: accent }}>
        <div className="flex items-stretch">
          <div ref={piste} role="tablist" className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maskImage: "linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 18px),transparent)" }}>
            {blocs.map((b) => {
              const on = b.id === actif;
              return (
                <button key={b.id} data-bloc={b.id} type="button" role="tab" aria-selected={on} onClick={() => onBloc(b.id)}
                  className="v2-item relative flex w-[74px] shrink-0 flex-col items-center gap-1 px-1 pb-2 pt-2.5">
                  {on && <motion.span layoutId="fiche-rail-trait-m" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full" style={{ background: accent }} />}
                  <b.Icon className={`v2-ico v2a-${b.anim} size-[20px]`} style={{ color: on ? accent : "#8b8b94" }} aria-hidden />
                  <span className={`line-clamp-2 text-center text-[10.5px] leading-[1.15] ${on ? "font-semibold text-zinc-50" : "text-zinc-400"}`}>{b.titre}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setTiroir(true)} aria-label="Ouvrir le menu : tous les blocs et les outils"
            className="flex w-[64px] shrink-0 flex-col items-center justify-center gap-1 border-l border-white/10 text-zinc-300">
            <Menu className="size-[20px]" aria-hidden />
            <span className="text-[10.5px]">Menu</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {tiroir && (
          <>
            <motion.button type="button" aria-label="Fermer le menu" onClick={() => setTiroir(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[62] bg-black/60 md:hidden" />
            <motion.div role="dialog" aria-label="Menu de la fiche"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 90) setTiroir(false); }}
              className="fixed inset-x-0 bottom-0 z-[63] max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0a0a0c] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 md:hidden"
              style={{ ["--v2-acc" as string]: accent }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-3 flex items-center justify-between">
                <Link href="/" aria-label="Accueil Mettrik"><LogoMettrik emplacement="retour-societe" size="md" animated={false} showRail={false} hauteurPng="30px" /></Link>
                <button type="button" onClick={() => setTiroir(false)} aria-label="Fermer" className="rounded-full p-2 text-zinc-400 hover:bg-white/5"><X className="size-5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {blocs.map((b) => {
                  const on = b.id === actif;
                  return (
                    <button key={b.id} type="button" onClick={() => { onBloc(b.id); setTiroir(false); }}
                      className={`v2-item flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5 ${on ? "bg-white/[0.07]" : "border-white/[0.07] bg-white/[0.02]"}`}
                      style={on ? { borderColor: `${accent}80` } : undefined}>
                      <b.Icon className={`v2-ico v2a-${b.anim} size-[22px]`} style={{ color: on ? accent : "#a1a1aa" }} aria-hidden />
                      <span className={`text-center text-[11.5px] leading-tight ${on ? "font-semibold text-zinc-50" : "text-zinc-300"}`}>{b.titre}</span>
                    </button>
                  );
                })}
              </div>
              <div className="my-4 h-px bg-white/10" />
              <div className="grid grid-cols-5 gap-1">
                {outils.map((o) => (
                  <button key={o.id} type="button" aria-disabled={o.inerte || undefined}
                    className={`v2-item flex flex-col items-center gap-1.5 py-1 ${o.inerte ? "pointer-events-none opacity-40" : ""}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => { if (o.inerte) return; setTiroir(false); onOutil(o.id, 0); }}>
                    <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                      <o.Icon className={`v2-ico v2a-${o.anim} size-[18px]`} style={{ color: o.couleur ?? "#d4d4d8" }} aria-hidden />
                    </span>
                    <span className="text-center text-[10.5px] leading-tight text-zinc-300">{o.titre}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ligne compacte de l en-tete (au defilement)                         */
/* ------------------------------------------------------------------ */

function devise(t: string): string {
  const s = t.toUpperCase();
  if (/\.(PA|DE|AS|MI|MC|BR|LS|HE|VI|IR|F)$/.test(s)) return "€";
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".L")) return "£";
  return "$";
}

/** Cours et variation du jour, meme source que le bloc de cours de l en-tete (/api/stock-prices). */
function useCours(ticker: string, actif: boolean) {
  const [v, setV] = useState<{ prix: number; var: number } | null>(null);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const lire = () => fetch(`/api/stock-prices?symbols=${encodeURIComponent(ticker)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const p = d?.prices?.[0]; if (vivant && p?.price != null) setV({ prix: p.price, var: p.deltaPct ?? 0 }); })
      .catch(() => {});
    void lire();
    const t = window.setInterval(lire, 60_000);
    return () => { vivant = false; window.clearInterval(t); };
  }, [ticker, actif]);
  return v;
}

function EnteteCompact({ c, accent, afficherCours }: { c: Company; accent: string; afficherCours: boolean }) {
  const cours = useCours(c.ticker, afficherCours);
  const hausse = (cours?.var ?? 0) >= 0;
  const fmt = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <motion.div initial={{ y: -COMPACT_PX }} animate={{ y: 0 }} exit={{ y: -COMPACT_PX }} transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-[45] flex items-center gap-3 border-b border-white/[0.08] bg-[#050505]/[0.97] px-4 md:left-[var(--v2-rail)] md:px-6"
      style={{ height: COMPACT_PX, ["--v2-rail" as string]: `${RAIL}px` }}>
      <div className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ${logoNeedsLightBg(c.ticker) ? "preserve-colors bg-white ring-black/15" : "bg-[#0a0a0a] ring-white/10"}`}>
        <div className="size-full p-1"><CompanyLogo ticker={c.ticker} /></div>
      </div>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-[16px] font-bold text-zinc-50 md:text-[17px]">{c.name}</span>
        <span className="shrink-0 font-mono text-[13px] font-semibold" style={{ color: accent }}>{displayTicker(c.ticker, new Set())}</span>
      </div>
      {cours && (
        <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
          <span className="text-[16px] font-semibold text-zinc-50">{fmt(cours.prix)} {devise(c.ticker)}</span>
          <span className="text-[12.5px] font-semibold" style={{ color: hausse ? "#10b981" : "#f43f5e" }}>{hausse ? "+" : ""}{fmt(cours.var)} %</span>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Coque                                                               */
/* ------------------------------------------------------------------ */

export function FicheRail({
  company,
  blocsDispo,
  accent,
  entete,
  paid,
  anon,
  capture,
  authSlot,
  activeKpi,
  comparerActif,
  onComparePick,
  afficherCours,
}: {
  company: Company;
  /** Blocs reellement rendus sur la page (meme ordre que BLOCS_FICHE). */
  blocsDispo: BlocFicheId[];
  accent: string;
  /** En-tete de la societe (CompanyHeader sans les rangs). */
  entete: React.ReactNode;
  paid: boolean;
  anon: boolean;
  /** Vitrine anonyme : tout clic hors compte mene a l inscription. */
  capture: boolean;
  authSlot?: React.ReactNode;
  activeKpi: KPI;
  comparerActif: boolean;
  onComparePick: (t: string) => void;
  afficherCours: boolean;
}) {
  const dispo = new Set(blocsDispo);
  const blocs = BLOCS_FICHE.filter((b) => dispo.has(b.id));
  const cleBlocs = blocs.map((b) => b.id).join(",");
  const [actif, setActif] = useState<string>(blocs[0]?.id ?? "apercu");
  const [panneau, setPanneau] = useState<Panneau>(null);
  const mode = useModeAffiche();
  const outils = listeOutils(mode, anon).filter((o) => o.id !== "comparer" || comparerActif);
  const refEntete = useRef<HTMLDivElement>(null);
  const refRecherche = useRef<HTMLDivElement>(null);
  const refTheme = useRef<HTMLDivElement>(null);

  // En-tete : colle en entier s il est bas (ordinateur) ; sinon il defile et
  // une ligne compacte fixe de 60 px prend le relais des qu il sort de l ecran.
  const [grand, setGrand] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = refEntete.current;
    if (!el) return;
    const maj = () => {
      const z = zoomSite();
      const g = window.innerWidth / z < 768 || el.offsetHeight > 140;
      setGrand(g);
      setCompact(g && el.getBoundingClientRect().bottom / z < COMPACT_PX);
      document.documentElement.style.setProperty(VAR_ENTETE, `${g ? COMPACT_PX : el.offsetHeight}px`);
    };
    maj();
    const ro = new ResizeObserver(maj);
    ro.observe(el);
    window.addEventListener("scroll", maj, { passive: true });
    window.addEventListener("resize", maj);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", maj);
      window.removeEventListener("resize", maj);
      document.documentElement.style.removeProperty(VAR_ENTETE);
    };
  }, []);

  // Navigation : clic = defilement jusqu au bloc (sous l en-tete) ; au
  // defilement, le bloc dont le haut a passe la ligne de l en-tete est actif.
  const verrou = useRef(0);
  const vise = useRef<string | null>(null);
  useEffect(() => {
    const ids = cleBlocs ? cleBlocs.split(",") : [];
    const maj = () => {
      if (Date.now() < verrou.current) return;
      const ligne = hauteurEnteteFiche() + 24 + window.innerHeight * 0.15;
      let courant = ids[0] ?? "apercu";
      for (const id of ids) {
        const el = sectionDe(id);
        if (el && el.getBoundingClientRect().top <= ligne) courant = id;
      }
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        const visibles = ids.filter((id) => { const el = sectionDe(id); return el && el.getBoundingClientRect().top < window.innerHeight; });
        if (visibles.length) courant = visibles[visibles.length - 1];
      }
      setActif(courant);
    };
    maj();
    window.addEventListener("scroll", maj, { passive: true });
    window.addEventListener("resize", maj);
    const fin = () => {
      const cible = vise.current;
      vise.current = null;
      if (cible) {
        const el = sectionDe(cible);
        const ecart = el ? el.getBoundingClientRect().top - hauteurEnteteFiche() - 16 : 0;
        if (el && cible !== ids[0] && Math.abs(ecart) > 8) {
          verrou.current = Date.now() + 800;
          window.scrollTo({ top: window.scrollY + ecart, behavior: "smooth" });
          return;
        }
      }
      verrou.current = 0;
      maj();
    };
    window.addEventListener("scrollend", fin);
    return () => { window.removeEventListener("scroll", maj); window.removeEventListener("resize", maj); window.removeEventListener("scrollend", fin); };
  }, [cleBlocs]);

  const versInscription = () => { window.location.href = lienInscription(); };
  const choisirBloc = (id: string) => {
    if (capture) { versInscription(); return; }
    const el = sectionDe(id);
    if (!el) return;
    setActif(id);
    verrou.current = Date.now() + 1500;
    vise.current = id;
    const haut = id === blocs[0]?.id ? 0 : window.scrollY + el.getBoundingClientRect().top - hauteurEnteteFiche() - 16;
    window.scrollTo({ top: Math.max(0, haut), behavior: "smooth" });
  };
  const fermerPanneau = useCallback(() => setPanneau(null), []);
  const onOutil = (id: OutilId, y: number) => {
    if (capture && id !== "compte") { versInscription(); return; }
    if (id === "recherche") {
      refRecherche.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
      return;
    }
    if (id === "theme") {
      if (!paid) { setPanneau((p) => (p?.id === "theme" ? null : { id: "theme", y })); return; }
      // Le vrai ThemeToggle (monte hors ecran) garde sa logique : stockage, compte, gating.
      const cible = mode === "light" ? "Mode sombre" : "Mode clair";
      refTheme.current?.querySelector<HTMLButtonElement>(`button[aria-label="${cible}"]`)?.click();
      return;
    }
    setPanneau((p) => (p?.id === id ? null : { id, y }));
  };

  const rail = { blocs, actif, accent, outils, capture, onBloc: choisirBloc, onOutil };

  return (
    <>
      <style>{STYLE_ANIM}</style>
      <RailOrdinateur {...rail} />
      <BarreMobile {...rail} />
      {/* Declencheurs reels du site, hors ecran : recherche (panneau plein ecran) et bascule jour/nuit. */}
      <div ref={refRecherche} className="fixed -left-[400vw] top-0 z-[150]">
        <PageSearch variant="default" />
      </div>
      <div ref={refTheme} aria-hidden className="fixed -left-[400vw] top-0">
        <ThemeToggle paid={paid} />
      </div>

      {/* En-tete collant : la barre du nom de la societe, rien au-dessus. */}
      <div ref={refEntete} data-entete-fiche className={`${grand ? "relative" : "sticky top-0"} z-[45] -mx-4 -mt-7 border-b border-white/[0.07] bg-[#050505] px-4 pb-3 pt-4 sm:-mx-6 sm:-mt-9 sm:px-6`}>
        {entete}
      </div>
      <AnimatePresence>
        {compact && <EnteteCompact key="compact" c={company} accent={accent} afficherCours={afficherCours} />}
      </AnimatePresence>

      <AnimatePresence>
        {panneau?.id === "favoris" && (
          <PanneauOutil key="favoris" p={panneau} titre="Favoris" onFermer={fermerPanneau}>
            <div className="flex items-center gap-2.5 border-b border-[#1a1a1a] px-3.5 py-3">
              <StarButton ticker={company.ticker} mode="company" size="md" />
              <span className="text-[13px] text-zinc-200">Suivre {company.name}</span>
            </div>
            <Link href="/mes-societes" className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:bg-[#141414]"><Bookmark className="size-4 text-violet-300" /> Mes sociétés</Link>
            <Link href="/account/favorites" className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:bg-[#141414]"><Star className="size-4 text-amber-300" /> Mes KPI</Link>
          </PanneauOutil>
        )}
        {panneau?.id === "comparer" && (
          <PanneauOutil key="comparer" p={panneau} titre="Comparer" onFermer={fermerPanneau} fermetureExterne={false}>
            {/* Le vrai comparateur de la fiche, ouvert d office : son bouton est masque, sa liste s affiche dans le panneau. */}
            <div className="[&>div>button]:hidden [&>div>div]:!static [&>div>div]:!w-full [&>div>div]:!rounded-none [&>div>div]:!border-0 [&>div>div]:!shadow-none">
              <CompareControl ticker={company.ticker} activeKpi={activeKpi} open onToggle={fermerPanneau}
                onPick={(t) => { onComparePick(t); setPanneau(null); }} />
            </div>
          </PanneauOutil>
        )}
        {panneau?.id === "compte" && (
          <PanneauOutil key="compte" p={panneau} titre="Mon compte" onFermer={fermerPanneau} debordement>
            {/* Bloc compte du serveur (langue, connexion ou acces au compte), inchange. */}
            <div className="relative z-[70] flex flex-wrap items-center gap-2 px-3.5 py-3">{authSlot}</div>
            {anon && (
              <Link href="/?auth=signup" className="mx-3.5 mb-3 block rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-2 text-center text-[13px] font-semibold text-violet-50 sm:hidden">
                S&apos;inscrire
              </Link>
            )}
          </PanneauOutil>
        )}
        {panneau?.id === "theme" && (
          <PanneauOutil key="theme" p={panneau} titre="Mode jour" onFermer={fermerPanneau}>
            <div className="flex items-start gap-2.5 px-3.5 py-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
              <div>
                <div className="text-[13px] font-semibold text-zinc-100">Le mode clair est réservé aux abonnés</div>
                <div className="mt-1 text-[12px] leading-snug text-zinc-400">Débloquez aussi toutes les fiches, sans floutage.</div>
                <Link href="/pricing" className="mt-2 inline-flex rounded-md bg-violet-500 px-2.5 py-1 text-[12px] font-semibold text-white">Voir les offres</Link>
              </div>
            </div>
          </PanneauOutil>
        )}
      </AnimatePresence>
    </>
  );
}
