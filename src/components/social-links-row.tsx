"use client";

import { useCallback } from "react";

/**
 * Bloc "Suivez-nous" pour le footer.
 *
 * Yann (25 mai 2026) : refonte style V7 HOLOGRAPHIC CONIC (cf
 * /concepts/social-cards) — conic gradient rotatif + halo blur.
 * Instagram retiré : Mettrik AI ne maintient que X désormais.
 *
 * Présence officielle :
 *   - X : https://x.com/mettrik_ai
 *
 * Mobile : tente le scheme natif twitter://user?screen_name=... puis
 * fallback web après 1.2s si l'app n'a pas pris le relais.
 */

const X_HANDLE = "mettrik_ai";
const X_WEB = `https://x.com/${X_HANDLE}`;
const X_NATIVE = `twitter://user?screen_name=${X_HANDLE}`;

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function openSocial(nativeUrl: string, webUrl: string) {
  if (!isMobileUA()) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const start = Date.now();
  const fallback = setTimeout(() => {
    if (Date.now() - start >= 1100) {
      window.location.href = webUrl;
    }
  }, 1200);
  const onVisibility = () => {
    if (document.hidden) {
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.location.href = nativeUrl;
}

/** SVG X officiel (Twitter rebrand). */
function XLogoSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
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

  // Tailles V7 adaptées au contexte :
  // - default (page contact, hero) : 96×96 outer / 80×80 inner
  // - compact (footer global) : 60×60 outer / 50×50 inner
  const outerSize = compact ? "size-[60px]" : "size-24";
  const innerSize = compact ? "size-[50px]" : "size-[80px]";
  const iconSize = compact ? "size-6" : "size-9";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      {!compact && (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
          Suivez Mettrik AI
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-3 ${align === "center" ? "justify-center" : ""}`}>
        <a
          href={X_WEB}
          onClick={handleX}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Mettrik AI sur X (@${X_HANDLE})`}
          className={`group relative grid ${outerSize} place-items-center`}
        >
          {/* Halo conic gradient rotatif (cœur du style V7) */}
          <div
            className="absolute inset-0 rounded-2xl opacity-60 blur-md transition-opacity group-hover:opacity-100"
            style={{
              background: "conic-gradient(from 0deg, #a78bfa, #06b6d4, #a78bfa, #f43f5e, #a78bfa)",
              animation: "social-v7-spin 6s linear infinite",
            }}
          />
          {/* Bouton solide intérieur */}
          <div className={`relative grid ${innerSize} place-items-center rounded-2xl border border-white/10 bg-[#0a0a0e]`}>
            <XLogoSvg className={`${iconSize} text-zinc-100`} />
          </div>
        </a>
        {!compact && (
          <span className="font-mono text-[11px] text-zinc-400">@{X_HANDLE}</span>
        )}
      </div>
      <style jsx>{`
        @keyframes social-v7-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
