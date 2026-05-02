/**
 * Traducteur des messages d'erreur Supabase Auth (renvoyés en anglais par
 * l'API) vers FR / EN selon la locale active.
 *
 * Stratégie : matching robuste sur la sous-chaîne anglaise canonique
 * (Supabase peut légèrement varier la formulation entre versions). Si pas
 * de match, on renvoie le message original.
 *
 * Usage côté serveur (server actions, route handlers) :
 *
 *   import { translateAuthError } from "@/lib/auth-errors";
 *   const msg = translateAuthError(error.message, locale);
 */

export type Locale = "fr" | "en";

type Rule = {
  /** Sous-chaîne (insensible à la casse) qu'on cherche dans le message Supabase. */
  match: string;
  fr: string;
  en: string;
};

const RULES: Rule[] = [
  {
    match: "should be different from the old password",
    fr: "Le nouveau mot de passe doit être différent de l'ancien.",
    en: "Your new password must be different from your previous one.",
  },
  {
    match: "Password should be at least",
    fr: "Le mot de passe doit contenir au moins 8 caractères.",
    en: "Password must be at least 8 characters long.",
  },
  {
    match: "Invalid login credentials",
    fr: "Email ou mot de passe incorrect.",
    en: "Incorrect email or password.",
  },
  {
    match: "User already registered",
    fr: "Un compte existe déjà avec cet email.",
    en: "An account already exists with this email.",
  },
  {
    match: "Email not confirmed",
    fr: "Email non confirmé. Vérifie ta boîte de réception.",
    en: "Email not confirmed. Please check your inbox.",
  },
  {
    match: "Email rate limit exceeded",
    fr: "Trop de tentatives. Réessaie dans quelques minutes.",
    en: "Too many attempts. Please retry in a few minutes.",
  },
  {
    match: "Token has expired",
    fr: "Ce lien a expiré. Demande-en un nouveau.",
    en: "This link has expired. Please request a new one.",
  },
  {
    match: "rate limit",
    fr: "Limite de requêtes atteinte. Réessaie dans quelques minutes.",
    en: "Rate limit reached. Please retry in a few minutes.",
  },
  {
    match: "User not found",
    fr: "Aucun compte trouvé avec cet email.",
    en: "No account found with this email.",
  },
  {
    match: "Signup is disabled",
    fr: "Les inscriptions sont temporairement désactivées.",
    en: "Sign-ups are temporarily disabled.",
  },
  {
    match: "weak password",
    fr: "Mot de passe trop faible. Utilise au moins 8 caractères, lettres et chiffres.",
    en: "Password too weak. Use at least 8 characters with letters and numbers.",
  },
  {
    match: "Unable to validate email address",
    fr: "Email invalide. Vérifie le format.",
    en: "Invalid email. Please check the format.",
  },
];

/**
 * Traduit un message d'erreur Supabase vers la locale demandée.
 * Si aucune règle ne matche, retourne le message original (mieux qu'un blanc).
 */
export function translateAuthError(rawMessage: string | undefined | null, locale: Locale = "fr"): string {
  if (!rawMessage) return locale === "fr" ? "Une erreur s'est produite." : "An error occurred.";
  const lower = rawMessage.toLowerCase();
  for (const rule of RULES) {
    if (lower.includes(rule.match.toLowerCase())) {
      return locale === "fr" ? rule.fr : rule.en;
    }
  }
  return rawMessage;
}

/**
 * Helper pour les server actions : reçoit l'erreur Supabase + la locale,
 * renvoie le message déjà traduit, encodé pour l'URL.
 */
export function authErrorParam(rawMessage: string | undefined | null, locale: Locale = "fr"): string {
  return encodeURIComponent(translateAuthError(rawMessage, locale));
}
