# API reference

Base URL: `/api/v1` · JSON · Bearer auth (`Authorization: Bearer <accessToken>`).
Refresh token is set as an httpOnly cookie and also returned in the body.

## Response envelope

Success:
```json
{ "success": true, "message": "OK", "data": { }, "meta": { } }
```
Error:
```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR", "details": { } }
```

## Auth — implemented in Phase 1

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/auth/register` | — | `name, email, password, role?, companyName?` | `role`=`company_admin` creates a workspace |
| POST | `/auth/login` | — | `email, password, otp?` | `otp` required if 2FA on; `code: TWO_FACTOR_REQUIRED` signals it |
| POST | `/auth/refresh` | cookie/body | `refreshToken?` | rotates refresh token |
| POST | `/auth/logout` | — | `refreshToken?` | revokes the refresh token |
| POST | `/auth/logout-all` | ✅ | — | bumps `tokenVersion`, kills all sessions |
| GET | `/auth/me` | ✅ | — | current user |
| POST | `/auth/verify-email` | — | `email, code` | |
| POST | `/auth/otp/request` | — | `email` | passwordless code (always 200) |
| POST | `/auth/otp/verify` | — | `email, code` | returns token pair |
| POST | `/auth/forgot-password` | — | `email` | always 200 |
| POST | `/auth/reset-password` | — | `email, code, password` | |
| POST | `/auth/2fa/setup` | ✅ | — | returns `{ secret, qr, otpauth }` |
| POST | `/auth/2fa/enable` | ✅ | `token` | confirm with a TOTP code |
| POST | `/auth/2fa/disable` | ✅ | — | |

`GET /api/v1/` returns API meta + module readiness.
`GET /health` (outside prefix) is the liveness probe.

## Planned modules (Phases 2–5)

Conventions: list endpoints accept `?page&limit&q&sort`; company-scoped routes
infer the tenant from the token (super-admin may pass `?company=` / `x-company-id`).

### Super Admin (`super_admin`)
```
GET    /admin/overview                 platform KPIs
GET    /admin/companies                list/filter
POST   /admin/companies                create
PATCH  /admin/companies/:id            edit
POST   /admin/companies/:id/suspend
POST   /admin/companies/:id/activate
GET    /admin/subscriptions  POST /admin/coupons  GET /admin/invoices
GET/POST/PATCH/DELETE /admin/questions      global question bank
GET/PUT /admin/ai/settings   GET/PUT /admin/ai/prompts   PUT /admin/ai/weightage
GET/PUT /admin/system/:group (smtp|sms|payment|security)
GET    /admin/audit-logs
```

### Company (`company_admin`, `recruiter`, `hr_manager`)
```
GET    /company/overview
GET/POST/PATCH/DELETE /jobs            +  POST /jobs/:id/clone
GET/POST /candidates  POST /candidates/import (CSV)  POST /candidates/:id/resume
GET    /candidates/:id/resume-analysis      run resume analyzer
POST   /interviews                     schedule (manual / auto)
POST   /interviews/:id/invite          generate link + send invitation
GET    /interviews  GET /interviews/:id
GET    /pipeline   PATCH /candidates/:id/stage
GET    /reports  GET /reports/:id  GET /reports/export?format=pdf|excel
GET    /reports/ranking?job=
```

### Candidate (`candidate`)
```
GET    /me/interviews
GET    /me/profile  PUT /me/profile  POST /me/resume
```

### Live interview (token-gated, Socket.IO + REST)
```
GET    /interview-room/:accessToken          fetch interview + pre-check config
POST   /interview-room/:accessToken/start
POST   /interview-room/:accessToken/answer   -> next question (engine)
POST   /interview-room/:accessToken/complete -> triggers report generation
WS events: interview:join | interview:answer | interview:proctoring | interview:presence
```

### Billing & webhooks
```
POST   /billing/checkout      (stripe|razorpay)
POST   /billing/portal
POST   /webhooks/stripe       (raw body)   POST /webhooks/razorpay
```
