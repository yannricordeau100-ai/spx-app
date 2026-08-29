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
  // Yann 29 aout 2026 : le token d audit de l URL doit suivre dans l iframe.
  // L expression inline `typeof window...` rendait "" au SSR et React gardait
  // cet attribut a l hydratation : l apercu partait sans token, le proxy le
  // renvoyait vers la connexion et TOUS les compteurs restaient a 0.
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(window.location.search);
  }, []);
  const [comptes, setComptes] = useState<Record<string, number>>({});
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Portee d edition : reglage commun a toutes les societes, ou reglage
  // propre a la societe de l apercu (qui PRIME ; vide = exemption totale).
  const [portee, setPortee] = useState<"globale" | "societe">("globale");
  const [porteeChargee, setPorteeChargee] = useState<string>("globale");
  // Societes ayant un reglage propre (3e categorie de l outil, ex GOOGL/META).
  const [propres, setPropres] = useState<string[]>([]);
  const chargePropres = () => {
    fetch("/api/desk/floutage-zones?liste=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setPropres(Array.isArray(j?.tickers) ? j.tickers : []))
      .catch(() => {});
  };
  useEffect(chargePropres, []);
  useEffect(() => {
    const q = portee === "societe" ? `?ticker=${encodeURIComponent(ticker)}` : "";
    setCharge(false);
    fetch(`/api/desk/floutage-zones${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.zones)) setZones(j.zones as Zone[]);
        if (j && typeof j.portee === "string") setPorteeChargee(j.portee);
        setCharge(true);
      })
      .catch(() => setCharge(true));
  }, [portee, ticker]);

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
        body: JSON.stringify({ zones, ticker: portee === "societe" ? ticker : undefined }),
      });
      setStatut(
        r.ok
          ? portee === "societe"
            ? `enregistré pour ${ticker} (${zones.length} zones${zones.length === 0 ? " : exemption totale" : ""})`
            : `enregistré pour toutes les stés (${zones.length} zones)`
          : `échec ${r.status}`,
      );
      if (r.ok) chargePropres();
    } catch (e) {
      setStatut(`échec : ${String(e)}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-[#050505] p-4 text-zinc-100">
      <div className="w-full">
        <h1 className="font-display text-[19px] font-bold">Floutage par zones</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
          Coche ce que le palier gratuit ne doit pas voir. L aperçu à droite est une vraie
          page : ce qui y est flouté est exactement ce qui le sera en production, sur les
          666 pages, quel que soit leur agencement. « 0 élément » = partie pas encore
          ancrée dans le code, cocher n aurait aucun effet.
        </p>
        {/* 3 catégories : réglage global, sociétés à réglage propre, ajout libre. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Réglages propres :</span>
          {propres.length === 0 && <span className="text-zinc-600">aucun</span>}
          {propres.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTicker(t); setPortee("societe"); }}
              className={`rounded-full border px-2.5 py-1 font-mono ${
                portee === "societe" && ticker === t
                  ? "border-violet-400/60 bg-violet-500/25 text-violet-100"
                  : "border-white/15 text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              {t}
            </button>
          ))}
          <input
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
                if (v) { setTicker(v); setPortee("societe"); (e.target as HTMLInputElement).value = ""; }
              }
            }}
            placeholder="+ Ajouter une sté (ticker + Entrée)"
            className="w-[210px] rounded-full border border-dashed border-white/20 bg-black/40 px-3 py-1 font-mono text-[11px] uppercase text-zinc-100 outline-none focus:border-violet-400/60"
            title="Choisis n importe quelle société, coche/décoche ses blocs, puis Enregistrer : elle rejoint les réglages propres."
          />
        </div>
        <div className="mt-3 flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-[11.5px]" style={{ width: "fit-content" }}>
          <button
            type="button"
            onClick={() => setPortee("globale")}
            className={`rounded-full px-2.5 py-1 ${portee === "globale" ? "bg-violet-500/30 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            Toutes les stés
          </button>
          <button
            type="button"
            onClick={() => setPortee("societe")}
            className={`rounded-full px-2.5 py-1 ${portee === "societe" ? "bg-violet-500/30 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            Uniquement {ticker}
          </button>
          {portee === "societe" && (
            <span className="px-1.5 text-[10.5px] text-zinc-500">
              {porteeChargee === "societe" ? "réglage propre actif" : "suit le réglage global"}
            </span>
          )}
        </div>
        {portee === "societe" && porteeChargee === "societe" && (
          <button
            type="button"
            onClick={async () => {
              const r = await fetch(`/api/desk/floutage-zones?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
              setStatut(r.ok ? `${ticker} revient au réglage global` : `échec ${r.status}`);
              setPorteeChargee("globale");
              setPortee("globale");
              if (r.ok) chargePropres();
            }}
            className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-[11.5px] text-zinc-300 hover:bg-white/[0.06]"
          >
            Supprimer le réglage propre de {ticker}
          </button>
        )}
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      {(() => { const l = LIBELLES_PARTIES[partie]; return l.charAt(0).toUpperCase() + l.slice(1); })()}
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
      <div className="w-full">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11.5px] uppercase tracking-wider text-zinc-500">Aperçu :</span>
          <input
            defaultValue={ticker}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
                if (v) setTicker(v);
              }
            }}
            placeholder="Ticker + Entrée"
            className="w-[130px] rounded-md border border-white/15 bg-black/40 px-2 py-1 font-mono text-[11.5px] uppercase text-zinc-100 outline-none focus:border-violet-400/60"
            title="N importe quel ticker de l app (ex GOOGL, META, NESN.SW)"
          />
          {["AAPL", "MC.PA", "SPCX", "GOOGL", "META"].map((t) => (
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
          src={`/sandbox/v1-9-5/${ticker.toLowerCase()}${search}`}
          onLoad={injecte}
          className="h-[92vh] w-full rounded-xl border border-white/10 bg-black"
          title="aperçu"
        />
      </div>
    </div>
  );
}
