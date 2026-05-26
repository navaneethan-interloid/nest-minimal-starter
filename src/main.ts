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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const isProd = process.env.NODE_ENV === 'production';
  app.use(isProd ? strictHelmet() : swaggerSafeHelmet());

  app.enableCors(buildCorsOptions({ origins: ['*'], allowNoOrigin: true }));
  app.use((cookieParser as unknown as () => RequestHandler)());

  const config = new DocumentBuilder()
    .setTitle('Testing API')
    .setDescription('The Starter app package testing API')
    .setVersion('1.0')
    .build();

  app.set('trust proxy', 1);
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
