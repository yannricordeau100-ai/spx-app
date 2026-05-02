"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";

/**
 * Banner discret en haut de la home.
 *
 * S'affiche quand l'URL contient `?next=<chemin>` (= l'user a cliqué un
 * lien protégé alors qu'il n'était pas connecté, et le proxy l'a renvoyé
 * sur la home). Au lieu d'ouvrir la modal de connexion en pleine face
 * (ce que faisait l'ancien comportement avec `?auth=signin&next=…`), on
 * propose juste un bouton "Connexion" que l'user clique quand il veut.
 *
 * Si l'user ferme le banner, il est dismissable (juste rerender, le
 * `?next=` reste dans l'URL au cas où il change d'avis).
 */
export function AuthRequiredBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const next = params.get("next");

  if (!next || dismissed) return null;
  // On évite le banner si l'URL fait déjà partie de la modal flow.
  if (params.get("auth")) return null;

  // Si "next" pointe sur "/", pas de banner (rien à présenter).
  if (next === "/") return null;

  // Label friendly pour la cible : extrait du chemin (ex: /googl → "Google")
  const labelFromNext = (n: string): string => {
    const seg = n.split("/").filter(Boolean)[0] ?? "";
    if (!seg) return "cette page";
    if (/^[a-z]{2,5}$/i.test(seg)) return seg.toUpperCase();
    return seg;
  };

  const target = labelFromNext(next);

  const openModal = () => {
    const sp = new URLSearchParams(params.toString());
    sp.set("auth", "signin");
    router.push(`/?${sp.toString()}`);
  };

  const dismiss = () => {
    setDismissed(true);
    const sp = new URLSearchParams(params.toString());
    sp.delete("next");
    const qs = sp.toString();
    router.replace(qs ? `/?${qs}` : "/");
  };

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <div className="flex max-w-2xl flex-1 items-center gap-3 rounded-full border border-violet-400/30 bg-[#0a0a0e]/90 px-4 py-2 shadow-[0_8px_32px_-8px_rgba(139,92,246,0.45)] backdrop-blur-md">
        <Lock className="size-4 shrink-0 text-violet-300" />
        <p className="flex-1 truncate text-[13px] text-zinc-200">
          Connecte-toi pour accéder à{" "}
          <span className="font-semibold text-violet-200">{target}</span>.
        </p>
        <button
          type="button"
          onClick={openModal}
          className="shrink-0 rounded-full bg-violet-500/90 px-3 py-1 text-[12.5px] font-semibold text-white transition-colors hover:bg-violet-400"
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 rounded-full p-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
