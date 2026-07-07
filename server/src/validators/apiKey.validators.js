import { z } from 'zod';

/** Create a company integration API key. */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, 'Give the key a name').max(60),
  scopes: z.array(z.enum(['read', 'write'])).nonempty().optional(),
});
