"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import type { Locale } from "@/lib/i18n/types";
import { TurnstileWidget } from "@/components/turnstile-widget";

/**
 * Formulaire dédié pros pour demander un accès API Mettrik AI
 * (Yann P7, 31 mai 2026).
 *
 * Champs spécifiques :
 *   - Nom complet
 *   - Email professionnel (validation soft : suffixe non gmail/yahoo
 *     préféré mais pas bloquant)
 *   - Société + rôle
 *   - Use case API (textarea)
 *   - Volume estimé (sociétés suivies + appels/mois)
 *
 * Submit POST /api/contact-api (endpoint dédié), insère dans
 * desk_contact_messages avec recipient = "api" + meta JSON dans body.
 */
export function ContactApiClient({ locale }: { locale: Locale }) {
  const isFr = locale === "fr";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [useCase, setUseCase] = useState("");
  const [companiesCount, setCompaniesCount] = useState("");
  const [callsPerMonth, setCallsPerMonth] = useState("");
  const [acceptCg, setAcceptCg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptCg) {
      setErr(
        isFr
          ? "Tu dois accepter les Conditions Générales pour envoyer ta demande."
          : "You must accept the Terms to send your request.",
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData(formRef.current ?? undefined);
      const captchaToken = (fd.get("cf-turnstile-response") as string | null) ?? null;
      if (!captchaToken) {
        setErr(
          isFr
            ? "Captcha non rempli. Recharge la page si besoin."
            : "Captcha not filled. Reload the page if needed.",
        );
        setBusy(false);
        return;
      }
      const r = await fetch("/api/contact-api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          role,
          use_case: useCase,
          companies_count: companiesCount,
          calls_per_month: callsPerMonth,
          locale,
          captchaToken,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setErr(
          (data && data.error) ||
            (isFr
              ? "Erreur lors de l'envoi. Réessaie ou écris à contact@mettrik.ai."
              : "Send error. Try again or write to contact@mettrik.ai."),
        );
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
    } catch {
      setErr(
        isFr
          ? "Erreur réseau. Vérifie ta connexion."
          : "Network error. Check your connection.",
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-300">
          ✓
        </div>
        <h2 className="font-display text-xl font-bold text-zinc-50">
          {isFr ? "Demande envoyée" : "Request sent"}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-300">
          {isFr
            ? "Merci. Notre équipe revient vers toi sous 24 h ouvrées avec une proposition tarifaire sur mesure."
            : "Thanks. Our team gets back to you within 24 business hours with a tailored pricing proposal."}
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
    >
      <Field
        label={isFr ? "Nom complet" : "Full name"}
        placeholder={isFr ? "Jean Dupont" : "John Smith"}
        value={name}
        onChange={setName}
        required
      />

      <Field
        label={isFr ? "Email professionnel" : "Business email"}
        type="email"
        placeholder={isFr ? "jean.dupont@famille-office.fr" : "john.smith@familyoffice.com"}
        value={email}
        onChange={setEmail}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={isFr ? "Société" : "Company"}
          placeholder={isFr ? "Ex : Carmignac, Eurazeo" : "Ex: BlackRock, Pictet"}
          value={company}
          onChange={setCompany}
          required
        />
        <Field
          label={isFr ? "Ton rôle" : "Your role"}
          placeholder={isFr ? "Analyste, Gérant, CIO…" : "Analyst, PM, CIO…"}
          value={role}
          onChange={setRole}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-zinc-300">
          {isFr
            ? "Décris ton cas d'usage API"
            : "Describe your API use case"}
        </label>
        <textarea
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          required
          rows={4}
          placeholder={
            isFr
              ? "Ex : alimenter un dashboard interne avec les KPI Mettrik pour 30 sociétés suivies + alertes sur publication de résultats."
              : "Ex: feed an internal dashboard with Mettrik KPIs for 30 tracked companies + alerts on earnings releases."
          }
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={isFr ? "Sociétés suivies" : "Companies tracked"}
          placeholder={isFr ? "Ex : 30, 100, 500…" : "Ex: 30, 100, 500…"}
          value={companiesCount}
          onChange={setCompaniesCount}
        />
        <Field
          label={isFr ? "Appels API estimés / mois" : "Estimated API calls / month"}
          placeholder={isFr ? "Ex : 5 000, 50 000…" : "Ex: 5,000, 50,000…"}
          value={callsPerMonth}
          onChange={setCallsPerMonth}
        />
      </div>

      <TurnstileWidget />

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          checked={acceptCg}
          onChange={(e) => setAcceptCg(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-amber-500"
        />
        <span className="text-[12.5px] leading-relaxed text-zinc-300">
          {isFr ? "J'ai lu et j'accepte les " : "I have read and accept the "}
          <Link
            href="/legal/conditions"
            target="_blank"
            className="text-amber-300 underline hover:text-amber-200"
          >
            {isFr ? "Conditions Générales" : "Terms of Service"}
          </Link>
          {isFr
            ? " et j'autorise Mettrik AI à me recontacter à propos de cette demande."
            : " and authorize Mettrik AI to contact me about this request."}
        </span>
      </label>

      {err && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-[14px] font-bold text-zinc-900 shadow-lg shadow-amber-500/25 transition-shadow hover:shadow-amber-500/40 disabled:opacity-60"
      >
        {busy
          ? isFr
            ? "Envoi…"
            : "Sending…"
          : isFr
            ? "Envoyer ma demande"
            : "Send my request"}
        <Send className="size-4" />
      </button>

      <p className="text-center text-[11px] text-zinc-500">
        {isFr
          ? "Réponse sous 24 h ouvrées. Pas de revente de tes données."
          : "Reply within 24 business hours. We never resell your data."}
      </p>
    </form>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-zinc-300">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
      />
    </div>
  );
}
