"use client";

/**
 * Panneau de la bulle de support (Yann 21 sept 2026).
 *
 * Trois temps :
 *   1. le visiteur écrit sa question, la FAQ locale répond pendant la frappe ;
 *   2. s'il n'a pas sa réponse, il ouvre un ticket et choisit où la lire ;
 *   3. le numéro de ticket s'affiche avec la phrase qui dit où la réponse arrive.
 *
 * Contrat serveur (écrit ailleurs, pas touché ici) :
 *   POST /api/support/tickets
 *   { email, nom, sujet, categorie, message, canal_reponse, locale, page_origine }
 *   -> { ok, ticket: { numero } } | { error }
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Inbox,
  LayoutDashboard,
  Loader2,
  Mail,
  Search,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { ListeReponsesFaq, categoriesSupport, chercheFaq } from "./support-faq";
import { ADRESSE_SUPPORT, TEXTES, type LangueSupport } from "./support-strings";

type Etape = "recherche" | "connexion" | "ticket" | "confirme";
type Canal = "email" | "espace";

const CLE_BROUILLON = "mettrik:support:brouillon";
const DUREE_BROUILLON = 24 * 60 * 60 * 1000;

type Brouillon = {
  question?: string;
  email?: string;
  nom?: string;
  sujet?: string;
  categorie?: string;
  message?: string;
  canal?: Canal;
  etape?: Etape;
  ts?: number;
};

function litBrouillon(): Brouillon | null {
  try {
    const brut = window.localStorage.getItem(CLE_BROUILLON);
    if (!brut) return null;
    const b = JSON.parse(brut) as Brouillon;
    if (!b || typeof b !== "object") return null;
    if (typeof b.ts === "number" && Date.now() - b.ts > DUREE_BROUILLON) return null;
    return b;
  } catch {
    return null;
  }
}

function ecritBrouillon(b: Brouillon): void {
  try {
    window.localStorage.setItem(CLE_BROUILLON, JSON.stringify({ ...b, ts: Date.now() }));
  } catch {
    /* navigation privée ou stockage plein : la bulle reste utilisable */
  }
}

function effaceBrouillon(): void {
  try {
    window.localStorage.removeItem(CLE_BROUILLON);
  } catch {
    /* sans effet, volontairement silencieux */
  }
}

function emailValide(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(valeur.trim());
}

const SELECTEUR_FOCUS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(racine: HTMLElement): HTMLElement[] {
  return Array.from(racine.querySelectorAll<HTMLElement>(SELECTEUR_FOCUS)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

const CLASSE_CHAMP =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/25";
const CLASSE_LABEL = "mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500";

export function SupportPanel({
  langue,
  locale,
  onFermer,
}: {
  langue: LangueSupport;
  locale: string;
  onFermer: () => void;
}) {
  const T = TEXTES[langue];
  const idTitre = useId();
  const panneauRef = useRef<HTMLDivElement | null>(null);
  const emailRef = useRef("");

  const [etape, setEtape] = useState<Etape>("recherche");
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");
  const [emailPrerempli, setEmailPrerempli] = useState(false);
  const [aSession, setASession] = useState(false);
  const [nom, setNom] = useState("");
  const [sujet, setSujet] = useState("");
  const [categorie, setCategorie] = useState("autre");
  const [message, setMessage] = useState("");
  const [canal, setCanal] = useState<Canal>("email");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  const categories = useMemo(() => categoriesSupport(langue), [langue]);
  const reponses = useMemo(() => chercheFaq(question, langue), [question, langue]);

  // Reprise du brouillon : une fermeture accidentelle ne doit rien effacer.
  useEffect(() => {
    const b = litBrouillon();
    if (!b) return;
    if (typeof b.question === "string") setQuestion(b.question);
    if (typeof b.email === "string") {
      emailRef.current = b.email;
      setEmail(b.email);
    }
    if (typeof b.nom === "string") setNom(b.nom);
    if (typeof b.sujet === "string") setSujet(b.sujet);
    if (typeof b.categorie === "string") setCategorie(b.categorie);
    if (typeof b.message === "string") setMessage(b.message);
    if (b.canal === "email" || b.canal === "espace") setCanal(b.canal);
    if (b.etape === "ticket") setEtape("ticket");
  }, []);

  // Adresse pré-remplie quand une session existe. Silencieux en cas d'échec.
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const adresse = data?.user?.email ?? "";
        if (!vivant || !adresse) return;
        setASession(true);
        if (emailRef.current.trim()) return;
        emailRef.current = adresse;
        setEmail(adresse);
        setEmailPrerempli(true);
      } catch {
        /* visiteur non connecté ou client indisponible : on continue */
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  // Sauvegarde du brouillon tant que le ticket n'est pas parti.
  useEffect(() => {
    if (etape === "confirme") return;
    ecritBrouillon({ question, email: emailPrerempli ? "" : email, nom, sujet, categorie, message, canal, etape });
  }, [question, email, emailPrerempli, nom, sujet, categorie, message, canal, etape]);

  // Échap ferme, Tab reste prisonnier du panneau.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const racine = panneauRef.current;
      if (!racine) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFermer();
        return;
      }
      if (e.key !== "Tab") return;
      const cibles = focusables(racine);
      if (!cibles.length) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      const actif = document.activeElement as HTMLElement | null;
      const dedans = !!actif && racine.contains(actif);
      if (!dedans) {
        e.preventDefault();
        (e.shiftKey ? dernier : premier).focus();
        return;
      }
      if (e.shiftKey && actif === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onFermer]);

  // Premier champ utile au focus, à chaque changement d'étape.
  useEffect(() => {
    const racine = panneauRef.current;
    if (!racine) return;
    const cible = racine.querySelector<HTMLElement>("[data-focus-initial]") ?? focusables(racine)[0];
    const minuteur = window.setTimeout(() => cible?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(minuteur);
  }, [etape]);

  function versTicket() {
    setErreur(null);
    if (!sujet.trim() && question.trim()) setSujet(question.trim().slice(0, 120));
    if (!message.trim() && question.trim()) setMessage(question.trim());
    // Yann 21 sept 2026 : la recherche dans les questions frequentes reste
    // ouverte a tous, mais ecrire un message demande un compte. Le visiteur non
    // connecte est renvoye vers la connexion, son brouillon etant deja conserve.
    if (!aSession) {
      setEtape("connexion");
      return;
    }
    setEtape("ticket");
  }

  async function envoie(e: React.FormEvent) {
    e.preventDefault();
    if (envoi) return;
    if (!emailValide(email)) {
      setErreur(T.erreur_email);
      return;
    }
    if (!message.trim()) {
      setErreur(T.erreur_message);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          nom: nom.trim(),
          sujet: sujet.trim() || question.trim().slice(0, 120) || message.trim().slice(0, 80),
          categorie,
          message: message.trim(),
          canal_reponse: canal,
          locale,
          page_origine: typeof window === "undefined" ? "" : window.location.pathname,
        }),
      });
      const donnees = (await reponse.json().catch(() => null)) as
        | { ok?: boolean; ticket?: { numero?: string | number }; error?: string }
        | null;
      const recu = donnees?.ticket?.numero;
      if (!reponse.ok || !donnees?.ok || recu === undefined || recu === null || `${recu}`.trim() === "") {
        throw new Error(donnees?.error ?? "envoi_impossible");
      }
      effaceBrouillon();
      setNumero(`${recu}`.trim());
      setEtape("confirme");
    } catch {
      setErreur(T.erreur_envoi);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div
      ref={panneauRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
      className="flex max-h-[min(38rem,calc(100dvh-7.5rem))] w-[min(23.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11]/95 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-violet-500/10 backdrop-blur-xl"
    >
      {/* Liseré violet vers cyan : signature Mettrik, discrète. */}
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-violet-500/70 via-cyan-400/50 to-transparent" />

      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 id={idTitre} className="text-[15px] font-semibold tracking-tight text-zinc-50">
            {etape === "ticket" ? T.ticket_titre : etape === "confirme" ? T.confirme_titre : T.titre}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">
            {etape === "ticket" ? T.ticket_intro : etape === "confirme" ? T.confidentialite : T.sous_titre}
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label={TEXTES[langue].bulle_fermer}
          className="-mr-1 -mt-0.5 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {etape === "recherche" && (
          <div className="space-y-3">
            <div>
              <label htmlFor={`${idTitre}-q`} className={CLASSE_LABEL}>
                {T.champ_question_label}
              </label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-600" />
                <textarea
                  id={`${idTitre}-q`}
                  data-focus-initial
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={T.champ_question_placeholder}
                  className={`${CLASSE_CHAMP} resize-none pl-9`}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">{T.aide_saisie}</p>
            </div>

            {reponses.length > 0 && (
              <section aria-live="polite">
                <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/80">
                  {T.resultats_titre}
                </h3>
                <ListeReponsesFaq reponses={reponses} />
              </section>
            )}

            {question.trim().length >= 3 && reponses.length === 0 && (
              <p aria-live="polite" className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-400">
                {T.aucun_resultat}
              </p>
            )}
          </div>
        )}

        {etape === "ticket" && (
          <form onSubmit={envoie} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`${idTitre}-email`} className={CLASSE_LABEL}>
                  {T.email_label}
                </label>
                <input
                  id={`${idTitre}-email`}
                  data-focus-initial
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    emailRef.current = e.target.value;
                    setEmail(e.target.value);
                    setEmailPrerempli(false);
                  }}
                  placeholder={T.email_placeholder}
                  className={CLASSE_CHAMP}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`${idTitre}-nom`} className={CLASSE_LABEL}>
                  {T.nom_label} <span className="normal-case tracking-normal text-zinc-600">({T.facultatif})</span>
                </label>
                <input
                  id={`${idTitre}-nom`}
                  type="text"
                  autoComplete="name"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder={T.nom_placeholder}
                  className={CLASSE_CHAMP}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${idTitre}-cat`} className={CLASSE_LABEL}>
                {T.categorie_label}
              </label>
              <select
                id={`${idTitre}-cat`}
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className={CLASSE_CHAMP}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0b0b11]">
                    {c.titre}
                  </option>
                ))}
                <option value="autre" className="bg-[#0b0b11]">
                  {T.categorie_autre}
                </option>
              </select>
            </div>

            <div>
              <label htmlFor={`${idTitre}-sujet`} className={CLASSE_LABEL}>
                {T.sujet_label}
              </label>
              <input
                id={`${idTitre}-sujet`}
                type="text"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder={T.sujet_placeholder}
                className={CLASSE_CHAMP}
              />
            </div>

            <div>
              <label htmlFor={`${idTitre}-msg`} className={CLASSE_LABEL}>
                {T.message_label}
              </label>
              <textarea
                id={`${idTitre}-msg`}
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={T.message_placeholder}
                className={`${CLASSE_CHAMP} resize-none`}
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className={CLASSE_LABEL}>{T.canal_label}</legend>
              {([
                { valeur: "email" as Canal, titre: T.canal_email, aide: T.canal_email_aide, Icone: Mail },
                { valeur: "espace" as Canal, titre: T.canal_espace, aide: T.canal_espace_aide, Icone: LayoutDashboard },
              ]).map(({ valeur, titre, aide, Icone }) => {
                const actif = canal === valeur;
                return (
                  <label
                    key={valeur}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-violet-400/60 ${
                      actif ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="canal_reponse"
                      value={valeur}
                      checked={actif}
                      onChange={() => setCanal(valeur)}
                      className="sr-only"
                    />
                    <Icone aria-hidden className={`mt-0.5 size-4 shrink-0 ${actif ? "text-cyan-300" : "text-zinc-500"}`} />
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-medium ${actif ? "text-zinc-50" : "text-zinc-300"}`}>{titre}</span>
                      <span className="block text-[11.5px] leading-snug text-zinc-500">{aide}</span>
                    </span>
                  </label>
                );
              })}
              {canal === "espace" && !aSession && (
                <p className="text-[11.5px] leading-snug text-amber-300/80">{T.canal_espace_sans_compte}</p>
              )}
            </fieldset>

            {erreur && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-300" />
                <div className="min-w-0 text-[12.5px] leading-snug text-rose-100">
                  <p>{erreur}</p>
                  <a
                    href={`mailto:${ADRESSE_SUPPORT}`}
                    className="mt-0.5 inline-block font-medium text-rose-200 underline decoration-rose-300/50 underline-offset-2 hover:text-white"
                  >
                    {T.erreur_contact}
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setEtape("recherche")}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                {T.retour}
              </button>
              <button
                type="submit"
                disabled={envoi}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/20 px-3.5 py-2 text-[13px] font-medium text-violet-50 transition-colors hover:bg-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-60"
              >
                {envoi ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                {envoi ? T.envoi_en_cours : T.envoyer}
              </button>
            </div>
            <p className="text-[11px] text-zinc-600">{T.confidentialite}</p>
          </form>
        )}

        {etape === "connexion" && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              Pour nous écrire, connectez vous ou créez un compte. Votre message est conservé et vous
              retrouverez la réponse dans votre espace.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`/?auth=signin&next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
                className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-400"
              >
                Se connecter
              </a>
              <a
                href={`/?auth=signup&next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/12 px-3 py-2 text-[13px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40 hover:text-white"
              >
                Créer un compte
              </a>
              <button
                type="button"
                onClick={() => setEtape("recherche")}
                className="mt-1 text-[12px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              >
                Revenir aux questions fréquentes
              </button>
            </div>
          </div>
        )}

        {etape === "confirme" && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-3 py-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
                <Check className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{T.confirme_numero}</p>
                <p className="truncate font-mono text-[15px] font-semibold text-cyan-200">{numero}</p>
              </div>
            </div>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-300">
              <Inbox aria-hidden className="mt-0.5 size-4 shrink-0 text-violet-300" />
              <span>
                {canal === "email" ? (
                  <>
                    {T.confirme_par_email} <span className="font-medium text-zinc-100">{email.trim()}</span>.
                  </>
                ) : (
                  T.confirme_dans_espace
                )}
              </span>
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              {canal === "espace" && (
                <a
                  href="/account"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-zinc-200 transition-colors hover:border-violet-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                >
                  <LayoutDashboard aria-hidden className="size-3.5" />
                  {T.confirme_lien_espace}
                </a>
              )}
              <button
                type="button"
                onClick={onFermer}
                className="ml-auto rounded-lg border border-violet-400/40 bg-violet-500/20 px-3.5 py-2 text-[13px] font-medium text-violet-50 transition-colors hover:bg-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                {T.confirme_fermer}
              </button>
            </div>
          </div>
        )}
      </div>

      {etape === "recherche" && (
        <footer className="border-t border-white/10 px-4 py-2.5">
          <button
            type="button"
            onClick={versTicket}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
          >
            <Send aria-hidden className="size-3.5 text-violet-300" />
            {question.trim().length >= 3 ? T.bouton_ticket : T.bouton_ticket_direct}
          </button>
        </footer>
      )}
    </div>
  );
}

export default SupportPanel;
