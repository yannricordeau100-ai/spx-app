# Mettrik AI

**KPI Intelligence pour investisseurs.**

App Next.js 16 + React 19 + Tailwind v4 + Supabase + Stripe.
Domaine : [mettrik.ai](https://mettrik.ai)

## Lancer en local

```bash
npm install
npm run dev    # http://localhost:3000
```

## Stack

- **Front** : Next.js 16 (Turbopack), React 19, Tailwind v4, motion/react, recharts
- **Back** : Supabase (Postgres + Auth), Stripe (billing), Resend (emails)
- **Data** : SEC EDGAR (filings 10-K / 10-Q / 8-K), yfinance (prix / earnings dates), pipeline LLM Cerebras / Haiku

## Documentation interne

- [CLAUDE.md](CLAUDE.md) : contexte projet, conventions, vocabulaire, état actuel
- [RULES-GOLDEN.md](RULES-GOLDEN.md) : règles d'or non-négociables
- [SHARED-STATUS.md](SHARED-STATUS.md) : coordination entre les 5 conversations Claude
- [HANDOFF.md](HANDOFF.md) : procédure de reprise pour une nouvelle session

## Déploiement

Vercel : [mettrik.ai](https://mettrik.ai) (prod, branche `main`) · [mettrik-staging.vercel.app](https://mettrik-staging.vercel.app) (branche `staging`).
