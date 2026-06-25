<div align="center">

# 🎯 HireSense AI

### Enterprise AI Interview & Hiring Automation Platform

*An AI-driven recruitment platform — in the class of HireVue, Modern Hire and Talently.ai — that runs adaptive, voice-enabled interviews, scores candidates against role competencies, and generates hiring recommendations end-to-end.*

[![CI](https://github.com/TechPresenter/Interview-software/actions/workflows/ci.yml/badge.svg)](https://github.com/TechPresenter/Interview-software/actions)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Claude](https://img.shields.io/badge/AI-Claude-D97757?logo=anthropic&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-blue)

**Developed by [Appsgain Technologies](#) · Built by Prashant Singh Kushwaha**

</div>

---

## 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Feature List](#2-feature-list)
3. [Product Requirements Document (PRD)](#3-product-requirements-document-prd)
4. [Technical Requirements Document (TRD)](#4-technical-requirements-document-trd)
5. [Implementation Plan](#5-implementation-plan)
6. [Technology Stack](#6-technology-stack)
7. [Third-Party Integrations](#7-third-party-integrations)
8. [System Architecture](#8-system-architecture)
9. [System Workflow & Operational Flows](#9-system-workflow--operational-flows)
10. [User Roles & RBAC](#10-user-roles--rbac)
11. [Business Logic](#11-business-logic)
12. [Codebase Explanation & Folder Structure](#12-codebase-explanation--folder-structure)
13. [Database Schema](#13-database-schema)
14. [API Documentation](#14-api-documentation)
15. [UI/UX Design Guidelines](#15-uiux-design-guidelines)
16. [Branding Kit](#16-branding-kit)
17. [Environment Setup](#17-environment-setup)
18. [Installation Guide](#18-installation-guide)
19. [Deployment Instructions](#19-deployment-instructions)
20. [Security Considerations](#20-security-considerations)
21. [Testing Procedures](#21-testing-procedures)
22. [Developer Documentation](#22-developer-documentation)
23. [Maintenance Guidelines](#23-maintenance-guidelines)
24. [Troubleshooting](#24-troubleshooting)
25. [Future Roadmap](#25-future-roadmap)
26. [Credits & License](#26-credits--license)

---

## 1. Project Overview

**HireSense AI** is a full-stack, multi-tenant SaaS platform that automates the candidate-screening
and interview process using large-language-model intelligence. Companies create jobs, import or add
candidates, and dispatch unguessable interview links. Each candidate joins a browser-based **AI
Interview Room** where an AI interviewer greets them, asks adaptive questions (text + voice), listens
to spoken answers via speech-to-text, scores each response across seven competencies, and finally
produces a structured hiring report with a recommendation (`strong_hire` / `hire` / `consider` /
`reject`).

The platform is delivered as a **monorepo** with three logical tiers:

| Tier | Technology | Responsibility |
|------|------------|----------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Marketing site, auth, role dashboards, AI Interview Room |
| **Backend API** | Node.js + Express (ESM + JSDoc) | REST + WebSocket API, RBAC, business logic, AI orchestration |
| **AI Engine** | Claude API (`@anthropic-ai/sdk`) | Interview, scoring, report and resume-analysis engines |

Supporting infrastructure: **MongoDB** (Mongoose) for persistence, **Redis** for sessions / OTP /
rate-limiting / caching / Socket.IO pub-sub, **Socket.IO** for realtime, and **Docker** for packaging.

### Why HireSense?

- **Reduce time-to-hire** — fully automated first-round screening, available 24/7.
- **Remove bias & inconsistency** — every candidate gets the same competency rubric, scored by AI.
- **Scale interviewing** — run thousands of parallel interviews without human interviewers.
- **Auditable & explainable** — every score carries AI reasoning; every action is logged.
- **White-labelable** — agencies can re-brand the platform per deployment.

### Status

> ✅ **All six delivery phases are complete and verified.** The platform boots and runs end-to-end.
> Every optional integration (Claude, Stripe, Razorpay, SMTP, Twilio, Sentry, Google OAuth) **degrades
> gracefully** when its keys are absent, so a fresh clone runs out of the box with only a Mongo URI and
> (optionally) an Anthropic key.

---

## 2. Feature List

### 🏢 Super Admin (platform owner)
- Live platform KPI dashboard + time-series + system health + activity feed
- Company management (create, edit, suspend, activate, per-company billing view)
- Platform-wide candidate management
- Subscription **plans**, **coupons / promo codes**, and **invoices**
- Global **question bank** (technical / HR / aptitude / behavioral / coding / custom) with stats
- **AI management** — settings, prompt templates, scoring weightage, live "test connection", usage analytics, top-consumer leaderboard
- **Multi-provider AI registry** (Claude / Gemini / OpenAI / Azure / Groq / OpenRouter / custom)
- **White-label branding** (logo, favicon, colors, login art, social, announcements, custom CSS, SEO)
- **CMS** — pages, blog, FAQs, testimonials, announcements, email/notification templates
- **System settings** (SMTP / SMS / payment / security / general), audit logs, backup trigger
- **Recordings review** across all companies (video + transcript + scores + proctoring)

### 🏬 Company Panel (`company_admin` / `recruiter` / `hr_manager`)
- Company overview dashboard with live metrics
- **Jobs** — CRUD + clone, skills/weights, experience & salary ranges, per-job interview config
- **Candidates** — manual add, **CSV bulk import**, **resume upload → AI analysis** (ATS score, job-match %, skills gap)
- **Interviews** — manual scheduling, auto-scheduling, **invite link generation + email/SMS invitation**, cancel
- **Pipeline** — kanban board (applied → screening → interview → shortlisted → hired / rejected) with drag-to-move
- **Reports** — list, ranking per job, analytics, single report view, **PDF & Excel export**
- **Recordings** review with download
- **Billing** — plan summary, Stripe/Razorpay checkout, invoices, cancel

### 👤 Candidate Portal & AI Interview Room
- Candidate dashboard, profile editor, resume upload
- **Pre-check** — camera / microphone / internet / browser compatibility validation
- **Live AI Interview Room**:
  - AI avatar with **text-to-speech** (Indian-English / Hindi female voice) and speaking indicator
  - **Speech-to-text** answers (live interim transcription) + text fallback
  - **Bilingual** EN / हिं switching at any time
  - Mic-reactive waveform, AI typing indicator, confidence meter
  - **Skip / ask-another** question (limited by `maxSkips`)
  - **HD 720p video recording** (VP9/VP8) uploaded for review
  - Countdown timer, progress tracker, live transcript, `localStorage` autosave
- **Adaptive engine loop**: greet → ask → score → adapt difficulty → follow-up → complete → report
- **Anti-cheat / proctoring**: tab-switch, blur, copy, paste, right-click, fullscreen-exit detection → integrity score + auto-flag

### 💳 Payments, CMS & Notifications
- **Stripe + Razorpay** behind a provider abstraction; subscription billing, invoices, signed webhooks
- Plan activation **snapshots limits** onto the company; coupon-aware pricing
- **CMS**: pages / blog / FAQ / testimonials / announcements / templates (admin CRUD + public read)
- **Notifications**: SMTP email (nodemailer), SMS + WhatsApp (Twilio), in-app realtime; `{{variable}}` template rendering
- Public marketing pages: `/`, `/pricing`, `/blog`, `/blog/[slug]`

### 🛡️ Platform Hardening
- Vitest unit suite, GitHub Actions CI/CD, optional Sentry monitoring
- CDN cache headers, gzip compression
- Accessibility (reduced-motion, focus-visible, skip-to-content, sr-only)
- SEO (`sitemap.xml`, `robots.txt`, rich metadata)

---

## 3. Product Requirements Document (PRD)

### 3.1 Vision
Make first-round interviewing **autonomous, consistent, and scalable** so recruiting teams spend their
time only on candidates an unbiased AI has already validated.

### 3.2 Target Users / Personas

| Persona | Goal | Key screens |
|---------|------|-------------|
| **Platform Owner** (super_admin) | Operate the SaaS, onboard companies, monitor usage & revenue | Super-admin dashboard, companies, subscriptions, AI mgmt |
| **Company Admin** | Set up hiring, manage team & billing | Company overview, jobs, billing |
| **Recruiter** | Source candidates, schedule interviews, manage pipeline | Jobs, candidates, interviews, pipeline |
| **HR Manager** | Review interview results, make decisions | Interviews, reports, pipeline |
| **Candidate** | Take the interview, view status | Candidate portal, Interview Room |

### 3.3 User Stories (representative)

- *As a recruiter*, I can import 200 candidates from a CSV and trigger AI screening interviews so I don't schedule each one manually.
- *As a candidate*, I can take the interview in my browser with no install, speak my answers, and switch to Hindi if I prefer.
- *As an HR manager*, I can open a candidate's report and see per-competency scores with the AI's reasoning, then move them to "shortlisted".
- *As a company admin*, I can upgrade my plan via Stripe and have new interview limits applied instantly.
- *As a super admin*, I can white-label the platform for a reseller and watch live AI token spend per company.

### 3.4 Functional Requirements
1. Multi-tenant company isolation with 5-role RBAC.
2. AI-driven adaptive interview with voice + text, bilingual (EN/HI).
3. Automated competency scoring and hiring recommendation.
4. Resume parsing & ATS/job-match analysis.
5. Candidate pipeline management with stages.
6. Subscription billing (Stripe + Razorpay) with plan-limit enforcement.
7. Proctoring / anti-cheat with integrity scoring.
8. Notifications across email / SMS / WhatsApp / in-app.
9. White-label branding and CMS.
10. Full audit trail and AI-usage accounting.

### 3.5 Non-Functional Requirements
- **Security**: JWT access+refresh with rotation, 2FA (TOTP), helmet, rate-limiting, input sanitization, webhook signature verification.
- **Performance**: Redis caching, gzip, CDN cache headers, horizontally scalable API (Socket.IO Redis adapter).
- **Reliability**: graceful degradation of every external dependency; central error handling.
- **Accessibility**: WCAG-leaning (reduced-motion, focus-visible, skip-link).
- **Observability**: pino structured logs, optional Sentry, AiUsage + AuditLog analytics.

### 3.6 Success Metrics
Time-to-first-screen ↓, interviews/recruiter/week ↑, candidate completion rate, score-to-hire correlation, AI cost per interview, platform uptime.

### 3.7 Out of Scope (current release)
Live human-in-the-loop interviews, video-conferencing between humans, ATS connectors (Greenhouse/Lever), mobile native apps. See [Roadmap](#25-future-roadmap).

---

## 4. Technical Requirements Document (TRD)

### 4.1 Architecture Style
Modular **layered monolith** (controllers → services → models) on the API, served behind a Next.js
frontend. Stateless API instances share state through MongoDB + Redis, enabling horizontal scaling.

### 4.2 Technology Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend language | **JavaScript (ESM) + JSDoc** | Fast iteration, type hints without a build step |
| Frontend | **Next.js App Router + TS** | SSR/SEO for marketing, RSC + client islands for app |
| AI provider | **Claude** (`claude-opus-4-8` / `claude-haiku-4-5`) | Strong reasoning for scoring + structured JSON output |
| DB | **MongoDB + Mongoose** | Flexible nested documents (transcripts, engine state, reports) |
| Cache/session | **Redis (ioredis)** | Refresh tokens, OTP, rate-limit, cache, Socket.IO adapter |
| Realtime | **Socket.IO** | Live notifications, proctoring, presence; Redis adapter for scale |
| Payments | **Stripe + Razorpay** | Global + India coverage behind one abstraction |
| Styling | **Tailwind + ShadCN-style + Framer Motion** | Design-token theming, premium motion |

### 4.3 System Requirements
- **Runtime**: Node.js ≥ 20, npm ≥ 10
- **Datastores**: MongoDB ≥ 6, Redis ≥ 7
- **Browser** (candidate): Chromium-based recommended (uses `webkitSpeechRecognition`, `MediaRecorder`, `getUserMedia`)
- **Keys**: `ANTHROPIC_API_KEY` for live AI (optional — degrades to fallbacks)

### 4.4 Key Technical Constraints
- Speech recognition relies on the Web Speech API → best in Chrome/Edge.
- TTS voice quality depends on OS-installed voices (Indian/Hindi voices preferred when present).
- The interview-room page is client-only (`next/dynamic`, `ssr:false`) to avoid SSR crashes on browser-only APIs.
- Webhooks must receive the **raw** request body (mounted before the JSON parser).

### 4.5 API Contract Standards
- Base URL `/api/v1`, JSON, Bearer auth.
- Uniform response envelope (`ApiResponse`) and error envelope (`ApiError`).
- List endpoints: `?page&limit&q&sort`; tenant inferred from token.

---

## 5. Implementation Plan

The product was delivered in **six reviewed phases**, each producing runnable code before the next.

| Phase | Scope | Status |
|------|-------|--------|
| **1 — Foundation** | Monorepo, Express core, all DB models, JWT+refresh auth + RBAC (5 roles), AI engine (Claude client + interview/scoring/report/resume), Socket.IO, Next.js premium UI shell, docs | ✅ Done |
| **2 — Super Admin** | Company mgmt, subscriptions/coupons/invoices, question bank, AI/system settings, audit, backup, live dashboard | ✅ Done |
| **3 — Company Panel** | Jobs (+clone), candidates (+CSV/resume AI), interview scheduling/auto/invite/cancel, pipeline board, reports + PDF/Excel export, plan-limit enforcement | ✅ Done |
| **4 — Candidate + Interview Room** | Portal, pre-checks, live AI interview room (voice+text, recording, transcript, autosave, bilingual), adaptive engine loop, anti-cheat | ✅ Done |
| **5 — Payments / CMS / Notifications** | Stripe/Razorpay + webhooks + billing, CMS (blog/FAQ/testimonials/announcements/templates), SMTP + SMS/WhatsApp, public pricing/blog | ✅ Done |
| **6 — Hardening** | Vitest tests, GitHub Actions CI/CD, Sentry, caching, a11y, SEO | ✅ Done |

**Post-phase enhancements (also shipped):** Google OAuth (ID-token verification, no SDK), premium
v2 dark+light theme engine, flagship bilingual Interview Room v2, white-label branding engine,
multi-provider AI registry.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the granular checklist.

---

## 6. Technology Stack

**Frontend**
`Next.js 14 (App Router)` · `React 18` · `TypeScript` · `Tailwind CSS` · `ShadCN-style UI` ·
`Framer Motion` · `GSAP` · `Three.js / React Three Fiber + Drei` · `TanStack React Query` ·
`Zustand` · `Axios` · `Socket.IO client` · `lucide-react`

**Backend**
`Node.js ≥ 20` · `Express 4` · `MongoDB + Mongoose 8` · `Redis (ioredis)` · `Socket.IO 4` ·
`JWT (jsonwebtoken)` · `bcryptjs` · `Zod` (validation) · `Multer` (uploads) · `pino / pino-http` (logging)

**AI**
`@anthropic-ai/sdk` (Claude) — interview engine, scoring engine, report generator, resume analyzer

**Documents & Export**
`pdf-parse`, `mammoth` (resume parsing) · `pdfkit` (PDF reports) · `exceljs` (Excel export) · `csv-parse` (bulk import)

**Payments & Comms**
`stripe` · `razorpay` · `nodemailer` (SMTP) · `twilio` (SMS/WhatsApp, dynamic import)

**Security & Ops**
`helmet` · `cors` · `express-rate-limit` + `rate-limit-redis` · `express-mongo-sanitize` · `hpp` ·
`xss` · `otplib` + `qrcode` (2FA) · `@sentry/node` (optional) · `compression`

**Infra / Tooling**
`Docker` · `docker-compose` · `GitHub Actions` · `Vitest` · `ESLint` · `nodemon`

---

## 7. Third-Party Integrations

| Integration | Purpose | Required? | Degrades gracefully? |
|-------------|---------|-----------|----------------------|
| **Anthropic Claude** | AI interview/scoring/report/resume | Recommended | ✅ Falls back to canned logic |
| **MongoDB** | Primary datastore | **Yes** | — |
| **Redis** | Sessions / OTP / cache / rate-limit / Socket.IO | **Yes** | — |
| **Stripe** | Global card payments + webhooks | Optional | ✅ Billing disabled if unset |
| **Razorpay** | India payments + webhooks | Optional | ✅ |
| **SMTP (nodemailer)** | Transactional email | Optional | ✅ Logs instead of sends |
| **Twilio** | SMS + WhatsApp | Optional | ✅ Dynamic import; no-op if unset |
| **Google OAuth** | Social login | Optional | ✅ Button hidden until configured |
| **Sentry** | Error monitoring | Optional | ✅ No-op without DSN |

> **Configuration philosophy:** every external dependency is read from environment variables and
> lazily initialized. Missing keys never crash the app — the related feature simply turns off.

---

## 8. System Architecture

### 8.1 High-level

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

### 8.2 Request lifecycle
1. `helmet`, CORS, body parsing, `pino-http` request logging.
2. Global Redis-backed rate limiter + stricter per-route limiters on auth.
3. Route → `authenticate` (verify access JWT, load user) → `rbac([...roles])` → `requireTenant` (company scope).
4. Controller (wrapped in `asyncHandler`) → **service layer** → Mongoose models.
5. Responses normalized via `ApiResponse`; errors via `ApiError` + central `errorHandler` (5xx auto-captured by Sentry when enabled).

### 8.3 Layering rules
- **Controllers** are thin: validate (middleware), call services, shape responses. No controller imports another controller.
- **Services** own business logic and are the only layer touching multiple models or the AI client.
- **Models** hold schema, indexes, virtuals, and instance/static helpers only.

### 8.4 AI engine (`server/src/services/ai/`)

| Module | Responsibility |
|--------|----------------|
| `claude.client.js` | Wrapper over `@anthropic-ai/sdk`: retry, JSON-mode helper, token accounting, per-company `AiUsage` logging |
| `interview.engine.js` | Drives the adaptive interview (greet → generate → follow-up → adapt difficulty → close); language-aware (EN/HI); state on `Interview` doc + Redis |
| `scoring.engine.js` | Scores one answer, aggregates 7 competency scores |
| `report.engine.js` | Final structured report: scores, strengths, weaknesses, improvements, recommendation |
| `resume.analyzer.js` | Resume text → skills, experience, gaps vs job, ATS score, job-match % |
| `prompts/` | Versioned prompt templates (DB-overridable by super-admin) |

### 8.5 Realtime (Socket.IO)
- Authenticated via the same access JWT in the handshake.
- Rooms: `user:{id}`, `company:{id}`, `interview:{id}`.
- Events: live notifications, interview status, candidate tracking, anti-cheat events, dashboard metric pushes.
- Redis adapter for horizontal scaling.

### 8.6 Anti-cheat
Client emits proctoring events (tab switch, blur, paste, right-click, fullscreen exit) → server
appends to `Interview.proctoring.events` and recomputes an integrity score; severe events flag the
interview for review.

---

## 9. System Workflow & Operational Flows

### 9.1 End-to-end hiring flow

```
Super Admin onboards Company ─▶ Company Admin sets up Plan/Billing
        │
        ▼
Recruiter creates Job ─▶ adds/imports Candidates ─▶ uploads Resume ─▶ AI resume analysis
        │
        ▼
Recruiter schedules Interview ─▶ system generates accessToken link ─▶ invite via email/SMS
        │
        ▼
Candidate opens /interview/<token> ─▶ PreCheck (cam/mic/net/browser)
        │
        ▼
AI Interview Room: greet ─▶ ask ─▶ (voice/text answer) ─▶ score ─▶ adapt ─▶ follow-up … ─▶ complete
        │  (proctoring events streamed throughout)
        ▼
report.engine generates Report ─▶ HR Manager reviews scores + recommendation
        │
        ▼
Pipeline: applied → screening → interview → shortlisted → hired / rejected
```

### 9.2 Interview engine loop (per `room.service.js`)
1. `start` → engine greets, emits first `pendingQuestion`.
2. `answer` → `scoring.engine` evaluates the answer, records an `Answer`, decides next question / difficulty (`adaptDifficulty`), tracks `askedTexts` to avoid repeats.
3. `skip` → records a zero-scored `(skipped)` answer (enforces `maxSkips`).
4. `language` → swaps STT language + TTS voice mid-interview.
5. `complete` → `report.engine` produces the final `Report`; interview marked `completed`.
6. On AI failure at any step, graceful fallbacks keep the interview moving.

### 9.3 Billing flow
`checkout` (Stripe/Razorpay) → provider session → webhook (raw body, signature-verified) →
`applyPaidPlan` snapshots plan limits onto the company + creates an idempotent invoice `Payment`
(keyed on `providerPaymentId`).

---

## 10. User Roles & RBAC

A single `rbac(...allowedRoles)` middleware checks `req.user.role`. Tenancy is enforced separately by
`requireTenant`: company-scoped resources carry a `company` ref and queries are filtered by
`req.user.company` (except `super_admin`, which is global).

| Role | Scope | Highlights |
|------|-------|-----------|
| `super_admin` | platform | companies, subscriptions, global question bank, AI/system settings, branding, CMS, audit logs, recordings |
| `company_admin` | one company | billing, team, jobs, all candidates/interviews, reports, recordings |
| `recruiter` | one company | jobs, candidates, scheduling, pipeline, recordings |
| `hr_manager` | one company | interviews, reports, pipeline decisions, recordings |
| `candidate` | self | profile, assigned interviews, results |

Role-aware navigation is defined in [`client/src/components/dashboard/nav.config.ts`](client/src/components/dashboard/nav.config.ts).

---

## 11. Business Logic

- **Plan limits** (`limits.service.js`): each company carries `{ seats, activeJobs, interviewsPerMonth, aiTokensPerMonth }`. Actions check limits before proceeding; paid-plan activation snapshots the plan's limits onto the company.
- **Scoring weightage**: the final overall score weights the 7 competencies (`technical, communication, confidence, behavioral, leadership, problemSolving, culturalFit`); weights are configurable by super-admin.
- **Recommendation mapping** (`recommendationFromScore`): overall score → `strong_hire` / `hire` / `consider` / `reject`.
- **Integrity score**: proctoring events reduce a starting integrity score; below a threshold the interview is auto-flagged.
- **AI accounting**: every Claude call records `AiUsage` (model, tokens, cost, latency, feature, company) → powers analytics + quota.
- **Idempotent payments**: invoices are unique on `providerPaymentId` so webhook retries don't double-charge.
- **Adaptive difficulty**: consecutive strong answers raise difficulty; weak answers lower it (`adaptDifficulty`).

---

## 12. Codebase Explanation & Folder Structure

```
interview/                         # monorepo root
├── server/                        # Express API + AI engine (Node, ESM + JSDoc)
│   ├── src/
│   │   ├── app.js                 # express app: middleware, routes, webhooks (raw body), error handler
│   │   ├── server.js              # bootstrap: db + redis + http + socket.io
│   │   ├── config/                # index(env), db, redis, logger
│   │   ├── constants/enums.js     # roles, plans, statuses, competencies …
│   │   ├── models/                # 25 Mongoose models (+ index.js)
│   │   ├── middleware/            # auth, rbac, tenant, validate, rateLimiter, upload, errorHandler
│   │   ├── controllers/
│   │   │   ├── admin/             # super-admin controllers
│   │   │   ├── company/           # company-panel controllers
│   │   │   ├── auth / candidate / room / content / webhook
│   │   ├── routes/                # auth, admin, company, room, candidate, content, webhook, index
│   │   ├── services/
│   │   │   ├── ai/                # claude.client + interview/scoring/report/resume + prompts/
│   │   │   ├── payment/           # provider abstraction (stripe / razorpay)
│   │   │   └── *.service.js       # analytics, audit, email, sms, export, file, limits, notification, room, settings, template, observability
│   │   ├── socket/                # index, emitters, interview.handlers
│   │   ├── utils/                 # ApiError, ApiResponse, asyncHandler, tokens, otp, query, slug
│   │   ├── validators/            # Zod schemas per module
│   │   └── scripts/               # seed, seed-demo, check-db
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── client/                        # Next.js frontend (TypeScript)
│   ├── src/
│   │   ├── app/                   # App Router
│   │   │   ├── (auth)/login|register
│   │   │   ├── dashboard/         # role dashboards (jobs, candidates, interviews, pipeline, reports,
│   │   │   │                      #   recordings, billing, branding, cms, companies, subscriptions,
│   │   │   │                      #   questions, ai, system, profile, my-interviews)
│   │   │   ├── interview/[token]/ # AI Interview Room (ssr:false)
│   │   │   ├── blog, pricing      # public marketing
│   │   │   ├── sitemap.ts, robots.ts, layout.tsx, providers.tsx, globals.css
│   │   ├── components/
│   │   │   ├── ui/                # Button, GlassCard, DataTable, Modal, Badge, Charts, toast …
│   │   │   ├── landing/           # Navbar, AiDemo, Testimonials, Faq
│   │   │   ├── dashboard/         # Sidebar, StatCard, nav.config
│   │   │   ├── room/              # InterviewRoom, PreCheck, AiAvatar, Waveform
│   │   │   └── auth/GoogleButton, AnnouncementBar
│   │   ├── lib/                   # api clients (api, admin.api, company.api, candidate.api, room.api,
│   │   │                          #   content.api), voice, format, utils
│   │   ├── store/                 # Zustand: auth.store, theme.store, branding.store
│   │   └── hooks/useAntiCheat.ts
│   ├── Dockerfile, next.config.mjs, tailwind.config.ts, tsconfig.json
│   ├── package.json
│   └── .env.example
│
├── docs/                          # ARCHITECTURE, DATABASE_SCHEMA, API, DEPLOYMENT, ROADMAP
├── .github/workflows/ci.yml       # CI/CD pipeline
├── docker-compose.yml             # mongo + redis + api + web
├── start-dev.ps1                  # Windows convenience launcher
└── README.md                      # ← you are here
```

**File counts:** ~112 backend source files, ~70 frontend source files.

---

## 13. Database Schema

MongoDB via Mongoose. All collections use `timestamps: true`. Relationships are `ObjectId` refs.
Full detail in [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).

### Entity relationships
```
Company 1───* User            (company staff)
Company 1───* Job
Company 1───* Candidate
Company 1───1 Subscription ───* Payment
Job     1───* Candidate
Job     1───* Interview
Candidate 1─* Interview
Interview 1─* Answer
Interview 1─1 Report
Question  *──* Interview        (asked questions tracked on Interview.engineState)
User    1───* Notification
* AuditLog / ActivityLog / AiUsage / SystemSetting / Branding / AiProvider + CMS docs are cross-cutting
```

### Core collections (key fields)

| Model | Key fields |
|-------|-----------|
| **User** | `name, email*, password(select:false), role, company→Company, isActive, isEmailVerified, twoFactor{enabled,secret}, providers{google,linkedin}, tokenVersion, meta.profile` |
| **Company** | `name, slug*, owner→User, status, plan, subscription→Subscription, limits{seats,activeJobs,interviewsPerMonth,aiTokensPerMonth}, branding{...}` |
| **Job** | `company, title, slug, skills[{name,weight,required}], experience{min,max}, salary, interviewConfig{types,durationMinutes,questionCount,adaptiveDifficulty,language,allowSkip,maxSkips}, status` |
| **Candidate** | `company, user?, job, name, email, education[], experience[], skills[], resume{url,text}, resumeAnalysis{atsScore,jobMatch,...}, stage, source, notes[]` |
| **Interview** | `company, job, candidate, accessToken*, types[], status, config{language,allowSkip,maxSkips,...}, engineState{currentIndex,difficulty,phase,askedQuestionIds,pendingQuestion,askedTexts,skipsUsed}, transcript[], recordings{videoUrl,audioUrl}, proctoring{integrityScore,events[]}, report→Report` |
| **Question** | `company\|null(global), category, difficulty, text, skills[], coding{...}, expectedPoints[], competencies[], isActive, usageCount` |
| **Answer** | `interview, question, questionText, response, audioUrl, durationSeconds, evaluation{score,competencyScores(Map),reasoning,keywordsHit[],keywordsMissed[]}` |
| **Report** | `company, interview*, candidate, job, scores{7 competencies}, overallScore, strengths[], weaknesses[], improvementAreas[], detailedFeedback, recommendation, weightage, integrityScore` |
| **Subscription** | `company, plan, status, billingCycle, provider, providerCustomerId, providerSubscriptionId, amount, currency, currentPeriodStart/End, coupon` |
| **Payment** | `company, subscription, provider, providerPaymentId, amount, currency, status, invoiceNumber*, invoiceUrl, paidAt, raw` |
| **Plan / Coupon** | subscription catalog + promo codes |
| **Notification** | `recipient→User, company, type, title, body, link, channels[], isRead` |
| **AuditLog / ActivityLog** | append-only audit + 90-day TTL activity feed |
| **SystemSetting** | `key*, group[smtp\|sms\|payment\|ai\|security\|general\|feature_flag], value, isSecret` |
| **AiUsage** | `company, feature, model, inputTokens, outputTokens, totalTokens, costUsd, latencyMs, success, interview` |
| **AiProvider** | `type[claude\|gemini\|openai\|azure_openai\|groq\|openrouter\|custom], apiKey(select:false), isDefault` |
| **Branding** | global white-label singleton (logo, colors, login art, social, announcement, SEO, custom CSS) |
| **CMS**: Page / BlogPost / Faq / Testimonial / Announcement / Template | marketing + messaging content |

`*` = unique index.

---

## 14. API Documentation

Base URL: `/api/v1` · JSON · `Authorization: Bearer <accessToken>`. Refresh token is set as an
httpOnly cookie and returned in the body. Full reference: [`docs/API.md`](docs/API.md).

### Response envelope
```json
// success
{ "success": true, "message": "OK", "data": { }, "meta": { } }
// error
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR", "details": { } }
```

### Health / meta
- `GET /health` — liveness probe (outside the API prefix)
- `GET /api/v1/` — API meta + module readiness

### Auth (`/auth`)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` | `role=company_admin` creates a workspace |
| POST | `/auth/login` | `otp` required if 2FA on (`code: TWO_FACTOR_REQUIRED`) |
| POST | `/auth/refresh` | rotates refresh token |
| POST | `/auth/logout` · `/auth/logout-all` | revoke one / all sessions |
| GET | `/auth/me` | current user |
| POST | `/auth/verify-email` · `/auth/otp/request` · `/auth/otp/verify` | email verify + passwordless |
| POST | `/auth/forgot-password` · `/auth/reset-password` | password reset |
| POST | `/auth/2fa/setup` · `/auth/2fa/enable` · `/auth/2fa/disable` | TOTP 2FA |
| POST | `/auth/google` | Google ID-token sign-in |

### Super Admin (`/admin`, `super_admin` only)
```
GET   /admin/overview · /overview/timeseries · /health · /activity
GET   /admin/recordings · /recordings/:id
CRUD  /admin/companies (+ /:id/suspend, /:id/activate, /:id/billing)
GET/PUT/POST /admin/branding (+ /branding/asset)
GET/PATCH/DELETE /admin/candidates
GET/PUT /admin/plans (+ /plans/seed) · /subscriptions · /coupons · /invoices
CRUD  /admin/questions (+ /questions/stats, /questions/bulk)
GET/PUT /admin/ai/settings · /ai/weightage · /ai/prompts  ·  POST /ai/test
GET   /admin/ai/analytics · /ai/usage/top-companies
CRUD  /admin/ai-providers (+ /:id/default)
GET   /admin/audit-logs  ·  POST /admin/backup  ·  GET/PUT /admin/system/:group
CRUD  /admin/cms/{pages|blog|faqs|testimonials|announcements|templates}
```

### Company (`/`, company roles)
```
GET   /company/overview
CRUD  /jobs (+ /jobs/:id/clone)
CRUD  /candidates (+ /candidates/import CSV, /candidates/:id/resume, /:id/resume-analysis, /:id/notes, /:id/stage)
GET   /interviews · /interviews/:id · /recordings
POST  /interviews · /interviews/auto · /interviews/:id/invite · /interviews/:id/cancel
GET   /pipeline
GET   /reports · /reports/:id · /reports/analytics · /reports/ranking (+ /export, /:id/export)
GET   /billing · /billing/invoices  ·  POST /billing/checkout · /billing/razorpay/verify · /billing/cancel
```

### Candidate portal (`/me`, `candidate`)
```
GET /me/interviews · /me/profile · /me/notifications
PUT /me/profile  ·  POST /me/resume · /me/notifications/read-all  ·  PATCH /me/notifications/:id/read
```

### Live Interview Room (`/interview-room/:token`, token-gated, no JWT)
```
GET  /interview-room/:token              fetch interview + pre-check config
POST /:token/start  · /:token/answer · /:token/skip · /:token/language · /:token/complete
POST /:token/proctoring · /:token/recording (multipart video)
WS events: interview:join | interview:answer | interview:proctoring | interview:presence
```

### Public content (`/content`, cacheable)
```
GET /content/branding · /plans · /faqs · /testimonials · /announcements · /blog · /blog/:slug · /pages/:slug
```

### Webhooks (raw body, signature-verified)
```
POST /api/v1/webhooks/stripe · /api/v1/webhooks/razorpay
```

---

## 15. UI/UX Design Guidelines

### Design language
A **premium, glass-morphic dark-first** aesthetic with a light theme companion. Motion is meaningful
but respects `prefers-reduced-motion`.

- **Type scale**: `Sora` for display/headings, `Inter` for body (wired via `--font-display` / `--font-sans`).
- **Theme engine**: `dark`/`light` class on `<html>`, persisted to `localStorage`, default dark, no-flash inline script in `layout.tsx`. Toggle via `components/ui/ThemeToggle.tsx`.
- **Tokens**: HSL CSS variables (`--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--card`, `--border`, `--ring`, `--radius`) → consumed by Tailwind. White-label branding rewrites `--primary`/`--accent` at runtime.
- **Signature components**: `Button` (gradient + glow + shine sweep + ripple + magnetic), `GlassCard` (gradient-border + 3D pointer tilt), `DataTable`, `Modal`, `Badge`, `Charts`, `Toaster`.
- **Utilities** (globals.css): `glass`, `glass-strong`, `gradient-border`, `neu`, `text-gradient`, `mesh-bg`, `grid-bg`, `glow`, `skeleton`; keyframes `mesh-pan`, `shimmer`, `float`, `ripple`, `marquee`.
- **Landing**: hero with mesh + grid + floating cards, live AI demo, tilt feature cards, how-it-works timeline, dashboard preview, animated stat counters, testimonials marquee, monthly/yearly pricing toggle, FAQ accordion, mega footer.

### Accessibility
`prefers-reduced-motion` honored · `:focus-visible` rings · skip-to-content link · `sr-only` text ·
semantic headings.

### Interview Room UX
Immersive, distraction-free room: AI avatar with speaking state, mic-reactive waveform, live transcript,
confidence meter, EN/हिं switch, skip with remaining count, countdown + progress, autosave.

---

## 16. Branding Kit

> The platform is **white-labelable** at runtime via the `Branding` model + `/dashboard/branding`
> admin page (`branding.store.ts` applies it on boot). The values below are the **default HireSense**
> identity.

### Logo & name
- **Product name**: HireSense AI
- **Mark**: 🎯 (target — precision hiring). Replaceable via branding upload (logo + favicon).

### Color system (default tokens)
| Token | Role | Reference |
|-------|------|-----------|
| `--primary` | Brand primary (indigo/violet family) | `hsl(250 90% 60%)` |
| `--accent` | Accent (cyan family) | `hsl(190 90% 55%)` |
| Mesh tertiary | Magenta highlight | `hsl(300 85% 60%)` |
| `--background` / `--foreground` | Surface / text | theme-dependent (dark default) |
| `--destructive` | Errors / danger | red family |

Gradient brand: `linear-gradient(135deg, var(--primary) → var(--accent))`. The hero/mesh blends
indigo + cyan + magenta radial gradients.

### Typography
- **Display / headings**: Sora
- **Body / UI**: Inter

### Motion vocabulary
`gradient-pan` (8s) · `float` (6s) · `shimmer` (1.5s) · `fade-up` (0.6s) · ripple + magnetic on buttons · 3D tilt on cards.

### White-label override surface
Logo, favicon, primary/accent colors, login art, social links, contact info, announcement bar, SEO
metadata, and custom CSS — all editable in the branding panel and applied without redeploy.

---

## 17. Environment Setup

### Server (`server/.env` — copy from `server/.env.example`)
```bash
# Server
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
CLIENT_URL=http://localhost:3000

# Database (required)
MONGO_URI=mongodb://localhost:27017/hiresense
REDIS_URL=redis://localhost:6379

# JWT (required — use long random strings)
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AI (recommended)
ANTHROPIC_API_KEY=sk-ant-xxxx
AI_MODEL=claude-opus-4-8
AI_MODEL_FAST=claude-haiku-4-5-20251001
AI_MAX_TOKENS=4096

# Optional integrations (each degrades gracefully if blank)
SMTP_HOST= SMTP_PORT=587 SMTP_USER= SMTP_PASS= MAIL_FROM="HireSense <no-reply@hiresense.ai>"
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= LINKEDIN_CLIENT_ID= LINKEDIN_CLIENT_SECRET=
STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= RAZORPAY_KEY_ID= RAZORPAY_KEY_SECRET=
SMS_PROVIDER=twilio TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_FROM= TWILIO_WHATSAPP_FROM=

# Misc
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
BCRYPT_ROUNDS=12
```

### Client (`client/.env.local` — copy from `client/.env.example`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=HireSense
NEXT_PUBLIC_GOOGLE_CLIENT_ID=     # same client ID as server GOOGLE_CLIENT_ID
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> ⚠️ **Never commit `.env` / `.env.local`** — they are gitignored. Rotate `JWT_*` and any provider
> keys before production. `NEXT_PUBLIC_*` values are exposed to the browser — keep secrets out of them.

---

## 18. Installation Guide

### Prerequisites
- Node.js ≥ 20, npm ≥ 10
- MongoDB ≥ 6 and Redis ≥ 7 (or `docker-compose up mongo redis`)
- (Recommended) an Anthropic API key

### Backend
```bash
cd server
cp .env.example .env          # fill MONGO_URI, REDIS_URL, JWT secrets, ANTHROPIC_API_KEY
npm install
npm run seed                  # creates first super-admin + plans + sample questions
npm run dev                   # http://localhost:5000
```

### Frontend
```bash
cd client
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
npm install
npm run dev                   # http://localhost:3000
```

### Everything via Docker
```bash
cp server/.env.example server/.env   # fill secrets
docker-compose up --build            # mongo, redis, api, web
docker-compose exec api npm run seed # seed the first super-admin
```

### Seed accounts
| Command | Accounts |
|---------|----------|
| `npm run seed` | `admin@hiresense.ai` / `ChangeMe123!` (super_admin) + 4 plans + sample questions |
| `npm run seed:demo` | `company@ / recruiter@ / hr@ / candidate@hiresense.ai` (all `Demo@12345`) + demo company, job, candidates, scheduled interview |

> Change the super-admin password immediately after first login.

### Windows quick-launch
`start-dev.ps1` (project root) starts Redis + backend + frontend in separate windows.

### Helpful scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | dev server (nodemon / next) |
| `npm run start` | production start |
| `npm test` (server) | Vitest unit suite |
| `npm run lint` | ESLint |
| `npm run check:db` (server) | verify Mongo + Redis connectivity |
| `npm run build` (client) | production Next.js build |

---

## 19. Deployment Instructions

Full guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Production topology
```
        ┌── CDN / Vercel ──┐         ┌── Container host (ECS / Fly / Render) ──┐
Browser▶│  Next.js (web)   │──HTTPS──▶│  Express API (N replicas)              │
        └──────────────────┘  WSS     │  Socket.IO + Redis adapter            │
                                       └──────┬──────────────┬─────────────────┘
                                    MongoDB Atlas       Redis (managed)
```

- **Frontend**: deploy `client/` to Vercel (or its Dockerfile). Set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` to the API's public URL.
- **API**: run the `server/` image behind a load balancer. The Socket.IO **Redis adapter** allows multiple replicas.
- **MongoDB**: Atlas with `autoIndex:false` in prod — create indexes via a one-off `Model.syncIndexes()` job.
- **Redis**: managed (ElastiCache / Upstash) — refresh tokens, OTP, rate-limit, cache, Socket.IO pub-sub.

### CI/CD (GitHub Actions — [`.github/workflows/ci.yml`](.github/workflows/ci.yml))
- **server** — `npm ci`, lint, `npm test` (Vitest) with CI env secrets.
- **client** — `npm ci`, lint, `next build`.
- **docker** — builds both images on `main` (extend with a push/deploy step).

### Production hardening checklist
- [ ] `NODE_ENV=production`, strong unique `JWT_*` secrets
- [ ] HTTPS everywhere; secure cookies (`config.isProd` toggles `secure`)
- [ ] CORS locked to the real `CLIENT_URL`
- [ ] Rate limits tuned; auth endpoints throttled
- [ ] MongoDB auth + network allowlist; Redis password/TLS
- [ ] Mongo automated backups + tested restore
- [ ] Sentry DSN set; pino logs shipped to a collector
- [ ] Payment webhooks verified with provider signing secrets
- [ ] `ANTHROPIC_API_KEY` rotated; per-company AI quotas set

---

## 20. Security Considerations

| Area | Measure |
|------|---------|
| **AuthN** | JWT access (~15m) + refresh (~7d) hashed in Redis (`refresh:{userId}:{jti}`), individually revocable, rotated on use |
| **Sessions** | `logout-all` bumps `tokenVersion` to kill every session |
| **2FA** | TOTP (otplib) with QR provisioning; verified at login when enabled |
| **OAuth** | Google ID-token verified server-side via `oauth2.googleapis.com/tokeninfo` |
| **AuthZ** | `rbac()` role gate + `requireTenant` company isolation |
| **Transport** | `helmet` headers, CORS locked to `CLIENT_URL`, secure cookies in prod |
| **Input** | Zod validation, `express-mongo-sanitize`, `hpp`, `xss` cleaning |
| **Abuse** | Redis-backed rate limiting (global + stricter auth limiter) |
| **Passwords** | bcrypt (`BCRYPT_ROUNDS=12`), `select:false`, stripped from `toJSON()` |
| **Secrets** | env-only; `apiKey` fields `select:false`; `.env` gitignored |
| **Payments** | webhook signature verification; raw-body parsing; idempotent invoices |
| **Audit** | append-only `AuditLog` + 90-day TTL `ActivityLog` |
| **Proctoring** | integrity scoring + auto-flagging of suspicious interviews |
| **Monitoring** | optional Sentry capture of 5xx errors |

> **Operational reminders:** rotate any shared API keys, change seeded passwords, and set per-company
> AI quotas before going live.

---

## 21. Testing Procedures

- **Framework**: Vitest (server). Config + setup under `server/`.
- **Coverage**: core engine + util logic — scoring aggregation, `adaptDifficulty` / `isComplete`, `recommendationFromScore`, `extractJson`, template `interpolate`, `parseListQuery`, `paginate`, `slug`, `ApiError`.

```bash
cd server && npm test          # Vitest unit suite
cd client && npx tsc --noEmit  # type-check
cd client && npm run build     # production build (route compilation)
```

- **CI** runs lint + tests + build on every push/PR (see CI/CD).
- **Manual smoke**: `npm run check:db` (Mongo+Redis), seed demo data, log in per role, run a demo interview end-to-end.

### Suggested future tests
Playwright e2e for the interview room, integration tests for the billing webhook flow, and contract
tests for the AI engines with recorded fixtures.

---

## 22. Developer Documentation

### Conventions
- **Backend**: ESM modules, JSDoc types, thin controllers, business logic in services, schemas in validators (Zod), enums centralized in `constants/enums.js`.
- **Frontend**: App Router, server components by default, client components where browser APIs/interactivity are needed; data fetching via React Query + typed API clients in `lib/`; global state in Zustand stores.
- **Errors**: throw `ApiError(status, message, code, details)`; never leak stack traces in prod.
- **Responses**: always wrap in `ApiResponse`.

### Adding a feature (backend)
1. Add/extend a Mongoose model in `models/` (+ register in `models/index.js`).
2. Add a Zod schema in `validators/`.
3. Add business logic to a service in `services/`.
4. Add a thin controller in `controllers/`.
5. Wire a route in `routes/` with `authenticate` + `rbac(...)` (+ `requireTenant` for company scope).

### Adding a page (frontend)
1. Create the route under `src/app/...`.
2. Add a typed client call in `lib/*.api.ts`.
3. Use `ui/` components + design tokens; add to `nav.config.ts` if it's a dashboard page.

### Adding an AI capability
Extend a module in `services/ai/`, route the call through `claude.client.js` (so `AiUsage` is logged),
and add/override the prompt in `prompts/` (DB-overridable by super-admin).

---

## 23. Maintenance Guidelines

- **Dependencies**: review and bump monthly; run `npm audit` and the Vitest suite before merging upgrades.
- **Database indexes**: in prod run `Model.syncIndexes()` after schema changes (autoIndex off).
- **Backups**: schedule Mongo snapshots; periodically test restores. Super-admin "backup" trigger is a convenience hook — wire it to your storage in ops.
- **Logs**: ship pino JSON logs to Loki/Datadog/CloudWatch; watch error rate via Sentry.
- **AI cost**: monitor `AiUsage` (super-admin AI analytics); set per-company token quotas.
- **Secrets rotation**: rotate `JWT_*`, `ANTHROPIC_API_KEY`, and payment keys on a schedule.
- **Data retention**: `ActivityLog` auto-expires at 90 days; review retention policy for transcripts/recordings.
- **Seeded credentials**: ensure default admin/demo passwords are changed in any shared environment.

---

## 24. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `querySrv ECONNREFUSED` connecting to Atlas | Network blocks DNS SRV lookups for `mongodb+srv://` | Use the **standard** non-SRV `MONGO_URI` with explicit shard hosts + `replicaSet` |
| "Too many auth attempts" on localhost | Shared-IP rate limiter | Limiter is disabled outside prod; clear stuck counters with `redis-cli FLUSHALL` |
| `/interview/[token]` 500 / "Jest worker child process exceptions" | SSR crash on browser-only APIs (camera/MediaRecorder/speech) | Page already loads `PreCheck`+`InterviewRoom` via `next/dynamic` `ssr:false` — ensure you didn't remove that |
| Fixes don't take effect | Stale hot-reload (nodemon/Next) | Clean restart: stop node procs, ensure Redis up, `npm run dev` in both apps |
| No AI questions / generic fallbacks | `ANTHROPIC_API_KEY` missing/invalid | Set a valid key; the engine intentionally falls back when AI is unavailable |
| TTS not Indian/Hindi voice | OS lacks the voice | Voice quality depends on OS-installed voices; install an en-IN/hi-IN voice |
| STT not working | Browser lacks Web Speech API | Use a Chromium-based browser (Chrome/Edge) |
| Redis not found on Windows | No Docker/winget | Use a portable Redis build, or `docker-compose up redis` |
| Payments inactive | Provider keys blank | Set Stripe/Razorpay keys; billing is intentionally disabled until configured |
| Webhook signature failures | Body parsed before verification | Webhooks must use the raw body route mounted **before** the JSON parser |

---

## 25. Future Roadmap

**Requested but not yet built** (offered to stakeholders):
- Deep subscription extension (granular limits/coupons/taxes/invoices beyond the current Plan model)
- Per-company branding overrides (beyond the global white-label singleton)
- Custom AI interviewer profiles (name / avatar / voice / personality per company)
- Granular role/permission builder (beyond the current 5-role RBAC)
- **Live adapters for non-Claude providers** (Gemini/OpenAI/Azure/Groq/OpenRouter are stored but only Claude is wired live)
- Deeper analytics dashboards (storage / security / health monitors)
- Email-template builder UI

**Possible future work:**
- Deepen dashboard tables/forms (floating labels, data-grid polish)
- R3F 3D hero object
- Real face-detection proctoring (multi-face / face-missing)
- Razorpay checkout widget
- Playwright e2e tests
- Seed default email templates

---

## 26. Credits & License

**Developed by** Appsgain Technologies
**Built by** Prashant Singh Kushwaha

This software is **proprietary** — all rights reserved. No part of this codebase may be copied,
distributed, or used without express permission from the copyright holders.

---

<div align="center">

*HireSense AI — precision hiring, powered by AI.*

</div>
