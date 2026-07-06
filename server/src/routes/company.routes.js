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
router.post('/interviews/:id/invite', interviews.invite);
router.post('/interviews/:id/cancel', interviews.cancel);

/* ── Pipeline ──────────────────────────────────────────── */
router.get('/pipeline', pipeline.board);

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
