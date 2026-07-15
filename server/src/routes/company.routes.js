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
import * as questions from '../controllers/company/question.controller.js';
import * as questionSets from '../controllers/company/questionSet.controller.js';
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
import {
  deleteAccountSchema,
  createQuestionSetSchema,
  updateQuestionSetSchema,
  autoQuestionSetSchema,
} from '../validators/company.validators.js';
import {
  upsertQuestionSchema,
  updateQuestionSchema,
  bulkQuestionsSchema,
  questionReviewSchema,
  bulkReviewSchema,
  generateQuestionsSchema,
  generateFromKnowledgeBaseSchema,
} from '../validators/admin.validators.js';
import { requirePermission } from '../services/permission.service.js';

export const router = Router();

// All company routes require an authenticated company-staff member (or super-admin)
// and a resolved tenant scope.
router.use(authenticate, rbac(ROLES.COMPANY_ADMIN, ROLES.RECRUITER, ROLES.HR_MANAGER), requireTenant);

/* ── Overview ──────────────────────────────────────────── */
// Deliberately ungated: the dashboard landing page, a summary of the caller's
// own workspace. Every staff role reaches it, and there is no module to hang it
// on that wouldn't lock someone out of their own home screen.
router.get('/company/overview', overview.overview);

/* ── Custom AI interviewer ─────────────────────────────── */
// The persona (name, voice, intro) that speaks to every candidate. The nav has
// always listed this page under company_admin only, but the routes never asked:
// recruiter and hr_manager both got a 200 from PUT and could rewrite the script.
// `settings` is false across the board for both in DEFAULT_PERMISSIONS.
router.get('/company/ai-interviewer', requirePermission('settings', 'read'), overview.getInterviewer);
router.put('/company/ai-interviewer', requirePermission('settings', 'update'), overview.updateInterviewer);
router.post('/company/ai-interviewer/avatar', requirePermission('settings', 'update'), uploadImage, overview.uploadInterviewerAvatar);

/* ── Account (company_admin: delete the whole workspace) ── */
router.delete('/company/account', rbac(ROLES.COMPANY_ADMIN), validate(deleteAccountSchema), account.deleteAccount);

/* ── Integration API keys (company_admin) ──────────────── */
router.get('/company/api-keys', rbac(ROLES.COMPANY_ADMIN), apiKeys.list);
router.post('/company/api-keys', rbac(ROLES.COMPANY_ADMIN), validate(createApiKeySchema), apiKeys.create);
router.delete('/company/api-keys/:id', rbac(ROLES.COMPANY_ADMIN), apiKeys.revoke);

/* ── Jobs ──────────────────────────────────────────────── */
router.get('/jobs', requirePermission('jobs', 'read'), jobs.list);
router.post('/jobs', requirePermission('jobs', 'create'), validate(createJobSchema), jobs.create);
router.get('/jobs/:id', requirePermission('jobs', 'read'), jobs.getOne);
router.patch('/jobs/:id', requirePermission('jobs', 'update'), validate(updateJobSchema), jobs.update);
// findOneAndDelete — a hard delete, and `delete` is false for every built-in
// role except company_admin.
router.delete('/jobs/:id', requirePermission('jobs', 'delete'), jobs.remove);
router.post('/jobs/:id/clone', requirePermission('jobs', 'create'), jobs.clone);

/* ── Candidates ────────────────────────────────────────── */
router.get('/candidates', requirePermission('candidates', 'read'), candidates.list);
router.post('/candidates', requirePermission('candidates', 'create'), validate(createCandidateSchema), candidates.create);
router.post('/candidates/import', requirePermission('candidates', 'create'), uploadCsv, candidates.importCsv);
router.post('/candidates/parse-resume', requirePermission('candidates', 'create'), uploadResume, candidates.parseResume);
router.get('/candidates/:id', requirePermission('candidates', 'read'), candidates.getOne);
router.patch('/candidates/:id', requirePermission('candidates', 'update'), validate(updateCandidateSchema), candidates.update);
router.delete('/candidates/:id', requirePermission('candidates', 'delete'), candidates.remove);
router.post('/candidates/:id/notes', requirePermission('candidates', 'update'), validate(addNoteSchema), candidates.addNote);
router.post('/candidates/:id/resume', requirePermission('candidates', 'update'), uploadResume, candidates.uploadResumeFile);
// A GET, but it re-runs the AI analysis and saves the result — it mutates and it
// bills. Gated on `update`, not `read`, so a read-only role cannot spend tokens.
router.get('/candidates/:id/resume-analysis', requirePermission('candidates', 'update'), candidates.reanalyzeResume);
// Moving a candidate between stages is a pipeline action, not a candidate edit.
router.patch('/candidates/:id/stage', requirePermission('pipeline', 'update'), validate(stageSchema), pipeline.moveStage);

/* ── Interviews ────────────────────────────────────────── */
router.get('/interviews', requirePermission('interviews', 'read'), interviews.list);
router.get('/recordings', requirePermission('recordings', 'read'), interviews.recordings);
router.post('/interviews', requirePermission('interviews', 'create'), validate(scheduleInterviewSchema), interviews.schedule);
router.post('/interviews/auto', requirePermission('interviews', 'create'), validate(autoInterviewSchema), interviews.autoSchedule);
router.get('/interviews/:id', requirePermission('interviews', 'read'), interviews.getOne);
router.get('/interviews/:id/monitor', requirePermission('interviews', 'read'), interviews.monitor);
router.post('/interviews/:id/invite', requirePermission('interviews', 'update'), interviews.invite);
router.post('/interviews/:id/pause', requirePermission('interviews', 'update'), interviews.pause);
router.post('/interviews/:id/resume', requirePermission('interviews', 'update'), interviews.resume);
router.post('/interviews/:id/terminate', requirePermission('interviews', 'update'), interviews.terminate);
router.post('/interviews/:id/cancel', requirePermission('interviews', 'update'), interviews.cancel);

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
router.get('/pipeline', requirePermission('pipeline', 'read'), pipeline.board);

/* ── Proctoring audit (company-scoped) ─────────────────── */
// Filed under `recordings`: this is per-session integrity evidence, the same
// audience as the recordings themselves. The `interviewer` role template grants
// recordings:read and no reports at all — someone running interviews should see
// the integrity evidence for them without unlocking the analytics suite.
router.get('/proctoring', requirePermission('recordings', 'read'), proctoring.list);
router.get('/proctoring/stats', requirePermission('recordings', 'read'), proctoring.stats);
router.get('/proctoring/export', requirePermission('recordings', 'read'), proctoring.exportCsv);
router.get('/proctoring/:id', requirePermission('recordings', 'read'), proctoring.detail);

/* ── Reports (specific routes before :id) ──────────────── */
/* ── Question bank ─────────────────────────────────────── */
// Previously super_admin-only under /admin, so companies got a 403 on their own bank.
router.get('/questions', requirePermission('questions', 'read'), questions.list);
router.get('/questions/stats', requirePermission('questions', 'read'), questions.stats);
router.post('/questions', requirePermission('questions', 'create'), validate(upsertQuestionSchema), questions.create);
router.post('/questions/bulk', requirePermission('questions', 'create'), validate(bulkQuestionsSchema), questions.bulkCreate);
router.post('/questions/generate', requirePermission('questions', 'create'), validate(generateQuestionsSchema), questions.generate);
router.post('/questions/bulk-review', requirePermission('questions', 'update'), validate(bulkReviewSchema), questions.bulkReview);
router.patch('/questions/:id', requirePermission('questions', 'update'), validate(updateQuestionSchema), questions.update);
router.post('/questions/:id/duplicate', requirePermission('questions', 'create'), questions.duplicate);
router.post('/questions/:id/archive', requirePermission('questions', 'update'), questions.archive);
router.post('/questions/:id/restore', requirePermission('questions', 'update'), questions.restore);
router.post('/questions/:id/review', requirePermission('questions', 'update'), validate(questionReviewSchema), questions.review);
router.post('/questions/:id/answer-key', requirePermission('questions', 'update'), questions.answerKey);
router.delete('/questions/:id', requirePermission('questions', 'delete'), questions.remove);

/* ── Question sets ─────────────────────────────────────── */
router.get('/question-sets', requirePermission('questions', 'read'), questionSets.list);
router.post('/question-sets', requirePermission('questions', 'create'), validate(createQuestionSetSchema), questionSets.create);
router.post('/question-sets/auto', requirePermission('questions', 'create'), validate(autoQuestionSetSchema), questionSets.auto);
router.get('/question-sets/:id', requirePermission('questions', 'read'), questionSets.getOne);
router.patch('/question-sets/:id', requirePermission('questions', 'update'), validate(updateQuestionSetSchema), questionSets.update);
router.post('/question-sets/:id/duplicate', requirePermission('questions', 'create'), questionSets.duplicate);
router.delete('/question-sets/:id', requirePermission('questions', 'delete'), questionSets.remove);

router.get('/reports', requirePermission('reports', 'read'), reports.list);
router.get('/reports/analytics', requirePermission('reports', 'read'), reports.analytics);
router.get('/reports/ranking', requirePermission('reports', 'read'), reports.ranking);
router.get('/reports/ranking/export', requirePermission('reports', 'read'), reports.exportRanking);
router.get('/reports/:id', requirePermission('reports', 'read'), reports.getOne);
router.get('/reports/:id/export', requirePermission('reports', 'read'), reports.exportReport);
// Re-runs the whole AI report and overwrites the existing one — billable, and
// destructive to a finished evaluation.
router.post('/reports/:id/regenerate', requirePermission('reports', 'update'), reports.regenerate);
router.post('/reports/:id/notes', requirePermission('reports', 'create'), reports.addNote);
router.delete('/reports/:id/notes/:noteId', requirePermission('reports', 'delete'), reports.removeNote);

/* ── Knowledge bases ───────────────────────────────────── */
// Every built-in role but company_admin is knowledge:read-only, yet all of these
// were open: a recruiter could create a KB (a real 201), replace a corpus via
// ?mode=replace, disable the KB every AI interview draws on, or delete it and
// its ingested chunks outright.
router.get('/knowledge-bases', requirePermission('knowledge', 'read'), kb.list);
router.post('/knowledge-bases', requirePermission('knowledge', 'create'), uploadKnowledge, kb.create);
router.get('/knowledge-bases/:id', requirePermission('knowledge', 'read'), kb.getOne);
router.patch('/knowledge-bases/:id', requirePermission('knowledge', 'update'), kb.update);
router.post('/knowledge-bases/:id/sources', requirePermission('knowledge', 'update'), uploadKnowledge, kb.addSources);
router.post('/knowledge-bases/:id/toggle', requirePermission('knowledge', 'update'), kb.toggle);
router.delete('/knowledge-bases/:id', requirePermission('knowledge', 'delete'), kb.remove);
// Writes into the question bank, so it takes the bank's create permission rather
// than the knowledge module's.
router.post(
  '/knowledge-bases/:id/generate-questions',
  requirePermission('questions', 'create'),
  validate(generateFromKnowledgeBaseSchema),
  kb.generateQuestions,
);

/* ── Billing ───────────────────────────────────────────── */
// These carried NO guard at all: any recruiter or HR manager could read the
// workspace's plan, usage and invoices, and POST /billing/checkout reached the
// payment controller — it only failed because no provider happened to be
// configured, which is luck, not authorisation. DEFAULT_PERMISSIONS has always
// granted those roles nothing on `billing`; the routes simply never asked.
// Money movement is company_admin's alone, matching /company/account and
// /company/api-keys.
router.get('/billing', requirePermission('billing', 'read'), billing.summary);
router.get('/billing/invoices', requirePermission('billing', 'read'), billing.invoices);
router.get('/billing/invoices/:id/pdf', requirePermission('billing', 'read'), billing.invoicePdf);
router.post('/billing/checkout', rbac(ROLES.COMPANY_ADMIN), billing.checkout);
router.post('/billing/razorpay/verify', rbac(ROLES.COMPANY_ADMIN), billing.verifyRazorpay);
router.post('/billing/cancel', rbac(ROLES.COMPANY_ADMIN), billing.cancel);

export default router;
