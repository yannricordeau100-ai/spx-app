"use client";

/**
 * DEMO du floutage par zones nommees (Yann 29 aout 2026).
 *
 * Rien n est enregistre, rien ne touche les vraies pages : les deux cadres
 * ci-dessous chargent DEUX VRAIES pages societes (Apple, tres fournie, et
 * SpaceX, tres pauvre) et le floutage coche est injecte dedans a la volee.
 * C est exactement le rendu qu aurait la production : meme selecteur
 * [data-blur="…"], meme flou, quel que soit l agencement de la page.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockId } from "@/lib/v1-9-blocks-control";
import { BLOCK_LABELS } from "@/lib/v1-9-blocks-control";

/** Zones deja ancrees dans les pages (attribut data-blur emis par le code). */
const ZONES_DISPO: BlockId[] = ["hero", "kpis", "risks", "governance", "ai_positioning"];

const STYLE_ID = "mtk-floutage-demo";

function injecte(frame: HTMLIFrameElement | null, zones: Set<string>) {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return;
    let st = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!st) {
      st = doc.createElement("style");
      st.id = STYLE_ID;
      doc.head.appendChild(st);
    }
    st.textContent = [...zones]
      .map(
        (z) =>
          `[data-blur="${z}"] { filter: blur(9px); user-select: none; pointer-events: none; }`,
      )
      .join("\n");
  } catch {
    // iframe pas encore chargee : le onLoad rejouera l injection.
  }
}

function Cadre({
  ticker,
  nom,
  zones,
  suffixe,
}: {
  ticker: string;
  nom: string;
  zones: Set<string>;
  suffixe: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    injecte(ref.current, zones);
  }, [zones]);
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
        {nom} ({ticker})
      </div>
      <iframe
        ref={ref}
        src={`/sandbox/v1-9-5/${ticker.toLowerCase()}${suffixe}`}
        onLoad={() => injecte(ref.current, zones)}
        className="h-[70vh] w-full rounded-xl border border-white/10 bg-black"
        title={nom}
      />
    </div>
  );
}

export function FloutageDemoClient() {
  const [zones, setZones] = useState<Set<string>>(new Set(["kpis"]));
  // Transmet le jeton d audit de la page demo aux cadres, pour la
  // verification hors session.
  const suffixe = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.search || "";
  }, []);

  const bascule = (z: string) =>
    setZones((prev) => {
      const n = new Set(prev);
      if (n.has(z)) n.delete(z);
      else n.add(z);
      return n;
    });

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-zinc-100 sm:px-6">
      <h1 className="font-display text-[20px] font-bold">Démo : floutage par zones nommées</h1>
      <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-400">
        Rien n est enregistré. Les deux cadres chargent deux vraies pages sociétés aux
        contenus très différents ; cocher une zone la floute dans les deux, à l endroit
        exact où la production la flouterait, quel que soit l agencement de chaque page.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ZONES_DISPO.map((z) => (
          <label
            key={z}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors ${
              zones.has(z)
                ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <input
              type="checkbox"
              checked={zones.has(z)}
              onChange={() => bascule(z)}
              className="size-3.5"
            />
            {BLOCK_LABELS[z] ?? z}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <Cadre ticker="AAPL" nom="Apple · page très fournie" zones={zones} suffixe={suffixe} />
        <Cadre ticker="SPCX" nom="SpaceX · page pauvre" zones={zones} suffixe={suffixe} />
      </div>
    </div>
  );
}
