"use client";

/**
 * CurrencyPicker — petit sélecteur de devise.
 * Pose le cookie `mettrik:currency` côté client puis recharge la page.
 *
 * Yann 13 mai 2026 : ajouté car la géo-IP automatique ne pouvait pas
 * être corrigée par l'utilisateur. Désormais il peut forcer la devise
 * pour staging et prod.
 */
import { useState, useTransition } from "react";

const CURRENCIES: Array<{ code: string; symbol: string; label: string }> = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "Dollar US" },
  { code: "GBP", symbol: "£", label: "Livre" },
  { code: "CHF", symbol: "CHF", label: "Franc suisse" },
  { code: "SEK", symbol: "kr", label: "Couronne suédoise" },
  { code: "DKK", symbol: "kr", label: "Couronne danoise" },
  { code: "CAD", symbol: "$", label: "Dollar canadien" },
];

export function CurrencyPicker({ current = "EUR" }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = CURRENCIES.find((c) => c.code === current) ?? CURRENCIES[0];

  function pick(code: string) {
    // Cookie 1 an
    document.cookie = `mettrik:currency=${code}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax`;
    setOpen(false);
    startTransition(() => {
      // Reload pour que le SSR refasse loadPricingCatalog avec la nouvelle devise
      window.location.reload();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-[#0a0a0e] px-2.5 py-1.5 text-[12px] font-medium text-zinc-200 transition-colors hover:border-violet-500/40 hover:text-violet-100 disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Changer la devise affichée"
      >
        <span className="font-mono text-[11px] text-zinc-400">{selected.symbol}</span>
        <span>{selected.code}</span>
        <svg viewBox="0 0 12 12" className="size-3 text-zinc-500"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border border-zinc-700 bg-[#0a0a0e] py-1 shadow-xl"
        >
          {CURRENCIES.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => pick(c.code)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-violet-500/10 hover:text-violet-100 ${c.code === current ? "text-violet-300" : "text-zinc-300"}`}
              >
                <span>
                  <span className="mr-1.5 inline-block w-7 font-mono text-zinc-500">{c.symbol}</span>
                  {c.code}
                </span>
                <span className="text-[10px] text-zinc-500">{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
