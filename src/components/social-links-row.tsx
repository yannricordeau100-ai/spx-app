"use client";

import { useCallback } from "react";

// Lucide a déprécié l'icône Instagram dans des versions récentes. Inline SVG.
const Instagram = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

/**
 * Bloc "Suivez-nous" pour le footer (Yann 17 mai 2026).
 * Style "wow + sérieux" : gradient violet/cyan Mettrik, hover anim,
 * icônes propres, handles visibles, link direct vers profil.
 *
 * Présence officielle Mettrik AI :
 *   - X : https://x.com/mettrik_ai
 *   - Instagram : https://www.instagram.com/mettrik_ai/
 *
 * Mobile (Yann 17 mai 2026) : ouverture en APP NATIVE quand installée,
 * fallback web si pas d'app. Détection via UA + tentative scheme natif
 * (twitter://user?screen_name=... / instagram://user?username=...)
 * suivie d'un setTimeout fallback web après 1.2s.
 */

const X_HANDLE = "mettrik_ai";
const IG_HANDLE = "mettrik_ai";
const X_WEB = `https://x.com/${X_HANDLE}`;
const X_NATIVE = `twitter://user?screen_name=${X_HANDLE}`;
const IG_WEB = `https://www.instagram.com/${IG_HANDLE}/`;
const IG_NATIVE = `instagram://user?username=${IG_HANDLE}`;

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function openSocial(nativeUrl: string, webUrl: string) {
  // Sur desktop : ouvre directement le web dans un nouvel onglet
  if (!isMobileUA()) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }
  // Sur mobile : tente d'ouvrir l'app native, fallback web après 1.2s
  // si l'app n'est pas installée (le navigateur reste sur la page courante)
  const start = Date.now();
  const fallback = setTimeout(() => {
    // Si on est toujours sur la page après 1.2s, l'app n'a pas pris le relais
    if (Date.now() - start >= 1100) {
      window.location.href = webUrl;
    }
  }, 1200);
  // Visibility change = l'app native a pris le relais → on annule le fallback
  const onVisibility = () => {
    if (document.hidden) {
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  // Tente le scheme natif
  window.location.href = nativeUrl;
}

export function SocialLinksRow({
  align = "left",
  size = "default",
}: {
  align?: "left" | "center";
  size?: "default" | "compact";
}) {
  const alignClass = align === "center" ? "items-center text-center" : "items-start";
  const compact = size === "compact";

  const handleX = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openSocial(X_NATIVE, X_WEB);
  }, []);

  const handleIG = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openSocial(IG_NATIVE, IG_WEB);
  }, []);

  return (
    <div className={`flex flex-col gap-2.5 ${alignClass}`}>
      {!compact && (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
          Suivez Mettrik AI
        </div>
      )}
      <div className={`flex flex-wrap gap-2 ${align === "center" ? "justify-center" : ""}`}>
        {/* X (Twitter) — onClick handler ouvre app native sur mobile, web sur desktop.
            href reste fallback pour les bots / clic-droit "ouvrir dans nouvel onglet". */}
        <a
          href={X_WEB}
          onClick={handleX}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Mettrik AI sur X"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/[0.08] hover:shadow-[0_0_24px_-8px_rgba(167,139,250,0.5)]"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/[0.08] to-cyan-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <svg
            viewBox="0 0 24 24"
            className="relative size-3.5 fill-current text-zinc-200 transition-colors group-hover:text-violet-200"
            aria-hidden
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="relative flex flex-col leading-tight">
            <span className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 transition-colors group-hover:text-violet-300/70">
              X
            </span>
            <span className="text-[12.5px] font-semibold text-zinc-100 transition-colors group-hover:text-violet-100">
              @{X_HANDLE}
            </span>
          </span>
        </a>

        {/* Instagram */}
        <a
          href={IG_WEB}
          onClick={handleIG}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Mettrik AI sur Instagram"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 transition-all hover:-translate-y-0.5 hover:border-pink-400/50 hover:bg-pink-500/[0.08] hover:shadow-[0_0_24px_-8px_rgba(244,114,182,0.5)]"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/0 via-pink-500/[0.10] to-violet-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <Instagram
            className="relative size-3.5 text-zinc-200 transition-colors group-hover:text-pink-200"
          />
          <span className="relative flex flex-col leading-tight">
            <span className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 transition-colors group-hover:text-pink-300/70">
              Instagram
            </span>
            <span className="text-[12.5px] font-semibold text-zinc-100 transition-colors group-hover:text-pink-100">
              @{IG_HANDLE}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}
