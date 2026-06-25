import { z } from 'zod';

const status = z.enum(['draft', 'published']);

export const pageSchema = z.object({
  title: z.string().min(2),
  content: z.string().optional(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional(), keywords: z.array(z.string()).optional() }).optional(),
  status: status.optional(),
});

export const blogSchema = z.object({
  title: z.string().min(2),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  status: status.optional(),
});

export const faqSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(1),
  category: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const testimonialSchema = z.object({
  name: z.string().min(2),
  role: z.string().optional(),
  company: z.string().optional(),
  avatar: z.string().url().optional(),
  quote: z.string().min(3),
  rating: z.number().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
  order: z.number().optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().optional(),
  type: z.enum(['info', 'success', 'warning', 'critical']).optional(),
  audience: z.enum(['all', 'companies', 'candidates']).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const templateSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  channel: z.enum(['email', 'sms', 'whatsapp', 'in_app']).optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// Partial variants for updates.
export const pageUpdate = pageSchema.partial();
export const blogUpdate = blogSchema.partial();
export const faqUpdate = faqSchema.partial();
export const testimonialUpdate = testimonialSchema.partial();
export const announcementUpdate = announcementSchema.partial();
export const templateUpdate = templateSchema.partial();
