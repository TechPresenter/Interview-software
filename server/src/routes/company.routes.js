import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadResume, uploadCsv, uploadKnowledge, uploadImage } from '../middleware/upload.js';
import { ROLES } from '../constants/enums.js';
import {
  createJobSchema,
  updateJobSchema,
  createCandidateSchema,
  updateCandidateSchema,
  stageSchema,
  addNoteSchema,
  scheduleInterviewSchema,
  autoInterviewSchema,
} from '../validators/company.validators.js';

import * as overview from '../controllers/company/overview.controller.js';
import * as jobs from '../controllers/company/job.controller.js';
import * as candidates from '../controllers/company/candidate.controller.js';
import * as interviews from '../controllers/company/interview.controller.js';
import * as pipeline from '../controllers/company/pipeline.controller.js';
import * as reports from '../controllers/company/report.controller.js';
import * as billing from '../controllers/company/billing.controller.js';
import * as kb from '../controllers/knowledgeBase.controller.js';
import * as staffCtrl from '../controllers/company/staff.controller.js';
import * as roleCtrl from '../controllers/company/role.controller.js';
import * as emailCtrl from '../controllers/company/email.controller.js';
import * as gmailCtrl from '../controllers/company/gmail.controller.js';
import * as apiKeys from '../controllers/company/apiKey.controller.js';
import * as proctoring from '../controllers/proctoring.controller.js';
import * as account from '../controllers/company/account.controller.js';
import { createApiKeySchema } from '../validators/apiKey.validators.js';
import { deleteAccountSchema } from '../validators/company.validators.js';

export const router = Router();

// All company routes require an authenticated company-staff member (or super-admin)
// and a resolved tenant scope.
router.use(authenticate, rbac(ROLES.COMPANY_ADMIN, ROLES.RECRUITER, ROLES.HR_MANAGER), requireTenant);

/* ── Overview ──────────────────────────────────────────── */
router.get('/company/overview', overview.overview);

/* ── Custom AI interviewer ─────────────────────────────── */
router.get('/company/ai-interviewer', overview.getInterviewer);
router.put('/company/ai-interviewer', overview.updateInterviewer);
router.post('/company/ai-interviewer/avatar', uploadImage, overview.uploadInterviewerAvatar);

/* ── Account (company_admin: delete the whole workspace) ── */
router.delete('/company/account', rbac(ROLES.COMPANY_ADMIN), validate(deleteAccountSchema), account.deleteAccount);

/* ── Integration API keys (company_admin) ──────────────── */
router.get('/company/api-keys', rbac(ROLES.COMPANY_ADMIN), apiKeys.list);
router.post('/company/api-keys', rbac(ROLES.COMPANY_ADMIN), validate(createApiKeySchema), apiKeys.create);
router.delete('/company/api-keys/:id', rbac(ROLES.COMPANY_ADMIN), apiKeys.revoke);

/* ── Jobs ──────────────────────────────────────────────── */
router.get('/jobs', jobs.list);
router.post('/jobs', validate(createJobSchema), jobs.create);
router.get('/jobs/:id', jobs.getOne);
router.patch('/jobs/:id', validate(updateJobSchema), jobs.update);
router.delete('/jobs/:id', jobs.remove);
router.post('/jobs/:id/clone', jobs.clone);

/* ── Candidates ────────────────────────────────────────── */
router.get('/candidates', candidates.list);
router.post('/candidates', validate(createCandidateSchema), candidates.create);
router.post('/candidates/import', uploadCsv, candidates.importCsv);
router.get('/candidates/:id', candidates.getOne);
router.patch('/candidates/:id', validate(updateCandidateSchema), candidates.update);
router.delete('/candidates/:id', candidates.remove);
router.post('/candidates/:id/notes', validate(addNoteSchema), candidates.addNote);
router.post('/candidates/:id/resume', uploadResume, candidates.uploadResumeFile);
router.get('/candidates/:id/resume-analysis', candidates.reanalyzeResume);
router.patch('/candidates/:id/stage', validate(stageSchema), pipeline.moveStage);

/* ── Interviews ────────────────────────────────────────── */
router.get('/interviews', interviews.list);
router.get('/recordings', interviews.recordings);
router.post('/interviews', validate(scheduleInterviewSchema), interviews.schedule);
router.post('/interviews/auto', validate(autoInterviewSchema), interviews.autoSchedule);
router.get('/interviews/:id', interviews.getOne);
router.get('/interviews/:id/monitor', interviews.monitor);
router.post('/interviews/:id/invite', interviews.invite);
router.post('/interviews/:id/pause', interviews.pause);
router.post('/interviews/:id/resume', interviews.resume);
router.post('/interviews/:id/terminate', interviews.terminate);
router.post('/interviews/:id/cancel', interviews.cancel);

/* ── Staff & RBAC (company admin only; permissions readable by all staff) ── */
router.get('/company/me/permissions', staffCtrl.myPermissions);
router.get('/company/staff', rbac(ROLES.COMPANY_ADMIN), staffCtrl.list);
router.post('/company/staff', rbac(ROLES.COMPANY_ADMIN), staffCtrl.create);
router.get('/company/staff/login-history', rbac(ROLES.COMPANY_ADMIN), staffCtrl.loginHistory);
router.patch('/company/staff/:id', rbac(ROLES.COMPANY_ADMIN), staffCtrl.update);
router.delete('/company/staff/:id', rbac(ROLES.COMPANY_ADMIN), staffCtrl.remove);

router.get('/company/roles/catalog', rbac(ROLES.COMPANY_ADMIN), roleCtrl.catalog);
router.get('/company/roles', rbac(ROLES.COMPANY_ADMIN), roleCtrl.list);
router.post('/company/roles', rbac(ROLES.COMPANY_ADMIN), roleCtrl.create);
router.patch('/company/roles/:id', rbac(ROLES.COMPANY_ADMIN), roleCtrl.update);
router.delete('/company/roles/:id', rbac(ROLES.COMPANY_ADMIN), roleCtrl.remove);

/* ── Company email / SMTP (company admin) ── */
router.get('/company/email-config', rbac(ROLES.COMPANY_ADMIN), emailCtrl.getConfig);
router.put('/company/email-config', rbac(ROLES.COMPANY_ADMIN), emailCtrl.updateConfig);
router.post('/company/email-config/test', rbac(ROLES.COMPANY_ADMIN), emailCtrl.testConfig);
router.get('/company/email-logs', rbac(ROLES.COMPANY_ADMIN), emailCtrl.logs);
router.post('/company/email-logs/:id/retry', rbac(ROLES.COMPANY_ADMIN), emailCtrl.retry);

/* ── Connect Gmail (OAuth 2.0) for outgoing email ── */
router.get('/company/email/gmail/authorize', rbac(ROLES.COMPANY_ADMIN), gmailCtrl.authorize);
router.post('/company/email/gmail/disconnect', rbac(ROLES.COMPANY_ADMIN), gmailCtrl.disconnect);

/* ── Pipeline ──────────────────────────────────────────── */
router.get('/pipeline', pipeline.board);

/* ── Proctoring audit (company-scoped) ─────────────────── */
router.get('/proctoring', proctoring.list);
router.get('/proctoring/stats', proctoring.stats);
router.get('/proctoring/export', proctoring.exportCsv);
router.get('/proctoring/:id', proctoring.detail);

/* ── Reports (specific routes before :id) ──────────────── */
router.get('/reports', reports.list);
router.get('/reports/analytics', reports.analytics);
router.get('/reports/ranking', reports.ranking);
router.get('/reports/ranking/export', reports.exportRanking);
router.get('/reports/:id', reports.getOne);
router.get('/reports/:id/export', reports.exportReport);

/* ── Knowledge bases ───────────────────────────────────── */
router.get('/knowledge-bases', kb.list);
router.post('/knowledge-bases', uploadKnowledge, kb.create);
router.get('/knowledge-bases/:id', kb.getOne);
router.patch('/knowledge-bases/:id', kb.update);
router.post('/knowledge-bases/:id/sources', uploadKnowledge, kb.addSources);
router.post('/knowledge-bases/:id/toggle', kb.toggle);
router.delete('/knowledge-bases/:id', kb.remove);

/* ── Billing ───────────────────────────────────────────── */
router.get('/billing', billing.summary);
router.get('/billing/invoices', billing.invoices);
router.get('/billing/invoices/:id/pdf', billing.invoicePdf);
router.post('/billing/checkout', billing.checkout);
router.post('/billing/razorpay/verify', billing.verifyRazorpay);
router.post('/billing/cancel', billing.cancel);

export default router;
