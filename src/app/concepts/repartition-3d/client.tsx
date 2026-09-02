"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deux créations 3D pour la répartition du CA (données réelles Apple FY2025).
 * Zéro librairie : CSS 3D (perspective + preserve-3d) piloté à la souris.
 *
 * 1. GÉO — "Constellation satellite" : les zones géographiques orbitent en
 *    3D autour du noyau (CA total). La souris incline le point de vue comme
 *    un satellite d'observation ; l'orbite tourne lentement toute seule.
 * 2. SEGMENT — "Tours holographiques" : les segments sont des tours de verre
 *    néon sur un plateau quadrillé ; la souris fait pivoter le plateau.
 */

const GEO = [
  { label: "Amériques", v: 178.353, couleur: "#3b82f6" },
  { label: "Europe", v: 111.032, couleur: "#22d3ee" },
  { label: "Grande Chine", v: 64.377, couleur: "#ec4899" },
  { label: "Reste Asie-Pacifique", v: 33.696, couleur: "#f59e0b" },
  { label: "Japon", v: 28.703, couleur: "#a3e635" },
];
const SEG = [
  { label: "iPhone", v: 209.586, couleur: "#3b82f6" },
  { label: "Services", v: 109.158, couleur: "#a78bfa" },
  { label: "Objets connectés", v: 35.686, couleur: "#ec4899" },
  { label: "Mac", v: 33.708, couleur: "#22d3ee" },
  { label: "iPad", v: 28.023, couleur: "#f59e0b" },
];
const TOTAL_GEO = GEO.reduce((a, x) => a + x.v, 0);
const TOTAL_SEG = SEG.reduce((a, x) => a + x.v, 0);
const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Inclinaison douce pilotée par la souris (ressort simple en rAF). */
function useTiltSouris(max = 26) {
  const zone = useRef<HTMLDivElement>(null);
  const cible = useRef({ x: -14, y: 0 });
  const [tilt, setTilt] = useState({ x: -14, y: 0 });
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cible.current = { x: -14 - py * max, y: px * max * 1.6 };
    };
    const onLeave = () => {
      cible.current = { x: -14, y: 0 };
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setTilt((t) => ({
        x: t.x + (cible.current.x - t.x) * 0.08,
        y: t.y + (cible.current.y - t.y) * 0.08,
      }));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [max]);
  return { zone, tilt };
}

/* ────────────────────────────── 1. CONSTELLATION GÉO ─────────────────── */
function ConstellationGeo() {
  const { zone, tilt } = useTiltSouris(30);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setAngle((a) => a + 0.15);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const R = 235; // rayon d orbite (px)
  return (
    <div
      ref={zone}
      className="relative mx-auto h-[540px] w-full max-w-[760px] cursor-crosshair overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_30%,#101527,#05060a_70%)]"
      style={{ perspective: "1100px" }}
    >
      {/* étoiles de fond */}
      {Array.from({ length: 46 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: i % 5 === 0 ? 2.5 : 1.5,
            height: i % 5 === 0 ? 2.5 : 1.5,
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            opacity: 0.12 + ((i * 13) % 40) / 100,
          }}
        />
      ))}
      <div
        className="absolute left-1/2 top-1/2 h-0 w-0"
        style={{
          transform: `translate(-50%,-50%) rotateX(${tilt.x + 58}deg) rotateZ(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* anneau orbital */}
        <div
          className="absolute rounded-full border border-cyan-300/25"
          style={{
            width: R * 2,
            height: R * 2,
            left: -R,
            top: -R,
            boxShadow: "0 0 40px rgba(34,211,238,0.08) inset",
          }}
        />
        <div
          className="absolute rounded-full border border-white/[0.07]"
          style={{ width: R * 2 + 70, height: R * 2 + 70, left: -R - 35, top: -R - 35 }}
        />
        {/* noyau : CA total */}
        <div style={{ transform: `rotateZ(${-tilt.y}deg) rotateX(${-tilt.x - 58}deg)`, transformStyle: "preserve-3d" }}>
          <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 text-center">
            <div
              className="mx-auto flex size-32 flex-col items-center justify-center rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 30%, #4c5be0, #1b1e3a 65%)",
                boxShadow: "0 0 60px rgba(99,102,241,0.55), 0 0 140px rgba(99,102,241,0.25)",
              }}
            >
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-indigo-200/80">CA total</span>
              <span className="font-display text-[22px] font-bold text-white">{fmt(TOTAL_GEO)}</span>
              <span className="text-[10.5px] text-indigo-100/70">Mds $</span>
            </div>
          </div>
        </div>
        {/* satellites */}
        {GEO.map((g, i) => {
          const part = g.v / TOTAL_GEO;
          const a = ((angle + (360 / GEO.length) * i) * Math.PI) / 180;
          const x = Math.cos(a) * R;
          const y = Math.sin(a) * R;
          const taille = 34 + Math.sqrt(part) * 96;
          return (
            <div
              key={g.label}
              className="absolute left-0 top-0"
              style={{ transform: `translate3d(${x}px, ${y}px, 0)`, transformStyle: "preserve-3d" }}
            >
              {/* la carte satellite se redresse face caméra */}
              <div style={{ transform: `rotateZ(${-tilt.y}deg) rotateX(${-tilt.x - 58}deg)` }}>
                <div className="-translate-x-1/2 -translate-y-1/2 text-center" style={{ width: 150 }}>
                  <div
                    className="mx-auto rounded-full"
                    style={{
                      width: taille,
                      height: taille,
                      background: `radial-gradient(circle at 32% 28%, ${g.couleur}, #0a0a12 78%)`,
                      boxShadow: `0 0 ${18 + part * 70}px ${g.couleur}88`,
                    }}
                  />
                  <div className="mt-1.5 text-[12px] font-semibold leading-tight text-zinc-100">{g.label}</div>
                  <div className="font-mono text-[11px] text-zinc-300">
                    {fmt(g.v)} Mds $ · <span style={{ color: g.couleur }}>{(part * 100).toFixed(1).replace(".", ",")} %</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        Bouge la souris : vue satellite · Apple · vue géographique
      </div>
    </div>
  );
}

/* ─────────────────────────── 2. TOURS HOLOGRAPHIQUES ─────────────────── */
function ToursSegments() {
  const { zone, tilt } = useTiltSouris(22);
  const H_MAX = 300;
  return (
    <div
      ref={zone}
      className="relative mx-auto h-[540px] w-full max-w-[760px] cursor-crosshair overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_20%,#0d1420,#05060a_75%)]"
      style={{ perspective: "1200px" }}
    >
      <div
        className="absolute left-1/2 top-[58%]"
        style={{
          transform: `translate(-50%,-50%) rotateX(${tilt.x + 26}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* plateau quadrillé */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 640,
            height: 380,
            transform: "translate(-50%,-50%) rotateX(90deg) translateZ(-40px)",
            background:
              "linear-gradient(rgba(56,189,248,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.16) 1px, transparent 1px), radial-gradient(ellipse at center, rgba(56,189,248,0.10), transparent 70%)",
            backgroundSize: "40px 40px, 40px 40px, cover",
            border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: 24,
          }}
        />
        {/* tours */}
        {SEG.map((s, i) => {
          const part = s.v / TOTAL_SEG;
          const h = 40 + (s.v / SEG[0].v) * H_MAX;
          const x = (i - (SEG.length - 1) / 2) * 118;
          return (
            <div key={s.label} className="absolute left-0 top-0" style={{ transform: `translate3d(${x}px, 40px, 0)`, transformStyle: "preserve-3d" }}>
              {/* tour = 4 faces */}
              {[0, 90, 180, 270].map((ry) => (
                <div
                  key={ry}
                  className="absolute bottom-0 left-1/2"
                  style={{
                    width: 62,
                    height: h,
                    transform: `translateX(-50%) rotateY(${ry}deg) translateZ(31px)`,
                    background: `linear-gradient(to top, ${s.couleur}cc, ${s.couleur}22 85%, transparent)`,
                    border: `1px solid ${s.couleur}66`,
                    boxShadow: `0 0 30px ${s.couleur}33`,
                    backfaceVisibility: "hidden",
                  }}
                />
              ))}
              {/* toit lumineux */}
              <div
                className="absolute left-1/2"
                style={{
                  width: 62,
                  height: 62,
                  bottom: h,
                  transform: "translateX(-50%) rotateX(90deg) translateZ(31px)",
                  background: `${s.couleur}dd`,
                  boxShadow: `0 0 45px ${s.couleur}`,
                }}
              />
              {/* étiquette face caméra */}
              <div
                className="absolute left-1/2 text-center"
                style={{ bottom: h + 46, transform: `translateX(-50%) rotateY(${-tilt.y}deg) rotateX(${-tilt.x - 26}deg)`, width: 130 }}
              >
                <div className="text-[12.5px] font-semibold text-zinc-100">{s.label}</div>
                <div className="font-mono text-[11px] text-zinc-300">
                  {fmt(s.v)} Mds $ · <span style={{ color: s.couleur }}>{(part * 100).toFixed(1).replace(".", ",")} %</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        Bouge la souris : le plateau pivote · Apple · vue par segment
      </div>
    </div>
  );
}

export function Repartition3DClient() {
  return (
    <div className="min-h-screen bg-[#050507] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <h1 className="text-[24px] font-bold">Répartition du CA : deux créations 3D</h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Données réelles Apple (exercice 2025). Interactions à la souris, aucune librairie.
          </p>
        </header>
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-cyan-300">
            1 · Vue géographique : constellation satellite
          </h2>
          <ConstellationGeo />
        </section>
        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-violet-300">
            2 · Vue segment : tours holographiques
          </h2>
          <ToursSegments />
        </section>
        <p className="text-[12.5px] text-zinc-400">
          Dis-moi laquelle (ou les deux) je branche dans le vrai bloc Répartition, et pour quelles vues.
        </p>
      </div>
    </div>
  );
}
