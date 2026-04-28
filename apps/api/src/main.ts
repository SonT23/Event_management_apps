import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { validateEnvOrThrow } from './config/env.validation';
import { AppModule } from './app.module';

// Prisma/JSON: BigInt (id) dùng response JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  validateEnvOrThrow();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const corsOrigin =
    process.env.CORS_ORIGIN === '*'
      ? true
      : (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
          .split(',')
          .map((o) => o.trim());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter());
  app.enableShutdownHooks();
  // PORT rỗng / sai → '' | NaN; `??` không thay chuỗi rỗng → gây ERR_SOCKET_BAD_PORT trên PaaS (Render)
  const port = Number.parseInt(String(process.env.PORT || '3000'), 10);
  const listenPort = Number.isFinite(port) && port > 0 ? port : 3000;
  await app.listen(listenPort);
  // eslint-disable-next-line no-console
  console.log(`API http://127.0.0.1:${listenPort}/api`);
}
bootstrap();
