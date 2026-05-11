"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Send, Mail, ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n/types";
import { TurnstileWidget } from "@/components/turnstile-widget";

type Strings = {
  recipient_label: string;
  recipient_contact: string;
  recipient_support: string;
  recipient_sales: string;
  name_label: string;
  name_placeholder: string;
  email_label: string;
  email_placeholder: string;
  subject_label: string;
  subject_placeholder: string;
  body_label: string;
  body_placeholder: string;
  submit: string;
  sending: string;
  success_title: string;
  success_body: string;
  error: string;
  privacy_note: string;
  lang_notice: string;
  cg_accept: string;
  cg_link_label: string;
  cg_required: string;
};

type Recipient = "contact" | "support" | "sales";

/**
 * Formulaire contact V1.8 (Yann 8 mai 2026) :
 *  - Auth requise (gérée côté server, l'email est pré-rempli depuis user)
 *  - Acceptation CG OBLIGATOIRE (checkbox)
 *  - 3 destinations : contact général, support technique, commercial / Pro+
 *  - Submit appelle /api/contact (route existante)
 */
export function ContactV18Client({
  locale,
  userEmail,
  strings,
}: {
  locale: Locale;
  userEmail: string;
  strings: Strings;
}) {
  const [recipient, setRecipient] = useState<Recipient>("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [acceptCg, setAcceptCg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptCg) {
      setErr(strings.cg_required);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Lit le token Turnstile injecté dans le form par le widget
      const fd = new FormData(formRef.current ?? undefined);
      const captchaToken = (fd.get("cf-turnstile-response") as string | null) ?? null;
      if (!captchaToken) {
        setErr(strings.error);
        setBusy(false);
        return;
      }
      // Recipient "sales" routé sur "contact" côté server (ils traitent
      // tout en un mailbox commercial pour l'instant).
      const apiRecipient = recipient === "sales" ? "contact" : recipient;
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: apiRecipient,
          name,
          email,
          subject: recipient === "sales" ? `[Pro+] ${subject}` : subject,
          body,
          locale,
          captchaToken,
        }),
      });
      if (!r.ok) {
        setErr(strings.error);
      } else {
        setDone(true);
      }
    } catch {
      setErr(strings.error);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-6 text-center"
      >
        <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
          <Send className="size-5 text-emerald-300" />
        </div>
        <h2 className="font-display text-[20px] font-bold text-emerald-200">
          {strings.success_title}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-300">
          {strings.success_body}
        </p>
      </motion.div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      {/* Destination */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {strings.recipient_label}
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {(["contact", "support", "sales"] as Recipient[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRecipient(r)}
              className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
                recipient === r
                  ? "bg-violet-500/20 text-violet-100"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {r === "contact" ? strings.recipient_contact : r === "support" ? strings.recipient_support : strings.recipient_sales}
            </button>
          ))}
        </div>
      </div>

      {/* Name + Email */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={strings.name_label}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={strings.name_placeholder}
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
        </Field>
        <Field label={strings.email_label}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={strings.email_placeholder}
            required
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
        </Field>
      </div>

      {/* Subject */}
      <Field label={strings.subject_label}>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={strings.subject_placeholder}
          required
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </Field>

      {/* Body */}
      <Field label={strings.body_label}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={strings.body_placeholder}
          required
          rows={7}
          className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13.5px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </Field>

      {/* Acceptation CG */}
      <label className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px] text-zinc-300">
        <input
          type="checkbox"
          checked={acceptCg}
          onChange={(e) => setAcceptCg(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-violet-500"
          required
        />
        <span>
          {strings.cg_accept}
          <Link
            href={locale === "fr" ? "/fr/legal/conditions" : "/legal/conditions"}
            target="_blank"
            className="text-violet-300 underline-offset-2 hover:underline"
          >
            {strings.cg_link_label}
          </Link>
          .
        </span>
      </label>

      {err && <div className="text-[12px] text-rose-300">{err}</div>}

      {/* Captcha Cloudflare Turnstile (invisible/managed selon config). */}
      <div className="flex justify-center">
        <TurnstileWidget theme="dark" />
      </div>

      <button
        type="submit"
        disabled={busy || !acceptCg}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-[14px] font-bold text-zinc-50 transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? strings.sending : strings.submit}
        <Send className="size-4" />
      </button>

      <p className="text-center text-[10.5px] text-zinc-500">{strings.privacy_note}</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
