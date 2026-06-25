import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  profile: z
    .object({
      headline: z.string().max(160).optional(),
      location: z.string().optional(),
      skills: z.array(z.string()).optional(),
      education: z
        .array(
          z.object({
            degree: z.string().optional(),
            institution: z.string().optional(),
            field: z.string().optional(),
            startYear: z.number().optional(),
            endYear: z.number().optional(),
          }),
        )
        .optional(),
      experience: z
        .array(
          z.object({
            title: z.string().optional(),
            company: z.string().optional(),
            current: z.boolean().optional(),
            description: z.string().optional(),
          }),
        )
        .optional(),
      portfolioLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
    })
    .optional(),
});
