import { z } from 'zod';

const opt = (max) => z.string().trim().max(max).optional().or(z.literal(''));

/** Update the signed-in user's own profile (all roles). */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
  phone: opt(40),
  dob: opt(20),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '']).optional(),
  address: opt(200),
  city: opt(80),
  state: opt(80),
  country: opt(80),
  postalCode: opt(20),
});
