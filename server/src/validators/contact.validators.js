import { z } from 'zod';

const optional = (max) => z.string().trim().max(max).optional().or(z.literal(''));

/** Public contact form payload. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(40),
  country: optional(60),
  company: optional(120),
  jobTitle: optional(120),
  subject: z.enum(['Sales', 'Support', 'Partnerships', 'Media & Press', 'Careers', 'Other']).default('Sales'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
  // Honeypot — checked in the controller (NOT hard-failed here) so a browser /
  // password-manager that autofills this hidden field can't block a real user.
  company_website: z.string().max(200).optional(),
  // Optional CAPTCHA token (verified in the controller when captcha is enabled).
  captchaToken: z.string().max(4000).optional(),
});

export default contactSchema;
