import { z } from 'zod';

/**
 * PATCH semantics: every field optional, only supplied keys move. Values are
 * printed verbatim onto invoices, so lengths are bounded but content is the
 * admin's own (a legal name can legitimately contain almost anything).
 */
export const billingConfigSchema = z.object({
  legalName: z.string().max(200).optional(),
  address: z.string().max(600).optional(),
  // 15-char GSTIN, or empty to turn GST off. Format-checked loosely: state
  // code + PAN + entity + Z + checksum, but typos are the admin's to own.
  gstin: z
    .string()
    .max(15)
    .refine((v) => v === '' || /^[0-9]{2}[A-Z0-9]{13}$/i.test(v), 'Enter a valid 15-character GSTIN, or leave empty')
    .optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(160).optional(),
  website: z.string().max(200).optional(),
  terms: z.string().max(2000).optional(),
});

export default { billingConfigSchema };
