"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, QrCode, Share2, UserPlus, Eye, X as XIcon, Sparkles, ChevronRight } from "lucide-react";

const X_HANDLE = "mettrik_ai";
const IG_HANDLE = "mettrik_ai";
const X_WEB = `https://x.com/${X_HANDLE}`;
const IG_WEB = `https://www.instagram.com/${IG_HANDLE}/`;
// X intent "follow" : ouvre direct le dialog suivre sans passer par profil
const X_INTENT_FOLLOW = `https://twitter.com/intent/follow?screen_name=${X_HANDLE}`;
// X intent "tweet" pré-rempli (utilisé pour le partage contextualisé)
const X_INTENT_TWEET = (text: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&via=${X_HANDLE}`;

const X_NATIVE = `twitter://user?screen_name=${X_HANDLE}`;
const IG_NATIVE = `instagram://user?username=${IG_HANDLE}`;

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function openWithNativeFallback(nativeUrl: string, webUrl: string) {
  if (!isMobile()) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const start = Date.now();
  const fallback = setTimeout(() => {
    if (Date.now() - start >= 1100) window.location.href = webUrl;
  }, 1200);
  const onVis = () => {
    if (document.hidden) {
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onVis);
    }
  };
  document.addEventListener("visibilitychange", onVis);
  window.location.href = nativeUrl;
}

const XLogoSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramSvg = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="my-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
      <div className="mb-1 flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{id}</span>
        <h2 className="font-display text-[18px] font-semibold text-zinc-100">{title}</h2>
      </div>
      <p className="mb-5 text-[12.5px] text-zinc-400">{subtitle}</p>
      <div className="rounded-xl border border-white/[0.04] bg-[#070707] p-6">{children}</div>
    </section>
  );
}

// ───────────────────────────────────────────────
// V1 — SMART TAP : 1 tap = voir profil, 2 taps rapides = follow direct,
//                  long press = copier @handle
// ───────────────────────────────────────────────
function VariantSmartTap() {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const clicks = useRef<{ count: number; t?: NodeJS.Timeout }>({ count: 0 });
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    clicks.current.count += 1;
    if (clicks.current.t) clearTimeout(clicks.current.t);
    clicks.current.t = setTimeout(() => {
      if (clicks.current.count === 1) {
        showToast("Ouverture profil X…");
        openWithNativeFallback(X_NATIVE, X_WEB);
      } else if (clicks.current.count >= 2) {
        showToast("Follow direct via X Intent…");
        window.open(X_INTENT_FOLLOW, "_blank", "noopener,noreferrer");
      }
      clicks.current.count = 0;
    }, 280);
  }, []);

  const startPress = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      navigator.clipboard?.writeText(`@${X_HANDLE}`);
      showToast(`@${X_HANDLE} copié dans le presse-papier`);
      clicks.current.count = 0;
      if (clicks.current.t) clearTimeout(clicks.current.t);
    }, 650);
  }, []);
  const endPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        className="group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.10] via-zinc-900 to-cyan-500/[0.05] px-6 py-5 transition-all hover:scale-[1.02] hover:border-violet-400/60"
        aria-label="Smart Tap"
      >
        <div className="absolute -top-10 -right-10 size-32 rounded-full bg-violet-400/20 blur-3xl transition-all group-hover:bg-violet-400/40" />
        <div className="relative flex items-center gap-3">
          <XLogoSvg className="size-7 text-zinc-100" />
          <div className="text-left">
            <div className="font-display text-[16px] font-bold text-zinc-50">@{X_HANDLE}</div>
            <div className="text-[10.5px] text-zinc-400">1 tap : profil · 2 taps : suivre · maintenu : copier</div>
          </div>
        </div>
      </button>
      <div className="h-6 text-[12px] font-medium text-violet-300">{toast ?? " "}</div>
      <div className="text-[11px] text-zinc-500">
        Triple usage : 1 bouton, 3 actions sans pollution visuelle. Idéal mobile (tap rapide
        ≠ double-tap ≠ long press).
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V2 — LIVE PREVIEW CARD : hover/tap affiche mini-card avec follower count
//                          (fake mais réaliste) + dernier post + bouton follow direct
// ───────────────────────────────────────────────
function VariantLivePreview() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-center">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:border-violet-400/40 hover:bg-violet-500/[0.05]"
      >
        <XLogoSvg className="size-5 text-zinc-100" />
        <span className="text-[13px] font-semibold text-zinc-100">@{X_HANDLE}</span>
        <ChevronRight className={`size-3.5 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full z-30 mt-2 w-[320px] overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-zinc-900 to-[#0a0a0e] shadow-[0_20px_50px_-12px_rgba(167,139,250,0.4)]">
          {/* Header bandeau gradient */}
          <div className="relative h-16 bg-gradient-to-r from-violet-500/30 via-cyan-500/20 to-violet-500/30">
            <div className="absolute -bottom-7 left-4 grid size-14 place-items-center rounded-full border-4 border-[#0a0a0e] bg-gradient-to-br from-violet-500 to-cyan-500">
              <XLogoSvg className="size-6 text-white" />
            </div>
          </div>
          <div className="px-4 pb-4 pt-9">
            <div className="font-display text-[15px] font-bold text-zinc-50">Mettrik AI</div>
            <div className="text-[12px] text-zinc-400">@{X_HANDLE} · KPI Intelligence</div>
            <div className="mt-3 flex gap-4 text-[11px]">
              <span className="text-zinc-400">
                <strong className="text-zinc-100">2 387</strong> followers
              </span>
              <span className="text-zinc-400">
                <strong className="text-zinc-100">142</strong> publications
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
                Dernier post
              </div>
              <div className="text-[12px] leading-relaxed text-zinc-200">
                Comment lire 5 KPIs en 30 sec ? Notre nouveau bloc Stories agrège…
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href={X_INTENT_FOLLOW}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-center text-[12px] font-semibold text-white transition-colors hover:bg-violet-400"
              >
                <UserPlus className="mr-1 inline size-3.5" /> Suivre direct
              </a>
              <a
                href={X_WEB}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.08]"
              >
                <Eye className="inline size-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// V3 — BRAND MORPH : logo Mettrik au repos → split en X + IG au hover
// ───────────────────────────────────────────────
function VariantBrandMorph() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="group relative flex h-20 w-64 items-center justify-center">
        {/* Logo Mettrik au repos */}
        <div className="font-display text-[28px] font-bold tracking-tight transition-all duration-500 group-hover:opacity-0 group-hover:-translate-y-2">
          <span className="bg-gradient-to-r from-violet-300 via-zinc-50 to-cyan-300 bg-clip-text text-transparent">
            Mettrik AI
          </span>
        </div>
        {/* Au hover : split en X + IG */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-all duration-500 group-hover:opacity-100">
          <a
            href={X_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex translate-x-8 items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 transition-all duration-500 group-hover:translate-x-0 hover:bg-violet-500/20"
          >
            <XLogoSvg className="size-4 text-violet-200" />
            <span className="text-[12.5px] font-semibold text-violet-100">@{X_HANDLE}</span>
          </a>
          <a
            href={IG_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex -translate-x-8 items-center gap-2 rounded-xl border border-pink-400/40 bg-pink-500/10 px-4 py-2 transition-all duration-500 group-hover:translate-x-0 hover:bg-pink-500/20"
          >
            <InstagramSvg className="size-4 text-pink-200" />
            <span className="text-[12.5px] font-semibold text-pink-100">@{IG_HANDLE}</span>
          </a>
        </div>
      </div>
      <div className="text-[11px] text-zinc-500">
        Double usage : le wordmark Mettrik fait office de logo + porte d&apos;entrée RS. Hover →
        révèle X + Instagram avec animation morph.
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V4 — CONTEXT-AWARE COMPOSE : sur une fiche sté, le clic pré-remplit un tweet
//                              "Je découvre @TICKER sur @mettrik_ai"
// ───────────────────────────────────────────────
function VariantContextCompose({ ticker = "NVDA" }: { ticker?: string }) {
  const tweetText = `Je viens de lire l'analyse de $${ticker} sur Mettrik AI. KPIs investisseur en 30 sec ⚡️`;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-md rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-300" />
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan-300">
            Contextuel · fiche {ticker}
          </span>
        </div>
        <p className="text-[12.5px] text-zinc-300">Vous lisez l&apos;analyse {ticker}. Partagez-la ?</p>
        <a
          href={X_INTENT_TWEET(tweetText)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-[12.5px] font-semibold text-zinc-900 transition-all hover:bg-white"
        >
          <XLogoSvg className="size-3.5" /> Partager sur X
        </a>
      </div>
      <div className="w-full max-w-md rounded-lg border border-white/[0.06] bg-zinc-900 p-3 text-[11px] italic text-zinc-400">
        Aperçu tweet pré-rempli : « {tweetText} »
      </div>
      <div className="text-[11px] text-zinc-500">
        Triple usage : présence brand + croissance virale + contextualisation par sté courante.
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V5 — STICKY VERTICAL RAIL : barre fixe à droite avec icônes + actions rapides
// ───────────────────────────────────────────────
function VariantStickyRail() {
  return (
    <div className="relative h-[280px] overflow-hidden rounded-xl border border-white/[0.04] bg-gradient-to-br from-[#0a0a0e] to-[#050505]">
      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-500">
        Aperçu page (zone contenu)
      </div>
      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-full border border-white/10 bg-zinc-950/80 p-2 backdrop-blur-md">
        <a
          href={X_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X"
          className="group grid size-9 place-items-center rounded-full border border-white/10 transition-all hover:border-violet-400/60 hover:bg-violet-500/15"
        >
          <XLogoSvg className="size-3.5 text-zinc-300 group-hover:text-violet-200" />
        </a>
        <a
          href={IG_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="group grid size-9 place-items-center rounded-full border border-white/10 transition-all hover:border-pink-400/60 hover:bg-pink-500/15"
        >
          <InstagramSvg className="size-3.5 text-zinc-300 group-hover:text-pink-200" />
        </a>
        <div className="h-px w-full bg-white/[0.08]" />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(`@${X_HANDLE}`);
          }}
          aria-label="Copier @"
          className="group grid size-9 place-items-center rounded-full border border-white/10 transition-all hover:border-cyan-400/60 hover:bg-cyan-500/15"
        >
          <Copy className="size-3.5 text-zinc-300 group-hover:text-cyan-200" />
        </button>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: "Mettrik AI", url: "https://www.mettrik.ai" });
            }
          }}
          aria-label="Partager"
          className="group grid size-9 place-items-center rounded-full border border-white/10 transition-all hover:border-emerald-400/60 hover:bg-emerald-500/15"
        >
          <Share2 className="size-3.5 text-zinc-300 group-hover:text-emerald-200" />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V6 — QR CODE EXPANDER : icône qui révèle QR + handle au tap (mobile-friendly)
// ───────────────────────────────────────────────
function VariantQRExpander() {
  const [open, setOpen] = useState(false);
  // QR code via API publique gratuite (Google Charts API)
  const qrXUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(X_WEB)}&bgcolor=0a0a0e&color=fafafa&qzone=1`;
  const qrIgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(IG_WEB)}&bgcolor=0a0a0e&color=fafafa&qzone=1`;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40"
      >
        <QrCode className="size-4" />
        {open ? "Masquer les QR" : "Afficher les QR codes"}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3">
            <img
              src={qrXUrl}
              alt={`QR code X ${X_HANDLE}`}
              width={140}
              height={140}
              className="rounded"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-violet-200">
              <XLogoSvg className="size-3" /> @{X_HANDLE}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/[0.04] p-3">
            <img
              src={qrIgUrl}
              alt={`QR code Instagram ${IG_HANDLE}`}
              width={140}
              height={140}
              className="rounded"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-pink-200">
              <InstagramSvg className="size-3" /> @{IG_HANDLE}
            </div>
          </div>
        </div>
      )}
      <div className="text-[11px] text-zinc-500">
        Double usage : transition desktop → mobile (scan le QR depuis ton bureau pour ouvrir
        l&apos;app sur ton téléphone).
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V7 — HOLOGRAPHIC CONIC : effet "wow" conic gradient rotatif + halo
// ───────────────────────────────────────────────
function VariantHolographic() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <a
          href={X_WEB}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative grid size-24 place-items-center"
        >
          {/* Conic gradient rotatif */}
          <div
            className="absolute inset-0 rounded-2xl opacity-60 blur-md transition-opacity group-hover:opacity-100"
            style={{
              background: "conic-gradient(from 0deg, #a78bfa, #06b6d4, #a78bfa, #f43f5e, #a78bfa)",
              animation: "spin 6s linear infinite",
            }}
          />
          <div className="relative grid size-[88px] place-items-center rounded-2xl border border-white/10 bg-[#0a0a0e]">
            <XLogoSvg className="size-9 text-zinc-100" />
          </div>
        </a>
        <a
          href={IG_WEB}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative grid size-24 place-items-center"
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-60 blur-md transition-opacity group-hover:opacity-100"
            style={{
              background: "conic-gradient(from 0deg, #f59e0b, #f43f5e, #a78bfa, #06b6d4, #f59e0b)",
              animation: "spin 6s linear infinite reverse",
            }}
          />
          <div className="relative grid size-[88px] place-items-center rounded-2xl border border-white/10 bg-[#0a0a0e]">
            <InstagramSvg className="size-9 text-zinc-100" />
          </div>
        </a>
      </div>
      <div className="font-mono text-[11px] text-zinc-300">@{X_HANDLE}</div>
      <div className="text-[11px] text-zinc-500">
        Effet "wow" pour positions ponctuelles (page Connect, footer hero, page contact).
        Le conic gradient rotatif évoque l&apos;intelligence + le mouvement.
      </div>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  V8 → V16 — Yann 18 mai 2026 : 9 nouvelles propositions
//  Mix de classiques propres et de variations originales mais adaptées.
// ═══════════════════════════════════════════════════════════════════════════

// V8 — INLINE PILLS : classique, ultra-minimal, footer-ready
function VariantInlinePills() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={X_WEB}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.preventDefault(); openWithNativeFallback(X_NATIVE, X_WEB); }}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition-all hover:border-zinc-100/40 hover:bg-zinc-100/[0.05] hover:text-zinc-50"
      >
        <XLogoSvg className="size-3" />
        <span className="font-mono text-[11px]">@{X_HANDLE}</span>
      </a>
      <a
        href={IG_WEB}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.preventDefault(); openWithNativeFallback(IG_NATIVE, IG_WEB); }}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition-all hover:border-pink-400/40 hover:bg-pink-500/[0.07] hover:text-pink-100"
      >
        <InstagramSvg className="size-3" />
        <span className="font-mono text-[11px]">@{IG_HANDLE}</span>
      </a>
    </div>
  );
}

// V9 — FLOATING DOCK : 2 icônes flottantes bottom-right, comme un dock macOS
function VariantFloatingDock() {
  return (
    <div className="relative h-40">
      <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0a0e]/90 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <a
          href={X_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X @mettrik_ai"
          className="group grid size-9 place-items-center rounded-xl bg-white/[0.04] transition-all hover:scale-110 hover:bg-violet-500/15"
        >
          <XLogoSvg className="size-3.5 text-zinc-200 transition-colors group-hover:text-violet-200" />
        </a>
        <a
          href={IG_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram @mettrik_ai"
          className="group grid size-9 place-items-center rounded-xl bg-white/[0.04] transition-all hover:scale-110 hover:bg-pink-500/15"
        >
          <InstagramSvg className="size-3.5 text-zinc-200 transition-colors group-hover:text-pink-200" />
        </a>
      </div>
      <div className="absolute left-3 top-3 text-[11px] text-zinc-600">
        ↘ Coin bottom-right, flotte au-dessus du contenu
      </div>
    </div>
  );
}

// V10 — HERO BANNER : pleine largeur bottom, statement fort, élégant
function VariantHeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-[#0a0a0e] to-cyan-950/30 px-6 py-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div>
          <div className="font-display text-[18px] font-bold text-zinc-50">
            Mettrik AI sur les réseaux
          </div>
          <div className="text-[12px] text-zinc-400">
            Analyses, méthodologies et nouveautés en direct.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={X_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-violet-100 transition-all hover:border-violet-400 hover:bg-violet-500/15"
          >
            <XLogoSvg className="size-3.5" />
            <span className="font-mono">@{X_HANDLE}</span>
          </a>
          <a
            href={IG_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg border border-pink-500/30 bg-pink-500/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-pink-100 transition-all hover:border-pink-400 hover:bg-pink-500/15"
          >
            <InstagramSvg className="size-3.5" />
            <span className="font-mono">@{IG_HANDLE}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// V11 — WORDMARK EMBEDDED : icônes intégrées à la signature Mettrik AI
function VariantWordmarkEmbedded() {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="font-display text-[28px] font-bold tracking-tight text-zinc-50">
        Mettrik <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span>retrouvez-nous sur</span>
        <a
          href={X_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`X @${X_HANDLE}`}
          className="inline-flex size-5 items-center justify-center rounded text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-violet-200"
        >
          <XLogoSvg className="size-3" />
        </a>
        <a
          href={IG_WEB}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Instagram @${IG_HANDLE}`}
          className="inline-flex size-5 items-center justify-center rounded text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-pink-200"
        >
          <InstagramSvg className="size-3" />
        </a>
        <span className="font-mono text-zinc-400">@{X_HANDLE}</span>
      </div>
    </div>
  );
}

// V12 — STACKED CARDS : 2 cards verticales empilées, sidebar-ready
function VariantStackedCards() {
  return (
    <div className="flex max-w-[280px] flex-col gap-2">
      <a
        href={X_WEB}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-950 px-3.5 py-3 transition-all hover:border-zinc-100/30 hover:bg-zinc-900"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-zinc-100/10">
            <XLogoSvg className="size-3.5 text-zinc-100" />
          </span>
          <div>
            <div className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-500">X</div>
            <div className="text-[13px] font-semibold text-zinc-50">@{X_HANDLE}</div>
          </div>
        </div>
        <ChevronRight className="size-4 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-zinc-300" />
      </a>
      <a
        href={IG_WEB}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-pink-950/30 to-zinc-950 px-3.5 py-3 transition-all hover:border-pink-400/40 hover:bg-pink-950/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-pink-500/15">
            <InstagramSvg className="size-3.5 text-pink-200" />
          </span>
          <div>
            <div className="text-[11.5px] font-mono uppercase tracking-wider text-pink-300/60">Instagram</div>
            <div className="text-[13px] font-semibold text-zinc-50">@{IG_HANDLE}</div>
          </div>
        </div>
        <ChevronRight className="size-4 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-pink-300" />
      </a>
    </div>
  );
}

// V13 — NEWSLETTER COMBO : RS + email signup dans une card commune
function VariantNewsletterCombo() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950 to-[#0a0a0e] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="font-display text-[14px] font-semibold text-zinc-100">
          Restez connecté à Mettrik AI
        </div>
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500">3 canaux</div>
      </div>
      <form className="mb-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          placeholder="votre email"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-400/50"
        />
        <button
          type="submit"
          className="rounded-lg border border-violet-500/30 bg-violet-500/[0.1] px-3 py-2 text-[12px] font-medium text-violet-100 transition-colors hover:bg-violet-500/20"
        >
          Suivre
        </button>
      </form>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">ou suivre sur</span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="mt-3 flex gap-2">
        <a href={X_WEB} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] text-zinc-200 transition-all hover:border-violet-400/40">
          <XLogoSvg className="size-3" /> @{X_HANDLE}
        </a>
        <a href={IG_WEB} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] text-zinc-200 transition-all hover:border-pink-400/40">
          <InstagramSvg className="size-3" /> @{IG_HANDLE}
        </a>
      </div>
    </div>
  );
}

// V14 — PULSE GLOW : 2 boutons circulaires avec pulse subtil périodique
function VariantPulseGlow() {
  return (
    <div className="flex items-center gap-6">
      <a
        href={X_WEB}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`X @${X_HANDLE}`}
        className="group relative grid size-12 place-items-center rounded-full border border-violet-500/30 bg-violet-500/[0.06] transition-all hover:scale-110 hover:border-violet-400"
      >
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-violet-500/20 [animation-duration:3s]" />
        <XLogoSvg className="relative size-4 text-violet-100" />
      </a>
      <a
        href={IG_WEB}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Instagram @${IG_HANDLE}`}
        className="group relative grid size-12 place-items-center rounded-full border border-pink-500/30 bg-pink-500/[0.06] transition-all hover:scale-110 hover:border-pink-400"
      >
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-pink-500/20 [animation-duration:3.5s]" />
        <InstagramSvg className="relative size-4 text-pink-100" />
      </a>
      <div className="text-[10.5px] text-zinc-500">
        Pulse léger toutes les 3 s, attire l&apos;œil sans agresser
      </div>
    </div>
  );
}

// V15 — GLASSMORPHISM CARD : carte verre avec gradient border + handles, Apple-style
function VariantGlassmorphism() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/15 via-fuchsia-500/8 to-cyan-500/12 p-px shadow-[0_8px_32px_rgba(167,139,250,0.15)]">
      <div className="rounded-[15px] bg-[#0a0a0e]/85 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-zinc-500">Présent sur</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={X_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/[0.06] backdrop-blur-md transition-all group-hover:bg-violet-500/15">
              <XLogoSvg className="size-3.5 text-zinc-100" />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">X</div>
              <div className="font-mono text-[12.5px] font-semibold text-zinc-50">@{X_HANDLE}</div>
            </div>
          </a>
          <div className="h-10 w-px bg-white/[0.06]" />
          <a
            href={IG_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/[0.06] backdrop-blur-md transition-all group-hover:bg-pink-500/15">
              <InstagramSvg className="size-3.5 text-zinc-100" />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Instagram</div>
              <div className="font-mono text-[12.5px] font-semibold text-zinc-50">@{IG_HANDLE}</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

// V16 — ORBITAL CONSTELLATION : avatar Mettrik AI au centre, X + IG en satellites
function VariantOrbitalConstellation() {
  return (
    <div className="relative grid h-44 place-items-center">
      {/* Orbite SVG */}
      <svg className="absolute inset-0 size-full" viewBox="0 0 200 176" aria-hidden>
        <ellipse cx="100" cy="88" rx="78" ry="42" fill="none" stroke="rgba(167,139,250,0.18)" strokeWidth="1" strokeDasharray="2 3" />
      </svg>
      {/* Centre — Avatar Mettrik */}
      <div className="relative grid size-16 place-items-center rounded-full border border-violet-500/40 bg-gradient-to-br from-violet-500/25 to-cyan-500/15 shadow-[0_0_32px_-4px_rgba(167,139,250,0.45)]">
        <span className="font-display text-[18px] font-bold tracking-tight text-zinc-50">M</span>
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
      </div>
      {/* Satellite X (gauche) */}
      <a
        href={X_WEB}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`X @${X_HANDLE}`}
        className="group absolute left-[16%] top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-zinc-950 shadow-lg transition-all hover:scale-110 hover:border-zinc-100/50"
      >
        <XLogoSvg className="size-3.5 text-zinc-100" />
        <span className="pointer-events-none absolute top-full mt-1 whitespace-nowrap text-[9.5px] font-mono text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">@{X_HANDLE}</span>
      </a>
      {/* Satellite IG (droite) */}
      <a
        href={IG_WEB}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Instagram @${IG_HANDLE}`}
        className="group absolute right-[16%] top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-pink-400/30 bg-zinc-950 shadow-lg transition-all hover:scale-110 hover:border-pink-300/60"
      >
        <InstagramSvg className="size-3.5 text-pink-200" />
        <span className="pointer-events-none absolute top-full mt-1 whitespace-nowrap text-[9.5px] font-mono text-pink-300/70 opacity-0 transition-opacity group-hover:opacity-100">@{IG_HANDLE}</span>
      </a>
    </div>
  );
}

// ───────────────────────────────────────────────
// LAB ENTRY POINT
// ───────────────────────────────────────────────
export function SocialCardsLab() {
  return (
    <>
      <Section
        id="V1"
        title="Smart Tap — 1 bouton, 3 actions"
        subtitle="1 tap : ouvre profil. 2 taps rapides : suivre direct (X intent). Maintenu : copie @mettrik_ai."
      >
        <VariantSmartTap />
      </Section>

      <Section
        id="V2"
        title="Live Preview Card — aperçu profil au hover"
        subtitle="Mini-card avec followers, dernier post, bouton follow direct. Hover desktop, tap mobile."
      >
        <VariantLivePreview />
      </Section>

      <Section
        id="V3"
        title="Brand Morph — Mettrik AI ⇄ X + Instagram"
        subtitle="Le wordmark Mettrik se split en X + IG au hover. Identité brand + porte d'entrée RS en un seul élément."
      >
        <VariantBrandMorph />
      </Section>

      <Section
        id="V4"
        title="Context Compose — partage tweet pré-rempli sté courante"
        subtitle="Sur une fiche société, le bouton pré-remplit un tweet avec le ticker + via @mettrik_ai. Croissance virale ciblée."
      >
        <VariantContextCompose ticker="NVDA" />
      </Section>

      <Section
        id="V5"
        title="Sticky Rail — barre verticale fixe right side"
        subtitle="Présence permanente sans pollution : icônes mini, actions rapides (X, IG, copier, Web Share API native)."
      >
        <VariantStickyRail />
      </Section>

      <Section
        id="V6"
        title="QR Code Expander — bridge desktop → mobile"
        subtitle="Tu scannes le QR depuis ton bureau, l'app X/Instagram s'ouvre sur ton téléphone. Élégant + utile en démo."
      >
        <VariantQRExpander />
      </Section>

      <Section
        id="V7"
        title="Holographic Conic — effet wow signature"
        subtitle="Conic gradient rotatif violet/cyan/rose. Pour positions premium (page Connect dédiée, footer hero, contact)."
      >
        <VariantHolographic />
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
          Nouvelle vague Yann 18 mai 2026 — 9 propositions additionnelles
          ═══════════════════════════════════════════════════════════════ */}
      <div className="my-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-500/40" />
        <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200">
          Nouvelle vague · V8 → V16
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-500/40" />
      </div>

      <Section
        id="V8"
        title="Inline Pills — classique épuré (footer-ready)"
        subtitle="Ultra-minimal : 2 pills handles. Cas d'usage : footer global toutes pages, version sobre."
      >
        <VariantInlinePills />
      </Section>

      <Section
        id="V9"
        title="Floating Dock — bottom-right macOS"
        subtitle="Dock flottant 2 icônes en bottom-right. Présent sans s'imposer, hover scale, indépendant du scroll."
      >
        <VariantFloatingDock />
      </Section>

      <Section
        id="V10"
        title="Hero Banner — pleine largeur statement"
        subtitle="Bande horizontale avec gradient violet/cyan. Wow + sérieux. Idéal sous footer ou en hero page Connect."
      >
        <VariantHeroBanner />
      </Section>

      <Section
        id="V11"
        title="Wordmark Embedded — icônes intégrées au wordmark"
        subtitle="Le wordmark Mettrik AI est suivi d'un mini-cluster X+IG. Identité + RS en 1 ligne, ultra-compact."
      >
        <VariantWordmarkEmbedded />
      </Section>

      <Section
        id="V12"
        title="Stacked Cards — 2 cards verticales sidebar-ready"
        subtitle="Cards individuelles X puis IG, gros handle, chevron vers le profil. Cas : sidebar, drawer, menu burger."
      >
        <VariantStackedCards />
      </Section>

      <Section
        id="V13"
        title="Newsletter Combo — email + RS dans une card"
        subtitle="Block unique : signup newsletter + handles RS. Convertit les visiteurs intéressés sur 3 canaux d'un coup."
      >
        <VariantNewsletterCombo />
      </Section>

      <Section
        id="V14"
        title="Pulse Glow — boutons circulaires avec pulse subtil"
        subtitle="2 boutons ronds avec ping animation lente (3 s). Attire l'œil discrètement. Léger (CSS only)."
      >
        <VariantPulseGlow />
      </Section>

      <Section
        id="V15"
        title="Glassmorphism — carte verre Apple-style"
        subtitle="Gradient border violet/fuchsia/cyan + backdrop-blur. Premium, intemporel, marche en dark + light."
      >
        <VariantGlassmorphism />
      </Section>

      <Section
        id="V16"
        title="Orbital Constellation — avatar Mettrik central + satellites RS"
        subtitle="Avatar M au centre, X et IG en orbite. Storytelling visuel cohérent avec l'ADN Mettrik AI."
      >
        <VariantOrbitalConstellation />
      </Section>

      <div className="mt-10 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-violet-300" />
          <h3 className="font-display text-[14px] font-semibold uppercase tracking-wider text-violet-200">
            Comment décider ? (16 variants disponibles)
          </h3>
        </div>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-zinc-300">
          <li>· <strong>Footer global toutes pages — sobre :</strong> V8 Inline Pills (classique) ou V11 Wordmark Embedded</li>
          <li>· <strong>Footer global toutes pages — wow :</strong> V10 Hero Banner ou V15 Glassmorphism</li>
          <li>· <strong>Page Contact / Connect (hero) :</strong> V7 Holographic, V15 Glassmorphism, V16 Orbital</li>
          <li>· <strong>Fiches société (partage contextualisé) :</strong> V4 Context Compose</li>
          <li>· <strong>Présence permanente sans pollution :</strong> V5 Sticky Rail ou V9 Floating Dock</li>
          <li>· <strong>Pages longues / blog :</strong> V12 Stacked Cards (sidebar)</li>
          <li>· <strong>Acquisition leads :</strong> V13 Newsletter Combo</li>
          <li>· <strong>Home top-nav :</strong> V3 Brand Morph ou V11 Wordmark Embedded</li>
          <li>· <strong>Bonus démo/business cards :</strong> V6 QR</li>
          <li>· <strong>Discret avec micro-feedback :</strong> V14 Pulse Glow</li>
          <li>· <strong>Action rapide tap mobile :</strong> V1 Smart Tap</li>
          <li>· <strong>Engagement par aperçu :</strong> V2 Live Preview</li>
        </ul>
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3 text-[12px] text-amber-100">
          <strong>Prochaine étape :</strong> dis-moi 1 à 3 variants que tu veux tester en
          conditions réelles. Je les plug sur staging (GlobalSocialBar bottom + éventuellement
          un autre emplacement), tu compares en live et on garde le ou les vainqueurs.
        </div>
      </div>
    </>
  );
}
