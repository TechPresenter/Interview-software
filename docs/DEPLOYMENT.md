# Deployment guide

## 1. Environments

| Var group | Where | Notes |
|-----------|-------|-------|
| Server `.env` | `server/.env` | copy from `server/.env.example` |
| Client env | `client/.env.local` | `NEXT_PUBLIC_*` only (exposed to browser) |
| Secrets | Vault / platform secret store | never commit; rotate `JWT_*` periodically |

Required server secrets: `MONGO_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ANTHROPIC_API_KEY` (+ SMTP / payment keys per phase).

## 2. Local with Docker

```bash
cp server/.env.example server/.env   # fill secrets
docker-compose up --build            # mongo, redis, api, web
# seed the first super-admin:
docker-compose exec api npm run seed
```

- API → http://localhost:5000/api/v1
- Web → http://localhost:3000

## 3. Production topology

```
            ┌── CDN / Vercel ──┐         ┌── Container host (ECS / Fly / Render) ──┐
 Browser ──▶│  Next.js (web)   │──HTTPS──▶│  Express API (N replicas)              │
            └──────────────────┘  WSS     │  Socket.IO + Redis adapter            │
                                          └───────┬───────────────┬───────────────┘
                                       MongoDB Atlas        Redis (managed)
```

- **Frontend**: deploy `client/` to Vercel (or the provided Dockerfile). Set
  `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` to the API’s public URL.
- **API**: run the `server/` image behind a load balancer. Because Socket.IO uses
  the Redis adapter, you can run multiple replicas. Enable sticky sessions only if
  you disable websockets fallback.
- **MongoDB**: Atlas with `autoIndex: false` in prod — create indexes via a
  migration/ops step (the models declare them; run `Model.syncIndexes()` in a
  one-off job).
- **Redis**: managed (ElastiCache / Upstash). Used for refresh tokens, OTP codes,
  rate limiting, caching, and Socket.IO pub/sub.

## 4. CI/CD (GitHub Actions)

The pipeline lives at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- **server** — `npm ci`, lint, `npm test` (vitest) with CI env secrets.
- **client** — `npm ci`, lint, `next build`.
- **docker** — builds both images on `main` (extend with a push/deploy step for
  your registry + host).

Run tests locally:
```bash
cd server && npm test          # vitest unit suite
```

## 5. Hardening checklist (prod)

- [ ] `NODE_ENV=production`, strong unique `JWT_*` secrets
- [ ] HTTPS everywhere; secure cookies (`config.isProd` already toggles `secure`)
- [ ] CORS locked to the real `CLIENT_URL`
- [ ] Rate limits tuned; auth endpoints throttled (already wired)
- [ ] MongoDB auth + network allowlist; Redis password/TLS
- [ ] Backups: Mongo automated snapshots; test restore
- [ ] Error monitoring (Sentry) + log shipping (pino → collector)
- [ ] Payment webhooks verified with provider signing secrets
- [ ] Rotate `ANTHROPIC_API_KEY`; set per-company AI quotas (AiUsage)

## 6. Observability

- `GET /health` for liveness/readiness probes.
- pino JSON logs in prod (ship to Loki/Datadog/CloudWatch).
- **Sentry**: set `SENTRY_DSN` to enable error monitoring — the SDK loads lazily
  (`services/observability.js`) and 5xx errors are auto-captured in the central
  error handler. No DSN ⇒ fully no-op.
- `AiUsage` + `AuditLog` collections provide product/security analytics.

## 7. Performance / a11y / SEO

- Public `/content/*` responses send `Cache-Control` (CDN-cacheable); responses
  are gzip-compressed.
- Frontend honors `prefers-reduced-motion`, ships a skip-to-content link, and
  uses `:focus-visible` rings.
- `client/src/app/sitemap.ts` + `robots.ts` generate `/sitemap.xml` and
  `/robots.txt`; `/dashboard` and `/interview` are disallowed from indexing.
