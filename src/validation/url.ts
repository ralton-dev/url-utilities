import { z } from 'zod';

export const urlSchema = z.object({
  url: z.string().trim().url(),
  alias: z.string().optional(),
  count: z.number().optional(),
});
