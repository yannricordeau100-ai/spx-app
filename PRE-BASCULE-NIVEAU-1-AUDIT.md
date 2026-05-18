# PRE-BASCULE-NIVEAU-1-AUDIT.md

> Audit complet avant bascule architecture niveau 1.
> Produit par CONV-SYSTEMS le 18 mai 2026 ~13h30 sur la base de 2 inventaires Explore (routes/API + risques externes).

## Inventaire technique

### Routes pages — 70 pages

| Groupe | Nombre | Détail |
|---|---|---|
| Home + auth | 5 | `/`, `/login`, `/signup`, `/account`, `/account/favorites`, `/auth/*` |
| Société | 4 | `/[ticker]` (V1.0, redirige 301), `/chart-lab/[ticker]`, `/sandbox/v1-7/[ticker]`, `/sandbox/v1-8/[ticker]` |
| Sandbox hubs | 7 | `/sandbox`, `/sandbox/v1-{6,7,7-5,8,v2}` |
| Sandbox utilities | 18 | aide, billing, coverage-matrix, data-status, geo-test, i18n-audit, image-findings, ir-coverage, kpi-builder, logo-lab, quality-tree, ready-by-category, special-kpis, top307-breakdown, vip-inspection, visual-audit, sandbox/v1-8/{contact,freshness-audit,pages-toggle,pricing} |
| Desk | 7 | `/desk-mtk9x4kp/*` |
| Concepts | 10 | `/concepts/*` |
| Legal | 5 | `/legal/{cgu,cgv,confidentialite,conditions,mentions}` |
| Divers | 7 | `/admin`, `/contact`, `/email-lab`, `/maintenance`, `/parrainage`, `/populaire-investisseurs`, `/pricing`, `/whoami` |

### API endpoints — 50 endpoints

| Groupe | Nombre |
|---|---|
| `/api/cron/*` | 3 |
| `/api/billing/*` | 11 |
| `/api/desk/*` | 20 |
| `/api/desk-mtk9x4kp/*` | 4 |
| Publiques (stock-prices, contact, vip-inspection, referrals, popular-stocks, version, etc.) | 12 |

### Supabase — 25 tables

`desk_todos`, `desk_bugs`, `desk_email_sequences`, `desk_unsubscribes`, `desk_image_findings_requests`, `desk_image_findings`, `desk_kpi_requests`, `desk_special_kpis`, `desk_page_content`, `desk_ir_sources`, `desk_data_quality_matrix`, `desk_quality_history`, `contact_messages`, `referrals`, `referrals_settings`, `companies_v2`, `pricing_plans`, `pricing_prices`, `pricing_features`, `pricing_plan_features`, `pricing_promos`, `billing_history`, `analytics_events`, `auth.users` (Supabase managed), webhooks Stripe.

### Vercel

- 3 crons → **migrés** (1 reste, 2 sur GitHub Actions désormais)
- `.vercelignore` exclut `sec-data/` (30 GB), `scripts/`, `supabase/`, `email-templates/`, `CLAUDE.md`
- 26 env vars distinctes

### External APIs

| Service | Variable env | Usage |
|---|---|---|
| FMP (4 keys) | `FMP_API_KEY_*` | Stock data + transcripts |
| Groq Llama 3.3 70B | `GROQ_API_KEY` | KPI search tickers + LLM |
| Cerebras | `CEREBRAS_API_KEY` | LLM fallback free tier |
| Anthropic | `ANTHROPIC_API_KEY` | Haiku/Sonnet |
| Resend | `RESEND_API_KEY` | Emails (dry-run niveau 1) |
| Stripe | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Billing |
| frankfurter.app | (gratuit) | Conversion devise ECB |
| Google s2 favicons / Clearbit | (gratuit) | Logos fallback |
| Chrome MCP @mettrik_ai | (compte X) | Image-findings scraping authentifié |

## Risques détectés et résolutions

| # | Risque | Statut | Résolution |
|---|---|---|---|
| 1 | Hardcoded `mettrik.ai` dans proxy.ts maintenance gate | ✅ OK | Gate ciblée par domaine (apex + www uniquement) ; niveau 1 sur `mettrik-niveau1.vercel.app` n'est pas affecté |
| 2 | Hardcoded `/Users/yann/Desktop/...` dans `/api/desk/scan-pdfs/route.ts` | ⚠️ ACCEPTÉ | Route dev-only, non utilisée en niveau 1 |
| 3 | `sec-data/` lu par `kpi-worker-tick` cron | ⚠️ ACCEPTÉ | Worker browser-only en niveau 1 ; fix complet SEC EDGAR online prévu 1 semaine |
| 4 | `Resend` envoie de vrais emails | ✅ FIXÉ | `EMAIL_DRY_RUN=1` env var lue par `src/lib/email/resend.ts` (log uniquement) |
| 5 | Stripe webhook URL hardcodée | ⚠️ ACTION YANN | Reconfigurer webhook Stripe dashboard pour pointer sur `mettrik-niveau1.vercel.app/api/billing/webhook` en mode test |
| 6 | Crons Vercel > limite Hobby 2 | ✅ FIXÉ | 2 crons migrés vers GitHub Actions (`cron-email-onboarding.yml`, `cron-quality-snapshot.yml`) |
| 7 | Routes V1.0 obsolètes `/cat`, `/googl`, ... | ✅ FIXÉ | Redirect 301 vers `/sandbox/v1-7-5/<ticker>` dans proxy.ts |
| 8 | Supabase identique niveau 0/1 | ⚠️ ACTION YANN | Créer projet Supabase niveau 1 séparé (cf liste actions Yann) |
| 9 | DNS / domaine dédié niveau 1 | ✅ OK | `mettrik-niveau1.vercel.app` (domaine Vercel défaut) — pas besoin DNS Spaceship |
| 10 | Typo CONV-DEPAN `@mettrics_ai` au lieu de `@mettrik_ai` | ⚠️ DOCS | À nettoyer dans SHARED-STATUS.md et docs handoff (zéro impact code) |
| 11 | Chrome MCP @mettrik_ai déconnecté | ⚠️ NON BLOQUANT | Image-findings en lecture seule en niveau 1 tant que pas reconnecté |
| 12 | Migrations SQL Supabase (24 fichiers) à appliquer sur l'instance niveau 1 | ⚠️ ACTION YANN | Coller chaque migration dans SQL Editor du nouveau projet Supabase, ordre chrono |
| 13 | env var `NEXT_PUBLIC_NIVEAU` doit être posée correctement par environnement | ✅ FIXÉ | Composant `<LevelBadge>` lit env var + fallback hostname |

## Aucun no-go bloquant détecté

Les 4 actions externes Yann (Supabase clone, Stripe test keys, alias Vercel niveau 1, env vars) sont triviales et listées dans `ACTIONS-YANN-BASCULE-NIVEAU-1.md`.
