"use client";

import { useState } from "react";

export function VerificationAdminClient({ retour }: { retour: string }) {
  const [etape, setEtape] = useState<"envoi" | "saisie">("envoi");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyer() {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await fetch("/api/admin-2fa/envoyer", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setEtape("saisie");
        setCode("");
        setMessage(`Code envoyé à ${j.destinataire}. Il est valable 10 minutes.`);
      } else {
        setErreur(j.erreur ?? "L’envoi du code a échoué.");
      }
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErreur("Le code comporte 6 chiffres.");
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      const r = await fetch("/api/admin-2fa/verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, retour }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMessage("Vérification réussie. Redirection…");
        window.location.assign(j.retour ?? retour);
        return;
      }
      setErreur(j.erreur ?? "Code incorrect.");
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    }
    setOccupe(false);
  }

  return (
    <main className="min-h-[100dvh] bg-[#050507] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0e] p-6">
        <div className="h-[3px] w-11 rounded bg-gradient-to-r from-violet-500 to-cyan-400" />
        <h1 className="mt-4 text-xl font-semibold">Vérification de sécurité</h1>
        <p className="mt-2 text-sm text-white/65">
          L’accès aux outils internes demande un code à 6 chiffres, envoyé à l’adresse de votre compte. Il n’est demandé qu’une fois tous les 30 jours sur cet appareil.
        </p>

        {etape === "envoi" ? (
          <button
            type="button"
            onClick={envoyer}
            disabled={occupe}
            className="mt-6 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            {occupe ? "Envoi…" : "Recevoir le code"}
          </button>
        ) : (
          <form onSubmit={verifier} className="mt-6">
            <label htmlFor="code" className="text-xs text-white/60">Code reçu par e-mail</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={occupe || code.length !== 6}
              className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {occupe ? "Vérification…" : "Valider"}
            </button>
            <button
              type="button"
              onClick={envoyer}
              disabled={occupe}
              className="mt-3 w-full text-xs text-white/55 underline-offset-4 hover:underline disabled:opacity-50"
            >
              Renvoyer un code
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-emerald-400" role="status">{message}</p>}
        {erreur && <p className="mt-4 text-sm text-rose-400" role="alert">{erreur}</p>}
      </div>
    </main>
  );
}
