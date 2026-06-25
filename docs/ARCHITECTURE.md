# Architecture

## 1. High-level

```
                         ┌──────────────────────────────┐
                         │        Next.js client        │
                         │  (App Router, RSC + client)  │
                         └───────────────┬──────────────┘
                              HTTPS / WSS │ Axios + Socket.IO
                         ┌───────────────▼──────────────┐
                         │        Express API (v1)      │
                         │  auth · rbac · rate-limit ·  │
                         │  validation · controllers    │
                         └───┬───────────┬──────────┬───┘
                             │           │          │
                   ┌─────────▼──┐  ┌─────▼────┐ ┌───▼─────────┐
                   │  MongoDB   │  │  Redis   │ │ Claude API  │
                   │ (Mongoose) │  │ sessions │ │  AI engine  │
                   │            │  │ cache    │ │             │
                   └────────────┘  │ pub/sub  │ └─────────────┘
                                   └──────────┘
```

## 2. Request lifecycle

1. `helmet`, CORS, body parsing, `pino-http` request logging.
2. Global rate limiter (Redis-backed) + stricter per-route limiters on auth.
3. Route → `auth` middleware (verifies access JWT, loads user) → `rbac([...roles])`.
4. Controller wrapped in `asyncHandler` → service layer → Mongoose models.
5. Responses normalized via `ApiResponse`; errors via `ApiError` + central `errorHandler`.

## 3. Authentication & sessions

- **Access token** (short-lived, ~15m) + **refresh token** (long-lived, ~7d).
- Refresh tokens are stored hashed in Redis keyed by `refresh:{userId}:{jti}` so they can be
  revoked individually (logout, "log out all devices", rotation on use).
- OTP / email-verification / password-reset codes are stored in Redis with TTLs.
- 2FA (TOTP) secret stored on the user; verified at login when enabled.
- OAuth (Google, LinkedIn) handled by the auth controller exchanging the provider profile for our
  own token pair.

## 4. RBAC

A single `rbac(...allowedRoles)` middleware checks `req.user.role`. Tenancy is enforced separately:
company-scoped resources carry a `company` ref and queries are filtered by `req.user.company`
(except `super_admin`, which is global). See `middleware/rbac.js` and `middleware/tenant.js`.

| Role | Scope | Highlights |
|------|-------|-----------|
| `super_admin` | platform | companies, subscriptions, global question bank, AI/system settings, audit logs |
| `company_admin` | one company | billing, team, jobs, all candidates/interviews, reports |
| `recruiter` | one company | jobs, candidates, scheduling, pipeline |
| `hr_manager` | one company | interviews, reports, pipeline decisions |
| `candidate` | self | profile, assigned interviews, results |

## 5. AI engine (`services/ai/`)

| Module | Responsibility |
|--------|----------------|
| `claude.client.js` | Thin wrapper over `@anthropic-ai/sdk` with retry, JSON-mode helper, token accounting, and per-company usage logging. |
| `interview.engine.js` | Drives an adaptive interview: greeting → question generation → follow-ups → difficulty adaptation → close. Stateful per interview (state persisted on the `Interview` doc + Redis). |
| `scoring.engine.js` | Scores a single answer and aggregates per-competency scores (technical, communication, confidence, behavioral, leadership, problem-solving, cultural-fit). |
| `report.engine.js` | Produces the final structured report: scores, strengths, weaknesses, improvement areas, recommendation (`strong_hire`/`hire`/`consider`/`reject`). |
| `resume.analyzer.js` | Parses resume text → skills, experience, missing skills vs. job, ATS score, job-match %. |
| `prompts/` | Versioned prompt templates (overridable from the DB by super-admin). |

All AI calls go through `claude.client.js`, which records `AiUsage` (model, input/output tokens,
cost estimate, company, feature) so the super-admin AI analytics are real numbers.

## 6. Real-time (Socket.IO)

- Authenticated via the same access JWT in the handshake.
- Rooms: `user:{id}`, `company:{id}`, `interview:{id}`.
- Events: live notifications, interview status, candidate tracking, anti-cheat events, dashboard
  metric pushes. Redis adapter for horizontal scaling.

## 7. Anti-cheat

Client emits proctoring events (tab switch, blur, paste, face-missing/multiple-face from the
in-browser face detector) over Socket.IO → server appends to `Interview.proctoring.events` and
recomputes an integrity score. Severe events can flag the interview for review.

## 8. Layering rules

- **Controllers** are thin: validate (via middleware), call services, shape responses.
- **Services** hold business logic and are the only layer that touches multiple models or the AI
  client.
- **Models** hold schema, indexes, virtuals, and instance/static helpers only.
- No controller imports another controller; cross-cutting logic lives in services/utils.
