"use client";

import { useEffect, useState } from "react";
import { Sparkles, Copy, Check, Gift, Send } from "lucide-react";
import { referralInviteUrl, type Referral } from "@/lib/referrals";
import type { Locale } from "@/lib/i18n/types";

type Strings = {
  cta_generate: string;
  cta_copy: string;
  cta_copied: string;
  your_code: string;
  your_link: string;
  signin_required: string;
  paid_required: string;
  history_title: string;
  history_empty: string;
  status_pending: string;
  status_signed_up: string;
  status_subscribed: string;
  status_rewarded: string;
  status_expired: string;
  status_invalid: string;
  expires_in: string;
  how_it_works: string;
  step1: string;
  step2: string;
  step3: string;
  code_invalid: string;
  code_valid_invited_by: string;
  disabled: string;
};

export function ParrainageClient({
  locale,
  isAuthenticated,
  userEmail,
  codeFromUrl,
  settingsEnabled,
  rewardMonths,
  bannerText,
  strings,
}: {
  locale: Locale;
  isAuthenticated: boolean;
  userEmail: string | null;
  codeFromUrl: string | null;
  settingsEnabled: boolean;
  rewardMonths: number;
  bannerText: string;
  strings: Strings;
}) {
  void rewardMonths; void userEmail;

  const [refs, setRefs] = useState<Referral[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeCheck, setCodeCheck] = useState<{ valid: boolean; referrer?: string; reason?: string } | null>(null);

  // Si arrivé avec un ?code=XXX, on vérifie sa validité
  useEffect(() => {
    if (!codeFromUrl) return;
    fetch(`/api/referrals?code=${encodeURIComponent(codeFromUrl)}`)
      .then((r) => r.json())
      .then(setCodeCheck)
      .catch(() => setCodeCheck({ valid: false, reason: "error" }));
  }, [codeFromUrl]);

  // Charge l'historique referrals si authentifié
  async function loadRefs() {
    if (!isAuthenticated) return;
    const r = await fetch("/api/referrals");
    if (r.ok) {
      const d = await r.json();
      setRefs(d.referrals ?? []);
    }
  }
  useEffect(() => { loadRefs(); }, [isAuthenticated]);

  async function generate() {
    setBusy(true);
    try {
      const r = await fetch("/api/referrals", { method: "POST" });
      if (r.ok) await loadRefs();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(code: string) {
    const url = referralInviteUrl(code, locale);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  // Programme désactivé globalement
  if (!settingsEnabled) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-6 text-[14px] text-amber-200">
        {strings.disabled}
      </div>
    );
  }

  // Cas : visiteur arrivé avec un code d'invitation
  if (codeFromUrl && codeCheck) {
    if (codeCheck.valid) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
            <div className="mb-2 inline-flex items-center gap-2 text-[12px] uppercase tracking-wider text-emerald-300">
              <Gift className="size-3.5" />
              {strings.code_valid_invited_by} <strong className="text-emerald-100">{codeCheck.referrer}</strong>
            </div>
            <p className="text-[14px] text-zinc-200">
              {locale === "fr"
                ? `À votre première souscription à un plan payant, vous recevez ${rewardMonths} mois offert. Votre parrain aussi.`
                : `On your first paid subscription, you'll get ${rewardMonths} month free. Your sponsor too.`}
            </p>
          </div>
          <a
            href={locale === "fr" ? "/fr/pricing" : "/pricing"}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-[14px] font-medium text-violet-100 transition-all hover:scale-[1.02] hover:bg-violet-500/25"
          >
            {locale === "fr" ? "Voir les plans" : "See plans"}
            <Send className="size-3.5" />
          </a>
        </div>
      );
    } else {
      return (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-5 text-[14px] text-rose-200">
          {strings.code_invalid}
        </div>
      );
    }
  }

  // Cas : pas authentifié, prompt sign-in
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <HowItWorks strings={strings} />
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-5 text-[14px] text-violet-200">
          {strings.signin_required}{" "}
          <a
            href={`/?auth=signin&next=${encodeURIComponent(locale === "fr" ? "/fr/parrainage" : "/parrainage")}`}
            className="underline"
          >
            {locale === "fr" ? "Se connecter" : "Sign in"}
          </a>
        </div>
      </div>
    );
  }

  // Cas : authentifié, peut générer un code
  return (
    <div className="space-y-8">
      <HowItWorks strings={strings} />

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-6">
        <div className="mb-1 inline-flex items-center gap-2 text-[12px] uppercase tracking-wider text-violet-300">
          <Sparkles className="size-3.5" />
          {bannerText}
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-[14px] font-medium text-violet-100 transition-all hover:scale-[1.02] hover:bg-violet-500/25 disabled:opacity-50"
        >
          <Gift className="size-3.5" />
          {strings.cta_generate}
        </button>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {strings.history_title} {refs.length > 0 && <span>({refs.length})</span>}
        </h2>
        {refs.length === 0 ? (
          <p className="text-[13px] text-zinc-500">{strings.history_empty}</p>
        ) : (
          <ul className="space-y-2">
            {refs.map((r) => {
              const url = referralInviteUrl(r.code, locale);
              const statusLabel = (
                {
                  pending: strings.status_pending,
                  signed_up: strings.status_signed_up,
                  subscribed: strings.status_subscribed,
                  rewarded: strings.status_rewarded,
                  expired: strings.status_expired,
                  invalid: strings.status_invalid,
                } as const
              )[r.status];
              const statusColor = (
                {
                  pending: "text-zinc-400",
                  signed_up: "text-cyan-300",
                  subscribed: "text-amber-300",
                  rewarded: "text-emerald-300",
                  expired: "text-zinc-500",
                  invalid: "text-rose-300",
                } as const
              )[r.status];
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-white/8 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-[14px] font-semibold text-zinc-100">{r.code}</div>
                    <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-zinc-400 hover:border-white/25"
                    >
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                    <button
                      onClick={() => copyLink(r.code)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-zinc-300 hover:border-white/25"
                    >
                      {copied === r.code ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          {strings.cta_copied}
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          {strings.cta_copy}
                        </>
                      )}
                    </button>
                    <span className="ml-auto text-[10.5px] text-zinc-500">
                      {strings.expires_in} {new Date(r.expires_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function HowItWorks({ strings }: { strings: Strings }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
        {strings.how_it_works}
      </h2>
      <ol className="space-y-2 text-[13.5px] text-zinc-300">
        <li className="flex gap-3">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-mono text-[11px] font-semibold text-violet-200">1</span>
          {strings.step1}
        </li>
        <li className="flex gap-3">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-mono text-[11px] font-semibold text-violet-200">2</span>
          {strings.step2}
        </li>
        <li className="flex gap-3">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-mono text-[11px] font-semibold text-violet-200">3</span>
          {strings.step3}
        </li>
      </ol>
    </div>
  );
}
