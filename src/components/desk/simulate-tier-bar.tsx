"use client";

/**
 * @deprecated Remplacé par AdminFloatingPanel (bottom-right de l'app). Ce composant
 * n'est plus utilisé dans desk-mtk9x4kp/client.tsx depuis le 19 mai 2026. Conservé
 * temporairement comme référence pour la logique de detection de niveau / cookies.
 * À supprimer une fois AdminFloatingPanel stable.
 *
 * SimulateTierBar — toggle admin "view as" un autre tier (Yann 18 mai 2026).
 *
 * Affichée en haut de /desk-mtk9x4kp uniquement en niveau 1/2/3 (cachée
 * en prod niveau 0 par sécurité).
 *
 * Permet de simuler chaque type de session :
 *   - Anonyme (utilisateur non connecté, première visite)
 *   - Gratuit
 *   - Premium
 *   - Max
 *
 * Quand on choisit un tier, un cookie `mettrik:simulate-as` est posé
 * et la page se recharge. Tous les composants Server + Client lisent
 * ce cookie via `getEffectiveTier()` / `useEffectiveTier()` et rendent
 * comme si l'user était de ce tier.
 *
 * En niveau 0 (prod), le cookie est toujours ignoré côté helper → cette
 * barre est aussi cachée par sécurité (rien ne s'affiche).
 */

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSimulatedTier, setSimulateTier } from "@/lib/desk/use-effective-tier";
import type { EffectiveTier } from "@/lib/desk/effective-tier-shared";

function detectLevel(): 0 | 1 | 2 | 3 {
  if (typeof window === "undefined") return 0;
  const h = window.location.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return 3;
  if (h === "mettrik.ai" || h === "www.mettrik.ai") return 0;
  if (h.startsWith("mettrik-niveau1") || h.startsWith("niveau1.")) return 1;
  if (h.endsWith(".vercel.app")) return 2;
  return 0;
}

const TIER_OPTIONS: Array<{ value: EffectiveTier; label: string; desc: string }> = [
  { value: "anonymous", label: "Anonyme", desc: "Première visite, pas de compte" },
  { value: "free", label: "Gratuit", desc: "Inscrit + plan Gratuit" },
  { value: "premium", label: "Premium", desc: "Inscrit + plan Premium" },
  { value: "max", label: "Max", desc: "Inscrit + plan Max" },
];

export function SimulateTierBar() {
  const sim = useSimulatedTier();
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLevel(detectLevel());
  }, []);

  // Caché en niveau 0 (prod) par sécurité
  if (level === 0) return null;

  const active = sim !== null;
  const activeLabel =
    sim ? TIER_OPTIONS.find((o) => o.value === sim)?.label ?? sim : null;

  return (
    <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/[0.04] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-violet-200">
          {active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          Voir l&apos;app comme :
        </span>
        <select
          value={sim ?? ""}
          onChange={(e) => {
            const v = e.target.value as EffectiveTier | "";
            setSimulateTier(v === "" ? null : v);
          }}
          className="rounded-md border border-white/15 bg-[#0c0c10] px-2 py-1 text-[12px] text-zinc-100 focus:border-violet-400 focus:outline-none"
        >
          <option value="">(moi-même = admin réel)</option>
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.desc}
            </option>
          ))}
        </select>
        {active && (
          <button
            onClick={() => setSimulateTier(null)}
            className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300 hover:border-white/30 hover:text-zinc-100"
            type="button"
          >
            Désactiver
          </button>
        )}
        {active && activeLabel && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-violet-100">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(167,139,250,0.7)]" />
            Simulation : {activeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          {open ? "Masquer aide" : "?"}
        </button>
      </div>
      {open && (
        <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-zinc-400">
          Cette barre n&apos;apparaît qu&apos;en niveau 1 / 2 / 3. En prod (niveau 0),
          la simulation est désactivée côté serveur même si ce cookie était posé.
          Tu peux ouvrir plusieurs onglets niveau 1 avec des simulations différentes,
          chaque onglet est indépendant.
        </div>
      )}
    </div>
  );
}
