import { z } from 'zod';

/** Public newsletter subscription payload. */
export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  source: z.string().trim().max(60).optional(),
  // Honeypot — checked in the controller (not hard-failed) to avoid blocking
  // real users whose browser autofills this hidden field.
  company_website: z.string().max(200).optional(),
  // Optional CAPTCHA token (verified when captcha is enabled).
  captchaToken: z.string().max(4000).optional(),
});

/** Admin lead status/notes update. */
export const leadUpdateSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'archived']).optional(),
  notes: z.string().max(4000).optional(),
});
