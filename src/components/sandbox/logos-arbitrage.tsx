"use client";

/**
 * Choix des logos douteux (07 sept 2026) : pour chaque société, l actuel et
 * le candidat officiel rendus EXACTEMENT comme sur la page société (cadre
 * carré arrondi, fond noir, pastille blanche si logo sombre), une case à
 * cocher sur chacun. Enregistrement immédiat en base.
 */

import { useEffect, useState } from "react";

type Paire = { ticker: string; nom: string; raison: string; sourceCandidat: string };

function Cadre({ src, sombre }: { src: string; sombre?: boolean }) {
  return (
    <div
      className={`flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-xl ring-1 ${
        sombre ? "bg-white ring-black/15" : "bg-[#0a0a0a] ring-white/10"
      }`}
    >
      <span
        role="img"
        className="block h-full w-full"
        style={{ backgroundImage: `url(${src})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
      />
    </div>
  );
}

export function LogosArbitrage({ paires, jeton }: { paires: Paire[]; jeton: string | null }) {
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const url = `/api/sandbox/logos-arbitrage${jeton ? `?audit_token=${encodeURIComponent(jeton)}` : ""}`;

  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((j: { choix?: Record<string, string> }) => setChoix(j.choix ?? {}))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enregistre(ticker: string, valeur: "actuel" | "candidat" | null) {
    setEnCours(ticker);
    setErreur("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, choix: valeur }),
      });
      const j = (await r.json()) as { ok?: boolean; choix?: Record<string, string>; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "échec");
      setChoix(j.choix ?? {});
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "échec");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="grid gap-4">
      {erreur && <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">{erreur}</div>}
      {paires.map((p) => {
        const fichier = p.ticker.replace(/\./g, "-");
        const sel = choix[p.ticker];
        return (
          <div key={p.ticker} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[13px] font-semibold text-violet-200">{p.ticker}</span>
              <span className="text-[15px] font-semibold text-zinc-100">{p.nom}</span>
              <span className="text-[12px] text-zinc-500">{p.raison}</span>
              {sel && <span className="ml-auto rounded-full border border-emerald-400/40 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-emerald-200">choisi : {sel}</span>}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(["actuel", "candidat"] as const).map((cote) => (
                <label
                  key={cote}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border p-3 transition-colors ${
                    sel === cote ? "border-emerald-400/60 bg-emerald-500/[0.08]" : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sel === cote}
                    disabled={enCours === p.ticker}
                    onChange={() => void enregistre(p.ticker, sel === cote ? null : cote)}
                    className="size-4 accent-emerald-400"
                  />
                  <Cadre src={cote === "actuel" ? `/logos/${fichier}.png` : `/logos-candidats/${fichier}.png`} />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-zinc-100">{cote === "actuel" ? "Logo actuel" : "Candidat officiel"}</div>
                    <div className="mt-0.5 text-[12px] text-zinc-400">{cote === "actuel" ? "tel qu'affiché aujourd'hui" : p.sourceCandidat}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
