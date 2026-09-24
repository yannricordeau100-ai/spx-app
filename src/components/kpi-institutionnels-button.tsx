"use client";

/**
 * Yann 25 sept 2026 : a cote de l etoile de favori, VUE ADMIN UNIQUEMENT,
 * un bouton qui ouvre « les KPI que les institutionnels regardent » pour
 * l industrie GICS de la societe (referentiel des 74 industries), avec l etat
 * de chacun sur la fiche : present, non publie par la societe, sans objet.
 * Rien n est rendu pour un visiteur ni un abonne (l API repond admin:false).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Landmark, Minus, X } from "lucide-react";

type Kpi = { fr: string; en: string; etat: "present" | "absent" | "sans_objet"; raison: string | null };
type Reponse = { admin: boolean; industrie?: string | null; secteur?: string; code?: string; maj?: string | null; kpis?: Kpi[] };

export function KpiInstitutionnelsButton({ ticker, accent = "#a78bfa" }: { ticker: string; accent?: string }) {
  const [data, setData] = useState<Reponse | null>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch(`/api/admin/kpi-institutionnels?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d: Reponse) => { if (!annule) setData(d); })
      .catch(() => {});
    return () => { annule = true; };
  }, [ticker]);

  useEffect(() => {
    if (!ouvert) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [ouvert]);

  if (!data?.admin) return null;
  const kpis = data.kpis ?? [];
  const presents = kpis.filter((k) => k.etat === "present");
  const absents = kpis.filter((k) => k.etat === "absent");
  const sansObjet = kpis.filter((k) => k.etat === "sans_objet");
  const applicables = presents.length + absents.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        title="KPI que les institutionnels regardent (vue admin)"
        aria-label="KPI que les institutionnels regardent"
        className="group relative inline-flex size-7 shrink-0 items-center justify-center self-center rounded-lg border transition-all hover:scale-105"
        style={{ borderColor: `${accent}66`, background: `linear-gradient(135deg, ${accent}26, transparent)`, color: accent }}
      >
        <Landmark className="size-[15px]" strokeWidth={2.2} />
        {applicables > 0 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-black bg-zinc-900 px-1 font-mono text-[8.5px] font-bold leading-[13px] text-zinc-200">
            {presents.length}/{applicables}
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {ouvert && (
              <motion.div
                className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOuvert(false)}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ y: 12, scale: 0.98 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 12, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0d] shadow-2xl"
                >
                  <div className="relative border-b border-white/[0.07] px-5 py-4" style={{ background: `linear-gradient(120deg, ${accent}1f, transparent 60%)` }}>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                      <Landmark className="size-3.5" style={{ color: accent }} />
                      KPI que les institutionnels regardent
                      <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-px text-[9px] text-amber-200">admin</span>
                    </div>
                    <h2 className="mt-1.5 font-display text-[19px] font-bold leading-tight text-zinc-50">{data.industrie ?? "Industrie non référencée"}</h2>
                    {data.secteur && <p className="mt-0.5 text-[12px] text-zinc-400">{data.secteur.charAt(0) + data.secteur.slice(1).toLowerCase()} · GICS {data.code}</p>}
                    <button onClick={() => setOuvert(false)} aria-label="Fermer" className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
                      <X className="size-4" />
                    </button>
                    {applicables > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${(presents.length / applicables) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[12px] text-zinc-300">
                          <b className="text-emerald-300">{presents.length}</b> / {applicables} sur la fiche
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[calc(82vh-130px)] overflow-y-auto px-5 py-4">
                    {kpis.length === 0 ? (
                      <p className="text-[13px] text-zinc-400">Aucun référentiel d&apos;industrie pour cette société.</p>
                    ) : (
                      <div className="space-y-4">
                        <Groupe titre="Sur la fiche" liste={presents} ton="present" />
                        <Groupe titre="Non publiés par la société" liste={absents} ton="absent" />
                        <Groupe titre="Sans objet pour cette société" liste={sansObjet} ton="sans_objet" />
                      </div>
                    )}
                  </div>
                  {data.maj && <p className="border-t border-white/[0.06] px-5 py-2 font-mono text-[10px] text-zinc-500">Référentiel GICS des 74 industries · état au {data.maj}</p>}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Groupe({ titre, liste, ton }: { titre: string; liste: Kpi[]; ton: Kpi["etat"] }) {
  if (liste.length === 0) return null;
  const style =
    ton === "present"
      ? { icone: <Check className="size-3.5" />, pastille: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" }
      : ton === "absent"
        ? { icone: <X className="size-3.5" />, pastille: "border-white/10 bg-white/[0.03] text-zinc-500" }
        : { icone: <Minus className="size-3.5" />, pastille: "border-white/[0.06] bg-transparent text-zinc-600" };
  return (
    <section>
      <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {titre} <span className="text-zinc-600">· {liste.length}</span>
      </h3>
      <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
        {liste.map((k) => (
          <li key={k.fr} className="flex items-start gap-3 px-3 py-2">
            <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${style.pastille}`}>{style.icone}</span>
            <div className="min-w-0">
              <div className={`text-[13.5px] leading-snug ${ton === "present" ? "text-zinc-100" : "text-zinc-300"}`}>{k.fr}</div>
              <div className="font-mono text-[10.5px] text-zinc-500">{k.en}</div>
              {k.raison && ton !== "present" && <div className="mt-0.5 text-[11.5px] italic text-zinc-500">{k.raison}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
