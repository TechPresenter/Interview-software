import { Page } from '../models/Page.js';
import { BlogPost } from '../models/BlogPost.js';
import { Faq } from '../models/Faq.js';
import { Testimonial } from '../models/Testimonial.js';
import { Announcement } from '../models/Announcement.js';
import { Plan } from '../models/Plan.js';
import { Branding } from '../models/Branding.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../utils/query.js';
import { getPublicCaptchaConfig } from '../services/captcha.service.js';
import { INTEGRATIONS, renderTemplate } from '../config/integrations.catalog.js';
import { redis } from '../config/redis.js';

/**
 * Public, read-only content endpoints for the marketing site. Only published /
 * active records are exposed.
 */

/** GET /content/pages/:slug */
export const page = asyncHandler(async (req, res) => {
  const doc = await Page.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!doc) throw ApiError.notFound('Page not found');
  return ok(res, doc);
});

/** GET /content/blog */
export const blogList = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['title', 'excerpt', 'tags'], defaultSort: '-publishedAt' });
  const filter = { ...opts.filter, status: 'published' };
  const { items, meta } = await paginateQuery(BlogPost, filter, opts, [{ path: 'author', select: 'name avatar' }]);
  return ok(res, items, 'OK', meta);
});

/** GET /content/blog/:slug — also increments the view counter. */
export const blogPost = asyncHandler(async (req, res) => {
  const doc = await BlogPost.findOneAndUpdate(
    { slug: req.params.slug, status: 'published' },
    { $inc: { views: 1 } },
    { new: true },
  )
    .populate('author', 'name avatar')
    .lean();
  if (!doc) throw ApiError.notFound('Post not found');
  return ok(res, doc);
});

/** GET /content/faqs */
export const faqs = asyncHandler(async (_req, res) => {
  const items = await Faq.find({ isActive: true }).sort('order').lean();
  return ok(res, items);
});

/** GET /content/testimonials */
export const testimonials = asyncHandler(async (_req, res) => {
  const items = await Testimonial.find({ isActive: true }).sort('order').lean();
  return ok(res, items);
});

/** GET /content/announcements — currently active, platform-wide. */
export const announcements = asyncHandler(async (_req, res) => {
  const now = new Date();
  const items = await Announcement.find({
    isActive: true,
    company: null,
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  })
    .sort('-createdAt')
    .lean();
  return ok(res, items);
});

/** GET /content/plans — public pricing. */
export const plans = asyncHandler(async (_req, res) => {
  const items = await Plan.find({ isActive: true }).sort('sortOrder').lean();
  return ok(res, items);
});

/** GET /content/captcha — public CAPTCHA config for the site forms (no secret). */
export const captcha = asyncHandler(async (_req, res) => {
  return ok(res, await getPublicCaptchaConfig());
});

/**
 * GET /content/tracking — enabled, client-side tracking snippets for the site
 * (GA4, GTM, pixels, custom head/footer/JS). Only public IDs are ever exposed;
 * secret-marked fields are never used in a client snippet. Cached for 2 min.
 */
export const tracking = asyncHandler(async (_req, res) => {
  const cached = await redis.get('tracking:public');
  if (cached) return ok(res, JSON.parse(cached));

  const docs = await SystemSetting.find({ group: 'integrations' }).lean();
  const stored = {};
  for (const d of docs) stored[d.key.replace(/^integration\./, '')] = d.value || {};

  const head = [];
  const footer = [];
  const js = [];
  for (const def of INTEGRATIONS) {
    const val = stored[def.key];
    if (!val?.enabled) continue;
    // Only inject once every field this snippet needs is present.
    const filled = (def.fields || []).every((f) => val[f.key] != null && String(val[f.key]).trim() !== '');
    if (!filled) continue;
    if (def.inject) head.push({ key: def.key, html: renderTemplate(def.inject, val) });
    if (def.injectFooter) footer.push({ key: def.key, html: renderTemplate(def.injectFooter, val) });
    if (def.injectJs) js.push({ key: def.key, code: renderTemplate(def.injectJs, val) });
  }

  const payload = { head, footer, js };
  await redis.set('tracking:public', JSON.stringify(payload), 'EX', 120);
  return ok(res, payload);
});

/** GET /content/branding — public white-label config (no secrets). */
export const branding = asyncHandler(async (_req, res) => {
  const b = await Branding.getGlobal();
  return ok(res, {
    platformName: b.platformName,
    tagline: b.tagline,
    logoUrl: b.logoUrl,
    logoDarkUrl: b.logoDarkUrl,
    faviconUrl: b.faviconUrl,
    footerText: b.footerText,
    theme: b.theme,
    login: b.login,
    social: b.social,
    contact: b.contact,
    announcement: b.announcement,
    seo: b.seo,
    customCss: b.customCss,
  });
});
