// Yann 4 juin 2026 : Sentry client-side pour monitoring runtime errors
// avant bascule niveau 0 (prod publique www.mettrik.ai).
//
// Activation : ajouter NEXT_PUBLIC_SENTRY_DSN dans les env vars Vercel.
// Si DSN absent, Sentry ne fait rien (no-op safe).
//
// Free tier : 5k events/mois, suffisant pour 640 stes V1.9.5.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "preview",
    enabled: process.env.NODE_ENV === "production",
  });
}
