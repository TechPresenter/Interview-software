import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { applicationConfig, saveApplicationConfig } from '../../services/application.service.js';
import { logActivity } from '../../services/audit.service.js';

/**
 * The admin's controls over the public application form.
 *
 * The payment link lives here rather than in env because the whole reason it is
 * a URL — instead of the gateway integration the billing module already has — is
 * that the admin must be able to change it without a deploy.
 */

/** GET /admin/applications/config */
export const get = asyncHandler(async (_req, res) => ok(res, await applicationConfig()));

/** PUT /admin/applications/config */
export const update = asyncHandler(async (req, res) => {
  const before = await applicationConfig();
  const config = await saveApplicationConfig(req.body, req.user._id);

  // Worth an audit line: this decides whether strangers can apply at all, and
  // where their money goes. Log what moved, never a wall of unchanged fields.
  const changed = Object.keys(req.body).filter((k) => before[k] !== config[k]);
  if (changed.length) {
    await logActivity({
      // `actor`, not `user` — logActivity destructures its argument, so a wrong
      // key is dropped in silence and the entry records that nobody did this.
      actor: req.user._id,
      // No `company`: applications belong to the platform, not a tenant.
      action: 'applications.config.updated',
      entityType: 'Settings',
      summary: `Application settings updated: ${changed.join(', ')}`,
      meta: { changed, enabled: config.enabled, paymentUrl: config.paymentUrl },
    });
  }
  return ok(res, config, 'Application settings saved');
});

export default { get, update };
