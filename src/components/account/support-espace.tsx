"use client";

/**
 * Espace support du client (/account/support).
 *
 * Contrat avec l’API (écrite à part), jamais modifié ici :
 *   GET  /api/support/tickets        -> les tickets de l’utilisateur connecté
 *   GET  /api/support/tickets/[id]   -> le ticket et son fil de messages
 *   POST /api/support/tickets/[id]   -> { message } ajoute un message du client
 *
 * Volontairement plus aéré que la vue du propriétaire : une carte par demande,
 * un statut écrit en clair, une pastille sur les réponses non lues.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, LifeBuoy, Loader2, Send } from "lucide-react";

type MessageSupport = {
  id?: string | number;
  auteur: "client" | "support" | string;
  corps: string;
  created_at?: string | null;
};

type Ticket = {
  id: string | number;
  numero?: number | string | null;
  sujet?: string | null;
  categorie?: string | null;
  canal_reponse?: string | null;
  statut?: string | null;
  lu_par_client?: boolean | null;
  derniere_reponse_at?: string | null;
  created_at?: string | null;
  messages?: MessageSupport[] | null;
};

/** Statuts écrits en français clair, sans jargon. */
const STATUTS: Record<string, { libelle: string; classe: string }> = {
  ouvert: { libelle: "Reçue, en attente", classe: "border-amber-400/45 bg-amber-500/12 text-amber-100" },
  en_cours: { libelle: "En cours de traitement", classe: "border-sky-400/45 bg-sky-500/12 text-sky-100" },
  repondu: { libelle: "Réponse disponible", classe: "border-emerald-400/45 bg-emerald-500/12 text-emerald-100" },
  clos: { libelle: "Demande close", classe: "border-white/15 bg-white/5 text-zinc-300" },
};

/** Les six thèmes de l’aide, écrits en clair. Un thème inconnu s’affiche tel quel. */
const CATEGORIES: Record<string, string> = {
  compte: "Compte",
  "abonnement-paiement": "Abonnement et paiement",
  "donnees-kpi": "Données et KPI",
  "fiches-societes": "Fiches des sociétés",
  confidentialite: "Confidentialité",
  technique: "Technique",
};

/** Longueur minimale d’un message, alignée sur la règle de l’API. */
const CORPS_MIN = 10;

function libelleCategorie(c: string | null | undefined): string {
  if (!c) return "";
  return CATEGORIES[c] ?? c;
}

function statutInfo(s: string | null | undefined) {
  return STATUTS[String(s ?? "ouvert")] ?? { libelle: "Reçue, en attente", classe: "border-white/15 text-zinc-300" };
}

function listeDe(j: unknown): Ticket[] {
  if (Array.isArray(j)) return j as Ticket[];
  const o = (j ?? {}) as Record<string, unknown>;
  for (const cle of ["tickets", "data", "items", "rows", "resultats"]) {
    if (Array.isArray(o[cle])) return o[cle] as Ticket[];
  }
  return [];
}

function ticketDe(j: unknown): Ticket | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  for (const cle of ["ticket", "data", "resultat"]) {
    const v = o[cle];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Ticket;
  }
  return "id" in o ? (o as Ticket) : null;
}

function messagesDe(j: unknown, t: Ticket | null): MessageSupport[] {
  const o = (j ?? {}) as Record<string, unknown>;
  if (Array.isArray(o.messages)) return o.messages as MessageSupport[];
  if (t && Array.isArray(t.messages)) return t.messages;
  return [];
}

function horodatage(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Une réponse du support que le client n’a pas encore lue. */
function nonLu(t: Ticket): boolean {
  return !!t.derniere_reponse_at && t.lu_par_client === false;
}

export function SupportEspace() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [fils, setFils] = useState<Record<string, MessageSupport[]>>({});
  const [filEnCours, setFilEnCours] = useState<string | null>(null);
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const r = await fetch("/api/support/tickets", { cache: "no-store" });
      if (!r.ok) throw new Error(`réponse ${r.status}`);
      setTickets(listeDe(await r.json()));
    } catch (e) {
      setTickets([]);
      setErreur(e instanceof Error ? e.message : "chargement impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const basculer = useCallback(
    async (t: Ticket) => {
      const cle = String(t.id);
      if (ouvert === cle) {
        setOuvert(null);
        return;
      }
      setOuvert(cle);
      if (Array.isArray(t.messages) && !fils[cle]) {
        setFils((p) => ({ ...p, [cle]: t.messages as MessageSupport[] }));
      }
      setFilEnCours(cle);
      try {
        const r = await fetch(`/api/support/tickets/${encodeURIComponent(cle)}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const detail = ticketDe(j);
          setFils((p) => ({ ...p, [cle]: messagesDe(j, detail) }));
          // La consultation vaut lecture : la pastille disparaît.
          setTickets((p) => p.map((x) => (String(x.id) === cle ? { ...x, ...(detail ?? {}), lu_par_client: true } : x)));
        }
      } catch {
        /* le fil reste celui déjà connu */
      } finally {
        setFilEnCours(null);
      }
    },
    [fils, ouvert],
  );

  const repondre = useCallback(async (t: Ticket) => {
    const cle = String(t.id);
    const texte = (brouillons[cle] ?? "").trim();
    if (texte.length < CORPS_MIN) {
      setNotes((p) => ({ ...p, [cle]: `Le message doit faire au moins ${CORPS_MIN} caractères.` }));
      return;
    }
    setEnvoi(cle);
    setNotes((p) => ({ ...p, [cle]: "" }));
    try {
      const r = await fetch(`/api/support/tickets/${encodeURIComponent(cle)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: texte }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { erreur?: string; message?: string };
        throw new Error(
          j.erreur === "ticket_clos"
            ? "cette demande est close"
            : (j.message ?? j.erreur ?? `réponse ${r.status}`),
        );
      }
      setFils((p) => ({
        ...p,
        [cle]: [...(p[cle] ?? []), { auteur: "client", corps: texte, created_at: new Date().toISOString() }],
      }));
      setBrouillons((p) => ({ ...p, [cle]: "" }));
      setNotes((p) => ({ ...p, [cle]: "Message envoyé au support." }));
    } catch (e) {
      setNotes((p) => ({ ...p, [cle]: `Envoi impossible (${e instanceof Error ? e.message : "erreur inconnue"}).` }));
    } finally {
      setEnvoi(null);
    }
  }, [brouillons]);

  const nbNonLus = useMemo(() => tickets.filter(nonLu).length, [tickets]);

  if (chargement && tickets.length === 0) {
    return (
      <p className="rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] px-6 py-10 text-center text-[13.5px] text-zinc-500">
        Chargement de tes demandes…
      </p>
    );
  }

  if (erreur && tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-6 py-6 text-[13.5px] text-rose-200">
        <p className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">Tes demandes n’ont pas pu être chargées ({erreur}).</span>
        </p>
        <button
          type="button"
          onClick={() => void charger()}
          className="mt-3 rounded-lg border border-rose-300/40 px-3 py-1.5 text-[12.5px] font-medium text-rose-100 transition-colors hover:bg-rose-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#070707] p-10 text-center">
        <LifeBuoy className="mx-auto size-8 text-zinc-600" />
        <div className="mt-3 text-[15px] font-semibold text-zinc-100">Aucune demande pour l’instant</div>
        <p className="mt-1 text-[13px] text-zinc-400">
          Les messages envoyés au support depuis le site apparaîtront ici, avec leur réponse.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {nbNonLus > 0 && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/12 px-3 py-1.5 text-[12.5px] text-violet-100">
          <span className="size-2 rounded-full bg-violet-300" aria-hidden="true" />
          {nbNonLus === 1 ? "1 réponse non lue" : `${nbNonLus} réponses non lues`}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {tickets.map((t) => {
          const cle = String(t.id);
          const st = statutInfo(t.statut);
          const estOuvert = ouvert === cle;
          const fil = fils[cle] ?? [];
          const neuf = nonLu(t);
          return (
            <li key={cle} className="min-w-0 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a]">
              <button
                type="button"
                onClick={() => void basculer(t)}
                aria-expanded={estOuvert}
                aria-controls={`fil-${cle}`}
                className="flex w-full min-w-0 items-start gap-3 rounded-2xl p-5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              >
                <span className="mt-1 shrink-0 text-zinc-500">
                  {estOuvert ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="break-words text-[15.5px] font-semibold text-zinc-50">{t.sujet ?? "Demande sans sujet"}</span>
                    {neuf && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-100">
                        <span className="size-1.5 rounded-full bg-violet-300" aria-hidden="true" />
                        Nouvelle réponse
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-zinc-400">
                    <span className={`rounded-full border px-2 py-0.5 text-[11.5px] ${st.classe}`}>{st.libelle}</span>
                    {t.numero != null && (
                      <span className="font-mono text-[11px] text-zinc-500">Demande n° {t.numero}</span>
                    )}
                    {t.categorie && <span className="break-words">{libelleCategorie(t.categorie)}</span>}
                    <span className="break-words">Envoyée le {horodatage(t.created_at)}</span>
                  </span>
                </span>
              </button>

              {estOuvert && (
                <div id={`fil-${cle}`} className="min-w-0 border-t border-[#1a1a1a] px-5 pb-5 pt-4">
                  {filEnCours === cle && fil.length === 0 && (
                    <p className="text-[13px] text-zinc-500">Chargement de la conversation…</p>
                  )}
                  {filEnCours !== cle && fil.length === 0 && (
                    <p className="text-[13px] text-zinc-500">Aucun message à afficher pour cette demande.</p>
                  )}
                  <div className="flex flex-col gap-3">
                    {fil.map((m, i) => {
                      const support = m.auteur === "support";
                      return (
                        <article
                          key={String(m.id ?? i)}
                          className={`min-w-0 rounded-xl border px-4 py-3 ${
                            support ? "border-violet-400/25 bg-violet-500/[0.07]" : "border-[#1f1f1f] bg-[#0c0c0c]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                            <span className={support ? "font-medium text-violet-200" : "font-medium text-zinc-300"}>
                              {support ? "Support Mettrik" : "Toi"}
                            </span>
                            <span>{horodatage(m.created_at)}</span>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-200">
                            {m.corps}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {t.statut === "clos" ? (
                    <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12.5px] text-zinc-400">
                      Cette demande est close. Écris au support depuis le site pour ouvrir une nouvelle demande.
                    </p>
                  ) : (
                    <div className="mt-4">
                      <label
                        htmlFor={`reponse-${cle}`}
                        className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400"
                      >
                        Répondre
                      </label>
                      <textarea
                        id={`reponse-${cle}`}
                        rows={4}
                        value={brouillons[cle] ?? ""}
                        onChange={(e) => setBrouillons((p) => ({ ...p, [cle]: e.target.value }))}
                        maxLength={5000}
                        placeholder="Ajoute une précision ou une question, 10 caractères au minimum…"
                        className="block w-full resize-y rounded-xl border border-[#262626] bg-[#0c0c0c] px-3.5 py-3 text-[14px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400"
                      />
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={envoi === cle || (brouillons[cle] ?? "").trim().length < CORPS_MIN}
                          onClick={() => void repondre(t)}
                          className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                        >
                          {envoi === cle ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                          Envoyer
                        </button>
                        {notes[cle] && (
                          <span role="status" className="min-w-0 break-words text-[12.5px] text-zinc-400">
                            {notes[cle]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
