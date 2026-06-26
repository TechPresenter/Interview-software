import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { audit } from '../services/audit.service.js';
import { ingestSources, applySources } from '../services/knowledgeBase.service.js';

/**
 * Knowledge Base CRUD. Tenant-aware: company users see/manage only their own KBs;
 * super-admins see all (optionally filtered by ?company). Mounted under both the
 * company router and the admin router.
 */

/** Accept urls as a JSON array, or a comma/newline-separated string. */
function parseUrls(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j;
  } catch {
    /* not JSON */
  }
  return String(v)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Filter for list queries. */
function scopeFilter(req) {
  if (req.user.role === 'super_admin') return req.query.company ? { company: req.query.company } : {};
  return { company: req.user.company };
}
/** Ownership guard for single-item operations. */
function ownership(req) {
  if (req.user.role === 'super_admin') return {};
  return { company: req.user.company };
}
/** Strip the heavy content/chunks fields before returning. */
function present(kb) {
  const o = kb.toObject ? kb.toObject() : kb;
  delete o.content;
  delete o.chunks;
  return o;
}

/** GET /knowledge-bases */
export const list = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  if (req.query.job) filter.job = req.query.job;
  if (req.query.status) filter.status = req.query.status;
  const items = await KnowledgeBase.find(filter).sort('-updatedAt').lean();
  return ok(res, items);
});

/** GET /knowledge-bases/:id — includes a content preview. */
export const getOne = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) }).select('+content +chunks');
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  const o = kb.toObject();
  o.contentPreview = (o.content || '').slice(0, 4000);
  o.chunkCount = (o.chunks || []).length;
  delete o.content;
  delete o.chunks;
  return ok(res, o);
});

/** POST /knowledge-bases — multipart: files[] + name/description/scope/job/urls/text. */
export const create = asyncHandler(async (req, res) => {
  if (!req.body.name) throw ApiError.badRequest('A name is required');
  const company = req.user.role === 'super_admin' ? req.body.company || null : req.user.company;
  const kb = new KnowledgeBase({
    name: req.body.name,
    description: req.body.description,
    company,
    scope: req.body.scope || (req.body.job ? 'job' : 'company'),
    job: req.body.job || null,
    createdBy: req.user._id,
  });
  const segments = await ingestSources({ files: req.files || [], urls: parseUrls(req.body.urls), text: req.body.text || '' });
  await applySources(kb, segments, { append: false });
  await audit({ req, action: 'kb.create', entityType: 'KnowledgeBase', entityId: kb._id, meta: { sources: segments.length } });
  return created(res, present(kb), 'Knowledge base created');
});

/** PATCH /knowledge-bases/:id — metadata only. */
export const update = asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'scope', 'job', 'status'];
  const patch = {};
  for (const f of fields) if (req.body[f] !== undefined) patch[f] = req.body[f];
  const kb = await KnowledgeBase.findOneAndUpdate({ _id: req.params.id, ...ownership(req) }, { $set: patch }, { new: true });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  await audit({ req, action: 'kb.update', entityType: 'KnowledgeBase', entityId: kb._id });
  return ok(res, present(kb), 'Knowledge base updated');
});

/** POST /knowledge-bases/:id/sources?mode=append|replace — add/replace material. */
export const addSources = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) }).select('+content +chunks');
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  const segments = await ingestSources({ files: req.files || [], urls: parseUrls(req.body.urls), text: req.body.text || '' });
  if (!segments.length) throw ApiError.badRequest('No files, URLs, or text provided');
  await applySources(kb, segments, { append: req.query.mode !== 'replace' });
  await audit({ req, action: 'kb.sources', entityType: 'KnowledgeBase', entityId: kb._id, meta: { mode: req.query.mode || 'append', added: segments.length } });
  return ok(res, present(kb), req.query.mode === 'replace' ? 'Knowledge base replaced' : 'Sources added');
});

/** POST /knowledge-bases/:id/toggle — enable/disable. */
export const toggle = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, ...ownership(req) });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  kb.status = kb.status === 'active' ? 'disabled' : 'active';
  await kb.save();
  await audit({ req, action: 'kb.toggle', entityType: 'KnowledgeBase', entityId: kb._id, meta: { status: kb.status } });
  return ok(res, present(kb), `Knowledge base ${kb.status}`);
});

/** DELETE /knowledge-bases/:id */
export const remove = asyncHandler(async (req, res) => {
  const kb = await KnowledgeBase.findOneAndDelete({ _id: req.params.id, ...ownership(req) });
  if (!kb) throw ApiError.notFound('Knowledge base not found');
  await audit({ req, action: 'kb.delete', entityType: 'KnowledgeBase', entityId: req.params.id });
  return ok(res, null, 'Knowledge base deleted');
});
