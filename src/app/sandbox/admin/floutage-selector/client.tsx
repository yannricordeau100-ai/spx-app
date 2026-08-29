"use client";

/**
 * Selecteur de floutage par ZONES NOMMEES (Yann 29 aout 2026).
 *
 * Remplace l ancien selecteur a chemins CSS, casse a chaque retouche de
 * design. Ici, une zone = un identifiant de bloc stable emis par le code des
 * pages (hero, kpis, risques...), decline en parties. L apercu de droite est
 * une VRAIE page societe : ce qui y est floute est exactement ce que verra le
 * palier gratuit, car le meme selecteur est applique des l enregistrement,
 * sans redeploiement (stockage Supabase, lecture /api/floutage-zones).
 */
import { useEffect, useRef, useState } from "react";
import type { BlockId } from "@/lib/v1-9-blocks-control";
import { BLOCK_LABELS } from "@/lib/v1-9-blocks-control";
import {
  LIBELLES_PARTIES,
  PARTIES_PAR_BLOC,
  selecteurDeZone,
  type PartieDeBloc,
  type Zone,
} from "@/lib/floutage";

const STYLE_ID = "mtk-floutage-apercu";
const cle = (z: Zone) => `${z.bloc}::${z.partie}`;

export function FloutageSelectorClient(_props: { ticker?: string; auditToken?: string | null } = {}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [charge, setCharge] = useState(false);
  const [statut, setStatut] = useState<string | null>(null);
  const [ticker, setTicker] = useState("AAPL");
  const [comptes, setComptes] = useState<Record<string, number>>({});
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/api/desk/floutage-zones")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.zones)) setZones(j.zones as Zone[]);
        setCharge(true);
      })
      .catch(() => setCharge(true));
  }, []);

  // Injection dans l apercu : memes selecteurs que la production, plus un
  // compte d elements reellement touches par zone (0 = partie pas encore
  // ancree dans le code des pages : cocher n aurait aucun effet).
  const injecte = () => {
    try {
      const doc = frameRef.current?.contentDocument;
      if (!doc) return;
      let st = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!st) {
        st = doc.createElement("style");
        st.id = STYLE_ID;
        doc.head.appendChild(st);
      }
      st.textContent = zones
        .map(
          (z) =>
            `${selecteurDeZone(z)} { filter: blur(9px); user-select: none; pointer-events: none; }`,
        )
        .join("\n");
      const nouveaux: Record<string, number> = {};
      for (const [bloc, parties] of Object.entries(PARTIES_PAR_BLOC)) {
        for (const partie of parties ?? []) {
          const z: Zone = { bloc: bloc as BlockId, partie };
          nouveaux[cle(z)] = doc.querySelectorAll(selecteurDeZone(z)).length;
        }
      }
      setComptes(nouveaux);
    } catch {
      // apercu pas encore charge
    }
  };
  useEffect(injecte, [zones, ticker]);

  const bascule = (z: Zone) =>
    setZones((prev) =>
      prev.some((x) => cle(x) === cle(z))
        ? prev.filter((x) => cle(x) !== cle(z))
        : [...prev, z],
    );

  const enregistre = async () => {
    setStatut("enregistrement…");
    try {
      const r = await fetch("/api/desk/floutage-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones }),
      });
      setStatut(r.ok ? `enregistré (${zones.length} zones), actif immédiatement` : `échec ${r.status}`);
    } catch (e) {
      setStatut(`échec : ${String(e)}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-[#050505] p-4 text-zinc-100 lg:flex-row">
      <div className="w-full shrink-0 lg:w-[380px]">
        <h1 className="font-display text-[19px] font-bold">Floutage par zones</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
          Coche ce que le palier gratuit ne doit pas voir. L aperçu à droite est une vraie
          page : ce qui y est flouté est exactement ce qui le sera en production, sur les
          666 pages, quel que soit leur agencement. « 0 élément » = partie pas encore
          ancrée dans le code, cocher n aurait aucun effet.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={enregistre}
            disabled={!charge}
            className="rounded-lg bg-violet-500/30 px-4 py-2 text-[13px] font-semibold text-violet-100 ring-1 ring-violet-500/40 hover:bg-violet-500/40 disabled:opacity-50"
          >
            Enregistrer ({zones.length})
          </button>
          {statut && <span className="text-[11.5px] text-zinc-400">{statut}</span>}
        </div>
        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {Object.entries(PARTIES_PAR_BLOC).map(([bloc, parties]) => (
            <div key={bloc} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-2 text-[12.5px] font-semibold text-zinc-200">
                {BLOCK_LABELS[bloc as BlockId] ?? bloc}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(parties ?? []).map((partie: PartieDeBloc) => {
                  const z: Zone = { bloc: bloc as BlockId, partie };
                  const actif = zones.some((x) => cle(x) === cle(z));
                  const n = comptes[cle(z)];
                  const inerte = n === 0;
                  return (
                    <button
                      key={partie}
                      type="button"
                      onClick={() => bascule(z)}
                      title={n != null ? `${n} élément(s) touché(s) sur la page d aperçu` : undefined}
                      className={`rounded-md px-2 py-1 text-[11.5px] transition-colors ${
                        actif
                          ? "bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/50"
                          : inerte
                            ? "bg-white/[0.02] text-zinc-600"
                            : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1]"
                      }`}
                    >
                      {LIBELLES_PARTIES[partie]}
                      {n != null && (
                        <span className="ml-1 text-[9.5px] text-zinc-500">{n}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11.5px] uppercase tracking-wider text-zinc-500">Aperçu :</span>
          {["AAPL", "MC.PA", "SPCX", "VMRK"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTicker(t)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11.5px] ${
                ticker === t
                  ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40"
                  : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <iframe
          ref={frameRef}
          src={`/sandbox/v1-9-5/${ticker.toLowerCase()}${typeof window !== "undefined" ? window.location.search : ""}`}
          onLoad={injecte}
          className="h-[85vh] w-full rounded-xl border border-white/10 bg-black"
          title="aperçu"
        />
      </div>
    </div>
  );
}
