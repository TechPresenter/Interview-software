import { z } from 'zod';
import { emptyToUndefined } from './shared.js';
import { PAYMENT_MODES } from '../services/application.service.js';

/**
 * The admin-editable configuration behind the public application form.
 *
 * Every field is optional: this is a PATCH of the live config, and the service
 * writes only the keys it is given. Sending `{ paymentUrl }` must not silently
 * blank the declaration text.
 */

/**
 * The Pay Now target.
 *
 * Only http(s), and the check is on a PARSED url rather than a regex: this value
 * is handed to a candidate's browser to navigate to, so `javascript:` here would
 * be a stored XSS with an admin as the author and every applicant as the target.
 * A startsWith('http') test would also pass `https://evil` — the parse is the
 * point.
 */
const paymentUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .max(2000)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Enter a full payment link starting with https://')
    .optional(),
);

export const applicationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  // How the fee is collected: gateway (cashfree), manual link, or off.
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  paymentUrl,
  // 0 is meaningful — it turns the fee off — so this must not be coerced through
  // a truthiness check anywhere downstream.
  fee: z.coerce.number().min(0).max(1_000_000).optional(),
  currency: z.preprocess(emptyToUndefined, z.string().min(3).max(3).toUpperCase().optional()),
  // The wording an applicant legally ticks. Long enough for real terms; never
  // blank, because it is frozen onto every application as what they agreed to.
  declarationText: z.preprocess(emptyToUndefined, z.string().min(10).max(2000).optional()),
  paymentInstructions: z.string().max(2000).optional(),
});

export default { applicationConfigSchema };
