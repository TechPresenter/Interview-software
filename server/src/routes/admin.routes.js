import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createCompanySchema,
  updateCompanySchema,
  upsertPlanSchema,
  createCouponSchema,
  upsertQuestionSchema,
  bulkQuestionsSchema,
  aiSettingsSchema,
  aiWeightageSchema,
  aiPromptSchema,
  settingsGroupSchema,
} from '../validators/admin.validators.js';

import * as dashboard from '../controllers/admin/dashboard.controller.js';
import * as companies from '../controllers/admin/company.controller.js';
import * as subs from '../controllers/admin/subscription.controller.js';
import * as questions from '../controllers/admin/question.controller.js';
import * as ai from '../controllers/admin/ai.controller.js';
import * as system from '../controllers/admin/system.controller.js';
import * as cms from '../controllers/admin/cms.controller.js';
import * as adminCandidates from '../controllers/admin/candidate.controller.js';
import * as branding from '../controllers/admin/branding.controller.js';
import * as aiProviders from '../controllers/admin/aiProvider.controller.js';
import { updateCandidateAdminSchema, createAiProviderSchema, updateAiProviderSchema } from '../validators/admin.validators.js';
import { brandingSchema } from '../validators/branding.validators.js';
import { uploadImage } from '../middleware/upload.js';
import {
  pageSchema,
  pageUpdate,
  blogSchema,
  blogUpdate,
  faqSchema,
  faqUpdate,
  testimonialSchema,
  testimonialUpdate,
  announcementSchema,
  announcementUpdate,
  templateSchema,
  templateUpdate,
} from '../validators/cms.validators.js';

export const router = Router();

// Everything here requires an authenticated super-admin.
router.use(authenticate, rbac()); // rbac() with no extra roles ⇒ super_admin only

/* ── Dashboard ─────────────────────────────────────────── */
router.get('/overview', dashboard.overview);
router.get('/overview/timeseries', dashboard.series);
router.get('/health', dashboard.health);
router.get('/activity', dashboard.activity);
router.get('/recordings', dashboard.recordings);
router.get('/recordings/:id', dashboard.recordingDetail);

/* ── Companies ─────────────────────────────────────────── */
router.get('/companies', companies.list);
router.post('/companies', validate(createCompanySchema), companies.create);
router.get('/companies/:id', companies.getOne);
router.patch('/companies/:id', validate(updateCompanySchema), companies.update);
router.post('/companies/:id/suspend', companies.suspend);
router.post('/companies/:id/activate', companies.activate);
router.get('/companies/:id/billing', companies.billing);

/* ── White-label branding ──────────────────────────────── */
router.get('/branding', branding.get);
router.put('/branding', validate(brandingSchema), branding.update);
router.post('/branding/asset', uploadImage, branding.uploadAsset);

/* ── Candidates (platform-wide) ────────────────────────── */
router.get('/candidates', adminCandidates.list);
router.patch('/candidates/:id', validate(updateCandidateAdminSchema), adminCandidates.update);
router.delete('/candidates/:id', adminCandidates.remove);

/* ── Subscriptions / plans / coupons / invoices ────────── */
router.get('/plans', subs.listPlans);
router.put('/plans', validate(upsertPlanSchema), subs.upsertPlan);
router.post('/plans/seed', subs.seedPlans);
router.get('/subscriptions', subs.listSubscriptions);
router.get('/coupons', subs.listCoupons);
router.post('/coupons', validate(createCouponSchema), subs.createCoupon);
router.patch('/coupons/:id', subs.updateCoupon);
router.delete('/coupons/:id', subs.deleteCoupon);
router.get('/invoices', subs.listInvoices);

/* ── Question bank ─────────────────────────────────────── */
router.get('/questions', questions.list);
router.get('/questions/stats', questions.stats);
router.post('/questions', validate(upsertQuestionSchema), questions.create);
router.post('/questions/bulk', validate(bulkQuestionsSchema), questions.bulkCreate);
router.patch('/questions/:id', validate(upsertQuestionSchema), questions.update);
router.delete('/questions/:id', questions.remove);

/* ── AI management ─────────────────────────────────────── */
router.get('/ai/settings', ai.getSettings);
router.put('/ai/settings', validate(aiSettingsSchema), ai.updateSettings);
router.post('/ai/test', ai.testConnection);
router.get('/ai/weightage', ai.getWeightage);
router.put('/ai/weightage', validate(aiWeightageSchema), ai.updateWeightage);
router.get('/ai/prompts', ai.getPrompts);
router.put('/ai/prompts', validate(aiPromptSchema), ai.updatePrompt);
router.get('/ai/analytics', dashboard.aiAnalytics);
router.get('/ai/usage/top-companies', ai.topConsumers);

/* ── AI providers (multi-provider management) ──────────── */
router.get('/ai-providers', aiProviders.list);
router.post('/ai-providers', validate(createAiProviderSchema), aiProviders.create);
router.patch('/ai-providers/:id', validate(updateAiProviderSchema), aiProviders.update);
router.post('/ai-providers/:id/default', aiProviders.setDefault);
router.delete('/ai-providers/:id', aiProviders.remove);

/* ── System settings + audit + backup ──────────────────── */
router.get('/audit-logs', system.auditLogs);
router.post('/backup', system.triggerBackup);
router.get('/system/:group', system.getSettingsGroup);
router.put('/system/:group', validate(settingsGroupSchema), system.updateSettingsGroup);

/* ── CMS ───────────────────────────────────────────────── */
const cmsResource = (path, ctrl, createSchema, updateSchema) => {
  router.get(`/cms/${path}`, ctrl.list);
  router.post(`/cms/${path}`, validate(createSchema), ctrl.create);
  router.patch(`/cms/${path}/:id`, validate(updateSchema), ctrl.update);
  router.delete(`/cms/${path}/:id`, ctrl.remove);
};
cmsResource('pages', cms.pages, pageSchema, pageUpdate);
cmsResource('blog', cms.blog, blogSchema, blogUpdate);
cmsResource('faqs', cms.faqs, faqSchema, faqUpdate);
cmsResource('testimonials', cms.testimonials, testimonialSchema, testimonialUpdate);
cmsResource('announcements', cms.announcements, announcementSchema, announcementUpdate);
cmsResource('templates', cms.templates, templateSchema, templateUpdate);

export default router;
