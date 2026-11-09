import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  // Reverse proxy arkasında gerçek istemci IP'si (hız sınırı için önemli)
  const trustProxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  // İstek gövdesi boyut sınırı (DoS koruması)
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: false });

  // CORS: yalnızca izin verilen adresler. Kimlik çerezleri API'ye değil,
  // mağaza/admin sunucusuna aittir; bu yüzden credentials kapalı.
  app.enableCors({
    origin: config.get('ALLOWED_ORIGINS', { infer: true }),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Teknoloji bilgisini gizle (bilgi sızıntısı)
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Güvenlik başlıkları. API yalnızca JSON döndürür; hiçbir kaynak yüklenmez.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      strictTransportSecurity: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  // Kişisel veya yetkili yanıtlar hiçbir yerde önbelleğe alınmasın
  for (const prefix of ['/admin', '/auth', '/account']) {
    app.use(prefix, (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });
  }

  // Global DTO doğrulama: tanımsız alan gelirse istek reddedilir
  // (mass assignment — ör. "role": "ADMIN" gönderilmesi)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
