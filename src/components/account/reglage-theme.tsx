"use client";

/**
 * Yann 13 oct 2026 : le reglage Jour/Nuit quitte le rail des fiches pour la
 * page compte. Deux grands boutons, adaptes a l ordinateur et au mobile. La
 * logique reste celle du ThemeToggle du site (monte hors ecran) : stockage
 * local, preference du compte, et mode jour reserve aux abonnes.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sun, Moon, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "light" | "dark";

export function ReglageTheme({ paid }: { paid: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("dark");
  useEffect(() => {
    const html = document.documentElement;
    const lire = () => setMode(html.getAttribute("data-theme") === "light" ? "light" : "dark");
    lire();
    const mo = new MutationObserver(lire);
    mo.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const choisir = (m: Mode) => {
    if (m === "light" && !paid) return;
    const cible = m === "light" ? "Mode clair" : "Mode sombre";
    ref.current?.querySelector<HTMLButtonElement>(`button[aria-label="${cible}"]`)?.click();
  };

  const bouton = (m: Mode, titre: string, Icon: typeof Sun, verrou: boolean) => {
    const on = mode === m;
    return (
      <button
        type="button"
        onClick={() => choisir(m)}
        aria-pressed={on}
        aria-disabled={verrou || undefined}
        className={`relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
          on
            ? "bg-violet-500 text-white shadow-[0_0_14px_rgba(167,139,250,0.45)]"
            : verrou
              ? "cursor-not-allowed text-zinc-500"
              : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {titre}
        {verrou && <Lock className="size-3.5 shrink-0 text-zinc-500" aria-label="Réservé aux abonnés" />}
      </button>
    );
  };

  return (
    <div>
      <div className="flex w-full max-w-sm gap-1 rounded-xl border border-[#262626] bg-[#0c0c0c] p-1">
        {bouton("light", "Jour", Sun, !paid)}
        {bouton("dark", "Nuit", Moon, false)}
      </div>
      {!paid && (
        <p className="mt-3 text-[12.5px] leading-snug text-zinc-400">
          Le mode jour est réservé aux abonnés.{" "}
          <Link href="/pricing" className="font-semibold text-violet-300 hover:text-violet-200">
            Voir les offres
          </Link>
        </p>
      )}
      {/* Le vrai ThemeToggle, hors ecran : il applique et enregistre le mode. */}
      <div ref={ref} aria-hidden className="fixed -left-[400vw] top-0">
        <ThemeToggle paid={paid} />
      </div>
    </div>
  );
}
