"use client";

/**
 * Composant client de /sandbox/kpi-pistes (Yann 21 sept 2026).
 *
 * Cinq sous-onglets, un par methode de recherche. Les boutons de lancement
 * sont presents mais desactives : aucune recherche ne doit partir avant le
 * feu vert. L infobulle du titre compare les cinq methodes sur deux axes,
 * le cout en jetons et les chances de trouver beaucoup d indicateurs.
 */

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Info, Play, Search } from "lucide-react";
import { GICS } from "@/lib/desk/gics";
import type { SocieteClassee } from "@/lib/cahier";
import {
  FICHES_METHODES,
  estTraitee,
  ficheMethode,
  type FichierRegulateurs,
  type MethodePiste,
  type PisteRow,
  type PistesParMethode,
} from "@/lib/desk/kpi-pistes";

export type LigneNonCouverte = {
  code: string;
  industrie: string;
  secteur: string;
  kpi: string;
  concernees: number;
  manquantes: string[];
};

type Societe = { ticker: string; nom: string };

type Props = {
  univers: Societe[];
  pistes: PistesParMethode;
  regulateurs: FichierRegulateurs;
  parSousIndustrie: Record<string, SocieteClassee[]>;
  nonCouvert: LigneNonCouverte[];
  majReferentiel: string;
  jeton: string | null;
};

/* ───────── Briques communes ───────── */

const CARTE = "rounded-xl border border-white/10 bg-white/[0.02]";

function Titre({ children, compte }: { children: ReactNode; compte?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-4 py-3">
      <h3 className="text-[14px] font-semibold text-zinc-100">{children}</h3>
      {compte && <span className="font-mono text-[11px] text-zinc-500">{compte}</span>}
    </div>
  );
}

/** Bouton de lancement, desactive tant que le feu vert n est pas donne. */
function BoutonLancement({ libelle }: { libelle: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        disabled
        title="en attente du feu vert"
        aria-disabled="true"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-500 opacity-70"
      >
        <Play className="size-3.5" />
        {libelle}
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-[#0b0b0b] px-2.5 py-1.5 text-[11.5px] text-zinc-200 shadow-xl group-hover:block">
        en attente du feu vert
      </span>
    </span>
  );
}

function Pastille({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
        ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"
      }`}
    >
      <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {texte}
    </span>
  );
}

function EtatTraitement({ traitee }: { traitee: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
        traitee ? "border-sky-400/30 bg-sky-400/10 text-sky-200" : "border-white/10 bg-white/[0.03] text-zinc-500"
      }`}
    >
      {traitee ? "traitée" : "à traiter"}
    </span>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-[12.5px] text-zinc-500">{children}</p>;
}

function ListeKpis({ ligne }: { ligne: PisteRow }) {
  const kpis = ligne.propositions?.kpis ?? [];
  if (kpis.length === 0) return <span className="text-[12px] text-zinc-600">aucun indicateur retenu</span>;
  return (
    <ul className="space-y-1">
      {kpis.map((k, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-zinc-200">{k.nom ?? k.short ?? "indicateur sans nom"}</span>
          {k.short && k.nom && <span className="font-mono text-[10.5px] text-zinc-600">{k.short}</span>}
          {k.source && <span className="text-[11.5px] text-zinc-500">{k.source}</span>}
          {k.url && (
            <a href={k.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-200">
              <ExternalLink className="size-3" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ───────── Infobulle de comparaison des methodes ───────── */

function Barres({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2.5 w-1.5 rounded-[1px] ${i <= n ? "bg-zinc-300" : "bg-white/10"}`} />
      ))}
    </span>
  );
}

function InfobulleMethodes() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label="Comparer les cinq méthodes"
        className="inline-flex size-5 items-center justify-center rounded-full border border-white/15 text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
      >
        <Info className="size-3" />
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(92vw,760px)] rounded-xl border border-white/15 bg-[#0b0b0b] p-4 shadow-2xl">
          <p className="text-[12.5px] text-zinc-300">
            Les cinq méthodes comparées sur deux axes : le coût en jetons pour traiter tout l’univers, et les chances de trouver beaucoup d’indicateurs.
          </p>
          <table className="mt-3 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3 font-normal">Méthode</th>
                <th className="py-2 pr-3 font-normal">Coût en jetons</th>
                <th className="py-2 font-normal">Chances de trouver</th>
              </tr>
            </thead>
            <tbody>
              {FICHES_METHODES.map((f) => (
                <tr key={f.id} className="border-b border-white/[0.06] align-top last:border-0">
                  <td className="py-2 pr-3">
                    <div className="text-[12.5px] font-medium text-zinc-100">{f.label}</div>
                    <div className="mt-0.5 text-[11.5px] text-zinc-500">{f.resume}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Barres n={f.cout} />
                    <div className="mt-1 max-w-[220px] text-[11.5px] text-zinc-400">{f.coutTexte}</div>
                  </td>
                  <td className="py-2">
                    <Barres n={f.rendement} />
                    <div className="mt-1 max-w-[220px] text-[11.5px] text-zinc-400">{f.rendementTexte}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] text-zinc-500">
            Lecture : plus les barres sont remplies, plus le coût est élevé à gauche, plus les chances sont fortes à droite. Texte en dur, à relire.
          </p>
        </div>
      )}
    </span>
  );
}

/* ───────── Onglet 1 : questions des analystes ───────── */

function OngletAnalystes({ univers, lignes }: { univers: Societe[]; lignes: PisteRow[] }) {
  const [filtre, setFiltre] = useState("");
  const parTicker = useMemo(() => new Map(lignes.map((l) => [l.ticker, l] as const)), [lignes]);
  const nom = useMemo(() => new Map(univers.map((s) => [s.ticker, s.nom] as const)), [univers]);
  const q = filtre.trim().toLowerCase();
  const garde = (s: Societe) => !q || s.ticker.toLowerCase().includes(q) || s.nom.toLowerCase().includes(q);

  const aTraiter = univers.filter((s) => {
    const l = parTicker.get(s.ticker);
    return (!l || !estTraitee(l)) && garde(s);
  });
  const traitees = univers
    .map((s) => ({ s, l: parTicker.get(s.ticker) }))
    .filter((x): x is { s: Societe; l: PisteRow } => !!x.l && estTraitee(x.l) && garde(x.s));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer par société"
            className="w-64 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 pl-8 pr-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25"
          />
        </div>
        <BoutonLancement libelle="Lancer la lecture des appels de résultats" />
        <span className="text-[11.5px] text-zinc-500">
          Une société sans ligne en base est à traiter.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className={CARTE}>
          <Titre compte={`${aTraiter.length} / ${univers.length}`}>Sociétés à traiter</Titre>
          {aTraiter.length === 0 ? (
            <Vide>Toutes les sociétés de l’univers ont été traitées.</Vide>
          ) : (
            <ul className="max-h-[560px] divide-y divide-white/[0.06] overflow-y-auto">
              {aTraiter.map((s) => (
                <li key={s.ticker} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="truncate text-[12.5px] text-zinc-300">{s.nom}</span>
                  <span className="font-mono text-[11px] text-zinc-600">{s.ticker}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={CARTE}>
          <Titre compte={`${traitees.length} traitée${traitees.length > 1 ? "s" : ""}`}>Sociétés traitées</Titre>
          {traitees.length === 0 ? (
            <Vide>Aucune société traitée pour l’instant.</Vide>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-2 font-normal">Société</th>
                    <th className="px-4 py-2 font-normal">Indicateurs proposés</th>
                    <th className="px-4 py-2 font-normal">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {traitees.map(({ s, l }) => (
                    <tr key={s.ticker} className="border-b border-white/[0.06] align-top last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-[12.5px] text-zinc-200">{nom.get(s.ticker) ?? s.nom}</div>
                        <div className="font-mono text-[10.5px] text-zinc-600">{s.ticker}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <ListeKpis ligne={l} />
                      </td>
                      <td className="px-4 py-2.5">
                        {l.commentaire ? (
                          <span
                            className={
                              l.hors_ordinaire
                                ? "inline-block rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[12px] font-medium text-amber-100"
                                : "text-[12px] text-zinc-400"
                            }
                          >
                            {l.commentaire}
                          </span>
                        ) : (
                          <span className="text-[12px] text-zinc-700">rien à signaler</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-white/10 px-4 py-2 text-[11.5px] text-zinc-500">
            La colonne commentaire reste vide la plupart du temps : elle est réservée à ce qui sort de l’ordinaire, mis en valeur en ambre.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ───────── Onglet 2 : regulateurs et federations ───────── */

function OngletRegulateurs({ fichier }: { fichier: FichierRegulateurs }) {
  const parSecteur = useMemo(() => {
    const m = new Map<string, typeof fichier.regulateurs>();
    for (const r of fichier.regulateurs) {
      const liste = m.get(r.secteur) ?? [];
      liste.push(r);
      m.set(r.secteur, liste);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [fichier]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BoutonLancement libelle="Lancer le recensement des organismes" />
        <span className="text-[11.5px] text-zinc-500">
          Stockage : src/data/kpi-regulateurs.json · mise à jour {fichier.maj || "non renseignée"}
        </span>
      </div>
      <p className="mb-4 text-[12.5px] text-zinc-400">{fichier.note}</p>

      <section className={CARTE}>
        <Titre compte={`${fichier.regulateurs.length} organisme${fichier.regulateurs.length > 1 ? "s" : ""}`}>
          Organismes répertoriés par secteur d’activité
        </Titre>
        {fichier.regulateurs.length === 0 ? (
          <Vide>Aucun organisme répertorié pour l’instant.</Vide>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2 font-normal">Nom</th>
                  <th className="px-4 py-2 font-normal">Secteur</th>
                  <th className="px-4 py-2 font-normal">Lien</th>
                  <th className="px-4 py-2 font-normal">Indicateurs disponibles</th>
                </tr>
              </thead>
              <tbody>
                {parSecteur.map(([secteur, liste]) => (
                  <Fragment key={secteur}>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <td colSpan={4} className="px-4 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
                        {secteur}
                      </td>
                    </tr>
                    {liste.map((r) => (
                      <tr key={`${secteur}-${r.nom}`} className="border-b border-white/[0.06] align-top last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="text-[12.5px] text-zinc-200">{r.nom}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            {r.sigle && <span className="font-mono text-zinc-400">{r.sigle}</span>}
                            {r.zone && <span>{r.zone}</span>}
                            {r.frequence && <span>{r.frequence}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-zinc-400">
                          {r.secteur}
                          {r.secteur_code && <span className="ml-1.5 font-mono text-[10.5px] text-zinc-600">{r.secteur_code}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <a
                            href={r.lien}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-[260px] items-center gap-1.5 truncate text-[12px] text-sky-300 hover:text-sky-200"
                          >
                            <span className="truncate">{r.lien.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5">
                          <Pastille ok={r.indicateurs_disponibles} texte={r.indicateurs_disponibles ? "oui" : "non"} />
                          {r.nature_donnees && <div className="mt-1 max-w-[320px] text-[11.5px] text-zinc-500">{r.nature_donnees}</div>}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── Onglet 3 : concurrents ───────── */

function Repliable({
  titre,
  compte,
  enfants,
  niveau,
}: {
  titre: ReactNode;
  compte?: string;
  enfants: ReactNode;
  niveau: 0 | 1 | 2;
}) {
  const [ouvert, setOuvert] = useState(false);
  const marges = ["pl-3", "pl-6", "pl-9"][niveau];
  const tailles = ["text-[13px] font-medium", "text-[12.5px]", "text-[12.5px]"][niveau];
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className={`flex w-full items-center gap-2 py-2 pr-3 text-left transition-colors hover:bg-white/[0.03] ${marges}`}
      >
        {ouvert ? <ChevronDown className="size-3.5 shrink-0 text-zinc-500" /> : <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />}
        <span className={`${tailles} text-zinc-200`}>{titre}</span>
        {compte && <span className="ml-auto font-mono text-[10.5px] text-zinc-600">{compte}</span>}
      </button>
      {ouvert && <div className="pb-1">{enfants}</div>}
    </div>
  );
}

function FicheConcurrents({ societe, ligne }: { societe: SocieteClassee; ligne?: PisteRow }) {
  const traitee = !!ligne && estTraitee(ligne);
  const concurrents = ligne?.propositions?.concurrents ?? [];
  const kpis = ligne?.propositions?.kpis ?? [];
  return (
    <div className="border-t border-white/[0.06] py-2 pl-12 pr-3 first:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-zinc-200">{societe.name}</span>
        <span className="font-mono text-[10.5px] text-zinc-600">{societe.ticker}</span>
        <EtatTraitement traitee={traitee} />
      </div>
      <div className="mt-1.5 grid gap-2 md:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Concurrents</div>
          {concurrents.length === 0 ? (
            <p className="mt-0.5 text-[11.5px] text-zinc-600">
              {traitee ? "aucun concurrent assez proche relevé" : "en attente de traitement"}
            </p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {concurrents.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-300">
                  {c.nom}
                  {c.ticker && <span className="font-mono text-[10.5px] text-zinc-600">{c.ticker}</span>}
                  <Pastille ok={c.proche} texte={c.proche ? "activités proches" : "activités trop différentes"} />
                  {c.raison && <span className="text-[11.5px] text-zinc-500">{c.raison}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Indicateurs manquants relevés chez eux</div>
          {kpis.length === 0 ? (
            <p className="mt-0.5 text-[11.5px] text-zinc-600">{traitee ? "aucun indicateur retenu" : "en attente de traitement"}</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {kpis.map((k, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-300">
                  {k.nom ?? k.short ?? "indicateur sans nom"}
                  {k.releve_chez && <span className="text-[11.5px] text-zinc-500">chez {k.releve_chez}</span>}
                  <Pastille
                    ok={k.convient !== false}
                    texte={k.convient !== false ? "convient aussi" : "activités trop différentes"}
                  />
                  {k.raison && <span className="text-[11.5px] text-zinc-500">{k.raison}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {ligne?.commentaire && (
        <p
          className={
            ligne.hors_ordinaire
              ? "mt-1.5 inline-block rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11.5px] font-medium text-amber-100"
              : "mt-1.5 text-[11.5px] text-zinc-500"
          }
        >
          {ligne.commentaire}
        </p>
      )}
    </div>
  );
}

function OngletConcurrents({
  parSousIndustrie,
  lignes,
}: {
  parSousIndustrie: Record<string, SocieteClassee[]>;
  lignes: PisteRow[];
}) {
  const parTicker = useMemo(() => new Map(lignes.map((l) => [l.ticker, l] as const)), [lignes]);
  const groupes = useMemo(() => GICS.flatMap((s) => s.groups.map((g) => ({ ...g, secteur: s.name }))), []);
  const compte = (codes: string[]) => codes.reduce((t, c) => t + (parSousIndustrie[c]?.length ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BoutonLancement libelle="Lancer la comparaison aux concurrents" />
        <span className="text-[11.5px] text-zinc-500">
          Arbre GICS : groupe d’industries, industrie, sous-industrie, sociétés. L’état de traitement est toujours indiqué, même sans concurrent assez proche.
        </span>
      </div>
      <section className={CARTE}>
        <Titre compte={`${groupes.length} groupes d’industries`}>Sociétés par sous-industrie</Titre>
        <div>
          {groupes.map((g) => {
            const codesG = g.industries.flatMap((i) => i.subs.map((s) => s.code));
            return (
              <Repliable
                key={g.code}
                niveau={0}
                titre={
                  <>
                    {g.name} <span className="ml-1.5 font-mono text-[10.5px] text-zinc-600">{g.code}</span>
                  </>
                }
                compte={`${compte(codesG)} sociétés`}
                enfants={g.industries.map((ind) => {
                  const codesI = ind.subs.map((s) => s.code);
                  return (
                    <Repliable
                      key={ind.code}
                      niveau={1}
                      titre={
                        <>
                          {ind.name} <span className="ml-1.5 font-mono text-[10.5px] text-zinc-600">{ind.code}</span>
                        </>
                      }
                      compte={`${compte(codesI)} sociétés`}
                      enfants={ind.subs.map((sub) => {
                        const liste = parSousIndustrie[sub.code] ?? [];
                        return (
                          <Repliable
                            key={sub.code}
                            niveau={2}
                            titre={
                              <>
                                {sub.name} <span className="ml-1.5 font-mono text-[10.5px] text-zinc-600">{sub.code}</span>
                              </>
                            }
                            compte={`${liste.length} société${liste.length > 1 ? "s" : ""}`}
                            enfants={
                              liste.length === 0 ? (
                                <p className="py-2 pl-12 text-[11.5px] text-zinc-600">aucune société de l’univers dans cette sous-industrie</p>
                              ) : (
                                liste.map((s) => (
                                  <FicheConcurrents key={s.ticker} societe={s} ligne={parTicker.get(s.ticker.toUpperCase())} />
                                ))
                              )
                            }
                          />
                        );
                      })}
                    />
                  );
                })}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ───────── Onglet 4 : referentiel par sous-industrie ───────── */

function OngletReferentiel({
  nonCouvert,
  maj,
  jeton,
}: {
  nonCouvert: LigneNonCouverte[];
  maj: string;
  jeton: string | null;
}) {
  const [filtre, setFiltre] = useState("");
  const q = filtre.trim().toLowerCase();
  const lignes = nonCouvert.filter(
    (l) => !q || l.kpi.toLowerCase().includes(q) || l.industrie.toLowerCase().includes(q) || l.secteur.toLowerCase().includes(q),
  );
  const total = nonCouvert.reduce((t, l) => t + l.manquantes.length, 0);
  const lienGics = jeton ? `/sandbox/gics?audit_token=${encodeURIComponent(jeton)}` : "/sandbox/gics";

  return (
    <div>
      <div className={`${CARTE} mb-4 px-4 py-3`}>
        <p className="text-[12.5px] text-zinc-300">
          Le référentiel par sous-industrie vit dans l’atelier GICS, il n’est pas refait ici.
        </p>
        <Link
          href={lienGics}
          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-sky-300 hover:text-sky-200"
        >
          Ouvrir l’onglet KPI par industrie
          <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer par indicateur, industrie, secteur"
            className="w-80 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 pl-8 pr-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25"
          />
        </div>
        <BoutonLancement libelle="Lancer le comblement du référentiel" />
      </div>

      <section className={CARTE}>
        <Titre compte={`${lignes.length} indicateurs · ${total} cases vides · référentiel du ${maj || "non renseigné"}`}>
          Ce qui reste non couvert
        </Titre>
        {lignes.length === 0 ? (
          <Vide>Rien à combler : chaque indicateur du référentiel a une donnée ou un graphique moyen terme.</Vide>
        ) : (
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-[#0b0b0b]">
                <tr className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2 font-normal">Indicateur du référentiel</th>
                  <th className="px-4 py-2 font-normal">Industrie</th>
                  <th className="px-4 py-2 font-normal">Secteur</th>
                  <th className="px-4 py-2 font-normal">Sociétés sans donnée ni graphique</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={`${l.code}-${i}`} className="border-b border-white/[0.06] align-top last:border-0">
                    <td className="px-4 py-2.5 text-[12.5px] text-zinc-200">{l.kpi}</td>
                    <td className="px-4 py-2.5 text-[12px] text-zinc-400">
                      {l.industrie}
                      <span className="ml-1.5 font-mono text-[10.5px] text-zinc-600">{l.code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-zinc-500">{l.secteur}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-amber-200">
                        {l.manquantes.length} / {l.concernees}
                      </span>
                      <div className="mt-0.5 max-w-[420px] font-mono text-[10.5px] leading-relaxed text-zinc-600">
                        {l.manquantes.join(" ")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── Onglet 5 : journees investisseurs ───────── */

function TableauJournees({ rangees, nom }: { rangees: PisteRow[]; nom: Map<string, string> }) {
  if (rangees.length === 0) return <Vide>Aucune société dans ce tableau pour l’instant.</Vide>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-2 font-normal">Société</th>
            <th className="px-4 py-2 font-normal">Journée investisseurs</th>
            <th className="px-4 py-2 font-normal">Indicateurs proposés</th>
            <th className="px-4 py-2 font-normal">Commentaire</th>
          </tr>
        </thead>
        <tbody>
          {rangees.map((l) => (
            <tr key={l.id} className="border-b border-white/[0.06] align-top last:border-0">
              <td className="px-4 py-2.5">
                <div className="text-[12.5px] text-zinc-200">{nom.get(l.ticker) ?? l.ticker}</div>
                <div className="font-mono text-[10.5px] text-zinc-600">{l.ticker}</div>
              </td>
              <td className="px-4 py-2.5 text-[12px] text-zinc-400">
                {l.propositions?.journee?.titre ?? "documentation non renseignée"}
                {l.propositions?.journee?.date && <div className="text-[11.5px] text-zinc-600">{l.propositions.journee.date}</div>}
                {l.propositions?.journee?.url && (
                  <a
                    href={l.propositions.journee.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-sky-300 hover:text-sky-200"
                  >
                    document
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </td>
              <td className="px-4 py-2.5">
                <ListeKpis ligne={l} />
              </td>
              <td className="px-4 py-2.5">
                {l.commentaire ? (
                  <span
                    className={
                      l.hors_ordinaire
                        ? "inline-block rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[12px] font-medium text-amber-100"
                        : "text-[12px] text-zinc-400"
                    }
                  >
                    {l.commentaire}
                  </span>
                ) : (
                  <span className="text-[12px] text-zinc-700">rien à signaler</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OngletJournees({ univers, lignes }: { univers: Societe[]; lignes: PisteRow[] }) {
  const [autresOuvert, setAutresOuvert] = useState(false);
  const nom = useMemo(() => new Map(univers.map((s) => [s.ticker, s.nom] as const)), [univers]);
  const riches = lignes.filter((l) => l.propositions?.journee?.documentation_riche === true);
  const autres = lignes.filter((l) => l.propositions?.journee?.documentation_riche !== true);
  const sansLigne = univers.filter((s) => !lignes.some((l) => l.ticker === s.ticker));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BoutonLancement libelle="Lancer la recherche des journées investisseurs" />
        <span className="text-[11.5px] text-zinc-500">
          {sansLigne.length} société{sansLigne.length > 1 ? "s" : ""} de l’univers encore sans ligne en base.
        </span>
      </div>

      <section className={`${CARTE} mb-4`}>
        <Titre compte={`${riches.length} société${riches.length > 1 ? "s" : ""}`}>
          Journée investisseurs avec une documentation assez riche
        </Titre>
        <TableauJournees rangees={riches} nom={nom} />
      </section>

      <section className={CARTE}>
        <button
          type="button"
          onClick={() => setAutresOuvert((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        >
          {autresOuvert ? <ChevronDown className="size-3.5 text-zinc-500" /> : <ChevronRight className="size-3.5 text-zinc-600" />}
          <span className="text-[14px] font-semibold text-zinc-100">Toutes les autres sociétés</span>
          <span className="ml-auto font-mono text-[11px] text-zinc-500">
            {autres.length} en base · {sansLigne.length} sans ligne
          </span>
        </button>
        {autresOuvert && (
          <div className="border-t border-white/10">
            <TableauJournees rangees={autres} nom={nom} />
            {sansLigne.length > 0 && (
              <div className="border-t border-white/10 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Sociétés encore sans ligne en base</div>
                <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-zinc-600">
                  {sansLigne.map((s) => s.ticker).join(" ")}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── Page ───────── */

export function KpiPistesClient({ univers, pistes, regulateurs, parSousIndustrie, nonCouvert, majReferentiel, jeton }: Props) {
  const [onglet, setOnglet] = useState<MethodePiste>("analystes");
  const fiche = ficheMethode(onglet);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Trouver les bons KPI à ajouter</h1>
        <InfobulleMethodes />
      </div>
      <p className="mt-1 max-w-3xl text-[14px] text-zinc-400">
        Cinq méthodes de recherche, un sous-onglet par méthode. Aucune recherche n’est lançable pour l’instant : les boutons
        de lancement restent désactivés en attente du feu vert. L’avancement se lit dans la table desk_kpi_pistes.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
        {FICHES_METHODES.map((f) => {
          const actif = f.id === onglet;
          const n = pistes[f.id].length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setOnglet(f.id)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                actif ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {f.label}
              <span className="ml-2 font-mono text-[10.5px] text-zinc-600">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 max-w-3xl text-[12.5px] text-zinc-500">{fiche.resume}</p>

      <div className="mt-4">
        {onglet === "analystes" && <OngletAnalystes univers={univers} lignes={pistes.analystes} />}
        {onglet === "regulateurs" && <OngletRegulateurs fichier={regulateurs} />}
        {onglet === "concurrents" && <OngletConcurrents parSousIndustrie={parSousIndustrie} lignes={pistes.concurrents} />}
        {onglet === "referentiel" && <OngletReferentiel nonCouvert={nonCouvert} maj={majReferentiel} jeton={jeton} />}
        {onglet === "journees" && <OngletJournees univers={univers} lignes={pistes.journees} />}
      </div>
    </div>
  );
}
