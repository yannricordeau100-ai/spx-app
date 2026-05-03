/**
 * Helpers parrainage : génération de code, validation, etc.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas de 0/O/1/I (anti-confusion)

/**
 * Génère un code court lisible : "MTK-AB12CD". Préfixe MTK pour rendre la marque
 * visible dès le code partagé. 6 chars random après le tiret.
 */
export function generateReferralCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MTK-${s}`;
}

export type ReferralStatus =
  | "pending"
  | "signed_up"
  | "subscribed"
  | "rewarded"
  | "expired"
  | "invalid";

export type Referral = {
  id: string;
  referrer_email: string;
  referee_email: string | null;
  code: string;
  status: ReferralStatus;
  created_at: string;
  signed_up_at: string | null;
  subscribed_at: string | null;
  rewarded_at: string | null;
  expires_at: string;
  reward_applied_referrer: boolean;
  reward_applied_referee: boolean;
  notes: string | null;
};

export type ReferralSettings = {
  enabled: boolean;
  reward_months: number;
  required_plan: "any_paid" | "monthly_only" | "annual_only";
  max_referees_per_user: number;
  code_validity_days: number;
  banner_text_fr: string;
  banner_text_en: string;
  updated_at: string;
  updated_by: string | null;
};

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: true,
  reward_months: 1,
  required_plan: "any_paid",
  max_referees_per_user: 50,
  code_validity_days: 90,
  banner_text_fr: "Parrainez un proche, vous gagnez 1 mois offert chacun.",
  banner_text_en: "Invite a friend, both get 1 month free.",
  updated_at: new Date().toISOString(),
  updated_by: null,
};

/** Construit l'URL d'invitation à partager. */
export function referralInviteUrl(code: string, locale: "fr" | "en" = "fr"): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mettrik.ai";
  const path = locale === "fr" ? "/fr/parrainage" : "/parrainage";
  return `${base}${path}?code=${encodeURIComponent(code)}`;
}
