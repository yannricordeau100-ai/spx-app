"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { motion } from "motion/react";
import { Send, Lock } from "lucide-react";
import type { Locale } from "@/lib/i18n/types";

type Strings = {
  recipient_label: string;
  recipient_contact: string;
  recipient_support: string;
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
};

export function ContactClient({ locale, strings }: { locale: Locale; strings: Strings }) {
  const [recipient, setRecipient] = useState<"contact" | "support">("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Audit 2 sept 2026 : le jeton anti-robot n etait jamais envoye, le
    // serveur refusait 100 % des messages (400 no_token). Le widget pose un
    // champ cache "cf-turnstile-response" dans le formulaire.
    const captchaToken =
      (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value ?? "";
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient, name, email, subject, body, locale, captchaToken }),
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6"
      >
        <h2 className="font-display text-[20px] font-bold text-emerald-200">
          {strings.success_title}
        </h2>
        <p className="mt-2 text-[14px] text-zinc-300">{strings.success_body}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Note langue : seuls FR et EN sont traités. Affiché en haut du form
          pour qu'aucun visiteur ne soit surpris d'écrire en allemand et de
          recevoir une réponse FR/EN. */}
      <div className="rounded-md border border-violet-500/25 bg-violet-500/[0.05] px-3 py-2 text-[12px] text-violet-100/85">
        ℹ {strings.lang_notice}
      </div>

      {/* Recipient dropdown */}
      <div>
        <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
          {strings.recipient_label}
        </label>
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value as "contact" | "support")}
          className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none focus:border-violet-400/60"
        >
          <option value="contact">{strings.recipient_contact}</option>
          <option value="support">{strings.recipient_support}</option>
        </select>
      </div>

      {/* Name + Email row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
            {strings.name_label}
          </label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={strings.name_placeholder}
            className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
            {strings.email_label}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={strings.email_placeholder}
            className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
          {strings.subject_label}
        </label>
        <input
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={strings.subject_placeholder}
          className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
        />
      </div>

      {/* Body */}
      <div>
        <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
          {strings.body_label}
        </label>
        <textarea
          required
          maxLength={5000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={strings.body_placeholder}
          className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
        />
      </div>

      {err && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-[13px] text-rose-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="inline-flex items-start gap-1.5 text-[11px] text-zinc-500">
          <Lock className="mt-0.5 size-3 shrink-0" />
          <span>{strings.privacy_note}</span>
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-5 py-2.5 text-[14px] font-medium text-violet-100 transition-all hover:scale-[1.02] hover:bg-violet-500/25 disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {busy ? strings.sending : strings.submit}
        </button>
      </div>
          <TurnstileWidget />
    </form>
  );
}
