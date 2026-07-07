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
      // Personal details
      dob: z.string().max(20).optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '']).optional(),
      address: z.string().max(200).optional(),
      city: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      country: z.string().max(80).optional(),
      postalCode: z.string().max(20).optional(),
      // Professional details
      qualification: z.string().max(120).optional(),
      totalExperience: z.string().max(40).optional(),
      currentCompany: z.string().max(120).optional(),
      currentDesignation: z.string().max(120).optional(),
      currentSalary: z.string().max(40).optional(),
      expectedSalary: z.string().max(40).optional(),
      noticePeriod: z.string().max(60).optional(),
      preferredLocation: z.string().max(120).optional(),
      linkedin: z.string().max(200).optional(),
      portfolio: z.string().max(200).optional(),
      summary: z.string().max(4000).optional(),
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
