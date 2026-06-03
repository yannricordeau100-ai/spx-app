// Yann 4 juin 2026 : Sentry server-side (SSR errors + API routes).
// Activation : SENTRY_DSN dans env vars Vercel. Si DSN absent, no-op safe.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || "preview",
    enabled: process.env.NODE_ENV === "production",
  });
}
