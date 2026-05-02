"use client";

import { useState, useTransition, useEffect } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  toggleCompanyFavorite,
  toggleKpiFavorite,
  isCompanyFavorited,
  isKpiFavorited,
} from "@/app/favorites/actions";

/**
 * Bouton étoile générique — favori sté ou favori KPI.
 *
 * Behavior :
 *   - Au mount, fetch le statut de favori côté serveur (RLS-protected)
 *   - Click : optimistic toggle, rollback si server fail
 *   - Si non connecté : redirige vers /login?next=...
 */
type Props = {
  ticker: string;
  size?: "sm" | "md";
  /** Empêche le click de bubbler vers un éventuel parent <Link>. */
  stopPropagation?: boolean;
} & (
  | { mode: "company"; kpiShort?: never; isSuper?: never }
  | { mode: "kpi"; kpiShort: string; isSuper?: boolean }
);

export function StarButton(props: Props) {
  const { ticker, mode, size = "sm", stopPropagation } = props;
  const [favorited, setFavorited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fav =
        mode === "company"
          ? await isCompanyFavorited(ticker)
          : await isKpiFavorited(ticker, props.kpiShort);
      if (!cancelled) {
        setFavorited(fav);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, mode, mode === "kpi" ? props.kpiShort : null]);

  const dim = size === "sm" ? "size-3.5" : "size-4";
  const padding = size === "sm" ? "p-1" : "p-1.5";

  const onClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const res =
        mode === "company"
          ? await toggleCompanyFavorite(ticker)
          : await toggleKpiFavorite(ticker, props.kpiShort, props.isSuper ?? false);
      if (!res.ok) {
        setFavorited(!next);
        if (res.error === "Non connecté") {
          const back =
            typeof window !== "undefined" ? window.location.pathname : "/";
          router.push(`/?auth=signin&next=${encodeURIComponent(back)}`);
        }
      } else if (typeof res.favorited === "boolean") {
        setFavorited(res.favorited);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending || !loaded}
      aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`inline-flex items-center justify-center rounded-md transition-all ${padding} ${
        !loaded
          ? "opacity-30"
          : favorited
          ? "text-amber-300 hover:bg-amber-500/15"
          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      }`}
      title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Star
        className={`${dim} ${favorited ? "fill-amber-300" : ""}`}
        strokeWidth={favorited ? 1.5 : 2}
      />
    </button>
  );
}
