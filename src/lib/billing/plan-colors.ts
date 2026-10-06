/**
 * Source unique des couleurs des forfaits : utilisee par la page publique
 * (pricing-cards.tsx) ET par l apercu du back-office pricing. Modifier ici
 * change les deux.
 */
export type PlanTierKey = "free" | "premium" | "max";

export const PLAN_COLORS = {
  premiumButton: "#7C3AED",
  premiumButtonHover: "#6D28D9",
  buttonText: "#FFFFFF",
  maxGold: "#FBBF24",
  freeName: "#A1A1AA",
  /** Bordure Max : or a 35 % d opacite. */
  maxBorderRgba: "rgba(251,191,36,0.35)",
} as const;

export type PlanColorSpec = {
  name: { label: string; hex: string };
  border: { label: string; hex: string };
  button: { label: string; hex: string; text: string; hover?: string; outline?: boolean };
  badge: { label: string; hex: string; gradient?: boolean } | null;
};

/** Couleurs reellement affichees sur la page publique pour un forfait. */
export function planColorSpec(tier: PlanTierKey, accent: string): PlanColorSpec {
  const C = PLAN_COLORS;
  if (tier === "premium") {
    return {
      name: { label: "Nom", hex: accent },
      border: { label: "Bordure (accent du forfait, 40 %)", hex: accent },
      button: { label: "Bouton plein", hex: C.premiumButton, text: C.buttonText, hover: C.premiumButtonHover },
      badge: { label: "Badge Recommande", hex: accent },
    };
  }
  if (tier === "max") {
    return {
      name: { label: "Nom", hex: C.maxGold },
      border: { label: "Bordure (or, 35 %)", hex: C.maxGold },
      button: { label: "Bouton contour", hex: C.maxGold, text: C.maxGold, outline: true },
      badge: { label: "Badge Pro (degrade ambre)", hex: C.maxGold, gradient: true },
    };
  }
  return {
    name: { label: "Nom", hex: C.freeName },
    border: { label: "Bordure (neutre, blanc 8 %)", hex: "#FFFFFF14" },
    button: { label: "Bouton neutre", hex: "#FFFFFF0A", text: "#E4E4E7" },
    badge: null,
  };
}
