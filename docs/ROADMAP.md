# Roadmap

Phased delivery. Each phase produces runnable, reviewed code before the next begins.

## ✅ Phase 1 — Foundation (this commit)
- [x] Monorepo + docs (architecture, schema, API, deployment)
- [x] Backend: Express app, config, MongoDB, Redis, pino logger, Socket.IO bootstrap
- [x] Security: helmet, CORS, rate limiting, validation, central error handling
- [x] Auth: register, login, refresh-token rotation, logout, RBAC, email-verify/OTP/reset scaffolding
- [x] All 15 Mongoose models with indexes & relationships
- [x] AI engine: Claude client + interview / scoring / report / resume modules
- [x] Frontend: Next.js + Tailwind + design system, landing, auth, dashboard shell

## ✅ Phase 2 — Super Admin
- [x] Company CRUD + suspend/activate + analytics + billing view
- [x] Subscription plans, coupons/promo codes, invoices
- [x] Global question bank (technical/HR/aptitude/behavioral/coding/custom)
- [x] AI management (prompt templates, weightage), system settings (SMTP/SMS/payments)
- [x] Audit logs, backup mgmt, security settings, live activity feed

## ✅ Phase 3 — Company panel
- [x] Job CRUD + clone, skill/experience requirements
- [x] Candidate add / CSV import / resume upload + AI analysis / tracking
- [x] Interview scheduling, auto-interview, link generation, invitations
- [x] Pipeline (applied→screening→interview→shortlisted→hired/rejected)
- [x] Reports: ranking, AI reports, analytics, PDF/Excel export
- [x] Plan-limit enforcement (active jobs, monthly interviews)

## ✅ Phase 4 — Candidate portal & AI Interview Room
- [x] Candidate dashboard + profile + resume upload
- [x] Pre-check (camera/mic/internet/browser)
- [x] Live interview room: AI avatar, AI voice (TTS) + voice answers (STT), text Q, recording, transcript, autosave, timer, progress
- [x] Adaptive engine loop (greet → score → adapt → follow-up → report) over token-gated REST
- [x] Anti-cheat (tab/blur/paste/right-click/fullscreen, integrity score, auto-flag, logging)

## ✅ Phase 5 — Payments, CMS, notifications
- [x] Stripe + Razorpay behind a provider abstraction; subscription billing, invoices, webhooks (raw body)
- [x] Plan activation snapshots limits onto the company; coupon-aware pricing
- [x] CMS: pages, blog, FAQ, testimonials, announcements, email/notification templates (admin CRUD + public read)
- [x] Notifications: real SMTP (nodemailer), SMS + WhatsApp (Twilio), in-app realtime, template rendering
- [x] Public marketing: /pricing, /blog, /blog/[slug]

## ✅ Phase 6 — Hardening
- [x] Vitest unit tests (AI engines, scoring aggregation, query/util helpers) + setup
- [x] GitHub Actions CI/CD (server lint+test, web lint+build, docker build on main)
- [x] Error monitoring (optional Sentry, lazy-loaded) wired into the error handler
- [x] Performance: CDN cache headers on public content, compression
- [x] Accessibility: prefers-reduced-motion, focus-visible, skip-to-content, sr-only
- [x] SEO: sitemap.ts + robots.ts + rich metadata
- [x] Production build & deploy guide
