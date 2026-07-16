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
- **MongoDB**: Atlas with `autoIndex: false` in prod (see `config/db.js`) — so a
  newly declared index DOES NOT EXIST until something builds it. That step is
  `npm run sync:indexes`, and it belongs in every deploy, before the API
  restarts. Skipping it is silent: the code runs, queries just get slower, and
  any rule that rests on a unique index quietly stops holding — Application's
  "one live application per person" is a pair of partial unique indexes, and
  without them two simultaneous submits both succeed. Add `--dry` to see what is
  missing without building it.

  It calls `createIndexes()`, not `syncIndexes()`: sync DROPS whatever the schema
  no longer declares, which on a live database means dropping the index someone
  added by hand to rescue a slow query. This only ever adds, and reports the rest.
- **Redis**: managed (ElastiCache / Upstash). Used for refresh tokens, OTP codes,
  rate limiting, caching, and Socket.IO pub/sub. Not optional: login, the
  interview room and the settings cache all read it, and the API hangs without it
  rather than failing loudly.

## 4. Updating a running VPS (pm2)

App names come from [`deploy/ecosystem.config.js`](../deploy/ecosystem.config.js).

```bash
cd /root/hiresense && \
git pull origin main && \
(cd server && npm ci && npm run sync:indexes) && \
(cd client && npm ci && npm run build) && \
pm2 restart hiresense-api hiresense-web && \
pm2 save
```

Ordering is the point:

- `sync:indexes` runs **before** the restart, so the new code never serves a
  request against a collection that lacks its indexes. See §3 — prod does not
  build them on boot.
- `npm ci`, not `npm install`: install would quietly resolve a different tree
  than the lockfile CI tested.
- The client is built before the restart because `next build` writes `.next/` in
  place — restarting first serves a half-written build.

Run **once** per new capability, not on every deploy:

```bash
cd server
npm run seed              # first super-admin (fresh install only)
npm run seed:prompts      # AI prompt templates
npm run migrate:questions # question taxonomy backfill
npm run migrate:text-indexes  # rebuild question text indexes with a language override
```

`sync:indexes` covers everything else, is idempotent, and is safe on every
deploy. `--dry` reports what is missing without touching anything.

## 5. CI/CD (GitHub Actions)

The pipeline lives at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- **server** — `npm ci`, lint, `npm test` (vitest) with CI env secrets.
- **client** — `npm ci`, lint, `next build`.
- **docker** — builds both images on `main` (extend with a push/deploy step for
  your registry + host).

Run tests locally:
```bash
cd server && npm test          # vitest unit suite
```

## 6. Hardening checklist (prod)

- [ ] `NODE_ENV=production`, strong unique `JWT_*` secrets
- [ ] HTTPS everywhere; secure cookies (`config.isProd` already toggles `secure`)
- [ ] CORS locked to the real `CLIENT_URL`
- [ ] Rate limits tuned; auth endpoints throttled (already wired)
- [ ] MongoDB auth + network allowlist; Redis password/TLS
- [ ] Backups: Mongo automated snapshots; test restore
- [ ] Error monitoring (Sentry) + log shipping (pino → collector)
- [ ] Payment webhooks verified with provider signing secrets
- [ ] Rotate `ANTHROPIC_API_KEY`; set per-company AI quotas (AiUsage)

## 7. Observability

- `GET /health` for liveness/readiness probes.
- pino JSON logs in prod (ship to Loki/Datadog/CloudWatch).
- **Sentry**: set `SENTRY_DSN` to enable error monitoring — the SDK loads lazily
  (`services/observability.js`) and 5xx errors are auto-captured in the central
  error handler. No DSN ⇒ fully no-op.
- `AiUsage` + `AuditLog` collections provide product/security analytics.

## 8. Performance / a11y / SEO

- Public `/content/*` responses send `Cache-Control` (CDN-cacheable); responses
  are gzip-compressed.
- Frontend honors `prefers-reduced-motion`, ships a skip-to-content link, and
  uses `:focus-visible` rings.
- `client/src/app/sitemap.ts` + `robots.ts` generate `/sitemap.xml` and
  `/robots.txt`; `/dashboard` and `/interview` are disallowed from indexing.
