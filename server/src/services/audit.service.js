import { AuditLog } from '../models/AuditLog.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { logger } from '../config/logger.js';

/**
 * Append a security/compliance audit entry. Never throws into the caller — audit
 * failures are logged but must not break the primary operation.
 */
export async function audit({ req, action, status = 'success', entityType, entityId, changes, meta }) {
  try {
    await AuditLog.create({
      actor: req?.user?._id,
      actorRole: req?.user?.role,
      company: req?.user?.company,
      action,
      status,
      entityType,
      entityId,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      changes,
      meta,
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}

/** Append a product-level activity event (for live feeds/dashboards). */
export async function logActivity({ company, actor, action, entityType, entityId, summary, meta }) {
  try {
    return await ActivityLog.create({ company, actor, action, entityType, entityId, summary, meta });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write activity log');
    return null;
  }
}

export default audit;
