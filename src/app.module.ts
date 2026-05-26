import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@interloid/config';
import { CoreModule } from '@interloid/core';
import { LoggerModule } from '@interloid/logger';
import { ValidationModule } from '@interloid/validation';
import { ObservabilityModule } from '@interloid/observability';
import { SecurityModule } from '@interloid/security';
import { appConfigSchema } from './config/env.schema';

const env = appConfigSchema.parse(process.env);
const isProd = env.NODE_ENV === 'production';
@Module({
  imports: [
    /**
     * 1. CONFIGURATION SYSTEM
     * Manages, validates, and initializes environment variables application-wide.
     */
    ConfigModule.forRoot({
      isGlobal: true, // Makes configuration variables accessible across all feature modules without re-importing
      envDir: process.cwd(), // Defines the root directory execution path where the engine looks for .env files
      schema: appConfigSchema, // Enforces strict type validation, coercion, and defaults via your Zod schema
      expandVariables: true, // Enables nested variable interpolation inside your environment configuration files
      // FIX: Evaluates the system variable directly to bypass the unparsed Zod schema type-overlap issue
      nodeEnv: isProd ? 'production' : 'development',
      loadLocalInTest: true, // Forces local override variables to actively load even under test execution modes
    }),

    /**
     * 2. CORE UTILITIES
     * Implements basic architectural patterns for the platform ecosystem.
     */
    CoreModule.forRoot({
      applyMiddleware: true, // Automatically activates request tracking (Correlation IDs) and response envelope formatters
    }),

    /**
     * 3. STRUCTURED LOGGING
     * Handles contextual console output and filesystem streaming.
     */
    LoggerModule.forRoot({
      level: env.LOG_LEVEL, // Minimum log level — messages below this are dropped
      file: {
        retentionDays: env.LOG_RETENTION_DAYS, // Deletes historical log files automatically after the specified number of days to prevent server disk overflow
        cleanupCron: '0 0 * * *', // Nightly cron schedule (executed at midnight) that sweeps and purges expired files
        alsoStdout: env.LOG_ALSO_STDOUT, // Simultaneously mirrors file-bound logs onto the standard terminal console output
        directory: env.LOG_DIRECTORY, // Configures the specific root/target directory path where log files write to disk
      },
      format: env.LOG_FORMAT, // 'json' or 'pretty' — set via LOG_FORMAT env var
      redact: ['password', 'secret'], // Scans logs to automatically strip and mask sensitive data payloads from leaking
      serviceName: 'nest-starter-minimal', // Stitches this name tag to every log, enabling easy filtering in cloud dashboards
    }),

    /**
     * 4. REQUEST VALIDATION
     * Globally validates incoming network controller payloads.
     */
    ValidationModule.forRoot({
      global: true, // Attaches validation pipe logic uniformly over every endpoint router in the application
    }),

    /**
     * 5. OBSERVABILITY & TELEMETRY
     * Orchestrates application health testing, Prometheus performance metrics, and Sentry tracking.
     */
    ObservabilityModule.forRoot({
      health: {
        enabled: true, // Turns the telemetry health indicator module fully on
        endpoint: '/health', // Defines the active HTTP path matching where load balancers verify infrastructure state
        diskThresholdPercent: env.HEALTH_DISK_THRESHOLD, // Disk usage fraction above which /health returns degraded (0.0–1.0)
        memoryHeapBytes: env.HEALTH_MEMORY_HEAP_BYTES, // Heap size in bytes above which /health returns degraded
        redis: {
          url: env.REDIS_URL,
          name: 'redis',
        }, // Automated background database connection check ping
      },
      metrics: {
        collectDefaultMetrics: true, // Emits standard node engine performance tracks (CPU, loop delays, GC frequency)
      },
      sentry: {
        dsn: env.SENTRY_DSN, // Specifies the ingestion address endpoint where error capture frames route to
        tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE, // Captures 100% of pipeline transactions for exhaustive route performance mapping
        enabled: !!env.SENTRY_DSN, // Safe evaluated check ensuring Sentry activates only if a target configuration is supplied
        environment: env.NODE_ENV || 'development', // Segregates logging frames by explicit environment tags
        release: `nest-starter-minimal@${process.env.npm_package_version}`, // Matches error captures to explicit build hashes or versions
      },
    }),

    /**
     * 6. SECURITY HEADERS & CONTROLS
     * Enforces strict web client parameters, CSRF safety, and API request throttling.
     */
    SecurityModule.forRoot({
      ...(env.CSRF_ENABLED && {
        csrf: {
          ignoreMethods: ['GET'], // Read-only REST queries bypass verification tokens since they change no state
          headerName: 'X-CSRF-Token', // Dictates the request header label name clients need to attach tokens on
          sameSite: env.CSRF_SAME_SITE, // Mitigates cross-site attack vulnerabilities on browser-to-server cookies
          cookieName: 'csrf-token', // Defines the key label identifier used to track the security cookie payload
          secure: isProd, // Enforces security cookies to exclusively travel on active, encrypted HTTPS connections
          ...(env.CSRF_COOKIE_DOMAIN && {
            cookieDomain: env.CSRF_COOKIE_DOMAIN,
          }), // Extends validation scope seamlessly to share access tokens along subdomains
        },
      }),
      throttler: {
        throttlers: [
          {
            name: 'global',
            ttl: env.THROTTLER_TTL_MS,
            limit: env.THROTTLER_LIMIT,
          },
        ],
      }, // Enforces high-protection request caps to shield API domains from brute-force scripts
      //GLOBAL_THROTTLER_PRESET, // Applies more lenient throttling rules suitable for general API rate-limiting use cases
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
