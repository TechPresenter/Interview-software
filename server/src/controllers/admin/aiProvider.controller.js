import { AiProvider, PROVIDER_TYPES } from '../../models/AiProvider.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';

const mask = (p) => ({ ...p, apiKey: undefined, hasKey: Boolean(p.apiKey) });

/** GET /admin/ai-providers */
export const list = asyncHandler(async (_req, res) => {
  // apiKey is select:false so it's already excluded; surface a hasKey flag.
  const items = await AiProvider.find().sort('-isDefault -createdAt').lean();
  const withFlag = await Promise.all(
    items.map(async (p) => {
      const full = await AiProvider.findById(p._id).select('+apiKey').lean();
      return mask(full);
    }),
  );
  return ok(res, withFlag);
});

/** POST /admin/ai-providers */
export const create = asyncHandler(async (req, res) => {
  if (!PROVIDER_TYPES.includes(req.body.type)) throw ApiError.badRequest('Unknown provider type');
  const provider = await AiProvider.create({ ...req.body, createdBy: req.user._id });
  if (req.body.isDefault) await AiProvider.setDefault(provider._id);
  await audit({ req, action: 'ai_provider.create', entityType: 'AiProvider', entityId: provider._id });
  return created(res, mask(provider.toObject()), 'Provider added');
});

/** PATCH /admin/ai-providers/:id */
export const update = asyncHandler(async (req, res) => {
  // Don't overwrite the key with an empty string if the UI leaves it blank.
  if (req.body.apiKey === '' || req.body.apiKey == null) delete req.body.apiKey;
  const provider = await AiProvider.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!provider) throw ApiError.notFound('Provider not found');
  return ok(res, mask(provider.toObject()), 'Provider updated');
});

/** POST /admin/ai-providers/:id/default */
export const setDefault = asyncHandler(async (req, res) => {
  const provider = await AiProvider.setDefault(req.params.id);
  if (!provider) throw ApiError.notFound('Provider not found');
  await audit({ req, action: 'ai_provider.set_default', entityType: 'AiProvider', entityId: provider._id });
  return ok(res, mask(provider.toObject()), 'Default provider set');
});

/** DELETE /admin/ai-providers/:id */
export const remove = asyncHandler(async (req, res) => {
  const provider = await AiProvider.findByIdAndDelete(req.params.id);
  if (!provider) throw ApiError.notFound('Provider not found');
  await audit({ req, action: 'ai_provider.delete', entityType: 'AiProvider', entityId: req.params.id });
  return ok(res, null, 'Provider removed');
});
