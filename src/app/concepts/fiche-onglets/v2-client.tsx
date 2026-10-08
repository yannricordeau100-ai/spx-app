"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, Compass, BarChart3, Layers, LineChart, Target, AlertTriangle, Building2, Brain, FileText, Scale, Rows3, ShieldCheck,
  Star, GitCompare, UserRound, Sun, Moon, Search, Menu, X, Bookmark, type LucideIcon,
} from "lucide-react";
import { brand } from "@/lib/brand";
import type { KPI } from "@/lib/data";
import { FreemiumBlurProvider } from "@/lib/freemium/context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CompanyHeader } from "@/components/company-header";
import { BandeauIpoRecente } from "@/components/young-ipo-warning";
import { CompanyProfileCard } from "@/components/company-profile-card";
import { CompanySearch } from "@/components/company-search";
import { CompareControl } from "@/components/compare-control";
import { ComparePanel } from "@/components/compare-panel";
import { StarButton } from "@/components/star-button";
import { LogoMettrik } from "@/components/logo-mettrik";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { displayTicker } from "@/lib/ticker-display";
import type { FicheDemo } from "./data";
import { Contenu, ongletsDe, kpisAffiches } from "./contenu";
import { BlocIndicateurs } from "./v2-indicateurs";

/* ------------------------------------------------------------------ */
/* Blocs du rail                                                       */
/* ------------------------------------------------------------------ */

type Bloc = { id: string; titre: string; Icon: LucideIcon; phrase: string; anim: string };

/** Ordre de la fiche. « Sources » retire, « Résultats et transcripts » renomme, « Intégral » sous la thèse. */
const BLOCS: Bloc[] = [
  { id: "apercu", titre: "Aperçu", Icon: Compass, phrase: "Rangs, description et chiffres de marché", anim: "boussole" },
  { id: "kpi", titre: "Indicateurs clés", Icon: BarChart3, phrase: "Graphique du KPI principal et liste des indicateurs", anim: "barres" },
  { id: "stories", titre: "KPI court terme", Icon: Layers, phrase: "Les indicateurs récents en cartes", anim: "pile" },
  { id: "moyen", titre: "Moyen terme", Icon: LineChart, phrase: "Graphiques de sources externes", anim: "trace" },
  { id: "marche", titre: "Marché et TAM", Icon: Target, phrase: "Chiffre d’affaires, clients, avantage, marché", anim: "cible" },
  { id: "risques", titre: "Risques", Icon: AlertTriangle, phrase: "Facteurs de risque suivis", anim: "secoue" },
  { id: "gouv", titre: "Gouvernance et rachats", Icon: Building2, phrase: "Dirigeants, votes, sociétés rachetées", anim: "monte" },
  { id: "ia", titre: "IA", Icon: Brain, phrase: "Positionnement en intelligence artificielle", anim: "pulse" },
  { id: "resultats", titre: "Publications officielles", Icon: FileText, phrase: "Résultats publiés et dernier appel", anim: "page" },
  { id: "these", titre: "Thèse et anti-thèse", Icon: Scale, phrase: "Cas favorable et cas défavorable", anim: "balance" },
  { id: "integral", titre: "Intégral", Icon: Rows3, phrase: "Tous les blocs les uns sous les autres", anim: "deroule" },
  { id: "admin", titre: "Admin", Icon: ShieldCheck, phrase: "Cours de bourse et KPI sur-mesure", anim: "pop" },
];

const RAIL = 92;
const RAIL_OUVERT = 288;

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
@keyframes v2-deroule{0%,100%{transform:scaleY(1)}45%{transform:scaleY(1.28)}}
@keyframes v2-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
@keyframes v2-etoile{0%{transform:rotate(0) scale(1)}55%{transform:rotate(86deg) scale(1.22)}100%{transform:rotate(72deg) scale(1)}}
@keyframes v2-echange{0%,100%{transform:translateX(0)}30%{transform:translateX(-3px)}65%{transform:translateX(3px)}}
@keyframes v2-salut{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(-3px) rotate(-6deg)}70%{transform:translateY(0) rotate(5deg)}}
@keyframes v2-astre{0%{transform:rotate(0) scale(1)}60%{transform:rotate(100deg) scale(1.15)}100%{transform:rotate(90deg) scale(1)}}
@keyframes v2-lune{0%,100%{transform:rotate(0)}40%{transform:rotate(-24deg)}75%{transform:rotate(8deg)}}
@keyframes v2-loupe{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(-16deg) scale(1.16) translate(-1px,-1px)}}
/* Mobile : les boutons ronds du site (aide, remonter) passent au-dessus de la barre basse. */
@media (max-width:767px){html:root{--flot-pastille:78px}}
.v2-ico{transform-origin:center;will-change:transform}
.v2a-barres,.v2a-deroule{transform-origin:50% 90%}
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
.v2-item:hover .v2a-deroule,.v2-item:focus-visible .v2a-deroule{animation:v2-deroule .5s ease-out}
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
/* Theme jour / nuit : meme mecanique que components/theme-toggle.tsx */
/* (cle localStorage, filtre sur <html>, preference du compte).        */
/* ------------------------------------------------------------------ */

const CLE_THEME = "mettrik:theme";
type Mode = "light" | "dark";
function appliqueTheme(m: Mode) {
  const html = document.documentElement;
  if (m === "light") {
    html.style.filter = "invert(1) hue-rotate(180deg)";
    html.style.background = "#fff";
    html.setAttribute("data-theme", "light");
  } else {
    html.style.filter = "";
    html.style.background = "";
    html.setAttribute("data-theme", "dark");
  }
}
function useTheme() {
  const [mode, setMode] = useState<Mode>("dark");
  useEffect(() => {
    try {
      const explicite = window.localStorage.getItem(`${CLE_THEME}:explicit`) === "1";
      const stocke = window.localStorage.getItem(CLE_THEME) as Mode | null;
      if (explicite && stocke === "light") appliqueTheme("light");
    } catch { /* stockage indisponible : on reste en sombre */ }
    setMode(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);
  const basculer = useCallback(() => {
    const suivant: Mode = mode === "light" ? "dark" : "light";
    appliqueTheme(suivant);
    setMode(suivant);
    try {
      window.localStorage.setItem(CLE_THEME, suivant);
      window.localStorage.setItem(`${CLE_THEME}:explicit`, "1");
    } catch { /* rien */ }
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) await supabase.auth.updateUser({ data: { theme: suivant } });
      } catch { /* la preference locale suffit */ }
    })();
  }, [mode]);
  return { mode, basculer };
}

/* ------------------------------------------------------------------ */
/* Outils du site (sous le trait du rail)                              */
/* ------------------------------------------------------------------ */

type OutilId = "favoris" | "comparer" | "compte" | "theme" | "recherche";
type Outil = { id: OutilId; titre: string; Icon: LucideIcon; anim: string; couleur?: string };

function outils(mode: Mode): Outil[] {
  return [
    { id: "favoris", titre: "Favoris", Icon: Star, anim: "etoile", couleur: "#fcd34d" },
    { id: "comparer", titre: "Comparer", Icon: GitCompare, anim: "echange" },
    { id: "compte", titre: "Mon compte", Icon: UserRound, anim: "salut" },
    mode === "light"
      ? { id: "theme", titre: "Passer en nuit", Icon: Moon, anim: "lune" }
      : { id: "theme", titre: "Passer en jour", Icon: Sun, anim: "astre" },
    { id: "recherche", titre: "Rechercher", Icon: Search, anim: "loupe" },
  ];
}

type Panneau = { id: "favoris" | "comparer"; y: number } | null;

/** Panneau flottant d un outil : a cote du rail sur ordinateur, au-dessus de la barre basse sur mobile. */
function PanneauOutil({ p, titre, onFermer, children, fermetureExterne = true }: { p: NonNullable<Panneau>; titre: string; onFermer: () => void; children: React.ReactNode; fermetureExterne?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [haut, setHaut] = useState(16);
  useEffect(() => {
    // Le site applique un zoom sur <body> : les mesures d ecran sont converties en px CSS.
    const caler = () => {
      const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
      const h = ref.current?.offsetHeight ?? 300;
      setHaut(Math.max(12, Math.min(p.y / z - 24, window.innerHeight / z - h - 12)));
    };
    caler();
    // Le contenu (liste du comparateur) arrive apres coup : on recale quand la hauteur change.
    const ro = new ResizeObserver(caler);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [p.y]);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    const dehors = (e: Event) => { if (fermetureExterne && ref.current && !ref.current.contains(e.target as Node)) onFermer(); };
    document.addEventListener("keydown", echap);
    document.addEventListener("pointerdown", dehors);
    return () => { document.removeEventListener("keydown", echap); document.removeEventListener("pointerdown", dehors); };
  }, [onFermer, fermetureExterne]);
  return (
    <motion.div ref={ref} role="dialog" aria-label={titre}
      initial={{ opacity: 0, x: -8, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -8, scale: 0.97 }} transition={{ duration: 0.16 }}
      className="fixed inset-x-3 bottom-[84px] z-[60] overflow-hidden rounded-2xl border border-[#262626] bg-[#0a0a0a] shadow-[0_18px_60px_rgba(0,0,0,0.65)] md:inset-x-auto md:bottom-auto md:left-[var(--v2-px)] md:top-[var(--v2-py)] md:w-80"
      style={{ ["--v2-px" as string]: `${RAIL + 10}px`, ["--v2-py" as string]: `${haut}px` }}>
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-3.5 py-2.5">
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
  mode: Mode;
  onBloc: (id: string) => void;
  onOutil: (id: OutilId, y: number) => void;
};

function LogoRail({ ouvert }: { ouvert: boolean }) {
  return (
    <Link href="/" aria-label="Accueil Mettrik" className="relative flex h-[54px] shrink-0 items-center overflow-hidden border-b border-white/[0.06]">
      <span className={`absolute left-0 flex w-[92px] justify-center transition-all duration-200 ${ouvert ? "scale-75 opacity-0" : "opacity-100"}`}>
        {/* Logo simple (marque seule), public/brand/mettrik-mark */}
        <picture className="block select-none">
          <source srcSet="/brand/mettrik-mark.webp" type="image/webp" />
          <img src="/brand/mettrik-mark.png" alt="Mettrik" className="h-8 w-auto select-none" draggable={false} />
        </picture>
      </span>
      <span className={`absolute left-5 transition-all duration-200 ${ouvert ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}>
        {/* Logo complet, pilote par la logotheque comme le retour de la fiche */}
        <LogoMettrik emplacement="retour-societe" size="md" animated={false} showRail={false} hauteurPng="30px" />
      </span>
    </Link>
  );
}

function RailOrdinateur({ blocs, actif, accent, mode, onBloc, onOutil }: RailProps) {
  const [ouvert, setOuvert] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  return (
    <div className="fixed inset-y-0 left-0 z-40 hidden md:block" style={{ width: RAIL }}>
      <nav ref={navRef} aria-label="Blocs de la fiche"
        onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)}
        onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) setOuvert(true); }} onBlur={(e) => { if (!navRef.current?.contains(e.relatedTarget as Node)) setOuvert(false); }}
        className={`absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-white/10 bg-[#08080a] transition-[width,box-shadow] duration-200 ease-out ${ouvert ? "shadow-[14px_0_44px_rgba(0,0,0,0.6)]" : ""}`}
        style={{ width: ouvert ? RAIL_OUVERT : RAIL, ["--v2-acc" as string]: accent }}>
        <LogoRail ouvert={ouvert} />
        <div role="tablist" aria-orientation="vertical" className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {blocs.map((b) => {
            const on = b.id === actif;
            return (
              <button key={b.id} type="button" role="tab" aria-selected={on} aria-label={b.titre}
                onClick={() => { onBloc(b.id); setOuvert(false); }}
                className="v2-item group relative flex w-full shrink-0 items-center text-left outline-none">
                {on && <motion.span layoutId="v2-trait" className="absolute left-0 inset-y-2 w-[3px] rounded-r-full" style={{ background: accent }} />}
                <span className="flex w-[92px] shrink-0 flex-col items-center gap-[2px] px-1.5 py-[3px]">
                  <span className={`flex size-7 items-center justify-center rounded-xl transition-colors duration-150 ${on ? "bg-white/[0.09]" : "group-hover:bg-white/[0.06] group-focus-visible:bg-white/[0.06]"}`}
                    style={on ? { boxShadow: `inset 0 0 0 1px ${accent}40` } : undefined}>
                    <b.Icon className={`v2-ico v2a-${b.anim} size-[19px] transition-colors`} style={{ color: on ? accent : undefined }} aria-hidden />
                  </span>
                  <span className={`w-full text-center text-[11px] leading-[1.15] transition-opacity duration-150 ${ouvert ? "opacity-0" : "opacity-100"} ${on ? "font-semibold text-zinc-50" : "text-zinc-400 group-hover:text-zinc-200"}`}>{b.titre}</span>
                </span>
                <span className={`min-w-0 flex-1 pr-4 transition-opacity duration-200 ${ouvert ? "opacity-100 delay-75" : "pointer-events-none opacity-0"}`}>
                  <span className={`block truncate text-[13.5px] ${on ? "font-semibold text-zinc-50" : "text-zinc-200"}`}>{b.titre}</span>
                  <span className="block truncate text-[11.5px] text-zinc-500">{b.phrase}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mx-4 h-px shrink-0 bg-white/10" />
        <div className="grid shrink-0 grid-cols-2 gap-y-0.5 px-0 py-1.5">
          {outils(mode).map((o) => {
            const corps = (
              <>
                <span className="flex w-[46px] shrink-0 justify-center">
                  <span className="flex size-8 items-center justify-center rounded-xl text-zinc-400 transition-colors group-hover:bg-white/[0.06] group-hover:text-zinc-100">
                    <o.Icon className={`v2-ico v2a-${o.anim} size-[18px]`} style={o.couleur ? { color: o.couleur } : undefined} aria-hidden />
                  </span>
                </span>
                <span className={`min-w-0 truncate pr-2 text-[12.5px] text-zinc-300 transition-opacity duration-200 ${ouvert ? "opacity-100" : "opacity-0"}`}>{o.titre}</span>
              </>
            );
            const cls = "v2-item group flex h-9 min-w-0 items-center text-left outline-none";
            if (o.id === "compte") {
              return <Link key={o.id} href="/account" aria-label={o.titre} title={ouvert ? undefined : o.titre} className={cls}>{corps}</Link>;
            }
            return (
              <button key={o.id} type="button" aria-label={o.titre} title={ouvert ? undefined : o.titre} className={cls}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onOutil(o.id, r.top + r.height / 2); setOuvert(false); }}>
                {corps}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile : barre d onglets en bas + tiroir                            */
/* ------------------------------------------------------------------ */

function BarreMobile({ blocs, actif, accent, mode, onBloc, onOutil }: RailProps) {
  const [tiroir, setTiroir] = useState(false);
  const piste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = piste.current?.querySelector<HTMLElement>(`[data-bloc="${actif}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [actif]);
  useEffect(() => {
    if (!tiroir) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [tiroir]);
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#08080a]/[0.98] pb-[env(safe-area-inset-bottom)] md:hidden" style={{ ["--v2-acc" as string]: accent }}>
        <div className="flex items-stretch">
          <div ref={piste} role="tablist" className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maskImage: "linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 18px),transparent)" }}>
            {blocs.map((b) => {
              const on = b.id === actif;
              return (
                <button key={b.id} data-bloc={b.id} type="button" role="tab" aria-selected={on} onClick={() => onBloc(b.id)}
                  className="v2-item relative flex w-[74px] shrink-0 flex-col items-center gap-1 px-1 pb-2 pt-2.5">
                  {on && <motion.span layoutId="v2-trait-m" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full" style={{ background: accent }} />}
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
              className="fixed inset-0 z-[55] bg-black/60 md:hidden" />
            <motion.div role="dialog" aria-label="Menu de la fiche"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 90) setTiroir(false); }}
              className="fixed inset-x-0 bottom-0 z-[56] max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0a0a0c] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 md:hidden"
              style={{ ["--v2-acc" as string]: accent }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-3 flex items-center justify-between">
                <LogoMettrik emplacement="retour-societe" size="md" animated={false} showRail={false} hauteurPng="30px" />
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
                {outils(mode).map((o) => {
                  const corps = (
                    <>
                      <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                        <o.Icon className={`v2-ico v2a-${o.anim} size-[18px]`} style={{ color: o.couleur ?? "#d4d4d8" }} aria-hidden />
                      </span>
                      <span className="text-center text-[10.5px] leading-tight text-zinc-300">{o.titre}</span>
                    </>
                  );
                  const cls = "v2-item flex flex-col items-center gap-1.5 py-1";
                  if (o.id === "compte") return <Link key={o.id} href="/account" className={cls}>{corps}</Link>;
                  return (
                    <button key={o.id} type="button" className={cls} onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => { setTiroir(false); onOutil(o.id, 0); }}>
                      {corps}
                    </button>
                  );
                })}
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

const COMPACT_PX = 60;

function devise(t: string): string {
  const s = t.toUpperCase();
  if (/\.(PA|DE|AS|MI|MC|BR|LS|HE|VI|IR|F)$/.test(s)) return "€";
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".L")) return "£";
  return "$";
}

/** Cours et variation du jour, meme source que le bloc de cours de l en-tete (/api/stock-prices). */
function useCours(ticker: string) {
  const [v, setV] = useState<{ prix: number; var: number } | null>(null);
  useEffect(() => {
    let vivant = true;
    const lire = () => fetch(`/api/stock-prices?symbols=${encodeURIComponent(ticker)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const p = d?.prices?.[0]; if (vivant && p?.price != null) setV({ prix: p.price, var: p.deltaPct ?? 0 }); })
      .catch(() => {});
    void lire();
    const t = window.setInterval(lire, 60_000);
    return () => { vivant = false; window.clearInterval(t); };
  }, [ticker]);
  return v;
}

function EnteteCompact({ c, accent }: { c: FicheDemo["company"]; accent: string }) {
  const cours = useCours(c.ticker);
  const hausse = (cours?.var ?? 0) >= 0;
  const fmt = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <motion.div initial={{ y: -COMPACT_PX }} animate={{ y: 0 }} exit={{ y: -COMPACT_PX }} transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-[#050505]/[0.97] px-4 md:left-[92px] md:px-6"
      style={{ height: COMPACT_PX }}>
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
/* Fiche                                                               */
/* ------------------------------------------------------------------ */

function Fiche({ f, admin }: { f: FicheDemo; admin: React.ReactNode }) {
  const c = f.company;
  const accent = brand(c.ticker).primary;
  const blocs = useMemo(() => {
    const dispo = new Set(ongletsDe(f, Boolean(admin)).map((o) => o.id));
    return BLOCS.filter((b) => b.id === "integral" || dispo.has(b.id));
  }, [f, admin]);
  const [actif, setActif] = useState(blocs[0]?.id ?? "apercu");
  const liste = useMemo(() => kpisAffiches(c), [c]);
  const [kpiActif, setKpiActif] = useState<string>(() => liste.find((k) => k.short === c.hero_kpi)?.short ?? liste[0]?.short ?? "");
  const kpiObjet: KPI | undefined = c.kpis.find((k) => k.short === kpiActif) ?? liste[0];
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const { mode, basculer } = useTheme();
  const entete = useRef<HTMLDivElement>(null);
  const recherche = useRef<HTMLDivElement>(null);

  // En-tete : plein en haut de page. S il est haut (mobile, ou plus de 140 px
  // sur ordinateur), il defile normalement et une ligne compacte fixe prend le
  // relais des qu il sort de l ecran ; sinon il reste colle tel quel.
  const [grand, setGrand] = useState(true);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = entete.current;
    if (!el) return;
    const z = () => parseFloat(getComputedStyle(document.body).zoom) || 1;
    const maj = () => {
      const g = window.innerWidth / z() < 768 || el.offsetHeight > 140;
      setGrand(g);
      const c = g && el.getBoundingClientRect().bottom / z() < COMPACT_PX;
      setCompact(c);
      document.documentElement.style.setProperty("--entete-v2", `${g ? COMPACT_PX : el.offsetHeight}px`);
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
      document.documentElement.style.removeProperty("--entete-v2");
    };
  }, []);

  // Premier affichage sans fondu : le contenu est la tout de suite (pas d ecran vide si l animation tarde).
  const premier = useRef(true);
  useEffect(() => { premier.current = false; }, []);
  const choisirBloc = (id: string) => {
    setActif(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const fermerPanneau = useCallback(() => setPanneau(null), []);
  const onOutil = (id: OutilId, y: number) => {
    if (id === "theme") { basculer(); return; }
    if (id === "recherche") {
      // Ouvre la recherche du site (CompanySearch) par son vrai declencheur, monte hors ecran.
      recherche.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
      return;
    }
    if (id === "favoris" || id === "comparer") setPanneau((p) => (p?.id === id ? null : { id, y }));
  };

  const rail = { blocs, actif, accent, mode, onBloc: choisirBloc, onOutil };

  const bloc = (id: string) => {
    if (id === "apercu") {
      return (
        <div className="grid grid-cols-1 gap-4">
          <CompanyHeader company={c} rangs="seuls" aideRangs={false} />
          <BandeauIpoRecente ipo={c.ipo} />
          <CompanyProfileCard company={c} accent={accent} />
        </div>
      );
    }
    if (id === "kpi") return <BlocIndicateurs c={c} accent={accent} actif={kpiActif} onActif={setKpiActif} />;
    return <Contenu f={f} id={id} admin={admin} />;
  };

  const corps = actif === "integral" ? (
    <div>
      {blocs.filter((b) => b.id !== "integral").map((b, i) => (
        <Fragment key={b.id}>
          <div className={`mb-4 flex items-center gap-2.5 ${i === 0 ? "" : "mt-14"}`}>
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06]"><b.Icon className="size-4" style={{ color: accent }} aria-hidden /></span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">{b.titre}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          {bloc(b.id)}
        </Fragment>
      ))}
    </div>
  ) : bloc(actif);

  return (
    <FreemiumBlurProvider tier="max">
      <style>{STYLE_ANIM}</style>
      <RailOrdinateur {...rail} />
      <BarreMobile {...rail} />
      {/* Declencheur reel de la recherche du site, hors ecran (le panneau s ouvre en plein ecran). */}
      <div ref={recherche} className="fixed -left-[400vw] top-0 z-[150]">
        <CompanySearch variant="compact" />
      </div>

      {/* En-tete collant : la barre du nom de la societe, rien au-dessus. */}
      <div ref={entete} className={`${grand ? "relative" : "sticky top-0"} z-30 -mx-4 border-b border-white/[0.07] bg-[#050505] px-4 pb-3 pt-4 sm:-mx-6 sm:px-6`}>
        <CompanyHeader company={c} rangs="aucun" outilsAdmin={false} />
      </div>
      <AnimatePresence>
        {compact && <EnteteCompact key="compact" c={c} accent={accent} />}
      </AnimatePresence>

      <AnimatePresence>
        {compare && kpiObjet && (
          <motion.section key={compare + kpiObjet.short} initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 12, height: 0 }}
            className="mt-6 overflow-hidden">
            <ComparePanel sourceCompany={c} sourceKpi={kpiObjet} targetTicker={compare} onClose={() => setCompare(null)} />
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div key={actif} initial={premier.current ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-6 min-w-0 pb-28 md:pb-10">
        {corps}
      </motion.div>

      <AnimatePresence>
        {panneau?.id === "favoris" && (
          <PanneauOutil key="favoris" p={panneau} titre="Favoris" onFermer={fermerPanneau}>
            <div className="flex items-center gap-2.5 border-b border-[#1a1a1a] px-3.5 py-3">
              <StarButton ticker={c.ticker} mode="company" size="md" />
              <span className="text-[13px] text-zinc-200">Suivre {c.name}</span>
            </div>
            <Link href="/mes-societes" className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:bg-[#141414]"><Bookmark className="size-4 text-violet-300" /> Mes sociétés</Link>
            <Link href="/account/favorites" className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-zinc-200 hover:bg-[#141414]"><Star className="size-4 text-amber-300" /> Mes KPI</Link>
          </PanneauOutil>
        )}
        {panneau?.id === "comparer" && kpiObjet && (
          <PanneauOutil key="comparer" p={panneau} titre="Comparer" onFermer={fermerPanneau} fermetureExterne={false}>
            {/* Le vrai comparateur de la fiche, ouvert d office : son bouton est masque, sa liste s affiche dans le panneau. */}
            <div className="[&>div>button]:hidden [&>div>div]:!static [&>div>div]:!w-full [&>div>div]:!rounded-none [&>div>div]:!border-0 [&>div>div]:!shadow-none">
              <CompareControl ticker={c.ticker} activeKpi={kpiObjet} open onToggle={fermerPanneau}
                onPick={(t) => { setCompare(t); setPanneau(null); }} />
            </div>
          </PanneauOutil>
        )}
      </AnimatePresence>
    </FreemiumBlurProvider>
  );
}

export function FicheV2Client({ fiches, adminBlocs = null }: { fiches: FicheDemo[]; adminBlocs?: Record<string, React.ReactNode> | null }) {
  const [t, setT] = useState(fiches[0]?.ticker ?? "");
  const f = fiches.find((x) => x.ticker === t) ?? fiches[0];
  if (!f) return <div className="p-10 text-zinc-400">Aucune société chargée.</div>;
  const glow = brand(f.company.ticker).glow;
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 md:pl-[92px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${glow}, transparent 60%)` }} />
      <main className="relative w-full px-4 sm:px-6">
        <Fiche key={f.ticker} f={f} admin={adminBlocs?.[f.ticker] ?? null} />
        {/* Outils du concept (retour, societe de demonstration) : en pied de page, plus rien au-dessus du nom. */}
        <footer className="mb-28 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 md:mb-8">
          <Link href="/concepts/fiche-onglets" className="group inline-flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Tous les styles d’onglets
          </Link>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {fiches.map((x) => (
              <button key={x.ticker} type="button" onClick={() => { setT(x.ticker); window.scrollTo({ top: 0 }); }}
                className={`rounded-full px-3.5 py-1 text-[12.5px] font-medium transition-colors ${x.ticker === f.ticker ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}>
                {x.company.name} ({x.ticker})
              </button>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
