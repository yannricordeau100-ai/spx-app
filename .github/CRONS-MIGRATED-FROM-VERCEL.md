# Crons migrés Vercel → GitHub Actions

Yann 18 mai 2026, bascule niveau 1.

Vercel Hobby tier limite 2 crons. Le projet en avait 3 → 2 migrés vers GitHub Actions, 1 reste sur Vercel.

## Cron resté sur Vercel

| Path | Schedule | Pourquoi |
|---|---|---|
| `/api/cron/kpi-worker-tick` | `23 4 * * *` | Worker KPI builder, nécessite filesystem serverless Vercel (lit `sec-data/` via symlink). Note : en niveau 1, `sec-data/` n'est pas sur Vercel → worker prod aveugle, fix complet SEC EDGAR online prévu dans 1 semaine. |

## Crons migrés vers GitHub Actions

| Workflow GHA | Schedule | Endpoint pingé |
|---|---|---|
| `.github/workflows/cron-email-onboarding.yml` | `0 9 * * *` | POST `${MAIN_BASE_URL}/api/cron/email-onboarding` avec `Authorization: Bearer $CRON_SECRET` |
| `.github/workflows/cron-quality-snapshot.yml` | `0 21 * * *` | POST `${MAIN_BASE_URL}/api/cron/quality-snapshot` avec `Authorization: Bearer $CRON_SECRET` |

## Comment ré-activer sur Vercel (si upgrade Pro plan future)

Copier dans `vercel.json` :

```json
{
  "crons": [
    { "path": "/api/cron/email-onboarding", "schedule": "0 9 * * *" },
    { "path": "/api/cron/quality-snapshot", "schedule": "0 21 * * *" },
    { "path": "/api/cron/kpi-worker-tick", "schedule": "23 4 * * *" }
  ]
}
```

Et supprimer les 2 workflows GHA correspondants.

## Secrets/Variables GitHub Actions requis

Settings → Secrets and variables → Actions :
- Secret `CRON_SECRET` : même valeur que l'env var Vercel `CRON_SECRET`
- Variable `MAIN_BASE_URL` : `https://mettrik-staging.vercel.app` (ou autre URL ciblée)
