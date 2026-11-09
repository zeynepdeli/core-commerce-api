import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvConfig, true>);
  const logger = new Logger('Bootstrap');

  // --- Güvenlik: HTTP header'ları ---
  app.use(helmet());

  // --- Güvenlik: CORS whitelist ---
  app.enableCors({
    origin: config.get('ALLOWED_ORIGINS', { infer: true }), // artık string[] (transform sayesinde)
    credentials: true, // refresh token'ı httpOnly cookie ile taşıyacaksan gerekli
  });

  // --- Güvenlik: Input validation (DTO'lar için global) ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da tanımlı olmayan alanları otomatik at
      forbidNonWhitelisted: true, // tanımlı olmayan alan gelirse hata fırlat (mass assignment koruması)
      transform: true, // gelen payload'ı otomatik DTO class instance'ına çevir
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Graceful shutdown: PrismaService.onModuleDestroy'un tetiklenmesi için zorunlu ---
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(
    `Uygulama ${port} portunda çalışıyor (${config.get('NODE_ENV', { infer: true })})`,
  );
}

bootstrap().catch((error) => {
  console.error('Uygulama başlatılamadı:', error);
  process.exit(1);
});
