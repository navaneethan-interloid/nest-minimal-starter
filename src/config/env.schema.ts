import { z } from 'zod';

export const appConfigSchema = z.object({
  // =============================================================================
  // Application
  // =============================================================================
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),

  // =============================================================================
  // Logging
  // =============================================================================
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('debug'),
  // Coerces string 'true'/'false' or '1'/'0' into an actual boolean
  LOG_PRETTY: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true' || val === '1') return true;
        if (val.toLowerCase() === 'false' || val === '0') return false;
      }
      return val;
    }, z.boolean())
    .default(true),

  // =============================================================================
  // CORS
  // =============================================================================
  // Transforms comma-separated string into a clean string array, or empty array if empty
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(',').map((origin) => origin.trim()) : [],
    ),
  CORS_PATTERN: z
    .string()
    .optional()
    .transform((val) =>
      val && val.trim() !== '' ? new RegExp(val) : undefined,
    ),

  // =============================================================================
  // Throttler
  // =============================================================================
  THROTTLER_LIMIT: z.coerce.number().default(100),
  THROTTLER_TTL_MS: z.coerce.number().default(60000),

  // =============================================================================
  // CSRF
  // =============================================================================
  CSRF_ENABLED: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true' || val === '1') return true;
        if (val.toLowerCase() === 'false' || val === '0') return false;
      }
      return val;
    }, z.boolean())
    .default(false),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
