import { z } from 'zod';

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color');

/** All fields optional — the controller deep-merges only what is provided. */
export const brandingSchema = z.object({
  platformName: z.string().min(1).max(60).optional(),
  tagline: z.string().max(160).optional(),
  footerText: z.string().max(300).optional(),
  customCss: z.string().max(20000).optional(),

  theme: z
    .object({
      primary: hex.optional(),
      accent: hex.optional(),
      font: z.string().optional(),
      defaultMode: z.enum(['dark', 'light']).optional(),
    })
    .optional(),

  login: z
    .object({ headline: z.string().optional(), subtext: z.string().optional(), imageUrl: z.string().optional() })
    .optional(),

  social: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      linkedin: z.string().optional(),
      x: z.string().optional(),
      youtube: z.string().optional(),
      whatsapp: z.string().optional(),
      telegram: z.string().optional(),
    })
    .optional(),

  contact: z.object({ email: z.string().optional(), phone: z.string().optional(), address: z.string().optional() }).optional(),

  announcement: z
    .object({
      enabled: z.boolean().optional(),
      text: z.string().optional(),
      type: z.enum(['info', 'success', 'warning']).optional(),
      link: z.string().optional(),
    })
    .optional(),

  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      ogImage: z.string().optional(),
    })
    .optional(),
});
