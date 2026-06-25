import { Page } from '../../models/Page.js';
import { BlogPost } from '../../models/BlogPost.js';
import { Faq } from '../../models/Faq.js';
import { Testimonial } from '../../models/Testimonial.js';
import { Announcement } from '../../models/Announcement.js';
import { Template } from '../../models/Template.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { slugify } from '../../utils/slug.js';
import { audit } from '../../services/audit.service.js';

/**
 * Generic admin CRUD factory for CMS collections. Each resource gets list /
 * create / update / remove; slug-based resources auto-generate a slug.
 */
function crud(Model, { searchFields = [], slugFrom = null, defaultSort = '-createdAt', stamp = {} } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const opts = parseListQuery(req.query, { searchFields, defaultSort });
      if (req.query.status) opts.filter.status = req.query.status;
      const { items, meta } = await paginateQuery(Model, opts.filter, opts);
      return ok(res, items, 'OK', meta);
    }),
    create: asyncHandler(async (req, res) => {
      const data = { ...req.body, ...stampValues(stamp, req) };
      if (slugFrom && req.body[slugFrom]) data.slug = slugify(req.body[slugFrom]);
      if (Model.modelName === 'BlogPost' && req.body.status === 'published') data.publishedAt = new Date();
      const doc = await Model.create(data);
      await audit({ req, action: `cms.${Model.modelName.toLowerCase()}.create`, entityType: Model.modelName, entityId: doc._id });
      return created(res, doc);
    }),
    update: asyncHandler(async (req, res) => {
      if (Model.modelName === 'BlogPost' && req.body.status === 'published') req.body.publishedAt = req.body.publishedAt || new Date();
      const doc = await Model.findByIdAndUpdate(req.params.id, { $set: { ...req.body, ...stampValues(stamp, req) } }, { new: true, runValidators: true });
      if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
      return ok(res, doc, 'Updated');
    }),
    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
      await audit({ req, action: `cms.${Model.modelName.toLowerCase()}.delete`, entityType: Model.modelName, entityId: req.params.id });
      return ok(res, null, 'Deleted');
    }),
  };
}

const stampValues = (stamp, req) => {
  const out = {};
  if (stamp.updatedBy) out.updatedBy = req.user._id;
  if (stamp.author && req.method === 'POST') out.author = req.user._id;
  if (stamp.createdBy && req.method === 'POST') out.createdBy = req.user._id;
  return out;
};

export const pages = crud(Page, { searchFields: ['title', 'slug'], slugFrom: 'title', stamp: { updatedBy: true } });
export const blog = crud(BlogPost, { searchFields: ['title', 'excerpt'], slugFrom: 'title', stamp: { author: true } });
export const faqs = crud(Faq, { searchFields: ['question'], defaultSort: 'order' });
export const testimonials = crud(Testimonial, { searchFields: ['name', 'company'], defaultSort: 'order' });
export const announcements = crud(Announcement, { searchFields: ['title'], stamp: { createdBy: true } });
export const templates = crud(Template, { searchFields: ['key', 'name'], stamp: { updatedBy: true } });
