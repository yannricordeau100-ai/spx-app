import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export const metadata = {
  title: "Page introuvable · Mettrik AI",
  robots: { index: false, follow: false },
};

/*
 * 13 oct 2026 (Yann) : page 404 façon KPI. Une courbe monte calmement puis
 * décroche dans le vide, la valeur affichée est 404. Animations lentes en CSS
 * pur (aucun JS), coupées si l'utilisateur demande moins de mouvement.
 * Le mode clair passe par le filtre d'inversion global posé sur <html>.
 * Rien ici ne mentionne le chemin demandé ni un outil interne.
 */

// Trajet de la courbe : montée régulière, puis rupture au point (392, 58).
const MONTEE =
  "M 16 206 C 46 200, 62 188, 88 184 S 132 170, 158 160 S 196 150, 222 134 S 262 120, 288 104 S 330 92, 352 76 S 380 62, 392 58";
const CHUTE = "M 392 58 C 420 52, 444 70, 462 118 S 500 250, 540 340";
const AIRE = `${MONTEE} L 392 240 L 16 240 Z`;

const CSS = `
.nf-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: nf-draw 4.2s cubic-bezier(.45,.05,.25,1) .5s forwards; }
.nf-drop { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; animation: nf-drop 3.6s cubic-bezier(.55,0,.35,1) 4.4s forwards; }
.nf-area { opacity: 0; animation: nf-fade 3s ease-out 2.4s forwards; }
.nf-dot { opacity: 0; animation: nf-fade 1.6s ease-out 4.3s forwards; }
.nf-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: nf-ring 4.8s ease-out 5s infinite; }
.nf-rise { opacity: 0; transform: translateY(10px); animation: nf-rise 1.8s cubic-bezier(.2,.7,.2,1) forwards; }
.nf-float { animation: nf-float 14s ease-in-out 8s infinite; }
.nf-halo { animation: nf-halo 24s ease-in-out infinite alternate; }
@keyframes nf-draw { to { stroke-dashoffset: 0; } }
@keyframes nf-drop { 0% { opacity: 1; } 70% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: .55; } }
@keyframes nf-fade { to { opacity: 1; } }
@keyframes nf-ring { 0% { opacity: .7; transform: scale(1); } 80%, 100% { opacity: 0; transform: scale(3.2); } }
@keyframes nf-rise { to { opacity: 1; transform: none; } }
@keyframes nf-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes nf-halo { from { transform: translate3d(-4%, 0, 0) scale(1); } to { transform: translate3d(4%, 3%, 0) scale(1.08); } }
@media (prefers-reduced-motion: reduce) {
  .nf-draw, .nf-drop, .nf-area, .nf-dot, .nf-rise { animation: none; opacity: 1; transform: none; stroke-dashoffset: 0; }
  .nf-drop { opacity: .55; }
  .nf-ring, .nf-float, .nf-halo { animation: none; }
  .nf-ring { opacity: 0; }
}
`;

// La page 404 n'a pas de bouton de thème : on reprend le dernier mode appliqué
// sur le site (écrit par ThemeToggle, toujours "dark" pour les comptes gratuits).
const THEME = `try{if(localStorage.getItem("mettrik:theme")==="light"){var h=document.documentElement;h.style.filter="invert(1) hue-rotate(180deg)";h.style.background="#fff";h.setAttribute("data-theme","light")}}catch(e){}`;

const retard = (s: number) => ({ animationDelay: `${s}s` });

export default function NotFound() {
  return (
    <main data-mtk-statut="404" className="relative flex min-h-screen flex-col overflow-hidden bg-[#050505] text-zinc-100">
      <script dangerouslySetInnerHTML={{ __html: THEME }} />
      <style>{CSS}</style>

      {/* Halos de fond, dérive très lente */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="nf-halo absolute left-1/2 top-[-18%] h-[520px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(139,92,246,0.20), transparent)" }}
        />
        <div
          className="nf-halo absolute bottom-[-20%] right-[-10%] h-[420px] w-[620px] max-w-[120vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.10), transparent)", animationDelay: "-12s" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        {/* Carte KPI */}
        <div className="nf-float w-full">
          <section
            aria-label="Indicateur : page introuvable"
            className="nf-rise w-full rounded-2xl border border-white/10 bg-white/[0.025] p-5 shadow-[0_30px_80px_-40px_rgba(139,92,246,0.55)] backdrop-blur-sm sm:p-7"
            style={retard(0.1)}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  KPI principal
                </p>
                <p className="mt-1 text-[14px] font-medium text-zinc-200">Page demandée</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 font-mono text-[12px] font-semibold text-rose-300">
                <svg aria-hidden viewBox="0 0 10 10" className="size-2.5">
                  <path d="M5 9 L1 3 H9 Z" fill="currentColor" />
                </svg>
                −100 %
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span
                className="font-mono text-[64px] font-semibold leading-none tracking-tight sm:text-[84px]"
                style={{
                  backgroundImage: "linear-gradient(135deg, #fafafa 0%, #c4b5fd 55%, #67e8f9 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                404
              </span>
              <span className="text-[13px] text-zinc-400">introuvable</span>
            </div>

            {/* Courbe qui décroche */}
            <div className="relative mt-4">
              <svg
                viewBox="0 0 560 250"
                className="block h-auto w-full overflow-visible"
                role="img"
                aria-label="Une courbe monte régulièrement puis chute brutalement hors du graphique."
              >
                <defs>
                  <linearGradient id="nf-trait" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                  <linearGradient id="nf-remplissage" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="nf-vide" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity="1" />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Grille */}
                {[40, 90, 140, 190, 240].map((y) => (
                  <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                ))}
                <line x1="392" x2="392" y1="20" y2="240" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 5" />

                <path d={AIRE} fill="url(#nf-remplissage)" className="nf-area" />
                <path
                  d={MONTEE}
                  pathLength={1}
                  fill="none"
                  stroke="url(#nf-trait)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="nf-draw"
                />
                <path
                  d={CHUTE}
                  pathLength={1}
                  fill="none"
                  stroke="url(#nf-vide)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="nf-drop"
                />

                <circle cx="392" cy="58" r="6" fill="#22d3ee" className="nf-ring" />
                <g className="nf-dot">
                  <circle cx="392" cy="58" r="5.5" fill="#050505" stroke="#22d3ee" strokeWidth="2.5" />
                </g>
              </svg>

              <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-400">
                <span>Avant</span>
                <span>Ici</span>
              </div>
            </div>
          </section>
        </div>

        {/* Message */}
        <h1
          className="nf-rise mt-8 text-center font-display text-[28px] font-bold tracking-tight sm:text-[34px]"
          style={retard(1.2)}
        >
          Cette page a décroché
        </h1>
        <p
          className="nf-rise mt-3 max-w-md text-center text-[15px] leading-relaxed text-zinc-300"
          style={retard(1.6)}
        >
          L&apos;adresse demandée n&apos;existe pas ou n&apos;est plus disponible. Toutes les autres courbes
          tiennent le cap.
        </p>

        <div className="nf-rise mt-8 flex w-full flex-col items-center gap-4 sm:w-auto" style={retard(2)}>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0866FF] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_10px_40px_-12px_rgba(8,102,255,0.8)] transition-colors duration-500 hover:bg-[#1a75ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:w-auto"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Revenir à l&apos;accueil
          </Link>
          <Link
            href="/#recherche"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[14px] font-medium text-zinc-300 underline-offset-4 transition-colors duration-500 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <Search aria-hidden className="size-4" />
            Chercher une société
          </Link>
        </div>
      </div>
    </main>
  );
}
