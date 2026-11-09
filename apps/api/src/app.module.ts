import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AccountModule } from './account/account.module.js';
import { AddressesModule } from './addresses/addresses.module.js';
import { CartModule } from './cart/cart.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { LegalModule } from './legal/legal.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { StoreSettingsModule } from './store-settings/store-settings.module.js';
import { AdminUsersModule } from './admin-users/admin-users.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { AppThrottlerGuard } from './common/app-throttler.guard.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Ortam değişkenleri açılışta doğrulanır (hatalıysa API başlamaz)
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),

    // Global istek sınırı. Giriş, kayıt gibi uçlar kendi daha sıkı sınırını koyar.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'long', ttl: 3_600_000, limit: 3000 },
    ]),

    PrismaModule,
    MailModule,
    AuditModule,
    HealthModule,
    AuthModule,
    AccountModule,
    AdminUsersModule,
    CatalogModule,
    MediaModule,
    MaintenanceModule,
    StoreSettingsModule,
    CouponsModule,
    CartModule,
    AddressesModule,
    LegalModule,
    OrdersModule,
    CheckoutModule,
    PaymentsModule,
    ReturnsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
