import { z } from 'zod';

/**
 * Reusable preprocessor helper that normalizes string variables
 * (like 'true', 'false', '1', '0') into standard JavaScript booleans.
 */
const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'true' || val === '1') return true;
    if (lower === 'false' || val === '0') return false;
  }
  return val;
}, z.boolean());

/**
 * Global Application Configuration Schema
 * Validates, transforms, and types environment variables across all core modules.
 */
export const appConfigSchema = z.object({
  // =============================================================================
  // APPLICATION & ENVIRONMENT INFRASTRUCTURE
  // =============================================================================
  /**
   * The port number the NestJS application server will bind to.
   */
  PORT: z.coerce.number().default(3000),

  /**
   * The active operational environment mode.
   */
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),

  /**
   * The absolute number of upstream proxy hops (e.g., Nginx, Cloudflare)
   * to trust for client IP determination.
   */
  TRUST_PROXY_DEPTH: z.coerce.number().default(1),

  // =============================================================================
  // LOGGER SYSTEM CONFIGURATION
  // =============================================================================
  /**
   * Minimum log level threshold allowed to stream to stdout or file transports.
   */
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('debug'),

  /**
   * System output structure style for stream targets.
   */
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  /**
   * Toggles whether logs should be synchronously piped to standard stdout streams.
   */
  LOG_ALSO_STDOUT: coerceBoolean.default(true),

  /**
   * The filesystem path directory where write streams write local log archives.
   */
  LOG_DIRECTORY: z.string().default('./logs'),

  /**
   * Number of standard days to preserve persistent tracking data logs before automatic rotation wipes them.
   */
  LOG_RETENTION_DAYS: z.coerce.number().default(7),

  // =============================================================================
  // SECURITY & NETWORK POLICIES (CORS / RATE-LIMITING)
  // =============================================================================
  /**
   * Transforms a raw comma-separated whitelist string into a clean string array.
   * Example: "https://a.com, https://b.com" -> ["https://a.com", "https://b.com"]
   */
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(',').map((origin) => origin.trim()) : [],
    ),

  /**
   * Compiles an optional cross-origin wild-card validation rule into an active RegExp instance.
   */
  CORS_PATTERN: z
    .string()
    .optional()
    .transform((val) =>
      val && val.trim() !== '' ? new RegExp(val) : undefined,
    ),

  /**
   * Maximum allowed request attempts within the specified execution time window.
   */
  THROTTLER_LIMIT: z.coerce.number().default(100),

  /**
   * Rate limiting Time-To-Live (TTL) configuration tracking period in milliseconds.
   */
  THROTTLER_TTL_MS: z.coerce.number().default(60000),

  // =============================================================================
  // ANTI-CSRF SECURITY PRESETS
  // =============================================================================
  /**
   * Explicitly toggles whether active double-submit cookie verification state is enforced.
   */
  CSRF_ENABLED: coerceBoolean.default(false),

  /**
   * Bound host network namespace context for tracking validation state cookies.
   */
  CSRF_COOKIE_DOMAIN: z.string().default(''),

  /**
   * Context ruleset defining cookie exposure criteria across cross-site boundaries.
   */
  CSRF_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // =============================================================================
  // STATE MANAGEMENT & THIRD-PARTY SERVICES
  // =============================================================================
  /**
   * Connection link interface configuration parameters for Redis database.
   */
  REDIS_URL: z.string().default('redis://localhost:6379'),

  /**
   * The percentage allocation rate tracking transactions dispatched to Sentry dashboard panels.
   */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.1),

  // =============================================================================
  // INFRASTRUCTURE HEALTH & SYSTEMS OBSERVABILITY
  // =============================================================================
  /**
   * Percent limit boundary triggering alerts when volume storage exceeds thresholds.
   * Example: 0.8 handles alerts at 80% full usage layout metrics.
   */
  HEALTH_DISK_THRESHOLD: z.coerce.number().default(0.8),

  /**
   * V8 virtual engine heap memory upper allocation cap boundary defined in Bytes.
   */
  HEALTH_MEMORY_HEAP_MB: z.coerce.number().int().min(64).default(512),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

/**
 * TypeScript type definitions extracted compilation signature derived from Zod.
 */

export type AppConfig = z.infer<typeof appConfigSchema>;
