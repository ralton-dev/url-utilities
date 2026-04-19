import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    APP_URL: z.string().url(),
    API_KEY: z.string().min(1),
    POSTGRES_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
