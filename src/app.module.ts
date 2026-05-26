import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@interloid/config';
import { CoreModule } from '@interloid/core';
import { LoggerModule } from '@interloid/logger';
import { ValidationModule } from '@interloid/validation';
import { ObservabilityModule } from '@interloid/observability';
import { AUTH_THROTTLER_PRESET, SecurityModule } from '@interloid/security';
import { appConfigSchema } from './config/env.schema';

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
      nodeEnv:
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
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
      level: 'error', // Suppresses info/debug logs, ensuring only high-severity system failures hit the output stream
      file: {
        retentionDays: 7, // Deletes historical log files automatically after 7 days to prevent server disk overflow
        cleanupCron: '0 0 * * *', // Nightly cron schedule (executed at midnight) that sweeps and purges expired files
        alsoStdout: true, // Simultaneously mirrors file-bound logs onto the standard terminal console output
        directory: process.cwd(), // Configures the specific root/target directory path where log files write to disk
      },
      format: 'json', // Enforces rigid single-line JSON, enabling smooth indexing by aggregators like Datadog or Loki
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
        diskThresholdPercent: 0.8, // Marks system degraded/unhealthy if server disk capacity surpasses an 80% ceiling
        memoryHeapBytes: 512 * 1024 * 1024, // Fails health check if JavaScript V8 engine working memory spikes past 512MB
        redis: { url: 'redis://localhost:6379', name: 'redis' }, // Automated background database connection check ping
        externalHttp: [{ name: 'google', url: 'https://www.google.com' }], // Verifies external gateway access remains online
      },
      metrics: {
        collectDefaultMetrics: true, // Emits standard node engine performance tracks (CPU, loop delays, GC frequency)
      },
      sentry: {
        dsn: process.env.SENTRY_DSN, // Specifies the ingestion address endpoint where error capture frames route to
        tracesSampleRate: 1.0, // Captures 100% of pipeline transactions for exhaustive route performance mapping
        enabled: !!process.env.SENTRY_DSN, // Safe evaluated check ensuring Sentry activates only if a target configuration is supplied
        environment: process.env.NODE_ENV || 'development', // Segregates logging frames by explicit environment tags
        release: `nest-starter-minimal@${process.env.npm_package_version}`, // Matches error captures to explicit build hashes or versions
      },
    }),

    /**
     * 6. SECURITY HEADERS & CONTROLS
     * Enforces strict web client parameters, CSRF safety, and API request throttling.
     */
    SecurityModule.forRoot({
      csrf: {
        ignoreMethods: ['GET'], // Read-only REST queries bypass verification tokens since they change no state
        headerName: 'X-CSRF-Token', // Dictates the request header label name clients need to attach tokens on
        sameSite: 'lax', // Mitigates cross-site attack vulnerabilities on browser-to-server cookies
        cookieDomain: '.example.com', // Extends validation scope seamlessly to share access tokens along subdomains
        cookieName: 'csrf-token', // Defines the key label identifier used to track the security cookie payload
        secure: true, // Enforces security cookies to exclusively travel on active, encrypted HTTPS connections
      },
      throttler: AUTH_THROTTLER_PRESET, // Enforces high-protection request caps to shield API domains from brute-force scripts
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
