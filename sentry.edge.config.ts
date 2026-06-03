// Yann 4 juin 2026 : Sentry edge runtime (proxy.ts + middlewares).
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
