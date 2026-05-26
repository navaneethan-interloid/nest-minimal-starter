import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  buildCorsOptions,
  strictHelmet,
  swaggerSafeHelmet,
} from '@interloid/security';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RequestHandler } from 'express';
import { appConfigSchema } from './config/env.schema';
import { bootstrapSentry, bootstrapTracing } from '@interloid/observability';
import { LoggerService } from '@interloid/logger';

// Parse env once at the boundary.
const env = appConfigSchema.parse(process.env);

// ---- EARLY OBSERVABILITY ----
// Must run BEFORE NestFactory.create() so instrumentation catches the
// full request lifecycle and startup errors.
bootstrapTracing({
  enabled: !!env.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: 'nest-starter-minimal',
  serviceVersion: process.env['npm_package_version'] ?? '0.0.0',
  exporter: env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? { type: 'otlp' }
    : { type: 'console' },
});

bootstrapSentry({
  enabled: !!env.SENTRY_DSN,
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  release: `nest-starter-minimal@${process.env['npm_package_version'] ?? '0.0.0'}`,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const isProd = process.env.NODE_ENV === 'production';
  app.use(isProd ? strictHelmet() : swaggerSafeHelmet());

  app.enableCors(
    buildCorsOptions({ origins: env.CORS_ORIGINS, allowNoOrigin: !isProd }),
  );
  app.use((cookieParser as unknown as () => RequestHandler)());

  const config = new DocumentBuilder()
    .setTitle('Testing API')
    .setDescription('The Starter app package testing API')
    .setVersion('1.0')
    .build();

  app.set('trust proxy', env.TRUST_PROXY_DEPTH);
  const document = SwaggerModule.createDocument(app, config);

  app.useLogger(app.get(LoggerService));

  // app.useGlobalInterceptors(new LoggingInterceptor(logger));
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
