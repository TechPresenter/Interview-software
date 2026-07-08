import { z } from 'zod';
import { DEMO_STATUSES } from '../models/DemoBooking.js';

const optional = (max) => z.string().trim().max(max).optional().or(z.literal(''));

/** Public "Book a Demo" submission. */
export const demoBookingSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  company: optional(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(40),
  country: optional(60),
  preferredDate: z.coerce.date().optional().or(z.literal('')),
  timeSlot: optional(60),
  timezone: optional(60),
  employees: optional(40),
  message: optional(4000),
  // Honeypot + optional captcha token.
  company_website: z.string().max(200).optional(),
  captchaToken: z.string().max(4000).optional(),
});

/** Admin update (status / assignee / notes / reschedule). */
export const demoUpdateSchema = z.object({
  status: z.enum(DEMO_STATUSES).optional(),
  assignedTo: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional().or(z.literal('')),
  notes: z.string().max(4000).optional(),
  preferredDate: z.coerce.date().nullable().optional().or(z.literal('')),
  timeSlot: z.string().max(60).optional(),
  timezone: z.string().max(60).optional(),
});
