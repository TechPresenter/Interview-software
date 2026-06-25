import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getGroup, setMany } from '../../services/settings.service.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { AuditLog } from '../../models/AuditLog.js';
import { audit } from '../../services/audit.service.js';

const ALLOWED_GROUPS = ['smtp', 'sms', 'payment', 'security', 'general', 'feature_flag'];

/** GET /admin/system/:group — settings for a group (secrets masked). */
export const getSettingsGroup = asyncHandler(async (req, res) => {
  const { group } = req.params;
  if (!ALLOWED_GROUPS.includes(group)) throw ApiError.badRequest('Unknown settings group');
  return ok(res, await getGroup(group));
});

/** PUT /admin/system/:group — upsert a batch of settings. */
export const updateSettingsGroup = asyncHandler(async (req, res) => {
  const { group } = req.params;
  if (!ALLOWED_GROUPS.includes(group)) throw ApiError.badRequest('Unknown settings group');
  const result = await setMany(group, req.body.entries, req.user._id);
  await audit({ req, action: 'system.settings.update', meta: { group } });
  return ok(res, result, 'Settings saved');
});

/** GET /admin/audit-logs — filterable security trail. */
export const auditLogs = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['action'] });
  if (req.query.action) opts.filter.action = req.query.action;
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.company) opts.filter.company = req.query.company;
  const { items, meta } = await paginateQuery(AuditLog, opts.filter, opts, { path: 'actor', select: 'name email role' });
  return ok(res, items, 'OK', meta);
});

/**
 * POST /admin/backup — trigger a logical backup job.
 * Backups should run via `mongodump` in an ops job / cron; this endpoint records
 * the request and returns guidance (real execution wired in Phase 6 DevOps).
 */
export const triggerBackup = asyncHandler(async (req, res) => {
  await audit({ req, action: 'system.backup.requested' });
  return ok(
    res,
    {
      status: 'queued',
      note: 'Backup is performed by the ops job (mongodump → object storage). See docs/DEPLOYMENT.md.',
      requestedAt: new Date(),
    },
    'Backup requested',
  );
});
