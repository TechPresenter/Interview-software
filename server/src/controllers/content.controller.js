import { Page } from '../models/Page.js';
import { BlogPost } from '../models/BlogPost.js';
import { Faq } from '../models/Faq.js';
import { Testimonial } from '../models/Testimonial.js';
import { Announcement } from '../models/Announcement.js';
import { Plan } from '../models/Plan.js';
import { Branding } from '../models/Branding.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../utils/query.js';

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
  const { items, meta } = await paginateQuery(BlogPost, filter, opts);
  return ok(res, items, 'OK', meta);
});

/** GET /content/blog/:slug — also increments the view counter. */
export const blogPost = asyncHandler(async (req, res) => {
  const doc = await BlogPost.findOneAndUpdate(
    { slug: req.params.slug, status: 'published' },
    { $inc: { views: 1 } },
    { new: true },
  ).lean();
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
