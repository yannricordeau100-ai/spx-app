"use client";

/**
 * Boîte de réception du support, côté propriétaire (/sandbox/support).
 *
 * Contrat de /api/desk-mtk9x4kp/support, écrit à part et jamais modifié ici :
 *   GET  ?statut=&categorie=&recherche=&non_vus=1&limite=  -> { tickets, compteurs }
 *   GET  ?id=<uuid>                                        -> { ticket, messages }
 *   POST { action: "repondre", id, message }   ajoute la réponse et l’expédie
 *        si le canal du client est le courriel ; le ticket passe à « répondu ».
 *   POST { action: "statut", id, statut, priorite? }
 *   POST { action: "vu", id, vu? }
 *
 * Les compteurs affichés en tête viennent de l’API : ils portent sur tous les
 * tickets, filtres non appliqués.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  User,
} from "lucide-react";

export type StatutTicket = "ouvert" | "en_cours" | "repondu" | "clos";

type MessageSupport = {
  id?: string;
  ticket_id?: string;
  auteur: "client" | "support" | string;
  corps: string;
  email_envoye?: boolean | null;
  created_at?: string | null;
};

type TicketSupport = {
  id: string;
  numero?: number | string | null;
  email?: string | null;
  nom?: string | null;
  sujet?: string | null;
  categorie?: string | null;
  canal_reponse?: string | null;
  statut?: string | null;
  priorite?: string | null;
  locale?: string | null;
  page_origine?: string | null;
  vu_par_proprietaire?: boolean | null;
  lu_par_client?: boolean | null;
  derniere_reponse_at?: string | null;
  created_at?: string | null;
};

type Compteurs = {
  total: number;
  ouvert: number;
  en_cours: number;
  repondu: number;
  clos: number;
  non_vus: number;
};

const COMPTEURS_VIDES: Compteurs = { total: 0, ouvert: 0, en_cours: 0, repondu: 0, clos: 0, non_vus: 0 };

const STATUTS: { cle: StatutTicket; libelle: string; classe: string }[] = [
  { cle: "ouvert", libelle: "Ouvert", classe: "border-amber-400/50 bg-amber-500/15 text-amber-100" },
  { cle: "en_cours", libelle: "En cours", classe: "border-sky-400/50 bg-sky-500/15 text-sky-100" },
  { cle: "repondu", libelle: "Répondu", classe: "border-emerald-400/45 bg-emerald-500/12 text-emerald-100" },
  { cle: "clos", libelle: "Clos", classe: "border-white/15 bg-white/5 text-zinc-300" },
];

/** Les six thèmes de l’aide, écrits en clair. Un thème inconnu s’affiche tel quel. */
const CATEGORIES: Record<string, string> = {
  compte: "Compte",
  "abonnement-paiement": "Abonnement et paiement",
  "donnees-kpi": "Données et KPI",
  "fiches-societes": "Fiches des sociétés",
  confidentialite: "Confidentialité",
  technique: "Technique",
};

const CORPS_MIN = 10;

function libelleCategorie(c: string | null | undefined): string {
  if (!c) return "Sans thème";
  return CATEGORIES[c] ?? c;
}

function statutInfo(s: string | null | undefined) {
  return (
    STATUTS.find((x) => x.cle === s) ?? {
      cle: "ouvert" as StatutTicket,
      libelle: s ? String(s) : "Ouvert",
      classe: "border-white/15 text-zinc-300",
    }
  );
}

function horodatage(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reference(t: TicketSupport): string {
  return t.numero == null ? String(t.id).slice(0, 8) : `n° ${t.numero}`;
}

/** Le client a demandé une réponse par courriel (canal « email »). */
function parCourriel(t: TicketSupport): boolean {
  const c = (t.canal_reponse ?? "").toLowerCase();
  return c === "email" || c.includes("mail") || c.includes("courriel");
}

export function SupportDesk({ jeton }: { jeton: string | null }) {
  const [tickets, setTickets] = useState<TicketSupport[]>([]);
  const [compteurs, setCompteurs] = useState<Compteurs>(COMPTEURS_VIDES);
  const [categories, setCategories] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<"tous" | StatutTicket>("tous");
  const [filtreCategorie, setFiltreCategorie] = useState<string>("toutes");
  const [ouvert, setOuvert] = useState<TicketSupport | null>(null);
  const [fil, setFil] = useState<MessageSupport[]>([]);
  const [filEnCours, setFilEnCours] = useState(false);
  const [corps, setCorps] = useState("");
  const [statutChoisi, setStatutChoisi] = useState<StatutTicket>("repondu");
  const [envoi, setEnvoi] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const zoneDetail = useRef<HTMLDivElement | null>(null);

  /** Le jeton d’audit suit les appels quand la page a été ouverte avec lui. */
  const urlDesk = useCallback(
    (params: Record<string, string> = {}) => {
      const q = new URLSearchParams(params);
      if (jeton) q.set("audit_token", jeton);
      const s = q.toString();
      return `/api/desk-mtk9x4kp/support${s ? `?${s}` : ""}`;
    },
    [jeton],
  );

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params: Record<string, string> = {};
      if (filtreStatut !== "tous") params.statut = filtreStatut;
      if (filtreCategorie !== "toutes") params.categorie = filtreCategorie;
      const r = await fetch(urlDesk(params), { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        tickets?: TicketSupport[];
        compteurs?: Compteurs;
        message?: string;
        erreur?: string;
      };
      if (!r.ok) throw new Error(j.message ?? j.erreur ?? `réponse ${r.status}`);
      const liste = Array.isArray(j.tickets) ? j.tickets : [];
      setTickets(liste);
      setCompteurs(j.compteurs ?? COMPTEURS_VIDES);
      // La liste peut être filtrée : le choix des thèmes ne doit pas rétrécir.
      setCategories((prec) => {
        const s = new Set(prec);
        for (const t of liste) if (t.categorie) s.add(String(t.categorie));
        return [...s].sort((a, b) => libelleCategorie(a).localeCompare(libelleCategorie(b), "fr"));
      });
    } catch (e) {
      setTickets([]);
      setErreur(e instanceof Error ? e.message : "chargement impossible");
    } finally {
      setChargement(false);
    }
  }, [filtreStatut, filtreCategorie, urlDesk]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const poster = useCallback(
    async (corpsRequete: Record<string, unknown>) => {
      const r = await fetch(urlDesk(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpsRequete),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(String(j.message ?? j.erreur ?? `réponse ${r.status}`));
      return j;
    },
    [urlDesk],
  );

  const ouvrir = useCallback(
    async (t: TicketSupport) => {
      setOuvert(t);
      setCorps("");
      setNote(null);
      setStatutChoisi("repondu");
      setFil([]);
      setFilEnCours(true);
      try {
        const r = await fetch(urlDesk({ id: String(t.id) }), { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { ticket?: TicketSupport; messages?: MessageSupport[] };
          setFil(Array.isArray(j.messages) ? j.messages : []);
          if (j.ticket) {
            setOuvert((prec) => (prec && String(prec.id) === String(t.id) ? { ...prec, ...j.ticket } : prec));
          }
        }
      } catch {
        /* le fil reste vide, le reste de la page fonctionne */
      } finally {
        setFilEnCours(false);
      }
      if (!t.vu_par_proprietaire) {
        try {
          await poster({ action: "vu", id: String(t.id), vu: true });
          setTickets((prec) =>
            prec.map((x) => (String(x.id) === String(t.id) ? { ...x, vu_par_proprietaire: true } : x)),
          );
          setOuvert((prec) =>
            prec && String(prec.id) === String(t.id) ? { ...prec, vu_par_proprietaire: true } : prec,
          );
          setCompteurs((c) => ({ ...c, non_vus: Math.max(0, c.non_vus - 1) }));
        } catch {
          /* le marquage vu échoue en silence : la lecture reste possible */
        }
      }
      zoneDetail.current?.focus();
    },
    [poster, urlDesk],
  );

  /** Change le statut seul, sans écrire de message. */
  const changerStatut = useCallback(async () => {
    if (!ouvert) return;
    setEnvoi(true);
    setNote(null);
    try {
      await poster({ action: "statut", id: String(ouvert.id), statut: statutChoisi });
      setTickets((p) => p.map((x) => (String(x.id) === String(ouvert.id) ? { ...x, statut: statutChoisi } : x)));
      setOuvert((p) => (p ? { ...p, statut: statutChoisi } : p));
      setNote(`Statut passé à « ${statutInfo(statutChoisi).libelle} ».`);
    } catch (e) {
      setNote(`Échec du changement de statut : ${e instanceof Error ? e.message : "erreur inconnue"}.`);
    } finally {
      setEnvoi(false);
    }
  }, [ouvert, poster, statutChoisi]);

  const repondre = useCallback(async () => {
    if (!ouvert) return;
    const texte = corps.trim();
    if (texte.length < CORPS_MIN) {
      setNote(`La réponse doit faire au moins ${CORPS_MIN} caractères.`);
      return;
    }
    setEnvoi(true);
    setNote(null);
    try {
      await poster({ action: "repondre", id: String(ouvert.id), message: texte });
      // L API passe le ticket à « répondu » ; un autre choix demande un second appel.
      let statutFinal: StatutTicket = "repondu";
      if (statutChoisi !== "repondu") {
        await poster({ action: "statut", id: String(ouvert.id), statut: statutChoisi });
        statutFinal = statutChoisi;
      }
      const maintenant = new Date().toISOString();
      setFil((p) => [...p, { auteur: "support", corps: texte, created_at: maintenant }]);
      setCorps("");
      setTickets((p) =>
        p.map((x) =>
          String(x.id) === String(ouvert.id)
            ? { ...x, statut: statutFinal, derniere_reponse_at: maintenant, lu_par_client: false, vu_par_proprietaire: true }
            : x,
        ),
      );
      setOuvert((p) => (p ? { ...p, statut: statutFinal } : p));
      setNote(
        parCourriel(ouvert)
          ? "Réponse enregistrée et expédiée par courriel, et visible dans son espace."
          : "Réponse enregistrée : elle s’affiche dans l’espace du client.",
      );
    } catch (e) {
      setNote(`Échec de l’envoi : ${e instanceof Error ? e.message : "erreur inconnue"}.`);
    } finally {
      setEnvoi(false);
    }
  }, [corps, ouvert, poster, statutChoisi]);

  const visibles = useMemo(() => {
    const rang = (t: TicketSupport) => (t.vu_par_proprietaire ? 1 : 0);
    return tickets
      .filter((t) => (filtreStatut === "tous" ? true : (t.statut ?? "ouvert") === filtreStatut))
      .filter((t) => (filtreCategorie === "toutes" ? true : String(t.categorie ?? "") === filtreCategorie))
      .slice()
      .sort((a, b) => {
        const r = rang(a) - rang(b);
        if (r !== 0) return r;
        const da = new Date(a.derniere_reponse_at ?? a.created_at ?? 0).getTime();
        const db = new Date(b.derniere_reponse_at ?? b.created_at ?? 0).getTime();
        return db - da;
      });
  }, [tickets, filtreStatut, filtreCategorie]);

  return (
    <div className="min-w-0">
      {/* Compteurs : le nombre de tickets ouverts saute aux yeux. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 sm:col-span-1">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-amber-200/80">Tickets ouverts</div>
          <div className="mt-1 font-display text-[44px] font-bold leading-none text-amber-200">{compteurs.ouvert}</div>
        </div>
        <Compteur
          libelle="Jamais vus"
          valeur={compteurs.non_vus}
          accent={compteurs.non_vus > 0 ? "text-rose-200" : "text-zinc-300"}
        />
        <Compteur libelle="En cours" valeur={compteurs.en_cours} accent="text-sky-200" />
        <Compteur libelle="Répondus" valeur={compteurs.repondu} accent="text-emerald-200" />
        <Compteur libelle="Clos" valeur={compteurs.clos} accent="text-zinc-300" />
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Statut</span>
        <Filtre actif={filtreStatut === "tous"} onClick={() => setFiltreStatut("tous")}>
          Tous ({compteurs.total})
        </Filtre>
        {STATUTS.map((s) => (
          <Filtre key={s.cle} actif={filtreStatut === s.cle} onClick={() => setFiltreStatut(s.cle)}>
            {s.libelle} ({compteurs[s.cle]})
          </Filtre>
        ))}
        <label htmlFor="filtre-categorie" className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
          Thème
        </label>
        <select
          id="filtre-categorie"
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="rounded-lg border border-[#262626] bg-[#0c0c0c] px-2.5 py-1.5 text-[12.5px] text-zinc-200 outline-none focus:border-violet-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400"
        >
          <option value="toutes">Tous les thèmes</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {libelleCategorie(c)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void charger()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-violet-400/50 hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          {chargement ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Actualiser
        </button>
      </div>

      {erreur && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-words">Liste indisponible : {erreur}</span>
        </p>
      )}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Liste */}
        <div className="min-w-0">
          {chargement && tickets.length === 0 ? (
            <p className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-6 text-center text-[13px] text-zinc-500">
              Chargement des tickets…
            </p>
          ) : visibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#070707] px-3 py-8 text-center text-[13px] text-zinc-500">
              <Inbox className="mx-auto mb-2 size-5 text-zinc-600" />
              Aucun ticket avec ces filtres.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visibles.map((t) => {
                const st = statutInfo(t.statut);
                const nonVu = !t.vu_par_proprietaire;
                const actif = !!ouvert && String(ouvert.id) === String(t.id);
                return (
                  <li key={String(t.id)}>
                    <button
                      type="button"
                      onClick={() => void ouvrir(t)}
                      aria-current={actif ? "true" : undefined}
                      className={`block w-full min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                        nonVu
                          ? "border-rose-400/60 border-l-4 border-l-rose-400 bg-rose-500/10 hover:bg-rose-500/15"
                          : actif
                            ? "border-violet-400/50 bg-violet-500/10"
                            : "border-[#1f1f1f] bg-[#0a0a0a] hover:border-[#2f2f2f]"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {nonVu && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-rose-100 ring-1 ring-rose-300/60">
                            Non vu
                          </span>
                        )}
                        <span className="truncate font-mono text-[10.5px] text-zinc-500">{reference(t)}</span>
                        <span
                          className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${st.classe}`}
                        >
                          {st.libelle}
                        </span>
                      </span>
                      <span
                        className={`mt-1 block truncate text-[13.5px] ${nonVu ? "font-semibold text-zinc-50" : "text-zinc-200"}`}
                      >
                        {t.sujet ?? "Sans sujet"}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {t.nom || t.email || "Client inconnu"} · {libelleCategorie(t.categorie)} ·{" "}
                        {horodatage(t.derniere_reponse_at ?? t.created_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Détail */}
        <div
          ref={zoneDetail}
          tabIndex={-1}
          className="min-w-0 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 focus:outline-none"
        >
          {!ouvert ? (
            <p className="py-10 text-center text-[13px] text-zinc-500">
              Choisis un ticket dans la liste pour lire le fil et répondre.
            </p>
          ) : (
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-500">{reference(ouvert)}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${statutInfo(ouvert.statut).classe}`}
                >
                  {statutInfo(ouvert.statut).libelle}
                </span>
                {ouvert.priorite && (
                  <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                    Priorité {ouvert.priorite}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                  {parCourriel(ouvert) ? <Mail className="size-3" /> : <MessageSquare className="size-3" />}
                  {parCourriel(ouvert) ? "Réponse par courriel" : "Réponse dans son espace"}
                </span>
              </div>
              <h2 className="mt-2 break-words text-[17px] font-semibold text-zinc-50">{ouvert.sujet ?? "Sans sujet"}</h2>
              <p className="mt-1 break-words text-[12px] text-zinc-500">
                {ouvert.nom ? `${ouvert.nom} · ` : ""}
                {ouvert.email ?? "courriel inconnu"} · {libelleCategorie(ouvert.categorie)}
                {ouvert.locale ? ` · ${ouvert.locale}` : ""}
                {ouvert.page_origine ? ` · depuis ${ouvert.page_origine}` : ""}
              </p>

              {/* Fil de la conversation */}
              <div className="mt-4 flex flex-col gap-2 border-t border-[#1a1a1a] pt-4">
                {filEnCours && fil.length === 0 && <p className="text-[12.5px] text-zinc-500">Chargement du fil…</p>}
                {!filEnCours && fil.length === 0 && (
                  <p className="text-[12.5px] text-zinc-500">Aucun message rattaché à ce ticket.</p>
                )}
                {fil.map((m, i) => {
                  const support = m.auteur === "support";
                  return (
                    <article
                      key={String(m.id ?? i)}
                      className={`min-w-0 rounded-lg border px-3 py-2 ${
                        support ? "border-violet-400/25 bg-violet-500/[0.07]" : "border-[#1f1f1f] bg-[#0c0c0c]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        {support ? <MessageSquare className="size-3" /> : <User className="size-3" />}
                        {support ? "Support" : "Client"}
                        {support && m.email_envoye === false && (
                          <span className="rounded border border-amber-400/40 px-1 text-amber-200">courriel non parti</span>
                        )}
                        <span className="ml-auto normal-case tracking-normal">{horodatage(m.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-zinc-200">
                        {m.corps}
                      </p>
                    </article>
                  );
                })}
              </div>

              {/* Réponse et statut */}
              <div className="mt-4 border-t border-[#1a1a1a] pt-4">
                <label
                  htmlFor="reponse-support"
                  className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-zinc-400"
                >
                  Réponse au client
                </label>
                <textarea
                  id="reponse-support"
                  value={corps}
                  onChange={(e) => setCorps(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Écris la réponse, 10 caractères au minimum…"
                  className="block w-full resize-y rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[13.5px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label htmlFor="statut-ticket" className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
                    Statut après envoi
                  </label>
                  <select
                    id="statut-ticket"
                    value={statutChoisi}
                    onChange={(e) => setStatutChoisi(e.target.value as StatutTicket)}
                    className="rounded-lg border border-[#262626] bg-[#0c0c0c] px-2.5 py-1.5 text-[12.5px] text-zinc-200 outline-none focus:border-violet-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400"
                  >
                    {STATUTS.map((s) => (
                      <option key={s.cle} value={s.cle}>
                        {s.libelle}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={envoi}
                    onClick={() => void changerStatut()}
                    className="rounded-lg border border-[#2a2a2a] px-3 py-1.5 text-[12.5px] text-zinc-200 transition-colors hover:border-violet-400/50 hover:text-violet-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  >
                    Changer le statut seulement
                  </button>
                  <button
                    type="button"
                    disabled={envoi || corps.trim().length < CORPS_MIN}
                    onClick={() => void repondre()}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                  >
                    {envoi ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {parCourriel(ouvert) ? "Envoyer par courriel" : "Publier dans son espace"}
                  </button>
                </div>
                <p className="mt-1.5 text-[11.5px] text-zinc-500">
                  {parCourriel(ouvert)
                    ? "Le client a choisi le courriel : la réponse lui est expédiée et reste visible dans son espace."
                    : "Le client n’a pas choisi le courriel : la réponse apparaît uniquement dans son espace Mettrik."}
                </p>
                {note && (
                  <p
                    role="status"
                    className="mt-2 flex items-start gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-zinc-300"
                  >
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
                    <span className="min-w-0 break-words">{note}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Compteur({ libelle, valeur, accent }: { libelle: string; valeur: number; accent: string }) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">{libelle}</div>
      <div className={`mt-1 font-display text-[26px] font-bold leading-none ${accent}`}>{valeur}</div>
    </div>
  );
}

function Filtre({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
        actif
          ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
          : "border-[#242424] text-zinc-400 hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
