import { Branding } from '../../models/Branding.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { saveBuffer } from '../../services/file.service.js';
import { audit } from '../../services/audit.service.js';

/** GET /admin/branding — full editable branding doc. */
export const get = asyncHandler(async (_req, res) => {
  return ok(res, await Branding.getGlobal());
});

const NESTED = ['theme', 'login', 'social', 'contact', 'announcement', 'seo'];

/** PUT /admin/branding — deep-merge update of the global branding. */
export const update = asyncHandler(async (req, res) => {
  const doc = await Branding.getGlobal();
  const body = req.body || {};

  for (const [key, value] of Object.entries(body)) {
    if (NESTED.includes(key) && value && typeof value === 'object') {
      doc[key] = { ...(doc[key]?.toObject?.() ?? doc[key] ?? {}), ...value };
    } else {
      doc[key] = value;
    }
  }
  doc.updatedBy = req.user._id;
  await doc.save();
  await audit({ req, action: 'branding.update', entityType: 'Branding', entityId: doc._id });
  return ok(res, doc, 'Branding updated');
});

/**
 * POST /admin/branding/asset?field=logoUrl|logoDarkUrl|faviconUrl|login.imageUrl|seo.ogImage
 * Uploads an image and stores its URL in the chosen field.
 */
export const uploadAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Image file required (field "image")');
  const field = req.query.field || 'logoUrl';
  const { url } = await saveBuffer(req.file.buffer, req.file.originalname);

  const doc = await Branding.getGlobal();
  if (field === 'login.imageUrl') doc.login.imageUrl = url;
  else if (field === 'seo.ogImage') doc.seo.ogImage = url;
  else if (['logoUrl', 'logoDarkUrl', 'faviconUrl'].includes(field)) doc[field] = url;
  else throw ApiError.badRequest('Invalid asset field');
  await doc.save();

  return ok(res, { url, field }, 'Asset uploaded');
});
