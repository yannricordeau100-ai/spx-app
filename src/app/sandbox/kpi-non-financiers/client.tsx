"use client";

/**
 * Atelier des indicateurs non financiers (Yann, 21 sept 2026).
 *
 * Saisie de tickers, criteres coches, puis demande de recherche. La demande
 * cree seulement une ligne au statut a traiter : rien ne part en recherche
 * tant que Yann n a pas donne son feu vert. Les propositions deja en base
 * sont presentees en cartes, sur le modele de /concepts/kpi-netflix, avec une
 * case a cocher chacune et un seul bouton d enregistrement en bas.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Quote } from "lucide-react";
import {
  CRITERES_PAR_DEFAUT,
  LIBELLES_CRITERES,
  type CriteresKpiNonFinancier,
  type LigneKpiNonFinancier,
  type PropositionNonFinanciere,
} from "@/lib/desk/kpi-non-financiers";

const API = "/api/desk-mtk9x4kp/kpi-non-financiers";

const CLES_CRITERES = [
  "min_cinq_points",
  "profondeur_minimale",
  "source_recente_18_mois",
  "source_adaptee_secteur",
  "source_officielle_seulement",
  "exclure_panels_payants",
] as const;

const LIBELLES_STATUTS: Record<string, string> = {
  a_traiter: "à traiter",
  en_cours: "en cours",
  propose: "proposé",
  enregistre: "enregistré",
  erreur: "erreur",
};

function Etoiles({ n }: { n?: number }) {
  const v = Math.max(0, Math.min(5, Math.round(n ?? 0)));
  return (
    <span
      className="font-mono text-[11px] text-amber-200/80"
      title={`Fiabilité ${v} sur 5`}
    >
      {"●".repeat(v)}
      <span className="text-zinc-700">{"●".repeat(5 - v)}</span>
    </span>
  );
}

function Serie({ valeurs }: { valeurs?: (number | string)[][] }) {
  if (!valeurs || valeurs.length === 0) return null;
  const nombres = valeurs.map(([, v]) =>
    typeof v === "number" ? v : Number(String(v).replace(",", ".")),
  );
  const valides = nombres.filter((n) => Number.isFinite(n));
  const max = valides.length > 0 ? Math.max(...valides) : 0;
  const min = valides.length > 0 ? Math.min(...valides) : 0;
  const etendue = max - min || 1;
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {valeurs.map(([periode, v], i) => {
        const n = nombres[i];
        const hauteur = Number.isFinite(n) ? 8 + ((n - min) / etendue) * 34 : 8;
        return (
          <div
            key={`${periode}-${i}`}
            className="flex min-w-[54px] max-w-[92px] flex-col items-center gap-1"
          >
            <span className="break-all font-mono text-[11px] text-zinc-200">
              {String(v)}
            </span>
            <div
              className="w-full rounded-sm bg-violet-400/45"
              style={{ height: `${hauteur}px` }}
            />
            <span className="text-[10px] text-zinc-500">{String(periode)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CartePropositon({
  p,
  coche,
  onToggle,
}: {
  p: PropositionNonFinanciere;
  coche: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <label className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2">
          <input
            type="checkbox"
            checked={coche}
            onChange={onToggle}
            className="mt-1 size-4 shrink-0 accent-violet-500"
          />
          <span className="font-display break-words text-[16px] font-bold text-zinc-50">
            {p.nom}
          </span>
        </label>
        <span className="ml-auto shrink-0">
          <Etoiles n={p.fiabilite} />
        </span>
      </div>

      {p.phrase && (
        <p className="mt-1.5 break-words text-[13.5px] leading-relaxed text-zinc-300">
          {p.phrase}
        </p>
      )}

      {(p.unite || p.frequence) && (
        <p className="mt-1.5 break-words font-mono text-[11.5px] text-zinc-500">
          {[p.unite, p.frequence].filter(Boolean).join(" · ")}
        </p>
      )}

      <Serie valeurs={p.valeurs} />

      {p.citation_verbatim && (
        <p className="mt-3 flex gap-2 break-words text-[12px] italic text-zinc-400">
          <Quote className="mt-0.5 size-3 shrink-0 text-zinc-600" />
          {p.citation_verbatim}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 break-all text-[11.5px] text-zinc-500">
        {p.source_url ? (
          <a
            href={p.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-zinc-400 underline decoration-white/20 underline-offset-2 hover:text-zinc-200"
          >
            {p.source_nom ?? p.source_url}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          p.source_nom && <span>{p.source_nom}</span>
        )}
        {p.source_date && <span>· publiée le {p.source_date}</span>}
      </div>
    </li>
  );
}

export function KpiNonFinanciersClient({
  demandes: demandesInitiales,
  erreurBase,
}: {
  demandes: LigneKpiNonFinancier[];
  erreurBase: string | null;
}) {
  const [demandes, setDemandes] =
    useState<LigneKpiNonFinancier[]>(demandesInitiales);
  const [tickers, setTickers] = useState("");
  const [criteres, setCriteres] = useState<CriteresKpiNonFinancier>({
    ...CRITERES_PAR_DEFAUT,
  });
  const [selection, setSelection] = useState<string | null>(
    demandesInitiales[0]?.id ?? null,
  );
  const [cochees, setCochees] = useState<Record<string, boolean>>({});
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(erreurBase);

  const demandeActive = useMemo(
    () => demandes.find((d) => d.id === selection) ?? null,
    [demandes, selection],
  );

  function choisirDemande(d: LigneKpiNonFinancier) {
    setSelection(d.id);
    const etat: Record<string, boolean> = {};
    for (const p of d.propositions) etat[p.cle] = !!p.retenu;
    setCochees(etat);
    setMessage(null);
  }

  async function demanderRecherche() {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "demander",
          tickers,
          criteres,
          commentaire: criteres.consigne_libre,
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        demandes?: LigneKpiNonFinancier[];
        message?: string;
        error?: string;
      };
      if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDemandes((prev) => [...(j.demandes ?? []), ...prev]);
      setTickers("");
      // Yann 21 sept 2026 : le message doit suffire a lancer la recherche quand
      // il est copie dans la conversation Claude. Il porte donc les tickers.
      const listeTickers = (j.demandes ?? [])
        .map((d) => d.ticker)
        .filter(Boolean)
        .join(", ");
      setMessage(
        listeTickers
          ? `Demande enregistrée. Pour la lancer, copiez cette ligne dans Claude : « lance les indicateurs non financiers pour ${listeTickers} »`
          : (j.message ?? "Demande enregistrée au statut à traiter."),
      );
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrerCochees() {
    if (!demandeActive) return;
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const cles = Object.entries(cochees)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enregistrer",
          id: demandeActive.id,
          cles,
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        demande?: LigneKpiNonFinancier;
        message?: string;
        error?: string;
      };
      if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (j.demande) {
        const maj = j.demande;
        setDemandes((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
      }
      setMessage(j.message ?? "Indicateurs enregistrés.");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  const nbCochees = Object.values(cochees).filter(Boolean).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link
          href="/sandbox"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          desk_kpi_non_financiers
        </span>
      </nav>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">
          Indicateurs non financiers à envisager
        </h1>

        <section className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-violet-200">
            Définition
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-200">
            Non financier veut dire introuvable sur un comparateur boursier de
            sélection de titres.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-300">
            Acceptés : le prix moyen d’un abonnement, le prix du service le plus
            cher, le tarif d’une option.
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-300">
            Refusés : le bénéfice par action, le rendement des capitaux, la
            croissance du résultat.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <label
            htmlFor="tickers"
            className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Sociétés
          </label>
          <input
            id="tickers"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="NFLX, MC.PA, NESN.SW"
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
          />
          <p className="mt-1 text-[11.5px] text-zinc-500">
            Un ou plusieurs tickers, séparés par une virgule ou un espace.
          </p>

          <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
            Critères
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CLES_CRITERES.map((cle) => (
              <label
                key={cle}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={criteres[cle]}
                  onChange={(e) =>
                    setCriteres((c) => ({ ...c, [cle]: e.target.checked }))
                  }
                  className="mt-0.5 size-4 shrink-0 accent-violet-500"
                />
                <span className="min-w-0 break-words text-[12.5px] leading-snug text-zinc-300">
                  {LIBELLES_CRITERES[cle]}
                </span>
              </label>
            ))}
          </div>

          <label
            htmlFor="consigne"
            className="mt-4 block text-[12px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Consigne libre
          </label>
          <textarea
            id="consigne"
            rows={3}
            value={criteres.consigne_libre}
            onChange={(e) =>
              setCriteres((c) => ({ ...c, consigne_libre: e.target.value }))
            }
            placeholder="Précision à donner au chercheur, facultative."
            className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={occupe || tickers.trim().length === 0}
              onClick={demanderRecherche}
              className="rounded-lg border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-[13.5px] font-semibold text-violet-100 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Demander une recherche
            </button>
            <span className="text-[11.5px] text-zinc-500">
              Aucune recherche ne part pour l’instant : la ligne est créée au
              statut à traiter.
            </span>
          </div>
        </section>

        {message && (
          <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            {message}
          </p>
        )}
        {erreur && (
          <p className="mt-4 break-words rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
            {erreur}
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-display text-[18px] font-bold">Demandes</h2>
          {demandes.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-zinc-400">
              Aucune demande pour le moment.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {demandes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => choisirDemande(d)}
                  className={`rounded-full border px-3 py-1 text-[12.5px] ${
                    d.id === selection
                      ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  {d.ticker} · {LIBELLES_STATUTS[d.statut] ?? d.statut} (
                  {d.propositions.length})
                </button>
              ))}
            </div>
          )}
        </section>

        {demandeActive && (
          <section className="mt-6">
            <h2 className="font-display text-[18px] font-bold">
              Propositions pour {demandeActive.ticker}
            </h2>
            {demandeActive.propositions.length === 0 ? (
              <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
                Aucune proposition en base pour cette demande. La recherche
                démarrera au feu vert de Yann, et les indicateurs trouvés
                s’afficheront ici en cartes, chacune avec sa case à cocher.
              </p>
            ) : (
              <>
                <ul className="mt-4 space-y-4">
                  {demandeActive.propositions.map((p) => (
                    <CartePropositon
                      key={p.cle}
                      p={p}
                      coche={!!cochees[p.cle]}
                      onToggle={() =>
                        setCochees((c) => ({ ...c, [p.cle]: !c[p.cle] }))
                      }
                    />
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={enregistrerCochees}
                    className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-4 py-2 text-[13.5px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Enregistrer les indicateurs cochés
                  </button>
                  <span className="text-[11.5px] text-zinc-500">
                    {nbCochees} coché(s) sur {demandeActive.propositions.length}
                  </span>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
