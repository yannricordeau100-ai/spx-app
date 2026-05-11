"use client";

import { useEffect, useRef } from "react";

/**
 * FloatingLogosBg — fond animé pour la page pricing.
 *
 * Yann (11 mai 2026) : "rendre la page pricing moins austère. Logos
 * top 50 (top 307) en background, dérivant comme dans l'espace, qui
 * rebondissent sur les bords. Version contour noir pour pas de halo
 * entre fond noir et logo".
 *
 * Implémentation :
 * - Canvas plein écran (z-index 0, pointer-events none)
 * - 1 logo par ticker, position + vélocité aléatoires lents (0.2-0.5 px/frame)
 * - Rebond élastique sur les 4 bords
 * - Filter CSS : invert(1) + brightness(0.85) + opacity(0.13) → silhouette
 *   blanche translucide subtile sur fond noir Mettrik (#050505)
 * - requestAnimationFrame loop, throttle 30 fps pour ne pas chauffer
 *
 * Logos chargés en parallèle, ratio aspect préservé. Si une image ne
 * charge pas (logo manquant) → silently skip, pas de placeholder.
 */
export function FloatingLogosBg({ tickers }: { tickers: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stopped = false;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx?.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    type Sprite = {
      img: HTMLImageElement;
      x: number;
      y: number;
      dx: number;
      dy: number;
      w: number;
      h: number;
    };

    const sprites: Sprite[] = [];
    let loadedCount = 0;
    const targetW = 90; // taille max d'un logo

    tickers.forEach((t) => {
      const img = new Image();
      img.src = `/logos/${t.toLowerCase()}.png`;
      img.onload = () => {
        // Calcule taille en gardant aspect ratio
        const ratio = img.naturalHeight / img.naturalWidth;
        const w = targetW;
        const h = Math.round(w * ratio);
        const x = Math.random() * (window.innerWidth - w);
        const y = Math.random() * (window.innerHeight - h);
        // Vélocité lente, sens aléatoire
        const speed = 0.15 + Math.random() * 0.25;
        const angle = Math.random() * Math.PI * 2;
        sprites.push({
          img,
          x,
          y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          w,
          h,
        });
        loadedCount++;
      };
      img.onerror = () => {
        // Logo manquant : on ignore silencieusement
      };
    });

    let lastFrame = 0;
    const targetFps = 30;
    const frameDelay = 1000 / targetFps;

    function tick(now: number) {
      if (stopped || !canvas || !ctx) return;
      if (now - lastFrame < frameDelay) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;

      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      for (const s of sprites) {
        // Rebond bords
        if (s.x <= 0 || s.x + s.w >= W) {
          s.dx = -s.dx;
          s.x = Math.max(0, Math.min(s.x, W - s.w));
        }
        if (s.y <= 0 || s.y + s.h >= H) {
          s.dy = -s.dy;
          s.y = Math.max(0, Math.min(s.y, H - s.h));
        }
        s.x += s.dx;
        s.y += s.dy;
        // Dessine logo
        try {
          ctx.drawImage(s.img, s.x, s.y, s.w, s.h);
        } catch {
          // ignore (image décodage failed mid-frame)
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [tickers]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      // Filtre CSS : silhouette blanche translucide, mix-blend pour
      // que les logos se posent harmonieusement sur le fond #050505.
      style={{
        filter: "invert(1) brightness(0.9) opacity(0.13) contrast(1.2)",
        mixBlendMode: "screen",
      }}
    />
  );
}
