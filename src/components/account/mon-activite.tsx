/**
 * Bloc « Mon activité » de la page « Mon compte et analytics » (Yann 13 oct 2026).
 * Composant SERVEUR : les données arrivent déjà agrégées par
 * chargeAnalyticsCompte (src/lib/analytics-compte.ts), pour le seul compte
 * connecté. Aucun chiffre estimé : un bloc sans donnée réelle affiche un état
 * vide qui dit pourquoi.
 */
import Link from "next/link";
import { Activity, BarChart3, CalendarClock, GitCompareArrows, Lock } from "lucide-react";
import type { AnalyticsCompte } from "@/lib/analytics-compte";
import { MESSAGE_OFFRE_PREMIUM } from "@/lib/freemium/visibles-gratuit-defaut";
import { effacerMonHistorique, reglerMesureActivite } from "@/app/account/analytics-actions";
import { BoutonEffacer, ListeVoirPlus, LogoSociete, Repliable } from "./mon-activite-client";

const TZ = "Europe/Paris";
const dateLongue = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "short" });
const jourCalendrier = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long" });
const jourCalendrierLong = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const pct = (x: number) => `${Math.round(x * 100)} %`;
const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? plusieurs : un}`;

const MESSAGES_RAISON: Record<Exclude<AnalyticsCompte["raison"], null>, string> = {
  exclu_compte: "Ce compte est un compte interne de Mettrik : ses visites sont volontairement exclues de la mesure, pour ne pas fausser les statistiques du service. Aucune visite n’est donc enregistrée, et cette section reste vide.",
  exclu_reseau: "Les visites faites depuis ce réseau sont exclues de la mesure (réseau interne de Mettrik) : elles ne comptent pas dans les statistiques.",
  mesure_coupee: "La mesure est désactivée pour le moment sur Mettrik : aucune nouvelle visite n’est enregistrée.",
  opposition: "Tu as choisi de ne plus mesurer ton activité : aucune nouvelle visite n’est enregistrée.",
};

const Logo = LogoSociete;

function Chiffre({ valeur, libelle, detail }: { valeur: string; libelle: string; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] px-4 py-3 sm:block">
      <div className="min-w-0 text-[12px] text-zinc-400 sm:order-2 sm:mt-1">{libelle}</div>
      <div className="shrink-0 text-right sm:text-left">
        <div className="font-mono text-[20px] font-semibold leading-none text-zinc-50 sm:text-[26px]">{valeur}</div>
        {detail}
      </div>
    </div>
  );
}

function Carte({ titre, sousTitre, icone, children }: { titre: string; sousTitre?: string; icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] p-4">
      <div className="mb-3 flex items-start gap-2.5">
        {icone}
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold text-zinc-100">{titre}</h3>
          {sousTitre && <p className="mt-0.5 text-[11.5px] text-zinc-500">{sousTitre}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const Vide = ({ children }: { children: React.ReactNode }) => <p className="text-[12.5px] leading-relaxed text-zinc-400">{children}</p>;

export function MonActivite({ a, abonne }: { a: AnalyticsCompte; abonne: boolean }) {
  const depuis = a.depuis ? dateLongue(a.depuis) : null;
  const assez = a.visites >= 3;
  const maxTop = a.top[0]?.visites ?? 1;

  return (
    <section id="mon-activite" className="mt-8 scroll-mt-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 sm:p-6">
      <header className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
          <Activity className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-semibold text-zinc-50">Mon activité</h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-400">
            {depuis ? `Calculé uniquement à partir de tes visites depuis le ${depuis}.` : "Calculé uniquement à partir de tes visites sur Mettrik."}
          </p>
          {a.mesureDepuis && (
            <p className="mt-0.5 text-[11.5px] text-zinc-500">Mesure disponible depuis le {jourCalendrierLong(a.mesureDepuis)} : aucune visite antérieure n’a pu être enregistrée.</p>
          )}
        </div>
      </header>

      {a.raison && (
        <p className="mb-4 rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-100/90">
          {MESSAGES_RAISON[a.raison]}
        </p>
      )}

      {/* 1. Chiffres, sociétés, secteurs, découvertes : visites réellement mesurées */}
      {a.visites === 0 ? (
        a.raison === "exclu_compte" ? null : (
          <div className="rounded-xl border border-dashed border-[#2a2a2a] px-4 py-5 text-center">
            <p className="text-[13.5px] font-medium text-zinc-200">Pas encore assez de visites</p>
            <p className="mt-1 text-[12.5px] text-zinc-400">Visite quelques fiches société pour voir tes statistiques apparaître ici.</p>
          </div>
        )
      ) : !assez ? (
        <div className="rounded-xl border border-dashed border-[#2a2a2a] px-4 py-5 text-center">
          <p className="text-[13.5px] font-medium text-zinc-200">
            {pluriel(a.visites, "visite de fiche société", "visites de fiches société")}{depuis ? ` depuis le ${depuis}` : ""}
          </p>
          <p className="mt-1 text-[12.5px] text-zinc-400">Les statistiques détaillées s’affichent à partir de 3 visites.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <Chiffre valeur={a.societesCeMois.toLocaleString("fr-FR")} libelle="Sociétés vues ce mois" />
            <Chiffre valeur={a.nouvellesCeMois.length.toLocaleString("fr-FR")} libelle="Nouvelles sociétés explorées ce mois" />
            <Chiffre
              valeur={`${a.semaines.actives}/${a.semaines.fenetre}`}
              libelle={a.semaines.fenetre > 1 ? `Semaines actives sur les ${a.semaines.fenetre} dernières` : "Semaine active"}
              detail={
                <div className="mt-1.5 flex justify-end gap-[3px] sm:justify-start" aria-hidden>
                  {a.semaines.grille.map((on, i) => (
                    <span key={i} className={`h-2.5 w-2 rounded-[2px] ${on ? "bg-cyan-400/80" : "bg-white/[0.08]"}`} />
                  ))}
                </div>
              }
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Carte titre="Sociétés les plus consultées" sousTitre={`${pluriel(a.visites, "visite", "visites")} de ${pluriel(a.societesDistinctes, "société", "sociétés")}`}>
              <ListeVoirPlus className="space-y-2.5">
                {a.top.map((s) => (
                  <li key={s.ticker}>
                    <Link href={`/${s.ticker.toLowerCase()}`} className="group flex min-h-11 items-center gap-3 rounded-lg">
                      <Logo ticker={s.ticker} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-zinc-100 group-hover:text-violet-200">{s.nom}</span>
                          <span className="shrink-0 font-mono text-[12px] text-zinc-300">{s.visites}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-violet-400/80" style={{ width: `${Math.max(4, (s.visites / maxTop) * 100)}%` }} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">Dernière visite le {dateCourte(s.derniere)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ListeVoirPlus>
            </Carte>

            <Carte titre="Secteurs regardés" sousTitre="Part de tes visites par secteur ; le trait blanc marque la part du secteur dans l’ensemble des sociétés suivies par Mettrik">
              <ListeVoirPlus className="space-y-3">
                {a.secteurs.map((s) => (
                  <li key={s.secteur}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate text-zinc-200">{s.secteur}</span>
                      <span className="shrink-0 font-mono text-zinc-300">{pct(s.part)}</span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-cyan-400/75" style={{ width: `${Math.max(2, s.part * 100)}%` }} />
                      <span className="absolute -top-0.5 h-3 w-[2px] rounded bg-zinc-100" style={{ left: `calc(${s.partUnivers * 100}% - 1px)` }} title={`Part dans Mettrik : ${pct(s.partUnivers)}`} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">Dans Mettrik : {pct(s.partUnivers)}</div>
                  </li>
                ))}
              </ListeVoirPlus>
            </Carte>
          </div>

          {(a.nouvellesCeMois.length > 0 || a.nouveauxSecteursCeMois.length > 0) && (
            <div className="mt-3 rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] p-4">
              <h3 className="text-[13.5px] font-semibold text-zinc-100">Découvertes du mois</h3>
              <p className="mt-0.5 text-[11.5px] text-zinc-500">Sociétés et secteurs que tu as ouverts pour la première fois ce mois-ci.</p>
              {a.nouvellesCeMois.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {a.nouvellesCeMois.slice(0, 12).map((s) => (
                    <li key={s.ticker}>
                      <Link href={`/${s.ticker.toLowerCase()}`} className="inline-flex min-h-8 max-w-full items-center rounded-full border border-violet-400/25 bg-violet-500/[0.08] px-2.5 text-[12px] text-violet-100 hover:border-violet-400/50">
                        <span className="truncate">{s.nom}</span>
                      </Link>
                    </li>
                  ))}
                  {a.nouvellesCeMois.length > 12 && <li className="inline-flex min-h-8 items-center px-1 text-[12px] text-zinc-500">et {a.nouvellesCeMois.length - 12} autres</li>}
                </ul>
              )}
              {a.nouveauxSecteursCeMois.length > 0 && (
                <p className="mt-2.5 text-[12px] text-zinc-400">
                  {a.nouveauxSecteursCeMois.length > 1 ? "Nouveaux secteurs : " : "Nouveau secteur : "}
                  <span className="text-zinc-200">{a.nouveauxSecteursCeMois.join(", ")}</span>
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* 2. KPI et prochaines publications : favoris, indépendants de la mesure */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Repliable titre="Mes KPI" sousTitre={a.kpiFavorisDisponibles ? "Tes KPI favoris, puis ceux que tu ouvres le plus" : "Les KPI que tu ouvres le plus sur les fiches"} icone={<BarChart3 className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />}>
          {a.kpiFavoris.length === 0 && a.kpiOuverts.length === 0 ? (
            <Vide>
              {a.kpiFavorisDisponibles
                ? "Aucun KPI en favori ni ouvert pour l’instant. Les indicateurs que tu mets en favori ou que tu ouvres sur une fiche apparaîtront ici."
                : "Aucun KPI ouvert pour l’instant. Les indicateurs que tu ouvres sur une fiche (clic sur une ligne du tableau) apparaîtront ici."}
            </Vide>
          ) : (
            <>
              {a.kpiFavoris.length > 0 && (
                <ListeVoirPlus className="space-y-1.5">
                  {a.kpiFavoris.map((k) => (
                    <li key={`f-${k.ticker}-${k.short}`}>
                      <Link href={`/${k.ticker.toLowerCase()}`} className="flex min-h-11 items-center gap-2.5 rounded-lg hover:bg-white/[0.03]">
                        <Logo ticker={k.ticker} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-zinc-100">{k.nom}</span>
                          <span className="block font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{k.ticker} · favori</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ListeVoirPlus>
              )}
              {a.kpiOuverts.length > 0 && (
                <>
                  <h4 className="mb-1 mt-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Les plus ouverts</h4>
                  <ListeVoirPlus className="space-y-1.5">
                    {a.kpiOuverts.map((k) => (
                      <li key={`o-${k.ticker}-${k.short}`}>
                        <Link href={`/${k.ticker.toLowerCase()}`} className="flex min-h-11 items-center gap-2.5 rounded-lg hover:bg-white/[0.03]">
                          <Logo ticker={k.ticker} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-zinc-100">{k.nom}</span>
                            <span className="block font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{k.ticker}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[12px] text-zinc-300">{pluriel(k.fois, "fois", "fois")}</span>
                        </Link>
                      </li>
                    ))}
                  </ListeVoirPlus>
                </>
              )}
            </>
          )}
        </Repliable>

        <Repliable titre="Prochaines publications de mes favoris" sousTitre="Dates de résultats des sociétés que tu as enregistrées ou mises en favori" icone={<CalendarClock className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden />}>
          {a.favorisSocietes === 0 ? (
            <Vide>Aucune société enregistrée. Enregistre une société depuis sa fiche pour suivre ici sa prochaine publication de résultats.</Vide>
          ) : a.publications.length === 0 ? (
            <Vide>Aucune date de publication à venir connue pour le moment pour tes sociétés enregistrées.</Vide>
          ) : (
            <ListeVoirPlus className="space-y-1.5">
              {a.publications.map((p) => (
                <li key={p.ticker}>
                  <Link href={`/${p.ticker.toLowerCase()}`} className="flex min-h-11 items-center gap-2.5 rounded-lg hover:bg-white/[0.03]">
                    <Logo ticker={p.ticker} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-100">{p.nom}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[12.5px] text-zinc-200">{jourCalendrier(p.date)}</span>
                      {p.estimee && <span className="block text-[10.5px] text-zinc-500">date estimée</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ListeVoirPlus>
          )}
        </Repliable>
      </div>

      {/* 3. Comparaisons (abonnés) */}
      <div className="mt-3">
        <Repliable titre="Comparaisons" sousTitre="Les comparaisons de KPI que tu as lancées" icone={<GitCompareArrows className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />}>
          {!abonne ? (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-[12.5px] text-zinc-400"><Lock className="size-3.5 shrink-0" aria-hidden />{MESSAGE_OFFRE_PREMIUM}</p>
              <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-lg border border-[#2a2a2a] px-3.5 text-[13px] text-zinc-200 hover:border-violet-400/50 hover:text-violet-200">Voir les offres</Link>
            </div>
          ) : a.comparaisons.total === 0 ? (
            <Vide>Aucune comparaison enregistrée pour l’instant. Le bouton « Comparer » d’une fiche met deux sociétés côte à côte sur un même KPI.</Vide>
          ) : (
            <>
              <p className="mb-2 text-[12.5px] text-zinc-300">{pluriel(a.comparaisons.total, "comparaison", "comparaisons")}{depuis ? ` depuis le ${depuis}` : ""}</p>
              <ul className="space-y-1.5">
                {a.comparaisons.dernieres.map((c, i) => (
                  <li key={`${c.ts}-${i}`} className="flex min-h-9 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12.5px]">
                    <span className="min-w-0 text-zinc-100">
                      {c.a} et {c.b}
                      {c.kpi && <span className="text-zinc-500"> · {c.kpi}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-500">{dateCourte(c.ts)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Repliable>
      </div>

      {/* MON ANNEE METTRIK : emplacement reserve pour le bilan de decembre
          (rapport §3 point 9). Rien n est affiche tant que le bilan n existe
          pas : aucune donnee fictive. */}
      <div data-emplacement="mon-annee-mettrik" />

      {/* 4. Vie privée */}
      <div className="mt-4 rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <BoutonEffacer action={effacerMonHistorique} />
          <form action={reglerMesureActivite}>
            <input type="hidden" name="refuse" value={a.raison === "opposition" ? "0" : "1"} />
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-[#2a2a2a] px-3.5 text-[13px] text-zinc-200 transition-colors hover:border-violet-400/50 hover:text-violet-200">
              {a.raison === "opposition" ? "Réactiver la mesure de mon activité" : "Ne plus mesurer mon activité"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
