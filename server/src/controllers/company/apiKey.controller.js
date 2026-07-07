import crypto from 'node:crypto';
import { ApiKey } from '../../models/ApiKey.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';

const PREFIX = 'aipl_live_';

/** GET /company/api-keys — list active keys (masked). */
export const list = asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ company: req.companyId, revokedAt: null }).sort('-createdAt').lean();
  return ok(res, keys);
});

/**
 * POST /company/api-keys — generate a new key. The full secret is returned once
 * and cannot be retrieved again (only its hash is stored).
 */
export const create = asyncHandler(async (req, res) => {
  const secret = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const fullKey = `${PREFIX}${secret}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  const doc = await ApiKey.create({
    company: req.companyId,
    name: req.body.name,
    scopes: req.body.scopes?.length ? req.body.scopes : ['read'],
    prefix: `${PREFIX}${secret.slice(0, 6)}`,
    last4: secret.slice(-4),
    keyHash,
    createdBy: req.user._id,
  });

  await audit({ req, action: 'company.api_key.create', entityType: 'ApiKey', entityId: doc._id });

  return created(res, {
    _id: doc._id,
    name: doc.name,
    scopes: doc.scopes,
    prefix: doc.prefix,
    last4: doc.last4,
    createdAt: doc.createdAt,
    // Shown once — store it securely now.
    key: fullKey,
  });
});

/** DELETE /company/api-keys/:id — revoke a key. */
export const revoke = asyncHandler(async (req, res) => {
  const doc = await ApiKey.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!doc) throw ApiError.notFound('API key not found');
  await audit({ req, action: 'company.api_key.revoke', entityType: 'ApiKey', entityId: doc._id });
  return ok(res, null, 'API key revoked');
});
