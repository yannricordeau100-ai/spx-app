"use client";

/**
 * Bouton "Enregistrer" d une fiche societe (Yann 4 sept 2026).
 *
 * Avant : le bouton existait mais ne faisait STRICTEMENT rien, aucun clic
 * n etait branche. Desormais :
 *  - offre payante : il enregistre la societe sur le compte, et se remplit
 *    quand elle l est deja ;
 *  - anonyme ou gratuit : cadenas et invitation a s abonner au survol, comme
 *    le mode clair, pour que la limite soit lisible au lieu d etre muette.
 */

import { useEffect, useState } from "react";
import { Bookmark, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

export function BoutonEnregistrer({ ticker, paye, connecte = false }: { ticker: string; paye: boolean; connecte?: boolean }) {
  const { t } = useT();
  const [enregistre, setEnregistre] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!paye) return;
    let vivant = true;
    fetch("/api/company/saved")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivant || !j) return;
        const liste = Array.isArray(j.tickers) ? (j.tickers as string[]) : [];
        setEnregistre(liste.includes(ticker.toUpperCase()));
      })
      .catch(() => { /* hors ligne : le bouton reste neutre */ });
    return () => { vivant = false; };
  }, [ticker, paye]);

  const bascule = async () => {
    if (enCours) return;
    setEnCours(true);
    const avant = enregistre;
    setEnregistre(!avant);          // reponse immediate a l oeil
    try {
      const r = avant
        ? await fetch(`/api/company/saved?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" })
        : await fetch("/api/company/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker }),
          });
      if (!r.ok) setEnregistre(avant);   // echec : on revient a l etat reel
    } catch {
      setEnregistre(avant);
    } finally {
      setEnCours(false);
    }
  };

  const base =
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 sm:px-3.5 text-sm font-medium transition-colors";

  // Yann 4 sept 2026 : sans compte, le clic doit MENER quelque part. On envoie
  // vers l inscription, avec retour sur la fiche apres creation du compte.
  if (!connecte) {
    return (
      <a
        href={`/?auth=signup&next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
        title="Créer un compte pour enregistrer cette société"
        className={`${base} border-[#262626] bg-[#0a0a0a] text-zinc-300 hover:border-violet-400/40 hover:text-zinc-100`}
      >
        <Bookmark className="size-4" />
        <span className="hidden sm:inline">{t("company.save.button")}</span>
      </a>
    );
  }

  if (!paye) {
    return (
      <span className="group/enreg relative inline-flex">
        <span
          aria-disabled="true"
          className={`${base} cursor-not-allowed border-[#1f1f1f] bg-[#0a0a0a] text-zinc-600`}
        >
          <span className="relative inline-flex">
            <Bookmark className="size-4 opacity-50" />
            <Lock className="absolute -bottom-1 -right-1 size-2.5 text-zinc-500" />
          </span>
          <span className="hidden sm:inline">{t("company.save.button")}</span>
        </span>
        <a
          href="/pricing"
          className="pointer-events-none absolute right-0 top-full z-[120] mt-2 w-[220px] rounded-xl border border-violet-400/30 bg-[#0b0b0e] p-3 text-left opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.6)] transition-opacity duration-150 group-hover/enreg:pointer-events-auto group-hover/enreg:opacity-100"
        >
          <span className="block text-[12px] font-semibold text-zinc-100">
            Enregistrer vos sociétés est réservé aux abonnés
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-zinc-400">
            Retrouvez vos suivies en un clic, sur tous vos appareils.
          </span>
          <span className="mt-2 inline-flex items-center rounded-md bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            Voir les offres
          </span>
        </a>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={bascule}
      aria-pressed={enregistre}
      title={enregistre ? "Retirer de mes sociétés" : "Enregistrer cette société"}
      className={`${base} ${
        enregistre
          ? "border-violet-400/50 bg-violet-500/15 text-violet-200 hover:border-violet-300"
          : "border-[#262626] bg-[#0a0a0a] text-zinc-300 hover:border-[#3a3a3a] hover:text-zinc-100"
      }`}
    >
      <Bookmark className={`size-4 ${enregistre ? "fill-current" : ""}`} />
      <span className="hidden sm:inline">{t("company.save.button")}</span>
    </button>
  );
}
