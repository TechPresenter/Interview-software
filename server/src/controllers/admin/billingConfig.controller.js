import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { billingIdentity, saveBillingConfig } from '../../services/billingConfig.service.js';
import { logActivity } from '../../services/audit.service.js';

/**
 * The seller identity printed on every invoice — legal name, address, GSTIN,
 * tax rate, terms. In Settings rather than env so finance details change
 * without a deploy; the env GST_NUMBER/GST_PERCENT remain the defaults until
 * this panel is first saved.
 */

/** GET /admin/billing/config */
export const get = asyncHandler(async (_req, res) => ok(res, await billingIdentity()));

/** PUT /admin/billing/config */
export const update = asyncHandler(async (req, res) => {
  const before = await billingIdentity();
  const config = await saveBillingConfig(req.body, req.user._id);

  const changed = Object.keys(req.body).filter((k) => before[k] !== config[k]);
  if (changed.length) {
    await logActivity({
      actor: req.user._id,
      action: 'billing.config.updated',
      entityType: 'Settings',
      summary: `Invoice/GST settings updated: ${changed.join(', ')}`,
      meta: { changed },
    });
  }
  return ok(res, config, 'Billing settings saved');
});

export default { get, update };
