"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { type CurrencyCode, PRICING_DISPLAY, formatPrice } from "@/lib/billing/products";

/**
 * Pricing checkout client wrapper. Détecte la devise via le pays du visiteur
 * (header `x-vercel-ip-country` côté server, mais en client on lit
 * `navigator.language` + `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * comme proxy). L'user peut override avec le sélecteur de devise.
 *
 * CTA "Choisir Premium" → POST /api/billing/checkout {plan, currency} →
 * redirect vers Stripe Checkout. Si non connecté → redirect vers /signup
 * avec next param.
 */

const CURRENCY_LABELS: Record<CurrencyCode, { code: string; flag: string; name: string }> = {
  eur: { code: "EUR", flag: "🇪🇺", name: "Euro" },
  usd: { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  gbp: { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  chf: { code: "CHF", flag: "🇨🇭", name: "Swiss Franc" },
  sek: { code: "SEK", flag: "🇸🇪", name: "Swedish Krona" },
  dkk: { code: "DKK", flag: "🇩🇰", name: "Danish Krone" },
  cad: { code: "CAD", flag: "🇨🇦", name: "Canadian Dollar" },
};

// Heuristique côté client : devine la devise depuis navigator.language ou
// Intl timezone. Override par le serveur via x-vercel-ip-country côté API
// (la source de vérité finale).
function guessLocalCurrency(): CurrencyCode {
  if (typeof navigator === "undefined") return "eur";
  const lang = (navigator.language || "").toLowerCase();
  // navigator.language exemples : "fr-FR", "en-US", "de-CH", "sv-SE", "da-DK", "en-GB", "en-CA"
  const map: Record<string, CurrencyCode> = {
    "us": "usd", "ca": "cad", "gb": "gbp", "ch": "chf",
    "se": "sek", "dk": "dkk",
    "fr": "eur", "be": "eur", "lu": "eur", "de": "eur", "at": "eur",
    "nl": "eur", "ie": "eur", "it": "eur", "es": "eur", "pt": "eur", "fi": "eur",
  };
  for (const [k, v] of Object.entries(map)) {
    if (lang.endsWith(`-${k}`) || lang === k) return v;
  }
  return "eur";
}

export function CurrencySelector({
  value,
  onChange,
}: {
  value: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-300">
      <span aria-hidden>{CURRENCY_LABELS[value].flag}</span>
      <span className="font-mono text-[11px] text-zinc-400">Devise :</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CurrencyCode)}
        className="bg-transparent font-medium text-zinc-100 outline-none"
        aria-label="Sélectionner la devise"
      >
        {(Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((c) => (
          <option key={c} value={c} className="bg-[#0a0a0a]">
            {CURRENCY_LABELS[c].code} · {CURRENCY_LABELS[c].name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PricingDisplay({
  plan,
  currency,
}: {
  plan: "premium_monthly" | "premium_annual";
  currency: CurrencyCode;
}) {
  const amount = plan === "premium_monthly" ? PRICING_DISPLAY[currency].month : PRICING_DISPLAY[currency].year;
  const unit = plan === "premium_monthly" ? "/ mois" : "/ an";
  return (
    <span className="font-display text-[36px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
      {formatPrice(amount, currency, currency === "eur" ? "fr-FR" : "en-US")}
      <span className="ml-1 text-[13px] font-normal text-zinc-400">{unit}</span>
    </span>
  );
}

export function CheckoutButton({
  plan,
  currency,
  label,
  className,
}: {
  plan: "premium_monthly" | "premium_annual";
  currency: CurrencyCode;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, currency }),
      });
      if (r.status === 401) {
        // Pas connecté : redirect vers signup avec memory du plan choisi
        router.push(`/signup?next=${encodeURIComponent("/pricing?selected=" + plan)}`);
        return;
      }
      const data = await r.json();
      if (!r.ok || !data.url) {
        setErr(data.error ?? "Erreur checkout");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          className ??
          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_0_18px_rgba(167,139,250,0.4)] transition-all hover:bg-violet-400 disabled:opacity-60"
        }
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {busy ? "Chargement…" : label}
      </button>
      {err && <p className="mt-2 text-[11.5px] text-rose-300">{err}</p>}
    </div>
  );
}

/**
 * Bloc autonome combinant CurrencySelector + 2 cards Premium (mensuel +
 * annuel) avec pricing dynamique. À insérer dans /pricing à la place des
 * 2 cards Premium hardcodées.
 */
export function PricingBlock() {
  const [currency, setCurrency] = useState<CurrencyCode>("eur");
  useEffect(() => {
    setCurrency(guessLocalCurrency());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <CurrencySelector value={currency} onChange={setCurrency} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* MENSUEL */}
        <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">Premium mensuel</h3>
          <p className="mt-1 text-[13px] text-zinc-400">
            Annulation 1 clic, effet en fin de période.
          </p>
          <div className="mt-5">
            <PricingDisplay plan="premium_monthly" currency={currency} />
          </div>
          <div className="mt-6 flex-1" />
          <CheckoutButton plan="premium_monthly" currency={currency} label="Choisir mensuel" />
        </div>

        {/* ANNUEL */}
        <div className="relative flex flex-col rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/8 to-violet-500/2 p-6 shadow-[0_0_24px_rgba(167,139,250,0.15)]">
          <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/20 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-violet-200">
            ★ Économise 37 %
          </span>
          <h3 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">Premium annuel</h3>
          <p className="mt-1 text-[13px] text-zinc-400">
            Mêmes fonctionnalités, payé en une fois.
          </p>
          <div className="mt-5">
            <PricingDisplay plan="premium_annual" currency={currency} />
          </div>
          <div className="mt-6 flex-1" />
          <CheckoutButton plan="premium_annual" currency={currency} label="Choisir annuel" />
        </div>
      </div>
    </div>
  );
}
